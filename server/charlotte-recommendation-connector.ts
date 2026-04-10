import { db, pool } from "./db";
import { eq, and, ilike, sql, desc, asc, inArray } from "drizzle-orm";
import {
  businesses, events, zones, regions, hubZipCoverage,
  jobs, attractions, marketplaceListings, articles,
  trustProfiles, presenceRegionAssignment, entityScores, categories,
  rssItems, curatedLists, digests, tags, contentTags,
} from "@shared/schema";
import { computeOpportunityScores } from "./opportunity-scoring";
import { detectLocation } from "./location-detection";
import { computeEntityScores } from "./intelligence/scoring/entityScoring";

type TrustLevel = "T0" | "T1" | "T2" | "T3" | "T4" | "T5";
const TRUST_LEVEL_RANK: Record<TrustLevel, number> = { T0: 0, T1: 1, T2: 2, T3: 3, T4: 4, T5: 5 };

let categorySlugCache: Map<string, string[]> | null = null;
let categoryCacheExpiry = 0;

async function resolveCategorySlugsToIds(slugs: string[]): Promise<string[]> {
  const now = Date.now();
  if (!categorySlugCache || now > categoryCacheExpiry) {
    const allCats = await db.select({ id: categories.id, slug: categories.slug }).from(categories);
    categorySlugCache = new Map<string, string[]>();
    for (const cat of allCats) {
      const parts = cat.slug.toLowerCase().split("-");
      for (const part of parts) {
        const existing = categorySlugCache.get(part) || [];
        existing.push(cat.id);
        categorySlugCache.set(part, existing);
      }
      const existing = categorySlugCache.get(cat.slug.toLowerCase()) || [];
      existing.push(cat.id);
      categorySlugCache.set(cat.slug.toLowerCase(), existing);
    }
    categoryCacheExpiry = now + 10 * 60 * 1000;
  }

  const ids = new Set<string>();
  for (const slug of slugs) {
    const matches = categorySlugCache.get(slug.toLowerCase());
    if (matches) {
      for (const id of matches) ids.add(id);
    }
  }
  return Array.from(ids);
}

export type ConciergeDomain =
  | "dining"
  | "services"
  | "shopping"
  | "housing"
  | "jobs"
  | "events"
  | "marketplace"
  | "creators"
  | "experts"
  | "things-to-do"
  | "attractions"
  | "general";

export interface RecommendationQuery {
  metroId: string;
  entityType?: "business" | "event" | "job" | "attraction" | "marketplace";
  category?: string;
  query?: string;
  domain?: ConciergeDomain;
  geo?: GeoFilter;
  sortBy?: "trust" | "relevance" | "activity" | "rating";
  minTrustLevel?: TrustLevel;
  onlyClaimed?: boolean;
  onlyVerified?: boolean;
  limit?: number;
}

export interface GeoFilter {
  type: "near_me" | "zone" | "hub" | "metro";
  lat?: number;
  lng?: number;
  zoneSlug?: string;
  hubCode?: string;
  radiusMiles?: number;
}

export interface RecommendationResult {
  id: string;
  name: string;
  slug: string;
  entityType: string;
  imageUrl: string | null;
  trustLevel: TrustLevel | null;
  trustScore: number;
  isVerified: boolean;
  isClaimed: boolean;
  claimStatus: string;
  zoneId: string | null;
  zoneName: string | null;
  address: string | null;
  category: string | null;
  categoryIds: string[];
  relevanceScore: number;
  participationSignals: {
    hasCrownStatus: boolean;
    hasStory: boolean;
    listingTier: string;
    storyDepthScore: number;
    opportunityScore: number;
    googleRating?: number;
  };
  followOnActions: string[];
  reason: string;
  signalsUsed: string[];
}

export interface ConciergeResponse {
  domain: ConciergeDomain;
  results: RecommendationResult[];
  geoContext: { zoneName?: string; hubName?: string; nearestHub?: string } | null;
  followOnSuggestions: string[];
  totalAvailable: number;
  broadened?: boolean;
  broadeningReason?: string;
}

const DOMAIN_CONFIG: Record<ConciergeDomain, {
  entityType: "business" | "event" | "job" | "attraction" | "marketplace";
  categoryFilter?: string[];
  followOnActions: string[];
}> = {
  dining: {
    entityType: "business",
    categoryFilter: ["restaurants", "food", "dining", "cafe", "bakery", "bar", "brewery", "coffee"],
    followOnActions: ["view_profile", "view_map", "make_reservation", "read_story", "view_menu"],
  },
  services: {
    entityType: "business",
    categoryFilter: ["services", "automotive", "health", "beauty", "fitness", "legal", "financial", "home-services"],
    followOnActions: ["view_profile", "contact", "book_appointment", "read_story"],
  },
  shopping: {
    entityType: "business",
    categoryFilter: ["shopping", "retail", "boutique", "gifts"],
    followOnActions: ["view_profile", "view_map", "shop_online", "read_story"],
  },
  housing: {
    entityType: "business",
    categoryFilter: ["real-estate", "apartments", "housing", "property-management"],
    followOnActions: ["view_profile", "contact", "schedule_tour", "view_on_map", "start_claim"],
  },
  jobs: {
    entityType: "job",
    followOnActions: ["apply", "save_job", "set_alert"],
  },
  events: {
    entityType: "event",
    followOnActions: ["rsvp", "view_details", "add_to_calendar", "share"],
  },
  marketplace: {
    entityType: "marketplace",
    followOnActions: ["view_listing", "contact_seller", "save"],
  },
  creators: {
    entityType: "business",
    categoryFilter: ["creator", "artist", "photographer", "videographer", "musician", "writer"],
    followOnActions: ["view_profile", "contact", "book", "view_portfolio"],
  },
  experts: {
    entityType: "business",
    categoryFilter: ["consultant", "coach", "advisor", "specialist", "professional"],
    followOnActions: ["view_profile", "contact", "book_consultation"],
  },
  "things-to-do": {
    entityType: "attraction",
    followOnActions: ["view_details", "view_map", "get_directions"],
  },
  attractions: {
    entityType: "attraction",
    followOnActions: ["view_details", "view_map", "get_directions"],
  },
  general: {
    entityType: "business",
    followOnActions: ["view_profile", "contact", "read_story", "view_map"],
  },
};

async function getMetroHubIds(metroId: string): Promise<string[]> {
  const result = await pool.query(
    `SELECT r.id FROM regions r
     WHERE r.region_type = 'hub' AND r.is_active = true
     AND r.parent_region_id IN (
       SELECT r2.id FROM regions r2
       WHERE r2.region_type IN ('county', 'metro') AND r2.is_active = true
       AND EXISTS (
         SELECT 1 FROM zones z WHERE z.city_id = $1
         AND (z.county = r2.name OR r2.region_type = 'metro')
       )
     )`,
    [metroId]
  );
  return result.rows.map((r: Record<string, unknown>) => String(r.id));
}

async function resolveGeoFilter(
  geo: GeoFilter,
  metroId: string
): Promise<{ zoneId?: string; zoneName?: string; hubId?: string; hubName?: string; nearestHub?: string }> {
  if (geo.type === "zone" && geo.zoneSlug) {
    const [zone] = await db.select({ id: zones.id, name: zones.name })
      .from(zones)
      .where(and(eq(zones.cityId, metroId), eq(zones.slug, geo.zoneSlug), eq(zones.isActive, true)))
      .limit(1);
    if (zone) return { zoneId: zone.id, zoneName: zone.name };
  }

  if (geo.type === "hub" && geo.hubCode) {
    const metroHubIds = await getMetroHubIds(metroId);
    const [hub] = await db.select({ id: regions.id, name: regions.name })
      .from(regions)
      .where(and(
        eq(regions.code, geo.hubCode),
        eq(regions.regionType, "hub"),
        eq(regions.isActive, true),
        metroHubIds.length > 0 ? inArray(regions.id, metroHubIds) : sql`true`
      ))
      .limit(1);
    if (hub) return { hubId: hub.id, hubName: hub.name };
  }

  if (geo.type === "near_me" && geo.lat && geo.lng) {
    const metroHubIds = await getMetroHubIds(metroId);
    const hubConditions = [eq(regions.regionType, "hub"), eq(regions.isActive, true)];
    if (metroHubIds.length > 0) hubConditions.push(inArray(regions.id, metroHubIds));
    const allHubs = await db.select({
      id: regions.id,
      name: regions.name,
      centerLat: regions.centerLat,
      centerLng: regions.centerLng,
    }).from(regions).where(and(...hubConditions));

    let closest: { id: string; name: string; dist: number } | null = null;
    for (const hub of allHubs) {
      if (!hub.centerLat || !hub.centerLng) continue;
      const dist = haversine(geo.lat, geo.lng, parseFloat(hub.centerLat), parseFloat(hub.centerLng));
      if (dist <= (geo.radiusMiles || 15) && (!closest || dist < closest.dist)) {
        closest = { id: hub.id, name: hub.name, dist };
      }
    }
    if (closest) return { hubId: closest.id, hubName: closest.name, nearestHub: closest.name };
  }

  return {};
}

