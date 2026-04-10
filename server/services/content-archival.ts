import { db } from "../db";
import { rssItems } from "@shared/schema";
import { eq, and, sql, lt, asc } from "drizzle-orm";
import { storage } from "../storage";

const parsedDays = parseInt(process.env.STALE_ARCHIVAL_DAYS || "90", 10);
const STALE_THRESHOLD_DAYS = Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : 90;
const ARCHIVAL_BATCH_SIZE = 50;
const MAX_TOTAL_PER_RUN = 500;

interface ArchivalStats {
  rssArchived: number;
  cmsArchived: number;
  activeUntilArchived: number;
  skippedEvergreen: number;
}

async function archiveLinkedCms(cmsContentItemId: string, archiveReason: string): Promise<boolean> {
  try {
    const item = await storage.getCmsContentItemById(cmsContentItemId);
    if (!item || item.status === "archived") return false;

    await storage.updateCmsContentItem(cmsContentItemId, {
      status: "archived",
    });

    await storage.createCmsRevision({
      contentItemId: cmsContentItemId,
      actorType: "system",
      actorUserId: null,
      fieldName: "status",
      oldValue: item.status,
      newValue: "archived",
      reason: archiveReason,
    });

    await storage.createCmsWorkflowEvent({
      contentItemId: cmsContentItemId,
      eventType: "unpublished",
      note: archiveReason,
      actorUserId: null,
    });

    return true;
  } catch (err: unknown) {
    console.error(`[StaleArchival] CMS archive failed for ${cmsContentItemId}:`, err instanceof Error ? err.message : err);
    return false;
  }
}

async function archiveItem(
  itemId: string,
  cmsContentItemId: string | null,
  reason: string,
  stats: ArchivalStats,
  statKey: "rssArchived" | "activeUntilArchived",
): Promise<void> {
  await db.update(rssItems).set({
    publishStatus: "ARCHIVED",
    pulseEligible: false,
    suppressionReason: reason,
    updatedAt: new Date(),
  }).where(eq(rssItems.id, itemId));
  stats[statKey]++;

  if (cmsContentItemId) {
    const archived = await archiveLinkedCms(cmsContentItemId, reason);
    if (archived) stats.cmsArchived++;
  }
}

let isRunning = false;

export async function runStaleArchival(): Promise<ArchivalStats> {
  if (isRunning) {
    console.log("[StaleArchival] Skipping: another run is already in progress");
    return { rssArchived: 0, cmsArchived: 0, activeUntilArchived: 0, skippedEvergreen: 0 };
  }

  isRunning = true;
  const stats: ArchivalStats = { rssArchived: 0, cmsArchived: 0, activeUntilArchived: 0, skippedEvergreen: 0 };

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - STALE_THRESHOLD_DAYS);

    let processed = 0;
    while (processed < MAX_TOTAL_PER_RUN) {
      const batch = await db.select({
        id: rssItems.id,
        cmsContentItemId: rssItems.cmsContentItemId,
      }).from(rssItems).where(
        and(
          sql`(${rssItems.publishStatus} IS NULL OR ${rssItems.publishStatus} != 'ARCHIVED')`,
          lt(rssItems.publishedAt, cutoffDate),
          sql`${rssItems.publishedAt} IS NOT NULL`,
          sql`(${rssItems.activeUntil} IS NULL OR ${rssItems.activeUntil} < NOW())`,
          sql`(${rssItems.isEvergreen} IS NULL OR ${rssItems.isEvergreen} = false)`,
        )
      ).orderBy(asc(rssItems.publishedAt)).limit(ARCHIVAL_BATCH_SIZE);

      if (batch.length === 0) break;

      for (const item of batch) {
        try {
          await archiveItem(item.id, item.cmsContentItemId, `Auto-archived: older than ${STALE_THRESHOLD_DAYS} days`, stats, "rssArchived");
        } catch (err: unknown) {
          console.error(`[StaleArchival] Failed to archive RSS item ${item.id}:`, err instanceof Error ? err.message : err);
        }
      }

      processed += batch.length;
      if (batch.length < ARCHIVAL_BATCH_SIZE) break;
    }

    const now = new Date();
    let expiredProcessed = 0;
    while (expiredProcessed < MAX_TOTAL_PER_RUN) {
      const batch = await db.select({
        id: rssItems.id,
        cmsContentItemId: rssItems.cmsContentItemId,
      }).from(rssItems).where(
        and(
          sql`(${rssItems.publishStatus} IS NULL OR ${rssItems.publishStatus} != 'ARCHIVED')`,
          sql`${rssItems.activeUntil} IS NOT NULL`,
          lt(rssItems.activeUntil, now),
          sql`(${rssItems.isEvergreen} IS NULL OR ${rssItems.isEvergreen} = false)`,
        )
      ).orderBy(asc(rssItems.activeUntil)).limit(ARCHIVAL_BATCH_SIZE);

      if (batch.length === 0) break;

      for (const item of batch) {
        try {
          await archiveItem(item.id, item.cmsContentItemId, "Auto-archived: activeUntil date passed", stats, "activeUntilArchived");
        } catch (err: unknown) {
          console.error(`[StaleArchival] Failed to archive expired RSS item ${item.id}:`, err instanceof Error ? err.message : err);
        }
      }

      expiredProcessed += batch.length;
      if (batch.length < ARCHIVAL_BATCH_SIZE) break;
    }

    const evergreenCount = await db.select({
      count: sql<number>`count(*)`,
    }).from(rssItems).where(
      and(
        sql`(${rssItems.publishStatus} IS NULL OR ${rssItems.publishStatus} != 'ARCHIVED')`,
        sql`${rssItems.isEvergreen} = true`,
        lt(rssItems.publishedAt, cutoffDate),
        sql`${rssItems.publishedAt} IS NOT NULL`,
      )
    );
    stats.skippedEvergreen = Number(evergreenCount[0]?.count ?? 0);

    const total = stats.rssArchived + stats.activeUntilArchived;
    if (total > 0 || stats.skippedEvergreen > 0) {
      console.log(`[StaleArchival] Run complete: ${stats.rssArchived} age-archived, ${stats.activeUntilArchived} expired-archived, ${stats.cmsArchived} CMS archived, ${stats.skippedEvergreen} evergreen skipped`);
    }
  } finally {
    isRunning = false;
  }

  return stats;
}

let archivalIntervalId: ReturnType<typeof setInterval> | null = null;

export function startContentArchivalScheduler(intervalMs: number = 24 * 60 * 60 * 1000) {
  console.log(`[StaleArchival] Starting scheduler (threshold: ${STALE_THRESHOLD_DAYS} days, interval: ${Math.round(intervalMs / 3600000)}h)`);

  async function tick() {
    try {
      await runStaleArchival();
    } catch (err: unknown) {
      console.error("[StaleArchival] Scheduler error:", err instanceof Error ? err.message : err);
    }
  }

  setTimeout(() => tick(), 30000);
  archivalIntervalId = setInterval(tick, intervalMs);
}

export function stopContentArchivalScheduler() {
  if (archivalIntervalId) {
    clearInterval(archivalIntervalId);
    archivalIntervalId = null;
  }
}
