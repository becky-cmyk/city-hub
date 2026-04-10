import { db } from "../../db";
import { eq, and, sql, isNull, inArray } from "drizzle-orm";
import {
  prospectPipelineRuns,
  entityScores,
  businesses,
  crmPresence,
  crmActivity,
  adminInboxItems,
  adminInboxLinks,
  entityOutreachRecommendation,
  entityLocationProfile,
  entityContactVerification,
  entityAssetTags,
} from "@shared/schema";
import { logPresenceFieldChange } from "../../audit";

interface PipelineResults {
  crawlEnqueued: number;
  crawlProcessed: number;
  crawlSucceeded: number;
  crawlFailed: number;
  classified: number;
  classifyErrors: number;
  outreachProcessed: number;
  outreachErrors: number;
  industryTagged: number;
  industryTotalTags: number;
  industryErrors: number;
  scored: number;
  scoreErrors: number;
  promoted: number;
  needsReview: number;
  engagementComputed: number;
  salesBucketsComputed: number;
  salesBucketErrors: number;
}

export async function runProspectPipeline(
  metroId?: string,
  triggeredBy: string = "MANUAL"
): Promise<{ runId: string; results: PipelineResults }> {
  const [run] = await db.insert(prospectPipelineRuns).values({
    metroId: metroId || null,
    triggeredBy,
    status: "RUNNING",
  }).returning();

  const results: PipelineResults = {
    crawlEnqueued: 0,
    crawlProcessed: 0,
    crawlSucceeded: 0,
    crawlFailed: 0,
    classified: 0,
    classifyErrors: 0,
    outreachProcessed: 0,
    outreachErrors: 0,
    industryTagged: 0,
    industryTotalTags: 0,
    industryErrors: 0,
    scored: 0,
    scoreErrors: 0,
    promoted: 0,
    needsReview: 0,
    engagementComputed: 0,
    salesBucketsComputed: 0,
    salesBucketErrors: 0,
  };

  try {
    console.log(`[ProspectPipeline] Starting pipeline run ${run.id} (trigger: ${triggeredBy})`);

    const { enqueueCrawlJobs, processCrawlQueue, runScoringBatch } = await import("../crawl/crawlJobRunner");
    const { classifyAllLocations } = await import("../classify/locationClassifier");
    const { recommendAllOutreach } = await import("../classify/outreachRecommender");

    console.log("[ProspectPipeline] Step 1: Enqueue crawl jobs...");
    results.crawlEnqueued = await enqueueCrawlJobs(metroId);
    console.log(`[ProspectPipeline] Enqueued ${results.crawlEnqueued} crawl jobs`);

    if (results.crawlEnqueued > 0) {
      console.log("[ProspectPipeline] Step 2: Process crawl queue...");
      const crawlResult = await processCrawlQueue(100);
      results.crawlProcessed = crawlResult.processed;
      results.crawlSucceeded = crawlResult.succeeded;
      results.crawlFailed = crawlResult.failed;
      console.log(`[ProspectPipeline] Crawled ${results.crawlProcessed} (${results.crawlSucceeded} ok, ${results.crawlFailed} fail)`);
    }

    console.log("[ProspectPipeline] Step 3: Classify locations...");
    const classifyResult = await classifyAllLocations(metroId);
    results.classified = classifyResult.classified;
    results.classifyErrors = classifyResult.errors;
    console.log(`[ProspectPipeline] Classified ${results.classified} locations`);

    console.log("[ProspectPipeline] Step 4: Recommend outreach...");
    const outreachResult = await recommendAllOutreach(metroId);
    results.outreachProcessed = outreachResult.processed;
    results.outreachErrors = outreachResult.errors;
    console.log(`[ProspectPipeline] Outreach recommended for ${results.outreachProcessed}`);

    console.log("[ProspectPipeline] Step 4.5: Industry tagging...");
    try {
      const { tagAllEntities } = await import("../classify/industryTagger");
      const tagResult = await tagAllEntities(metroId);
      results.industryTagged = tagResult.tagged;
      results.industryTotalTags = tagResult.totalTags;
      results.industryErrors = tagResult.errors;
      console.log(`[ProspectPipeline] Tagged ${results.industryTagged} entities (${results.industryTotalTags} total tags)`);
    } catch (err: any) {
      console.error("[ProspectPipeline] Industry tagging error:", err.message);
    }

    console.log("[ProspectPipeline] Step 5: Run scoring batch...");
    const scoreResult = await runScoringBatch(metroId);
    results.scored = scoreResult.processed;
    results.scoreErrors = scoreResult.errors;
    console.log(`[ProspectPipeline] Scored ${results.scored} entities`);

    console.log("[ProspectPipeline] Step 6: Auto-promote TARGET leads...");
    const promotionResult = await autoPromoteTargets(metroId);
    results.promoted = promotionResult.promoted;
    results.needsReview = promotionResult.needsReview;
    console.log(`[ProspectPipeline] Promoted ${results.promoted}, flagged ${results.needsReview} for review`);

    console.log("[ProspectPipeline] Step 7: Compute engagement stats + sales buckets...");
    try {
      const { computeAllEngagement30d } = await import("../salesBuckets/entityEngagementStats");
      const engResult = await computeAllEngagement30d(metroId);
      results.engagementComputed = engResult.computed;
      console.log(`[ProspectPipeline] Engagement stats computed for ${results.engagementComputed} entities`);
    } catch (err: any) {
      console.error("[ProspectPipeline] Engagement stats error:", err.message);
    }

    try {
      const { computeAllSalesBuckets } = await import("../salesBuckets/salesBucketEngine");
      const bucketResult = await computeAllSalesBuckets(metroId);
      results.salesBucketsComputed = bucketResult.bucketsAssigned;
      results.salesBucketErrors = bucketResult.errors;
      console.log(`[ProspectPipeline] Sales buckets: ${results.salesBucketsComputed} assigned, ${results.salesBucketErrors} errors`);
    } catch (err: any) {
      console.error("[ProspectPipeline] Sales buckets error:", err.message);
    }

    await db.update(prospectPipelineRuns)
      .set({
        status: "COMPLETED",
        completedAt: new Date(),
        resultsJson: results,
      })
      .where(eq(prospectPipelineRuns.id, run.id));

    if (results.promoted > 0 || results.needsReview > 0) {
      await createPipelineInboxNotification(results, run.id);
    }

    console.log(`[ProspectPipeline] Pipeline run ${run.id} COMPLETED — promoted ${results.promoted}, review ${results.needsReview}`);

    return { runId: run.id, results };
  } catch (error: any) {
    console.error(`[ProspectPipeline] Pipeline run ${run.id} FAILED:`, error.message);

    await db.update(prospectPipelineRuns)
      .set({
        status: "FAILED",
        completedAt: new Date(),
        resultsJson: results,
        errorMessage: error.message,
      })
      .where(eq(prospectPipelineRuns.id, run.id));

    return { runId: run.id, results };
  }
}

