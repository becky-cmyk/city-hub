import { db } from "../db";
import { eq, and, isNull, or, sql } from "drizzle-orm";
import { rssItems, zones, regions } from "@shared/schema";
import { CORE_SLUGS, classifyContent } from "./ai-classifier";
import { matchRssCategoriesToSlugs, matchTitleToSlugs } from "./tag-backfill";
import { resolveContentZone } from "./geo-tagger";
import { evaluateContentRouting, computeIntegrityFlags, deriveQueueStatus } from "./content-routing-evaluator";

export interface NormalizeCategoryResult {
  categoryCoreSlug: string | null;
  categorySubSlug: string | null;
  method: "static_map" | "title_keywords" | "ai_classifier" | "existing" | "unresolved";
  confidence: number;
  needsReview: boolean;
}

export async function normalizeCategory(item: Record<string, unknown>): Promise<NormalizeCategoryResult> {
  if (item.categoryCoreSlug && CORE_SLUGS.includes(item.categoryCoreSlug as string)) {
    return {
      categoryCoreSlug: item.categoryCoreSlug as string,
      categorySubSlug: (item.categorySubSlug as string) || null,
      method: "existing",
      confidence: 1.0,
      needsReview: false,
    };
  }

  const rssCategories = item.categoriesJson as string[] | null;
  const staticMatches = matchRssCategoriesToSlugs(rssCategories);
  if (staticMatches.length > 0) {
    const slug = staticMatches[0];
    if (CORE_SLUGS.includes(slug)) {
      return {
        categoryCoreSlug: slug,
        categorySubSlug: null,
        method: "static_map",
        confidence: 0.85,
        needsReview: false,
      };
    }
  }

  const titleMatches = matchTitleToSlugs(item.title as string);
  if (titleMatches.length > 0) {
    const slug = titleMatches[0];
    if (CORE_SLUGS.includes(slug)) {
      return {
        categoryCoreSlug: slug,
        categorySubSlug: null,
        method: "title_keywords",
        confidence: 0.7,
        needsReview: false,
      };
    }
  }

  try {
    const aiResult = await classifyContent({
      title: (item.title as string) || "",
      summary: (item.rewrittenSummary as string) || (item.summary as string) || null,
      body: (item.localArticleBody as string) || null,
      sourceName: (item.sourceName as string) || "",
      sourceUrl: (item.url as string) || "",
      categoriesJson: rssCategories || null,
    });
    if (aiResult && aiResult.categoryCoreSlug && CORE_SLUGS.includes(aiResult.categoryCoreSlug)) {
      const catConfidence = aiResult.confidence?.category ?? 0.5;
      return {
        categoryCoreSlug: aiResult.categoryCoreSlug,
        categorySubSlug: catConfidence >= 0.7 ? (aiResult.categorySubSlug || null) : null,
        method: "ai_classifier",
        confidence: catConfidence,
        needsReview: catConfidence < 0.7,
      };
    }
  } catch (err: unknown) {
    console.error("[Normalizer] AI classification failed:", err instanceof Error ? err.message : err);
  }

  return {
    categoryCoreSlug: "news",
    categorySubSlug: null,
    method: "unresolved",
    confidence: 0,
    needsReview: true,
  };
}

export interface GeoAssignmentResult {
  geoPrimarySlug: string | null;
  geoSecondarySlug: string | null;
  hubSlug: string | null;
  countySlug: string | null;
  method: string;
  precision: "MICRO_HUB" | "NEIGHBORHOOD" | "DISTRICT" | "METRO" | "NONE";
  needsReview: boolean;
  isLowPrecision: boolean;
}

let metroZoneCache: Map<string, { slug: string; id: string }> | null = null;
let metroZoneCacheExpiry = 0;

async function getMetroZoneForCity(cityId: string): Promise<{ slug: string; id: string } | null> {
  if (metroZoneCache && Date.now() < metroZoneCacheExpiry && metroZoneCache.has(cityId)) {
    return metroZoneCache.get(cityId)!;
  }

  try {
    if (!metroZoneCache) metroZoneCache = new Map();

    const allZones = await db
      .select({ id: zones.id, slug: zones.slug, cityId: zones.cityId, type: zones.type, name: zones.name })
      .from(zones)
      .where(eq(zones.isActive, true))
      .orderBy(zones.name);

    for (const z of allZones) {
      if (z.type === "METRO" && !metroZoneCache.has(z.cityId)) {
        metroZoneCache.set(z.cityId, { slug: z.slug, id: z.id });
      }
    }
    for (const z of allZones) {
      if (z.type === "DISTRICT" && !metroZoneCache.has(z.cityId)) {
        metroZoneCache.set(z.cityId, { slug: z.slug, id: z.id });
      }
    }

    metroZoneCacheExpiry = Date.now() + 3600000;
  } catch {
    return null;
  }
  return metroZoneCache?.get(cityId) || null;
}

