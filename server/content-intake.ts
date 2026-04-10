import type { Express, Request, Response } from "express";
import { openai } from "./lib/openai";
import { CONTENT_INTAKE_ARTICLE_SYSTEM } from "./ai/prompts/content-pipeline";
import { storage } from "./storage";
import type { InsertImportDraft } from "@shared/schema";
import { businesses, articles, events, importDrafts } from "@shared/schema";
import { db } from "./db";
import { ilike, or, eq, sql, and } from "drizzle-orm";
import multer from "multer";
import { z } from "zod";
import { createInboxItemIfNotOpen } from "./admin-inbox";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

type MulterRequest = Request & { file?: Express.Multer.File };

import { generateEventSlug, slugify as sharedSlugify } from "./lib/slug-utils";
import { queueTranslation } from "./services/auto-translate";
import { geoTagAndClassify } from "./services/geo-tagger";

async function matchBusinessesByText(cityId: string, text: string): Promise<string[]> {
  try {
    const allBiz = await db.select({ id: businesses.id, name: businesses.name, websiteUrl: businesses.websiteUrl })
      .from(businesses)
      .where(eq(businesses.cityId, cityId))
      .limit(2000);

    const matchedIds: string[] = [];
    const textLower = text.toLowerCase();

    for (const biz of allBiz) {
      if (!biz.name || biz.name.length < 3) continue;
      const nameLower = biz.name.toLowerCase();
      if (textLower.includes(nameLower)) {
        matchedIds.push(biz.id);
        continue;
      }
      if (biz.websiteUrl) {
        try {
          const domain = new URL(biz.websiteUrl).hostname.replace(/^www\./, '');
          if (domain.length > 4 && textLower.includes(domain)) {
            matchedIds.push(biz.id);
          }
        } catch {}
      }
    }
    return matchedIds;
  } catch (err) {
    console.error("[Intake] Business matching error:", err instanceof Error ? err.message : err);
    return [];
  }
}

async function matchBusinessByVenueName(cityId: string, venueName: string): Promise<string | null> {
  if (!venueName || venueName.trim().length < 2) return null;
  try {
    const results = await db.select({ id: businesses.id, name: businesses.name })
      .from(businesses)
      .where(and(
        eq(businesses.cityId, cityId),
        ilike(businesses.name, venueName.trim()),
      ))
      .limit(1);

    if (results.length > 0) return results[0].id;

    const fuzzyResults = await db.select({ id: businesses.id, name: businesses.name })
      .from(businesses)
      .where(and(
        eq(businesses.cityId, cityId),
        ilike(businesses.name, `%${venueName.trim()}%`),
      ))
      .limit(5);

    if (fuzzyResults.length === 1) return fuzzyResults[0].id;
    const exactish = fuzzyResults.find(b => b.name.toLowerCase().trim() === venueName.toLowerCase().trim());
    if (exactish) return exactish.id;
    return null;
  } catch (err) {
    console.error("[Intake] Venue matching error:", err instanceof Error ? err.message : err);
    return null;
  }
}

