import { storage } from "./storage";

async function processScheduledPublish() {
  const items = await storage.getScheduledForPublish();
  for (const item of items) {
    if (!item.publishAt || item.status !== "scheduled") continue;

    await storage.updateCmsContentItem(item.id, {
      status: "published",
      publishedAt: new Date(),
    });

    await storage.createCmsRevision({
      contentItemId: item.id,
      actorType: "system",
      actorUserId: null,
      fieldName: "status",
      oldValue: "scheduled",
      newValue: "published",
      reason: "Auto-published at scheduled time",
    });

    await storage.createCmsWorkflowEvent({
      contentItemId: item.id,
      eventType: "published",
      note: "Auto-published by scheduler",
      actorUserId: null,
    });

    const legacyId = await storage.getCmsBridgeArticle(item.id);
    if (legacyId && item.contentType === "article") {
      await storage.updateArticle(legacyId, {
        publishedAt: new Date(),
        title: item.titleEn,
        slug: item.slug,
        excerpt: item.excerptEn,
        content: item.bodyEn,
      });
    }

    console.log(`[CMS Scheduler] Published: ${item.titleEn} (${item.id})`);
  }
  return items.length;
}

async function processScheduledUnpublish() {
  const items = await storage.getScheduledForUnpublish();
  for (const item of items) {
    if (!item.unpublishAt || item.status !== "published") continue;

    await storage.updateCmsContentItem(item.id, {
      status: "archived",
    });

    await storage.createCmsRevision({
      contentItemId: item.id,
      actorType: "system",
      actorUserId: null,
      fieldName: "status",
      oldValue: "published",
      newValue: "archived",
      reason: "Auto-unpublished at scheduled time",
    });

    await storage.createCmsWorkflowEvent({
      contentItemId: item.id,
      eventType: "unpublished",
      note: "Auto-unpublished by scheduler",
      actorUserId: null,
    });

    console.log(`[CMS Scheduler] Unpublished: ${item.titleEn} (${item.id})`);
  }
  return items.length;
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startCmsScheduler(intervalMs: number = 60000) {
  console.log(`[CMS Scheduler] Starting with ${intervalMs / 1000}s interval`);

  async function tick() {
    try {
      const published = await processScheduledPublish();
      const unpublished = await processScheduledUnpublish();
      if (published > 0 || unpublished > 0) {
        console.log(`[CMS Scheduler] Processed: ${published} published, ${unpublished} unpublished`);
      }
    } catch (err) {
      console.error("[CMS Scheduler] Error:", err);
    }
  }

  tick();
  intervalId = setInterval(tick, intervalMs);
}

export function stopCmsScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
