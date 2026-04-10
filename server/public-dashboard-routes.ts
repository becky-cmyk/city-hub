import type { Express, Request, Response } from "express";
import { db } from "./db";
import {
  publicUsers, userHubs, businesses, events, articles,
  deviceSaved, notificationPreferences, activityFeedItems,
  zones, reviews, cities, submissions,
} from "@shared/schema";
import { eq, and, or, desc, inArray, gte, sql, count, isNull } from "drizzle-orm";

export interface EngagementLevel {
  level: number;
  title: string;
  titleEs: string;
  savedCount: number;
  reviewCount: number;
  submissionCount: number;
  memberDays: number;
  nextLevel: { level: number; title: string; titleEs: string; requirements: string; requirementsEs: string } | null;
}

export function computeEngagementLevel(
  savedCount: number,
  reviewCount: number,
  submissionCount: number,
  memberSince: Date,
): EngagementLevel {
  const memberDays = Math.floor((Date.now() - memberSince.getTime()) / (1000 * 60 * 60 * 24));

  const levels = [
    { level: 4, title: "Local Expert", titleEs: "Experto Local" },
    { level: 3, title: "Insider", titleEs: "Conocedor" },
    { level: 2, title: "Explorer", titleEs: "Explorador" },
    { level: 1, title: "Newcomer", titleEs: "Nuevo" },
  ];

  let currentLevel = levels[3];

  if (reviewCount >= 10 && memberDays >= 30) {
    currentLevel = levels[0];
  } else if (reviewCount >= 3 || submissionCount >= 2) {
    currentLevel = levels[1];
  } else if (savedCount >= 5 || reviewCount >= 1) {
    currentLevel = levels[2];
  }

  let nextLevel: EngagementLevel["nextLevel"] = null;
  if (currentLevel.level === 1) {
    nextLevel = { level: 2, title: "Explorer", titleEs: "Explorador", requirements: "Save 5+ items or write 1 review", requirementsEs: "Guarda 5+ elementos o escribe 1 resena" };
  } else if (currentLevel.level === 2) {
    nextLevel = { level: 3, title: "Insider", titleEs: "Conocedor", requirements: "Write 3+ reviews or make 2+ content submissions", requirementsEs: "Escribe 3+ resenas o haz 2+ envios de contenido" };
  } else if (currentLevel.level === 3) {
    nextLevel = { level: 4, title: "Local Expert", titleEs: "Experto Local", requirements: "Write 10+ reviews and be active 30+ days", requirementsEs: "Escribe 10+ resenas y permanece activo 30+ dias" };
  }

  return {
    level: currentLevel.level,
    title: currentLevel.title,
    titleEs: currentLevel.titleEs,
    savedCount,
    reviewCount,
    submissionCount,
    memberDays,
    nextLevel,
  };
}

function requirePublicUser(req: Request, res: Response): string | null {
  const userId = (req.session as any)?.publicUserId;
  if (!userId) {
    res.status(401).json({ message: "Not logged in" });
    return null;
  }
  return userId;
}

export async function publishActivityFeedItem(data: {
  cityId: string;
  zoneId?: string | null;
  feedType: "new_business" | "new_event" | "new_article" | "business_updated" | "event_upcoming" | "review_posted" | "digest_published";
  title: string;
  titleEs?: string | null;
  summary?: string | null;
  summaryEs?: string | null;
  relatedType?: string | null;
  relatedId?: string | null;
  imageUrl?: string | null;
  metadata?: Record<string, any> | null;
}) {
  try {
    await db.insert(activityFeedItems).values({
      cityId: data.cityId,
      zoneId: data.zoneId || null,
      feedType: data.feedType as any,
      title: data.title,
      titleEs: data.titleEs || null,
      summary: data.summary || null,
      summaryEs: data.summaryEs || null,
      relatedType: data.relatedType || null,
      relatedId: data.relatedId || null,
      imageUrl: data.imageUrl || null,
      metadata: data.metadata || null,
      publishedAt: new Date(),
    });
  } catch (err: any) {
    console.error("[Activity Feed] Failed to publish item:", err.message);
  }
}