let hubCountyMapCache: Map<string, { hubSlug: string | null; countySlug: string | null }> | null = null;
let hubCountyCacheExpiry = 0;

async function getHubCountyForZone(zoneSlug: string): Promise<{ hubSlug: string | null; countySlug: string | null }> {
  if (hubCountyMapCache && Date.now() < hubCountyCacheExpiry && hubCountyMapCache.has(zoneSlug)) {
    return hubCountyMapCache.get(zoneSlug)!;
  }

  try {
    const allRegions = await db
      .select({ id: regions.id, code: regions.code, regionType: regions.regionType, parentRegionId: regions.parentRegionId })
      .from(regions);

    const allZones = await db
      .select({ slug: zones.slug, county: zones.county, type: zones.type })
      .from(zones)
      .where(eq(zones.isActive, true));

    hubCountyMapCache = new Map();

    const hubsByCode = new Map<string, string>();
    const countiesByCode = new Map<string, string>();

    for (const r of allRegions) {
      if (r.regionType === "hub" && r.code) hubsByCode.set(r.code.toLowerCase(), r.code);
      if (r.regionType === "county" && r.code) countiesByCode.set(r.code.toLowerCase(), r.code);
    }

    for (const z of allZones) {
      let hubSlug: string | null = null;
      let countySlug: string | null = null;

      const slugLower = z.slug.toLowerCase();
      if (hubsByCode.has(slugLower)) hubSlug = hubsByCode.get(slugLower)!;

      if (z.county) {
        const countyLower = z.county.toLowerCase();
        for (const [code, val] of countiesByCode) {
          if (countyLower.includes(code) || code.includes(countyLower)) {
            countySlug = val;
            break;
          }
        }
      }

      hubCountyMapCache.set(z.slug, { hubSlug, countySlug });
    }

    hubCountyCacheExpiry = Date.now() + 3600000;
  } catch {
    return { hubSlug: null, countySlug: null };
  }

  return hubCountyMapCache?.get(zoneSlug) || { hubSlug: null, countySlug: null };
}

