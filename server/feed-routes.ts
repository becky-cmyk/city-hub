import { Router, type Request, type Response } from "express";
import { db } from "./db";
import { eq, and, sql, desc, count as drizzleCount, inArray, isNull, or } from "drizzle-orm";
import { tags, contentTags, cities, categories, regions, rssItems, zones, metroSources, users, events, businesses } from "@shared/schema";
import { aiGenerateLocalArticle } from "./lib/ai-content";
import { queryFeed, queryBusinessFeed } from "./services/feed-service";
import { queryFeedV2 } from "./services/feed-v2-service";
import { classifyAndWriteback } from "./services/ai-classifier";
import {
  createFeedSession,
  getFeedSession,
  getSessionStats,
  getActiveSessionCount,
  FEED_CAP_CONFIG,
  type GeoContext,
} from "./services/feed-session";

const router = Router();

export const CORE_FEED_TOPICS = [
  { name: "Food & Dining", slug: "food-dining", icon: "UtensilsCrossed", sortOrder: 1 },
  { name: "Nightlife", slug: "nightlife", icon: "Wine", sortOrder: 2 },
  { name: "Arts & Culture", slug: "arts-culture", icon: "Palette", sortOrder: 3 },
  { name: "Shopping", slug: "shopping", icon: "ShoppingBag", sortOrder: 4 },
  { name: "Health & Wellness", slug: "health-wellness", icon: "HeartPulse", sortOrder: 5 },
  { name: "Sports", slug: "sports", icon: "Trophy", sortOrder: 6 },
  { name: "Outdoors", slug: "outdoors", icon: "Trees", sortOrder: 7 },
  { name: "Entertainment", slug: "entertainment", icon: "Music", sortOrder: 8 },
  { name: "Family", slug: "family", icon: "Users", sortOrder: 9 },
  { name: "Community", slug: "community", icon: "Heart", sortOrder: 10 },
  { name: "Education", slug: "education", icon: "GraduationCap", sortOrder: 11 },
  { name: "Real Estate", slug: "real-estate", icon: "Building2", sortOrder: 12 },
  { name: "Automotive", slug: "automotive", icon: "Car", sortOrder: 13 },
  { name: "Pets", slug: "pets", icon: "PawPrint", sortOrder: 14 },
  { name: "Local Food", slug: "local-food", icon: "Leaf", sortOrder: 15 },
];

const VALID_GEO_CONTEXTS: GeoContext[] = ["near_me", "home", "work", "metro"];

async function resolveCityId(citySlug: string): Promise<string | null> {
  const [city] = await db.select({ id: cities.id }).from(cities).where(eq(cities.slug, citySlug)).limit(1);
  return city?.id || null;
}

router.post("/api/feed/session", async (req: Request, res: Response) => {
  try {
    const { metroId, geoContext, userId } = req.body || {};

    const resolvedMetroId = metroId || "charlotte";
    const resolvedGeoContext: GeoContext = VALID_GEO_CONTEXTS.includes(geoContext) ? geoContext : "metro";
    const resolvedUserId = userId || null;

    const session = createFeedSession(resolvedMetroId, resolvedGeoContext, resolvedUserId);

    return res.json({
      feedSessionId: session.feedSessionId,
      geoContext: session.geoContext,
      metroId: session.metroId,
      startedAt: new Date(session.startedAt).toISOString(),
    });
  } catch (err: any) {
    console.error("[Feed Session API] Error:", err.message);
    return res.status(500).json({ error: "Failed to create feed session" });
  }
});

router.get("/api/feed", async (req: Request, res: Response) => {
  try {
    const citySlug = (req.query.citySlug as string) || "charlotte";
    const geoTag = req.query.geoTag as string | undefined;
    const topicTag = req.query.topicTag as string | undefined;
    const userHub = req.query.userHub as string | undefined;
    const context = (req.query.context as "trending" | "nearby" | "new" | "weekend" | "foryou") || "foryou";
    const validSurfaces = new Set(["pulse", "hub", "category", "default"]);
    const rawSurface = req.query.surface as string;
    const surface = (validSurfaces.has(rawSurface) ? rawSurface : "pulse") as "pulse" | "hub" | "category" | "default";
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const feedSessionId = req.query.feedSessionId as string | undefined;
    const geoContext = req.query.geoContext as string | undefined;
    const locale = (req.query.locale as string) || "en";

    let session = feedSessionId ? getFeedSession(feedSessionId) : null;

    if (!session) {
      const resolvedGeoContext: GeoContext = VALID_GEO_CONTEXTS.includes(geoContext as GeoContext)
        ? (geoContext as GeoContext)
        : "metro";
      session = createFeedSession(citySlug, resolvedGeoContext);
    }

    const cityId = await resolveCityId(citySlug);
    if (!cityId) {
      return res.json({ items: [], total: 0, page, limit, hasMore: false, activeFilters: { geoTag, topicTag, context }, error: "City not found" });
    }

    const result = await queryFeed({
      geoTagSlug: geoTag,
      topicTagSlug: topicTag,
      userHubSlug: userHub,
      context,
      surface,
      page,
      limit,
      cityId,
      citySlug,
      feedSessionId: session.feedSessionId,
    });

    const responseData: any = {
      ...result,
      activeFilters: { geoTag: geoTag || null, topicTag: topicTag || null, context },
      feedSessionId: session.feedSessionId,
      geoContext: session.geoContext,
      locale,
    };
    delete responseData.debugSkipped;

    return res.json(responseData);
  } catch (err: any) {
    console.error("[Feed API] Error:", err.message);
    return res.json({ items: [], total: 0, page: 1, limit: 20, hasMore: false, error: "Feed temporarily unavailable" });
  }
});

