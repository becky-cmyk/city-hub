import { RANKING_CONFIG, type SurfaceType, type GeoContext, type ScoredFeedItem } from "./feed-ranking-config";
import { db } from "../db";
import { intelligenceEventLog } from "@shared/schema";
import { sql, inArray, and } from "drizzle-orm";

function computeGeoTierWeight(item: ScoredFeedItem, ctx: GeoContext): { weight: number; reason: string } {
  const meta = item.geoMeta;
  if (!meta) return { weight: RANKING_CONFIG.geo.cityWide, reason: "City-wide (no geo)" };

  const itemPrimary = meta.geoPrimarySlug?.toLowerCase();
  const itemSecondary = meta.geoSecondarySlug?.toLowerCase();
  const itemHub = meta.hubSlug?.toLowerCase();
  const itemCounty = meta.countySlug?.toLowerCase();

  const ctxPrimary = ctx.geoPrimarySlug?.toLowerCase();
  const ctxHub = ctx.hubSlug?.toLowerCase();
  const ctxCounty = ctx.countySlug?.toLowerCase();

  if (ctxPrimary && itemPrimary === ctxPrimary) {
    return { weight: RANKING_CONFIG.geo.tier1_primaryMatch, reason: `Primary geo: ${itemPrimary}` };
  }

  if (ctxPrimary && itemSecondary === ctxPrimary) {
    return { weight: RANKING_CONFIG.geo.tier2_secondaryMatch, reason: `Secondary geo: ${itemSecondary}` };
  }

  if (ctxHub && itemHub === ctxHub) {
    return { weight: RANKING_CONFIG.geo.tier3_hubMatch, reason: `Hub: ${itemHub}` };
  }

  if (ctxHub && itemPrimary === ctxHub) {
    return { weight: RANKING_CONFIG.geo.tier3_hubMatch, reason: `Hub via primary: ${itemPrimary}` };
  }

  if (ctxCounty && itemCounty === ctxCounty) {
    return { weight: RANKING_CONFIG.geo.tier4_countyMatch, reason: `County: ${itemCounty}` };
  }

  if (!itemPrimary && !itemHub && !itemSecondary && !itemCounty) {
    return { weight: RANKING_CONFIG.geo.cityWide, reason: "City-wide (no geo)" };
  }

  return { weight: RANKING_CONFIG.geo.tier5_metro, reason: "Metro (different area)" };
}

function computeRecencyScore(item: ScoredFeedItem): number {
  if (!item.createdAt) return RANKING_CONFIG.recency.floorBonus;

  const itemDate = new Date(item.createdAt).getTime();
  const now = Date.now();
  const effectiveDate = Math.min(itemDate, now);
  const ageMs = now - effectiveDate;

  const ageHours = ageMs / (1000 * 60 * 60);
  const halfLife = RANKING_CONFIG.recency.halfLifeHours;
  const decay = Math.pow(0.5, ageHours / halfLife);

  return Math.max(
    RANKING_CONFIG.recency.floorBonus,
    RANKING_CONFIG.recency.maxBonus * decay
  );
}

function computeArticleBoost(item: ScoredFeedItem): number {
  if (item.type === "rss") return RANKING_CONFIG.articleBoost;
  return 0;
}

function computeEventBoost(item: ScoredFeedItem): number {
  if (item.type === "rss") return 0;
  if (item.type !== "event" || !item.startDate) return 0;

  const now = new Date();
  const startDate = new Date(item.startDate);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  if (startDate >= now && startDate <= todayEnd) {
    return RANKING_CONFIG.eventBoost.happeningToday;
  }

  const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (startDate >= now && startDate <= sevenDays) {
    return RANKING_CONFIG.eventBoost.next7Days;
  }

  return 0;
}