export async function resolveGeoAssignment(item: Record<string, unknown>, cityId: string): Promise<GeoAssignmentResult> {
  if (item.geoPrimarySlug) {
    const zoneType = await getZoneType(item.geoPrimarySlug as string, cityId);
    const hubCounty = await getHubCountyForZone(item.geoPrimarySlug as string);
    return {
      geoPrimarySlug: item.geoPrimarySlug as string,
      geoSecondarySlug: (item.geoSecondarySlug as string) || null,
      hubSlug: (item.hubSlug as string) || hubCounty.hubSlug,
      countySlug: (item.countySlug as string) || hubCounty.countySlug,
      method: "existing",
      precision: zoneType,
      needsReview: false,
      isLowPrecision: zoneType === "METRO",
    };
  }

  const geoResult = await resolveContentZone(cityId, {
    title: (item.title as string) || undefined,
    description: (item.rewrittenSummary as string) || (item.summary as string) || undefined,
    sourceName: (item.sourceName as string) || undefined,
    sourceUrl: (item.url as string) || undefined,
    venue: (item.venueName as string) || undefined,
    address: (item.venueAddress as string) || undefined,
    categoriesJson: (item.categoriesJson as string[]) || undefined,
  });

  if (geoResult.zoneSlug) {
    const zoneType = await getZoneType(geoResult.zoneSlug, cityId);
    const hubCounty = await getHubCountyForZone(geoResult.zoneSlug);
    return {
      geoPrimarySlug: geoResult.zoneSlug,
      geoSecondarySlug: null,
      hubSlug: hubCounty.hubSlug,
      countySlug: hubCounty.countySlug,
      method: geoResult.method,
      precision: zoneType,
      needsReview: false,
      isLowPrecision: zoneType === "METRO",
    };
  }

  const cityZones = await db
    .select({ slug: zones.slug, name: zones.name, type: zones.type })
    .from(zones)
    .where(eq(zones.cityId, cityId));

  const combinedText = [
    item.title as string,
    item.rewrittenSummary as string || item.summary as string,
    item.localArticleBody as string,
  ].filter(Boolean).join(" ").toLowerCase();

  if (combinedText) {
    for (const z of cityZones) {
      if (z.type === "MICRO_HUB" || z.type === "NEIGHBORHOOD") {
        const nameLower = z.name.toLowerCase();
        if (nameLower.length >= 4 && combinedText.includes(nameLower)) {
          const hubCounty = await getHubCountyForZone(z.slug);
          return {
            geoPrimarySlug: z.slug,
            geoSecondarySlug: null,
            hubSlug: hubCounty.hubSlug,
            countySlug: hubCounty.countySlug,
            method: "text_scan_extended",
            precision: z.type as "MICRO_HUB" | "NEIGHBORHOOD",
            needsReview: false,
            isLowPrecision: false,
          };
        }
      }
    }

    for (const z of cityZones) {
      if (z.type === "DISTRICT") {
        const nameLower = z.name.toLowerCase();
        if (nameLower.length >= 4 && combinedText.includes(nameLower)) {
          const hubCounty = await getHubCountyForZone(z.slug);
          return {
            geoPrimarySlug: z.slug,
            geoSecondarySlug: null,
            hubSlug: hubCounty.hubSlug,
            countySlug: hubCounty.countySlug,
            method: "text_scan_district",
            precision: "DISTRICT",
            needsReview: false,
            isLowPrecision: false,
          };
        }
      }
    }
  }

  const metroFallback = await getMetroZoneForCity(cityId);
  if (metroFallback) {
    return {
      geoPrimarySlug: metroFallback.slug,
      geoSecondarySlug: null,
      hubSlug: null,
      countySlug: null,
      method: "metro_fallback",
      precision: "METRO",
      needsReview: false,
      isLowPrecision: true,
    };
  }

  return {
    geoPrimarySlug: null,
    geoSecondarySlug: null,
    hubSlug: null,
    countySlug: null,
    method: "none",
    precision: "NONE",
    needsReview: true,
    isLowPrecision: false,
  };
}

export async function getZoneType(slug: string, cityId: string): Promise<"MICRO_HUB" | "NEIGHBORHOOD" | "DISTRICT" | "METRO" | "NONE"> {
  try {
    const [zone] = await db.select({ type: zones.type }).from(zones)
      .where(and(eq(zones.slug, slug), eq(zones.cityId, cityId)))
      .limit(1);
    if (zone) return zone.type as "MICRO_HUB" | "NEIGHBORHOOD" | "DISTRICT";
    return "NONE";
  } catch {
    return "NONE";
  }
}

export interface IntegrityPassResult {
  totalScanned: number;
  fixedCategories: number;
  fixedGeo: number;
  flaggedForReview: number;
  lowGeoPrecision: number;
  routingIssues: number;
  errors: number;
}

