import { db } from "../db";
import { sql, eq, and, desc } from "drizzle-orm";
import { openai } from "../lib/openai";
import {
  pulseSignals, aiContentDrafts, businesses, intelligenceEventLog, cities,
} from "@shared/schema";
import { buildSpotlightRoundupSystem, buildNewInZoneSystem, buildTrendingPostSystem } from "../ai/prompts/content-pipeline";

async function generateMostSavedRoundup(metroId: string, cityName: string): Promise<number> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const topSaved = await db.execute(sql`
    SELECT e.entity_id, b.name, b.slug, b.primary_photo_url,
      COUNT(*) as save_count,
      b.neighborhood
    FROM intelligence_event_log e
    JOIN businesses b ON b.id = e.entity_id
    WHERE e.metro_id = ${metroId}
      AND e.event_type IN ('SAVE', 'FEED_CARD_SAVE')
      AND e.created_at > ${sevenDaysAgo}
    GROUP BY e.entity_id, b.name, b.slug, b.primary_photo_url, b.neighborhood
    HAVING COUNT(*) >= 3
    ORDER BY COUNT(*) DESC
    LIMIT 8
  `);

  if (topSaved.rows.length < 3) return 0;

  const existing = await db.select({ id: aiContentDrafts.id }).from(aiContentDrafts)
    .where(and(
      eq(aiContentDrafts.metroId, metroId),
      eq(aiContentDrafts.contentType, "spotlight_roundup"),
      eq(aiContentDrafts.status, "draft"),
    )).limit(1);
  if (existing.length > 0) return 0;

  const businessList = topSaved.rows.map((r: any) => `- ${r.name} (${r.neighborhood || "citywide"}) — ${r.save_count} saves`).join("\n");

  let body = `Most saved this week in ${cityName}:\n\n${businessList}`;

  if (openai) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: buildSpotlightRoundupSystem()
          },
          {
            role: "user",
            content: `Write a "Most Saved This Week" article for ${cityName} featuring these businesses:\n${businessList}`
          },
        ],
        max_tokens: 500,
      });
      body = completion.choices[0]?.message?.content || body;
    } catch (err: any) {
      console.error("[ContentGenerator] OpenAI error:", err.message);
    }
  }

  await db.insert(aiContentDrafts).values({
    metroId,
    contentType: "spotlight_roundup",
    title: `Most Saved This Week in ${cityName}`,
    body,
    dataJson: { businesses: topSaved.rows, generatedAt: new Date().toISOString() },
  });

  return 1;
}

async function generateNewInZone(metroId: string, cityName: string): Promise<number> {
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const newBusinesses = await db.execute(sql`
    SELECT b.id, b.name, b.slug, b.description, b.neighborhood, b.primary_photo_url
    FROM businesses b
    WHERE b.city_id = ${metroId}
      AND b.claimed_by_user_id IS NOT NULL
      AND b.created_at > ${fourteenDaysAgo}
    ORDER BY b.created_at DESC
    LIMIT 6
  `);

  if (newBusinesses.rows.length < 2) return 0;

  const existing = await db.select({ id: aiContentDrafts.id }).from(aiContentDrafts)
    .where(and(
      eq(aiContentDrafts.metroId, metroId),
      eq(aiContentDrafts.contentType, "new_in_zone"),
      eq(aiContentDrafts.status, "draft"),
    )).limit(1);
  if (existing.length > 0) return 0;

  const businessList = newBusinesses.rows.map((r: any) => `- ${r.name}: ${r.description || "New to the hub"} (${r.neighborhood || "citywide"})`).join("\n");

  let body = `New in ${cityName}:\n\n${businessList}`;

  if (openai) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: buildNewInZoneSystem()
          },
          {
            role: "user",
            content: `Write a "New in ${cityName}" article introducing these businesses:\n${businessList}`
          },
        ],
        max_tokens: 400,
      });
      body = completion.choices[0]?.message?.content || body;
    } catch (err: any) {
      console.error("[ContentGenerator] OpenAI error:", err.message);
    }
  }

  await db.insert(aiContentDrafts).values({
    metroId,
    contentType: "new_in_zone",
    title: `New in ${cityName}`,
    body,
    dataJson: { businesses: newBusinesses.rows, generatedAt: new Date().toISOString() },
  });

  return 1;
}

async function generateTrendingPost(metroId: string, cityName: string): Promise<number> {
  const trendingSignals = await db.select().from(pulseSignals)
    .where(and(
      eq(pulseSignals.metroId, metroId),
      eq(pulseSignals.signalType, "TRENDING_TOPIC"),
      eq(pulseSignals.status, "new"),
    ))
    .orderBy(desc(pulseSignals.score))
    .limit(1);

  if (trendingSignals.length === 0) return 0;

  const signal = trendingSignals[0];
  const tag = (signal.dataJson as any)?.tag || "local";

  const existing = await db.select({ id: aiContentDrafts.id }).from(aiContentDrafts)
    .where(and(
      eq(aiContentDrafts.metroId, metroId),
      eq(aiContentDrafts.contentType, "trending_post"),
      eq(aiContentDrafts.status, "draft"),
    )).limit(1);
  if (existing.length > 0) return 0;

  let body = `Trending in ${cityName}: ${tag}. The community is buzzing about this topic — check out what locals are saying.`;

  if (openai) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: buildTrendingPostSystem()
          },
          {
            role: "user",
            content: `Write a trending topic post for ${cityName} about "${tag}". Recent count: ${(signal.dataJson as any)?.recentCount || 0} posts this week.`
          },
        ],
        max_tokens: 200,
      });
      body = completion.choices[0]?.message?.content || body;
    } catch (err: any) {
      console.error("[ContentGenerator] OpenAI error:", err.message);
    }
  }

  await db.insert(aiContentDrafts).values({
    metroId,
    contentType: "trending_post",
    title: `Trending in ${cityName}: ${tag}`,
    body,
    signalId: signal.id,
    dataJson: { tag, signal: signal.dataJson, generatedAt: new Date().toISOString() },
  });

  return 1;
}

export async function runContentGenerator(): Promise<number> {
  console.log("[ContentGenerator] Starting Charlotte content generation...");
  const allCities = await db.select({ id: cities.id, name: cities.name }).from(cities);
  let totalDrafts = 0;

  for (const city of allCities) {
    try {
      const d1 = await generateMostSavedRoundup(city.id, city.name);
      const d2 = await generateNewInZone(city.id, city.name);
      const d3 = await generateTrendingPost(city.id, city.name);
      const cityTotal = d1 + d2 + d3;
      totalDrafts += cityTotal;
      if (cityTotal > 0) {
        console.log(`[ContentGenerator] ${city.name}: ${cityTotal} drafts created`);
      }
    } catch (err: any) {
      console.error(`[ContentGenerator] Error for ${city.name}:`, err.message);
    }
  }

  console.log(`[ContentGenerator] Complete: ${totalDrafts} content drafts created`);
  return totalDrafts;
}