function computeTierBoost(item: ScoredFeedItem): number {
  if (item.sponsorshipMeta?.tier === "ENHANCED") {
    return RANKING_CONFIG.tierBoost.enhanced;
  }
  return 0;
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function computeRotationJitter(item: ScoredFeedItem): number {
  const { bucketHours, maxJitter } = RANKING_CONFIG.rotation;
  const timeBucket = Math.floor(Date.now() / (bucketHours * 60 * 60 * 1000));
  const seed = simpleHash(`${item.id}:${timeBucket}`);
  return (seed % (maxJitter * 100)) / 100;
}

function computeEngagementBoost(item: ScoredFeedItem): number {
  const score = item.engagementScore || 0;
  if (score <= 0) return 0;
  const cfg = RANKING_CONFIG.engagement;
  const logScore = Math.log(1 + score) / Math.log(cfg.logScaleBase);
  return Math.min(cfg.maxBonus, logScore * (cfg.maxBonus / 3));
}

function computeImpressionPenalty(item: ScoredFeedItem): number {
  const impressions = item.impressionCount || 0;
  if (impressions <= 0) return 0;
  const cfg = RANKING_CONFIG.impressionDecay;
  const decayFactor = 1 - Math.pow(0.5, impressions / cfg.halfLifeImpressions);
  return cfg.maxPenalty * decayFactor;
}

const WITHIN_TIER_MAX = RANKING_CONFIG.recency.maxBonus +
  RANKING_CONFIG.rotation.maxJitter +
  RANKING_CONFIG.eventBoost.happeningToday +
  RANKING_CONFIG.articleBoost +
  RANKING_CONFIG.tierBoost.enhanced +
  RANKING_CONFIG.engagement.maxBonus + 1;

export function computeItemScore(
  item: ScoredFeedItem,
  geoCtx: GeoContext,
  surface: SurfaceType = "default"
): number {
  const weights = RANKING_CONFIG.surfaceWeights[surface] || RANKING_CONFIG.surfaceWeights.default;

  const { weight: geoWeight, reason: geoReason } = computeGeoTierWeight(item, geoCtx);
  const recencyScore = computeRecencyScore(item);
  const eventBoost = computeEventBoost(item);
  const articleBoost = computeArticleBoost(item);
  const tierBoost = computeTierBoost(item);
  const jitter = computeRotationJitter(item);
  const engagementBoost = computeEngagementBoost(item);
  const impressionPenalty = computeImpressionPenalty(item);

  const geoBand = geoWeight * weights.geo * WITHIN_TIER_MAX;
  const withinBandScore =
    (recencyScore * weights.recency) +
    eventBoost +
    articleBoost +
    tierBoost +
    jitter +
    engagementBoost -
    impressionPenalty;

  const total = geoBand + Math.min(Math.max(withinBandScore, 0), WITHIN_TIER_MAX - 1);

  if (geoReason && !item.whyShown.includes("Geo:")) {
    item.whyShown += ` | Geo: ${geoReason}`;
  }

  return Math.round(total * 100) / 100;
}

export async function hydrateEngagementSignals(items: ScoredFeedItem[]): Promise<void> {
  if (items.length === 0) return;

  const ids = items.map(i => i.id);
  const cfg = RANKING_CONFIG.engagement;
  const impressionCfg = RANKING_CONFIG.impressionDecay;
  const engLookback = new Date(Date.now() - cfg.lookbackDays * 24 * 60 * 60 * 1000);
  const viewLookback = new Date(Date.now() - impressionCfg.lookbackDays * 24 * 60 * 60 * 1000);
  const earlierDate = engLookback < viewLookback ? engLookback : viewLookback;
  const eventTypes = ["FEED_CARD_TAP", "FEED_CARD_LIKE", "FEED_CARD_SAVE", "FEED_CARD_SHARE", "FEED_CARD_VIEW"];

  try {
    const rows = await db.select({
      entityId: intelligenceEventLog.entityId,
      eventType: intelligenceEventLog.eventType,
      total: sql<number>`count(*)`,
    }).from(intelligenceEventLog).where(
      and(
        inArray(intelligenceEventLog.entityId, ids),
        sql`${intelligenceEventLog.createdAt} >= ${earlierDate}`,
        inArray(intelligenceEventLog.eventType, eventTypes),
      )
    ).groupBy(intelligenceEventLog.entityId, intelligenceEventLog.eventType);

    const engMap = new Map<string, number>();
    const viewMap = new Map<string, number>();

    for (const row of rows) {
      const id = row.entityId;
      const count = Number(row.total);
      if (row.eventType === "FEED_CARD_VIEW") {
        viewMap.set(id, (viewMap.get(id) || 0) + count);
      } else {
        let weight = cfg.tapWeight;
        if (row.eventType === "FEED_CARD_LIKE") weight = cfg.likeWeight;
        else if (row.eventType === "FEED_CARD_SAVE") weight = cfg.saveWeight;
        else if (row.eventType === "FEED_CARD_SHARE") weight = cfg.shareWeight;
        engMap.set(id, (engMap.get(id) || 0) + count * weight);
      }
    }

    for (const item of items) {
      item.engagementScore = engMap.get(item.id) || 0;
      item.impressionCount = viewMap.get(item.id) || 0;
    }
  } catch (err) {
    for (const item of items) {
      item.engagementScore = 0;
      item.impressionCount = 0;
    }
  }
}

export function rankWithScoring(
  items: ScoredFeedItem[],
  geoCtx: GeoContext,
  surface: SurfaceType = "default"
): ScoredFeedItem[] {
  for (const item of items) {
    item.priorityScore = computeItemScore(item, geoCtx, surface);
  }

  items.sort((a, b) => b.priorityScore - a.priorityScore);

  return items;
}

import { titleWords, jaccardSimilarity } from "./text-similarity";

export function applyDiversityReranking<T extends ScoredFeedItem>(
  items: T[],
  surface: SurfaceType = "default"
): T[] {
  if (items.length <= 2) return items;

  const maxTypeRun = RANKING_CONFIG.diversity.contentTypeMaxConsecutive;
  const maxCatRun = RANKING_CONFIG.diversity.categoryMaxConsecutive;
  const dupThreshold = RANKING_CONFIG.diversity.nearDuplicateTitleThreshold;
  const sourceMaxPerWindow = RANKING_CONFIG.diversity.sourceMaxPerWindow;
  const sourceWindowSize = RANKING_CONFIG.diversity.sourceWindowSize;
  const minDistinctCats = RANKING_CONFIG.diversity.minDistinctCategoriesFirst10;
  const sourceTopSlotMax = RANKING_CONFIG.diversity.sourceTopSlotMax;
  const sourceTopSlotWindow = RANKING_CONFIG.diversity.sourceTopSlotWindow;

  const result: T[] = [];
  const remaining = [...items];
  const usedIndices = new Set<number>();

  function getSourceName(item: ScoredFeedItem): string {
    return (item.sourceName as string) || "";
  }

  function getCategory(item: ScoredFeedItem): string {
    return item.geoMeta?.categoryCoreSlug || item.primaryTag?.slug || "";
  }

  function sourceCountInWindow(src: string): number {
    if (!src) return 0;
    const windowStart = Math.max(0, result.length - sourceWindowSize);
    let c = 0;
    for (let j = windowStart; j < result.length; j++) {
      if (getSourceName(result[j]) === src) c++;
    }
    return c;
  }

  function sourceCountInTopSlots(src: string): number {
    if (!src) return 0;
    const limit = Math.min(result.length, sourceTopSlotWindow);
    let c = 0;
    for (let j = 0; j < limit; j++) {
      if (getSourceName(result[j]) === src) c++;
    }
    return c;
  }

  function distinctCategoriesInFirst10(): Set<string> {
    const cats = new Set<string>();
    const limit = Math.min(result.length, 10);
    for (let j = 0; j < limit; j++) {
      const cat = getCategory(result[j]);
      if (cat) cats.add(cat);
    }
    return cats;
  }

  const typeQuota = RANKING_CONFIG.typeQuota || {};

  function typeCountInTopN(type: string, topN: number): number {
    const limit = Math.min(result.length, topN);
    let c = 0;
    for (let j = 0; j < limit; j++) {
      if (result[j].type === type) c++;
    }
    return c;
  }

  function pickNext(): number {
    const needsCategoryDiversity = result.length < 10 && result.length >= 3;
    let bestCategoryDiversityIdx = -1;

    for (let i = 0; i < remaining.length; i++) {
      if (usedIndices.has(i)) continue;
      const candidate = remaining[i];

      const quota = typeQuota[candidate.type as keyof typeof typeQuota];
      if (quota && result.length < quota.topN) {
        if (typeCountInTopN(candidate.type, quota.topN) >= quota.maxInTopN) continue;
      }

      let typeRunCount = 0;
      for (let j = result.length - 1; j >= 0 && j >= result.length - maxTypeRun; j--) {
        if (result[j].type === candidate.type) typeRunCount++;
        else break;
      }
      if (typeRunCount >= maxTypeRun) continue;

      const candidateCat = getCategory(candidate);
      let catRunCount = 0;
      for (let j = result.length - 1; j >= 0 && j >= result.length - maxCatRun; j--) {
        const prevCat = getCategory(result[j]);
        if (prevCat === candidateCat && candidateCat !== "") catRunCount++;
        else break;
      }
      if (catRunCount >= maxCatRun) continue;

      const candidateSource = getSourceName(candidate);
      if (candidateSource && sourceCountInWindow(candidateSource) >= sourceMaxPerWindow) continue;

      if (result.length < sourceTopSlotWindow && candidateSource) {
        if (sourceCountInTopSlots(candidateSource) >= sourceTopSlotMax) continue;
      }

      if (surface === "pulse" && result.length > 0) {
        const lastTitle = result[result.length - 1].title;
        const sim = jaccardSimilarity(titleWords(lastTitle), titleWords(candidate.title));
        if (sim >= dupThreshold) continue;
      }

      if (needsCategoryDiversity && candidateCat) {
        const existingCats = distinctCategoriesInFirst10();
        if (!existingCats.has(candidateCat) && existingCats.size < minDistinctCats) {
          return i;
        }
        if (bestCategoryDiversityIdx === -1) bestCategoryDiversityIdx = i;
        if (!existingCats.has(candidateCat)) return i;
        continue;
      }

      return i;
    }

    if (bestCategoryDiversityIdx !== -1) return bestCategoryDiversityIdx;

    for (let i = 0; i < remaining.length; i++) {
      if (usedIndices.has(i)) continue;
      const candidate = remaining[i];

      const quota2 = typeQuota[candidate.type as keyof typeof typeQuota];
      if (quota2 && result.length < quota2.topN) {
        if (typeCountInTopN(candidate.type, quota2.topN) >= quota2.maxInTopN) continue;
      }

      const candidateSource = getSourceName(candidate);
      if (candidateSource && sourceCountInWindow(candidateSource) >= sourceMaxPerWindow) continue;

      let typeRunCount = 0;
      for (let j = result.length - 1; j >= 0 && j >= result.length - maxTypeRun; j--) {
        if (result[j].type === candidate.type) typeRunCount++;
        else break;
      }
      if (typeRunCount >= maxTypeRun) continue;

      const candidateCat = getCategory(candidate);
      let catRunCount = 0;
      for (let j = result.length - 1; j >= 0 && j >= result.length - maxCatRun; j--) {
        const prevCat = getCategory(result[j]);
        if (prevCat === candidateCat && candidateCat !== "") catRunCount++;
        else break;
      }
      if (catRunCount >= maxCatRun) continue;

      if (surface === "pulse" && result.length > 0) {
        const lastTitle = result[result.length - 1].title;
        const sim = jaccardSimilarity(titleWords(lastTitle), titleWords(candidate.title));
        if (sim >= dupThreshold) continue;
      }

      return i;
    }

    for (let i = 0; i < remaining.length; i++) {
      if (usedIndices.has(i)) continue;
      const candidate = remaining[i];
      const quota3 = typeQuota[candidate.type as keyof typeof typeQuota];
      if (quota3 && result.length < quota3.topN) {
        if (typeCountInTopN(candidate.type, quota3.topN) >= quota3.maxInTopN) continue;
      }
      return i;
    }
    return -1;
  }

  while (result.length < items.length) {
    const idx = pickNext();
    if (idx === -1) break;
    usedIndices.add(idx);
    result.push(remaining[idx]);
  }

  return result;
}

export function enforceTop20SourceCap<T extends ScoredFeedItem>(items: T[]): T[] {
  const maxPerSource = RANKING_CONFIG.diversity.sourceMaxPerWindow;
  const windowSize = Math.min(items.length, RANKING_CONFIG.diversity.sourceWindowSize);

  const sourceCounts = new Map<string, number>();
  const kept: T[] = [];
  const displaced: T[] = [];

  for (let i = 0; i < windowSize; i++) {
    const src = items[i].sourceName || "";
    const count = sourceCounts.get(src) || 0;
    if (src && count >= maxPerSource) {
      displaced.push(items[i]);
    } else {
      if (src) sourceCounts.set(src, count + 1);
      kept.push(items[i]);
    }
  }

  const rest = items.slice(windowSize);
  const slotsNeeded = windowSize - kept.length;
  const substitutes: T[] = [];
  const remainAfterSub: T[] = [];

  for (const item of rest) {
    if (substitutes.length < slotsNeeded) {
      const src = item.sourceName || "";
      const count = sourceCounts.get(src) || 0;
      if (!src || count < maxPerSource) {
        if (src) sourceCounts.set(src, count + 1);
        substitutes.push(item);
        continue;
      }
    }
    remainAfterSub.push(item);
  }

  const top = [...kept, ...substitutes];
  if (top.length < windowSize) {
    const needed = windowSize - top.length;
    top.push(...displaced.splice(0, needed));
  }

  return [...top, ...displaced, ...remainAfterSub];
}