async function learnFeedDefaultBusiness(feedId: string, businessId: string): Promise<void> {
  const publishedFromFeed = await db.select({ id: importDrafts.id, publishedEntityId: importDrafts.publishedEntityId })
    .from(importDrafts)
    .where(and(
      eq(importDrafts.feedId, feedId),
      eq(importDrafts.status, "PUBLISHED"),
      eq(importDrafts.draftType, "ARTICLE"),
    ))
    .limit(5);

  if (publishedFromFeed.length < 3) return;

  let matchCount = 0;
  for (const pd of publishedFromFeed) {
    if (!pd.publishedEntityId) continue;
    const [art] = await db.select({ mentionedBusinessIds: articles.mentionedBusinessIds })
      .from(articles)
      .where(eq(articles.id, pd.publishedEntityId))
      .limit(1);
    if (art?.mentionedBusinessIds?.includes(businessId)) {
      matchCount++;
    }
  }

  if (matchCount >= 3) {
    await storage.updateContentFeed(feedId, { defaultBusinessId: businessId });
    console.log(`[Intake] Feed ${feedId} learned defaultBusinessId → ${businessId} (matched in ${matchCount}/${publishedFromFeed.length} articles)`);
  }
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

const placesSearchSchema = z.object({
  query: z.string().min(1),
  cityId: z.string().uuid(),
});

const placesImportSchema = z.object({
  cityId: z.string().uuid(),
  zoneId: z.string().uuid(),
  categoryIds: z.array(z.string().uuid()).optional().default([]),
  places: z.array(z.object({
    placeId: z.string().optional(),
    name: z.string(),
    address: z.string().optional(),
    rating: z.number().optional(),
    reviewCount: z.number().optional(),
  })).min(1),
});

const urlExtractSchema = z.object({
  url: z.string().url(),
  cityId: z.string().uuid(),
  draftType: z.enum(["ARTICLE", "EVENT", "BUSINESS"]).optional().default("ARTICLE"),
});

const feedCreateSchema = z.object({
  cityId: z.string().uuid(),
  name: z.string().min(1),
  url: z.string().url(),
  feedType: z.enum(["RSS", "ICAL"]),
});

export function registerContentIntakeRoutes(app: Express, requireAdmin: (req: Request, res: Response, next: any) => void) {

  // ── Google Places Bulk Search ──
  app.post("/api/admin/intake/google-places-search", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = placesSearchSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "query and cityId required", details: parsed.error.flatten() });
      const { query, cityId } = parsed.data;

      const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.googel_API_Places || process.env.GOOGLE_PLACES_API_KEY;
      if (!apiKey) return res.status(500).json({ error: "Google Maps API key not configured. Set GOOGLE_MAPS_API_KEY, googel_API_Places, or GOOGLE_PLACES_API_KEY." });

      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`;
      const resp = await fetch(url);
      const data = await resp.json() as any;

      const results = (data.results || []).map((p: any) => ({
        placeId: p.place_id,
        name: p.name,
        address: p.formatted_address,
        rating: p.rating,
        reviewCount: p.user_ratings_total,
        types: p.types,
        lat: p.geometry?.location?.lat,
        lng: p.geometry?.location?.lng,
      }));

      res.json({ results, total: results.length });
    } catch (err) {
      console.error("[INTAKE] Google Places search error:", err);
      res.status(500).json({ error: "Search failed" });
    }
  });

  // ── Google Places Bulk Import ──
  app.post("/api/admin/intake/google-places-import", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = placesImportSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid import data", details: parsed.error.flatten() });
      const { cityId, zoneId, categoryIds, places } = parsed.data;

      const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.googel_API_Places || process.env.GOOGLE_PLACES_API_KEY;
      const drafts: InsertImportDraft[] = [];

      for (const place of places) {
        let details = place;
        if (place.placeId && apiKey) {
          try {
            const detUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.placeId}&fields=name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,url,address_components&key=${apiKey}`;
            const detResp = await fetch(detUrl);
            const detData = await detResp.json() as any;
            if (detData.result) {
              const r = detData.result;
              const comps = r.address_components || [];
              const getComp = (type: string) => comps.find((c: any) => c.types.includes(type))?.long_name || "";
              details = {
                ...place,
                name: r.name || place.name,
                address: r.formatted_address || place.address,
                phone: r.formatted_phone_number || "",
                websiteUrl: r.website || "",
                rating: r.rating,
                reviewCount: r.user_ratings_total,
                mapsUrl: r.url || "",
                city: getComp("locality"),
                state: getComp("administrative_area_level_1"),
                zip: getComp("postal_code"),
              };
            }
          } catch (e) {
            console.error("[INTAKE] Place details fetch failed:", e);
          }
        }

        drafts.push({
          cityId,
          draftType: "BUSINESS",
          source: "GOOGLE_PLACES",
          extractedData: {
            name: details.name,
            slug: slugify(details.name),
            description: "",
            address: details.address || "",
            city: details.city || "",
            state: details.state || "",
            zip: details.zip || "",
            phone: details.phone || "",
            websiteUrl: details.websiteUrl || "",
            zoneId,
            categoryIds: categoryIds || [],
            googlePlaceId: details.placeId || place.placeId,
            googleRating: details.rating ? String(details.rating) : null,
            googleReviewCount: details.reviewCount || null,
            googleMapsUrl: details.mapsUrl || "",
          },
          rawData: details,
        });
      }

      const created = await storage.createImportDraftsBatch(drafts);

      if (created.length > 0) {
        createInboxItemIfNotOpen({
          itemType: "listing_imported_needs_publish",
          relatedTable: "import_drafts",
          relatedId: cityId,
          title: `Google Places Import: ${created.length} business drafts`,
          summary: `${created.length} businesses imported from Google Places. Review and publish.`,
          tags: ["Content", "GooglePlaces"],
          links: [{ label: "Review in Inbox", urlOrRoute: "/admin/inbox" }],
        }).catch(err => console.error("[Inbox] Google Places batch:", err.message));
      }

      res.json({ imported: created.length, drafts: created });
    } catch (err) {
      console.error("[INTAKE] Google Places import error:", err);
      res.status(500).json({ error: "Import failed" });
    }
  });

  // ── Photo Capture with AI Extraction ──
  app.post("/api/admin/intake/photo-extract", requireAdmin, upload.single("photo"), async (req: Request, res: Response) => {
    try {
      const mReq = req as MulterRequest;
      const { cityId, draftType } = req.body;
      if (!cityId || !mReq.file) return res.status(400).json({ error: "cityId and photo required" });

      const type = draftType || "BUSINESS";
      const base64 = mReq.file.buffer.toString("base64");
      const mimeType = mReq.file.mimetype || "image/jpeg";

      const systemPrompt = type === "EVENT"
        ? `You extract event information from photos of flyers, posters, or signs. Return a JSON object with these fields (use empty string for missing fields):
{
  "title": "event name",
  "description": "event description",
  "startDateTime": "ISO date string or best guess",
  "endDateTime": "ISO date string or empty",
  "locationName": "venue name",
  "address": "full address",
  "city": "city name",
  "state": "state abbreviation",
  "zip": "zip code",
  "costText": "price or 'Free'",
  "websiteUrl": "url if visible",
  "phone": "phone if visible"
}`
        : `You extract business information from photos of business cards, flyers, storefronts, or signs. Return a JSON object with these fields (use empty string for missing fields):
{
  "name": "business name",
  "description": "what the business does",
  "address": "full street address",
  "city": "city name",
  "state": "state abbreviation",
  "zip": "zip code",
  "phone": "phone number",
  "websiteUrl": "website url",
  "email": "email if visible"
}`;

      if (!openai) return res.status(503).json({ error: "OpenAI not configured" });

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract the information from this image. Return only valid JSON." },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content || "{}";
      let extracted: any;
      try {
        extracted = JSON.parse(content);
      } catch {
        extracted = { name: "Could not parse", rawResponse: content };
      }

      if (type === "BUSINESS") {
        extracted.slug = slugify(extracted.name || "unknown");
      } else {
        extracted.slug = slugify(extracted.title || "unknown");
      }

      const draft = await storage.createImportDraft({
        cityId,
        draftType: type as any,
        source: "PHOTO_CAPTURE",
        extractedData: extracted,
        rawData: { originalFilename: mReq.file!.originalname, mimeType, size: mReq.file!.size },
      });

      const draftTitle = extracted.name || extracted.title || "Untitled";
      createInboxItemIfNotOpen({
        itemType: "listing_imported_needs_publish",
        relatedTable: "import_drafts",
        relatedId: draft.id,
        title: `Photo Capture Draft: ${draftTitle}`,
        summary: `${type} extracted from photo. Review and publish.`,
        tags: ["Content", "Photo"],
        links: [{ label: "Review in Inbox", urlOrRoute: "/admin/inbox" }],
      }).catch(err => console.error("[Inbox] Photo draft:", err.message));

      res.json({ draft });
    } catch (err) {
      console.error("[INTAKE] Photo extract error:", err);
      res.status(500).json({ error: "Photo extraction failed" });
    }
  });

  // ── URL Content Extraction ──
  app.post("/api/admin/intake/url-extract", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = urlExtractSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "url and cityId required", details: parsed.error.flatten() });
      const { url, cityId, draftType } = parsed.data;

      const type = draftType;

      let pageContent = "";
      try {
        const resp = await fetch(url, {
          headers: { "User-Agent": "CityMetroHub/1.0 Content Importer" },
          signal: AbortSignal.timeout(15000),
        });
        pageContent = await resp.text();
      } catch (e) {
        return res.status(400).json({ error: "Could not fetch the URL" });
      }

      const textContent = pageContent
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 8000);

      const systemPrompt = type === "EVENT"
        ? `Extract event information from this web page content. Return a JSON object:
{
  "title": "event name",
  "description": "event description (2-3 sentences rewritten in your own words)",
  "startDateTime": "ISO date string",
  "endDateTime": "ISO date string or empty",
  "locationName": "venue name",
  "address": "address",
  "city": "city",
  "state": "state",
  "zip": "zip",
  "costText": "price info",
  "websiteUrl": "original url"
}`
        : type === "BUSINESS"
        ? `Extract business information from this web page content. Return a JSON object:
{
  "name": "business name",
  "description": "business description (2-3 sentences rewritten in your own words)",
  "address": "street address",
  "city": "city",
  "state": "state",
  "zip": "zip code",
  "phone": "phone number",
  "websiteUrl": "website url",
  "email": "email if visible",
  "hours": "hours of operation if available",
  "category": "primary business category (e.g. Restaurant, Salon, Law Firm)",
  "tags": "comma-separated relevant tags"
}`
        : `Extract article/content information from this web page content. Return a JSON object:
{
  "title": "article title",
  "excerpt": "brief 1-2 sentence summary",
  "content": "the main article content rewritten in your own words (keep key facts, dates, names)",
  "sourceUrl": "original url",
  "sourceName": "name of the publication"
}`;

      if (!openai) return res.status(503).json({ error: "OpenAI not configured" });

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Extract information from this page (URL: ${url}):\n\n${textContent}` },
        ],
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content || "{}";
      let extracted: any;
      try {
        extracted = JSON.parse(content);
      } catch {
        extracted = { title: "Could not parse", rawResponse: content };
      }

      extracted.slug = slugify(extracted.title || "unknown");

      const draft = await storage.createImportDraft({
        cityId,
        draftType: type as any,
        source: "URL_EXTRACT",
        sourceUrl: url,
        extractedData: extracted,
        rawData: { url, fetchedLength: textContent.length },
      });

      const extractTitle = extracted.title || extracted.name || "Untitled";
      createInboxItemIfNotOpen({
        itemType: "listing_imported_needs_publish",
        relatedTable: "import_drafts",
        relatedId: draft.id,
        title: `URL Extract Draft: ${extractTitle}`,
        summary: `${type} extracted from ${url}. Review and publish.`,
        tags: ["Content", "URL"],
        links: [{ label: "Review in Inbox", urlOrRoute: "/admin/inbox" }],
      }).catch(err => console.error("[Inbox] URL draft:", err.message));

      res.json({ draft });
    } catch (err) {
      console.error("[INTAKE] URL extract error:", err);
      res.status(500).json({ error: "URL extraction failed" });
    }
  });

  // ── Story from URL (AI-generated article) ──
  app.post("/api/admin/intake/story-from-url", requireAdmin, async (req: Request, res: Response) => {
    try {
      const schema = z.object({ url: z.string().url(), cityId: z.string().uuid() });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "url and cityId required" });
      const { url, cityId } = parsed.data;

      let pageContent = "";
      try {
        const resp = await fetch(url, {
          headers: { "User-Agent": "CityMetroHub/1.0 Content Importer" },
          signal: AbortSignal.timeout(15000),
        });
        pageContent = await resp.text();
      } catch {
        return res.status(400).json({ error: "Could not fetch the URL" });
      }

      const textContent = pageContent
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 12000);

      if (!openai) return res.status(503).json({ error: "OpenAI not configured" });

      const storyPrompt = CONTENT_INTAKE_ARTICLE_SYSTEM;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: storyPrompt },
          { role: "user", content: `Source URL: ${url}\n\nSource content:\n${textContent}` },
        ],
        response_format: { type: "json_object" },
        temperature: 0.8,
      });

      const content = response.choices[0]?.message?.content || "{}";
      let extracted: Record<string, unknown>;
      try {
        extracted = JSON.parse(content);
      } catch {
        extracted = { title: "Could not generate story", rawResponse: content };
      }

      const titleStr = String(extracted.title || "untitled");
      extracted.slug = slugify(titleStr);
      extracted.sourceUrl = url;

      const draft = await storage.createImportDraft({
        cityId,
        draftType: "ARTICLE",
        source: "URL_EXTRACT",
        sourceUrl: url,
        extractedData: extracted,
        rawData: { url, fetchedLength: textContent.length, generationType: "story_from_url" },
      });

      createInboxItemIfNotOpen({
        itemType: "listing_imported_needs_publish",
        relatedTable: "import_drafts",
        relatedId: draft.id,
        title: `Story Draft: ${titleStr}`,
        summary: `AI-generated story from ${url}. Review and publish.`,
        tags: ["Content", "Story"],
        links: [{ label: "Review in Inbox", urlOrRoute: "/admin/inbox" }],
      }).catch(err => console.error("[Inbox] Story draft:", err.message));

      res.json({ draft });
    } catch (err) {
      console.error("[INTAKE] Story from URL error:", err);
      res.status(500).json({ error: "Story generation failed" });
    }
  });

  // ── Content Feed CRUD ──
  app.get("/api/admin/intake/feeds", requireAdmin, async (req: Request, res: Response) => {
    try {
      const cityId = (req.query.cityId as string) || "";
      if (!cityId) return res.status(400).json({ error: "cityId required" });
      const feeds = await storage.getContentFeeds(cityId);
      res.json(feeds);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch feeds" });
    }
  });

  app.post("/api/admin/intake/feeds", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = feedCreateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid feed data", details: parsed.error.flatten() });
      const feed = await storage.createContentFeed(parsed.data);
      res.json(feed);
    } catch (err) {
      console.error("[INTAKE] Create feed error:", err);
      res.status(500).json({ error: "Failed to create feed" });
    }
  });

  app.patch("/api/admin/intake/feeds/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const feed = await storage.updateContentFeed(req.params.id, req.body);
      if (!feed) return res.status(404).json({ error: "Feed not found" });
      res.json(feed);
    } catch (err) {
      res.status(500).json({ error: "Failed to update feed" });
    }
  });

  app.delete("/api/admin/intake/feeds/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await storage.deleteContentFeed(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete feed" });
    }
  });

  // ── Feed Check (RSS / iCal) ──
  app.post("/api/admin/intake/feeds/:id/check", requireAdmin, async (req: Request, res: Response) => {
    try {
      const feed = await storage.getContentFeedById(req.params.id);
      if (!feed) return res.status(404).json({ error: "Feed not found" });

      const imported = await checkFeed(feed);
      res.json({ imported: imported.length, drafts: imported });
    } catch (err) {
      console.error("[INTAKE] Feed check error:", err);
      res.status(500).json({ error: "Feed check failed" });
    }
  });

  // ── Check All Active Feeds ──
  app.post("/api/admin/intake/feeds/check-all", requireAdmin, async (req: Request, res: Response) => {
    try {
      const feeds = await storage.getActiveContentFeeds();
      let totalImported = 0;
      for (const feed of feeds) {
        const imported = await checkFeed(feed);
        totalImported += imported.length;
      }
      res.json({ feedsChecked: feeds.length, totalImported });
    } catch (err) {
      console.error("[INTAKE] Check all feeds error:", err);
      res.status(500).json({ error: "Feed check failed" });
    }
  });

  // ── Import Drafts CRUD ──
  app.get("/api/admin/intake/drafts", requireAdmin, async (req: Request, res: Response) => {
    try {
      const cityId = req.query.cityId as string;
      if (!cityId) return res.status(400).json({ error: "cityId required" });
      const filters = {
        status: req.query.status as string | undefined,
        draftType: req.query.draftType as string | undefined,
        source: req.query.source as string | undefined,
      };
      const drafts = await storage.getImportDrafts(cityId, filters);
      res.json(drafts);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch drafts" });
    }
  });

  app.get("/api/admin/intake/drafts/counts", requireAdmin, async (req: Request, res: Response) => {
    try {
      const cityId = req.query.cityId as string;
      if (!cityId) return res.status(400).json({ error: "cityId required" });
      const counts = await storage.getImportDraftCounts(cityId);
      res.json(counts);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch counts" });
    }
  });

  app.patch("/api/admin/intake/drafts/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const draft = await storage.updateImportDraft(req.params.id, req.body);
      if (!draft) return res.status(404).json({ error: "Draft not found" });
      res.json(draft);
    } catch (err) {
      res.status(500).json({ error: "Failed to update draft" });
    }
  });

  app.delete("/api/admin/intake/drafts/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await storage.deleteImportDraft(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete draft" });
    }
  });

  // ── Publish Draft (approve → create actual entity) ──
  app.post("/api/admin/intake/drafts/:id/publish", requireAdmin, async (req: Request, res: Response) => {
    try {
      const draft = await storage.getImportDraftById(req.params.id);
      if (!draft) return res.status(404).json({ error: "Draft not found" });
      if (draft.status === "PUBLISHED") return res.status(400).json({ error: "Already published" });

      const data = draft.extractedData as any;
      let entityId = "";

      if (draft.draftType === "BUSINESS") {
        const existing = await storage.getBusinessBySlug(draft.cityId, data.slug);
        if (existing) {
          return res.status(400).json({ error: `Business with slug "${data.slug}" already exists` });
        }
        const biz = await storage.createBusiness({
          cityId: draft.cityId,
          zoneId: data.zoneId,
          name: data.name || "Unnamed Business",
          slug: data.slug || slugify(data.name || "unnamed"),
          description: data.description || "",
          address: data.address || "",
          city: data.city || "",
          state: data.state || "",
          zip: data.zip || "",
          phone: data.phone || "",
          websiteUrl: data.websiteUrl || "",
          categoryIds: Array.isArray(data.categoryIds) ? data.categoryIds : [],
          googlePlaceId: data.googlePlaceId || null,
          googleRating: data.googleRating ? String(data.googleRating) : null,
          googleReviewCount: data.googleReviewCount ? Number(data.googleReviewCount) : null,
          googleMapsUrl: data.googleMapsUrl || null,
          listingTier: "VERIFIED",
          claimStatus: "UNCLAIMED",
        });
        entityId = biz.id;
        queueTranslation("business", biz.id);
        geoTagAndClassify("business", biz.id, draft.cityId, {
          title: data.name || "Unnamed Business",
          description: data.description || null,
          address: data.address || null,
          zip: data.zip || null,
          categoryIds: data.categoryIds || [],
        }, { existingZoneId: data.zoneId || undefined }).catch(err => console.error("[GeoTagger] Intake biz:", err.message));
      } else if (draft.draftType === "EVENT") {
        const rawData = (draft as Record<string, unknown>).rawData as Record<string, unknown> | undefined;
        let evtLat = data.latitude || (rawData?.latitude ? String(rawData.latitude) : null) || null;
        let evtLng = data.longitude || (rawData?.longitude ? String(rawData.longitude) : null) || null;
        if (!evtLat || !evtLng) {
          try {
            const { geocodeFromParts } = await import("./services/geocoding");
            const coords = await geocodeFromParts({
              address: data.address, city: data.city, state: data.state,
              zip: data.zip, locationName: data.locationName,
            });
            if (coords) { evtLat = coords.latitude; evtLng = coords.longitude; }
          } catch (e) { console.error("[Intake] Event geocode failed:", e instanceof Error ? e.message : e); }
        }
        let hostBusinessId: string | null = null;
        let venuePresenceId: string | null = null;
        const evtFeed = draft.feedId ? await storage.getContentFeedById(draft.feedId) : null;
        if (evtFeed && evtFeed.defaultBusinessId) {
          hostBusinessId = evtFeed.defaultBusinessId;
        }
        if (data.locationName) {
          const matchedVenue = await matchBusinessByVenueName(draft.cityId, data.locationName);
          if (matchedVenue) {
            venuePresenceId = matchedVenue;
            if (!hostBusinessId) hostBusinessId = matchedVenue;
            console.log(`[Intake] Event "${data.title}" matched venue "${data.locationName}" → ${matchedVenue}`);
          }
        }

        const evt = await storage.createEvent({
          cityId: draft.cityId,
          zoneId: data.zoneId || req.body.zoneId,
          title: data.title,
          slug: data.slug,
          description: data.description || "",
          startDateTime: new Date(data.startDateTime),
          endDateTime: data.endDateTime ? new Date(data.endDateTime) : null,
          locationName: data.locationName || "",
          address: data.address || "",
          city: data.city || "",
          state: data.state || "",
          zip: data.zip || "",
          costText: data.costText || "",
          categoryIds: data.categoryIds || [],
          ...(evtLat && evtLng && { latitude: evtLat, longitude: evtLng }),
          ...(hostBusinessId && { hostBusinessId }),
          ...(venuePresenceId && { venuePresenceId }),
        });
        entityId = evt.id;
        queueTranslation("event", evt.id);
        geoTagAndClassify("event", evt.id, draft.cityId, {
          title: data.title,
          description: data.description || null,
          address: data.address || null,
          zip: data.zip || null,
          categoryIds: data.categoryIds || [],
        }, { existingZoneId: data.zoneId || req.body.zoneId || undefined }).catch(err => console.error("[GeoTagger] Intake event:", err.message));
      } else if (draft.draftType === "ARTICLE") {
        const artRawData = (draft as Record<string, unknown>).rawData as Record<string, unknown> | undefined;
        let artLat = data.latitude || (artRawData?.latitude ? String(artRawData.latitude) : null) || null;
        let artLng = data.longitude || (artRawData?.longitude ? String(artRawData.longitude) : null) || null;
        if (!artLat || !artLng) {
          if (data.address || data.locationName) {
            try {
              const { geocodeFromParts } = await import("./services/geocoding");
              const coords = await geocodeFromParts({
                address: data.address, city: data.city, state: data.state,
                zip: data.zip, locationName: data.locationName,
              });
              if (coords) { artLat = coords.latitude; artLng = coords.longitude; }
            } catch (e) { console.error("[Intake] Article address geocode:", e instanceof Error ? e.message : e); }
          }
        }
        if (!artLat || !artLng) {
          try {
            const { resolveContentZone } = await import("./services/geo-tagger");
            const geoResult = await resolveContentZone(draft.cityId, {
              title: data.title, description: data.excerpt || data.content || null,
            });
            if (geoResult.zoneId) {
              const { getZoneCentroid } = await import("./services/geocoding");
              const centroid = await getZoneCentroid(geoResult.zoneId);
              if (centroid) { artLat = centroid.latitude; artLng = centroid.longitude; }
            }
          } catch (e) { console.error("[Intake] Article zone geocode:", e instanceof Error ? e.message : e); }
        }
        let mentionedBusinessIds: string[] = [];
        const feed = draft.feedId ? await storage.getContentFeedById(draft.feedId) : null;
        if (feed && feed.defaultBusinessId) {
          mentionedBusinessIds = [feed.defaultBusinessId];
        } else {
          const searchText = [data.title, data.excerpt, data.content].filter(Boolean).join(" ");
          if (searchText.length > 10) {
            mentionedBusinessIds = await matchBusinessesByText(draft.cityId, searchText);
          }
        }

        const dedupedMentionedIds = [...new Set(mentionedBusinessIds)];

        const article = await storage.createArticle({
          cityId: draft.cityId,
          title: data.title,
          slug: data.slug,
          excerpt: data.excerpt || "",
          content: data.content || "",
          publishedAt: new Date(),
          ...(artLat && artLng && { latitude: artLat, longitude: artLng }),
          ...(dedupedMentionedIds.length > 0 && { mentionedBusinessIds: dedupedMentionedIds }),
        });
        entityId = article.id;
        if (dedupedMentionedIds.length > 0) {
          console.log(`[Intake] Article "${data.title}" cross-referenced ${dedupedMentionedIds.length} business(es)`);
        }
        if (feed && !feed.defaultBusinessId && dedupedMentionedIds.length === 1 && draft.feedId) {
          learnFeedDefaultBusiness(draft.feedId, dedupedMentionedIds[0]).catch(err =>
            console.error("[Intake] Feed default biz learn error:", err.message));
        }
        queueTranslation("article", article.id);
        geoTagAndClassify("article", article.id, draft.cityId, {
          title: data.title,
          description: data.excerpt || data.content || null,
        }).catch(err => console.error("[GeoTagger] Intake article:", err.message));
      }

      await storage.updateImportDraft(draft.id, {
        status: "PUBLISHED",
        publishedEntityId: entityId,
      } as any);

      res.json({ ok: true, entityId, draftType: draft.draftType });
    } catch (err) {
      console.error("[INTAKE] Publish draft error:", err);
      res.status(500).json({ error: "Publish failed" });
    }
  });

  // ── Bulk Publish (approve multiple drafts at once) ──
  app.post("/api/admin/intake/drafts/bulk-publish", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { draftIds } = req.body;
      if (!Array.isArray(draftIds) || draftIds.length === 0) return res.status(400).json({ error: "draftIds array required" });

      const results: { id: string; ok: boolean; error?: string; entityId?: string }[] = [];

      for (const draftId of draftIds) {
        try {
          const draft = await storage.getImportDraftById(draftId);
          if (!draft || draft.status === "PUBLISHED") {
            results.push({ id: draftId, ok: false, error: draft ? "Already published" : "Not found" });
            continue;
          }
          const data = draft.extractedData as any;
          let entityId = "";

          if (draft.draftType === "BUSINESS") {
            const slug = data.slug || slugify(data.name || "unnamed");
            const existing = await storage.getBusinessBySlug(draft.cityId, slug);
            if (existing) {
              results.push({ id: draftId, ok: false, error: `Slug "${slug}" already exists` });
              continue;
            }
            const biz = await storage.createBusiness({
              cityId: draft.cityId, zoneId: data.zoneId,
              name: data.name || "Unnamed", slug,
              description: data.description || "", address: data.address || "",
              city: data.city || "", state: data.state || "", zip: data.zip || "",
              phone: data.phone || "", websiteUrl: data.websiteUrl || "",
              categoryIds: Array.isArray(data.categoryIds) ? data.categoryIds : [],
              googlePlaceId: data.googlePlaceId || null,
              googleRating: data.googleRating ? String(data.googleRating) : null,
              googleReviewCount: data.googleReviewCount ? Number(data.googleReviewCount) : null,
              googleMapsUrl: data.googleMapsUrl || null,
              listingTier: "VERIFIED", claimStatus: "UNCLAIMED",
            });
            entityId = biz.id;
            queueTranslation("business", biz.id);
            geoTagAndClassify("business", biz.id, draft.cityId, {
              title: data.name || "Unnamed", description: data.description || null,
              address: data.address || null, zip: data.zip || null,
              categoryIds: Array.isArray(data.categoryIds) ? data.categoryIds : [],
            }, { existingZoneId: data.zoneId || undefined }).catch(err => console.error("[GeoTagger] Bulk biz:", err.message));
          } else if (draft.draftType === "EVENT") {
            const eventSlug = await generateEventSlug(data.title || "event", draft.cityId, {
              startDate: data.startDateTime || null,
              venueName: data.locationName || null,
              zoneName: null,
            });
            const bulkRawData = (draft as Record<string, unknown>).rawData as Record<string, unknown> | undefined;
            let bulkEvtLat = data.latitude || (bulkRawData?.latitude ? String(bulkRawData.latitude) : null) || null;
            let bulkEvtLng = data.longitude || (bulkRawData?.longitude ? String(bulkRawData.longitude) : null) || null;
            if (!bulkEvtLat || !bulkEvtLng) {
              try {
                const { geocodeFromParts } = await import("./services/geocoding");
                const coords = await geocodeFromParts({
                  address: data.address, city: data.city, state: data.state,
                  zip: data.zip, locationName: data.locationName,
                });
                if (coords) { bulkEvtLat = coords.latitude; bulkEvtLng = coords.longitude; }
              } catch (e) { console.error("[Intake] Bulk event geocode:", e instanceof Error ? e.message : e); }
            }
            let bulkHostBizId: string | null = null;
            let bulkVenueId: string | null = null;
            const bulkEvtFeed = draft.feedId ? await storage.getContentFeedById(draft.feedId) : null;
            if (bulkEvtFeed && bulkEvtFeed.defaultBusinessId) {
              bulkHostBizId = bulkEvtFeed.defaultBusinessId;
            }
            if (data.locationName) {
              const matchedV = await matchBusinessByVenueName(draft.cityId, data.locationName);
              if (matchedV) {
                bulkVenueId = matchedV;
                if (!bulkHostBizId) bulkHostBizId = matchedV;
              }
            }

            const evt = await storage.createEvent({
              cityId: draft.cityId, zoneId: data.zoneId,
              title: data.title, slug: eventSlug,
              description: data.description || "",
              startDateTime: new Date(data.startDateTime || Date.now()),
              endDateTime: data.endDateTime ? new Date(data.endDateTime) : null,
              locationName: data.locationName || "", address: data.address || "",
              city: data.city || "", state: data.state || "", zip: data.zip || "",
              costText: data.costText || "", categoryIds: data.categoryIds || [],
              ...(bulkEvtLat && bulkEvtLng && { latitude: bulkEvtLat, longitude: bulkEvtLng }),
              ...(bulkHostBizId && { hostBusinessId: bulkHostBizId }),
              ...(bulkVenueId && { venuePresenceId: bulkVenueId }),
            });
            entityId = evt.id;
            queueTranslation("event", evt.id);
            geoTagAndClassify("event", evt.id, draft.cityId, {
              title: data.title, description: data.description || null,
              address: data.address || null, zip: data.zip || null,
              categoryIds: data.categoryIds || [],
            }, { existingZoneId: data.zoneId || undefined }).catch(err => console.error("[GeoTagger] Bulk event:", err.message));
          } else if (draft.draftType === "ARTICLE") {
            const bulkArtRaw = (draft as Record<string, unknown>).rawData as Record<string, unknown> | undefined;
            let bulkArtLat = data.latitude || (bulkArtRaw?.latitude ? String(bulkArtRaw.latitude) : null) || null;
            let bulkArtLng = data.longitude || (bulkArtRaw?.longitude ? String(bulkArtRaw.longitude) : null) || null;
            if (!bulkArtLat || !bulkArtLng) {
              if (data.address || data.locationName) {
                try {
                  const { geocodeFromParts } = await import("./services/geocoding");
                  const coords = await geocodeFromParts({
                    address: data.address, city: data.city, state: data.state,
                    zip: data.zip, locationName: data.locationName,
                  });
                  if (coords) { bulkArtLat = coords.latitude; bulkArtLng = coords.longitude; }
                } catch (e) { console.error("[Intake] Bulk article address geocode:", e instanceof Error ? e.message : e); }
              }
            }
            if (!bulkArtLat || !bulkArtLng) {
              try {
                const { resolveContentZone } = await import("./services/geo-tagger");
                const geoResult = await resolveContentZone(draft.cityId, {
                  title: data.title, description: data.excerpt || data.content || null,
                });
                if (geoResult.zoneId) {
                  const { getZoneCentroid } = await import("./services/geocoding");
                  const centroid = await getZoneCentroid(geoResult.zoneId);
                  if (centroid) { bulkArtLat = centroid.latitude; bulkArtLng = centroid.longitude; }
                }
              } catch (e) { console.error("[Intake] Bulk article zone geocode:", e instanceof Error ? e.message : e); }
            }
            let bulkMentionedBizIds: string[] = [];
            const bulkArtFeed = draft.feedId ? await storage.getContentFeedById(draft.feedId) : null;
            if (bulkArtFeed && bulkArtFeed.defaultBusinessId) {
              bulkMentionedBizIds = [bulkArtFeed.defaultBusinessId];
            } else {
              const bulkSearchText = [data.title, data.excerpt, data.content].filter(Boolean).join(" ");
              if (bulkSearchText.length > 10) {
                bulkMentionedBizIds = await matchBusinessesByText(draft.cityId, bulkSearchText);
              }
            }

            const dedupedBulkBizIds = [...new Set(bulkMentionedBizIds)];

            const article = await storage.createArticle({
              cityId: draft.cityId,
              title: data.title, slug: data.slug || slugify(data.title || "article"),
              excerpt: data.excerpt || "", content: data.content || "",
              publishedAt: new Date(),
              ...(bulkArtLat && bulkArtLng && { latitude: bulkArtLat, longitude: bulkArtLng }),
              ...(dedupedBulkBizIds.length > 0 && { mentionedBusinessIds: dedupedBulkBizIds }),
            });
            entityId = article.id;
            if (bulkArtFeed && !bulkArtFeed.defaultBusinessId && dedupedBulkBizIds.length === 1 && draft.feedId) {
              learnFeedDefaultBusiness(draft.feedId, dedupedBulkBizIds[0]).catch(err =>
                console.error("[Intake] Bulk feed default biz learn error:", err.message));
            }
            queueTranslation("article", article.id);
            geoTagAndClassify("article", article.id, draft.cityId, {
              title: data.title, description: data.excerpt || data.content || null,
            }).catch(err => console.error("[GeoTagger] Bulk article:", err.message));
          }

          await storage.updateImportDraft(draftId, { status: "PUBLISHED", publishedEntityId: entityId } as any);
          results.push({ id: draftId, ok: true, entityId });
        } catch (e: any) {
          results.push({ id: draftId, ok: false, error: e.message || "Unknown error" });
        }
      }

      const published = results.filter(r => r.ok).length;
      const failed = results.filter(r => !r.ok).length;
      res.json({ published, failed, total: draftIds.length, results });
    } catch (err) {
      console.error("[INTAKE] Bulk publish error:", err);
      res.status(500).json({ error: "Bulk publish failed" });
    }
  });

  // ── AI Bulk Seeder ──
  app.post("/api/admin/intake/bulk-seed", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { cityId, zoneId, zoneName, categoryId, searchQueries } = req.body;
      if (!cityId || !zoneId) return res.status(400).json({ error: "cityId and zoneId required" });

      const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.googel_API_Places || process.env.GOOGLE_PLACES_API_KEY;
      if (!apiKey) return res.status(500).json({ error: "Google Maps API key not configured. Set GOOGLE_MAPS_API_KEY, googel_API_Places, or GOOGLE_PLACES_API_KEY." });

      const queries: string[] = searchQueries || [];
      if (queries.length === 0) return res.status(400).json({ error: "searchQueries array required" });

      let totalImported = 0;
      const allDrafts: any[] = [];

      for (const query of queries) {
        try {
          let nextPageToken: string | undefined;
          let pageCount = 0;

          do {
            const params = new URLSearchParams({ query, key: apiKey });
            if (nextPageToken) params.set("pagetoken", nextPageToken);
            const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`;
            const resp = await fetch(url);
            const data = await resp.json() as any;

            const places = data.results || [];
            const drafts: InsertImportDraft[] = [];

            for (const p of places) {
              const name = p.name || "";
              const slug = slugify(name);
              if (!name) continue;

              drafts.push({
                cityId,
                draftType: "BUSINESS",
                source: "GOOGLE_PLACES",
                extractedData: {
                  name,
                  slug,
                  description: "",
                  address: p.formatted_address || "",
                  city: zoneName || "Charlotte",
                  state: "NC",
                  zip: "",
                  phone: "",
                  websiteUrl: "",
                  zoneId,
                  categoryIds: categoryId ? [categoryId] : [],
                  googlePlaceId: p.place_id || "",
                  googleRating: p.rating ? String(p.rating) : null,
                  googleReviewCount: p.user_ratings_total || null,
                  googleMapsUrl: "",
                  searchQuery: query,
                  latitude: p.geometry?.location?.lat ? String(p.geometry.location.lat) : null,
                  longitude: p.geometry?.location?.lng ? String(p.geometry.location.lng) : null,
                },
                rawData: { placeId: p.place_id, types: p.types, lat: p.geometry?.location?.lat, lng: p.geometry?.location?.lng, latitude: p.geometry?.location?.lat ? String(p.geometry.location.lat) : null, longitude: p.geometry?.location?.lng ? String(p.geometry.location.lng) : null },
              });
            }

            if (drafts.length > 0) {
              const created = await storage.createImportDraftsBatch(drafts);
              allDrafts.push(...created);
              totalImported += created.length;
            }

            nextPageToken = data.next_page_token;
            pageCount++;
            if (nextPageToken && pageCount < 3) {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          } while (nextPageToken && pageCount < 3);
        } catch (e) {
          console.error(`[SEED] Query failed: ${query}`, e);
        }
      }

      if (totalImported > 0) {
        createInboxItemIfNotOpen({
          itemType: "listing_imported_needs_publish",
          relatedTable: "import_drafts",
          relatedId: cityId,
          title: `Bulk Seed: ${totalImported} business drafts`,
          summary: `${totalImported} businesses imported via bulk seed (${queries.length} queries). Review and publish.`,
          tags: ["Content", "BulkSeed"],
          links: [{ label: "Review in Inbox", urlOrRoute: "/admin/inbox" }],
        }).catch(err => console.error("[Inbox] Bulk seed:", err.message));
      }

      res.json({ totalImported, queries: queries.length, drafts: allDrafts.slice(0, 5) });
    } catch (err) {
      console.error("[INTAKE] Bulk seed error:", err);
      res.status(500).json({ error: "Bulk seed failed" });
    }
  });

  // ── Auto-Seed (run across all zones × common categories) ──
  app.post("/api/admin/intake/auto-seed", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { cityId, zoneId, categoryId } = req.body;
      if (!cityId) return res.status(400).json({ error: "cityId required" });

      const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.googel_API_Places || process.env.GOOGLE_PLACES_API_KEY;
      if (!apiKey) return res.status(500).json({ error: "Google Maps API key not configured. Set GOOGLE_MAPS_API_KEY, googel_API_Places, or GOOGLE_PLACES_API_KEY." });

      const city = await storage.getCityById(cityId);
      if (!city) return res.status(404).json({ error: "City not found" });

      const allZones = await storage.getZonesByCityId(cityId);
      const zones = zoneId ? allZones.filter(z => z.id === zoneId) : allZones;
      const allCategories = await storage.getAllCategories();
      const categories = categoryId ? allCategories.filter(c => c.id === categoryId) : allCategories;

      const searchTemplates: Record<string, string[]> = {
        "Restaurant & Dining": ["restaurants", "coffee shops", "bakeries", "bars", "food trucks", "catering"],
        "Professional Services": ["law firms", "accountants", "real estate agents", "insurance agents", "financial advisors", "marketing agencies", "IT services", "consultants"],
        "Health & Wellness": ["doctors", "dentists", "gyms", "yoga studios", "chiropractors", "veterinarians", "pharmacies"],
        "Home Services": ["plumbers", "electricians", "HVAC", "landscapers", "cleaning services", "roofers"],
        "Retail & Shopping": ["clothing stores", "gift shops", "jewelry stores", "bookstores", "hardware stores", "thrift stores"],
        "Beauty & Personal Care": ["hair salons", "barbershops", "nail salons", "spas", "tattoo shops"],
        "Entertainment & Recreation": ["movie theaters", "bowling alleys", "arcades", "live music venues", "art galleries", "museums"],
        "Nonprofit & Faith": ["churches", "nonprofits", "community centers", "food banks", "shelters"],
      };

      const matchedCategories = categories.filter(c => searchTemplates[c.name] && c.slug !== "events");
      const totalSearches = zones.length * matchedCategories.length * 2;
      console.log(`[AUTO-SEED] Starting: ${zones.length} zones × ${matchedCategories.length} categories = up to ${totalSearches} Google Places searches`);

      let totalImported = 0;
      let totalFound = 0;
      let totalSkipped = 0;
      let totalApiErrors = 0;
      let searchCount = 0;
      const progress: { zone: string; category: string; found: number; imported: number; skipped: number; error?: string }[] = [];

      for (const zone of zones) {
        for (const category of categories) {
          const templates = searchTemplates[category.name];
          if (!templates || category.slug === "events") continue;

          for (const template of templates.slice(0, 2)) {
            searchCount++;
            const query = `${template} in ${zone.name} Charlotte NC`;
            if (searchCount % 10 === 0 || searchCount === 1) {
              console.log(`[AUTO-SEED] Progress: ${searchCount}/${totalSearches} searches completed | ${totalImported} drafts imported so far`);
            }
            try {
              let pageUrl: string | null = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`;
              let queryFound = 0;
              let queryImported = 0;
              let querySkipped = 0;
              let pageNum = 0;
              const maxPages = 3;

              while (pageUrl && pageNum < maxPages) {
                pageNum++;
                const resp = await fetch(pageUrl);
                const data = await resp.json() as Record<string, unknown>;

                if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
                  totalApiErrors++;
                  const errorDetail = `Google API: ${data.status} - ${(data.error_message as string) || "unknown"}`;
                  if (pageNum === 1) {
                    console.warn(`[AUTO-SEED] API error for "${query}": ${errorDetail}`);
                    progress.push({ zone: zone.name, category: category.name, found: 0, imported: 0, skipped: 0, error: errorDetail });
                  }
                  break;
                }

                const places = (data.results || []) as Record<string, unknown>[];
                queryFound += places.length;
                totalFound += places.length;
                const drafts: InsertImportDraft[] = [];

                for (const p of places) {
                  const name = (p.name as string) || "";
                  if (!name) {
                    querySkipped++;
                    continue;
                  }
                  drafts.push({
                    cityId,
                    draftType: "BUSINESS",
                    source: "GOOGLE_PLACES",
                    extractedData: {
                      name,
                      slug: slugify(name),
                      description: "",
                      address: (p.formatted_address as string) || "",
                      city: "Charlotte",
                      state: "NC",
                      zip: "",
                      phone: "",
                      websiteUrl: "",
                      zoneId: zone.id,
                      categoryIds: [category.id],
                      googlePlaceId: (p.place_id as string) || "",
                      googleRating: p.rating ? String(p.rating) : null,
                      googleReviewCount: (p.user_ratings_total as number) || null,
                      googleMapsUrl: "",
                    },
                    rawData: { placeId: p.place_id, types: p.types },
                  });
                }

                if (drafts.length > 0) {
                  await storage.createImportDraftsBatch(drafts);
                  queryImported += drafts.length;
                  totalImported += drafts.length;
                }
                totalSkipped += querySkipped;

                const nextToken = data.next_page_token as string | undefined;
                if (nextToken && pageNum < maxPages) {
                  pageUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${nextToken}&key=${apiKey}`;
                  await new Promise(resolve => setTimeout(resolve, 2000));
                } else {
                  pageUrl = null;
                }
              }

              progress.push({ zone: zone.name, category: category.name, found: queryFound, imported: queryImported, skipped: querySkipped, pages: pageNum });

              await new Promise(resolve => setTimeout(resolve, 300));
            } catch (e: unknown) {
              const errMsg = e instanceof Error ? e.message : String(e);
              console.error(`[SEED] Auto-seed query failed: ${template} in ${zone.name}`, e);
              totalApiErrors++;
              progress.push({ zone: zone.name, category: category.name, found: 0, imported: 0, skipped: 0, error: errMsg });
            }
          }
        }
      }

      console.log(`[AUTO-SEED] Complete: ${searchCount} searches, ${totalImported} drafts imported, ${totalFound} places found, ${totalApiErrors} API errors`);

      if (totalImported > 0) {
        createInboxItemIfNotOpen({
          itemType: "listing_imported_needs_publish",
          relatedTable: "import_drafts",
          relatedId: cityId,
          title: `Auto-Seed: ${totalImported} business drafts imported`,
          summary: `${totalImported} businesses from ${zones.length} zones across ${matchedCategories.length} categories. Review and publish.`,
          tags: ["Content", "Auto-Seed", "Batch"],
          links: [{ label: "Review in Inbox", urlOrRoute: "/admin/inbox" }],
        }).catch(err => console.error("[Inbox] Auto-seed batch:", err.message));
      }

      const apiErrors = progress.filter(p => p.error).map(p => ({ zone: p.zone, category: p.category, error: p.error }));

      res.json({
        totalFound,
        totalImported,
        totalSkipped,
        totalApiErrors,
        zonesProcessed: zones.length,
        categoriesProcessed: matchedCategories.length,
        totalSearches: searchCount,
        apiErrors: apiErrors.length > 0 ? apiErrors : undefined,
        progress,
        message: totalImported === 0
          ? `No drafts imported. Found ${totalFound} places total. ${totalApiErrors > 0 ? `${totalApiErrors} API errors occurred — check apiErrors array for details. ` : ""}${totalSkipped > 0 ? `${totalSkipped} skipped (no name). ` : ""}Check progress array for per-query details.`
          : `Successfully imported ${totalImported} drafts from ${totalFound} places found across ${matchedCategories.length} categories and ${zones.length} zones.`,
      });
    } catch (err) {
      console.error("[INTAKE] Auto-seed error:", err);
      res.status(500).json({ error: "Auto-seed failed" });
    }
  });

  // ── CSV Upload ──
  app.post("/api/admin/intake/csv-upload", requireAdmin, upload.single("file"), async (req: Request, res: Response) => {
    try {
      const mReq = req as MulterRequest;
      const { cityId, draftType, zoneId, categoryId } = req.body;
      if (!cityId || !mReq.file) return res.status(400).json({ error: "cityId and file required" });

      const type = draftType || "BUSINESS";
      const csvText = mReq.file.buffer.toString("utf-8");
      const lines = csvText.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) return res.status(400).json({ error: "CSV must have a header row and at least one data row" });

      const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
      const drafts: InsertImportDraft[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => { row[h] = values[idx] || ""; });

        if (type === "BUSINESS") {
          const name = row.name || row.business_name || row["business name"] || "";
          if (!name) continue;
          drafts.push({
            cityId,
            draftType: "BUSINESS",
            source: "CSV_UPLOAD",
            extractedData: {
              name,
              slug: slugify(name),
              description: row.description || row.desc || "",
              address: row.address || row.street || "",
              city: row.city || "Charlotte",
              state: row.state || "NC",
              zip: row.zip || row.zipcode || row["zip code"] || "",
              phone: row.phone || row.telephone || "",
              websiteUrl: row.website || row.url || row.websiteurl || "",
              email: row.email || "",
              zoneId: zoneId || "",
              categoryIds: categoryId ? [categoryId] : [],
            },
            rawData: { rowNumber: i, originalHeaders: headers },
          });
        } else if (type === "EVENT") {
          const title = row.title || row.name || row["event name"] || "";
          if (!title) continue;
          drafts.push({
            cityId,
            draftType: "EVENT",
            source: "CSV_UPLOAD",
            extractedData: {
              title,
              slug: slugify(title),
              description: row.description || row.desc || "",
              startDateTime: row.start_date || row.date || row.start || "",
              endDateTime: row.end_date || row.end || "",
              locationName: row.location || row.venue || "",
              address: row.address || "",
              city: row.city || "Charlotte",
              state: row.state || "NC",
              zip: row.zip || "",
              costText: row.cost || row.price || row.admission || "Free",
              zoneId: zoneId || "",
              categoryIds: categoryId ? [categoryId] : [],
            },
            rawData: { rowNumber: i },
          });
        }
      }

      if (drafts.length === 0) return res.status(400).json({ error: "No valid rows found in CSV" });

      const created = await storage.createImportDraftsBatch(drafts);

      if (created.length > 0) {
        createInboxItemIfNotOpen({
          itemType: "listing_imported_needs_publish",
          relatedTable: "import_drafts",
          relatedId: cityId,
          title: `CSV Upload: ${created.length} ${type.toLowerCase()} drafts imported`,
          summary: `${created.length} of ${lines.length - 1} rows imported from CSV. Review and publish.`,
          tags: ["Content", "CSV", type],
          links: [{ label: "Review in Inbox", urlOrRoute: "/admin/inbox" }],
        }).catch(err => console.error("[Inbox] CSV batch:", err.message));
      }

      res.json({ imported: created.length, totalRows: lines.length - 1, skipped: lines.length - 1 - created.length });
    } catch (err) {
      console.error("[INTAKE] CSV upload error:", err);
      res.status(500).json({ error: "CSV upload failed" });
    }
  });
}

