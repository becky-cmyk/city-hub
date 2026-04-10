import { db } from "../../db";
import { eq, sql, isNull, lt, and, or, isNotNull } from "drizzle-orm";
import { businesses, entityContactVerification, entityScores } from "@shared/schema";
import { crawlEntityWebsite } from "./websiteCrawler";
import { computeEntityScores, computeAllScores } from "../scoring/entityScoring";

const CRAWL_CONCURRENCY = parseInt(process.env.CRAWL_CONCURRENCY || "3", 10);

interface CrawlStats {
  total: number;
  pending: number;
  success: number;
  failed: number;
  blocked: number;
  noWebsite: number;
}

export async function getCrawlStats(metroId?: string): Promise<CrawlStats> {
  const metroFilter = metroId
    ? sql`AND ecv.metro_id = ${metroId}`
    : sql``;

  const result = await db.execute(sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE ecv.crawl_status = 'PENDING')::int AS pending,
      COUNT(*) FILTER (WHERE ecv.crawl_status = 'SUCCESS')::int AS success,
      COUNT(*) FILTER (WHERE ecv.crawl_status = 'FAILED')::int AS failed,
      COUNT(*) FILTER (WHERE ecv.crawl_status = 'BLOCKED')::int AS blocked,
      COUNT(*) FILTER (WHERE ecv.crawl_status = 'NO_WEBSITE')::int AS no_website
    FROM entity_contact_verification ecv
    WHERE 1=1 ${metroFilter}
  `);
  const rows = (result as any).rows ?? result;
  const stats = Array.isArray(rows) ? rows[0] : rows;

  return {
    total: (stats as any)?.total || 0,
    pending: (stats as any)?.pending || 0,
    success: (stats as any)?.success || 0,
    failed: (stats as any)?.failed || 0,
    blocked: (stats as any)?.blocked || 0,
    noWebsite: (stats as any)?.no_website || 0,
  };
}

export async function getScoreDistribution(metroId?: string) {
  const metroFilter = metroId
    ? sql`AND es.metro_id = ${metroId}`
    : sql``;

  const result = await db.execute(sql`
    SELECT
      es.bucket,
      COUNT(*)::int AS count,
      ROUND(AVG(es.prospect_fit_score))::int AS avg_prospect_fit,
      ROUND(AVG(es.contact_ready_score))::int AS avg_contact_ready,
      ROUND(AVG(es.data_quality_score))::int AS avg_data_quality
    FROM entity_scores es
    WHERE 1=1 ${metroFilter}
    GROUP BY es.bucket
    ORDER BY es.bucket
  `);

  return (result as any).rows ?? result;
}

export async function enqueueCrawlJobs(metroId?: string): Promise<number> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const metroFilter = metroId
    ? sql`AND b.city_id = ${metroId}`
    : sql``;

  const result = await db.execute(sql`
    INSERT INTO entity_contact_verification (metro_id, entity_id, website_url, crawl_status)
    SELECT b.city_id, b.id,
      CASE WHEN b.website_url IS NOT NULL AND b.website_url != '' THEN b.website_url ELSE NULL END,
      CASE WHEN b.website_url IS NULL OR b.website_url = '' THEN 'NO_WEBSITE'::crawl_status ELSE 'PENDING'::crawl_status END
    FROM businesses b
    WHERE NOT EXISTS (
      SELECT 1 FROM entity_contact_verification ecv WHERE ecv.entity_id = b.id
    )
    ${metroFilter}
    ON CONFLICT (entity_id) DO NOTHING
  `);

  const insertedNew = (result as any).rowCount ?? (result as any).rows?.length ?? 0;

  const staleResult = await db.execute(sql`
    UPDATE entity_contact_verification
    SET crawl_status = 'PENDING', updated_at = NOW()
    WHERE crawl_status IN ('SUCCESS', 'FAILED')
      AND crawled_at < ${thirtyDaysAgo}
      AND website_url IS NOT NULL
      AND website_url != ''
  `);

  const websiteChangedResult = await db.execute(sql`
    UPDATE entity_contact_verification ecv
    SET crawl_status = 'PENDING',
        website_url = b.website_url,
        updated_at = NOW()
    FROM businesses b
    WHERE ecv.entity_id = b.id
      AND b.website_url IS NOT NULL
      AND b.website_url != ''
      AND ecv.website_url IS DISTINCT FROM b.website_url
      AND ecv.crawl_status != 'PENDING'
  `);

  const refreshedStale = (staleResult as any).rowCount ?? (staleResult as any).rows?.length ?? 0;
  const websiteChanged = (websiteChangedResult as any).rowCount ?? (websiteChangedResult as any).rows?.length ?? 0;

  const total = insertedNew + refreshedStale + websiteChanged;
  console.log(`[CrawlJobRunner] Enqueued: ${insertedNew} new + ${refreshedStale} stale + ${websiteChanged} website-changed = ${total} total`);
  return total;
}

export async function processCrawlQueue(limit: number = 50): Promise<{ processed: number; succeeded: number; failed: number }> {
  const enabled = process.env.ENABLE_WEBSITE_CRAWL !== "false";
  if (!enabled) {
    console.log("[CrawlJobRunner] Website crawling is disabled (ENABLE_WEBSITE_CRAWL=false)");
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  const pending = await db.select({
    id: entityContactVerification.id,
    entityId: entityContactVerification.entityId,
    websiteUrl: entityContactVerification.websiteUrl,
    metroId: entityContactVerification.metroId,
  })
    .from(entityContactVerification)
    .where(eq(entityContactVerification.crawlStatus, "PENDING"))
    .limit(limit);

  if (pending.length === 0) {
    console.log("[CrawlJobRunner] No pending crawls in queue");
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  console.log(`[CrawlJobRunner] Processing ${pending.length} crawls (concurrency: ${CRAWL_CONCURRENCY})`);

  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < pending.length; i += CRAWL_CONCURRENCY) {
    const batch = pending.slice(i, i + CRAWL_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (item) => {
        if (!item.websiteUrl) {
          await db.update(entityContactVerification)
            .set({ crawlStatus: "NO_WEBSITE", updatedAt: new Date() })
            .where(eq(entityContactVerification.id, item.id));
          return "no_website";
        }
        try {
          await crawlEntityWebsite(item.entityId, item.websiteUrl, item.metroId);
          return "success";
        } catch (err: any) {
          console.error(`[CrawlJobRunner] Entity ${item.entityId} crawl error:`, err.message);
          await db.update(entityContactVerification)
            .set({
              crawlStatus: "FAILED",
              notes: `Unexpected error: ${err.message?.slice(0, 500)}`,
              crawledAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(entityContactVerification.id, item.id));
          return "failed";
        }
      })
    );

    for (const r of results) {
      if (r.status === "fulfilled" && r.value === "success") succeeded++;
      else if (r.status === "fulfilled" && r.value === "failed") failed++;
      else if (r.status === "rejected") failed++;
    }
  }

  console.log(`[CrawlJobRunner] Completed: ${succeeded} succeeded, ${failed} failed out of ${pending.length}`);
  return { processed: pending.length, succeeded, failed };
}

export async function runScoringBatch(metroId?: string): Promise<{ processed: number; errors: number }> {
  return computeAllScores(metroId);
}

export async function getRecentCrawlResults(limit: number = 50): Promise<any[]> {
  const result = await db.execute(sql`
    SELECT
      ecv.entity_id,
      ecv.crawl_status,
      ecv.confidence_score,
      ecv.detected_phone,
      ecv.detected_email,
      ecv.detected_contact_form_url,
      ecv.detected_feed_url,
      ecv.http_status,
      ecv.final_url,
      ecv.crawled_at,
      b.name AS business_name
    FROM entity_contact_verification ecv
    JOIN businesses b ON b.id = ecv.entity_id
    WHERE ecv.crawled_at IS NOT NULL
    ORDER BY ecv.crawled_at DESC
    LIMIT ${limit}
  `);
  return ((result as any).rows ?? result) as any[];
}
