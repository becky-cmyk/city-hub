import { db } from "../db";
import { eq, and, gte, sql, ilike, desc } from "drizzle-orm";
import { charlottePublicInsights, languageUsageLog, charlottePublicMessages, charlotteFlowSessions, businesses, zones, cities } from "@shared/schema";

let intervalId: ReturnType<typeof setInterval> | null = null;
let running = false;

const TIME_WINDOWS = [
  { key: "24h", hours: 24 },
  { key: "7d", hours: 168 },
  { key: "30d", hours: 720 },
] as const;

async function aggregateTrendingSearches(cityId: string, since: Date, timeWindow: string): Promise<void> {
  const rows = await db.execute(sql`
    SELECT LOWER(TRIM(query_text)) as query, COUNT(*)::int as count
    FROM language_usage_log
    WHERE city_id = ${cityId}
      AND event_type = 'search_submit'
      AND created_at >= ${since}
      AND query_text IS NOT NULL
      AND TRIM(query_text) != ''
    GROUP BY LOWER(TRIM(query_text))
    ORDER BY count DESC
    LIMIT 25
  `);

  await db.delete(charlottePublicInsights).where(
    and(
      eq(charlottePublicInsights.insightType, "trending_search"),
      eq(charlottePublicInsights.timeWindow, timeWindow),
      eq(charlottePublicInsights.cityId, cityId),
    )
  );

  const inserts = rows.rows.map((r, i) => ({
    insightType: "trending_search" as const,
    content: { query: r.query as string, count: r.count as number },
    timeWindow,
    cityId,
    rank: i + 1,
  }));

  if (inserts.length > 0) {
    await db.insert(charlottePublicInsights).values(inserts);
  }
}