async function autoPromoteTargets(metroId?: string): Promise<{ promoted: number; needsReview: number }> {
  let promoted = 0;
  let needsReview = 0;

  const metroFilter = metroId ? sql`AND es.metro_id = ${metroId}` : sql``;

  const targetResult = await db.execute(sql`
    SELECT
      es.entity_id, es.prospect_fit_score, es.contact_ready_score,
      b.name, b.phone, b.owner_email, b.address, b.website_url,
      cp.stage as crm_stage,
      elp.location_type,
      eor.recommended_method,
      ecv.detected_phone, ecv.detected_email,
      (SELECT string_agg(eat.tag, ', ') FROM entity_asset_tags eat WHERE eat.entity_id = es.entity_id) as industry_tags
    FROM entity_scores es
    JOIN businesses b ON b.id = es.entity_id
    LEFT JOIN crm_presence cp ON cp.presence_id = es.entity_id
    LEFT JOIN entity_location_profile elp ON elp.entity_id = es.entity_id
    LEFT JOIN entity_outreach_recommendation eor ON eor.entity_id = es.entity_id
    LEFT JOIN entity_contact_verification ecv ON ecv.entity_id = es.entity_id
    WHERE es.bucket = 'TARGET'
      AND es.pipeline_promoted_at IS NULL
      AND (cp.stage IS NULL OR cp.stage = 'intake')
      ${metroFilter}
  `);
  const targetRows = (targetResult as any).rows ?? targetResult;

  for (const row of targetRows) {
    const entityId = row.entity_id;
    const currentStage = row.crm_stage || null;

    const phone = row.phone || row.detected_phone || "none";
    const email = row.owner_email || row.detected_email || "none";
    const locationType = row.location_type || "UNKNOWN";
    const outreachMethod = row.recommended_method || "UNKNOWN";

    const noteText = [
      `🎯 Auto-qualified by Prospect Pipeline`,
      `Prospect Fit: ${row.prospect_fit_score}/100 | Contact Ready: ${row.contact_ready_score}/100`,
      `Location: ${locationType} | Outreach: ${outreachMethod}`,
      `Phone: ${phone} | Email: ${email}`,
      row.address ? `Address: ${row.address}` : null,
      row.website_url ? `Website: ${row.website_url}` : null,
      row.industry_tags ? `Industry: ${row.industry_tags}` : null,
    ].filter(Boolean).join("\n");

    if (!currentStage) {
      await db.insert(crmPresence).values({
        presenceId: entityId,
        stage: "assigned",
      });
    } else {
      await db.update(crmPresence)
        .set({ stage: "assigned", updatedAt: new Date() })
        .where(eq(crmPresence.presenceId, entityId));
    }

    await logPresenceFieldChange(
      { presenceId: entityId, actorType: "system", actorUserId: null, reason: "Auto-promoted by prospect pipeline" },
      "crm_stage", currentStage || "intake", "assigned",
    );

    await db.insert(crmActivity).values({
      presenceId: entityId,
      activityType: "note",
      notes: noteText,
      createdByUserId: null,
    });

    await db.update(entityScores)
      .set({ pipelinePromotedAt: new Date() })
      .where(and(eq(entityScores.entityId, entityId), isNull(entityScores.pipelinePromotedAt)));

    promoted++;
  }

  const reviewEntities = await db.execute(sql`
    SELECT es.entity_id
    FROM entity_scores es
    WHERE es.bucket = 'NEEDS_REVIEW'
      AND es.pipeline_promoted_at IS NULL
      ${metroFilter}
  `);
  const reviewRows = (reviewEntities as any).rows ?? reviewEntities;
  needsReview = reviewRows.length;

  return { promoted, needsReview };
}

