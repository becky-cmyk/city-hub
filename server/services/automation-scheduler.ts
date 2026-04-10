import { storage } from "../storage";
import { executeAutomationAction } from "./automation-actions";

let intervalId: ReturnType<typeof setInterval> | null = null;
let processing = false;

async function processQueue(): Promise<number> {
  if (processing) return 0;
  processing = true;
  try {
    return await processQueueInner();
  } finally {
    processing = false;
  }
}

async function processQueueInner(): Promise<number> {
  const dueItems = await storage.getDueAutomationItems();
  if (dueItems.length === 0) return 0;

  let processed = 0;

  for (const item of dueItems) {
    try {
      const rule = await storage.getAutomationRuleById(item.ruleId);
      if (!rule || !rule.isActive) {
        await storage.markAutomationItemProcessed(item.id);
        await storage.createAutomationLog({
          queueItemId: item.id,
          ruleId: item.ruleId,
          actionType: rule?.actionType || "create_notification",
          result: { skipped: true, reason: rule ? "Rule inactive" : "Rule not found" },
          error: null,
          executedAt: new Date(),
        });
        processed++;
        continue;
      }

      const result = await executeAutomationAction(rule, item);

      await storage.markAutomationItemProcessed(item.id);
      await storage.createAutomationLog({
        queueItemId: item.id,
        ruleId: rule.id,
        actionType: rule.actionType,
        result: result.success ? result.data : null,
        error: result.success ? null : result.error,
        executedAt: new Date(),
      });

      processed++;
      console.log(`[AutomationEngine] Processed queue item ${item.id} for rule ${rule.name || rule.id}: ${result.success ? "success" : "error"}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error(`[AutomationEngine] Error processing queue item ${item.id}:`, msg);

      await storage.markAutomationItemProcessed(item.id);
      await storage.createAutomationLog({
        queueItemId: item.id,
        ruleId: item.ruleId,
        actionType: "create_notification",
        result: null,
        error: msg,
        executedAt: new Date(),
      });
      processed++;
    }
  }

  return processed;
}

export function startAutomationScheduler(intervalMs: number = 60000) {
  console.log(`[AutomationEngine] Starting scheduler with ${intervalMs / 1000}s interval`);

  async function tick() {
    try {
      const processed = await processQueue();
      if (processed > 0) {
        console.log(`[AutomationEngine] Processed ${processed} queue items`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[AutomationEngine] Scheduler error:", msg);
    }
  }

  setTimeout(tick, 15000);
  intervalId = setInterval(tick, intervalMs);
}

export function stopAutomationScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
