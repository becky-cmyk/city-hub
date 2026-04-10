import { db } from "../db";
import { sql } from "drizzle-orm";
import { processCrawlQueue, enqueueCrawlJobs } from "./crawl/crawlJobRunner";
import { storage } from "../storage";
import { runImportJob } from "../google-places";

const rawTarget = parseInt(process.env.EMAIL_LEAD_DAILY_TARGET || "10", 10);
const EMAIL_LEAD_DAILY_TARGET = isNaN(rawTarget) || rawTarget <= 0 ? 10 : rawTarget;

let pipelineRunning = false;

const VENUE_CATEGORIES = [
  "restaurants",
  "bars",
  "barbershop",
  "hair salon",
  "nail salon",
  "gym",
  "coffee shop",
  "bakery",
  "auto repair",
  "car wash",
  "laundromat",
  "brewery",
  "pizza",
];

interface PipelineRunResult {
  readyToReachCount: number;
  target: number;
  pendingCrawls: number;
  crawlsProcessed: number;
  emailsDiscovered: number;
  importTriggered: boolean;
  importedCount: number;
  deficit: number;
}

export async function getReadyToReachCount(): Promise<number> {
  const result = await db.execute(sql`
    SELECT COUNT(DISTINCT b.id) as cnt
    FROM businesses b
    LEFT JOIN crm_contacts c ON c.linked_business_id = b.id AND c.deleted_at IS NULL
    LEFT JOIN entity_contact_verification ecv ON ecv.entity_id = b.id
    WHERE b.claimed_by_user_id IS NULL
      AND b.claim_status NOT IN ('CLAIMED', 'CLAIM_SENT')
      AND (b.owner_email IS NOT NULL OR c.email IS NOT NULL OR ecv.detected_email IS NOT NULL)
  `);
  return Number((result.rows[0] as any)?.cnt || 0);
}

export async function getPendingCrawlCount(): Promise<number> {
  const result = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM entity_contact_verification WHERE crawl_status = 'PENDING'
  `);
  return Number((result.rows[0] as any)?.cnt || 0);
}

export async function getEmailPipelineStatus(): Promise<{
  readyToReach: number;
  target: number;
  pendingCrawls: number;
  recentEmailsFound: number;
  lastCrawlAt: string | null;
  deficit: number;
}> {
  const readyToReach = await getReadyToReachCount();
  const pendingCrawls = await getPendingCrawlCount();

  const recentResult = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM entity_contact_verification
    WHERE detected_email IS NOT NULL AND crawled_at >= NOW() - INTERVAL '24 hours'
  `);
  const recentEmailsFound = Number((recentResult.rows[0] as any)?.cnt || 0);

  const lastCrawlResult = await db.execute(sql`
    SELECT MAX(crawled_at) as last_crawl FROM entity_contact_verification
    WHERE crawl_status = 'SUCCESS'
  `);
  const lastCrawlAt = (lastCrawlResult.rows[0] as any)?.last_crawl || null;

  return {
    readyToReach,
    target: EMAIL_LEAD_DAILY_TARGET,
    pendingCrawls,
    recentEmailsFound,
    lastCrawlAt,
    deficit: Math.max(0, EMAIL_LEAD_DAILY_TARGET - readyToReach),
  };
}

