import { db } from "../db";
import { eq, and, lt, inArray, sql, desc } from "drizzle-orm";
import { charlotteTasks, charlotteMemory, rssItems } from "@shared/schema";
import type { CharlotteTask } from "@shared/schema";
import { processCaptureBatch } from "../charlotte-batch-processor";
import { executeProposal } from "../charlotte-proposal-engine";
import { generateStoryForCapture } from "./capture-story-generator";
import { runOutreachDrafter } from "../intelligence/outreach-drafter";

let intervalId: ReturnType<typeof setInterval> | null = null;
let processing = false;

interface TaskResult {
  summary: string;
  details?: Record<string, unknown>;
  entityIds?: string[];
}

async function executeTask(task: CharlotteTask): Promise<TaskResult> {
  const payload = (task.payload || {}) as Record<string, unknown>;

  switch (task.type) {
    case "capture_processing": {
      const sessionId = payload.sessionId as string;
      if (!sessionId) throw new Error("Missing sessionId in payload");
      const result = await processCaptureBatch(sessionId);
      return {
        summary: `Processed capture session: ${result.processed || 0} items resolved, ${result.proposals || 0} proposals generated`,
        details: result as unknown as Record<string, unknown>,
        entityIds: (result as Record<string, unknown>).entityIds as string[] | undefined,
      };
    }

    case "proposal_generation": {
      const proposalId = payload.proposalId as string;
      if (!proposalId) throw new Error("Missing proposalId in payload");
      const result = await executeProposal(proposalId);
      return {
        summary: `Executed proposal: ${result.executed} actions completed, ${result.failed} failed`,
        details: result as unknown as Record<string, unknown>,
      };
    }

    case "story_generation": {
      const captureIds = (payload.captureIds || []) as string[];
      if (captureIds.length === 0) throw new Error("Missing captureIds in payload");
      const results: { id: string; title: string }[] = [];
      let failed = 0;
      for (const captureId of captureIds) {
        try {
          const article = await generateStoryForCapture(captureId);
          if (article) results.push({ id: article.articleId, title: article.title });
        } catch {
          failed++;
        }
      }
      return {
        summary: `Generated ${results.length} stories${failed > 0 ? `, ${failed} failed` : ""}`,
        details: { stories: results, failed },
        entityIds: results.map(r => r.id),
      };
    }

    case "followup_generation": {
      const contactIds = (payload.contactIds || []) as string[];
      return {
        summary: `Follow-up drafts queued for ${contactIds.length} contacts`,
        details: { contactIds },
      };
    }

    case "outreach_drafting": {
      const count = await runOutreachDrafter();
      return {
        summary: `Drafted outreach for ${count} prospects`,
        details: { drafted: count },
      };
    }

    case "article_bulk_update": {
      const articleIds = (payload.articleIds || []) as string[];
      const updateFields = (payload.updateFields || {}) as Record<string, unknown>;
      const editedFields = (payload.editedFields || []) as string[];

      if (articleIds.length === 0) throw new Error("No article IDs in payload");
      if (editedFields.length === 0) throw new Error("No update fields in payload");

      let updated = 0;
      let failed = 0;
      for (const id of articleIds) {
        try {
          const [article] = await db.select({ editHistory: rssItems.editHistory }).from(rssItems).where(eq(rssItems.id, id));
          if (!article) { failed++; continue; }

          const existingHistory = (article.editHistory as Array<{ fields: string[]; editorId: string; editedAt: string }>) || [];
          await db.update(rssItems).set({
            ...updateFields,
            updatedAt: new Date(),
            lastEditedBy: "charlotte-ai",
            lastEditedAt: new Date(),
            editHistory: [...existingHistory, { fields: editedFields, editorId: "charlotte-ai", editedAt: new Date().toISOString() }],
          } as any).where(eq(rssItems.id, id));
          updated++;
        } catch {
          failed++;
        }
      }

      return {
        summary: `Bulk article update: ${updated} updated, ${failed} failed out of ${articleIds.length}`,
        details: { updated, failed, total: articleIds.length, fields: editedFields },
        entityIds: articleIds,
      };
    }

    case "general":
    default:
      return {
        summary: "Task completed (general)",
        details: payload,
      };
  }
}

async function processTaskQueue(): Promise<number> {
  if (processing) return 0;
  processing = true;
  try {
    const pendingTasks = await db
      .select()
      .from(charlotteTasks)
      .where(eq(charlotteTasks.status, "pending"))
      .orderBy(charlotteTasks.createdAt)
      .limit(3);

    if (pendingTasks.length === 0) return 0;

    let processed = 0;
    for (const task of pendingTasks) {
      try {
        await db.update(charlotteTasks)
          .set({ status: "running", progress: 10, updatedAt: new Date() })
          .where(eq(charlotteTasks.id, task.id));

        console.log(`[TaskWorker] Running task ${task.id}: ${task.title} (${task.type})`);

        await db.update(charlotteTasks)
          .set({ progress: 50, updatedAt: new Date() })
          .where(eq(charlotteTasks.id, task.id));

        const result = await executeTask(task);

        await db.update(charlotteTasks)
          .set({
            status: "completed",
            progress: 100,
            result: result as unknown as Record<string, unknown>,
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(charlotteTasks.id, task.id));

        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        await db.insert(charlotteMemory).values({
          scope: "admin_ops",
          type: "recent_task",
          content: `Task "${task.title}" completed: ${result.summary}`,
          referenceId: task.id,
          expiresAt: thirtyDaysFromNow,
        });

        console.log(`[TaskWorker] Completed task ${task.id}: ${result.summary}`);
        processed++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error(`[TaskWorker] Failed task ${task.id}:`, msg);
        await db.update(charlotteTasks)
          .set({
            status: "failed",
            error: msg,
            progress: 0,
            updatedAt: new Date(),
          })
          .where(eq(charlotteTasks.id, task.id));
        processed++;
      }
    }

    return processed;
  } finally {
    processing = false;
  }
}

async function pruneExpiredMemory(): Promise<number> {
  const result = await db.delete(charlotteMemory)
    .where(and(
      lt(charlotteMemory.expiresAt, new Date()),
      sql`${charlotteMemory.expiresAt} IS NOT NULL`
    ));
  return 0;
}

export function startCharlotteTaskWorker(intervalMs: number = 10000) {
  console.log(`[TaskWorker] Starting Charlotte task worker (${intervalMs / 1000}s interval)`);

  let pruneCounter = 0;

  async function tick() {
    try {
      const processed = await processTaskQueue();
      if (processed > 0) {
        console.log(`[TaskWorker] Processed ${processed} task(s)`);
      }

      pruneCounter++;
      if (pruneCounter >= 360) {
        pruneCounter = 0;
        await pruneExpiredMemory();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown";
      console.error(`[TaskWorker] Tick error:`, msg);
    }
  }

  tick();
  intervalId = setInterval(tick, intervalMs);
  return intervalId;
}

export function stopCharlotteTaskWorker() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
