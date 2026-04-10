import type { Express, Request, Response } from "express";
import { buildPulseIssueSystem } from "./ai/prompts/platform-services";
import { db, pool } from "./db";
import { storage } from "./storage";
import { eq, and, desc } from "drizzle-orm";
import { pulseIssues, pulsePickupLocations, insertPulseIssueSchema, insertPulsePickupLocationSchema, pulseBusinessEntrySchema, pulsePickupLocationEntrySchema } from "@shared/schema";
import type { PulseBusinessEntry, PulsePickupLocationEntry, PulseIssue, PulsePickupLocation } from "@shared/schema";
import { z } from "zod";

const createIssueSchema = z.object({
  cityId: z.string(),
  hubSlug: z.string(),
  title: z.string().min(1),
  slug: z.string().optional(),
  issueNumber: z.number().optional(),
  intro: z.string().optional(),
  heroImageUrl: z.string().optional(),
  heroCtaText: z.string().optional(),
  heroCtaUrl: z.string().optional(),
  featuredStoryTitle: z.string().optional(),
  featuredStoryImage: z.string().optional(),
  featuredStoryBody: z.string().optional(),
  featuredStoryCtaText: z.string().optional(),
  featuredStoryCtaUrl: z.string().optional(),
  quickHits: z.array(z.string()).optional(),
  featuredBusinesses: z.array(pulseBusinessEntrySchema).optional(),
  advertisers: z.array(pulseBusinessEntrySchema).optional(),
  giveawayEnabled: z.boolean().optional(),
  giveawayTitle: z.string().optional(),
  giveawayText: z.string().optional(),
  giveawayCtaText: z.string().optional(),
  giveawayCtaUrl: z.string().optional(),
  conversionTitle: z.string().optional(),
  conversionText: z.string().optional(),
  conversionCtaText: z.string().optional(),
  conversionCtaUrl: z.string().optional(),
  pickupLocations: z.array(pulsePickupLocationEntrySchema).optional(),
  status: z.enum(["draft", "review", "published", "archived"]).optional(),
});

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function registerPulseRoutes(app: Express, requireAdmin: (req: Request, res: Response, next: Function) => void) {

  app.get("/api/cities/:citySlug/hub/:hubSlug/pulse", async (req: Request, res: Response) => {
    try {
      const city = await storage.getCityBySlug(req.params.citySlug);
      if (!city) return res.status(404).json({ message: "City not found" });

      const result = await storage.getPulseIssuesByHub(city.id, req.params.hubSlug, "published");
      res.json(result);
    } catch (err) {
      console.error("[PULSE] list error:", err);
      res.status(500).json({ message: "Failed to fetch pulse issues" });
    }
  });

  app.get("/api/cities/:citySlug/hub/:hubSlug/pulse/:issueSlug", async (req: Request, res: Response) => {
    try {
      const city = await storage.getCityBySlug(req.params.citySlug);
      if (!city) return res.status(404).json({ message: "City not found" });

      const issue = await storage.getPulseIssueBySlug(city.id, req.params.hubSlug, req.params.issueSlug, "published");
      if (!issue) return res.status(404).json({ message: "Issue not found" });

      const featuredEntries = (issue.featuredBusinesses || []) as PulseBusinessEntry[];
      const advertiserEntries = (issue.advertisers || []) as PulseBusinessEntry[];
      const enrichedFeatured = await enrichBusinessEntries(featuredEntries, city.id);
      const enrichedAdvertisers = await enrichBusinessEntries(advertiserEntries, city.id);

      res.json({
        ...issue,
        featuredBusinesses: enrichedFeatured,
        advertisers: enrichedAdvertisers,
      });
    } catch (err) {
      console.error("[PULSE] get issue error:", err);
      res.status(500).json({ message: "Failed to fetch pulse issue" });
    }
  });

  app.get("/api/cities/:citySlug/hub/:hubSlug/pickup-locations", async (req: Request, res: Response) => {
    try {
      const city = await storage.getCityBySlug(req.params.citySlug);
      if (!city) return res.status(404).json({ message: "City not found" });

      const result = await storage.getPulsePickupLocations(city.id, req.params.hubSlug, true);
      res.json(result);
    } catch (err) {
      console.error("[PULSE] pickup locations error:", err);
      res.status(500).json({ message: "Failed to fetch pickup locations" });
    }
  });

  app.get("/api/admin/pulse-issues", requireAdmin, async (req: Request, res: Response) => {
    try {
      const hubSlug = req.query.hubSlug as string | undefined;
      const cityId = req.query.cityId as string | undefined;

      const result = await storage.getAllPulseIssues(cityId, hubSlug);
      res.json(result);
    } catch (err) {
      console.error("[PULSE] admin list error:", err);
      res.status(500).json({ message: "Failed to fetch pulse issues" });
    }
  });

  app.get("/api/admin/pulse-issues/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const issue = await storage.getPulseIssueById(req.params.id);
      if (!issue) return res.status(404).json({ message: "Issue not found" });
      res.json(issue);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch pulse issue" });
    }
  });

  app.post("/api/admin/pulse-issues", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parseResult = createIssueSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Validation failed", errors: parseResult.error.flatten().fieldErrors });
      }
      const body = parseResult.data;

      const slug = body.slug || slugify(`${body.issueNumber || 1}-${body.title}`);

      const result = await storage.createPulseIssue({
        cityId: body.cityId,
        hubSlug: body.hubSlug,
        slug,
        issueNumber: body.issueNumber || 1,
        title: body.title,
        intro: body.intro || null,
        heroImageUrl: body.heroImageUrl || null,
        heroCtaText: body.heroCtaText || null,
        heroCtaUrl: body.heroCtaUrl || null,
        featuredStoryTitle: body.featuredStoryTitle || null,
        featuredStoryImage: body.featuredStoryImage || null,
        featuredStoryBody: body.featuredStoryBody || null,
        featuredStoryCtaText: body.featuredStoryCtaText || null,
        featuredStoryCtaUrl: body.featuredStoryCtaUrl || null,
        quickHits: body.quickHits || [],
        featuredBusinesses: body.featuredBusinesses || [],
        advertisers: body.advertisers || [],
        giveawayEnabled: body.giveawayEnabled || false,
        giveawayTitle: body.giveawayTitle || null,
        giveawayText: body.giveawayText || null,
        giveawayCtaText: body.giveawayCtaText || null,
        giveawayCtaUrl: body.giveawayCtaUrl || null,
        conversionTitle: body.conversionTitle || null,
        conversionText: body.conversionText || null,
        conversionCtaText: body.conversionCtaText || null,
        conversionCtaUrl: body.conversionCtaUrl || null,
        pickupLocations: body.pickupLocations || [],
        status: body.status || "draft",
      });

      res.json(result);
    } catch (err: unknown) {
      console.error("[PULSE] create error:", err);
      if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505") {
        return res.status(409).json({ message: "An issue with this slug already exists for this hub" });
      }
      res.status(500).json({ message: "Failed to create pulse issue" });
    }
  });

  app.patch("/api/admin/pulse-issues/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const body = req.body;
      const updates: Record<string, unknown> = {};
      const allowedFields = [
        "title", "slug", "issueNumber", "intro", "heroImageUrl", "heroCtaText", "heroCtaUrl",
        "featuredStoryTitle", "featuredStoryImage", "featuredStoryBody", "featuredStoryCtaText", "featuredStoryCtaUrl",
        "quickHits", "featuredBusinesses", "advertisers",
        "giveawayEnabled", "giveawayTitle", "giveawayText", "giveawayCtaText", "giveawayCtaUrl",
        "conversionTitle", "conversionText", "conversionCtaText", "conversionCtaUrl",
        "pickupLocations", "status",
      ];
      for (const f of allowedFields) {
        if (body[f] !== undefined) updates[f] = body[f];
      }

      if (body.status === "published") {
        const existing = await storage.getPulseIssueById(req.params.id);
        if (existing && !existing.publishedAt) {
          updates.publishedAt = new Date();
        }
      }

      const result = await storage.updatePulseIssue(req.params.id, updates);
      if (!result) return res.status(404).json({ message: "Issue not found" });
      res.json(result);
    } catch (err) {
      console.error("[PULSE] update error:", err);
      res.status(500).json({ message: "Failed to update pulse issue" });
    }
  });

  app.post("/api/admin/pulse-issues/:id/duplicate", requireAdmin, async (req: Request, res: Response) => {
    try {
      const original = await storage.getPulseIssueById(req.params.id);
      if (!original) return res.status(404).json({ message: "Issue not found" });

      const newIssueNumber = original.issueNumber + 1;
      const newSlug = slugify(`${newIssueNumber}-${original.title}`);

      const result = await storage.createPulseIssue({
        cityId: original.cityId,
        hubSlug: original.hubSlug,
        slug: newSlug,
        issueNumber: newIssueNumber,
        title: original.title,
        intro: original.intro,
        heroImageUrl: original.heroImageUrl,
        heroCtaText: original.heroCtaText,
        heroCtaUrl: original.heroCtaUrl,
        featuredStoryTitle: null,
        featuredStoryImage: null,
        featuredStoryBody: null,
        featuredStoryCtaText: original.featuredStoryCtaText,
        featuredStoryCtaUrl: original.featuredStoryCtaUrl,
        quickHits: [],
        featuredBusinesses: original.featuredBusinesses,
        advertisers: original.advertisers,
        giveawayEnabled: original.giveawayEnabled,
        giveawayTitle: original.giveawayTitle,
        giveawayText: original.giveawayText,
        giveawayCtaText: original.giveawayCtaText,
        giveawayCtaUrl: original.giveawayCtaUrl,
        conversionTitle: original.conversionTitle,
        conversionText: original.conversionText,
        conversionCtaText: original.conversionCtaText,
        conversionCtaUrl: original.conversionCtaUrl,
        pickupLocations: original.pickupLocations,
        status: "draft",
      });

      res.json(result);
    } catch (err) {
      console.error("[PULSE] duplicate error:", err);
      res.status(500).json({ message: "Failed to duplicate pulse issue" });
    }
  });

  app.delete("/api/admin/pulse-issues/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await storage.deletePulseIssue(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete pulse issue" });
    }
  });

  app.get("/api/admin/pulse-pickup-locations", requireAdmin, async (req: Request, res: Response) => {
    try {
      const hubSlug = req.query.hubSlug as string | undefined;
      const cityId = req.query.cityId as string | undefined;

      const result = await storage.getAllPulsePickupLocations(cityId, hubSlug);
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch pickup locations" });
    }
  });

  app.post("/api/admin/pulse-pickup-locations", requireAdmin, async (req: Request, res: Response) => {
    try {
      const body = req.body;
      if (!body.cityId || !body.hubSlug || !body.name || !body.address) {
        return res.status(400).json({ message: "cityId, hubSlug, name, and address are required" });
      }

      const result = await storage.createPulsePickupLocation({
        cityId: body.cityId,
        hubSlug: body.hubSlug,
        name: body.name,
        address: body.address,
        latitude: body.latitude || null,
        longitude: body.longitude || null,
        isActive: body.isActive !== false,
      });

      res.json(result);
    } catch (err) {
      console.error("[PULSE] create pickup location error:", err);
      res.status(500).json({ message: "Failed to create pickup location" });
    }
  });

  app.patch("/api/admin/pulse-pickup-locations/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const updates: Record<string, unknown> = {};
      const allowedFields = ["name", "address", "latitude", "longitude", "isActive", "hubSlug"];
      for (const f of allowedFields) {
        if (req.body[f] !== undefined) updates[f] = req.body[f];
      }

      const result = await storage.updatePulsePickupLocation(req.params.id, updates);
      if (!result) return res.status(404).json({ message: "Not found" });
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Failed to update pickup location" });
    }
  });

  app.delete("/api/admin/pulse-pickup-locations/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await storage.deletePulsePickupLocation(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete pickup location" });
    }
  });

  app.post("/api/admin/pulse-issues/generate", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { districtName, hubSlug, cityId, issueNumber, storyPrompt, quickHits, featuredBusinessIds, advertiserIds, giveawayInfo, theme } = req.body;

      if (!districtName || !hubSlug || !cityId) {
        return res.status(400).json({ message: "districtName, hubSlug, and cityId are required" });
      }

      const num = issueNumber || 1;
      let businessContext = "";
      if (featuredBusinessIds?.length > 0 || advertiserIds?.length > 0) {
        const allIds = [...(featuredBusinessIds || []), ...(advertiserIds || [])];
        try {
          const bizResult = await pool.query(
            `SELECT id, name, description, tagline, address FROM businesses WHERE id = ANY($1)`,
            [allIds]
          );
          businessContext = bizResult.rows.map((b: Record<string, string | null>) =>
            `- ${b.name}: ${b.tagline || b.description || "Local business"} (${b.address || ""})`
          ).join("\n");
        } catch {}
      }

      const prompt = `${buildPulseIssueSystem(districtName)}

Issue #${num}${theme ? ` — Theme: ${theme}` : ""}

${storyPrompt ? `Story notes/source material: ${storyPrompt}` : "Write an engaging local community story relevant to this district."}

${businessContext ? `Featured businesses in this district:\n${businessContext}` : ""}

${quickHits?.length > 0 ? `Quick hits/trivia to include:\n${quickHits.map((h: string) => `- ${h}`).join("\n")}` : "Include 4-5 fun local trivia quick hits about the area."}

${giveawayInfo ? `Giveaway info: ${giveawayInfo}` : ""}

Generate the following JSON structure (respond ONLY with valid JSON, no markdown):
{
  "title": "Issue title (catchy, local)",
  "intro": "2-3 sentence issue introduction welcoming readers",
  "featuredStoryTitle": "Story headline",
  "featuredStoryBody": "Full featured story (3-4 paragraphs, editorial style, warm and local)",
  "quickHits": ["Quick hit 1", "Quick hit 2", "Quick hit 3", "Quick hit 4"],
  "conversionTitle": "CTA headline for reader/business signup",
  "conversionText": "1-2 sentences encouraging engagement",
  "slug": "clean-url-slug-for-this-issue"
}`;

      let generatedContent: Record<string, unknown> = {};
      try {
        const { openai } = await import("./lib/openai");
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.8,
          max_tokens: 2000,
        });

        const raw = completion.choices[0]?.message?.content || "{}";
        const jsonStr = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
        generatedContent = JSON.parse(jsonStr);
      } catch (aiErr) {
        console.error("[PULSE] AI generation error:", aiErr);
        generatedContent = {
          title: `${districtName} Pulse — Issue #${num}`,
          intro: `Welcome to Issue #${num} of the ${districtName} Pulse! Here's what's happening in your community this month.`,
          featuredStoryTitle: storyPrompt ? `${districtName} Community Update` : `What's New in ${districtName}`,
          featuredStoryBody: storyPrompt || `This month in ${districtName}, the community continues to grow and thrive. Stay connected with your neighbors and local businesses.`,
          quickHits: quickHits?.length > 0 ? quickHits : [`Did you know? ${districtName} is one of Charlotte's most vibrant communities!`],
          conversionTitle: "Get Connected",
          conversionText: `Stay in the loop with ${districtName}. Sign up to get the Pulse delivered to your inbox.`,
          slug: slugify(`${num}-${districtName}-pulse`),
        };
      }

      const featuredBusinesses: PulseBusinessEntry[] = (featuredBusinessIds || []).map((id: string) => ({ businessId: id, type: "linked" as const }));
      const advertisers: PulseBusinessEntry[] = (advertiserIds || []).map((id: string) => ({ businessId: id, type: "linked" as const }));

      const pickupLocs = await storage.getPulsePickupLocations(cityId, hubSlug, true);

      const pickupLocationsData: PulsePickupLocationEntry[] = pickupLocs.map(loc => ({
        name: loc.name,
        address: loc.address,
        latitude: loc.latitude,
        longitude: loc.longitude,
      }));

      const slug = (generatedContent.slug as string) || slugify(`${num}-${districtName}-pulse`);

      const issue = await storage.createPulseIssue({
        cityId,
        hubSlug,
        slug,
        issueNumber: num,
        title: (generatedContent.title as string) || `${districtName} Pulse — Issue #${num}`,
        intro: (generatedContent.intro as string) || null,
        featuredStoryTitle: (generatedContent.featuredStoryTitle as string) || null,
        featuredStoryBody: (generatedContent.featuredStoryBody as string) || null,
        quickHits: (generatedContent.quickHits as string[]) || [],
        featuredBusinesses,
        advertisers,
        giveawayEnabled: !!giveawayInfo,
        giveawayTitle: giveawayInfo ? "Monthly Giveaway" : null,
        giveawayText: giveawayInfo || null,
        conversionTitle: (generatedContent.conversionTitle as string) || "Get Connected",
        conversionText: (generatedContent.conversionText as string) || `Stay connected with ${districtName}.`,
        conversionCtaText: "Sign Up",
        conversionCtaUrl: `/${hubSlug}/activate`,
        pickupLocations: pickupLocationsData,
        status: "draft",
      });

      res.json(issue);
    } catch (err) {
      console.error("[PULSE] generate issue error:", err);
      res.status(500).json({ message: "Failed to generate pulse issue" });
    }
  });
}