export async function runEmailLeadPipeline(triggeredBy: string = "scheduler"): Promise<PipelineRunResult> {
  if (pipelineRunning) {
    console.log(`[EmailLeadPipeline] Skipping — another run already in progress`);
    const readyToReachCount = await getReadyToReachCount();
    return {
      readyToReachCount,
      target: EMAIL_LEAD_DAILY_TARGET,
      pendingCrawls: await getPendingCrawlCount(),
      crawlsProcessed: 0,
      emailsDiscovered: 0,
      importTriggered: false,
      importedCount: 0,
      deficit: Math.max(0, EMAIL_LEAD_DAILY_TARGET - readyToReachCount),
    };
  }

  pipelineRunning = true;
  try {
  console.log(`[EmailLeadPipeline] Starting run (triggered by: ${triggeredBy})`);

  let readyToReachCount = await getReadyToReachCount();
  let pendingCrawls = await getPendingCrawlCount();
  let crawlsProcessed = 0;
  let emailsDiscovered = 0;
  let importTriggered = false;
  let importedCount = 0;

  console.log(`[EmailLeadPipeline] Ready to reach: ${readyToReachCount}/${EMAIL_LEAD_DAILY_TARGET}. Pending crawls: ${pendingCrawls}`);

  if (readyToReachCount < EMAIL_LEAD_DAILY_TARGET && pendingCrawls > 0) {
    console.log(`[EmailLeadPipeline] Under target — processing ${Math.min(pendingCrawls, 50)} pending crawls`);

    const emailsBefore = await db.execute(sql`
      SELECT COUNT(*) as cnt FROM entity_contact_verification WHERE detected_email IS NOT NULL
    `);
    const beforeCount = Number((emailsBefore.rows[0] as any)?.cnt || 0);

    const crawlResult = await processCrawlQueue(50);
    crawlsProcessed = crawlResult.processed;

    const emailsAfter = await db.execute(sql`
      SELECT COUNT(*) as cnt FROM entity_contact_verification WHERE detected_email IS NOT NULL
    `);
    const afterCount = Number((emailsAfter.rows[0] as any)?.cnt || 0);
    emailsDiscovered = afterCount - beforeCount;

    readyToReachCount = await getReadyToReachCount();
    pendingCrawls = await getPendingCrawlCount();

    console.log(`[EmailLeadPipeline] Crawl complete: ${crawlsProcessed} processed, ${emailsDiscovered} new emails. Ready: ${readyToReachCount}/${EMAIL_LEAD_DAILY_TARGET}`);
  }

  if (readyToReachCount < EMAIL_LEAD_DAILY_TARGET && pendingCrawls < 10) {
    console.log(`[EmailLeadPipeline] Still under target and low pending crawls — triggering Google Places import`);

    try {
      const categoryIndex = Math.floor(Math.random() * VENUE_CATEGORIES.length);
      const category = VENUE_CATEGORIES[categoryIndex];

      const job = await storage.createPlaceImportJob({
        createdByUserId: null,
        mode: "text_search",
        areaMode: "clt_default",
        hubRegionId: null,
        zipCode: null,
        queryText: `${category} in Charlotte NC`,
        categoryKeyword: category,
        centerLat: process.env.CLT_CENTER_LAT || "35.2271",
        centerLng: process.env.CLT_CENTER_LNG || "-80.8431",
        radiusMeters: parseInt(process.env.CLT_DEFAULT_RADIUS_METERS || "8000"),
        resolvedAreaLabel: `Auto-import: ${category} (email pipeline)`,
        requestedCount: 20,
        status: "queued",
        importedCount: 0,
      });

      importTriggered = true;
      console.log(`[EmailLeadPipeline] Import job created: ${job.id} for "${category}"`);

      try {
        const summary = await runImportJob(job.id);
        importedCount = summary.imported || 0;
        console.log(`[EmailLeadPipeline] Import complete: ${importedCount} businesses imported`);
      } catch (importErr: any) {
        console.error(`[EmailLeadPipeline] Import job failed:`, importErr.message);
      }

      if (importedCount > 0) {
        await enqueueCrawlJobs();
        const newPending = await getPendingCrawlCount();
        if (newPending > 0) {
          const emailsBefore2 = await db.execute(sql`
            SELECT COUNT(*) as cnt FROM entity_contact_verification WHERE detected_email IS NOT NULL
          `);
          const before2 = Number((emailsBefore2.rows[0] as any)?.cnt || 0);

          console.log(`[EmailLeadPipeline] Processing ${Math.min(newPending, 30)} newly enqueued crawls`);
          const secondCrawl = await processCrawlQueue(30);
          crawlsProcessed += secondCrawl.processed;

          const emailsAfter2 = await db.execute(sql`
            SELECT COUNT(*) as cnt FROM entity_contact_verification WHERE detected_email IS NOT NULL
          `);
          const after2 = Number((emailsAfter2.rows[0] as any)?.cnt || 0);
          emailsDiscovered += (after2 - before2);
        }
      }
    } catch (err: any) {
      console.error(`[EmailLeadPipeline] Auto-import error:`, err.message);
    }
  }

  readyToReachCount = await getReadyToReachCount();
  const deficit = Math.max(0, EMAIL_LEAD_DAILY_TARGET - readyToReachCount);

  const result: PipelineRunResult = {
    readyToReachCount,
    target: EMAIL_LEAD_DAILY_TARGET,
    pendingCrawls: await getPendingCrawlCount(),
    crawlsProcessed,
    emailsDiscovered,
    importTriggered,
    importedCount,
    deficit,
  };

  if (deficit === 0) {
    console.log(`[EmailLeadPipeline] Target met: ${readyToReachCount}/${EMAIL_LEAD_DAILY_TARGET} email leads ready`);
  } else {
    console.log(`[EmailLeadPipeline] Under target: ${readyToReachCount}/${EMAIL_LEAD_DAILY_TARGET} (need ${deficit} more). Consider manual Google Places imports.`);
  }

  return result;
  } finally {
    pipelineRunning = false;
  }
}

let emailLeadPipelineTimer: ReturnType<typeof setInterval> | null = null;

export function startEmailLeadPipelineScheduler(): void {
  if (emailLeadPipelineTimer) {
    clearInterval(emailLeadPipelineTimer);
    emailLeadPipelineTimer = null;
  }

  const rawInterval = parseInt(process.env.EMAIL_LEAD_PIPELINE_INTERVAL_HOURS || "6", 10);
  const intervalHours = isNaN(rawInterval) || rawInterval <= 0 ? 6 : rawInterval;
  const intervalMs = intervalHours * 60 * 60 * 1000;

  console.log(`[EmailLeadPipeline] Scheduler started — runs every ${intervalHours} hours. Target: ${EMAIL_LEAD_DAILY_TARGET} emails/day`);

  setTimeout(() => {
    runEmailLeadPipeline("scheduler").catch(err => {
      console.error("[EmailLeadPipeline] Scheduled run failed:", err.message);
    });
  }, 60_000);

  emailLeadPipelineTimer = setInterval(() => {
    runEmailLeadPipeline("scheduler").catch(err => {
      console.error("[EmailLeadPipeline] Scheduled run failed:", err.message);
    });
  }, intervalMs);
}
