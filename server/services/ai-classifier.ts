import { openai } from "../lib/openai";
import { db } from "../db";
import { zones, tags, rssItems, regions } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { buildClassifierSystem } from "../ai/prompts/classifier";

export const CORE_SLUGS = [
  "news", "business", "food-dining", "entertainment", "arts-culture", "sports",
  "community", "education", "health-wellness", "real-estate", "government",
  "weather", "technology", "faith", "development", "lifestyle", "nightlife",
  "family", "outdoors", "pets-animals", "shopping-retail", "automotive",
  "seniors", "opinion", "events", "travel", "public-safety", "shopping",
];

const CONTENT_TYPES = ["story", "event", "job", "business-update", "community-update", "listing", "deal", "announcement"];
const POLICY_STATUSES = ["ALLOW", "SUPPRESS", "REVIEW_NEEDED"];

let zoneCache: { slug: string; name: string; id: string }[] | null = null;
let zoneCacheExpiry = 0;

async function getZoneSlugs(): Promise<{ slug: string; name: string; id: string }[]> {
  if (zoneCache && Date.now() < zoneCacheExpiry) return zoneCache;
  try {
    const rows = await db
      .select({ slug: zones.slug, name: zones.name, id: zones.id })
      .from(zones)
      .where(eq(zones.isActive, true));
    zoneCache = rows;
    zoneCacheExpiry = Date.now() + 3600000;
    return rows;
  } catch {
    return zoneCache || [];
  }
}

let subSlugCache: Map<string, string[]> | null = null;
let subSlugCacheExpiry = 0;

async function getSubSlugsByCore(): Promise<Map<string, string[]>> {
  if (subSlugCache && Date.now() < subSlugCacheExpiry) return subSlugCache;
  try {
    const allTopic = await db.select().from(tags).where(eq(tags.type, "topic"));
    const parentMap = new Map<string, string>();
    const childrenMap = new Map<string, string[]>();
    for (const t of allTopic) {
      if (!t.parentTagId) {
        parentMap.set(t.id, t.slug);
        if (!childrenMap.has(t.slug)) childrenMap.set(t.slug, []);
      }
    }
    for (const t of allTopic) {
      if (t.parentTagId) {
        const parentSlug = parentMap.get(t.parentTagId);
        if (parentSlug) {
          const arr = childrenMap.get(parentSlug) || [];
          arr.push(t.slug);
          childrenMap.set(parentSlug, arr);
        }
      }
    }
    subSlugCache = childrenMap;
    subSlugCacheExpiry = Date.now() + 3600000;
    return childrenMap;
  } catch {
    return subSlugCache || new Map();
  }
}

interface HubCountyMapping {
  zoneSlug: string;
  hubSlug: string | null;
  hubName: string | null;
  countySlug: string | null;
  countyName: string | null;
}

let hubCountyCache: Map<string, HubCountyMapping> | null = null;
let hubCountyCacheExpiry = 0;

async function getHubCountyMap(): Promise<Map<string, HubCountyMapping>> {
  if (hubCountyCache && Date.now() < hubCountyCacheExpiry) return hubCountyCache;
  try {
    const allZones = await db
      .select({ id: zones.id, slug: zones.slug, name: zones.name })
      .from(zones)
      .where(eq(zones.isActive, true));

    const allRegions = await db
      .select({
        id: regions.id,
        name: regions.name,
        code: regions.code,
        regionType: regions.regionType,
        parentRegionId: regions.parentRegionId,
      })
      .from(regions)
      .where(eq(regions.isActive, true));

    const hubs = allRegions.filter(r => r.regionType === "hub");
    const counties = allRegions.filter(r => r.regionType === "county");
    const countyById = new Map(counties.map(c => [c.id, c]));

    const mapping = new Map<string, HubCountyMapping>();

    for (const zone of allZones) {
      const matchedHub = hubs.find(h => {
        const hubCode = (h.code || "").toLowerCase();
        const zoneSlugLower = zone.slug.toLowerCase();
        const zoneNameLower = zone.name.toLowerCase();
        const hubNameLower = h.name.toLowerCase();
        return hubCode === zoneSlugLower ||
          hubNameLower === zoneNameLower;
      });

      let hubSlug: string | null = null;
      let hubName: string | null = null;
      let countySlug: string | null = null;
      let countyName: string | null = null;

      if (matchedHub) {
        hubSlug = (matchedHub.code || matchedHub.name).toLowerCase().replace(/\s+/g, "-");
        hubName = matchedHub.name;
        if (matchedHub.parentRegionId) {
          const county = countyById.get(matchedHub.parentRegionId);
          if (county) {
            countySlug = (county.code || county.name).toLowerCase().replace(/\s+/g, "-");
            countyName = county.name;
          }
        }
      }

      mapping.set(zone.slug, {
        zoneSlug: zone.slug,
        hubSlug,
        hubName,
        countySlug,
        countyName,
      });
    }

    hubCountyCache = mapping;
    hubCountyCacheExpiry = Date.now() + 3600000;
    return mapping;
  } catch {
    return hubCountyCache || new Map();
  }
}