async function resolveHubForZone(zoneSlug: string, metroId: string): Promise<{ hubId: string; hubCode: string; hubName: string } | null> {
  try {
    const [zone] = await db.select({ id: zones.id, zipCodes: zones.zipCodes })
      .from(zones)
      .where(and(eq(zones.cityId, metroId), eq(zones.slug, zoneSlug), eq(zones.isActive, true)))
      .limit(1);
    if (!zone || !zone.zipCodes || zone.zipCodes.length === 0) return null;

    const hubResult = await pool.query(
      `SELECT r.id, r.code, r.name FROM hub_zip_coverage hzc
       JOIN regions r ON r.id = hzc.hub_region_id AND r.region_type = 'hub' AND r.is_active = true
       WHERE hzc.zip = ANY($1)
       GROUP BY r.id, r.code, r.name
       ORDER BY COUNT(*) DESC
       LIMIT 1`,
      [zone.zipCodes]
    );
    if (hubResult.rows.length > 0) {
      const row = hubResult.rows[0] as { id: string; code: string; name: string };
      return { hubId: row.id, hubCode: row.code, hubName: row.name };
    }
  } catch (err) {
    console.error("[RecommendationConnector] Failed to resolve hub for zone:", err instanceof Error ? err.message : err);
  }
  return null;
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function generateRecommendationReason(result: {
  name: string;
  trustLevel: TrustLevel | null;
  isVerified: boolean;
  isClaimed: boolean;
  zoneName: string | null;
  participationSignals: {
    hasCrownStatus: boolean;
    hasStory: boolean;
    storyDepthScore: number;
    opportunityScore: number;
    googleRating?: number;
  };
}): { reason: string; signalsUsed: string[] } {
  const parts: string[] = [];
  const signalsUsed: string[] = [];

  if (result.trustLevel && TRUST_LEVEL_RANK[result.trustLevel] >= 3) {
    parts.push(`highly trusted (${result.trustLevel})`);
    signalsUsed.push("trustLevel");
  } else if (result.trustLevel && TRUST_LEVEL_RANK[result.trustLevel] >= 1) {
    parts.push(`trusted community member (${result.trustLevel})`);
    signalsUsed.push("trustLevel");
  }

  if (result.isVerified) {
    parts.push("verified");
    signalsUsed.push("isVerified");
  }

  if (result.isClaimed) {
    parts.push("actively managed listing");
    signalsUsed.push("isClaimed");
  }

  if (result.participationSignals.hasCrownStatus) {
    parts.push("Crown program participant");
    signalsUsed.push("crownStatus");
  }

  if (result.participationSignals.googleRating && result.participationSignals.googleRating >= 4.0) {
    parts.push(`${result.participationSignals.googleRating}★ rated`);
    signalsUsed.push("googleRating");
  }

  if (result.participationSignals.hasStory && result.participationSignals.storyDepthScore >= 50) {
    parts.push("rich local story");
    signalsUsed.push("storyDepthScore");
  } else if (result.participationSignals.hasStory) {
    parts.push("has a local story");
    signalsUsed.push("storyDepthScore");
  }

  if (result.zoneName) {
    parts.push(`located in ${result.zoneName}`);
    signalsUsed.push("zoneName");
  }

  if (result.participationSignals.opportunityScore >= 70) {
    parts.push("high community engagement");
    signalsUsed.push("opportunityScore");
  }

  if (parts.length === 0) {
    return { reason: `${result.name} is a local option in the Charlotte area.`, signalsUsed: [] };
  }

  const reasonBody = parts.join(", ");
  return {
    reason: `${result.name} is recommended because it is ${reasonBody}.`,
    signalsUsed,
  };
}

const BROADENING_THRESHOLD = 3;

function logRecommendationRequest(params: {
  intent: string;
  entityType: string;
  geoScope: string;
  filters: Record<string, unknown>;
  resultCount: number;
  broadened: boolean;
}): void {
  console.log(`[RecommendationConnector] Request: intent="${params.intent}", entityType=${params.entityType}, geo=${params.geoScope}, filters=${JSON.stringify(params.filters)}, results=${params.resultCount}, broadened=${params.broadened}`);
}

export async function queryRecommendations(query: RecommendationQuery): Promise<RecommendationResult[]> {
  const limit = Math.min(query.limit || 20, 100);
  const entityType = query.entityType || "business";

  if (entityType === "event") {
    const geoResolved = query.geo ? await resolveGeoFilter(query.geo, query.metroId) : {};
    const eventResponse = await queryEventDomain(query.metroId, query.query, geoResolved, limit, ["view_details", "rsvp"]);
    return eventResponse.results;
  }

  if (entityType === "job") {
    const geoResolved = query.geo ? await resolveGeoFilter(query.geo, query.metroId) : {};
    const jobResponse = await queryJobDomain(query.metroId, query.query, geoResolved, limit, ["apply", "save_job"]);
    return jobResponse.results;
  }

  if (entityType === "attraction") {
    const geoResolved = query.geo ? await resolveGeoFilter(query.geo, query.metroId) : {};
    const attrResponse = await queryAttractionDomain(query.metroId, query.query, geoResolved, limit, ["view_details", "get_directions"]);
    return attrResponse.results;
  }

  if (entityType === "marketplace") {
    const geoResolved = query.geo ? await resolveGeoFilter(query.geo, query.metroId) : {};
    const mktResponse = await queryMarketplaceDomain(query.metroId, query.query, geoResolved, limit, ["view_listing", "contact_seller"]);
    return mktResponse.results;
  }

  const geoResolved = query.geo ? await resolveGeoFilter(query.geo, query.metroId) : {};

  const conditions = [eq(businesses.cityId, query.metroId)];

  if (geoResolved.zoneId) {
    conditions.push(eq(businesses.zoneId, geoResolved.zoneId));
  }

  if (geoResolved.hubId) {
    conditions.push(
      sql`${businesses.id} IN (SELECT presence_id FROM presence_region_assignment WHERE primary_region_id = ${geoResolved.hubId})`
    );
  }

  if (query.onlyVerified) {
    conditions.push(eq(businesses.isVerified, true));
  }

  if (query.onlyClaimed) {
    conditions.push(eq(businesses.claimStatus, "CLAIMED"));
  }

  if (query.query) {
    conditions.push(
      sql`(${ilike(businesses.name, `%${query.query}%`)} OR ${ilike(businesses.description, `%${query.query}%`)})`
    );
  }

  if (query.category) {
    const resolvedIds = await resolveCategorySlugsToIds([query.category]);
    if (resolvedIds.length > 0) {
      conditions.push(sql`${businesses.categoryIds} && ${sql`ARRAY[${sql.join(resolvedIds.map(id => sql`${id}`), sql`, `)}]::text[]`}`);
    }
  }

  const bizRows = await db.select({
    id: businesses.id,
    name: businesses.name,
    slug: businesses.slug,
    imageUrl: businesses.imageUrl,
    isVerified: businesses.isVerified,
    claimStatus: businesses.claimStatus,
    zoneId: businesses.zoneId,
    address: businesses.address,
    listingTier: businesses.listingTier,
    categoryIds: businesses.categoryIds,
    googleRating: businesses.googleRating,
    googleReviewCount: businesses.googleReviewCount,
    priorityRank: businesses.priorityRank,
    latitude: businesses.latitude,
    longitude: businesses.longitude,
    presenceType: businesses.presenceType,
    websiteUrl: businesses.websiteUrl,
    venueScreenLikely: businesses.venueScreenLikely,
  }).from(businesses)
    .where(and(...conditions))
    .orderBy(desc(businesses.priorityRank), desc(businesses.isVerified))
    .limit(limit * 2);

  const bizIds = bizRows.map(b => b.id);

  const trustProfileMap = new Map<string, { trustLevel: string; signalSnapshot: unknown }>();
  if (bizIds.length > 0) {
    const tpRows = await db.select({
      businessId: trustProfiles.businessId,
      trustLevel: trustProfiles.trustLevel,
      signalSnapshot: trustProfiles.signalSnapshot,
    }).from(trustProfiles).where(inArray(trustProfiles.businessId, bizIds));
    for (const tp of tpRows) {
      trustProfileMap.set(tp.businessId, { trustLevel: tp.trustLevel, signalSnapshot: tp.signalSnapshot });
    }
  }

  const entityScoreMap = new Map<string, { prospectFitScore: number; contactReadyScore: number; dataQualityScore: number }>();
  if (bizIds.length > 0) {
    const esRows = await db.select({
      entityId: entityScores.entityId,
      prospectFitScore: entityScores.prospectFitScore,
      contactReadyScore: entityScores.contactReadyScore,
      dataQualityScore: entityScores.dataQualityScore,
    }).from(entityScores).where(inArray(entityScores.entityId, bizIds));
    for (const es of esRows) {
      entityScoreMap.set(es.entityId, es);
    }
  }

  const zoneIds = [...new Set(bizRows.map(b => b.zoneId).filter((z): z is string => !!z))];
  const zoneNameMap = new Map<string, string>();
  if (zoneIds.length > 0) {
    const zoneRows = await db.select({ id: zones.id, name: zones.name }).from(zones).where(inArray(zones.id, zoneIds));
    for (const z of zoneRows) {
      zoneNameMap.set(z.id, z.name);
    }
  }

  const results: RecommendationResult[] = [];

  for (const biz of bizRows) {
    let trustLevel: TrustLevel | null = null;
    let trustScore = 0;
    let storyDepthScore = 0;
    let hasCrownStatus = false;
    let opportunityScore = 0;

    const profile = trustProfileMap.get(biz.id);
    if (profile) {
      trustLevel = profile.trustLevel as TrustLevel;
      trustScore = TRUST_LEVEL_RANK[trustLevel] * 20;
      const snapshot = profile.signalSnapshot as Record<string, unknown> | null;
      if (snapshot) {
        storyDepthScore = (snapshot.storyDepthScore as number) || 0;
        hasCrownStatus = !!(snapshot.isCrownParticipant || snapshot.isCrownWinner);
      }
    }

    if (query.minTrustLevel) {
      if (!trustLevel || TRUST_LEVEL_RANK[trustLevel] < TRUST_LEVEL_RANK[query.minTrustLevel]) continue;
    }

    const oppScores = computeOpportunityScores(biz, {});
    opportunityScore = oppScores.overall;

    let prospectFit = 0;
    let contactReady = 0;
    let dataQuality = 0;
    const cachedScore = entityScoreMap.get(biz.id);
    if (cachedScore) {
      prospectFit = cachedScore.prospectFitScore;
      contactReady = cachedScore.contactReadyScore;
      dataQuality = cachedScore.dataQualityScore;
    } else {
      computeEntityScores(biz.id).catch(e =>
        console.error(`[RecommendationConnector] Background score compute failed for ${biz.id}:`, e instanceof Error ? e.message : e)
      );
    }

    const relevanceScore = Math.round(
      (trustScore * 0.35) +
      (opportunityScore * 0.25) +
      (prospectFit * 0.15) +
      (dataQuality * 0.15) +
      (contactReady * 0.10)
    );

    const zoneName = biz.zoneId ? (zoneNameMap.get(biz.zoneId) || null) : null;

    const isClaimed = biz.claimStatus === "CLAIMED";
    const signals = {
      hasCrownStatus,
      hasStory: storyDepthScore > 0,
      listingTier: biz.listingTier,
      storyDepthScore,
      opportunityScore,
      googleRating: biz.googleRating ? parseFloat(biz.googleRating) : 0,
    };

    const { reason, signalsUsed } = generateRecommendationReason({
      name: biz.name,
      trustLevel,
      isVerified: biz.isVerified,
      isClaimed,
      zoneName,
      participationSignals: signals,
    });

    results.push({
      id: biz.id,
      name: biz.name,
      slug: biz.slug,
      entityType: "business",
      imageUrl: biz.imageUrl,
      trustLevel,
      trustScore,
      isVerified: biz.isVerified,
      isClaimed,
      claimStatus: biz.claimStatus,
      zoneId: biz.zoneId,
      zoneName,
      address: biz.address,
      category: biz.categoryIds?.[0] || null,
      categoryIds: biz.categoryIds || [],
      relevanceScore,
      participationSignals: signals,
      followOnActions: ["view_profile", "contact", "read_story", "view_map"],
      reason,
      signalsUsed,
    });
  }

  if (query.sortBy === "trust") {
    results.sort((a, b) => b.trustScore - a.trustScore);
  } else if (query.sortBy === "rating") {
    results.sort((a, b) => {
      const aRating = a.participationSignals?.googleRating ?? 0;
      const bRating = b.participationSignals?.googleRating ?? 0;
      if (bRating !== aRating) return bRating - aRating;
      return b.relevanceScore - a.relevanceScore;
    });
  } else if (query.sortBy === "activity") {
    results.sort((a, b) => {
      const aActivity = (a.participationSignals?.hasCrownStatus ? 2 : 0) + (a.participationSignals?.hasStory ? 1 : 0) + (a.participationSignals?.storyDepthScore ?? 0) / 100;
      const bActivity = (b.participationSignals?.hasCrownStatus ? 2 : 0) + (b.participationSignals?.hasStory ? 1 : 0) + (b.participationSignals?.storyDepthScore ?? 0) / 100;
      if (bActivity !== aActivity) return bActivity - aActivity;
      return b.relevanceScore - a.relevanceScore;
    });
  } else {
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  const finalResults = results.slice(0, limit);

  const geoScope = query.geo?.type || "metro";
  logRecommendationRequest({
    intent: query.query || "",
    entityType,
    geoScope,
    filters: {
      category: query.category || null,
      minTrustLevel: query.minTrustLevel || null,
      onlyClaimed: query.onlyClaimed || false,
      onlyVerified: query.onlyVerified || false,
      sortBy: query.sortBy || "relevance",
    },
    resultCount: finalResults.length,
    broadened: false,
  });

  return finalResults;
}

export async function queryConcierge(
  metroId: string,
  domain: ConciergeDomain,
  searchText?: string,
  geo?: GeoFilter,
  limit?: number
): Promise<ConciergeResponse> {
  const config = DOMAIN_CONFIG[domain] || DOMAIN_CONFIG.general;
  const safeLimit = Math.min(limit || 15, 50);
  const geoResolved = geo ? await resolveGeoFilter(geo, metroId) : {};

  if (config.entityType === "job") {
    return queryJobDomain(metroId, searchText, geoResolved, safeLimit, config.followOnActions);
  }

  if (config.entityType === "event") {
    return queryEventDomain(metroId, searchText, geoResolved, safeLimit, config.followOnActions);
  }

  if (config.entityType === "attraction") {
    return queryAttractionDomain(metroId, searchText, geoResolved, safeLimit, config.followOnActions);
  }

  if (config.entityType === "marketplace") {
    return queryMarketplaceDomain(metroId, searchText, geoResolved, safeLimit, config.followOnActions);
  }

  if (domain === "housing") {
    return queryHousingDomain(metroId, searchText, geoResolved, safeLimit, config);
  }

  let broadened = false;
  let broadeningReason: string | undefined;
  let currentGeo = geo;
  let currentMinTrust: TrustLevel | undefined = "T2";

  const broadeningSteps: Array<{ geoOverride?: GeoFilter; trustOverride?: TrustLevel; label: string }> = [];
  if (geo?.type === "zone" && geo.zoneSlug) {
    const hubInfo = await resolveHubForZone(geo.zoneSlug, metroId);
    if (hubInfo) {
      broadeningSteps.push({ geoOverride: { type: "hub", hubCode: hubInfo.hubCode }, label: `broadened from zone to ${hubInfo.hubName} hub` });
    }
    broadeningSteps.push({ geoOverride: { type: "metro" }, label: "broadened to metro-wide search" });
  } else if (geo?.type === "hub") {
    broadeningSteps.push({ geoOverride: { type: "metro" }, label: "broadened to metro-wide search" });
  }
  broadeningSteps.push({ trustOverride: "T1", label: "lowered trust requirement to T1" });
  broadeningSteps.push({ trustOverride: "T0", label: "removed minimum trust requirement" });

  let recommendationResults = await queryRecommendations({
    metroId,
    query: searchText,
    geo: currentGeo,
    limit: safeLimit * 3,
    sortBy: "trust",
    minTrustLevel: currentMinTrust,
  });

  if (recommendationResults.length < BROADENING_THRESHOLD) {
    for (const step of broadeningSteps) {
      if (step.geoOverride) currentGeo = step.geoOverride;
      if (step.trustOverride) currentMinTrust = step.trustOverride;

      recommendationResults = await queryRecommendations({
        metroId,
        query: searchText,
        geo: currentGeo,
        limit: safeLimit * 3,
        sortBy: "trust",
        minTrustLevel: currentMinTrust,
      });

      broadened = true;
      broadeningReason = `Results were limited, so the search was ${step.label}.`;

      if (recommendationResults.length >= BROADENING_THRESHOLD) {
        break;
      }
    }
    if (broadened && recommendationResults.length === 0) {
      broadeningReason = "Results were limited even after broadening geo and trust filters.";
    }
  }

  let filtered = recommendationResults;
  if (config.categoryFilter && config.categoryFilter.length > 0 && domain !== "general") {
    const resolvedCategoryIds = await resolveCategorySlugsToIds(config.categoryFilter);
    if (resolvedCategoryIds.length > 0) {
      const idSet = new Set(resolvedCategoryIds);
      filtered = recommendationResults.filter(r => {
        if (!r.categoryIds || r.categoryIds.length === 0) return false;
        return r.categoryIds.some(cid => idSet.has(cid));
      });
      if (filtered.length < 3) filtered = recommendationResults;
    }
  }

  for (const r of filtered) {
    r.followOnActions = config.followOnActions;
  }

  logRecommendationRequest({
    intent: searchText || "",
    entityType: config.entityType,
    geoScope: currentGeo?.type || "metro",
    filters: {
      domain,
      categoryFilter: config.categoryFilter || null,
    },
    resultCount: filtered.length,
    broadened,
  });

  let finalGeoContext: { zoneName?: string; hubName?: string; nearestHub?: string } | null =
    Object.keys(geoResolved).length > 0 ? geoResolved : null;
  if (broadened && currentGeo) {
    if (currentGeo.type === "metro") {
      finalGeoContext = { hubName: "Metro-wide" };
    } else if (currentGeo.type === "hub" && currentGeo.hubCode) {
      let hubDisplayName = currentGeo.hubCode;
      try {
        const [hubRow] = await db.select({ name: regions.name })
          .from(regions)
          .where(and(eq(regions.code, currentGeo.hubCode), eq(regions.regionType, "hub")))
          .limit(1);
        if (hubRow) hubDisplayName = hubRow.name;
      } catch {}
      finalGeoContext = { hubName: hubDisplayName, ...(finalGeoContext || {}) };
    }
  }

  return {
    domain,
    results: filtered.slice(0, safeLimit),
    geoContext: finalGeoContext,
    followOnSuggestions: buildFollowOnSuggestions(domain, filtered.length),
    totalAvailable: filtered.length,
    broadened: broadened || undefined,
    broadeningReason,
  };
}

async function queryJobDomain(
  metroId: string,
  searchText: string | undefined,
  geoResolved: Record<string, string | undefined>,
  limit: number,
  followOnActions: string[]
): Promise<ConciergeResponse> {
  const conditions = [eq(jobs.cityId, metroId)];
  if (searchText) {
    conditions.push(sql`(${ilike(jobs.title, `%${searchText}%`)} OR ${ilike(jobs.employer, `%${searchText}%`)})`);
  }
  if (geoResolved.zoneId) {
    conditions.push(
      sql`${jobs.zipCode} = ANY(SELECT unnest(zip_codes) FROM zones WHERE id = ${geoResolved.zoneId})`
    );
  }

  const jobRows = await db.select({
    id: jobs.id,
    title: jobs.title,
    slug: jobs.slug,
    employer: jobs.employer,
    employmentType: jobs.employmentType,
  }).from(jobs)
    .where(and(...conditions, sql`(job_status IS NULL OR job_status = 'active')`))
    .orderBy(desc(jobs.postedAt))
    .limit(limit);

  const results: RecommendationResult[] = jobRows.map(j => ({
    id: j.id,
    name: j.title,
    slug: j.slug || "",
    entityType: "job",
    imageUrl: null,
    trustLevel: null,
    trustScore: 0,
    isVerified: false,
    isClaimed: false,
    claimStatus: "N/A",
    zoneId: null,
    zoneName: null,
    address: null,
    category: j.employmentType || null,
    categoryIds: [],
    relevanceScore: 50,
    participationSignals: { hasCrownStatus: false, hasStory: false, listingTier: "N/A", storyDepthScore: 0, opportunityScore: 0 },
    followOnActions,
    reason: `${j.title} is an open ${j.employmentType || "position"} with ${j.employer || "a local employer"}.`,
    signalsUsed: ["employmentType"],
  }));

  logRecommendationRequest({
    intent: searchText || "",
    entityType: "job",
    geoScope: geoResolved.zoneId ? "zone" : geoResolved.hubId ? "hub" : "metro",
    filters: { searchText: searchText || null },
    resultCount: results.length,
    broadened: false,
  });

  return {
    domain: "jobs",
    results,
    geoContext: Object.keys(geoResolved).length > 0 ? geoResolved : null,
    followOnSuggestions: ["Set up a job alert", "Upload your resume", "Browse by category"],
    totalAvailable: results.length,
  };
}

async function queryEventDomain(
  metroId: string,
  searchText: string | undefined,
  geoResolved: Record<string, string | undefined>,
  limit: number,
  followOnActions: string[]
): Promise<ConciergeResponse> {
  const conditions = [eq(events.cityId, metroId)];
  if (searchText) {
    conditions.push(ilike(events.title, `%${searchText}%`));
  }
  if (geoResolved.zoneId) {
    conditions.push(eq(events.zoneId, geoResolved.zoneId));
  }

  const eventRows = await db.select({
    id: events.id,
    title: events.title,
    slug: events.slug,
    imageUrl: events.imageUrl,
    startDateTime: events.startDateTime,
  }).from(events)
    .where(and(...conditions))
    .orderBy(desc(events.startDateTime))
    .limit(limit);

  const results: RecommendationResult[] = eventRows.map(e => ({
    id: e.id,
    name: e.title,
    slug: e.slug || "",
    entityType: "event",
    imageUrl: e.imageUrl,
    trustLevel: null,
    trustScore: 0,
    isVerified: false,
    isClaimed: false,
    claimStatus: "N/A",
    zoneId: null,
    zoneName: null,
    address: null,
    category: null,
    categoryIds: [],
    relevanceScore: 50,
    participationSignals: { hasCrownStatus: false, hasStory: false, listingTier: "N/A", storyDepthScore: 0, opportunityScore: 0 },
    followOnActions,
    reason: `${e.title} is an upcoming event in the Charlotte area.`,
    signalsUsed: ["eventDate"],
  }));

  logRecommendationRequest({
    intent: searchText || "",
    entityType: "event",
    geoScope: geoResolved.zoneId ? "zone" : geoResolved.hubId ? "hub" : "metro",
    filters: { searchText: searchText || null },
    resultCount: results.length,
    broadened: false,
  });

  return {
    domain: "events",
    results,
    geoContext: Object.keys(geoResolved).length > 0 ? geoResolved : null,
    followOnSuggestions: ["View upcoming events this week", "Browse by category", "Submit your own event"],
    totalAvailable: results.length,
  };
}

async function queryAttractionDomain(
  metroId: string,
  searchText: string | undefined,
  geoResolved: Record<string, string | undefined>,
  limit: number,
  followOnActions: string[]
): Promise<ConciergeResponse> {
  const conditions = [eq(attractions.cityId, metroId)];
  if (searchText) {
    conditions.push(sql`(${ilike(attractions.name, `%${searchText}%`)} OR ${ilike(attractions.description, `%${searchText}%`)})`);
  }
  if (geoResolved.zoneId) {
    conditions.push(eq(attractions.zoneId, geoResolved.zoneId));
  }

  const attrRows = await db.select({
    id: attractions.id,
    name: attractions.name,
    slug: attractions.slug,
    imageUrl: attractions.imageUrl,
    attractionType: attractions.attractionType,
    zoneId: attractions.zoneId,
  }).from(attractions)
    .where(and(...conditions))
    .orderBy(desc(attractions.isFeatured), asc(attractions.name))
    .limit(limit);

  const results: RecommendationResult[] = attrRows.map(a => ({
    id: a.id,
    name: a.name,
    slug: a.slug || "",
    entityType: "attraction",
    imageUrl: a.imageUrl,
    trustLevel: null,
    trustScore: 0,
    isVerified: false,
    isClaimed: false,
    claimStatus: "N/A",
    zoneId: a.zoneId,
    zoneName: null,
    address: null,
    category: a.attractionType || null,
    categoryIds: [],
    relevanceScore: 50,
    participationSignals: { hasCrownStatus: false, hasStory: false, listingTier: "N/A", storyDepthScore: 0, opportunityScore: 0 },
    followOnActions,
    reason: `${a.name} is a local ${a.attractionType || "attraction"} in the Charlotte area.`,
    signalsUsed: ["attractionType"],
  }));

  logRecommendationRequest({
    intent: searchText || "",
    entityType: "attraction",
    geoScope: geoResolved.zoneId ? "zone" : geoResolved.hubId ? "hub" : "metro",
    filters: { searchText: searchText || null },
    resultCount: results.length,
    broadened: false,
  });

  return {
    domain: "attractions",
    results,
    geoContext: Object.keys(geoResolved).length > 0 ? geoResolved : null,
    followOnSuggestions: ["Explore by neighborhood", "View family-friendly options", "Plan your weekend"],
    totalAvailable: results.length,
  };
}

async function queryHousingDomain(
  metroId: string,
  searchText: string | undefined,
  geoResolved: Record<string, string | undefined>,
  limit: number,
  config: { categoryFilter?: string[]; followOnActions: string[] }
): Promise<ConciergeResponse> {
  const isRelocationQuery = searchText
    ? /where.*live|relocat|move to|neighborhood|area.*famil|good area|best area/.test(searchText.toLowerCase())
    : false;

  const agentGeoConditions = [eq(businesses.cityId, metroId)];
  if (geoResolved.zoneId) {
    agentGeoConditions.push(eq(businesses.zoneId, geoResolved.zoneId));
  }
  if (geoResolved.hubId) {
    agentGeoConditions.push(
      sql`${businesses.id} IN (SELECT presence_id FROM presence_region_assignment WHERE primary_region_id = ${geoResolved.hubId})`
    );
  }
  if (searchText) {
    agentGeoConditions.push(
      sql`(${ilike(businesses.name, `%${searchText}%`)} OR ${ilike(businesses.description, `%${searchText}%`)})`
    );
  }

  const agentBizRows = await db.select({
    id: businesses.id,
    name: businesses.name,
    slug: businesses.slug,
    imageUrl: businesses.imageUrl,
    isVerified: businesses.isVerified,
    claimStatus: businesses.claimStatus,
    zoneId: businesses.zoneId,
    address: businesses.address,
    listingTier: businesses.listingTier,
    categoryIds: businesses.categoryIds,
    googleRating: businesses.googleRating,
    priorityRank: businesses.priorityRank,
  }).from(businesses)
    .where(and(...agentGeoConditions))
    .orderBy(desc(businesses.priorityRank), desc(businesses.isVerified))
    .limit(Math.ceil(limit / 2) * 2);

  const agentBizIds = agentBizRows.map(b => b.id);
  const agentTrustMap = new Map<string, { trustLevel: string }>();
  if (agentBizIds.length > 0) {
    const tpRows = await db.select({
      businessId: trustProfiles.businessId,
      trustLevel: trustProfiles.trustLevel,
    }).from(trustProfiles).where(inArray(trustProfiles.businessId, agentBizIds));
    for (const tp of tpRows) {
      agentTrustMap.set(tp.businessId, { trustLevel: tp.trustLevel });
    }
  }

  const agentZoneIds = [...new Set(agentBizRows.map(b => b.zoneId).filter((z): z is string => !!z))];
  const agentZoneNameMap = new Map<string, string>();
  if (agentZoneIds.length > 0) {
    const zoneRows = await db.select({ id: zones.id, name: zones.name }).from(zones).where(inArray(zones.id, agentZoneIds));
    for (const z of zoneRows) {
      agentZoneNameMap.set(z.id, z.name);
    }
  }

  const agentResults: RecommendationResult[] = agentBizRows.map(biz => {
    const profile = agentTrustMap.get(biz.id);
    const trustLevel = (profile?.trustLevel as TrustLevel) || null;
    const trustScore = trustLevel ? TRUST_LEVEL_RANK[trustLevel] * 20 : 0;
    return {
      id: biz.id,
      name: biz.name,
      slug: biz.slug || "",
      entityType: "business",
      imageUrl: biz.imageUrl,
      trustLevel,
      trustScore,
      isVerified: biz.isVerified ?? false,
      isClaimed: biz.claimStatus === "CLAIMED",
      claimStatus: biz.claimStatus || "UNCLAIMED",
      zoneId: biz.zoneId,
      zoneName: biz.zoneId ? (agentZoneNameMap.get(biz.zoneId) || null) : null,
      address: biz.address,
      category: null,
      categoryIds: (biz.categoryIds as string[]) || [],
      relevanceScore: trustScore + (biz.googleRating ? parseFloat(biz.googleRating) * 10 : 0),
      participationSignals: {
        hasCrownStatus: false,
        hasStory: false,
        listingTier: biz.listingTier || "FREE",
        storyDepthScore: 0,
        opportunityScore: 0,
        googleRating: biz.googleRating ? parseFloat(biz.googleRating) : undefined,
      },
      followOnActions: config.followOnActions,
    };
  })

  const sortedAgentResults = agentResults.sort((a, b) => b.trustScore - a.trustScore).slice(0, Math.ceil(limit / 2));

  let filteredAgents = sortedAgentResults;
  if (config.categoryFilter && config.categoryFilter.length > 0) {
    const resolvedCategoryIds = await resolveCategorySlugsToIds(config.categoryFilter);
    if (resolvedCategoryIds.length > 0) {
      const idSet = new Set(resolvedCategoryIds);
      filteredAgents = sortedAgentResults.filter(r =>
        r.categoryIds && r.categoryIds.some(cid => idSet.has(cid))
      );
      if (filteredAgents.length < 2) filteredAgents = sortedAgentResults;
    }
  }
  for (const r of filteredAgents) {
    r.followOnActions = config.followOnActions;
  }

  const housingTypes = ["HOUSING_SUPPLY", "HOUSING_DEMAND", "HOUSING"];
  const mktConditions = [
    eq(marketplaceListings.status, "ACTIVE"),
    eq(marketplaceListings.cityId, metroId),
    inArray(marketplaceListings.type, housingTypes),
  ];
  if (geoResolved.zoneId) {
    mktConditions.push(eq(marketplaceListings.zoneId, geoResolved.zoneId));
  }
  if (searchText && !isRelocationQuery) {
    mktConditions.push(
      sql`(${ilike(marketplaceListings.title, `%${searchText}%`)} OR ${ilike(marketplaceListings.description, `%${searchText}%`)})`
    );
  }

  const mktRows = await db.select({
    id: marketplaceListings.id,
    title: marketplaceListings.title,
    imageUrl: marketplaceListings.imageUrl,
    type: marketplaceListings.type,
    price: marketplaceListings.price,
  }).from(marketplaceListings)
    .where(and(...mktConditions))
    .orderBy(desc(marketplaceListings.createdAt))
    .limit(Math.ceil(limit / 2));

  const listingResults: RecommendationResult[] = mktRows.map(m => ({
    id: m.id,
    name: m.title,
    slug: "",
    entityType: "marketplace",
    imageUrl: m.imageUrl,
    trustLevel: null,
    trustScore: 0,
    isVerified: false,
    isClaimed: false,
    claimStatus: "N/A",
    zoneId: null,
    zoneName: null,
    address: null,
    category: m.type || null,
    categoryIds: [],
    relevanceScore: 50,
    participationSignals: { hasCrownStatus: false, hasStory: false, listingTier: "N/A", storyDepthScore: 0, opportunityScore: 0 },
    followOnActions: ["view_listing", "contact_seller", "view_on_map"],
    reason: `${m.title} is an available ${m.type || "housing"} listing.`,
    signalsUsed: ["listingType"],
  }));

  const combined = [...filteredAgents.slice(0, Math.ceil(limit / 2)), ...listingResults].slice(0, limit);

  let zoneInsights: Record<string, unknown>[] | undefined;
  if (isRelocationQuery) {
    try {
      const { getZoneActivitySummary } = await import("./charlotte-command-center");
      const zoneSummary = await getZoneActivitySummary(metroId);
      zoneInsights = (zoneSummary as Record<string, unknown>[])
        ?.slice(0, 5);
    } catch (_) {}
  }

  const suggestions = ["Browse available properties", "Connect with local agents"];
  if (isRelocationQuery) {
    suggestions.push("Explore neighborhood activity levels");
    suggestions.push("Compare areas by community engagement");
  } else {
    suggestions.push("Schedule a tour");
  }

  logRecommendationRequest({
    intent: searchText || "",
    entityType: "business",
    geoScope: geoResolved.zoneId ? "zone" : geoResolved.hubId ? "hub" : "metro",
    filters: { domain: "housing", isRelocationQuery },
    resultCount: combined.length,
    broadened: false,
  });

  const response: ConciergeResponse = {
    domain: "housing",
    results: combined,
    geoContext: Object.keys(geoResolved).length > 0 ? geoResolved : null,
    followOnSuggestions: suggestions,
    totalAvailable: combined.length,
  };

  if (zoneInsights && zoneInsights.length > 0) {
    (response as ConciergeResponse & { zoneInsights?: unknown[] }).zoneInsights = zoneInsights;
  }

  return response;
}

async function queryMarketplaceDomain(
  metroId: string,
  searchText: string | undefined,
  geoResolved: Record<string, string | undefined>,
  limit: number,
  followOnActions: string[]
): Promise<ConciergeResponse> {
  const conditions = [eq(marketplaceListings.status, "ACTIVE"), eq(marketplaceListings.cityId, metroId)];
  if (searchText) {
    conditions.push(sql`(${ilike(marketplaceListings.title, `%${searchText}%`)} OR ${ilike(marketplaceListings.description, `%${searchText}%`)})`);
  }
  if (geoResolved.zoneId) {
    conditions.push(eq(marketplaceListings.zoneId, geoResolved.zoneId));
  }

  const mktRows = await db.select({
    id: marketplaceListings.id,
    title: marketplaceListings.title,
    imageUrl: marketplaceListings.imageUrl,
    type: marketplaceListings.type,
    price: marketplaceListings.price,
  }).from(marketplaceListings)
    .where(and(...conditions))
    .orderBy(desc(marketplaceListings.createdAt))
    .limit(limit);

  const results: RecommendationResult[] = mktRows.map(m => ({
    id: m.id,
    name: m.title,
    slug: "",
    entityType: "marketplace",
    imageUrl: m.imageUrl,
    trustLevel: null,
    trustScore: 0,
    isVerified: false,
    isClaimed: false,
    claimStatus: "N/A",
    zoneId: null,
    zoneName: null,
    address: null,
    category: m.type || null,
    categoryIds: [],
    relevanceScore: 50,
    participationSignals: { hasCrownStatus: false, hasStory: false, listingTier: "N/A", storyDepthScore: 0, opportunityScore: 0 },
    followOnActions,
    reason: `${m.title} is an available listing on the Charlotte marketplace.`,
    signalsUsed: ["listingType"],
  }));

  logRecommendationRequest({
    intent: searchText || "",
    entityType: "marketplace",
    geoScope: geoResolved.zoneId ? "zone" : geoResolved.hubId ? "hub" : "metro",
    filters: { searchText: searchText || null },
    resultCount: results.length,
    broadened: false,
  });

  return {
    domain: "marketplace",
    results,
    geoContext: Object.keys(geoResolved).length > 0 ? geoResolved : null,
    followOnSuggestions: ["Post your own listing", "Browse by category", "Set up alerts"],
    totalAvailable: results.length,
  };
}

async function queryArticleDomain(
  metroId: string,
  searchText: string | undefined,
  geoResolved: Record<string, string | undefined>,
  limit: number,
  followOnActions: string[]
): Promise<ConciergeResponse> {
  const conditions = [
    eq(articles.cityId, metroId),
    sql`${articles.publishedAt} IS NOT NULL`,
  ];
  if (searchText) {
    conditions.push(sql`(${ilike(articles.title, `%${searchText}%`)} OR ${ilike(articles.content, `%${searchText}%`)})`);
  }
  if (geoResolved.zoneId) {
    conditions.push(eq(articles.zoneId, geoResolved.zoneId));
  }

  const articleRows = await db.select({
    id: articles.id,
    title: articles.title,
    slug: articles.slug,
    imageUrl: articles.imageUrl,
  }).from(articles)
    .where(and(...conditions))
    .orderBy(desc(articles.publishedAt))
    .limit(limit);

  const results: RecommendationResult[] = articleRows.map(a => ({
    id: a.id,
    name: a.title,
    slug: a.slug || "",
    entityType: "article",
    imageUrl: a.imageUrl,
    trustLevel: null,
    trustScore: 0,
    isVerified: false,
    isClaimed: false,
    claimStatus: "N/A",
    zoneId: null,
    zoneName: null,
    address: null,
    category: null,
    categoryIds: [],
    relevanceScore: 50,
    participationSignals: { hasCrownStatus: false, hasStory: false, listingTier: "N/A", storyDepthScore: 0, opportunityScore: 0 },
    followOnActions,
    reason: `${a.title} is a local article from the Charlotte area.`,
    signalsUsed: ["articleDate"],
  }));

  logRecommendationRequest({
    intent: searchText || "",
    entityType: "article",
    geoScope: geoResolved.zoneId ? "zone" : geoResolved.hubId ? "hub" : "metro",
    filters: { searchText: searchText || null },
    resultCount: results.length,
    broadened: false,
  });

  return {
    domain: "general",
    results,
    geoContext: Object.keys(geoResolved).length > 0 ? geoResolved : null,
    followOnSuggestions: ["Read more articles", "Submit a story pitch"],
    totalAvailable: results.length,
  };
}

export interface QuickSearchResults {
  businesses: { id: string; name: string; slug: string; imageUrl: string | null; presenceType: string; creatorType: string | null; handle: string | null }[];
  events: { id: string; title: string; slug: string; imageUrl: string | null; startDateTime: string | Date | null }[];
  articles: { id: string; title: string; slug: string; imageUrl: string | null }[];
  jobs: { id: string; title: string; slug: string; employer: string | null; employmentType: string | null }[];
  attractions: { id: string; name: string; slug: string; imageUrl: string | null; attractionType: string }[];
  marketplace: { id: string; title: string; imageUrl: string | null; type: string; price: number | null }[];
  rssNews: { id: string; title: string; slug: string | null; imageUrl: string | null; sourceName: string | null }[];
  curatedLists: { id: string; title: string; slug: string; imageUrl: string | null; type: string }[];
  digests: { id: string; title: string; slug: string; publishedAt: Date | null }[];
  locationMatch?: { type: string; name: string; slug: string } | null;
}

export type ContentGateLevel = "ALL_AGES" | "TEEN" | "TWENTY_ONE_PLUS" | "ADULT_THEMES";

const GATE_RANK: Record<ContentGateLevel, number> = {
  ALL_AGES: 0,
  TEEN: 1,
  TWENTY_ONE_PLUS: 2,
  ADULT_THEMES: 3,
};

function isContentAllowedForGate(contentRating: string | null, gateLevel: ContentGateLevel): boolean {
  const rating = (contentRating || "ALL_AGES") as ContentGateLevel;
  return GATE_RANK[rating] <= GATE_RANK[gateLevel];
}

export async function queryQuickSearch(metroId: string, rawQuery: string, perTypeLimit = 5, gateLevel: ContentGateLevel = "ALL_AGES", hubSlug?: string): Promise<QuickSearchResults> {
  const detection = await detectLocation(rawQuery, metroId);
  const locationMatch = detection.locationMatch;
  const topicOnly = locationMatch ? (detection.topicTerms || undefined) : rawQuery;
  const q = topicOnly || "";

  const geo: GeoFilter | undefined = locationMatch?.type === "zone" && locationMatch.slug
    ? { type: "zone", zoneSlug: locationMatch.slug }
    : undefined;
  const geoResolved = geo ? await resolveGeoFilter(geo, metroId) : {};

  const [bizResults, eventResponse, articleResponse, jobResponse, attrResponse, mktResponse] = await Promise.all([
    queryRecommendations({
      metroId,
      query: q || undefined,
      geo,
      limit: perTypeLimit * 3,
      sortBy: "relevance",
    }),
    queryEventDomain(metroId, q || undefined, geoResolved, perTypeLimit * 2, ["view_details"]),
    queryArticleDomain(metroId, q || undefined, geoResolved, perTypeLimit, ["read"]),
    queryJobDomain(metroId, q || undefined, geoResolved, perTypeLimit, ["apply"]),
    queryAttractionDomain(metroId, q || undefined, geoResolved, perTypeLimit, ["view_details"]),
    queryMarketplaceDomain(metroId, q || undefined, geoResolved, perTypeLimit, ["view_listing"]),
  ]);

  const bizMapped = bizResults.map(b => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    imageUrl: b.imageUrl,
    presenceType: "business" as string,
    creatorType: null as string | null,
    handle: null as string | null,
  }));

  const presenceDetails = bizMapped.length > 0
    ? await db.select({
        id: businesses.id,
        presenceType: businesses.presenceType,
        creatorType: businesses.creatorType,
        handle: businesses.handle,
        contentRating: businesses.contentRating,
        zip: businesses.zip,
      }).from(businesses).where(inArray(businesses.id, bizMapped.map(b => b.id)))
    : [];
  const detailMap = new Map(presenceDetails.map(d => [d.id, d]));
  const gatedBizMapped = bizMapped.filter(b => {
    const detail = detailMap.get(b.id);
    if (detail) {
      b.presenceType = detail.presenceType;
      b.creatorType = detail.creatorType || null;
      b.handle = detail.handle || null;
      return isContentAllowedForGate(detail.contentRating, gateLevel);
    }
    return true;
  });

  const allEventIds = eventResponse.results.map(e => e.id);
  const eventDetailMap = new Map<string, { startDateTime: Date | null; contentRating: string; visibility: string; zip: string | null }>();
  if (allEventIds.length > 0) {
    const evtDetails = await db.select({
      id: events.id,
      startDateTime: events.startDateTime,
      contentRating: events.contentRating,
      visibility: events.visibility,
      zip: events.zip,
    }).from(events).where(inArray(events.id, allEventIds));
    for (const d of evtDetails) eventDetailMap.set(d.id, {
      startDateTime: d.startDateTime,
      contentRating: d.contentRating,
      visibility: d.visibility,
      zip: d.zip,
    });
  }

  const gatedEvents = eventResponse.results.filter(e => {
    const detail = eventDetailMap.get(e.id);
    if (!detail) return true;
    if (detail.visibility === "private") return false;
    return isContentAllowedForGate(detail.contentRating, gateLevel);
  });

  const allArticleIds = articleResponse.results.map(a => a.id);
  const articleDetailMap = new Map<string, { contentRating: string }>();
  if (allArticleIds.length > 0) {
    const artDetails = await db.select({
      id: articles.id,
      contentRating: articles.contentRating,
    }).from(articles).where(inArray(articles.id, allArticleIds));
    for (const d of artDetails) articleDetailMap.set(d.id, { contentRating: d.contentRating });
  }

  const gatedArticles = articleResponse.results.filter(a => {
    const detail = articleDetailMap.get(a.id);
    if (!detail) return true;
    return isContentAllowedForGate(detail.contentRating, gateLevel);
  });

  const jobIds = jobResponse.results.slice(0, perTypeLimit).map(j => j.id);
  const jobDetailMap = new Map<string, { employer: string | null; employmentType: string | null; zip: string | null }>();
  if (jobIds.length > 0) {
    const jobDetails = await db.select({ id: jobs.id, employer: jobs.employer, employmentType: jobs.employmentType, zip: jobs.zipCode })
      .from(jobs).where(inArray(jobs.id, jobIds));
    for (const d of jobDetails) jobDetailMap.set(d.id, { employer: d.employer, employmentType: d.employmentType, zip: d.zip });
  }

  const mktIds = mktResponse.results.slice(0, perTypeLimit).map(m => m.id);
  const mktDetailMap = new Map<string, { price: number | null; type: string; zip: string | null }>();
  if (mktIds.length > 0) {
    const mktDetails = await db.select({ id: marketplaceListings.id, price: marketplaceListings.price, type: marketplaceListings.type, zip: marketplaceListings.addressZip })
      .from(marketplaceListings).where(inArray(marketplaceListings.id, mktIds));
    for (const d of mktDetails) mktDetailMap.set(d.id, { price: d.price, type: d.type, zip: d.zip });
  }

  let hubZips: string[] = [];
  let hubGeoTaggedIds = new Set<string>();
  if (hubSlug) {
    try {
      const [hubRegion] = await db.select().from(regions)
        .where(and(sql`UPPER(${regions.code}) = UPPER(${hubSlug})`, eq(regions.regionType, "hub")))
        .limit(1);
      if (hubRegion) {
        const coverage = await db.select().from(hubZipCoverage).where(eq(hubZipCoverage.hubRegionId, hubRegion.id));
        hubZips = coverage.map(c => c.zip);
      }
    } catch {}
    try {
      const hubSlugLower = hubSlug.toLowerCase();
      const [geoTag] = await db.select().from(tags).where(and(sql`LOWER(${tags.slug}) = ${hubSlugLower}`, eq(tags.type, "location")));
      if (geoTag) {
        const descRows = await db.select({ id: tags.id }).from(tags).where(eq(tags.parentTagId, geoTag.id));
        const geoTagIds = [geoTag.id, ...descRows.map(d => d.id)];
        const tagged = await db.select({ contentId: contentTags.contentId })
          .from(contentTags).where(inArray(contentTags.tagId, geoTagIds));
        hubGeoTaggedIds = new Set(tagged.map(r => r.contentId));
      }
    } catch {}
  }

  const hubBoostSort = <T extends { id: string }>(items: T[], getZip?: (item: T) => string | null | undefined): T[] => {
    if (hubZips.length === 0 && hubGeoTaggedIds.size === 0) return items;
    const inHub: T[] = [];
    const notInHub: T[] = [];
    for (const item of items) {
      const zip = getZip ? getZip(item) : null;
      if ((zip && hubZips.includes(zip)) || hubGeoTaggedIds.has(item.id)) inHub.push(item);
      else notInHub.push(item);
    }
    return [...inHub, ...notInHub];
  };

  const [rssResults, curatedResults, digestResults] = await Promise.all([
    q ? db.select({
      id: rssItems.id,
      title: rssItems.title,
      slug: rssItems.localArticleSlug,
      imageUrl: rssItems.imageUrl,
      sourceName: rssItems.sourceName,
    }).from(rssItems).where(
      and(eq(rssItems.cityId, metroId), eq(rssItems.reviewStatus, "APPROVED"),
        sql`(${ilike(rssItems.title, `%${q}%`)} OR ${ilike(rssItems.rewrittenSummary, `%${q}%`)})`)
    ).orderBy(desc(rssItems.publishedAt)).limit(perTypeLimit).catch(() => []) : Promise.resolve([]),
    q ? db.select({
      id: curatedLists.id,
      title: curatedLists.title,
      slug: curatedLists.slug,
      imageUrl: curatedLists.imageUrl,
      type: curatedLists.type,
    }).from(curatedLists).where(
      and(eq(curatedLists.cityId, metroId),
        sql`(${ilike(curatedLists.title, `%${q}%`)} OR ${ilike(curatedLists.description, `%${q}%`)})`)
    ).limit(perTypeLimit).catch(() => []) : Promise.resolve([]),
    q ? db.select({
      id: digests.id,
      title: digests.title,
      slug: digests.slug,
      publishedAt: digests.publishedAt,
    }).from(digests).where(
      and(eq(digests.cityId, metroId), eq(digests.digestStatus, "published"),
        sql`(${ilike(digests.title, `%${q}%`)} OR ${ilike(digests.topic, `%${q}%`)})`)
    ).orderBy(desc(digests.publishedAt)).limit(perTypeLimit).catch(() => []) : Promise.resolve([]),
  ]);

  const boostedBiz = hubBoostSort(gatedBizMapped, (b) => detailMap.get(b.id)?.zip);
  const boostedEvents = hubBoostSort(gatedEvents, (e) => eventDetailMap.get(e.id)?.zip);
  const boostedArticles = hubBoostSort(gatedArticles);
  const boostedJobs = hubBoostSort(jobResponse.results.slice(0, perTypeLimit), (j) => jobDetailMap.get(j.id)?.zip);
  const boostedAttractions = hubBoostSort(attrResponse.results.slice(0, perTypeLimit));
  const boostedMarketplace = hubBoostSort(mktResponse.results.slice(0, perTypeLimit), (m) => mktDetailMap.get(m.id)?.zip);

  return {
    businesses: boostedBiz.slice(0, perTypeLimit),
    events: boostedEvents.slice(0, perTypeLimit).map(e => {
      const detail = eventDetailMap.get(e.id);
      return {
        id: e.id,
        title: e.name,
        slug: e.slug,
        imageUrl: e.imageUrl,
        startDateTime: detail?.startDateTime || null,
      };
    }),
    articles: boostedArticles.slice(0, perTypeLimit).map(a => ({
      id: a.id,
      title: a.name,
      slug: a.slug,
      imageUrl: a.imageUrl,
    })),
    jobs: boostedJobs.map(j => {
      const detail = jobDetailMap.get(j.id);
      return {
        id: j.id,
        title: j.name,
        slug: j.slug,
        employer: detail?.employer || null,
        employmentType: detail?.employmentType || j.category,
      };
    }),
    attractions: boostedAttractions.map(a => ({
      id: a.id,
      name: a.name,
      slug: a.slug,
      imageUrl: a.imageUrl,
      attractionType: a.category || "attraction",
    })),
    marketplace: boostedMarketplace.map(m => {
      const detail = mktDetailMap.get(m.id);
      return {
        id: m.id,
        title: m.name,
        imageUrl: m.imageUrl,
        type: detail?.type || m.category || "item",
        price: detail?.price ?? null,
      };
    }),
    rssNews: hubBoostSort(rssResults).map(r => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      imageUrl: r.imageUrl,
      sourceName: r.sourceName,
    })),
    curatedLists: hubBoostSort(curatedResults).map(c => ({
      id: c.id,
      title: c.title,
      slug: c.slug,
      imageUrl: c.imageUrl,
      type: c.type,
    })),
    digests: hubBoostSort(digestResults).map(d => ({
      id: d.id,
      title: d.title,
      slug: d.slug,
      publishedAt: d.publishedAt,
    })),
    locationMatch: locationMatch ? {
      type: locationMatch.type,
      name: locationMatch.name,
      slug: locationMatch.slug,
    } : null,
  };
}