router.get("/api/feed/v2", async (req: Request, res: Response) => {
  try {
    const citySlug = (req.query.citySlug as string) || "charlotte";
    const geoTag = req.query.geoTag as string | undefined;
    const topicTag = req.query.topicTag as string | undefined;
    const userHub = req.query.userHub as string | undefined;
    const context = (req.query.context as "trending" | "nearby" | "new" | "weekend" | "foryou") || "foryou";
    const validSurfaces = new Set(["pulse", "hub", "category", "default"]);
    const rawSurface = req.query.surface as string;
    const surface = (validSurfaces.has(rawSurface) ? rawSurface : "pulse") as "pulse" | "hub" | "category" | "default";
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const cursorToken = req.query.cursor as string | undefined;
    const feedSessionId = req.query.feedSessionId as string | undefined;
    const locale = (req.query.locale as string) || "en";

    const cityId = await resolveCityId(citySlug);
    if (!cityId) {
      return res.json({
        items: [], total: 0, page: 1, limit, hasMore: false, cursor: null,
        activeFilters: { geoTag, topicTag, context },
      });
    }

    const result = await queryFeedV2({
      cityId, citySlug,
      geoTagSlug: geoTag,
      topicTagSlug: topicTag,
      userHubSlug: userHub,
      context, surface, limit,
      cursor: cursorToken,
      feedSessionId,
      locale,
    });

    return res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Feed V2 API] Error:", msg);
    return res.json({
      items: [], total: 0, page: 1, limit: 20, hasMore: false, cursor: null,
      error: "Feed temporarily unavailable",
    });
  }
});

router.get("/api/business/:id/feed", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const citySlug = (req.query.citySlug as string) || "charlotte";
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));

    const items = await queryBusinessFeed(id, citySlug, limit);

    return res.json({ items, total: items.length });
  } catch (err: any) {
    console.error("[Business Feed API] Error:", err.message);
    return res.json({ items: [], total: 0, error: "Business feed temporarily unavailable" });
  }
});

router.get("/api/feed/neighborhoods", async (req: Request, res: Response) => {
  try {
    const citySlug = (req.query.citySlug as string) || "charlotte";
    const allRegions = await db.select({
      id: regions.id,
      name: regions.name,
      code: regions.code,
      regionType: regions.regionType,
      parentRegionId: regions.parentRegionId,
      isActive: regions.isActive,
    }).from(regions).where(eq(regions.isActive, true));

    const counties = allRegions.filter(r => r.regionType === "county");
    const allHubs = allRegions.filter(r => r.regionType === "hub");
    const farmHubCodes = new Set(["CLT_MEAT", "CLT_FARM_BOXES", "CLT_FRESH_EGGS", "CLT_FARMERS_MARKETS", "CLT_LOCAL_FOOD"]);
    const hubs = allHubs.filter(h => !farmHubCodes.has(h.code || ""));

    const grouped = counties
      .map(county => ({
        county: county.name,
        countyCode: county.code,
        neighborhoods: hubs
          .filter(h => h.parentRegionId === county.id)
          .map(h => ({
            id: h.id,
            slug: h.code?.toLowerCase() || h.name.toLowerCase().replace(/\s+/g, "-"),
            label: h.name,
            code: h.code,
          }))
          .sort((a, b) => a.label.localeCompare(b.label)),
      }))
      .filter(g => g.neighborhoods.length > 0)
      .sort((a, b) => b.neighborhoods.length - a.neighborhoods.length);

    const allRegionsFull = await db.select({
      id: regions.id,
      name: regions.name,
      code: regions.code,
      regionType: regions.regionType,
      parentRegionId: regions.parentRegionId,
      isActive: regions.isActive,
      centerLat: regions.centerLat,
      centerLng: regions.centerLng,
    }).from(regions).where(eq(regions.isActive, true));

    const hubsFull = allRegionsFull.filter(r => r.regionType === "hub" && !farmHubCodes.has(r.code || ""));

    const flat = hubsFull.map(h => ({
      id: h.id,
      slug: h.code?.toLowerCase() || h.name.toLowerCase().replace(/\s+/g, "-"),
      label: h.name,
      code: h.code,
      countyName: counties.find(c => c.id === h.parentRegionId)?.name || null,
      centerLat: h.centerLat || null,
      centerLng: h.centerLng || null,
    })).sort((a, b) => a.label.localeCompare(b.label));

    return res.json({ grouped, flat, total: flat.length });
  } catch (err: any) {
    console.error("[Neighborhoods API] Error:", err.message);
    return res.json({ grouped: [], flat: [], total: 0 });
  }
});