interface EnrichedBusinessEntry extends Record<string, unknown> {
  type: string;
  businessId?: string;
  name?: string;
  slug?: string;
  imageUrl?: string;
  tagline?: string;
  description?: string;
  address?: string;
  latitude?: string;
  longitude?: string;
  ctaText?: string;
  ctaUrl?: string;
}

async function enrichBusinessEntries(entries: PulseBusinessEntry[], cityId: string): Promise<EnrichedBusinessEntry[]> {
  if (!entries || entries.length === 0) return [];
  const linkedIds = entries
    .filter((e): e is PulseBusinessEntry & { type: "linked"; businessId: string } => e.type === "linked")
    .map(e => e.businessId);

  if (linkedIds.length === 0) {
    return entries.map(e => ({ ...e } as EnrichedBusinessEntry));
  }

  try {
    const result = await pool.query(
      `SELECT id, name, slug, image_url, tagline, description, address, microsite_logo, latitude, longitude FROM businesses WHERE id = ANY($1)`,
      [linkedIds]
    );
    const bizMap = new Map<string, Record<string, string | null>>(
      result.rows.map((b: Record<string, string | null>) => [b.id as string, b])
    );

    return entries.map((entry): EnrichedBusinessEntry => {
      if (entry.type === "linked") {
        const biz = bizMap.get(entry.businessId);
        if (biz) {
          return {
            type: "linked",
            businessId: entry.businessId,
            name: biz.name || undefined,
            slug: biz.slug || undefined,
            imageUrl: biz.image_url || biz.microsite_logo || undefined,
            tagline: biz.tagline || undefined,
            description: biz.description || undefined,
            address: biz.address || undefined,
            latitude: biz.latitude || undefined,
            longitude: biz.longitude || undefined,
          };
        }
      }
      return { ...entry } as EnrichedBusinessEntry;
    });
  } catch {
    return entries.map(e => ({ ...e } as EnrichedBusinessEntry));
  }
}
