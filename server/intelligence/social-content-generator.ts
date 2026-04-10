import { db } from "../db";
import { sql, eq, and, desc, inArray } from "drizzle-orm";
import { openai } from "../lib/openai";
import {
  socialPosts, businesses, events, articles, posts,
  cities, intelligenceEventLog,
} from "@shared/schema";
import { buildCityBranding, type CityRecord, type CityBranding } from "@shared/city-branding";
import { buildSocialCaptionSystem } from "../ai/prompts/platform-services";

const PLATFORM_LIMITS: Record<string, number> = {
  twitter: 280,
  instagram: 2200,
  facebook: 63206,
  tiktok: 2200,
  youtube: 5000,
  all: 2200,
};

interface SocialCandidate {
  sourceType: string;
  sourceId: string;
  title: string;
  description: string;
  imageUrl: string | null;
  categoryHint: string | null;
}

async function getExistingSourceIds(metroId: string): Promise<Set<string>> {
  const existing = await db.select({ sourceId: socialPosts.sourceId })
    .from(socialPosts)
    .where(and(
      eq(socialPosts.metroId, metroId),
      inArray(socialPosts.status, ["draft", "approved"]),
    ));
  const ids = existing.filter(e => e.sourceId).map(e => e.sourceId!);
  return new Set(ids);
}

async function getTopPulsePosts(metroId: string): Promise<SocialCandidate[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const rows = await db.execute(sql`
    SELECT p.id, p.title, p.body, p.cover_image_url, p.primary_tag,
      (SELECT COUNT(*) FROM intelligence_event_log e
       WHERE e.entity_id = p.id AND e.event_type IN ('SAVE', 'FEED_CARD_SAVE', 'FEED_CARD_LIKE')
       AND e.created_at > ${sevenDaysAgo}) as engagement_count
    FROM posts p
    WHERE p.city_id = ${metroId}
      AND p.status = 'approved'
      AND p.created_at > ${sevenDaysAgo}
    ORDER BY engagement_count DESC
    LIMIT 5
  `);

  return rows.rows
    .filter((r: any) => Number(r.engagement_count) >= 2)
    .map((r: any) => ({
      sourceType: "post",
      sourceId: r.id,
      title: r.title || "",
      description: r.body?.substring(0, 500) || "",
      imageUrl: r.cover_image_url || null,
      categoryHint: r.primary_tag || null,
    }));
}

async function getRecentlyClaimedBusinesses(metroId: string): Promise<SocialCandidate[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const rows = await db.select({
    id: businesses.id,
    name: businesses.name,
    description: businesses.description,
    imageUrl: businesses.imageUrl,
  })
    .from(businesses)
    .where(and(
      eq(businesses.cityId, metroId),
      sql`${businesses.claimedAt} > ${sevenDaysAgo}`,
      sql`${businesses.claimedByUserId} IS NOT NULL`,
    ))
    .orderBy(desc(businesses.claimedAt))
    .limit(5);

  return rows.map(r => ({
    sourceType: "business",
    sourceId: r.id,
    title: r.name,
    description: r.description?.substring(0, 500) || "",
    imageUrl: r.imageUrl || null,
    categoryHint: null,
  }));
}

async function getUpcomingPopularEvents(metroId: string): Promise<SocialCandidate[]> {
  const now = new Date();
  const twoWeeksOut = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  const rows = await db.select({
    id: events.id,
    title: events.title,
    description: events.description,
    imageUrl: events.imageUrl,
    startDateTime: events.startDateTime,
  })
    .from(events)
    .where(and(
      eq(events.cityId, metroId),
      sql`${events.startDateTime} > ${now}`,
      sql`${events.startDateTime} < ${twoWeeksOut}`,
    ))
    .orderBy(events.startDateTime)
    .limit(5);

  return rows.map(r => ({
    sourceType: "event",
    sourceId: r.id,
    title: r.title,
    description: r.description?.substring(0, 500) || "",
    imageUrl: r.imageUrl || null,
    categoryHint: null,
  }));
}