router.get("/api/tags/suggest", async (req: Request, res: Response) => {
  try {
    const citySlug = (req.query.citySlug as string) || "charlotte";
    const geoTag = req.query.geoTag as string | undefined;

    const cityId = await resolveCityId(citySlug);
    if (!cityId) {
      return res.json({ tags: [] });
    }

    const [ctCount] = await db.select({ total: drizzleCount() }).from(contentTags);
    const hasContentTags = (ctCount?.total || 0) > 0;

    if (hasContentTags) {
      let geoTagIds: string[] = [];
      if (geoTag) {
        const [gt] = await db.select().from(tags).where(and(sql`LOWER(${tags.slug}) = LOWER(${geoTag})`, eq(tags.type, "location")));
        if (gt) {
          const descendants = await db.select({ id: tags.id }).from(tags).where(eq(tags.parentTagId, gt.id));
          geoTagIds = [gt.id, ...descendants.map(d => d.id)];
        }
      }

      let topicTagsQuery;
      if (geoTagIds.length > 0) {
        const contentIdsInGeo = await db
          .select({ contentId: contentTags.contentId, contentType: contentTags.contentType })
          .from(contentTags)
          .where(inArray(contentTags.tagId, geoTagIds));

        const contentIdSet = contentIdsInGeo.map(r => r.contentId);
        if (contentIdSet.length === 0) {
          const allTopicTags = await db.select().from(tags).where(eq(tags.type, "topic")).orderBy(tags.sortOrder).limit(50);
          const dbSlugs = new Set(allTopicTags.map(t => t.slug));
          const merged = allTopicTags.map(t => ({ slug: t.slug, label: t.name, icon: t.icon, count: 0 }));
          for (const core of CORE_FEED_TOPICS) {
            if (!dbSlugs.has(core.slug)) {
              merged.push({ slug: core.slug, label: core.name, icon: core.icon, count: 0 });
            }
          }
          return res.json({ tags: merged });
        }

        topicTagsQuery = await db
          .select({
            tagId: contentTags.tagId,
            cnt: drizzleCount(),
          })
          .from(contentTags)
          .where(and(
            inArray(contentTags.contentId, [...new Set(contentIdSet)]),
            inArray(contentTags.tagId, db.select({ id: tags.id }).from(tags).where(eq(tags.type, "topic")))
          ))
          .groupBy(contentTags.tagId)
          .orderBy(desc(drizzleCount()))
          .limit(20);
      } else {
        topicTagsQuery = await db
          .select({
            tagId: contentTags.tagId,
            cnt: drizzleCount(),
          })
          .from(contentTags)
          .where(inArray(contentTags.tagId, db.select({ id: tags.id }).from(tags).where(eq(tags.type, "topic"))))
          .groupBy(contentTags.tagId)
          .orderBy(desc(drizzleCount()))
          .limit(20);
      }

      const tagIds = topicTagsQuery.map(r => r.tagId);
      if (tagIds.length === 0) {
        const fallbackTags = await db.select().from(tags).where(eq(tags.type, "topic")).orderBy(tags.sortOrder).limit(50);
        const fbSlugs = new Set(fallbackTags.map(t => t.slug));
        const merged = fallbackTags.map(t => ({ slug: t.slug, label: t.name, icon: t.icon, count: 0 }));
        for (const core of CORE_FEED_TOPICS) {
          if (!fbSlugs.has(core.slug)) {
            merged.push({ slug: core.slug, label: core.name, icon: core.icon, count: 0 });
          }
        }
        return res.json({ tags: merged });
      }

      const tagDetails = await db.select().from(tags).where(inArray(tags.id, tagIds));
      const tagMap = new Map(tagDetails.map(t => [t.id, t]));
      const cntMap = new Map(topicTagsQuery.map(r => [r.tagId, Number(r.cnt)]));

      const result = tagIds
        .map(id => {
          const t = tagMap.get(id);
          if (!t) return null;
          return { slug: t.slug, label: t.name, icon: t.icon, count: cntMap.get(id) || 0 };
        })
        .filter(Boolean);

      const resultSlugs = new Set(result.map((r: any) => r.slug));
      for (const core of CORE_FEED_TOPICS) {
        if (!resultSlugs.has(core.slug)) {
          result.push({ slug: core.slug, label: core.name, icon: core.icon, count: 0 });
        }
      }

      result.sort((a: any, b: any) => {
        const aCore = CORE_FEED_TOPICS.find(c => c.slug === a.slug);
        const bCore = CORE_FEED_TOPICS.find(c => c.slug === b.slug);
        if (a.count !== b.count) return (b.count || 0) - (a.count || 0);
        const aOrder = aCore?.sortOrder ?? 999;
        const bOrder = bCore?.sortOrder ?? 999;
        return aOrder - bOrder;
      });

      return res.json({ tags: result });
    }

    return res.json({
      tags: CORE_FEED_TOPICS.map(c => ({
        slug: c.slug,
        label: c.name,
        icon: c.icon,
        count: 0,
      })),
    });
  } catch (err: any) {
    console.error("[Tags Suggest API] Error:", err.message);
    return res.json({ tags: [] });
  }
});

router.get("/api/tags/:slug", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const [tag] = await db.select().from(tags).where(sql`LOWER(${tags.slug}) = LOWER(${slug})`).limit(1);
    if (!tag) {
      return res.status(404).json({ error: "Tag not found" });
    }

    const children = await db.select().from(tags).where(eq(tags.parentTagId, tag.id)).orderBy(tags.sortOrder, tags.name);

    const countRows = await db
      .select({
        contentType: contentTags.contentType,
        cnt: drizzleCount(),
      })
      .from(contentTags)
      .where(eq(contentTags.tagId, tag.id))
      .groupBy(contentTags.contentType);

    const counts: Record<string, number> = {
      business: 0,
      event: 0,
      article: 0,
      rss_item: 0,
      marketplace_listing: 0,
      total: 0,
    };

    for (const row of countRows) {
      counts[row.contentType] = Number(row.cnt);
      counts.total += Number(row.cnt);
    }

    let parent = null;
    if (tag.parentTagId) {
      const [p] = await db.select().from(tags).where(eq(tags.id, tag.parentTagId)).limit(1);
      if (p) parent = { slug: p.slug, label: p.name, type: p.type };
    }

    return res.json({
      tag: {
        id: tag.id,
        slug: tag.slug,
        label: tag.name,
        type: tag.type,
        icon: tag.icon,
        parent,
      },
      counts,
      children: children.map(c => ({
        slug: c.slug,
        label: c.name,
        type: c.type,
        icon: c.icon,
      })),
    });
  } catch (err: any) {
    console.error("[Tag API] Error:", err.message);
    return res.status(500).json({ error: "Failed to load tag" });
  }
});