export async function runContentIntegrityPass(cityId?: string): Promise<IntegrityPassResult> {
  const result: IntegrityPassResult = {
    totalScanned: 0,
    fixedCategories: 0,
    fixedGeo: 0,
    flaggedForReview: 0,
    lowGeoPrecision: 0,
    routingIssues: 0,
    errors: 0,
  };

  console.log(`[IntegrityPass] Starting content integrity scan${cityId ? ` for city ${cityId}` : ""}...`);

  const PAGE_SIZE = 500;

  try {
    const whereClause = cityId ? eq(rssItems.cityId, cityId) : undefined;
    let pageOffset = 0;
    let hasMore = true;

    while (hasMore) {
      const items = await db
        .select()
        .from(rssItems)
        .where(whereClause)
        .limit(PAGE_SIZE)
        .offset(pageOffset);

      if (items.length < PAGE_SIZE) hasMore = false;
      result.totalScanned += items.length;

      if (pageOffset === 0) {
        console.log(`[IntegrityPass] Processing items (page size ${PAGE_SIZE})...`);
      }

      for (const item of items) {
        try {
          const updates: Record<string, unknown> = {};
          const itemRecord = item as Record<string, unknown>;
          let geoIsLowPrecision = false;

          let categoryNeedsReview = false;
          if (!item.categoryCoreSlug) {
            const catResult = await normalizeCategory(itemRecord);
            if (catResult.categoryCoreSlug) {
              updates.categoryCoreSlug = catResult.categoryCoreSlug;
              if (catResult.categorySubSlug) updates.categorySubSlug = catResult.categorySubSlug;
              result.fixedCategories++;
            }
            if (catResult.confidence < 1.0) {
              const existingConf = (item.aiConfidence || {}) as Record<string, number>;
              updates.aiConfidence = { ...existingConf, category: catResult.confidence };
            }
            categoryNeedsReview = catResult.needsReview;
            if (catResult.needsReview) result.flaggedForReview++;
          }

          let geoNeedsReview = false;
          if (!item.geoPrimarySlug) {
            const geoResult = await resolveGeoAssignment(itemRecord, item.cityId);
            if (geoResult.geoPrimarySlug) {
              updates.geoPrimarySlug = geoResult.geoPrimarySlug;
              if (geoResult.geoSecondarySlug) updates.geoSecondarySlug = geoResult.geoSecondarySlug;
              if (geoResult.hubSlug) updates.hubSlug = geoResult.hubSlug;
              if (geoResult.countySlug) updates.countySlug = geoResult.countySlug;
              result.fixedGeo++;
            }
            geoIsLowPrecision = geoResult.isLowPrecision;
            if (geoResult.isLowPrecision) result.lowGeoPrecision++;
            geoNeedsReview = geoResult.needsReview;
            if (geoResult.needsReview) result.flaggedForReview++;
          } else {
            const existingPrecision = await getZoneType(item.geoPrimarySlug, item.cityId);
            geoIsLowPrecision = existingPrecision === "METRO" || existingPrecision === "NONE";
            if (geoIsLowPrecision) result.lowGeoPrecision++;
          }

          const mergedItem = { ...itemRecord, ...updates, _geoIsLowPrecision: geoIsLowPrecision };
          const routing = evaluateContentRouting(mergedItem);
          const flags = computeIntegrityFlags(mergedItem);
          updates.integrityFlags = flags;
          updates.lastIntegrityPassAt = new Date();
          updates.updatedAt = new Date();

          if (flags.includes("ROUTING_ISSUE")) result.routingIssues++;

          const needsEnforcedReview = categoryNeedsReview || geoNeedsReview || routing.hasRoutingIssues || flags.includes("MISSING_CATEGORY") || flags.includes("MISSING_GEO");
          if (needsEnforcedReview) {
            const currentQs = item.queueStatus as string;
            if (currentQs !== "SUPPRESSED" && currentQs !== "ARCHIVED") {
              updates.queueStatus = "REVIEW_REQUIRED";
            }
          }

          if (!item.queueStatus && !needsEnforcedReview) {
            const ps = (mergedItem.publishStatus as string) || "DRAFT";
            const pol = (mergedItem.policyStatus as string) || "REVIEW_NEEDED";
            const pe = mergedItem.pulseEligible !== false;
            updates.queueStatus = deriveQueueStatus(ps, pol, pe, undefined);
          }

          const existingFlagsStr = JSON.stringify((item.integrityFlags || []) as string[]);
          const newFlagsStr = JSON.stringify(flags);
          const hasSubstantiveChanges =
            existingFlagsStr !== newFlagsStr ||
            updates.categoryCoreSlug !== undefined ||
            updates.categorySubSlug !== undefined ||
            updates.geoPrimarySlug !== undefined ||
            updates.geoSecondarySlug !== undefined ||
            updates.hubSlug !== undefined ||
            updates.countySlug !== undefined ||
            updates.queueStatus !== undefined;

          if (hasSubstantiveChanges) {
            await db.update(rssItems).set(updates).where(eq(rssItems.id, item.id));
          }
        } catch (err: unknown) {
          result.errors++;
          console.error(`[IntegrityPass] Error processing item ${item.id}:`, err instanceof Error ? err.message : err);
        }
      }

      pageOffset += PAGE_SIZE;
    }
  } catch (err: unknown) {
    console.error("[IntegrityPass] Fatal error:", err instanceof Error ? err.message : err);
  }

  console.log(`[IntegrityPass] Complete:`, JSON.stringify(result));
  return result;
}