async function getRecentArticles(metroId: string): Promise<SocialCandidate[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const rows = await db.select({
    id: articles.id,
    title: articles.title,
    excerpt: articles.excerpt,
    imageUrl: articles.imageUrl,
  })
    .from(articles)
    .where(and(
      eq(articles.cityId, metroId),
      sql`${articles.publishedAt} > ${sevenDaysAgo}`,
      sql`${articles.publishedAt} IS NOT NULL`,
    ))
    .orderBy(desc(articles.publishedAt))
    .limit(5);

  return rows.map(r => ({
    sourceType: "article",
    sourceId: r.id,
    title: r.title,
    description: r.excerpt?.substring(0, 500) || "",
    imageUrl: r.imageUrl || null,
    categoryHint: null,
  }));
}

function buildCategoryHashtags(categoryHint: string | null): string[] {
  if (!categoryHint) return [];
  const tag = categoryHint
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .split(" ")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
  return tag ? [`#${tag}`] : [];
}

async function generateCaptionWithAI(
  candidate: SocialCandidate,
  cityName: string,
  branding?: CityBranding
): Promise<{ caption: string; hashtags: string[] } | null> {
  const localHashtags = branding?.hashtags || [`#${cityName.replace(/\s+/g, "")}`];
  if (!openai) {
    return generateFallbackCaption(candidate, cityName, branding);
  }

  try {
    const sourceLabel = candidate.sourceType === "business" ? "newly claimed business"
      : candidate.sourceType === "event" ? "upcoming event"
      : candidate.sourceType === "article" ? "article/roundup"
      : "community post";

    const brandName = branding?.brandShort || `${cityName} Metro Hub`;
    const hashtagHint = localHashtags.slice(0, 2).join(" ");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: buildSocialCaptionSystem(cityName),
        },
        {
          role: "user",
          content: `Write a social media caption for this ${sourceLabel}:\nTitle: ${candidate.title}\nDescription: ${candidate.description}\nCity: ${cityName}\nPlatform: ${brandName}\n\nInclude local hashtags like ${hashtagHint} and relevant category hashtags. Return as JSON: { "caption": "...", "hashtags": ["#tag1", "#tag2"] }`,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 300,
      temperature: 0.8,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return generateFallbackCaption(candidate, cityName, branding);

    const parsed = JSON.parse(content);
    const hashtags = [
      ...localHashtags,
      ...buildCategoryHashtags(candidate.categoryHint),
      ...(parsed.hashtags || []).filter((h: string) => !localHashtags.includes(h)),
    ];
    return {
      caption: parsed.caption || candidate.title,
      hashtags: Array.from(new Set(hashtags)),
    };
  } catch (err: any) {
    console.error("[SocialGen] OpenAI error:", err.message);
    return generateFallbackCaption(candidate, cityName, branding);
  }
}

function generateFallbackCaption(
  candidate: SocialCandidate,
  cityName: string,
  branding?: CityBranding
): { caption: string; hashtags: string[] } {
  const brandName = branding?.brandShort || `${cityName} Metro Hub`;
  const localHashtags = branding?.hashtags || [`#${cityName.replace(/\s+/g, "")}`];
  let caption: string;

  switch (candidate.sourceType) {
    case "business":
      caption = `Welcome to ${cityName}, ${candidate.title}! We're excited to have you on ${brandName}.`;
      break;
    case "event":
      caption = `Don't miss: ${candidate.title} — happening soon in ${cityName}.`;
      break;
    case "article":
      caption = `New on ${brandName}: ${candidate.title}. Read the full story.`;
      break;
    default:
      caption = `${candidate.title} — trending in ${cityName} right now.`;
  }

  const hashtags = [
    ...localHashtags,
    ...buildCategoryHashtags(candidate.categoryHint),
  ];

  return { caption, hashtags: Array.from(new Set(hashtags)) };
}