// ── CSV Parser Helper ──
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { result.push(current.trim()); current = ""; }
      else { current += ch; }
    }
  }
  result.push(current.trim());
  return result;
}

// ── Feed Checker Helper ──
async function checkFeed(feed: any): Promise<any[]> {
  try {
    const resp = await fetch(feed.url, {
      headers: { "User-Agent": "CityMetroHub/1.0 Feed Reader" },
      signal: AbortSignal.timeout(15000),
    });
    const text = await resp.text();

    if (feed.feedType === "ICAL") {
      return parseICalFeed(feed, text);
    } else {
      return parseRSSFeed(feed, text);
    }
  } catch (err) {
    console.error(`[INTAKE] Feed check failed for ${feed.name}:`, err);
    return [];
  }
}

async function parseRSSFeed(feed: any, xml: string): Promise<any[]> {
  const items: any[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const getTag = (tag: string) => {
      const m = itemXml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
      return (m?.[1] || m?.[2] || "").trim();
    };

    const title = getTag("title");
    const description = getTag("description");
    const link = getTag("link");
    const pubDate = getTag("pubDate");

    if (!title) continue;

    const hash = Buffer.from(title + link).toString("base64").slice(0, 32);
    if (hash === feed.lastItemHash) break;

    items.push({ title, description, link, pubDate, hash });
  }

  if (items.length === 0) return [];

  const drafts: any[] = [];
  for (const item of items.slice(0, 20)) {
    const draft = await storage.createImportDraft({
      cityId: feed.cityId,
      draftType: "ARTICLE",
      source: "RSS_FEED",
      feedId: feed.id,
      sourceUrl: item.link,
      extractedData: {
        title: item.title,
        slug: slugify(item.title),
        excerpt: item.description.replace(/<[^>]+>/g, "").slice(0, 300),
        content: item.description.replace(/<[^>]+>/g, ""),
        sourceUrl: item.link,
        sourceName: feed.name,
        publishedDate: item.pubDate,
      },
    });
    drafts.push(draft);
  }

  if (drafts.length > 0) {
    createInboxItemIfNotOpen({
      itemType: "listing_imported_needs_publish",
      relatedTable: "import_drafts",
      relatedId: feed.id,
      title: `RSS Feed: ${drafts.length} articles from ${feed.name}`,
      summary: `${drafts.length} articles imported from RSS feed "${feed.name}". Review and publish.`,
      tags: ["Content", "RSS"],
      links: [{ label: "Review in Inbox", urlOrRoute: "/admin/inbox" }],
    }).catch(err => console.error("[Inbox] RSS feed:", err.message));
  }

  if (items.length > 0) {
    await storage.updateContentFeed(feed.id, {
      lastCheckedAt: new Date(),
      lastItemHash: items[0].hash,
    } as any);
  }

  return drafts;
}