function buildFollowOnSuggestions(domain: ConciergeDomain, resultCount: number): string[] {
  const suggestions: string[] = [];

  if (resultCount === 0) {
    suggestions.push("Try broadening your search area");
    suggestions.push("Check a different neighborhood");
    return suggestions;
  }

  switch (domain) {
    case "dining":
      suggestions.push("View menus and make reservations");
      suggestions.push("Explore other neighborhoods");
      suggestions.push("Read local stories about these spots");
      break;
    case "services":
      suggestions.push("Contact a provider directly");
      suggestions.push("Compare services in your area");
      break;
    case "events":
      suggestions.push("Submit your own event");
      suggestions.push("Set up event alerts");
      break;
    case "housing":
      suggestions.push("Browse available properties");
      suggestions.push("Connect with local agents");
      suggestions.push("Explore neighborhoods by activity");
      break;
    case "marketplace":
      suggestions.push("Post your own listing");
      suggestions.push("Browse by category");
      break;
    case "jobs":
      suggestions.push("Set up a job alert");
      suggestions.push("Post a job opening");
      break;
    default:
      suggestions.push("Explore more options nearby");
      suggestions.push("View profiles for details");
  }

  return suggestions;
}

export async function resolveLocationFromText(
  text: string,
  metroId: string
): Promise<GeoFilter | null> {
  try {
    const detection = await detectLocation(text, metroId);
    if (detection.locationMatch) {
      const match = detection.locationMatch;
      if (match.type === "zone") {
        return { type: "zone", zoneSlug: match.slug };
      }
      if (match.type === "hub") {
        return { type: "hub", hubCode: match.slug };
      }
    }
  } catch (_) {}
  return null;
}