export interface ClassifierInput {
  title: string;
  summary: string | null;
  body: string | null;
  sourceName: string;
  sourceUrl: string;
  categoriesJson?: string[] | null;
}

export interface ClassifierResult {
  categoryCoreSlug: string;
  categorySubSlug: string | null;
  geoPrimarySlug: string | null;
  geoSecondarySlug: string | null;
  hubSlug: string | null;
  countySlug: string | null;
  venueName: string | null;
  contentType: string;
  policyStatus: string;
  confidence: Record<string, number>;
}

export async function classifyContent(input: ClassifierInput): Promise<ClassifierResult | null> {
  if (!openai) return null;

  try {
    const knownZones = await getZoneSlugs();
    const subsByCore = await getSubSlugsByCore();
    const hubCountyMap = await getHubCountyMap();

    const zoneSlugsStr = knownZones.map(z => z.slug).join(", ");

    const subCatExamples = Array.from(subsByCore.entries())
      .filter(([, subs]) => subs.length > 0)
      .map(([core, subs]) => `${core}: [${subs.join(", ")}]`)
      .join("; ");

    const textForAi = [
      `Title: ${input.title}`,
      input.summary ? `Summary: ${input.summary}` : null,
      input.body ? `Body (first 500 chars): ${input.body.substring(0, 500)}` : null,
      `Source: ${input.sourceName}`,
      input.categoriesJson?.length ? `RSS Categories: ${input.categoriesJson.join(", ")}` : null,
    ].filter(Boolean).join("\n");

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: buildClassifierSystem({ coreSlugs: CORE_SLUGS, subCatExamples, zoneSlugsStr, contentTypes: CONTENT_TYPES })
        },
        { role: "user", content: textForAi }
      ],
      response_format: { type: "json_object" },
      max_tokens: 400,
      temperature: 0.1,
    });

    const raw = response.choices[0]?.message?.content?.trim() || "";
    const parsed = JSON.parse(raw);

    const validCore = CORE_SLUGS.includes(parsed.categoryCoreSlug) ? parsed.categoryCoreSlug : "news";
    const validSubs = subsByCore.get(validCore) || [];
    const validSub = validSubs.includes(parsed.categorySubSlug) ? parsed.categorySubSlug : null;

    const validZoneSlugs = new Set(knownZones.map(z => z.slug));
    const validGeo = validZoneSlugs.has(parsed.geoPrimarySlug) ? parsed.geoPrimarySlug : null;
    const validGeo2 = validZoneSlugs.has(parsed.geoSecondarySlug) && parsed.geoSecondarySlug !== validGeo
      ? parsed.geoSecondarySlug : null;

    const validContentType = CONTENT_TYPES.includes(parsed.contentType) ? parsed.contentType : "story";
    const validPolicy = POLICY_STATUSES.includes(parsed.policyStatus) ? parsed.policyStatus : "ALLOW";

    const venueName = typeof parsed.venueName === "string" && parsed.venueName.length > 0
      ? parsed.venueName : null;

    let hubSlug: string | null = null;
    let countySlug: string | null = null;
    const geoForLookup = validGeo || validGeo2;
    if (geoForLookup) {
      const mapping = hubCountyMap.get(geoForLookup);
      if (mapping) {
        hubSlug = mapping.hubSlug;
        countySlug = mapping.countySlug;
      }
    }

    const confidence: Record<string, number> = {
      category: Math.max(0, Math.min(1, Number(parsed.confidence?.category) || 0.5)),
      geo: Math.max(0, Math.min(1, Number(parsed.confidence?.geo) || 0.5)),
      contentType: Math.max(0, Math.min(1, Number(parsed.confidence?.contentType) || 0.5)),
      policy: Math.max(0, Math.min(1, Number(parsed.confidence?.policy) || 0.5)),
      venue: Math.max(0, Math.min(1, Number(parsed.confidence?.venue) || 0.3)),
    };

    return {
      categoryCoreSlug: validCore,
      categorySubSlug: validSub,
      geoPrimarySlug: validGeo,
      geoSecondarySlug: validGeo2,
      hubSlug,
      countySlug,
      venueName,
      contentType: validContentType,
      policyStatus: validPolicy,
      confidence,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[AI Classifier] Error:", msg);
    return null;
  }
}

const HIGH_CONFIDENCE = 0.7;

