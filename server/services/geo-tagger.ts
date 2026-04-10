import { db } from "../db";
import { eq, and, sql, ilike } from "drizzle-orm";
import { zones, businesses } from "@shared/schema";
import { aiExtractZoneSlug } from "../lib/ai-content";

interface GeoSignals {
  title?: string | null;
  description?: string | null;
  address?: string | null;
  zip?: string | null;
  city?: string | null;
  venue?: string | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
  businessId?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  categoriesJson?: string[] | null;
  categoryIds?: string[] | null;
  primaryCategoryId?: string | null;
  category?: string | null;
}

type ContentType = "business" | "event" | "article" | "rss_item" | "marketplace_listing" | "post" | "shop_item" | "job";

interface GeoResult {
  zoneId: string | null;
  zoneSlug: string | null;
  zoneName: string | null;
  method: string;
}

const SOURCE_NAME_ZONE_MAP: Record<string, string> = {
  "cornelius today": "cornelius",
  "mooresvilletribune.com - rss results of type article": "downtown-mooresville",
  "statesville.com - rss results of type article": "downtown-statesville",
  "independenttribune.com - rss results of type article": "downtown-concord",
  "salisbury post": "downtown-salisbury",
  "the taylorsville times": "downtown-taylorsville",
  "hickoryrecord.com - rss results of type article": "downtown-hickory",
  "mcdowellnews.com - rss results of type article": "downtown-marion",
  "york county regional chamber of commerce – sc": "fort-mill",
  "www.newstopicnews.com - rss results of type article": "downtown-lenoir",
  "anson record": "anson-county",
};

const LANDMARK_ZONE_MAP: Record<string, string> = {
  "spectrum center": "uptown",
  "bank of america stadium": "uptown",
  "truist field": "uptown",
  "blumenthal performing arts": "uptown",
  "blumenthal arts": "uptown",
  "levine center for the arts": "uptown",
  "discovery place": "uptown",
  "epicentre": "uptown",
  "romare bearden park": "uptown",
  "first ward park": "uptown",
  "pnc music pavilion": "university-city",
  "uncc": "university-city",
  "unc charlotte": "university-city",
  "charlotte motor speedway": "concord",
  "carowinds": "steele-creek",
  "southpark mall": "southpark",
  "northlake mall": "northlake",
  "concord mills": "concord",
  "camp north end": "camp-north-end",
  "noda": "noda",
  "north davidson": "noda",
  "south end": "south-end",
  "plaza midwood": "plaza-midwood",
  "freedom park": "dilworth",
  "charlotte douglas": "airport",
  "clt airport": "airport",
  "charlotte douglas international": "airport",
  "renaissance park": "renaissance-park",
  "latta park": "dilworth",
  "independence park": "elizabeth",
  "mint museum": "eastover",
  "ballantyne golf": "ballantyne",
  "ballantyne country club": "ballantyne",
  "bojangles coliseum": "eastway",
  "ovens auditorium": "eastway",
  "memorial stadium": "elizabeth",
  "charlotte convention center": "uptown",
  "the whitewater center": "river-district",
  "whitewater center": "river-district",
  "u.s. national whitewater center": "river-district",
};

let zoneCache: { slug: string; name: string; id: string; cityId: string }[] | null = null;
let zoneCacheExpiry = 0;

async function getZoneCache(): Promise<{ slug: string; name: string; id: string; cityId: string }[]> {
  if (zoneCache && Date.now() < zoneCacheExpiry) return zoneCache;
  const rows = await db
    .select({ id: zones.id, slug: zones.slug, name: zones.name, cityId: zones.cityId })
    .from(zones)
    .where(eq(zones.isActive, true));
  zoneCache = rows;
  zoneCacheExpiry = Date.now() + 3600000;
  return rows;
}

export function clearZoneCache(): void {
  zoneCache = null;
  zoneCacheExpiry = 0;
}

async function resolveZoneByZip(zip: string | null, cityId: string): Promise<GeoResult | null> {
  if (!zip) return null;
  const cleaned = zip.trim().replace(/-.*$/, "");
  if (!cleaned) return null;
  const results = await db
    .select({ id: zones.id, slug: zones.slug, name: zones.name })
    .from(zones)
    .where(
      and(
        eq(zones.cityId, cityId),
        sql`${zones.slug} = ${"zip-" + cleaned} OR ${zones.name} = ${cleaned}`
      )
    )
    .limit(1);
  if (results.length > 0) {
    return { zoneId: results[0].id, zoneSlug: results[0].slug, zoneName: results[0].name, method: "zip" };
  }
  return null;
}