export function getDomainFromQuery(text: string): ConciergeDomain {
  const lower = text.toLowerCase();

  if (/brunch|dinner|lunch|restaurant|eat|food|cafe|coffee|bar|brewery|pizza|sushi|taco|bbq|wings/.test(lower)) return "dining";
  if (/job|career|hiring|employment|work|volunteer|internship/.test(lower)) return "jobs";
  if (/event|concert|festival|show|meetup|workshop|class/.test(lower)) return "events";
  if (/house|apartment|rent|lease|real estate|housing|home|condo|townhome|relocat|move to|where.*live|neighborhood|area.*famil/.test(lower)) return "housing";
  if (/shop|store|boutique|gift|retail|mall/.test(lower)) return "shopping";
  if (/plumber|lawyer|doctor|dentist|mechanic|salon|spa|gym|fitness|service|repair/.test(lower)) return "services";
  if (/sell|buy|marketplace|for sale|trade|free stuff/.test(lower)) return "marketplace";
  if (/creator|artist|photographer|musician|videographer|designer/.test(lower)) return "creators";
  if (/expert|consultant|coach|advisor|specialist/.test(lower)) return "experts";
  if (/things to do|attraction|park|museum|zoo|garden|trail|hike|activity/.test(lower)) return "things-to-do";

  return "general";
}