async function createPipelineInboxNotification(results: PipelineResults, runId: string) {
  const parts: string[] = [];
  if (results.promoted > 0) parts.push(`${results.promoted} new leads promoted to sales queue`);
  if (results.needsReview > 0) parts.push(`${results.needsReview} businesses flagged for review`);
  if (results.crawlProcessed > 0) parts.push(`${results.crawlProcessed} websites crawled`);
  if (results.scored > 0) parts.push(`${results.scored} businesses scored`);

  const [inboxItem] = await db.insert(adminInboxItems).values({
    itemType: "pipeline_promoted",
    relatedTable: "prospect_pipeline_runs",
    relatedId: runId,
    title: `Pipeline Complete: ${results.promoted} new sales leads`,
    summary: parts.join(". ") + ".",
    priority: results.promoted > 0 ? "high" : "low",
    status: "open",
    visibility: "admin_only",
  }).returning();

  await db.insert(adminInboxLinks).values({
    inboxItemId: inboxItem.id,
    label: "View Sales Leads",
    urlOrRoute: "#section:opportunity-radar",
  });

  await db.insert(adminInboxLinks).values({
    inboxItemId: inboxItem.id,
    label: "View Pipeline Run",
    urlOrRoute: "#section:intelligence",
  });
}

let pipelineSchedulerInterval: ReturnType<typeof setInterval> | null = null;

export function startProspectPipelineScheduler() {
  const scheduleHour = parseInt(process.env.PIPELINE_SCHEDULE_HOUR || "2", 10);

  console.log(`[ProspectPipeline] Scheduler started — daily pipeline at ${scheduleHour}:00 ET`);

  pipelineSchedulerInterval = setInterval(async () => {
    const now = new Date();
    const etHour = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" })).getHours();
    const etMinute = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" })).getMinutes();

    if (etHour === scheduleHour && etMinute < 5) {
      const recentRuns = await db.execute(sql`
        SELECT id FROM prospect_pipeline_runs
        WHERE started_at > NOW() - INTERVAL '20 hours'
          AND triggered_by = 'SCHEDULER'
      `);
      const recentRows = (recentRuns as any).rows ?? recentRuns;
      if (recentRows.length > 0) return;

      console.log("[ProspectPipeline] Scheduled pipeline run starting...");
      try {
        await runProspectPipeline(undefined, "SCHEDULER");
      } catch (err: any) {
        console.error("[ProspectPipeline] Scheduled run error:", err.message);
      }
    }
  }, 5 * 60 * 1000);
}
