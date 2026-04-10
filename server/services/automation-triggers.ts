import { storage } from "../storage";

export async function enqueueAutomationTrigger(params: {
  triggerEvent: "booking_no_response" | "content_published" | "story_approved" | "lead_created" | "event_rsvp";
  entityType: string;
  entityId: string;
  cityId?: string;
  payload?: Record<string, any>;
}): Promise<void> {
  try {
    const rules = await storage.getActiveRulesForTrigger(params.triggerEvent, params.cityId);
    if (rules.length === 0) return;

    for (const rule of rules) {
      const existing = await storage.getAutomationQueueItems({
        ruleId: rule.id,
        processed: false,
        limit: 50,
      });
      const hasDupe = existing.some(q => q.entityId === params.entityId && q.entityType === params.entityType);
      if (hasDupe) continue;

      const fireAt = new Date(Date.now() + (rule.delayMinutes || 0) * 60 * 1000);

      await storage.enqueueAutomationItem({
        ruleId: rule.id,
        triggerEvent: params.triggerEvent,
        entityType: params.entityType,
        entityId: params.entityId,
        payload: params.payload || {},
        fireAt,
        processedAt: null,
      });

      console.log(`[AutomationEngine] Enqueued trigger "${params.triggerEvent}" for rule "${rule.name || rule.id}", fires at ${fireAt.toISOString()}`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[AutomationEngine] Error enqueuing trigger "${params.triggerEvent}":`, msg);
  }
}
