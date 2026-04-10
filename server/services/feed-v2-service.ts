import crypto from "crypto";
import { db } from "../db";
import { eq, and, desc, sql, inArray, count } from "drizzle-orm";
import {
  businesses, events, articles, marketplaceListings, rssItems, posts,
  shopItems, shopDrops, contentTags, tags, zones, regions, likes,
  attractions, curatedLists, digests, jobs, cmsContentItems, videoContent, areaFacts,
  localPodcasts, localPodcastEpisodes, pulseVideos,
  crownCategories, crownParticipants, hubZipCoverage, categories,
  type Tag,
} from "@shared/schema";
import { storage } from "../storage";
import {
  type FeedItem,
  projectBusiness, projectEvent, projectArticle, projectMarketplaceListing,
  projectPost, projectShopItem, projectShopDrop, projectAttraction,
  projectCuratedList, projectDigest, projectJob, projectVolunteer,
  projectCmsPage, projectRssItem, projectVideoContent, projectPodcastContent,
  projectLocalPodcastEpisode, projectPulseVideo, projectEnhancedListing,
  projectSponsored, projectCrownWinner, projectCrownCategory, projectLiveStream,
  isFaithBusiness, getFaithCategoryIds, isNegativeContent,
  deduplicateItems, hydrateEngagementCounts, fetchCrownFeedItems,
  getApprovedReposts, getSponsoredBusinesses, getEnhancedListingCards,
  fetchAreaFacts, resolveGeoContext, buildTagMap, getDescendantTagIds,
  getContentIdsByTags,
} from "./feed-service";
import { rankWithScoring, applyDiversityReranking, hydrateEngagementSignals } from "./feed-scoring-engine";
import { RANKING_CONFIG, type SurfaceType, type GeoContext as RankingGeoContext } from "./feed-ranking-config";
import {
  createFeedSession,
  getFeedSession,
  type FeedSession,
  type GeoContext,
  FEED_CAP_CONFIG,
} from "./feed-session";

import { titleWords, jaccardSimilarity } from "./text-similarity";

const CROSS_TYPE_DEDUP_THRESHOLD = 0.75;

function applyCrossTypeDedup(items: FeedItem[]): FeedItem[] {
  if (items.length <= 1) return items;
  const suppressed = new Set<number>();

  for (let i = 0; i < items.length; i++) {
    if (suppressed.has(i)) continue;
    const wordsA = titleWords(items[i].title);
    for (let j = i + 1; j < items.length; j++) {
      if (suppressed.has(j)) continue;
      if (items[i].type === items[j].type) continue;
      const sim = jaccardSimilarity(wordsA, titleWords(items[j].title));
      if (sim >= CROSS_TYPE_DEDUP_THRESHOLD) {
        const aHasBody = !!(items[i] as Record<string, unknown>).articleBody;
        const bHasBody = !!(items[j] as Record<string, unknown>).articleBody;
        if (aHasBody && !bHasBody) {
          suppressed.add(j);
        } else if (bHasBody && !aHasBody) {
          suppressed.add(i);
          break;
        } else {
          suppressed.add(j);
        }
      }
    }
  }

  return items.filter((_, idx) => !suppressed.has(idx));
}

interface FeedV2Cursor {
  t: number;
  s: string[];
  n: number;
}

export interface FeedV2Options {
  cityId: string;
  citySlug: string;
  geoTagSlug?: string;
  topicTagSlug?: string;
  userHubSlug?: string;
  context?: "trending" | "nearby" | "new" | "weekend" | "foryou";
  surface?: "pulse" | "hub" | "category" | "default";
  limit: number;
  cursor?: string;
  feedSessionId?: string;
  locale?: string;
}

export interface FeedV2Result {
  items: FeedItem[];
  cursor: string | null;
  hasMore: boolean;
  feedSessionId: string;
  total: number;
  limit: number;
  page: number;
  activeFilters: {
    geoTag: string | null;
    topicTag: string | null;
    context: string;
  };
  locale: string;
  geoContext: string;
}

const PROVIDER_BATCH = 40;
const MAX_SEEN_IDS = 400;

const CURSOR_SECRET = process.env.FEED_CURSOR_SECRET || crypto.randomBytes(32).toString("hex");

function signPayload(payload: string): string {
  return crypto.createHmac("sha256", CURSOR_SECRET).update(payload).digest("base64url");
}

function encodeCursor(cursor: FeedV2Cursor): string {
  const payload = Buffer.from(JSON.stringify(cursor)).toString("base64url");
  const sig = signPayload(payload);
  return `${payload}.${sig}`;
}

