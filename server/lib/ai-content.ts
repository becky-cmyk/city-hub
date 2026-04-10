import { openai } from "./openai";
import { db } from "../db";
import { zones, rssItems, cmsContentItems, cmsBridgeArticles, articles, cmsAssets, authors, events } from "@shared/schema";
import { and, ne, eq, desc, ilike, or } from "drizzle-orm";
import { RSS_REWRITE_SYSTEM, ZONE_EXTRACTION_SYSTEM, MULTI_ZONE_EXTRACTION_SYSTEM, EVENT_EXTRACTION_SYSTEM, VENUE_EXTRACTION_SYSTEM, EVERGREEN_CLASSIFICATION_SYSTEM, buildLocalArticleSystem } from "../ai/prompts/content-pipeline";
import { storage } from "../storage";
import { applyFullTagStack } from "../services/content-tagger";

export async function aiRewriteSummary(title: string, summary: string | null, sourceName: string): Promise<{ skip: boolean; reason: string; rewritten: string }> {
  try {
    if (!openai) return { skip: false, reason: "OpenAI not configured", rewritten: summary || title };
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: RSS_REWRITE_SYSTEM
        },
        {
          role: "user",
          content: `Title: ${title}\nSummary: ${summary || "(no summary provided)"}\nSource: ${sourceName}`
        }
      ],
      max_tokens: 300,
      temperature: 0.3,
    });
    const raw = response.choices[0]?.message?.content?.trim() || "";
    try {
      const parsed = JSON.parse(raw);
      return {
        skip: !!parsed.skip,
        reason: parsed.reason || "",
        rewritten: parsed.rewritten || summary || title,
      };
    } catch {
      return { skip: false, reason: "", rewritten: raw || summary || title };
    }
  } catch (error: any) {
    console.error("[AI Rewrite] Error:", error.message);
    return { skip: false, reason: "", rewritten: summary || title };
  }
}

interface SupplementarySource {
  title: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
}

const EXCLUDED_SOURCE_PATTERNS = [
  /crime|police|arrest|shooting|murder|assault|robbery|burglar|stabbing|homicide/i,
  /obituar|death|fatal|killed|dies/i,
  /lawsuit|sued|indicted|convicted|sentenc(e|ing)/i,
  /politic(al|s)|partisan|campaign|election|democrat|republican|trump|biden/i,
  /paywall|subscribe to (read|continue|access)/i,
  /sponsored content|advertorial|paid (post|content|promotion)/i,
];

const EXCLUDED_COMPETITOR_DOMAINS = [
  "patch.com",
  "nextdoor.com",
  "yelp.com",
  "tripadvisor.com",
  "google.com/maps",
];

export async function findSupplementarySources(
  title: string,
  summary: string | null,
  currentSourceName: string,
  excludeItemId?: string,
): Promise<SupplementarySource[]> {
  try {
    const keywords = title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(w => w.length > 3 && !["this", "that", "with", "from", "have", "been", "will", "your", "they", "their", "about", "more", "some", "what"].includes(w))
      .slice(0, 5);

    if (keywords.length < 2) return [];

    const searchConditions = keywords.map(kw =>
      or(
        ilike(rssItems.title, `%${kw}%`),
        ilike(rssItems.summary, `%${kw}%`)
      )
    );

    let query = db.select({
      title: rssItems.title,
      summary: rssItems.summary,
      sourceName: rssItems.sourceName,
      url: rssItems.url,
      id: rssItems.id,
    })
    .from(rssItems)
    .where(
      and(
        ne(rssItems.sourceName, currentSourceName),
        or(...searchConditions),
        eq(rssItems.reviewStatus, "APPROVED")
      )
    )
    .orderBy(desc(rssItems.publishedAt))
    .limit(10);

    const rows = await query;

    const filtered = rows
      .filter(r => {
        if (excludeItemId && r.id === excludeItemId) return false;
        const combined = `${r.title} ${r.summary || ""}`;
        if (EXCLUDED_SOURCE_PATTERNS.some(p => p.test(combined))) return false;
        const urlLower = (r.url || "").toLowerCase();
        if (EXCLUDED_COMPETITOR_DOMAINS.some(d => urlLower.includes(d))) return false;
        return true;
      })
      .slice(0, 3);

    return filtered.map(r => ({
      title: r.title,
      summary: r.summary || "",
      sourceName: r.sourceName || "Local Source",
      sourceUrl: r.url,
    }));
  } catch (error: any) {
    console.error("[MultiSource] Error finding supplementary sources:", error.message);
    return [];
  }
}