router.get("/api/tags", async (_req: Request, res: Response) => {
  try {
    const allTags = await db.select().from(tags).orderBy(tags.type, tags.sortOrder, tags.name);

    const grouped: Record<string, any[]> = {
      location: [],
      topic: [],
      entity: [],
      status: [],
    };

    for (const tag of allTags) {
      if (grouped[tag.type]) {
        grouped[tag.type].push({
          id: tag.id,
          slug: tag.slug,
          label: tag.name,
          type: tag.type,
          icon: tag.icon,
          parentTagId: tag.parentTagId,
          sortOrder: tag.sortOrder,
        });
      }
    }

    return res.json({ tags: grouped, total: allTags.length });
  } catch (err: any) {
    console.error("[Tags List API] Error:", err.message);
    return res.json({ tags: { location: [], topic: [], entity: [], status: [] }, total: 0 });
  }
});

router.get("/api/admin/feed/stats", async (req: Request, res: Response) => {
  try {
    const tagCounts = await db.select({
      type: tags.type,
      count: sql<number>`count(*)::int`,
    }).from(tags).groupBy(tags.type);

    const [ctResult] = await db.select({
      count: sql<number>`count(*)::int`,
    }).from(contentTags);

    const stats: Record<string, number> = { location: 0, topic: 0, entity: 0, status: 0, total: 0, contentTags: ctResult?.count || 0 };
    for (const row of tagCounts) {
      if (row.type && row.type in stats) {
        stats[row.type] = row.count;
      }
      stats.total += row.count;
    }

    return res.json(stats);
  } catch (err: any) {
    console.error("[Feed Stats API] Error:", err.message);
    return res.json({ location: 0, topic: 0, entity: 0, status: 0, total: 0, contentTags: 0 });
  }
});

router.get("/api/admin/feed/debug-caps", async (req: Request, res: Response) => {
  try {
    const feedSessionId = req.query.feedSessionId as string | undefined;
    if (!feedSessionId) {
      return res.status(400).json({ error: "feedSessionId is required" });
    }

    const stats = getSessionStats(feedSessionId);
    if (!stats) {
      return res.status(404).json({ error: "Session not found or expired" });
    }

    return res.json({
      session: stats,
      capConfig: FEED_CAP_CONFIG,
    });
  } catch (err: any) {
    console.error("[Feed Debug Caps API] Error:", err.message);
    return res.status(500).json({ error: "Failed to get debug info" });
  }
});

router.get("/api/feed/item/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    let item: any;
    if (isUuid) {
      [item] = await db
        .select()
        .from(rssItems)
        .where(and(eq(rssItems.id, id), eq(rssItems.reviewStatus, "APPROVED")))
        .limit(1);
    } else {
      [item] = await db
        .select()
        .from(rssItems)
        .where(and(eq(rssItems.localArticleSlug, id), eq(rssItems.reviewStatus, "APPROVED")))
        .limit(1);
    }

    if (!item) {
      return res.status(404).json({ error: "Article not found" });
    }

    const [city] = await db
      .select({ slug: cities.slug })
      .from(cities)
      .where(eq(cities.id, item.cityId))
      .limit(1);

    const [source] = await db
      .select({ isEventSource: metroSources.isEventSource })
      .from(metroSources)
      .where(eq(metroSources.id, item.metroSourceId))
      .limit(1);

    const related = await db
      .select()
      .from(rssItems)
      .where(
        and(
          eq(rssItems.cityId, item.cityId),
          eq(rssItems.reviewStatus, "APPROVED"),
          sql`${rssItems.id} != ${item.id}`
        )
      )
      .orderBy(desc(rssItems.publishedAt))
      .limit(4);

    const hubName = item.hubSlug
      ? item.hubSlug.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
      : null;

    return res.json({
      ...item,
      citySlug: city?.slug || "charlotte",
      isEventSource: source?.isEventSource || false,
      hubName,
      related: related.map((r) => ({
        id: r.id,
        title: r.title,
        titleEs: r.titleEs,
        summary: (r.rewrittenSummary || r.summary || "").substring(0, 160),
        summaryEs: (r.rewrittenSummaryEs || "").substring(0, 160),
        imageUrl: r.imageUrl,
        sourceName: r.sourceName,
        author: r.author,
        publishedAt: r.publishedAt,
        localArticleSlug: r.localArticleSlug,
      })),
    });
  } catch (err: any) {
    console.error("[Feed Item API] Error:", err.message);
    return res.status(500).json({ error: "Failed to fetch article" });
  }
});

router.get("/api/sitemap/news", async (_req: Request, res: Response) => {
  try {
    const items = await db
      .select({
        id: rssItems.id,
        title: rssItems.title,
        cityId: rssItems.cityId,
        publishedAt: rssItems.publishedAt,
        updatedAt: rssItems.updatedAt,
      })
      .from(rssItems)
      .where(eq(rssItems.reviewStatus, "APPROVED"))
      .orderBy(desc(rssItems.publishedAt));

    const allCities = await db.select({ id: cities.id, slug: cities.slug }).from(cities);
    const cityMap = new Map(allCities.map((c) => [c.id, c.slug]));

    return res.json(
      items.map((item) => ({
        id: item.id,
        title: item.title,
        citySlug: cityMap.get(item.cityId) || "charlotte",
        publishedAt: item.publishedAt,
        updatedAt: item.updatedAt,
      }))
    );
  } catch (err: any) {
    console.error("[Sitemap News API] Error:", err.message);
    return res.status(500).json({ error: "Failed to fetch news sitemap" });
  }
});