function decodeCursor(token: string): FeedV2Cursor | null {
  try {
    const dotIdx = token.lastIndexOf(".");
    if (dotIdx < 1) return null;
    const payload = token.substring(0, dotIdx);
    const sig = token.substring(dotIdx + 1);
    const expected = signPayload(payload);
    if (sig !== expected) return null;
    const json = Buffer.from(payload, "base64url").toString("utf-8");
    const parsed = JSON.parse(json);
    if (typeof parsed.t !== "number" || !Array.isArray(parsed.s)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function resolveZoneTiers(
  geoTagSlug: string,
  cityId: string,
): Promise<{
  tier1Slugs: string[];
  tier2Slugs: string[];
  countyCode: string | null;
}> {
  const slugLower = geoTagSlug.toLowerCase();

  const [hub] = await db
    .select({ id: regions.id, code: regions.code, parentRegionId: regions.parentRegionId })
    .from(regions)
    .where(
      and(
        sql`(LOWER(${regions.code}) = ${slugLower} OR LOWER(REPLACE(${regions.name}, ' ', '')) = LOWER(REPLACE(${slugLower}, '-', '')))`,
        eq(regions.regionType, "hub"),
        eq(regions.isActive, true),
      ),
    )
    .limit(1);

  if (!hub) {
    return { tier1Slugs: [slugLower], tier2Slugs: [], countyCode: null };
  }

  const tier1Slugs = [hub.code?.toLowerCase() || slugLower];
  let countyCode: string | null = null;
  const tier2Slugs: string[] = [];

  if (hub.parentRegionId) {
    const [county] = await db
      .select({ code: regions.code })
      .from(regions)
      .where(eq(regions.id, hub.parentRegionId))
      .limit(1);
    countyCode = county?.code?.toLowerCase() || null;

    const siblings = await db
      .select({ code: regions.code })
      .from(regions)
      .where(
        and(
          eq(regions.parentRegionId, hub.parentRegionId),
          eq(regions.regionType, "hub"),
          eq(regions.isActive, true),
          sql`${regions.id} != ${hub.id}`,
        ),
      );
    for (const s of siblings) {
      if (s.code) tier2Slugs.push(s.code.toLowerCase());
    }
  }

  return { tier1Slugs, tier2Slugs, countyCode };
}

function buildGeoRssFilter(
  geoTagSlug: string | undefined,
  tier1Slugs: string[],
  tier2Slugs: string[],
  countyCode: string | null,
): ReturnType<typeof sql> {
  if (!geoTagSlug) return sql`1=1`;

  const allSlugs = [...tier1Slugs, ...tier2Slugs];
  if (countyCode) allSlugs.push(countyCode);

  if (allSlugs.length === 0) return sql`1=1`;

  const conditions = allSlugs.map(
    (s) => sql`LOWER(${rssItems.geoPrimarySlug}) = ${s} OR LOWER(${rssItems.geoSecondarySlug}) = ${s} OR LOWER(${rssItems.hubSlug}) = ${s} OR LOWER(${rssItems.countySlug}) = ${s}`,
  );
  return sql`(${rssItems.geoPrimarySlug} IS NULL OR ${sql.join(conditions, sql` OR `)})`;
}

const PROVIDER_TIMEOUT_MS = 4000;

async function safeQuery<T>(label: string, fn: () => Promise<T[]>): Promise<T[]> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      fn(),
      new Promise<T[]>((resolve) => {
        timer = setTimeout(() => {
          console.warn(`[FeedV2] ${label} query timed out after ${PROVIDER_TIMEOUT_MS}ms`);
          resolve([]);
        }, PROVIDER_TIMEOUT_MS);
      }),
    ]);
    return result;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[FeedV2] ${label} query failed:`, msg);
    return [];
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function fetchAllProviders(
  cityId: string,
  citySlug: string,
  pageOffset: number,
  excludeIds: Set<string>,
  surface: string,
  geoTagSlug?: string,
  topicTagSlug?: string,
  effectiveHubSlug?: string,
): Promise<FeedItem[]> {
  const items: FeedItem[] = [];
  const faithCatIds = await getFaithCategoryIds();

  let geoBoostIds: Set<string> | null = null;
  let siblingBoostIds: Set<string> | null = null;
  let countyBoostIds: Set<string> | null = null;
  let topicFilterIds: Set<string> | null = null;
  let topicCatIds: Set<string> | null = null;
  let hubZips: string[] = [];
  let hubNameLower = "";
  const activeGeoSlug = geoTagSlug || effectiveHubSlug;

  const contentTypes = ["business", "event", "article", "marketplace_listing", "post", "reel", "shop_item", "shop_drop", "rss_item", "job", "attraction", "curated_list", "digest", "cms_content_item", "video_content", "local_podcast_episode", "pulse_video"];

  if (activeGeoSlug) {
    try {
      const [hubRegion] = await db.select().from(regions)
        .where(and(sql`UPPER(${regions.code}) = UPPER(${activeGeoSlug})`, eq(regions.regionType, "hub")))
        .limit(1);
      if (hubRegion) {
        const coverageRows = await db.select().from(hubZipCoverage).where(eq(hubZipCoverage.hubRegionId, hubRegion.id));
        hubZips = coverageRows.map(r => r.zip);
        hubNameLower = hubRegion.name.toLowerCase();
      }
    } catch {}
  }

  if (activeGeoSlug || topicTagSlug) {
    let geoTagIds: string[] = [];
    let topicTagId: string | null = null;
    if (activeGeoSlug) {
      const slugLower = activeGeoSlug.toLowerCase();
      const [geoTag] = await db.select().from(tags).where(and(sql`LOWER(${tags.slug}) = ${slugLower}`, eq(tags.type, "location")));
      if (geoTag) geoTagIds = await getDescendantTagIds(geoTag.id);
    }
    if (topicTagSlug) {
      const topicLower = topicTagSlug.toLowerCase();
      const [topicTag] = await db.select().from(tags).where(and(sql`LOWER(${tags.slug}) = ${topicLower}`, eq(tags.type, "topic")));
      if (topicTag) topicTagId = topicTag.id;
    }
    if (geoTagIds.length > 0) {
      const geoContentMap = await getContentIdsByTags(geoTagIds, null, contentTypes);
      const geoIds = new Set<string>();
      for (const ids of geoContentMap.values()) for (const id of ids) geoIds.add(id);
      geoBoostIds = geoIds;
    }
    if (topicTagId) {
      const topicContentMap = await getContentIdsByTags([], topicTagId, contentTypes);
      const topicIds = new Set<string>();
      for (const ids of topicContentMap.values()) for (const id of ids) topicIds.add(id);
      topicFilterIds = topicIds;
    }
    if (topicTagSlug) {
      const slugLower = topicTagSlug.toLowerCase();
      const allCats = await db.select().from(categories);
      const matchingCatIds = new Set<string>();
      for (const cat of allCats) {
        if (!cat.parentCategoryId && cat.slug === slugLower) {
          matchingCatIds.add(cat.id);
          for (const child of allCats.filter(c => c.parentCategoryId === cat.id)) {
            matchingCatIds.add(child.id);
            for (const gc of allCats.filter(c => c.parentCategoryId === child.id)) {
              matchingCatIds.add(gc.id);
            }
          }
        }
      }
      if (matchingCatIds.size > 0) topicCatIds = matchingCatIds;
    }
  }

  let zoneTiers = { tier1Slugs: [] as string[], tier2Slugs: [] as string[], countyCode: null as string | null };
  if (activeGeoSlug) {
    zoneTiers = await resolveZoneTiers(activeGeoSlug, cityId);
    try {
      const siblingTagIds: string[] = [];
      for (const sibSlug of zoneTiers.tier2Slugs) {
        const [sibTag] = await db.select().from(tags).where(and(sql`LOWER(${tags.slug}) = LOWER(${sibSlug})`, eq(tags.type, "location")));
        if (sibTag) {
          const sibDescIds = await getDescendantTagIds(sibTag.id);
          siblingTagIds.push(...sibDescIds);
        }
      }
      if (siblingTagIds.length > 0) {
        const sibContentMap = await getContentIdsByTags(siblingTagIds, null, contentTypes);
        const sibIds = new Set<string>();
        for (const ids of sibContentMap.values()) for (const id of ids) sibIds.add(id);
        if (geoBoostIds) for (const id of geoBoostIds) sibIds.delete(id);
        siblingBoostIds = sibIds;
      }
      if (zoneTiers.countyCode) {
        const [countyTag] = await db.select().from(tags).where(and(sql`LOWER(${tags.slug}) = LOWER(${zoneTiers.countyCode})`, eq(tags.type, "location")));
        if (countyTag) {
          const countyDescIds = await getDescendantTagIds(countyTag.id);
          const countyContentMap = await getContentIdsByTags(countyDescIds, null, contentTypes);
          const ctyIds = new Set<string>();
          for (const ids of countyContentMap.values()) for (const id of ids) ctyIds.add(id);
          if (geoBoostIds) for (const id of geoBoostIds) ctyIds.delete(id);
          if (siblingBoostIds) for (const id of siblingBoostIds) ctyIds.delete(id);
          countyBoostIds = ctyIds;
        }
      }
    } catch {}
  }

  const pb = PROVIDER_BATCH;
  const off = pageOffset;

  const [
    bizRows, evtRows, artRows, mlRows, postRows,
    rssRows, jobRows, attractionRows, curatedRows, digestRows,
    pvRows, cmsRows,
  ] = await Promise.all([
    safeQuery("businesses", () => {
      const q = db.select().from(businesses).where(
        and(eq(businesses.cityId, cityId), sql`${businesses.claimStatus} != 'UNCLAIMED'`, sql`${businesses.listingTier} = 'ENHANCED'`),
      ).orderBy(desc(businesses.createdAt)).limit(pb);
      return off > 0 ? q.offset(off) : q;
    }),
    safeQuery("events", () => {
      const q = db.select().from(events).where(
        and(eq(events.cityId, cityId), sql`COALESCE(${events.endDateTime}, ${events.startDateTime}) >= NOW()`),
      ).orderBy(desc(events.startDateTime)).limit(pb);
      return off > 0 ? q.offset(off) : q;
    }),
    safeQuery("articles", () => {
      const q = db.select().from(articles).where(
        eq(articles.cityId, cityId),
      ).orderBy(desc(articles.publishedAt)).limit(pb);
      return off > 0 ? q.offset(off) : q;
    }),
    safeQuery("marketplace", () => {
      const q = db.select().from(marketplaceListings).where(
        and(eq(marketplaceListings.cityId, cityId), eq(marketplaceListings.status, "ACTIVE")),
      ).orderBy(desc(marketplaceListings.createdAt)).limit(pb);
      return off > 0 ? q.offset(off) : q;
    }),
    safeQuery("posts", () => {
      const q = db.select().from(posts).where(
        and(eq(posts.cityId, cityId), eq(posts.status, "published")),
      ).orderBy(desc(posts.publishedAt)).limit(pb);
      return off > 0 ? q.offset(off) : q;
    }),
    safeQuery("rss", () => {
      const rssLim = pb * 2;
      const q = db.select().from(rssItems).where(
        and(
          eq(rssItems.cityId, cityId),
          eq(rssItems.reviewStatus, "APPROVED"),
          buildGeoRssFilter(geoTagSlug, zoneTiers.tier1Slugs, zoneTiers.tier2Slugs, zoneTiers.countyCode),
        ),
      ).orderBy(desc(rssItems.publishedAt)).limit(rssLim);
      const rssOff = off > 0 ? off * 2 : 0;
      return rssOff > 0 ? q.offset(rssOff) : q;
    }),
    safeQuery("jobs", () => {
      const q = db.select().from(jobs).where(
        and(eq(jobs.cityId, cityId), sql`${jobs.jobStatus} = 'active'`),
      ).orderBy(desc(jobs.postedAt)).limit(Math.floor(pb / 2));
      const jobOff = off > 0 ? Math.floor(off / 2) : 0;
      return jobOff > 0 ? q.offset(jobOff) : q;
    }),
    safeQuery("attractions", () => {
      const q = db.select().from(attractions).where(
        eq(attractions.cityId, cityId),
      ).orderBy(desc(attractions.createdAt)).limit(Math.floor(pb / 2));
      const attOff = off > 0 ? Math.floor(off / 2) : 0;
      return attOff > 0 ? q.offset(attOff) : q;
    }),
    safeQuery("curated", () => {
      const q = db.select().from(curatedLists).where(
        eq(curatedLists.cityId, cityId),
      ).orderBy(desc(curatedLists.createdAt)).limit(Math.floor(pb / 4));
      const curOff = off > 0 ? Math.floor(off / 4) : 0;
      return curOff > 0 ? q.offset(curOff) : q;
    }),
    safeQuery("digests", () => {
      const q = db.select().from(digests).where(eq(digests.cityId, cityId))
        .orderBy(desc(digests.createdAt)).limit(Math.floor(pb / 4));
      const digOff = off > 0 ? Math.floor(off / 4) : 0;
      return digOff > 0 ? q.offset(digOff) : q;
    }),
    safeQuery("pulseVideos", () => {
      const q = db.select().from(pulseVideos).where(
        eq(pulseVideos.cityId, cityId),
      ).orderBy(desc(pulseVideos.createdAt)).limit(Math.floor(pb / 2));
      const pvOff = off > 0 ? Math.floor(off / 2) : 0;
      return pvOff > 0 ? q.offset(pvOff) : q;
    }),
    safeQuery("cms", () => {
      const q = db.select().from(cmsContentItems).where(
        and(eq(cmsContentItems.cityId, cityId), eq(cmsContentItems.status, "published")),
      ).orderBy(desc(cmsContentItems.createdAt)).limit(Math.floor(pb / 4));
      const cmsOff = off > 0 ? Math.floor(off / 4) : 0;
      return cmsOff > 0 ? q.offset(cmsOff) : q;
    }),
  ]);

  const [siRows, sdRows] = await Promise.all([
    safeQuery("shopItems", () => {
      const q = db.select().from(shopItems).where(
        and(eq(shopItems.cityId, cityId), eq(shopItems.status, "active")),
      ).orderBy(desc(shopItems.createdAt)).limit(Math.floor(pb / 2));
      const siOff = off > 0 ? Math.floor(off / 2) : 0;
      return siOff > 0 ? q.offset(siOff) : q;
    }),
    safeQuery("shopDrops", () => {
      const q = db.select().from(shopDrops).where(
        and(eq(shopDrops.cityId, cityId), eq(shopDrops.status, "active")),
      ).orderBy(desc(shopDrops.createdAt)).limit(Math.floor(pb / 2));
      const sdOff = off > 0 ? Math.floor(off / 2) : 0;
      return sdOff > 0 ? q.offset(sdOff) : q;
    }),
  ]);

  const [vcRows, lpRows] = await Promise.all([
    safeQuery("videoContent", () => {
      const q = db.select().from(videoContent).where(eq(videoContent.cityId, cityId))
        .orderBy(desc(videoContent.createdAt)).limit(Math.floor(pb / 2));
      const vcOff = off > 0 ? Math.floor(off / 2) : 0;
      return vcOff > 0 ? q.offset(vcOff) : q;
    }),
    safeQuery("localPodcasts", async () => {
      const podcasts = await db.select().from(localPodcasts)
        .where(and(eq(localPodcasts.cityId, cityId), eq(localPodcasts.status, "approved")));
      if (podcasts.length === 0) return [];
      const podIds = podcasts.map((p) => p.id);
      const epQ = db.select().from(localPodcastEpisodes)
        .where(inArray(localPodcastEpisodes.podcastId, podIds))
        .orderBy(desc(localPodcastEpisodes.publishedAt)).limit(Math.floor(pb / 2));
      const epOff = off > 0 ? Math.floor(off / 2) : 0;
      const episodes = await (epOff > 0 ? epQ.offset(epOff) : epQ);
      return episodes.map((ep) => {
        const pod = podcasts.find((p) => p.id === ep.podcastId);
        return { episode: ep, podcast: pod };
      }).filter((r) => r.podcast);
    }),
  ]);

  const skipById = (id: string) => excludeIds.has(id) || (topicFilterIds !== null && !topicFilterIds.has(id));
  const matchesCat = (catIds: string[] | null | undefined, primaryCatId: string | null | undefined) => {
    if (!topicCatIds) return false;
    if (catIds) for (const cid of catIds) if (topicCatIds.has(cid)) return true;
    if (primaryCatId && topicCatIds.has(primaryCatId)) return true;
    return false;
  };
  const skip = (id: string, catIds?: string[] | null, primaryCatId?: string | null) =>
    excludeIds.has(id) || (topicFilterIds !== null && !topicFilterIds.has(id) && !matchesCat(catIds, primaryCatId));
  const HUB_BOOST = 50;
  const SIBLING_BOOST = 25;
  const COUNTY_BOOST = 10;

  const contentIdMap = new Map<string, string[]>();
  const collectIds = (type: string, ids: string[]) => {
    if (ids.length > 0) contentIdMap.set(type, ids);
  };
  collectIds("business", bizRows.map(b => b.id));
  collectIds("event", evtRows.map(e => e.id));
  collectIds("article", artRows.map(a => a.id));
  collectIds("marketplace_listing", mlRows.map(m => m.id));
  collectIds("post", postRows.map(p => p.id));
  collectIds("shop_item", siRows.map(s => s.id));
  collectIds("shop_drop", sdRows.map(s => s.id));

  const tagMap = await buildTagMap(contentIdMap);

  const applyGeoBoost = (item: FeedItem, zip?: string | null, neighborhood?: string | null) => {
    if (geoBoostIds && geoBoostIds.has(item.id)) {
      item.priorityScore += HUB_BOOST;
    } else if (hubZips.length > 0 && zip && hubZips.includes(zip)) {
      item.priorityScore += HUB_BOOST;
    } else if (hubNameLower && neighborhood && neighborhood.toLowerCase().includes(hubNameLower)) {
      item.priorityScore += HUB_BOOST;
    } else if (siblingBoostIds && siblingBoostIds.has(item.id)) {
      item.priorityScore += SIBLING_BOOST;
    } else if (countyBoostIds && countyBoostIds.has(item.id)) {
      item.priorityScore += COUNTY_BOOST;
    }
  };

  for (const biz of bizRows) {
    if (skip(biz.id, biz.categoryIds)) continue;
    if (isFaithBusiness(biz, faithCatIds)) continue;
    const item = projectBusiness(biz, citySlug, tagMap);
    if (item) { applyGeoBoost(item, biz.zip); items.push(item); }
  }

  for (const evt of evtRows) {
    if (skip(evt.id, evt.categoryIds)) continue;
    const item = projectEvent(evt, citySlug, tagMap);
    if (item) { applyGeoBoost(item, evt.zip); items.push(item); }
  }

  for (const art of artRows) {
    if (skip(art.id, null, art.primaryCategoryId)) continue;
    const item = projectArticle(art, citySlug, tagMap);
    if (item) { applyGeoBoost(item); items.push(item); }
  }

  for (const ml of mlRows) {
    if (skip(ml.id)) continue;
    const item = projectMarketplaceListing(ml, citySlug, tagMap);
    if (item) { applyGeoBoost(item, ml.addressZip, ml.neighborhood); items.push(item); }
  }

  for (const p of postRows) {
    if (skip(p.id)) continue;
    const item = projectPost(p, citySlug, tagMap);
    if (item) { applyGeoBoost(item); items.push(item); }
  }

  for (const r of rssRows) {
    if (skip(r.id)) continue;
    const item = projectRssItem(r, citySlug, surface);
    if (item) { applyGeoBoost(item); items.push(item); }
  }

  for (const j of jobRows) {
    if (skip(j.id)) continue;
    const item = projectJob(j, citySlug);
    if (item) { applyGeoBoost(item, j.zipCode); items.push(item); }
  }

  for (const a of attractionRows) {
    if (skip(a.id)) continue;
    const item = projectAttraction(a, citySlug);
    if (item) { applyGeoBoost(item); items.push(item); }
  }

  for (const cl of curatedRows) {
    if (skip(cl.id)) continue;
    const item = projectCuratedList(cl, citySlug);
    if (item) { applyGeoBoost(item); items.push(item); }
  }

  for (const d of digestRows) {
    if (skip(d.id)) continue;
    const item = projectDigest(d, citySlug);
    if (item) { applyGeoBoost(item); items.push(item); }
  }

  for (const pv of pvRows) {
    if (excludeIds.has(`pv-${pv.id}`)) continue;
    if (skipById(pv.id)) continue;
    const item = projectPulseVideo(pv, citySlug);
    if (item) { applyGeoBoost(item); items.push(item); }
  }

  for (const pg of cmsRows) {
    if (skip(pg.id)) continue;
    const item = projectCmsPage(pg, citySlug);
    if (item) { applyGeoBoost(item); items.push(item); }
  }

  for (const si of siRows) {
    if (skip(si.id)) continue;
    const item = projectShopItem(si, citySlug, null);
    if (item) { applyGeoBoost(item); items.push(item); }
  }

  for (const sd of sdRows) {
    if (skip(sd.id)) continue;
    const item = projectShopDrop(sd, citySlug, null);
    if (item) { applyGeoBoost(item); items.push(item); }
  }

  for (const vc of vcRows) {
    if (excludeIds.has(`video-${vc.id}`) || excludeIds.has(`podcast-${vc.id}`)) continue;
    if (skipById(vc.id)) continue;
    if (vc.contentType === "podcast" || vc.audioUrl) {
      const item = projectPodcastContent(vc, citySlug, null);
      if (item) { applyGeoBoost(item); items.push(item); }
    } else {
      const item = projectVideoContent(vc, citySlug, null);
      if (item) { applyGeoBoost(item); items.push(item); }
    }
  }

  for (const { episode, podcast } of lpRows as Array<{ episode: typeof localPodcastEpisodes.$inferSelect; podcast: typeof localPodcasts.$inferSelect }>) {
    if (excludeIds.has(`lp-${episode.id}`)) continue;
    if (skipById(episode.id)) continue;
    const item = projectLocalPodcastEpisode(episode, podcast, citySlug);
    if (item) { applyGeoBoost(item); items.push(item); }
  }

  const crownItems = await fetchCrownFeedItems(cityId, citySlug);
  for (const ci of crownItems) {
    if (!excludeIds.has(ci.id)) items.push(ci);
  }

  const repostItems = await getApprovedReposts(cityId, citySlug, 10);
  for (const ri of repostItems) {
    if (!excludeIds.has(ri.id)) items.push(ri);
  }

  return items;
}

interface ConstraintLevel {
  sponsoredCapPer15: number;
  entityCapPer25: number;
  videoStreakCap: number;
  typeRepeatCap: number;
  sourceCapPer20: number;
}

const CONSTRAINT_LEVELS: ConstraintLevel[] = [
  {
    sponsoredCapPer15: 1,
    entityCapPer25: 2,
    videoStreakCap: 4,
    typeRepeatCap: 2,
    sourceCapPer20: 2,
  },
  {
    sponsoredCapPer15: 2,
    entityCapPer25: 4,
    videoStreakCap: 6,
    typeRepeatCap: 3,
    sourceCapPer20: 4,
  },
  {
    sponsoredCapPer15: 4,
    entityCapPer25: 8,
    videoStreakCap: 10,
    typeRepeatCap: 5,
    sourceCapPer20: 8,
  },
  {
    sponsoredCapPer15: 999,
    entityCapPer25: 999,
    videoStreakCap: 999,
    typeRepeatCap: 999,
    sourceCapPer20: 999,
  },
];

function isVideoType(item: { mediaType?: string; type: string; videoUrl?: string | null; videoEmbedUrl?: string | null }): boolean {
  return item.type === "reel" || item.mediaType === "video" || item.mediaType === "reel" || !!(item.videoUrl || item.videoEmbedUrl);
}

function getEntityId(item: { type: string; id: string; sponsorshipMeta?: { businessName?: string } }): string | null {
  if ((item.type === "sponsored" || item.type === "business" || item.type === "enhanced_listing") && item.sponsorshipMeta?.businessName) {
    return `biz:${item.sponsorshipMeta.businessName}`;
  }
  if (item.type === "business" || item.type === "sponsored" || item.type === "enhanced_listing") {
    return `biz:${item.id}`;
  }
  return null;
}

function progressiveConstrainedSelect(
  pool: FeedItem[],
  session: FeedSession,
  pageLimit: number,
): { accepted: FeedItem[]; hasMore: boolean } {
  for (let level = 0; level < CONSTRAINT_LEVELS.length; level++) {
    const caps = CONSTRAINT_LEVELS[level];
    const accepted: FeedItem[] = [];
    const localHistory: Array<{
      position: number;
      isSponsored: boolean;
      entityId: string | null;
      isVideo: boolean;
      type: string;
      sourceName: string | null;
      categorySlug: string | null;
    }> = [];
    let videoStreak = session.videoStreak;
    let typeStreak = session.typeStreak;
    let lastType = session.lastType;

    const fullHistory = () => [...session.acceptedHistory, ...localHistory];

    for (const item of pool) {
      if (accepted.length >= pageLimit) break;

      const position = session.consumedCount + accepted.length + 1;
      const isSponsored = item.sponsored || item.type === "sponsored";
      const entityId = getEntityId(item);
      const isVideo = isVideoType(item);

      let skip = false;

      if (isSponsored) {
        const hist = fullHistory();
        const window = hist.slice(-15);
        const sponsoredCount = window.filter((r) => r.isSponsored).length + 1;
        if (sponsoredCount > caps.sponsoredCapPer15) skip = true;
      }

      if (entityId) {
        const hist = fullHistory();
        const window = hist.slice(-25);
        const entityCount = window.filter((r) => r.entityId === entityId).length + 1;
        if (entityCount > caps.entityCapPer25) skip = true;
      }

      if (isVideo && videoStreak + 1 > caps.videoStreakCap) skip = true;

      if (lastType === item.type && typeStreak + 1 > caps.typeRepeatCap) skip = true;

      const srcName = item.sourceName || null;
      if (srcName) {
        const hist = fullHistory();
        const window = hist.slice(-20);
        const srcCount = window.filter((r) => r.sourceName === srcName).length + 1;
        if (srcCount > caps.sourceCapPer20) skip = true;
      }

      if (skip) continue;

      accepted.push(item);
      const catSlug = item.geoMeta?.categoryCoreSlug || item.primaryTag?.slug || null;
      localHistory.push({
        position,
        isSponsored,
        entityId,
        isVideo,
        type: item.type,
        sourceName: srcName,
        categorySlug: catSlug,
      });

      if (isVideo) videoStreak++;
      else videoStreak = 0;
      if (lastType === item.type) typeStreak++;
      else typeStreak = 1;
      lastType = item.type;
    }

    if (accepted.length >= pageLimit || level === CONSTRAINT_LEVELS.length - 1) {
      session.consumedCount += accepted.length;
      session.acceptedHistory.push(...localHistory);
      session.videoStreak = videoStreak;
      session.typeStreak = typeStreak;
      session.lastType = lastType;
      session.lastSeenAt = Date.now();

      return {
        accepted,
        hasMore: pool.length >= pageLimit,
      };
    }
  }

  return { accepted: [], hasMore: false };
}

function assignZoneTierScore(
  item: FeedItem,
  tier1Slugs: string[],
  tier2Slugs: string[],
  countyCode: string | null,
): number {
  const geo = item.geoMeta;
  if (!geo) return RANKING_CONFIG.geo.cityWide;

  const primary = geo.geoPrimarySlug?.toLowerCase();
  const secondary = geo.geoSecondarySlug?.toLowerCase();
  const hub = geo.hubSlug?.toLowerCase();
  const county = geo.countySlug?.toLowerCase();

  if (primary && tier1Slugs.includes(primary)) return RANKING_CONFIG.geo.tier1_primaryMatch;
  if (hub && tier1Slugs.includes(hub)) return RANKING_CONFIG.geo.tier1_primaryMatch;
  if (secondary && tier1Slugs.includes(secondary)) return RANKING_CONFIG.geo.tier2_secondaryMatch;
  if (primary && tier2Slugs.includes(primary)) return RANKING_CONFIG.geo.tier3_hubMatch;
  if (hub && tier2Slugs.includes(hub)) return RANKING_CONFIG.geo.tier3_hubMatch;
  if (countyCode && county === countyCode) return RANKING_CONFIG.geo.tier4_countyMatch;

  return RANKING_CONFIG.geo.tier5_metro;
}

export async function queryFeedV2(options: FeedV2Options): Promise<FeedV2Result> {
  const {
    cityId, citySlug, geoTagSlug, topicTagSlug, userHubSlug,
    context = "foryou", surface = "pulse", limit, cursor: cursorToken,
    feedSessionId, locale = "en",
  } = options;

  const effectiveHubSlug = geoTagSlug || userHubSlug;

  let session = feedSessionId ? getFeedSession(feedSessionId) : null;
  if (!session) {
    session = createFeedSession(citySlug, effectiveHubSlug ? "home" : "metro");
  }

  let cursor: FeedV2Cursor;
  if (cursorToken) {
    const decoded = decodeCursor(cursorToken);
    cursor = decoded || { t: Date.now(), s: [], n: 1 };
  } else {
    cursor = { t: Date.now(), s: [], n: 1 };
  }

  const excludeIds = new Set(cursor.s);
  const pageOffset = (cursor.n - 1) * PROVIDER_BATCH;

  let organicItems = await fetchAllProviders(
    cityId, citySlug, pageOffset, excludeIds, surface, geoTagSlug, topicTagSlug, effectiveHubSlug,
  );

  organicItems = deduplicateItems(organicItems);

  if (context === "weekend") {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysUntilFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : 5 + (7 - dayOfWeek);
    const friday = new Date(now);
    friday.setDate(now.getDate() + daysUntilFriday);
    friday.setHours(0, 0, 0, 0);
    const sunday = new Date(friday);
    sunday.setDate(friday.getDate() + 2);
    sunday.setHours(23, 59, 59, 999);
    if (dayOfWeek >= 5 || dayOfWeek === 0) {
      friday.setDate(now.getDate() - (dayOfWeek === 0 ? 2 : dayOfWeek - 5));
      friday.setHours(0, 0, 0, 0);
      sunday.setDate(friday.getDate() + 2);
      sunday.setHours(23, 59, 59, 999);
    }
    organicItems = organicItems.filter((item) => {
      if (item.type === "event" && item.startDate) {
        const sd = new Date(item.startDate);
        return sd >= friday && sd <= sunday;
      }
      return false;
    });
  }

  if (context === "new") {
    organicItems.sort((a, b) => {
      const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bDate - aDate;
    });
  } else if (context === "trending") {
    organicItems.sort((a, b) => {
      const aEng = (a.likeCount || 0) + (a.shareCount || 0) + (a.saveCount || 0);
      const bEng = (b.likeCount || 0) + (b.shareCount || 0) + (b.saveCount || 0);
      if (bEng !== aEng) return bEng - aEng;
      return b.priorityScore - a.priorityScore;
    });
  } else {
    const geoCtx = await resolveGeoContext(effectiveHubSlug || geoTagSlug);

    if (effectiveHubSlug) {
      const zoneTiers = await resolveZoneTiers(effectiveHubSlug, cityId);
      for (const item of organicItems) {
        const tierBoost = assignZoneTierScore(
          item, zoneTiers.tier1Slugs, zoneTiers.tier2Slugs, zoneTiers.countyCode,
        );
        item.priorityScore += tierBoost;
      }
    }

    await hydrateEngagementSignals(organicItems);

    const surfaceKey = (surface || "default") as SurfaceType;
    rankWithScoring(organicItems, geoCtx, surfaceKey);
    organicItems = applyDiversityReranking(organicItems, surfaceKey);
  }

  organicItems = applyCrossTypeDedup(organicItems);

  const sponsoredItems = await getSponsoredBusinesses(cityId, citySlug).catch((e) => { console.error("[FeedV2] getSponsoredBusinesses error:", e.message); return [] as FeedItem[]; });
  if (sponsoredItems.length > 0) {
    const organicIds = new Set(organicItems.map((i) => i.id));
    const uniqueSponsored = sponsoredItems.filter((s) => !organicIds.has(s.id) && !excludeIds.has(s.id));
    if (uniqueSponsored.length > 0) {
      const interval = RANKING_CONFIG.sponsoredInsertionInterval;
      const result: FeedItem[] = [];
      let sponsorIdx = 0;
      for (let i = 0; i < organicItems.length; i++) {
        result.push(organicItems[i]);
        if ((i + 1) % interval === 0 && sponsorIdx < uniqueSponsored.length) {
          result.push(uniqueSponsored[sponsorIdx]);
          sponsorIdx++;
        }
      }
      organicItems = result;
    }
  }

  const enhancedItems = await getEnhancedListingCards(cityId, citySlug).catch((e) => { console.error("[FeedV2] getEnhancedListingCards error:", e.message); return [] as FeedItem[]; });
  if (enhancedItems.length > 0) {
    const organicBizIds = new Set(organicItems.filter((i) => i.type === "business").map((i) => i.id));
    const uniqueEnhanced = enhancedItems.filter((i) => !organicBizIds.has(i.id.replace("enhanced-", "")) && !excludeIds.has(i.id));
    if (uniqueEnhanced.length > 0) {
      const result: FeedItem[] = [];
      let enhIdx = 0;
      const interval = 12;
      const offset = 7;
      for (let i = 0; i < organicItems.length; i++) {
        result.push(organicItems[i]);
        if ((i + 1) >= offset && ((i + 1 - offset) % interval === 0) && enhIdx < uniqueEnhanced.length) {
          result.push(uniqueEnhanced[enhIdx]);
          enhIdx++;
        }
      }
      organicItems = result;
    }
  }

  let hubRegionIdForFacts: string | null = null;
  if (effectiveHubSlug) {
    const [hub] = await db
      .select({ id: regions.id })
      .from(regions)
      .where(and(sql`UPPER(${regions.code}) = UPPER(${effectiveHubSlug})`, eq(regions.regionType, "hub")))
      .limit(1);
    hubRegionIdForFacts = hub?.id || null;
  }
  const factCards = (await fetchAreaFacts(cityId, hubRegionIdForFacts)).filter(f => !excludeIds.has(f.id));
  if (factCards.length > 0) {
    const result: FeedItem[] = [];
    let factIndex = 0;
    for (let i = 0; i < organicItems.length; i++) {
      result.push(organicItems[i]);
      if ((i + 1) % 15 === 0 && factIndex < factCards.length) {
        result.push(factCards[factIndex]);
        factIndex++;
      }
    }
    organicItems = result;
  }

  const { accepted, hasMore: constraintHasMore } = progressiveConstrainedSelect(
    organicItems, session, limit,
  );

  const finalItems = await hydrateEngagementCounts(accepted);

  const allLiveFeeds = await storage.getLiveFeedsByCityId(cityId, true);
  const youtubeFeeds = allLiveFeeds.filter((f) => f.type === "youtube");
  if (youtubeFeeds.length > 0 && finalItems.length > 3) {
    const liveOffset = ((cursor.n - 1) * 2) % youtubeFeeds.length;
    const liveItem = projectLiveStream(youtubeFeeds[liveOffset % youtubeFeeds.length], citySlug);
    if (!excludeIds.has(liveItem.id)) {
      const insertPos = Math.min(5, finalItems.length);
      finalItems.splice(insertPos, 0, liveItem);
    }
  }

  const newSeenIds = [...cursor.s, ...finalItems.map((i) => i.id)].slice(-MAX_SEEN_IDS);

  const dbHasMore = constraintHasMore && finalItems.length > 0;

  const nextCursor: FeedV2Cursor = {
    t: cursor.t,
    s: newSeenIds,
    n: cursor.n + 1,
  };

  return {
    items: finalItems,
    cursor: dbHasMore ? encodeCursor(nextCursor) : null,
    hasMore: dbHasMore,
    feedSessionId: session.feedSessionId,
    total: organicItems.length,
    limit,
    page: cursor.n,
    activeFilters: {
      geoTag: geoTagSlug || null,
      topicTag: topicTagSlug || null,
      context: context || "foryou",
    },
    locale,
    geoContext: session.geoContext,
  };
}