function normalizeQuestion(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

const PII_PATTERNS = [
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
  /\b\d{3}-\d{2}-\d{4}\b/,
  /\b\d{5}[-\s]\d{4}\b/,
];

function containsPII(text: string): boolean {
  return PII_PATTERNS.some(p => p.test(text));
}

function extractTopicLabel(text: string): string {
  const normalized = normalizeQuestion(text);
  const words = normalized.split(" ").filter(w => w.length > 2);
  if (words.length <= 8) return text;
  return words.slice(0, 8).join(" ") + "...";
}

function groupSimilarQuestions(rows: { content: string; count: number }[]): { question: string; count: number; variants: number }[] {
  const groups: Map<string, { representative: string; repCount: number; totalCount: number; variants: number }> = new Map();

  for (const row of rows) {
    if (containsPII(row.content)) continue;

    const normalized = normalizeQuestion(row.content);
    const words = normalized.split(" ").filter(w => w.length > 2);
    const key = words.slice(0, 5).join(" ");

    if (groups.has(key)) {
      const g = groups.get(key)!;
      g.totalCount += row.count;
      g.variants++;
      if (row.count > g.repCount) {
        g.representative = row.content;
        g.repCount = row.count;
      }
    } else {
      groups.set(key, { representative: row.content, repCount: row.count, totalCount: row.count, variants: 1 });
    }
  }

  return Array.from(groups.values())
    .filter(g => g.totalCount >= 2)
    .map(g => ({ question: extractTopicLabel(g.representative), count: g.totalCount, variants: g.variants }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

async function aggregateCommonQuestions(cityId: string, since: Date, timeWindow: string): Promise<void> {
  const rows = await db.execute(sql`
    SELECT m.content, COUNT(*)::int as count
    FROM charlotte_public_messages m
    INNER JOIN charlotte_flow_sessions f ON f.chat_session_id = m.session_id AND f.city_id = ${cityId}
    WHERE m.role = 'user'
      AND m.created_at >= ${since}
      AND LENGTH(m.content) > 10
      AND (m.content ILIKE '%?%' OR m.content ILIKE 'how %' OR m.content ILIKE 'what %' OR m.content ILIKE 'where %' OR m.content ILIKE 'when %' OR m.content ILIKE 'can %' OR m.content ILIKE 'do %' OR m.content ILIKE 'is there%')
    GROUP BY m.content
    HAVING COUNT(*) >= 2
    ORDER BY count DESC
    LIMIT 50
  `);

  const rawRows = rows.rows.map(r => ({ content: r.content as string, count: r.count as number }));
  const grouped = groupSimilarQuestions(rawRows);

  await db.delete(charlottePublicInsights).where(
    and(
      eq(charlottePublicInsights.insightType, "common_question"),
      eq(charlottePublicInsights.timeWindow, timeWindow),
      eq(charlottePublicInsights.cityId, cityId),
    )
  );

  const inserts = grouped.map((g, i) => ({
    insightType: "common_question" as const,
    content: { question: g.question, count: g.count, variants: g.variants },
    timeWindow,
    cityId,
    rank: i + 1,
  }));

  if (inserts.length > 0) {
    await db.insert(charlottePublicInsights).values(inserts);
  }
}

async function aggregateUnansweredQueries(cityId: string, since: Date, timeWindow: string): Promise<void> {
  const searchRows = await db.execute(sql`
    SELECT LOWER(TRIM(query_text)) as query, COUNT(*)::int as count
    FROM language_usage_log
    WHERE city_id = ${cityId}
      AND event_type = 'search_submit'
      AND created_at >= ${since}
      AND query_text IS NOT NULL
      AND TRIM(query_text) != ''
    GROUP BY LOWER(TRIM(query_text))
    HAVING COUNT(*) >= 2
    ORDER BY count DESC
    LIMIT 50
  `);

  const unanswered: { query: string; count: number }[] = [];

  for (const row of searchRows.rows) {
    const q = row.query as string;
    const matchingBusinesses = await db.execute(sql`
      SELECT COUNT(*)::int as cnt FROM businesses
      WHERE city_id = ${cityId}
        AND is_active = true
        AND (LOWER(name) LIKE ${"%" + q + "%"} OR LOWER(description) LIKE ${"%" + q + "%"})
      LIMIT 1
    `);

    const cnt = (matchingBusinesses.rows[0]?.cnt as number) || 0;
    if (cnt === 0) {
      unanswered.push({ query: q, count: row.count as number });
    }
    if (unanswered.length >= 15) break;
  }

  await db.delete(charlottePublicInsights).where(
    and(
      eq(charlottePublicInsights.insightType, "unanswered_query"),
      eq(charlottePublicInsights.timeWindow, timeWindow),
      eq(charlottePublicInsights.cityId, cityId),
    )
  );

  const inserts = unanswered.map((u, i) => ({
    insightType: "unanswered_query" as const,
    content: { query: u.query, count: u.count },
    timeWindow,
    cityId,
    rank: i + 1,
  }));

  if (inserts.length > 0) {
    await db.insert(charlottePublicInsights).values(inserts);
  }
}

async function aggregateDemandSignals(cityId: string, since: Date, timeWindow: string): Promise<void> {
  const searchRows = await db.execute(sql`
    SELECT LOWER(TRIM(query_text)) as query, COUNT(*)::int as count,
      source
    FROM language_usage_log
    WHERE city_id = ${cityId}
      AND event_type = 'search_submit'
      AND created_at >= ${since}
      AND query_text IS NOT NULL
      AND TRIM(query_text) != ''
    GROUP BY LOWER(TRIM(query_text)), source
    HAVING COUNT(*) >= 3
    ORDER BY count DESC
    LIMIT 30
  `);

  const flowSignalRows = await db.execute(sql`
    SELECT extracted_signals, detected_persona
    FROM charlotte_flow_sessions
    WHERE city_id = ${cityId}
      AND created_at >= ${since}
      AND extracted_signals IS NOT NULL
  `);

  const signalCounts: Map<string, { count: number; category: string; persona: string | null }> = new Map();
  for (const row of flowSignalRows.rows) {
    const rawSignals = row.extracted_signals;
    const persona = row.detected_persona as string | null;
    if (rawSignals && typeof rawSignals === "object") {
      const sigObj = rawSignals as Record<string, { signals?: { type?: string; value?: string; context?: string; confidence?: number }[] }>;
      for (const [category, catData] of Object.entries(sigObj)) {
        const sigArray = catData?.signals;
        if (!Array.isArray(sigArray)) continue;
        for (const sig of sigArray) {
          const val = sig?.value;
          if (!val || typeof val !== "string" || val.length <= 3) continue;
          const key = val.toLowerCase().trim();
          const existing = signalCounts.get(key);
          if (existing) {
            existing.count++;
          } else {
            signalCounts.set(key, { count: 1, category, persona });
          }
        }
      }
    }
  }

  const signals: { query: string; count: number; hasListings: boolean; locationHint: string | null; source: string }[] = [];

  for (const row of searchRows.rows) {
    const q = row.query as string;
    const source = row.source as string | null;

    const matchCount = await db.execute(sql`
      SELECT COUNT(*)::int as cnt FROM businesses
      WHERE city_id = ${cityId}
        AND is_active = true
        AND (LOWER(name) LIKE ${"%" + q + "%"} OR LOWER(description) LIKE ${"%" + q + "%"})
    `);

    const cnt = (matchCount.rows[0]?.cnt as number) || 0;

    let locationHint: string | null = null;
    if (source && source.startsWith("location:")) {
      const parts = source.split(":");
      locationHint = parts[2] || null;
    }

    if (cnt < 3) {
      signals.push({
        query: q,
        count: row.count as number,
        hasListings: cnt > 0,
        locationHint,
        source: "search",
      });
    }
    if (signals.length >= 15) break;
  }

  const sortedFlowSignals = Array.from(signalCounts.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10);

  for (const [key, data] of sortedFlowSignals) {
    if (!signals.find(s => s.query === key)) {
      signals.push({
        query: key,
        count: data.count,
        hasListings: false,
        locationHint: null,
        source: `flow:${data.category}`,
      });
    }
  }

  signals.sort((a, b) => b.count - a.count);

  await db.delete(charlottePublicInsights).where(
    and(
      eq(charlottePublicInsights.insightType, "demand_signal"),
      eq(charlottePublicInsights.timeWindow, timeWindow),
      eq(charlottePublicInsights.cityId, cityId),
    )
  );

  const inserts = signals.slice(0, 20).map((s, i) => ({
    insightType: "demand_signal" as const,
    content: {
      query: s.query,
      count: s.count,
      hasListings: s.hasListings,
      locationHint: s.locationHint,
      source: s.source,
    },
    timeWindow,
    cityId,
    rank: i + 1,
  }));

  if (inserts.length > 0) {
    await db.insert(charlottePublicInsights).values(inserts);
  }
}

async function aggregateHotNeighborhoods(cityId: string, since: Date, timeWindow: string): Promise<void> {
  const searchByZone = await db.execute(sql`
    SELECT z.name as zone_name, z.slug as zone_slug, COUNT(*)::int as search_count
    FROM language_usage_log l
    JOIN zones z ON z.id = l.zone_id
    WHERE l.city_id = ${cityId}
      AND l.created_at >= ${since}
      AND l.zone_id IS NOT NULL
    GROUP BY z.name, z.slug
    ORDER BY search_count DESC
    LIMIT 15
  `);

  const chatActivity = await db.execute(sql`
    SELECT COUNT(*)::int as total_messages
    FROM charlotte_public_messages m
    INNER JOIN charlotte_flow_sessions f ON f.chat_session_id = m.session_id AND f.city_id = ${cityId}
    WHERE m.created_at >= ${since}
  `);
  const totalMessages = (chatActivity.rows[0]?.total_messages as number) || 0;

  const flowActivity = await db.execute(sql`
    SELECT COUNT(*)::int as total_sessions
    FROM charlotte_flow_sessions
    WHERE city_id = ${cityId}
      AND created_at >= ${since}
  `);
  const totalSessions = (flowActivity.rows[0]?.total_sessions as number) || 0;

  await db.delete(charlottePublicInsights).where(
    and(
      eq(charlottePublicInsights.insightType, "hot_neighborhood"),
      eq(charlottePublicInsights.timeWindow, timeWindow),
      eq(charlottePublicInsights.cityId, cityId),
    )
  );

  const inserts = searchByZone.rows.map((r, i) => ({
    insightType: "hot_neighborhood" as const,
    content: {
      neighborhood: r.zone_name as string,
      slug: r.zone_slug as string,
      searchCount: r.search_count as number,
      chatMessages: totalMessages,
      flowSessions: totalSessions,
    },
    timeWindow,
    cityId,
    rank: i + 1,
  }));

  if (inserts.length > 0) {
    await db.insert(charlottePublicInsights).values(inserts);
  }
}

export async function runInsightsAggregation(): Promise<{ processed: number }> {
  const activeCities = await db
    .select({ id: cities.id })
    .from(cities)
    .where(eq(cities.isActive, true));

  let processed = 0;

  for (const city of activeCities) {
    for (const tw of TIME_WINDOWS) {
      const since = new Date(Date.now() - tw.hours * 60 * 60 * 1000);

      try {
        await aggregateTrendingSearches(city.id, since, tw.key);
        await aggregateCommonQuestions(city.id, since, tw.key);
        await aggregateUnansweredQueries(city.id, since, tw.key);
        await aggregateDemandSignals(city.id, since, tw.key);
        await aggregateHotNeighborhoods(city.id, since, tw.key);
        processed++;
      } catch (err) {
        console.error(`[InsightsWorker] Error processing city ${city.id} / ${tw.key}:`, err);
      }
    }
  }

  return { processed };
}

async function tick() {
  if (running) return;
  running = true;
  try {
    const result = await runInsightsAggregation();
    if (result.processed > 0) {
      console.log(`[InsightsWorker] Aggregated insights for ${result.processed} city/window combos`);
    }
  } catch (err) {
    console.error("[InsightsWorker] Tick error:", err);
  } finally {
    running = false;
  }
}

export function startInsightsWorker(intervalMs: number = 1800000) {
  console.log(`[InsightsWorker] Starting Charlotte insights worker (${intervalMs / 1000}s interval)`);
  tick();
  intervalId = setInterval(tick, intervalMs);
  return intervalId;
}

export function stopInsightsWorker() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