export async function generateSocialPosts(filterMetroId?: string): Promise<number> {
  console.log("[SocialGen] Starting social content generation...");
  const query = db.select({
    id: cities.id,
    name: cities.name,
    slug: cities.slug,
    cityCode: cities.cityCode,
    brandName: cities.brandName,
    aiGuideName: cities.aiGuideName,
    siteUrl: cities.siteUrl,
    emailDomain: cities.emailDomain,
  }).from(cities);
  const allCities = filterMetroId
    ? await query.where(eq(cities.id, filterMetroId))
    : await query;
  let totalCreated = 0;

  for (const city of allCities) {
    try {
      const branding = buildCityBranding(city);
      const existingIds = await getExistingSourceIds(city.id);

      const candidates: SocialCandidate[] = [];
      const [pulsePosts, claimedBiz, upcomingEvents, recentArticles] = await Promise.all([
        getTopPulsePosts(city.id),
        getRecentlyClaimedBusinesses(city.id),
        getUpcomingPopularEvents(city.id),
        getRecentArticles(city.id),
      ]);

      candidates.push(...pulsePosts, ...claimedBiz, ...upcomingEvents, ...recentArticles);

      const deduped = candidates.filter(c => !existingIds.has(c.sourceId ?? ""));

      for (const candidate of deduped) {
        const result = await generateCaptionWithAI(candidate, city.name, branding);
        if (!result) continue;

        await db.insert(socialPosts).values({
          metroId: city.id,
          sourceType: candidate.sourceType,
          sourceId: candidate.sourceId,
          platform: "all",
          caption: result.caption,
          hashtags: result.hashtags,
          imageUrl: candidate.imageUrl,
          status: "draft",
          createdBy: "charlotte",
        });
        totalCreated++;
      }

      if (deduped.length > 0) {
        console.log(`[SocialGen] ${city.name}: ${deduped.length} social posts created`);
      }
    } catch (err: any) {
      console.error(`[SocialGen] Error for ${city.name}:`, err.message);
    }
  }

  console.log(`[SocialGen] Complete: ${totalCreated} social posts created`);
  return totalCreated;
}

export async function generateFromContent(
  metroId: string,
  sourceType: string,
  sourceId: string
): Promise<{ caption: string; hashtags: string[]; imageUrl: string | null } | null> {
  const cityRows = await db.select({
    name: cities.name,
    slug: cities.slug,
    cityCode: cities.cityCode,
    brandName: cities.brandName,
    aiGuideName: cities.aiGuideName,
    siteUrl: cities.siteUrl,
    emailDomain: cities.emailDomain,
  }).from(cities).where(eq(cities.id, metroId)).limit(1);
  const cityRow = cityRows[0];
  const cityName = cityRow?.name || "Charlotte";
  const branding = cityRow ? buildCityBranding(cityRow) : undefined;

  let candidate: SocialCandidate | null = null;

  if (sourceType === "business") {
    const [biz] = await db.select().from(businesses).where(eq(businesses.id, sourceId));
    if (biz) {
      candidate = {
        sourceType: "business",
        sourceId: biz.id,
        title: biz.name,
        description: biz.description?.substring(0, 500) || "",
        imageUrl: biz.imageUrl || null,
        categoryHint: null,
      };
    }
  } else if (sourceType === "event") {
    const [evt] = await db.select().from(events).where(eq(events.id, sourceId));
    if (evt) {
      candidate = {
        sourceType: "event",
        sourceId: evt.id,
        title: evt.title,
        description: evt.description?.substring(0, 500) || "",
        imageUrl: evt.imageUrl || null,
        categoryHint: null,
      };
    }
  } else if (sourceType === "article") {
    const [art] = await db.select().from(articles).where(eq(articles.id, sourceId));
    if (art) {
      candidate = {
        sourceType: "article",
        sourceId: art.id,
        title: art.title,
        description: art.excerpt?.substring(0, 500) || "",
        imageUrl: art.imageUrl || null,
        categoryHint: null,
      };
    }
  } else if (sourceType === "post") {
    const [post] = await db.select().from(posts).where(eq(posts.id, sourceId));
    if (post) {
      candidate = {
        sourceType: "post",
        sourceId: post.id,
        title: post.title || "",
        description: post.body?.substring(0, 500) || "",
        imageUrl: post.coverImageUrl || null,
        categoryHint: null,
      };
    }
  }

  if (!candidate) return null;

  const result = await generateCaptionWithAI(candidate, cityName, branding);
  if (!result) return null;

  return {
    caption: result.caption,
    hashtags: result.hashtags,
    imageUrl: candidate.imageUrl,
  };
}