router.get("/api/admin/feed/session-stats", async (req: Request, res: Response) => {
  try {
    const feedSessionId = req.query.feedSessionId as string | undefined;

    if (feedSessionId) {
      const stats = getSessionStats(feedSessionId);
      if (!stats) {
        return res.status(404).json({ error: "Session not found or expired" });
      }
      return res.json(stats);
    }

    return res.json({
      activeSessions: getActiveSessionCount(),
    });
  } catch (err: any) {
    console.error("[Feed Session Stats API] Error:", err.message);
    return res.status(500).json({ error: "Failed to get session stats" });
  }
});

let articleBackfillRunning = false;

router.post("/api/admin/rss/backfill-articles", async (req: Request, res: Response) => {
  const sessionUserId = (req.session as any)?.userId;
  if (!sessionUserId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const [sessionUser] = await db.select({ role: users.role }).from(users).where(eq(users.id, sessionUserId)).limit(1);
    const adminRoles = ["PLATFORM_ADMIN", "SUPER_ADMIN", "CITY_ADMIN"];
    if (!sessionUser?.role || !adminRoles.includes(sessionUser.role)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    const batchSize = Math.min(Number(req.body?.batchSize) || 10, 50);
    const mode = (req.body?.mode as string) || "missing";

    if (articleBackfillRunning) {
      return res.json({ status: "already_running" });
    }

    let adminCityId: string | null = null;
    if (sessionUser.role === "CITY_ADMIN") {
      const [adminUser] = await db.select({ cityId: users.cityId }).from(users).where(eq(users.id, sessionUserId)).limit(1);
      adminCityId = adminUser?.cityId || null;
    }

    if (mode === "stale_archive") {
      const superRoles = ["PLATFORM_ADMIN", "SUPER_ADMIN"];
      if (!superRoles.includes(sessionUser.role)) {
        return res.status(403).json({ error: "Stale archive requires platform-level admin access" });
      }
      articleBackfillRunning = true;
      res.json({ status: "started", mode });
      (async () => {
        try {
          const { runStaleArchival } = await import("./services/content-archival");
          const stats = await runStaleArchival();
          console.log(`[StaleArchiveBackfill] Complete:`, stats);
        } catch (err: unknown) {
          console.error(`[StaleArchiveBackfill] Failed:`, err instanceof Error ? err.message : err);
        }
        articleBackfillRunning = false;
      })();
      return;
    }

    if (mode === "dedup_consolidate") {
      articleBackfillRunning = true;

      const { getDedupStats } = await import("./services/retroactive-dedup");
      const preStats = await getDedupStats(adminCityId);

      res.json({
        status: "started",
        mode,
        totalCandidates: preStats.totalItems,
        alreadySuppressed: preStats.suppressedItems,
        existingClusters: preStats.duplicateClusters,
      });

      (async () => {
        try {
          const { runRetroactiveDedup } = await import("./services/retroactive-dedup");
          const stats = await runRetroactiveDedup(adminCityId);
          console.log(`[DedupConsolidateBackfill] Complete: scanned=${stats.totalScanned}, clusters=${stats.clustersFound}, suppressed=${stats.itemsSuppressed}`);
        } catch (err: unknown) {
          console.error(`[DedupConsolidateBackfill] Failed:`, err instanceof Error ? err.message : err);
        }
        articleBackfillRunning = false;
      })();
      return;
    }

    if (mode === "venue_link") {
      articleBackfillRunning = true;
      const venueLinkWhere = and(
        sql`NULLIF(TRIM(${events.venueName}), '') IS NOT NULL`,
        sql`${events.venuePresenceId} IS NULL`,
        ...(adminCityId ? [eq(events.cityId, adminCityId)] : []),
      );
      const eventsToLink = await db.select({
        id: events.id,
        venueName: events.venueName,
        address: events.address,
        city: events.city,
        state: events.state,
        cityId: events.cityId,
      }).from(events).where(venueLinkWhere).limit(batchSize);

      if (eventsToLink.length === 0) {
        articleBackfillRunning = false;
        return res.json({ status: "complete", processed: 0, remaining: 0 });
      }

      const totalRemaining = await db.select({ count: drizzleCount() }).from(events).where(venueLinkWhere);

      res.json({ status: "started", mode, batchSize: eventsToLink.length, remaining: (totalRemaining[0]?.count || 0) - eventsToLink.length });

      (async () => {
        let linked = 0;
        for (const evt of eventsToLink) {
          try {
            const { resolveOrCreateVenuePresence } = await import("./lib/venue-discovery");
            const result = await resolveOrCreateVenuePresence(
              evt.venueName!,
              evt.address || null,
              evt.city || "Charlotte",
              evt.state || "NC",
              evt.cityId,
            );
            if (result) {
              await db.update(events).set({ venuePresenceId: result.businessId, updatedAt: new Date() }).where(eq(events.id, evt.id));
              linked++;
              console.log(`[VenueLinkBackfill] Linked event "${evt.venueName}" to presence ${result.businessId}${result.created ? " (new)" : ""}`);
            }
          } catch (err: unknown) {
            console.error(`[VenueLinkBackfill] Failed for event ${evt.id}:`, err instanceof Error ? err.message : err);
          }
        }
        articleBackfillRunning = false;
        console.log(`[VenueLinkBackfill] Batch complete: ${linked}/${eventsToLink.length} events linked`);
      })();
      return;
    }

    if (mode === "geo_backfill") {
      articleBackfillRunning = true;
      const geoBackfillWhere = and(
        or(
          sql`${businesses.zip} IS NULL`,
          eq(businesses.needsZoneReview, true),
        ),
        ...(adminCityId ? [eq(businesses.cityId, adminCityId)] : []),
      );
      const bizToFix = await db.select({
        id: businesses.id,
        address: businesses.address,
        googlePlaceId: businesses.googlePlaceId,
        zip: businesses.zip,
        needsZoneReview: businesses.needsZoneReview,
      }).from(businesses).where(geoBackfillWhere).limit(batchSize);

      if (bizToFix.length === 0) {
        articleBackfillRunning = false;
        return res.json({ status: "complete", processed: 0, remaining: 0 });
      }

      const totalRemaining = await db.select({ count: drizzleCount() }).from(businesses).where(geoBackfillWhere);

      res.json({ status: "started", mode, batchSize: bizToFix.length, remaining: (totalRemaining[0]?.count || 0) - bizToFix.length });

      (async () => {
        let fixed = 0;
        for (const biz of bizToFix) {
          try {
            const { backfillBusinessGeo } = await import("./lib/venue-discovery");
            const updated = await backfillBusinessGeo(biz.id);
            if (updated) fixed++;
          } catch (err: unknown) {
            console.error(`[GeoBackfill] Failed for business ${biz.id}:`, err instanceof Error ? err.message : err);
          }
        }
        articleBackfillRunning = false;
        console.log(`[GeoBackfill] Batch complete: ${fixed}/${bizToFix.length} businesses updated`);
      })();
      return;
    }

    const SHORT_ARTICLE_THRESHOLD = 1500;

    let whereCondition;
    if (mode === "event_extract") {
      whereCondition = and(
        eq(rssItems.reviewStatus, "APPROVED"),
        sql`${rssItems.localArticleBody} IS NOT NULL`,
        sql`NOT (COALESCE(${rssItems.integrityFlags}::text, '[]')::jsonb @> '"events_extracted"'::jsonb)`
      );
    } else if (mode === "zone_retag") {
      whereCondition = and(
        eq(rssItems.reviewStatus, "APPROVED"),
        sql`${rssItems.localArticleBody} IS NOT NULL`,
        sql`NOT (COALESCE(${rssItems.integrityFlags}::text, '[]')::jsonb @> '"zone_retagged"'::jsonb)`
      );
    } else if (mode === "short") {
      whereCondition = and(
        eq(rssItems.reviewStatus, "APPROVED"),
        sql`${rssItems.localArticleBody} IS NOT NULL`,
        sql`LENGTH(${rssItems.localArticleBody}) < ${SHORT_ARTICLE_THRESHOLD}`
      );
    } else if (mode === "cms_only") {
      whereCondition = and(
        eq(rssItems.reviewStatus, "APPROVED"),
        sql`${rssItems.localArticleBody} IS NOT NULL`,
        sql`LENGTH(${rssItems.localArticleBody}) >= ${SHORT_ARTICLE_THRESHOLD}`,
        isNull(rssItems.cmsContentItemId)
      );
    } else {
      whereCondition = and(
        eq(rssItems.reviewStatus, "APPROVED"),
        isNull(rssItems.localArticleBody)
      );
    }

    if (adminCityId) {
      whereCondition = and(whereCondition, eq(rssItems.cityId, adminCityId));
    }

    const pending = await db
      .select({
        id: rssItems.id,
        cityId: rssItems.cityId,
        title: rssItems.title,
        summary: rssItems.summary,
        sourceName: rssItems.sourceName,
        url: rssItems.url,
        zoneSlug: rssItems.zoneSlug,
        countySlug: rssItems.countySlug,
        imageUrl: rssItems.imageUrl,
        rewrittenSummary: rssItems.rewrittenSummary,
        localArticleBody: rssItems.localArticleBody,
        localArticleSlug: rssItems.localArticleSlug,
        cmsContentItemId: rssItems.cmsContentItemId,
      })
      .from(rssItems)
      .where(whereCondition)
      .limit(batchSize);

    if (pending.length === 0) {
      return res.json({ status: "complete", processed: 0, remaining: 0 });
    }

    articleBackfillRunning = true;

    const totalRemaining = await db
      .select({ count: drizzleCount() })
      .from(rssItems)
      .where(whereCondition);

    res.json({
      status: "started",
      mode,
      batchSize: pending.length,
      remaining: (totalRemaining[0]?.count || 0) - pending.length,
    });

    (async () => {
      let processed = 0;
      let cmsCreated = 0;
      for (const item of pending) {
        try {
          if (mode === "event_extract") {
            try {
              const { extractAndCreateEventsFromArticle } = await import("./lib/ai-content");
              const eventIds = await extractAndCreateEventsFromArticle({
                rssItemId: item.id,
                cityId: item.cityId,
                title: item.title,
                summary: item.rewrittenSummary || item.summary,
                articleBody: item.localArticleBody,
                sourceUrl: item.url || "",
                sourceName: item.sourceName || "Unknown",
                primaryZoneSlug: item.zoneSlug || null,
              });

              const existingFlags: string[] = await db.select({ f: rssItems.integrityFlags })
                .from(rssItems).where(eq(rssItems.id, item.id)).limit(1)
                .then(r => (r[0]?.f || []) as string[]);
              const updatedFlags = [...new Set([...existingFlags, "events_extracted"])];

              await db.update(rssItems).set({
                integrityFlags: updatedFlags,
                updatedAt: new Date(),
              }).where(eq(rssItems.id, item.id));

              if (eventIds.length > 0) {
                console.log(`[EventExtractBackfill] Created ${eventIds.length} events from "${item.title}"`);
              }
              processed++;
            } catch (evtErr: unknown) {
              console.error(`[EventExtractBackfill] Failed for "${item.title}":`, evtErr instanceof Error ? evtErr.message : evtErr);
            }
            continue;
          }

          if (mode === "zone_retag") {
            try {
              const { aiExtractZoneSlugs } = await import("./lib/ai-content");
              const multiZone = await aiExtractZoneSlugs(item.title, item.rewrittenSummary || item.summary, item.localArticleBody);
              const primary = multiZone.zoneSlugs[0] || item.zoneSlug || null;
              const secondary = multiZone.zoneSlugs.length > 1
                ? (multiZone.zoneSlugs.find(s => s !== primary) || null)
                : null;

              let derivedCounty = multiZone.countySlug;
              const finalPrimary = primary || item.zoneSlug;
              if (!derivedCounty && finalPrimary) {
                const [zoneRow] = await db.select({ county: zones.county }).from(zones).where(eq(zones.slug, finalPrimary)).limit(1);
                if (zoneRow?.county) {
                  derivedCounty = zoneRow.county.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-county";
                }
              }

              const existingFlags: string[] = await db.select({ f: rssItems.integrityFlags })
                .from(rssItems).where(eq(rssItems.id, item.id)).limit(1)
                .then(r => (r[0]?.f || []) as string[]);
              const updatedFlags = [...new Set([...existingFlags, "zone_retagged"])];

              await db.update(rssItems).set({
                zoneSlug: finalPrimary,
                geoPrimarySlug: finalPrimary,
                geoSecondarySlug: secondary,
                countySlug: derivedCounty || item.countySlug,
                integrityFlags: updatedFlags,
                updatedAt: new Date(),
              }).where(eq(rssItems.id, item.id));

              if (primary) {
                const { applyFullTagStack } = await import("./services/content-tagger");
                await applyFullTagStack("rss_item", item.id, {
                  cityId: item.cityId,
                  zoneSlug: primary,
                  additionalZoneSlugs: multiZone.zoneSlugs.filter(s => s !== primary),
                  countySlug: derivedCounty || undefined,
                  title: item.title,
                });
              }
              processed++;
            } catch (zoneErr: unknown) {
              console.error(`[ZoneRetag] Failed for "${item.title}":`, zoneErr instanceof Error ? zoneErr.message : zoneErr);
            }
            continue;
          }

          let localBody = item.localArticleBody;
          let localSlug = item.localArticleSlug;
          let seoTitle: string | null = null;
          let excerpt: string | null = null;

          const needsRegeneration = !localBody || localBody.length < SHORT_ARTICLE_THRESHOLD;

          if (needsRegeneration) {
            let zoneName: string | null = null;
            if (item.zoneSlug) {
              const z = await db.select({ name: zones.name }).from(zones).where(eq(zones.slug, item.zoneSlug)).limit(1);
              zoneName = z[0]?.name || null;
            }
            const article = await aiGenerateLocalArticle(
              item.title,
              item.summary,
              item.sourceName || "News",
              item.url || "",
              zoneName
            );
            localBody = article.body;
            localSlug = article.slug;
            seoTitle = article.seoTitle || null;
            excerpt = article.excerpt || null;

            let finalSlug = localSlug;
            const existingSlug = await db.select({ id: rssItems.id }).from(rssItems).where(and(eq(rssItems.localArticleSlug, finalSlug), sql`${rssItems.id} != ${item.id}`)).limit(1);
            if (existingSlug.length > 0) {
              finalSlug = `${finalSlug}-${item.id.substring(0, 8)}`;
            }
            localSlug = finalSlug;

            await db.update(rssItems).set({
              localArticleSlug: localSlug,
              localArticleBody: localBody,
              aiGeneratedTitle: seoTitle,
              aiGeneratedSummary: excerpt,
              updatedAt: new Date(),
            }).where(eq(rssItems.id, item.id));
          }

          if (localBody) {
            const freshRow = await db.select({
              aiGeneratedTitle: rssItems.aiGeneratedTitle,
              aiGeneratedSummary: rssItems.aiGeneratedSummary,
              cmsContentItemId: rssItems.cmsContentItemId,
            }).from(rssItems).where(eq(rssItems.id, item.id)).limit(1);
            const storedSeoTitle = seoTitle || freshRow[0]?.aiGeneratedTitle || null;
            const storedExcerpt = excerpt || freshRow[0]?.aiGeneratedSummary || null;
            const existingCmsId = freshRow[0]?.cmsContentItemId || item.cmsContentItemId;

            if (existingCmsId && needsRegeneration) {
              await storage.updateCmsContentItem(existingCmsId, {
                bodyEn: localBody,
                titleEn: storedSeoTitle || item.title,
                excerptEn: storedExcerpt,
                seoTitleEn: storedSeoTitle || item.title,
                seoDescriptionEn: storedExcerpt,
                updatedAt: new Date(),
              });
              cmsCreated++;
            } else if (!existingCmsId) {
              let cmsSlug = localSlug;
              if (!cmsSlug) {
                cmsSlug = item.title
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/^-|-$/g, "")
                  .substring(0, 80);
              }

              const { createCmsFromRssItem } = await import("./lib/ai-content");
              const cmsId = await createCmsFromRssItem({
                rssItemId: item.id,
                cityId: item.cityId,
                title: item.title,
                slug: cmsSlug,
                body: localBody,
                excerpt: storedExcerpt,
                seoTitle: storedSeoTitle,
                imageUrl: item.imageUrl || null,
                sourceName: item.sourceName || "News",
                sourceUrl: item.url || "",
                zoneSlug: item.zoneSlug || null,
                rewrittenSummary: item.rewrittenSummary || null,
              });
              if (cmsId) cmsCreated++;
            }
          }

          processed++;
          console.log(`[ArticleBackfill] ${processed}/${pending.length}: "${item.title.substring(0, 50)}..." (${needsRegeneration ? "regenerated" : "cms-only"})`);
        } catch (err: any) {
          console.error(`[ArticleBackfill] Failed for ${item.id}:`, err.message);
        }
      }
      articleBackfillRunning = false;
      console.log(`[ArticleBackfill] Batch complete: ${processed}/${pending.length} articles processed, ${cmsCreated} CMS entries created`);
    })();
  } catch (err: any) {
    articleBackfillRunning = false;
    console.error("[ArticleBackfill] Error:", err.message);
    return res.status(500).json({ error: "Failed to start backfill" });
  }
});

