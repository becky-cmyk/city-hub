import { db } from "../db";
import { events, businesses, articles, cities } from "@shared/schema";
import { eq, desc, gte, and } from "drizzle-orm";

interface ContentSource {
  type: "event" | "business" | "article";
  id: string;
  name: string;
  excerpt: string;
  imageUrl: string | null;
  reason: string;
}

export async function selectContentSources({
  metroId,
  count = 3,
}: {
  metroId: string;
  count?: number;
}): Promise<ContentSource[]> {
  const sources: ContentSource[] = [];
  const now = new Date();

  const upcomingEvents = await db
    .select({
      id: events.id,
      title: events.title,
      description: events.description,
      imageUrl: events.imageUrl,
      startDateTime: events.startDateTime,
    })
    .from(events)
    .where(and(eq(events.cityId, metroId), gte(events.startDateTime, now)))
    .orderBy(events.startDateTime)
    .limit(count);

  for (const ev of upcomingEvents) {
    sources.push({
      type: "event",
      id: ev.id,
      name: ev.title,
      excerpt: ev.description?.slice(0, 200) || "",
      imageUrl: ev.imageUrl || null,
      reason: "upcoming event with high engagement potential",
    });
  }

  if (sources.length < count) {
    const needed = count - sources.length;
    const featuredBusinesses = await db
      .select({
        id: businesses.id,
        name: businesses.name,
        description: businesses.description,
        imageUrl: businesses.imageUrl,
        isFeatured: businesses.isFeatured,
        listingTier: businesses.listingTier,
      })
      .from(businesses)
      .where(and(eq(businesses.cityId, metroId), eq(businesses.isFeatured, true)))
      .orderBy(desc(businesses.priorityRank))
      .limit(needed);

    for (const biz of featuredBusinesses) {
      sources.push({
        type: "business",
        id: biz.id,
        name: biz.name,
        excerpt: biz.description?.slice(0, 200) || "",
        imageUrl: biz.imageUrl || null,
        reason: "featured business with strong local relevance",
      });
    }

    if (sources.length < count) {
      const remaining = count - sources.length;
      const existingIds = sources.map((s) => s.id);
      const trendingBusinesses = await db
        .select({
          id: businesses.id,
          name: businesses.name,
          description: businesses.description,
          imageUrl: businesses.imageUrl,
        })
        .from(businesses)
        .where(eq(businesses.cityId, metroId))
        .orderBy(desc(businesses.priorityRank))
        .limit(remaining + existingIds.length);

      for (const biz of trendingBusinesses) {
        if (sources.length >= count) break;
        if (existingIds.includes(biz.id)) continue;
        sources.push({
          type: "business",
          id: biz.id,
          name: biz.name,
          excerpt: biz.description?.slice(0, 200) || "",
          imageUrl: biz.imageUrl || null,
          reason: "high-priority listing with community presence",
        });
      }
    }
  }

  if (sources.length < count) {
    const recentArticles = await db
      .select({
        id: articles.id,
        title: articles.title,
        excerpt: articles.excerpt,
        imageUrl: articles.imageUrl,
      })
      .from(articles)
      .where(eq(articles.cityId, metroId))
      .orderBy(desc(articles.publishedAt))
      .limit(count - sources.length);

    for (const art of recentArticles) {
      sources.push({
        type: "article",
        id: art.id,
        name: art.title,
        excerpt: art.excerpt?.slice(0, 200) || "",
        imageUrl: art.imageUrl || null,
        reason: "recent article with local community interest",
      });
    }
  }

  return sources.slice(0, count);
}