export interface LocalArticleResult {
  body: string;
  slug: string;
  seoTitle?: string;
  excerpt?: string;
}

export async function aiGenerateLocalArticle(
  title: string,
  summary: string | null,
  sourceName: string,
  sourceUrl: string,
  zoneName?: string | null,
  supplementarySources?: SupplementarySource[]
): Promise<LocalArticleResult> {
  const fallbackSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 80);
  const fallback = { body: summary || title, slug: fallbackSlug };

  try {
    if (!openai) return fallback;
    const locationCtx = zoneName ? `This story is relevant to the ${zoneName} area of Charlotte.` : "";

    let sourcesContext = "";
    if (supplementarySources && supplementarySources.length > 0) {
      sourcesContext = "\n\nADDITIONAL SOURCES (synthesize these into the article with natural attribution):\n" +
        supplementarySources.map((s, i) =>
          `Source ${i + 2}: ${s.sourceName}\nTitle: ${s.title}\nSummary: ${s.summary}`
        ).join("\n\n");
    }

    const systemPrompt = buildLocalArticleSystem(sourceName, supplementarySources, locationCtx || undefined);

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `Original title: ${title}\nOriginal summary: ${summary || "(no summary)"}\nSource: ${sourceName}\nSource URL: ${sourceUrl}${sourcesContext}`
        }
      ],
      max_tokens: 3000,
      temperature: 0.6,
    });
    const raw = response.choices[0]?.message?.content?.trim() || "";
    try {
      const parsed = JSON.parse(raw);
      const slug = (parsed.slug || fallbackSlug).replace(/[^a-z0-9-]/g, "").substring(0, 80);
      let articleBody = parsed.body || summary || title;
      if (sourceUrl && !articleBody.includes(sourceUrl)) {
        articleBody = articleBody.trimEnd() + `\n\n[Original source: ${sourceName}](${sourceUrl})`;
      }
      return {
        body: articleBody,
        slug: slug || fallbackSlug,
        seoTitle: parsed.seoTitle || undefined,
        excerpt: parsed.excerpt || undefined,
      };
    } catch {
      return fallback;
    }
  } catch (error: any) {
    console.error("[AI Article Gen] Error:", error.message);
    return fallback;
  }
}

let cachedZonesWithCounty: { name: string; slug: string; county: string | null }[] | null = null;

async function getKnownZonesWithCounty(): Promise<{ name: string; slug: string; county: string | null }[]> {
  if (cachedZonesWithCounty) return cachedZonesWithCounty;
  try {
    const rows = await db
      .select({ name: zones.name, slug: zones.slug, county: zones.county })
      .from(zones)
      .orderBy(zones.name);
    cachedZonesWithCounty = rows;
    setTimeout(() => { cachedZonesWithCounty = null; }, 3600000);
    return rows;
  } catch {
    return [];
  }
}

export async function aiExtractZoneSlug(title: string, summary: string | null): Promise<string | null> {
  const result = await aiExtractZoneSlugs(title, summary, null);
  return result.zoneSlugs[0] || null;
}

export interface MultiZoneResult {
  zoneSlugs: string[];
  countySlug: string | null;
  zoneCountyMap: Record<string, string>;
}