let aiClassifyBackfillRunning = false;

router.post("/api/admin/rss/ai-classify-backfill", async (req: Request, res: Response) => {
  const sessionUserId = (req.session as any)?.userId;
  if (!sessionUserId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const [sessionUser] = await db.select({ role: users.role }).from(users).where(eq(users.id, sessionUserId)).limit(1);
    const adminRoles = ["PLATFORM_ADMIN", "SUPER_ADMIN", "CITY_ADMIN"];
    if (!sessionUser?.role || !adminRoles.includes(sessionUser.role)) {
      return res.status(403).json({ error: "Admin access required" });
    }
  } catch {
    return res.status(403).json({ error: "Admin access required" });
  }
  try {
    if (aiClassifyBackfillRunning) {
      return res.json({ status: "already_running", message: "AI classify backfill is already in progress" });
    }

    const batchSize = Math.min(200, Math.max(1, parseInt(req.body?.batchSize) || 50));
    const forceReclassify = !!req.body?.forceReclassify;

    const whereClause = forceReclassify
      ? and(eq(rssItems.reviewStatus, "APPROVED"))
      : and(eq(rssItems.reviewStatus, "APPROVED"), isNull(rssItems.aiClassifiedAt));

    const pending = await db
      .select({
        id: rssItems.id,
        title: rssItems.title,
        summary: rssItems.summary,
        rewrittenSummary: rssItems.rewrittenSummary,
        localArticleBody: rssItems.localArticleBody,
        sourceName: rssItems.sourceName,
        url: rssItems.url,
        categoriesJson: rssItems.categoriesJson,
        categoryCoreSlug: rssItems.categoryCoreSlug,
        categorySubSlug: rssItems.categorySubSlug,
        geoPrimarySlug: rssItems.geoPrimarySlug,
        geoSecondarySlug: rssItems.geoSecondarySlug,
        hubSlug: rssItems.hubSlug,
        countySlug: rssItems.countySlug,
        venueName: rssItems.venueName,
        contentType: rssItems.contentType,
        policyStatus: rssItems.policyStatus,
        lastEditedBy: rssItems.lastEditedBy,
      })
      .from(rssItems)
      .where(whereClause)
      .orderBy(desc(rssItems.publishedAt))
      .limit(batchSize);

    if (pending.length === 0) {
      return res.json({ status: "complete", message: "No items to classify", processed: 0, total: 0 });
    }

    aiClassifyBackfillRunning = true;
    const total = pending.length;
    res.json({ status: "started", message: `Processing ${total} items`, total });

    (async () => {
      let processed = 0;
      let errors = 0;
      for (const item of pending) {
        try {
          await classifyAndWriteback(
            item.id,
            {
              title: item.title,
              summary: item.rewrittenSummary || item.summary,
              body: item.localArticleBody,
              sourceName: item.sourceName,
              sourceUrl: item.url,
              categoriesJson: item.categoriesJson,
            },
            {
              categoryCoreSlug: item.categoryCoreSlug,
              categorySubSlug: item.categorySubSlug,
              geoPrimarySlug: item.geoPrimarySlug,
              geoSecondarySlug: item.geoSecondarySlug,
              hubSlug: item.hubSlug,
              countySlug: item.countySlug,
              venueName: item.venueName,
              contentType: item.contentType,
              policyStatus: item.policyStatus,
              lastEditedBy: item.lastEditedBy,
            }
          );
          processed++;
          if (processed % 10 === 0) {
            console.log(`[AI Classify Backfill] ${processed}/${total} items classified`);
          }
        } catch (err: unknown) {
          errors++;
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[AI Classify Backfill] Failed for ${item.id}:`, msg);
        }
      }
      aiClassifyBackfillRunning = false;
      console.log(`[AI Classify Backfill] Complete: ${processed}/${total} classified, ${errors} errors`);
    })();
  } catch (err: unknown) {
    aiClassifyBackfillRunning = false;
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[AI Classify Backfill] Error:", msg);
    return res.status(500).json({ error: "Failed to start AI classify backfill" });
  }
});

export default router;