async function resolveZoneByTextScan(text: string, cityId: string): Promise<GeoResult | null> {
  if (!text || text.length < 3) return null;
  const lower = text.toLowerCase();
  const allZones = await getZoneCache();
  const cityZones = allZones
    .filter(z => z.cityId === cityId)
    .sort((a, b) => b.name.length - a.name.length);

  for (const zone of cityZones) {
    const nameLower = zone.name.toLowerCase();
    if (nameLower.length < 3) continue;
    if (nameLower === "city-wide" || zone.slug.startsWith("zip-") || zone.slug.startsWith("nashville-")) continue;
    const idx = lower.indexOf(nameLower);
    if (idx >= 0) {
      const before = idx > 0 ? lower[idx - 1] : " ";
      const after = idx + nameLower.length < lower.length ? lower[idx + nameLower.length] : " ";
      if (/\W/.test(before) && /\W/.test(after)) {
        return { zoneId: zone.id, zoneSlug: zone.slug, zoneName: zone.name, method: "text-scan" };
      }
    }
  }
  return null;
}

function resolveZoneBySourceName(sourceName: string | null, cityId: string, allZones: { slug: string; name: string; id: string; cityId: string }[]): GeoResult | null {
  if (!sourceName) return null;
  const lower = sourceName.toLowerCase().trim();
  const mappedSlug = SOURCE_NAME_ZONE_MAP[lower];
  if (mappedSlug) {
    const zone = allZones.find(z => z.slug === mappedSlug && z.cityId === cityId);
    if (zone) {
      return { zoneId: zone.id, zoneSlug: zone.slug, zoneName: zone.name, method: "source-name" };
    }
  }
  return null;
}

function resolveZoneByUrl(url: string | null, cityId: string, allZones: { slug: string; name: string; id: string; cityId: string }[]): GeoResult | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.toLowerCase().split("/").filter(Boolean);
    const cityZones = allZones.filter(z => z.cityId === cityId && !z.slug.startsWith("zip-") && !z.slug.startsWith("nashville-") && z.slug !== "city-wide");

    for (const part of pathParts) {
      const cleaned = part.replace(/[^a-z0-9-]/g, "");
      const zone = cityZones.find(z => z.slug === cleaned);
      if (zone) {
        return { zoneId: zone.id, zoneSlug: zone.slug, zoneName: zone.name, method: "url-path" };
      }
    }
  } catch {
  }
  return null;
}

function resolveZoneByLandmark(text: string, cityId: string, allZones: { slug: string; name: string; id: string; cityId: string }[]): GeoResult | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const [landmark, slug] of Object.entries(LANDMARK_ZONE_MAP)) {
    if (lower.includes(landmark)) {
      const zone = allZones.find(z => z.slug === slug && z.cityId === cityId);
      if (zone) {
        return { zoneId: zone.id, zoneSlug: zone.slug, zoneName: zone.name, method: "landmark" };
      }
    }
  }
  return null;
}

async function resolveZoneByBusinessInheritance(businessId: string | null): Promise<GeoResult | null> {
  if (!businessId) return null;
  try {
    const [biz] = await db
      .select({ zoneId: businesses.zoneId })
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);
    if (!biz?.zoneId) return null;
    const [zone] = await db
      .select({ id: zones.id, slug: zones.slug, name: zones.name })
      .from(zones)
      .where(eq(zones.id, biz.zoneId))
      .limit(1);
    if (!zone) return null;
    return { zoneId: zone.id, zoneSlug: zone.slug, zoneName: zone.name, method: "business-inherit" };
  } catch {
    return null;
  }
}

async function resolveZoneByBusinessEntityMatch(text: string, cityId: string): Promise<GeoResult | null> {
  if (!text || text.length < 5) return null;
  const words = text.split(/\s+/).filter(w => w.length > 3);
  if (words.length < 2) return null;

  const searchTerms = words.slice(0, 6);
  for (let len = Math.min(4, searchTerms.length); len >= 2; len--) {
    for (let start = 0; start <= searchTerms.length - len; start++) {
      const phrase = searchTerms.slice(start, start + len).join(" ");
      try {
        const matches = await db
          .select({ zoneId: businesses.zoneId })
          .from(businesses)
          .where(and(eq(businesses.cityId, cityId), ilike(businesses.name, `%${phrase}%`)))
          .limit(1);
        if (matches.length > 0 && matches[0].zoneId) {
          const [zone] = await db
            .select({ id: zones.id, slug: zones.slug, name: zones.name })
            .from(zones)
            .where(eq(zones.id, matches[0].zoneId))
            .limit(1);
          if (zone) {
            return { zoneId: zone.id, zoneSlug: zone.slug, zoneName: zone.name, method: "business-entity" };
          }
        }
      } catch {
      }
    }
  }
  return null;
}

function extractZipFromText(text: string): string | null {
  if (!text) return null;
  const match = text.match(/\b(28[0-9]{3})\b/);
  return match ? match[1] : null;
}