export async function aiExtractZoneSlugs(
  title: string,
  summary: string | null,
  articleBody: string | null
): Promise<MultiZoneResult> {
  const empty: MultiZoneResult = { zoneSlugs: [], countySlug: null, zoneCountyMap: {} };
  try {
    if (!openai) return empty;
    const knownZones = await getKnownZonesWithCounty();
    if (knownZones.length === 0) return empty;

    const zoneList = knownZones.map(z => `${z.name} (${z.slug})`).join(", ");
    const validSlugs = new Set(knownZones.map(z => z.slug));

    let contentBlock = `Title: ${title}\nSummary: ${summary || "(no summary)"}`;
    if (articleBody) {
      const bodyForPrompt = articleBody.length > 4000 ? articleBody.substring(0, 4000) : articleBody;
      contentBlock += `\n\nArticle body:\n${bodyForPrompt}`;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: MULTI_ZONE_EXTRACTION_SYSTEM },
        { role: "user", content: `Known zones: ${zoneList}\n\n${contentBlock}` }
      ],
      max_tokens: 150,
      temperature: 0,
    });

    const raw = response.choices[0]?.message?.content?.trim() || "";
    let parsedSlugs: string[] = [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.zones)) {
        parsedSlugs = parsed.zones
          .map((s: unknown) => typeof s === "string" ? s.trim().toLowerCase() : "")
          .filter((s: string) => s && s !== "none" && validSlugs.has(s));
      }
    } catch {
      const singleResult = raw.toLowerCase().replace(/[^a-z0-9-]/g, "").trim();
      if (singleResult && singleResult !== "none" && validSlugs.has(singleResult)) {
        parsedSlugs = [singleResult];
      }
    }

    const uniqueSlugs = [...new Set(parsedSlugs)].slice(0, 4);

    const zoneCountyMap: Record<string, string> = {};
    const countyBySlug = new Map(knownZones.filter(z => z.county).map(z => [z.slug, z.county as string]));
    for (const slug of uniqueSlugs) {
      const county = countyBySlug.get(slug);
      if (county) {
        zoneCountyMap[slug] = county;
      }
    }

    const primaryCounty = uniqueSlugs.length > 0 ? (zoneCountyMap[uniqueSlugs[0]] || null) : null;
    const countySlug = primaryCounty
      ? primaryCounty.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-county"
      : null;

    if (uniqueSlugs.length > 0) {
      console.log(`[AI MultiZone] Extracted ${uniqueSlugs.length} zones: ${uniqueSlugs.join(", ")}${countySlug ? ` (county: ${countySlug})` : ""}`);
    }

    return { zoneSlugs: uniqueSlugs, countySlug, zoneCountyMap };
  } catch (error: unknown) {
    console.error("[AI MultiZone] Error:", error instanceof Error ? error.message : error);
    return empty;
  }
}

export interface CreateCmsFromRssOptions {
  rssItemId: string;
  cityId: string;
  title: string;
  slug: string;
  body: string;
  excerpt?: string | null;
  seoTitle?: string | null;
  imageUrl?: string | null;
  sourceName: string;
  sourceUrl: string;
  zoneSlug?: string | null;
  rewrittenSummary?: string | null;
  categories?: string[] | null;
}

let cachedAuthorId: string | null = null;

async function ensureCltMetroHubAuthor(cityId: string): Promise<string | null> {
  if (cachedAuthorId) return cachedAuthorId;
  try {
    const [existing] = await db.select({ id: authors.id }).from(authors).where(eq(authors.slug, "clt-metro-hub")).limit(1);
    if (existing) {
      cachedAuthorId = existing.id;
      return existing.id;
    }
    const [created] = await db.insert(authors).values({
      cityId,
      name: "CLT Metro Hub",
      slug: "clt-metro-hub",
      bio: "AI-powered local news coverage for the Charlotte metro area.",
      roleTitle: "Staff Writer",
      isActive: true,
    }).returning({ id: authors.id });
    cachedAuthorId = created?.id || null;
    return cachedAuthorId;
  } catch {
    return null;
  }
}

async function findOrCreateImageAsset(imageUrl: string, title: string, sourceName: string): Promise<string | null> {
  try {
    const [existing] = await db.select({ id: cmsAssets.id }).from(cmsAssets).where(eq(cmsAssets.fileUrl, imageUrl)).limit(1);
    if (existing) return existing.id;
    const [created] = await db.insert(cmsAssets).values({
      fileUrl: imageUrl,
      fileType: "image",
      mimeType: "image/jpeg",
      altTextEn: title.substring(0, 200),
      creditName: sourceName,
      licenseType: "editorial",
      status: "approved",
    }).returning({ id: cmsAssets.id });
    return created?.id || null;
  } catch {
    return null;
  }
}