export function registerPublicDashboardRoutes(app: Express) {

  app.get("/api/public/dashboard", async (req: Request, res: Response) => {
    try {
      const userId = requirePublicUser(req, res);
      if (!userId) return;

      const user = await db.select().from(publicUsers).where(eq(publicUsers.id, userId)).then(r => r[0]);
      if (!user) return res.status(404).json({ message: "User not found" });

      const hubs = await db.select().from(userHubs).where(eq(userHubs.userId, userId));

      const activeHub = hubs.find(h => h.hubType === user.activeHubType) || hubs[0];
      const hubZoneIds = hubs.map(h => h.zoneId).filter(Boolean) as string[];

      const savedItems = await db.select().from(deviceSaved).where(eq(deviceSaved.userId, userId));
      const savedCounts = {
        businesses: savedItems.filter(s => s.itemType === "BUSINESS").length,
        events: savedItems.filter(s => s.itemType === "EVENT").length,
        articles: savedItems.filter(s => s.itemType === "ARTICLE").length,
        total: savedItems.length,
      };

      let nearbyBusinessCount = 0;
      let upcomingEventCount = 0;
      let recentArticleCount = 0;

      if (activeHub?.zoneId) {
        const bizCount = await db.select({ cnt: count() }).from(businesses)
          .where(eq(businesses.zoneId, activeHub.zoneId));
        nearbyBusinessCount = bizCount[0]?.cnt || 0;

        const now = new Date();
        const evtCount = await db.select({ cnt: count() }).from(events)
          .where(and(eq(events.zoneId, activeHub.zoneId), gte(events.startDateTime, now))!);
        upcomingEventCount = evtCount[0]?.cnt || 0;

        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const zone = await db.select({ cityId: zones.cityId }).from(zones).where(eq(zones.id, activeHub.zoneId)).then(r => r[0]);
        if (zone?.cityId) {
          const artCount = await db.select({ cnt: count() }).from(articles)
            .where(and(eq(articles.cityId, zone.cityId), gte(articles.publishedAt, thirtyDaysAgo))!);
          recentArticleCount = artCount[0]?.cnt || 0;
        }
      }

      const reviewCount = await db.select({ cnt: count() }).from(reviews)
        .where(eq(reviews.userId, userId));

      const submissionCount = await db.select({ cnt: count() }).from(submissions)
        .where(eq(submissions.submitterEmail, user.email));

      const engagement = computeEngagementLevel(
        savedCounts.total,
        reviewCount[0]?.cnt || 0,
        submissionCount[0]?.cnt || 0,
        new Date(user.createdAt),
      );

      res.json({
        user: {
          displayName: user.displayName,
          email: user.email,
          accountType: user.accountType,
          activeHubType: user.activeHubType,
          memberSince: user.createdAt,
        },
        hubs: hubs.map(h => ({
          hubType: h.hubType,
          city: h.city,
          neighborhood: h.neighborhood,
          zip: h.zip,
          radiusMiles: h.radiusMiles,
          isActive: h.hubType === user.activeHubType,
        })),
        stats: {
          savedItems: savedCounts,
          nearbyBusinesses: nearbyBusinessCount,
          upcomingEvents: upcomingEventCount,
          recentArticles: recentArticleCount,
          reviewsWritten: reviewCount[0]?.cnt || 0,
        },
        engagement,
      });
    } catch (err: any) {
      console.error("[Public Dashboard] Error:", err.message);
      res.status(500).json({ message: "Failed to load dashboard" });
    }
  });

  app.get("/api/public/activity-feed", async (req: Request, res: Response) => {
    try {
      const userId = requirePublicUser(req, res);
      if (!userId) return;

      const user = await db.select().from(publicUsers).where(eq(publicUsers.id, userId)).then(r => r[0]);
      if (!user) return res.status(404).json({ message: "User not found" });

      const hubs = await db.select().from(userHubs).where(eq(userHubs.userId, userId));
      const hubZoneIds = hubs.map(h => h.zoneId).filter(Boolean) as string[];

      const hubCityIds: string[] = [];
      for (const hub of hubs) {
        if (hub.zoneId) {
          const zone = await db.select({ cityId: zones.cityId }).from(zones).where(eq(zones.id, hub.zoneId)).then(r => r[0]);
          if (zone?.cityId && !hubCityIds.includes(zone.cityId)) hubCityIds.push(zone.cityId);
        }
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      let feedItems;
      if (hubZoneIds.length > 0) {
        feedItems = await db.select().from(activityFeedItems)
          .where(and(
            or(inArray(activityFeedItems.zoneId, hubZoneIds), isNull(activityFeedItems.zoneId))!,
            hubCityIds.length > 0 ? inArray(activityFeedItems.cityId, hubCityIds) : undefined,
          )!)
          .orderBy(desc(activityFeedItems.publishedAt))
          .limit(limit)
          .offset(offset);
      } else if (hubCityIds.length > 0) {
        feedItems = await db.select().from(activityFeedItems)
          .where(inArray(activityFeedItems.cityId, hubCityIds))
          .orderBy(desc(activityFeedItems.publishedAt))
          .limit(limit)
          .offset(offset);
      } else {
        feedItems = [];
      }

      const locale = (req.query.locale as string) || "en";
      const formatted = feedItems.map(item => ({
        id: item.id,
        type: item.feedType,
        title: locale === "es" && item.titleEs ? item.titleEs : item.title,
        summary: locale === "es" && item.summaryEs ? item.summaryEs : item.summary,
        relatedType: item.relatedType,
        relatedId: item.relatedId,
        imageUrl: item.imageUrl,
        metadata: item.metadata,
        publishedAt: item.publishedAt,
      }));

      res.json({ items: formatted, count: formatted.length, offset, limit });
    } catch (err: any) {
      console.error("[Activity Feed] Error:", err.message);
      res.status(500).json({ message: "Failed to load activity feed" });
    }
  });

  app.get("/api/public/activity-feed/live", async (req: Request, res: Response) => {
    try {
      const userId = requirePublicUser(req, res);
      if (!userId) return;

      const user = await db.select().from(publicUsers).where(eq(publicUsers.id, userId)).then(r => r[0]);
      if (!user) return res.status(404).json({ message: "User not found" });

      const hubs = await db.select().from(userHubs).where(eq(userHubs.userId, userId));
      const activeHub = hubs.find(h => h.hubType === user.activeHubType) || hubs[0];
      const hubZoneIds = hubs.map(h => h.zoneId).filter(Boolean) as string[];

      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      let recentBusinesses: any[] = [];
      let upcomingEvents: any[] = [];
      let recentArticles: any[] = [];

      if (activeHub?.zoneId) {
        recentBusinesses = await db.select({
          id: businesses.id, name: businesses.name, address: businesses.address,
          listingTier: businesses.listingTier, createdAt: businesses.createdAt,
        }).from(businesses)
          .where(and(eq(businesses.zoneId, activeHub.zoneId), gte(businesses.createdAt, thirtyDaysAgo))!)
          .orderBy(desc(businesses.createdAt)).limit(10);

        upcomingEvents = await db.select({
          id: events.id, title: events.title, slug: events.slug,
          startDateTime: events.startDateTime, locationName: events.locationName,
        }).from(events)
          .where(and(eq(events.zoneId, activeHub.zoneId), gte(events.startDateTime, now))!)
          .orderBy(events.startDateTime).limit(10);
      }

      let articleCityId: string | null = null;
      if (activeHub?.zoneId) {
        const zone = await db.select({ cityId: zones.cityId }).from(zones).where(eq(zones.id, activeHub.zoneId)).then(r => r[0]);
        articleCityId = zone?.cityId || null;
      }

      if (articleCityId) {
        recentArticles = await db.select({
          id: articles.id, title: articles.title, slug: articles.slug,
          excerpt: articles.excerpt, publishedAt: articles.publishedAt,
        }).from(articles)
          .where(and(eq(articles.cityId, articleCityId), gte(articles.publishedAt, thirtyDaysAgo))!)
          .orderBy(desc(articles.publishedAt)).limit(10);
      } else {
        recentArticles = await db.select({
          id: articles.id, title: articles.title, slug: articles.slug,
          excerpt: articles.excerpt, publishedAt: articles.publishedAt,
        }).from(articles)
          .where(gte(articles.publishedAt, thirtyDaysAgo))
          .orderBy(desc(articles.publishedAt)).limit(10);
      }

      res.json({
        newBusinesses: recentBusinesses,
        upcomingEvents,
        recentArticles,
        activeHub: activeHub ? {
          hubType: activeHub.hubType,
          neighborhood: activeHub.neighborhood,
          city: activeHub.city,
          zip: activeHub.zip,
        } : null,
      });
    } catch (err: any) {
      console.error("[Live Feed] Error:", err.message);
      res.status(500).json({ message: "Failed to load live feed" });
    }
  });

  app.get("/api/public/notifications/preferences", async (req: Request, res: Response) => {
    try {
      const userId = requirePublicUser(req, res);
      if (!userId) return;

      let prefs = await db.select().from(notificationPreferences)
        .where(eq(notificationPreferences.userId, userId))
        .then(r => r[0]);

      if (!prefs) {
        const created = await db.insert(notificationPreferences).values({
          userId,
        }).returning();
        prefs = created[0];
      }

      res.json({
        newBusinesses: prefs.newBusinesses,
        newEvents: prefs.newEvents,
        newArticles: prefs.newArticles,
        weeklyDigest: prefs.weeklyDigest,
        savedItemUpdates: prefs.savedItemUpdates,
        reviewResponses: prefs.reviewResponses,
        claimUpdates: prefs.claimUpdates,
        promotions: prefs.promotions,
        emailEnabled: prefs.emailEnabled,
      });
    } catch (err: any) {
      console.error("[Notification Prefs] Error:", err.message);
      res.status(500).json({ message: "Failed to load notification preferences" });
    }
  });

  app.put("/api/public/notifications/preferences", async (req: Request, res: Response) => {
    try {
      const userId = requirePublicUser(req, res);
      if (!userId) return;

      const allowedFields = [
        "newBusinesses", "newEvents", "newArticles", "weeklyDigest",
        "savedItemUpdates", "reviewResponses", "claimUpdates",
        "promotions", "emailEnabled",
      ];

      const updates: any = { updatedAt: new Date() };
      for (const field of allowedFields) {
        if (typeof req.body[field] === "boolean") {
          updates[field] = req.body[field];
        }
      }

      let existing = await db.select().from(notificationPreferences)
        .where(eq(notificationPreferences.userId, userId))
        .then(r => r[0]);

      if (!existing) {
        await db.insert(notificationPreferences).values({ userId, ...updates });
        existing = await db.select().from(notificationPreferences)
          .where(eq(notificationPreferences.userId, userId))
          .then(r => r[0]);
      } else {
        await db.update(notificationPreferences)
          .set(updates)
          .where(eq(notificationPreferences.userId, userId));
        existing = await db.select().from(notificationPreferences)
          .where(eq(notificationPreferences.userId, userId))
          .then(r => r[0]);
      }

      const p = existing!;
      res.json({
        newBusinesses: p.newBusinesses,
        newEvents: p.newEvents,
        newArticles: p.newArticles,
        weeklyDigest: p.weeklyDigest,
        savedItemUpdates: p.savedItemUpdates,
        reviewResponses: p.reviewResponses,
        claimUpdates: p.claimUpdates,
        promotions: p.promotions,
        emailEnabled: p.emailEnabled,
      });
    } catch (err: any) {
      console.error("[Notification Prefs Update] Error:", err.message);
      res.status(500).json({ message: "Failed to update notification preferences" });
    }
  });

  app.post("/api/admin/activity-feed", async (req: Request, res: Response) => {
    if (!(req.session as any)?.userId) return res.status(401).json({ message: "Unauthorized" });

    try {
      const { cityId, zoneId, feedType, title, titleEs, summary, summaryEs, relatedType, relatedId, imageUrl, metadata } = req.body;

      if (!cityId || !feedType || !title) {
        return res.status(400).json({ message: "cityId, feedType, and title are required" });
      }

      const item = await db.insert(activityFeedItems).values({
        cityId,
        zoneId: zoneId || null,
        feedType: feedType as any,
        title,
        titleEs: titleEs || null,
        summary: summary || null,
        summaryEs: summaryEs || null,
        relatedType: relatedType || null,
        relatedId: relatedId || null,
        imageUrl: imageUrl || null,
        metadata: metadata || null,
        publishedAt: new Date(),
      }).returning();

      res.status(201).json(item[0]);
    } catch (err: any) {
      console.error("[Activity Feed Create] Error:", err.message);
      res.status(500).json({ message: "Failed to create activity feed item" });
    }
  });

  app.get("/api/public/saved-items/details", async (req: Request, res: Response) => {
    try {
      const userId = requirePublicUser(req, res);
      if (!userId) return;

      const saved = await db.select().from(deviceSaved).where(eq(deviceSaved.userId, userId));

      const businessIds = saved.filter(s => s.itemType === "BUSINESS").map(s => s.itemId);
      const eventIds = saved.filter(s => s.itemType === "EVENT").map(s => s.itemId);
      const articleIds = saved.filter(s => s.itemType === "ARTICLE").map(s => s.itemId);

      let savedBusinesses: any[] = [];
      let savedEvents: any[] = [];
      let savedArticles: any[] = [];

      if (businessIds.length > 0) {
        savedBusinesses = await db.select({
          id: businesses.id, name: businesses.name, address: businesses.address,
          city: businesses.city, listingTier: businesses.listingTier,
        }).from(businesses).where(inArray(businesses.id, businessIds));
      }

      if (eventIds.length > 0) {
        savedEvents = await db.select({
          id: events.id, title: events.title, slug: events.slug,
          startDateTime: events.startDateTime, locationName: events.locationName,
        }).from(events).where(inArray(events.id, eventIds));
      }

      if (articleIds.length > 0) {
        savedArticles = await db.select({
          id: articles.id, title: articles.title, slug: articles.slug,
          excerpt: articles.excerpt, publishedAt: articles.publishedAt,
        }).from(articles).where(inArray(articles.id, articleIds));
      }

      res.json({
        businesses: savedBusinesses,
        events: savedEvents,
        articles: savedArticles,
        counts: {
          businesses: savedBusinesses.length,
          events: savedEvents.length,
          articles: savedArticles.length,
          total: saved.length,
        },
      });
    } catch (err: any) {
      console.error("[Saved Items Details] Error:", err.message);
      res.status(500).json({ message: "Failed to load saved items" });
    }
  });

  app.get("/api/public/engagement-level", async (req: Request, res: Response) => {
    try {
      const userId = requirePublicUser(req, res);
      if (!userId) return;

      const user = await db.select().from(publicUsers).where(eq(publicUsers.id, userId)).then(r => r[0]);
      if (!user) return res.status(404).json({ message: "User not found" });

      const [savedResult, reviewResult, submissionResult] = await Promise.all([
        db.select({ cnt: count() }).from(deviceSaved).where(eq(deviceSaved.userId, userId)),
        db.select({ cnt: count() }).from(reviews).where(eq(reviews.userId, userId)),
        db.select({ cnt: count() }).from(submissions).where(eq(submissions.submitterEmail, user.email)),
      ]);

      const engagement = computeEngagementLevel(
        savedResult[0]?.cnt || 0,
        reviewResult[0]?.cnt || 0,
        submissionResult[0]?.cnt || 0,
        new Date(user.createdAt),
      );

      res.json(engagement);
    } catch (err: any) {
      console.error("[Engagement Level] Error:", err.message);
      res.status(500).json({ message: "Failed to compute engagement level" });
    }
  });

  app.get("/api/public/engagement-levels", async (req: Request, res: Response) => {
    try {
      const userIdsParam = req.query.userIds as string;
      if (!userIdsParam) return res.json({});

      const userIds = userIdsParam.split(",").filter(Boolean).slice(0, 50);
      if (userIds.length === 0) return res.json({});

      const usersData = await db.select({
        id: publicUsers.id,
        email: publicUsers.email,
        createdAt: publicUsers.createdAt,
      }).from(publicUsers).where(inArray(publicUsers.id, userIds));

      const result: Record<string, { level: number; title: string; titleEs: string }> = {};

      for (const user of usersData) {
        const [savedResult, reviewResult, submissionResult] = await Promise.all([
          db.select({ cnt: count() }).from(deviceSaved).where(eq(deviceSaved.userId, user.id)),
          db.select({ cnt: count() }).from(reviews).where(eq(reviews.userId, user.id)),
          db.select({ cnt: count() }).from(submissions).where(eq(submissions.submitterEmail, user.email)),
        ]);

        const engagement = computeEngagementLevel(
          savedResult[0]?.cnt || 0,
          reviewResult[0]?.cnt || 0,
          submissionResult[0]?.cnt || 0,
          new Date(user.createdAt),
        );

        result[user.id] = { level: engagement.level, title: engagement.title, titleEs: engagement.titleEs };
      }

      res.json(result);
    } catch (err: any) {
      console.error("[Engagement Levels Batch] Error:", err.message);
      res.status(500).json({ message: "Failed to compute engagement levels" });
    }
  });
}