export interface ResolvedActionRoute {
  action: string;
  route: string | null;
  label: string;
}

export function resolveActionRoute(
  action: string,
  entity: { id: string; slug?: string; entityType: string; latitude?: number; longitude?: number },
  citySlug: string
): ResolvedActionRoute {
  const slug = entity.slug || entity.id;

  const routeMap: Record<string, () => ResolvedActionRoute> = {
    view_profile: () => ({
      action,
      route: entity.entityType === "business" ? `/${citySlug}/biz/${slug}` : null,
      label: "View Profile",
    }),
    read_story: () => ({
      action,
      route: entity.entityType === "business" ? `/${citySlug}/biz/${slug}#story` : null,
      label: "Read Their Story",
    }),
    view_map: () => ({
      action,
      route: entity.latitude && entity.longitude
        ? `/${citySlug}/map?lat=${entity.latitude}&lng=${entity.longitude}`
        : `/${citySlug}/map`,
      label: "View on Map",
    }),
    view_on_map: () => ({
      action,
      route: entity.latitude && entity.longitude
        ? `/${citySlug}/map?lat=${entity.latitude}&lng=${entity.longitude}`
        : `/${citySlug}/map`,
      label: "View on Map",
    }),
    connect_to_booking: () => ({
      action,
      route: entity.entityType === "business" ? `/${citySlug}/biz/${slug}#booking` : null,
      label: "Book Appointment",
    }),
    schedule_with_becky: () => ({
      action,
      route: null,
      label: "Schedule via Becky",
    }),
    start_claim: () => ({
      action,
      route: `/${citySlug}/activate?businessId=${entity.id}`,
      label: "Claim This Listing",
    }),
    make_reservation: () => ({
      action,
      route: entity.entityType === "business" ? `/${citySlug}/biz/${slug}#booking` : null,
      label: "Make Reservation",
    }),
    book_appointment: () => ({
      action,
      route: entity.entityType === "business" ? `/${citySlug}/biz/${slug}#booking` : null,
      label: "Book Appointment",
    }),
    contact: () => ({
      action,
      route: entity.entityType === "business" ? `/${citySlug}/biz/${slug}#contact` : null,
      label: "Contact",
    }),
    view_details: () => ({
      action,
      route: entity.entityType === "event" ? `/${citySlug}/events/${entity.id}` : `/${citySlug}/biz/${slug}`,
      label: "View Details",
    }),
    apply: () => ({
      action,
      route: `/${citySlug}/jobs/${entity.id}`,
      label: "Apply Now",
    }),
    view_listing: () => ({
      action,
      route: `/${citySlug}/marketplace/${entity.id}`,
      label: "View Listing",
    }),
    rsvp: () => ({
      action,
      route: `/${citySlug}/events/${entity.id}`,
      label: "RSVP",
    }),
    schedule_tour: () => ({
      action,
      route: entity.entityType === "business" ? `/${citySlug}/biz/${slug}#booking` : null,
      label: "Schedule Tour",
    }),
    save_job: () => ({
      action,
      route: `/${citySlug}/jobs/${entity.id}`,
      label: "Save Job",
    }),
    set_alert: () => ({
      action,
      route: null,
      label: "Set Alert",
    }),
    add_to_calendar: () => ({
      action,
      route: `/${citySlug}/events/${entity.id}`,
      label: "Add to Calendar",
    }),
    share: () => ({
      action,
      route: null,
      label: "Share",
    }),
    contact_seller: () => ({
      action,
      route: `/${citySlug}/marketplace/${entity.id}`,
      label: "Contact Seller",
    }),
    save: () => ({
      action,
      route: null,
      label: "Save",
    }),
    view_menu: () => ({
      action,
      route: entity.entityType === "business" ? `/${citySlug}/biz/${slug}` : null,
      label: "View Menu",
    }),
    shop_online: () => ({
      action,
      route: entity.entityType === "business" ? `/${citySlug}/biz/${slug}` : null,
      label: "Shop Online",
    }),
    book: () => ({
      action,
      route: entity.entityType === "business" ? `/${citySlug}/biz/${slug}#booking` : null,
      label: "Book",
    }),
    view_portfolio: () => ({
      action,
      route: entity.entityType === "business" ? `/${citySlug}/biz/${slug}` : null,
      label: "View Portfolio",
    }),
    book_consultation: () => ({
      action,
      route: entity.entityType === "business" ? `/${citySlug}/biz/${slug}#booking` : null,
      label: "Book Consultation",
    }),
    get_directions: () => ({
      action,
      route: entity.latitude && entity.longitude
        ? `https://maps.google.com/maps?daddr=${entity.latitude},${entity.longitude}`
        : null,
      label: "Get Directions",
    }),
  };

  const resolver = routeMap[action];
  if (resolver) return resolver();

  return { action, route: null, label: action.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) };
}