export async function createCmsFromRssItem(opts: CreateCmsFromRssOptions): Promise<string | null> {
  try {
    const existingCmsId = await db
      .select({ cmsContentItemId: rssItems.cmsContentItemId })
      .from(rssItems)
      .where(eq(rssItems.id, opts.rssItemId))
      .limit(1);
    if (existingCmsId[0]?.cmsContentItemId) {
      return existingCmsId[0].cmsContentItemId;
    }

    let finalSlug = opts.slug;
    const existingSlug = await storage.getCmsContentItemBySlug("article", opts.slug);
    if (existingSlug) {
      finalSlug = `${opts.slug}-${opts.rssItemId.substring(0, 8)}`;
      const secondCheck = await storage.getCmsContentItemBySlug("article", finalSlug);
      if (secondCheck) {
        await db.update(rssItems).set({
          cmsContentItemId: secondCheck.id,
          updatedAt: new Date(),
        }).where(eq(rssItems.id, opts.rssItemId));
        return secondCheck.id;
      }
    }

    let zoneId: string | null = null;
    if (opts.zoneSlug) {
      const [zoneRow] = await db
        .select({ id: zones.id })
        .from(zones)
        .where(eq(zones.slug, opts.zoneSlug))
        .limit(1);
      zoneId = zoneRow?.id || null;
    }

    const authorId = await ensureCltMetroHubAuthor(opts.cityId);
    let heroImageAssetId: string | null = null;
    if (opts.imageUrl) {
      heroImageAssetId = await findOrCreateImageAsset(opts.imageUrl, opts.title, opts.sourceName);
    }

    const cmsItem = await storage.createCmsContentItem({
      contentType: "article",
      titleEn: opts.seoTitle || opts.title,
      titleEs: null,
      slug: finalSlug,
      excerptEn: opts.excerpt || opts.rewrittenSummary || null,
      excerptEs: null,
      bodyEn: opts.body,
      bodyEs: null,
      status: "published",
      publishAt: null,
      unpublishAt: null,
      publishedAt: new Date(),
      createdByUserId: null,
      assignedEditorUserId: null,
      assignedReviewerUserId: null,
      cityId: opts.cityId,
      zoneId,
      categoryId: null,
      languagePrimary: "en",
      seoTitleEn: opts.seoTitle || opts.title,
      seoTitleEs: null,
      seoDescriptionEn: opts.excerpt || opts.rewrittenSummary || null,
      seoDescriptionEs: null,
      canonicalUrl: opts.sourceUrl,
      heroImageAssetId,
      authorId,
      visibility: "public",
      allowComments: false,
    });

    await db.update(rssItems).set({
      cmsContentItemId: cmsItem.id,
      updatedAt: new Date(),
    }).where(eq(rssItems.id, opts.rssItemId));

    try {
      const existingLegacyArticle = await storage.getArticleBySlug(opts.cityId, finalSlug);
      let legacySlug = finalSlug;
      if (existingLegacyArticle) {
        legacySlug = `${finalSlug}-${opts.rssItemId.substring(0, 8)}`;
      }

      const legacyArticle = await storage.createArticle({
        cityId: opts.cityId,
        title: opts.seoTitle || opts.title,
        slug: legacySlug,
        excerpt: opts.excerpt || opts.rewrittenSummary || null,
        content: opts.body,
        imageUrl: opts.imageUrl || null,
        authorId: "clt-metro-hub",
        publishedAt: new Date(),
        zoneId: zoneId || undefined,
      });

      await storage.createCmsBridgeArticle(cmsItem.id, legacyArticle.id);

      try {
        await applyFullTagStack("article", legacyArticle.id, {
          cityId: opts.cityId,
          zoneId: zoneId || undefined,
          title: opts.title,
          categoriesJson: opts.categories || undefined,
        });
      } catch (tagErr) {
        console.error(`[CMS Bridge] Tag stack failed for article ${legacyArticle.id}:`, tagErr instanceof Error ? tagErr.message : tagErr);
      }
    } catch (bridgeErr: unknown) {
      console.error(`[CMS Bridge] Legacy article/bridge failed for "${finalSlug}":`, bridgeErr instanceof Error ? bridgeErr.message : bridgeErr);
    }

    console.log(`[CMS Bridge] Created CMS article "${finalSlug}" for RSS item ${opts.rssItemId}`);
    return cmsItem.id;
  } catch (error: unknown) {
    console.error(`[CMS Bridge] Failed for RSS item ${opts.rssItemId}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

export interface ExtractedEvent {
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  venueName: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  costText: string | null;
  zoneSlugs: string[];
  recurringRule: string | null;
  confidence: number;
}

export interface EventExtractionResult {
  events: ExtractedEvent[];
}

export async function aiExtractEventsFromArticle(
  title: string,
  summary: string | null,
  articleBody: string | null,
): Promise<EventExtractionResult> {
  const empty: EventExtractionResult = { events: [] };
  try {
    if (!openai) return empty;
    if (!articleBody && !summary) return empty;

    const knownZones = await getKnownZonesWithCounty();
    const zoneList = knownZones.map(z => `${z.name} (${z.slug})`).join(", ");
    const validSlugs = new Set(knownZones.map(z => z.slug));

    let contentBlock = `Title: ${title}\nSummary: ${summary || "(no summary)"}`;
    if (articleBody) {
      const bodyForPrompt = articleBody.length > 4000 ? articleBody.substring(0, 4000) : articleBody;
      contentBlock += `\n\nArticle body:\n${bodyForPrompt}`;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: EVENT_EXTRACTION_SYSTEM },
        { role: "user", content: `Known zones: ${zoneList}\n\n${contentBlock}` },
      ],
      max_tokens: 1500,
      temperature: 0.1,
    });

    const raw = response.choices[0]?.message?.content?.trim() || "";
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.events)) return empty;

      const extracted: ExtractedEvent[] = parsed.events
        .filter((e: Record<string, unknown>) => e && typeof e.name === "string" && e.name.length > 0)
        .slice(0, 5)
        .map((e: Record<string, unknown>) => ({
          name: (e.name as string).trim(),
          description: typeof e.description === "string" ? e.description.trim() : null,
          startDate: typeof e.startDate === "string" ? e.startDate : null,
          endDate: typeof e.endDate === "string" ? e.endDate : null,
          venueName: typeof e.venueName === "string" ? e.venueName.trim() : null,
          address: typeof e.address === "string" ? e.address.trim() : null,
          city: typeof e.city === "string" ? e.city.trim() : "Charlotte",
          state: typeof e.state === "string" ? e.state.trim() : "NC",
          costText: typeof e.costText === "string" ? e.costText.trim() : null,
          zoneSlugs: Array.isArray(e.zoneSlugs)
            ? (e.zoneSlugs as string[]).filter(s => typeof s === "string" && validSlugs.has(s.toLowerCase())).map(s => s.toLowerCase())
            : [],
          recurringRule: typeof e.recurringRule === "string" ? e.recurringRule.trim() : null,
          confidence: typeof e.confidence === "number" ? e.confidence : 0.5,
        }));

      const highConfidence = extracted.filter(e => e.confidence >= 0.6);

      if (highConfidence.length > 0) {
        console.log(`[EventExtract] Found ${highConfidence.length} events in "${title}": ${highConfidence.map(e => e.name).join(", ")}`);
      }

      return { events: highConfidence };
    } catch {
      return empty;
    }
  } catch (error: unknown) {
    console.error("[EventExtract] Error:", error instanceof Error ? error.message : error);
    return empty;
  }
}

function makeEventSlug(name: string, suffix?: string): string {
  let slug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 55);
  if (suffix) slug = `${slug}-${suffix}`;
  return slug || "event";
}

export interface CreateEventsFromArticleOptions {
  rssItemId: string;
  cityId: string;
  title: string;
  summary: string | null;
  articleBody: string | null;
  sourceUrl: string;
  sourceName: string;
  primaryZoneSlug?: string | null;
}

export async function extractAndCreateEventsFromArticle(
  opts: CreateEventsFromArticleOptions,
): Promise<string[]> {
  const createdEventIds: string[] = [];
  try {
    const result = await aiExtractEventsFromArticle(opts.title, opts.summary, opts.articleBody);
    if (result.events.length === 0) return createdEventIds;

    for (const extracted of result.events) {
      try {
        let resolvedZoneId: string | null = null;
        const eventZoneSlug = extracted.zoneSlugs[0] || opts.primaryZoneSlug;

        if (eventZoneSlug) {
          const [zoneRow] = await db
            .select({ id: zones.id })
            .from(zones)
            .where(eq(zones.slug, eventZoneSlug))
            .limit(1);
          resolvedZoneId = zoneRow?.id || null;
        }

        if (!resolvedZoneId) {
          const { cities } = await import("@shared/schema");
          const [cityRow] = await db
            .select({ slug: cities.slug })
            .from(cities)
            .where(eq(cities.id, opts.cityId))
            .limit(1);
          const citySlug = cityRow?.slug || "charlotte";
          const [fallbackZone] = await db
            .select({ id: zones.id })
            .from(zones)
            .where(eq(zones.slug, citySlug))
            .limit(1);
          resolvedZoneId = fallbackZone?.id || null;
          if (!resolvedZoneId) {
            const [anyZone] = await db
              .select({ id: zones.id })
              .from(zones)
              .limit(1);
            resolvedZoneId = anyZone?.id || null;
          }
        }

        if (!resolvedZoneId) {
          console.warn(`[EventExtract] No zone found for event "${extracted.name}", skipping`);
          continue;
        }

        if (!extracted.startDate) {
          console.log(`[EventExtract] Skipping event "${extracted.name}" — no date provided`);
          continue;
        }

        const parsedStart = new Date(extracted.startDate);
        if (isNaN(parsedStart.getTime())) {
          console.log(`[EventExtract] Skipping event "${extracted.name}" — invalid date: ${extracted.startDate}`);
          continue;
        }
        const startDateTime = parsedStart;

        const existingBySource = await db
          .select({ id: events.id })
          .from(events)
          .where(and(
            eq(events.seedSourceType, "rss_article"),
            eq(events.seedSourceExternalId, opts.rssItemId),
            eq(events.title, extracted.name),
          ))
          .limit(1);
        if (existingBySource.length > 0) {
          console.log(`[EventExtract] Event "${extracted.name}" already exists from this article, skipping`);
          createdEventIds.push(existingBySource[0].id);
          continue;
        }

        let endDateTime: Date | undefined;
        if (extracted.endDate) {
          const parsed = new Date(extracted.endDate);
          if (!isNaN(parsed.getTime())) endDateTime = parsed;
        }

        const baseSlug = makeEventSlug(extracted.name);
        let finalSlug = baseSlug;
        const existingSlug = await db
          .select({ id: events.id })
          .from(events)
          .where(and(eq(events.cityId, opts.cityId), eq(events.slug, baseSlug)))
          .limit(1);
        if (existingSlug.length > 0) {
          finalSlug = makeEventSlug(extracted.name, opts.rssItemId.substring(0, 8));
          const secondCheck = await db
            .select({ id: events.id })
            .from(events)
            .where(and(eq(events.cityId, opts.cityId), eq(events.slug, finalSlug)))
            .limit(1);
          if (secondCheck.length > 0) {
            console.log(`[EventExtract] Slug collision for "${extracted.name}", skipping`);
            continue;
          }
        }

        let venuePresenceId: string | undefined;
        if (extracted.venueName) {
          try {
            const { resolveOrCreateVenuePresence } = await import("./venue-discovery");
            const venueResult = await resolveOrCreateVenuePresence(
              extracted.venueName,
              extracted.address,
              extracted.city || "Charlotte",
              extracted.state || "NC",
              opts.cityId,
            );
            if (venueResult) {
              venuePresenceId = venueResult.businessId;
              if (venueResult.created) {
                console.log(`[EventExtract] Created venue presence "${venueResult.name}" for event "${extracted.name}"`);
              }
            }
          } catch (venueErr: unknown) {
            console.warn(`[EventExtract] Venue resolution failed for "${extracted.venueName}":`, venueErr instanceof Error ? venueErr.message : venueErr);
          }
        }

        const evt = await storage.createEvent({
          cityId: opts.cityId,
          zoneId: resolvedZoneId,
          title: extracted.name,
          slug: finalSlug,
          description: extracted.description || `Extracted from: ${opts.title}`,
          startDateTime,
          endDateTime,
          locationName: extracted.venueName || undefined,
          venueName: extracted.venueName || undefined,
          venuePresenceId,
          address: extracted.address || undefined,
          city: extracted.city || "Charlotte",
          state: extracted.state || "NC",
          costText: extracted.costText || undefined,
          sourceUrl: opts.sourceUrl,
          captureSource: "rss_extraction",
          seedSourceType: "rss_article",
          seedSourceExternalId: opts.rssItemId,
          recurringRule: extracted.recurringRule || undefined,
          aiExtractedData: {
            fromArticle: opts.title,
            fromRssItemId: opts.rssItemId,
            sourceName: opts.sourceName,
            confidence: extracted.confidence,
            extractedZoneSlugs: extracted.zoneSlugs,
          },
          aiConfidenceScores: { eventExtraction: extracted.confidence },
          visibility: "public",
          occurrenceStatus: "scheduled",
        });

        createdEventIds.push(evt.id);
        console.log(`[EventExtract] Created event "${extracted.name}" (${evt.id}) from article "${opts.title}"${venuePresenceId ? ` linked to venue ${venuePresenceId}` : ""}`);
      } catch (evtErr: unknown) {
        console.error(`[EventExtract] Failed to create event "${extracted.name}":`, evtErr instanceof Error ? evtErr.message : evtErr);
      }
    }

    if (createdEventIds.length > 0) {
      console.log(`[EventExtract] Created ${createdEventIds.length} events from "${opts.title}"`);
    }

    return createdEventIds;
  } catch (error: unknown) {
    console.error(`[EventExtract] Pipeline error for "${opts.title}":`, error instanceof Error ? error.message : error);
    return createdEventIds;
  }
}

export interface ExtractedVenue {
  name: string;
  address: string | null;
  city: string;
  state: string;
  type: string | null;
  confidence: number;
}

export interface VenueExtractionResult {
  venues: ExtractedVenue[];
}

export async function aiExtractVenuesFromArticle(
  title: string,
  summary: string | null,
  articleBody: string | null,
): Promise<VenueExtractionResult> {
  const empty: VenueExtractionResult = { venues: [] };
  try {
    if (!openai) return empty;
    if (!articleBody && !summary) return empty;

    let contentBlock = `Title: ${title}\nSummary: ${summary || "(no summary)"}`;
    if (articleBody) {
      const bodyForPrompt = articleBody.length > 4000 ? articleBody.substring(0, 4000) : articleBody;
      contentBlock += `\n\nArticle body:\n${bodyForPrompt}`;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: VENUE_EXTRACTION_SYSTEM },
        { role: "user", content: contentBlock },
      ],
      max_tokens: 1200,
      temperature: 0.1,
    });

    const raw = response.choices[0]?.message?.content?.trim() || "";
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.venues)) return empty;

      const extracted: ExtractedVenue[] = parsed.venues
        .filter((v: Record<string, unknown>) => v && typeof v.name === "string" && v.name.length > 0)
        .slice(0, 8)
        .map((v: Record<string, unknown>) => ({
          name: (v.name as string).trim(),
          address: typeof v.address === "string" ? v.address.trim() : null,
          city: typeof v.city === "string" ? v.city.trim() : "Charlotte",
          state: typeof v.state === "string" ? v.state.trim() : "NC",
          type: typeof v.type === "string" ? v.type.trim() : null,
          confidence: typeof v.confidence === "number" ? v.confidence : 0.5,
        }));

      const highConfidence = extracted.filter(v => v.confidence >= 0.7);

      if (highConfidence.length > 0) {
        console.log(`[VenueExtract] Found ${highConfidence.length} venues in "${title}": ${highConfidence.map(v => v.name).join(", ")}`);
      }

      return { venues: highConfidence };
    } catch {
      return empty;
    }
  } catch (error: unknown) {
    console.error("[VenueExtract] Error:", error instanceof Error ? error.message : error);
    return empty;
  }
}

export interface EvergreenClassification {
  isEvergreen: boolean;
  confidence: number;
  reason: string;
}

export async function aiClassifyEvergreen(
  title: string,
  summary: string | null,
  articleBody: string | null,
): Promise<EvergreenClassification> {
  const fallback: EvergreenClassification = { isEvergreen: false, confidence: 0, reason: "classification_unavailable" };
  try {
    if (!openai) return fallback;

    let contentBlock = `Title: ${title}\nSummary: ${summary || "(no summary)"}`;
    if (articleBody) {
      const bodySnippet = articleBody.length > 2000 ? articleBody.substring(0, 2000) : articleBody;
      contentBlock += `\n\nArticle body:\n${bodySnippet}`;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: EVERGREEN_CLASSIFICATION_SYSTEM },
        { role: "user", content: contentBlock },
      ],
      max_tokens: 100,
      temperature: 0,
    });

    const raw = response.choices[0]?.message?.content?.trim() || "";
    try {
      const parsed = JSON.parse(raw);
      const result: EvergreenClassification = {
        isEvergreen: !!parsed.isEvergreen,
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
        reason: typeof parsed.reason === "string" ? parsed.reason : "",
      };
      if (result.isEvergreen && result.confidence >= 0.7) {
        console.log(`[EvergreenClassify] "${title}" classified as evergreen (${result.confidence}): ${result.reason}`);
      }
      return result;
    } catch {
      return fallback;
    }
  } catch (error: unknown) {
    console.error("[EvergreenClassify] Error:", error instanceof Error ? error.message : error);
    return fallback;
  }
}