async function resolveZoneByAddress(address: string | null, cityId: string): Promise<GeoResult | null> {
  if (!address) return null;
  const zip = extractZipFromText(address);
  if (zip) {
    const result = await resolveZoneByZip(zip, cityId);
    if (result) {
      result.method = "address-zip";
      return result;
    }
  }
  return resolveZoneByTextScan(address, cityId);
}

export async function resolveContentZone(cityId: string, signals: GeoSignals): Promise<GeoResult> {
  const allZones = await getZoneCache();
  const fallback: GeoResult = { zoneId: null, zoneSlug: null, zoneName: null, method: "none" };

  const addressResult = await resolveZoneByAddress(signals.address, cityId);
  if (addressResult) return addressResult;

  const zipResult = await resolveZoneByZip(signals.zip || null, cityId);
  if (zipResult) return zipResult;

  const combinedText = [signals.title, signals.description, signals.venue].filter(Boolean).join(" ");

  const textResult = await resolveZoneByTextScan(combinedText, cityId);
  if (textResult) return textResult;

  const sourceResult = resolveZoneBySourceName(signals.sourceName || null, cityId, allZones);
  if (sourceResult) return sourceResult;

  const urlResult = resolveZoneByUrl(signals.sourceUrl || null, cityId, allZones);
  if (urlResult) return urlResult;

  const landmarkResult = resolveZoneByLandmark(combinedText, cityId, allZones);
  if (landmarkResult) return landmarkResult;

  const inheritResult = await resolveZoneByBusinessInheritance(signals.businessId || null);
  if (inheritResult) return inheritResult;

  const entityResult = await resolveZoneByBusinessEntityMatch(combinedText, cityId);
  if (entityResult) return entityResult;

  const contentZip = extractZipFromText(combinedText);
  if (contentZip) {
    const contentZipResult = await resolveZoneByZip(contentZip, cityId);
    if (contentZipResult) {
      contentZipResult.method = "content-zip";
      return contentZipResult;
    }
  }

  return fallback;
}

export async function geoTagAndClassify(
  contentType: ContentType,
  contentId: string,
  cityId: string,
  signals: GeoSignals,
  options?: { skipAi?: boolean; existingZoneId?: string; existingZoneSlug?: string }
): Promise<{ zoneId: string | null; zoneSlug: string | null; zoneName: string | null; method: string; tagsCreated: number }> {
  let zoneId = options?.existingZoneId || null;
  let zoneSlug = options?.existingZoneSlug || null;
  let zoneName: string | null = null;
  let method = "existing";

  if (!zoneId && !zoneSlug) {
    const resolved = await resolveContentZone(cityId, signals);
    zoneId = resolved.zoneId;
    zoneSlug = resolved.zoneSlug;
    zoneName = resolved.zoneName;
    method = resolved.method;

    if (!zoneId && !zoneSlug && !options?.skipAi) {
      try {
        const textForAi = [signals.title, signals.description].filter(Boolean).join(". ");
        const aiSlug = await aiExtractZoneSlug(
          signals.title || "",
          textForAi || null
        );
        if (aiSlug) {
          const allZones = await getZoneCache();
          const matched = allZones.find(z => z.slug === aiSlug && z.cityId === cityId);
          if (matched) {
            zoneId = matched.id;
            zoneSlug = matched.slug;
            zoneName = matched.name;
            method = "ai";
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[GeoTagger] AI extraction failed for ${contentType}/${contentId}:`, msg);
      }
    }
  } else if (zoneId && !zoneName) {
    try {
      const [zone] = await db
        .select({ name: zones.name, slug: zones.slug })
        .from(zones)
        .where(eq(zones.id, zoneId))
        .limit(1);
      if (zone) {
        zoneName = zone.name;
        if (!zoneSlug) zoneSlug = zone.slug;
      }
    } catch {
    }
  } else if (zoneSlug && !zoneId) {
    try {
      const [zone] = await db
        .select({ id: zones.id, name: zones.name })
        .from(zones)
        .where(and(eq(zones.slug, zoneSlug), eq(zones.cityId, cityId)))
        .limit(1);
      if (zone) {
        zoneId = zone.id;
        zoneName = zone.name;
      }
    } catch {
    }
  }

  if (method !== "existing") {
    console.log(`[GeoTagger] ${contentType}/${contentId.substring(0, 8)}: zone=${zoneSlug || "none"} via ${method}`);
  }

  let tagsCreated = 0;
  try {
    const { applyFullTagStack } = await import("./content-tagger");
    tagsCreated = await applyFullTagStack(contentType, contentId, {
      cityId,
      zoneId,
      zoneSlug,
      categoryIds: signals.categoryIds,
      primaryCategoryId: signals.primaryCategoryId,
      category: signals.category,
      categoriesJson: signals.categoriesJson,
      title: signals.title,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[GeoTagger] applyFullTagStack failed for ${contentType}/${contentId}:`, msg);
  }

  return { zoneId, zoneSlug, zoneName, method, tagsCreated };
}