export interface WritebackResult {
  aiFields: {
    aiSuggestedCategoryCoreSlug: string;
    aiSuggestedCategorySubSlug: string | null;
    aiSuggestedGeoPrimarySlug: string | null;
    aiSuggestedGeoSecondarySlug: string | null;
    aiSuggestedContentType: string;
    aiSuggestedPolicyStatus: string;
    aiConfidence: Record<string, number>;
    aiClassifiedAt: Date;
  };
  routingUpdates: Record<string, string | null>;
}

export function buildWriteback(
  aiResult: ClassifierResult,
  existing: {
    categoryCoreSlug?: string | null;
    categorySubSlug?: string | null;
    geoPrimarySlug?: string | null;
    geoSecondarySlug?: string | null;
    hubSlug?: string | null;
    countySlug?: string | null;
    venueName?: string | null;
    contentType?: string | null;
    policyStatus?: string | null;
    lastEditedBy?: string | null;
  }
): WritebackResult {
  const aiFields: WritebackResult["aiFields"] = {
    aiSuggestedCategoryCoreSlug: aiResult.categoryCoreSlug,
    aiSuggestedCategorySubSlug: aiResult.categorySubSlug,
    aiSuggestedGeoPrimarySlug: aiResult.geoPrimarySlug,
    aiSuggestedGeoSecondarySlug: aiResult.geoSecondarySlug,
    aiSuggestedContentType: aiResult.contentType,
    aiSuggestedPolicyStatus: aiResult.policyStatus,
    aiConfidence: aiResult.confidence,
    aiClassifiedAt: new Date(),
  };

  const routingUpdates: Record<string, string | null> = {};

  const isManualEdit = !!existing.lastEditedBy;

  if (!isManualEdit) {
    if (!existing.categoryCoreSlug && aiResult.confidence.category >= HIGH_CONFIDENCE) {
      routingUpdates.categoryCoreSlug = aiResult.categoryCoreSlug;
    }
    if (!existing.categorySubSlug && aiResult.categorySubSlug && aiResult.confidence.category >= HIGH_CONFIDENCE) {
      routingUpdates.categorySubSlug = aiResult.categorySubSlug;
    }
    if (!existing.geoPrimarySlug && aiResult.geoPrimarySlug && aiResult.confidence.geo >= HIGH_CONFIDENCE) {
      routingUpdates.geoPrimarySlug = aiResult.geoPrimarySlug;
    }
    if (!existing.geoSecondarySlug && aiResult.geoSecondarySlug && aiResult.confidence.geo >= HIGH_CONFIDENCE) {
      routingUpdates.geoSecondarySlug = aiResult.geoSecondarySlug;
    }
    if (!existing.hubSlug && aiResult.hubSlug && aiResult.confidence.geo >= HIGH_CONFIDENCE) {
      routingUpdates.hubSlug = aiResult.hubSlug;
    }
    if (!existing.countySlug && aiResult.countySlug && aiResult.confidence.geo >= HIGH_CONFIDENCE) {
      routingUpdates.countySlug = aiResult.countySlug;
    }
    if (!existing.venueName && aiResult.venueName && aiResult.confidence.venue >= HIGH_CONFIDENCE) {
      routingUpdates.venueName = aiResult.venueName;
    }
    if ((!existing.contentType || existing.contentType === "story") && aiResult.contentType !== "story" && aiResult.confidence.contentType >= HIGH_CONFIDENCE) {
      routingUpdates.contentType = aiResult.contentType;
    }
    if (aiResult.policyStatus === "SUPPRESS" && aiResult.confidence.policy >= HIGH_CONFIDENCE) {
      routingUpdates.policyStatus = "SUPPRESS";
    }
    if (aiResult.policyStatus === "REVIEW_NEEDED" && aiResult.confidence.policy >= HIGH_CONFIDENCE) {
      routingUpdates.policyStatus = "REVIEW_NEEDED";
    }
  }

  return { aiFields, routingUpdates };
}

export async function classifyAndWriteback(
  itemId: string,
  input: ClassifierInput,
  existingFields: {
    categoryCoreSlug?: string | null;
    categorySubSlug?: string | null;
    geoPrimarySlug?: string | null;
    geoSecondarySlug?: string | null;
    hubSlug?: string | null;
    countySlug?: string | null;
    venueName?: string | null;
    contentType?: string | null;
    policyStatus?: string | null;
    lastEditedBy?: string | null;
  }
): Promise<ClassifierResult | null> {
  const result = await classifyContent(input);
  if (!result) return null;

  const { aiFields, routingUpdates } = buildWriteback(result, existingFields);

  const updatePayload: Record<string, unknown> = { ...aiFields };
  for (const [key, val] of Object.entries(routingUpdates)) {
    if (val !== null && val !== undefined) {
      updatePayload[key] = val;
    }
  }
  updatePayload.updatedAt = new Date();

  try {
    await db.update(rssItems).set(updatePayload).where(eq(rssItems.id, itemId));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[AI Classifier] Writeback failed for ${itemId}:`, msg);
  }

  return result;
}