async function parseICalFeed(feed: any, icalText: string): Promise<any[]> {
  const events: any[] = [];
  const eventBlocks = icalText.split("BEGIN:VEVENT");

  for (let i = 1; i < eventBlocks.length; i++) {
    const block = eventBlocks[i].split("END:VEVENT")[0];
    const getProp = (prop: string) => {
      const m = block.match(new RegExp(`${prop}[^:]*:(.*)`, "i"));
      return m?.[1]?.trim() || "";
    };

    const summary = getProp("SUMMARY");
    const description = getProp("DESCRIPTION").replace(/\\n/g, "\n").replace(/\\,/g, ",");
    const dtstart = getProp("DTSTART");
    const dtend = getProp("DTEND");
    const location = getProp("LOCATION").replace(/\\,/g, ",");
    const uid = getProp("UID");

    if (!summary) continue;

    const hash = Buffer.from(uid || summary + dtstart).toString("base64").slice(0, 32);
    if (hash === feed.lastItemHash) break;

    let startDate: string;
    try {
      if (dtstart.length === 8) {
        startDate = new Date(`${dtstart.slice(0, 4)}-${dtstart.slice(4, 6)}-${dtstart.slice(6, 8)}`).toISOString();
      } else {
        startDate = new Date(dtstart.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, "$1-$2-$3T$4:$5:$6")).toISOString();
      }
    } catch {
      startDate = new Date().toISOString();
    }

    let endDate = "";
    if (dtend) {
      try {
        if (dtend.length === 8) {
          endDate = new Date(`${dtend.slice(0, 4)}-${dtend.slice(4, 6)}-${dtend.slice(6, 8)}`).toISOString();
        } else {
          endDate = new Date(dtend.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, "$1-$2-$3T$4:$5:$6")).toISOString();
        }
      } catch { endDate = ""; }
    }

    events.push({ summary, description, startDate, endDate, location, hash });
  }

  if (events.length === 0) return [];

  const drafts: any[] = [];
  for (const evt of events.slice(0, 20)) {
    const draft = await storage.createImportDraft({
      cityId: feed.cityId,
      draftType: "EVENT",
      source: "ICAL_FEED",
      feedId: feed.id,
      extractedData: {
        title: evt.summary,
        slug: slugify(evt.summary),
        description: evt.description,
        startDateTime: evt.startDate,
        endDateTime: evt.endDate,
        locationName: evt.location,
        address: evt.location,
        city: "",
        state: "",
        zip: "",
        costText: "",
      },
      rawData: { uid: evt.hash },
    });
    drafts.push(draft);
  }

  if (drafts.length > 0) {
    createInboxItemIfNotOpen({
      itemType: "listing_imported_needs_publish",
      relatedTable: "import_drafts",
      relatedId: feed.id,
      title: `iCal Feed: ${drafts.length} events from ${feed.name}`,
      summary: `${drafts.length} events imported from iCal feed "${feed.name}". Review and publish.`,
      tags: ["Content", "iCal", "Events"],
      links: [{ label: "Review in Inbox", urlOrRoute: "/admin/inbox" }],
    }).catch(err => console.error("[Inbox] iCal feed:", err.message));
  }

  if (events.length > 0) {
    await storage.updateContentFeed(feed.id, {
      lastCheckedAt: new Date(),
      lastItemHash: events[0].hash,
    } as any);
  }

  return drafts;
}
