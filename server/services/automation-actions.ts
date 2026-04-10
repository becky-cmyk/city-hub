import { storage } from "../storage";
import type { AutomationRule, AutomationQueueItem, InsertBusiness, InsertEvent } from "@shared/schema";

interface ActionResult {
  success: boolean;
  data?: any;
  error?: string;
}

export async function executeAutomationAction(
  rule: AutomationRule,
  queueItem: AutomationQueueItem
): Promise<ActionResult> {
  const config = (rule.actionConfig || {}) as Record<string, any>;

  switch (rule.actionType) {
    case "send_email":
      return handleSendEmail(config, queueItem);
    case "update_status":
      return handleUpdateStatus(config, queueItem);
    case "generate_content":
      return handleGenerateContent(config, queueItem);
    case "create_notification":
      return handleCreateNotification(config, queueItem, rule);
    default:
      return { success: false, error: `Unknown action type: ${rule.actionType}` };
  }
}

async function resolveBusinessEmail(entityId: string): Promise<string | null> {
  try {
    const business = await storage.getBusinessById(entityId);
    if (!business) return null;

    if (business.claimedByUserId) {
      const user = await storage.getUserById(business.claimedByUserId);
      if (user?.email) return user.email;
    }

    const contacts = await storage.getContactsByBusinessId(entityId);
    if (contacts.length > 0 && contacts[0].email) {
      return contacts[0].email;
    }

    return null;
  } catch {
    return null;
  }
}

async function buildEngagementActionConfig(
  actionType: string,
  trigger: { triggerType: string; entityId: string; entityName: string; recommendedNextAction: string; priority: string; reason: string },
  options: { cityId?: string }
): Promise<Record<string, unknown>> {
  switch (actionType) {
    case "send_email": {
      const toEmail = await resolveBusinessEmail(trigger.entityId);
      return {
        templateKey: "engagement_outreach",
        subject: `Your community presence on the hub — ${trigger.entityName}`,
        toEmail: toEmail || "",
        priority: trigger.priority,
        cityId: options.cityId || "",
      };
    }
    case "generate_content": {
      const contentTypeMap: Record<string, string> = {
        suggest_story_creation: "story",
        suggest_content_participation: "social",
        suggest_category_content: "social",
        suggest_event_promotion: "event_promotion",
      };
      const contentType = contentTypeMap[trigger.recommendedNextAction] || "social";
      return {
        contentType,
        entityId: trigger.entityId,
        entityName: trigger.entityName,
        title: `${trigger.entityName} — ${trigger.reason}`,
        cityId: options.cityId || "",
        metroId: options.cityId || "",
        priority: trigger.priority,
        triggerType: trigger.triggerType,
        recommendedNextAction: trigger.recommendedNextAction,
        prompt: `Generate ${contentType} content for ${trigger.entityName}: ${trigger.reason}`,
        excerpt: trigger.reason,
      };
    }
    case "create_notification":
    default:
      return {
        notificationTitle: `Engagement: ${trigger.triggerType} — {{entityType}}`,
        notificationBody: `${trigger.reason}. Recommended: ${trigger.recommendedNextAction}`,
        priority: trigger.priority,
      };
  }
}

export async function enqueueEngagementAction(
  trigger: {
    triggerType: string;
    entityId: string;
    entityName: string;
    recommendedNextAction: string;
    priority: string;
    reason: string;
    metadata?: Record<string, unknown>;
  },
  options: { delayMinutes?: number; cityId?: string } = {}
): Promise<{ queued: boolean; method: string }> {
  try {
    type AutomationAction = "send_email" | "update_status" | "generate_content" | "create_notification";

    const actionMap: Record<string, AutomationAction> = {
      send_reengagement_prompt: "create_notification",
      suggest_story_creation: "generate_content",
      suggest_content_participation: "generate_content",
      suggest_category_content: "generate_content",
      initiate_outreach: "send_email",
      suggest_verification: "create_notification",
      suggest_crown_participation: "create_notification",
      suggest_tv_venue: "create_notification",
      suggest_job_posting: "create_notification",
      suggest_marketplace_listing: "create_notification",
      suggest_event_promotion: "generate_content",
      suggest_new_year_update: "create_notification",
      suggest_spring_content: "create_notification",
      suggest_summer_content: "create_notification",
      suggest_back_to_school: "create_notification",
      suggest_holiday_content: "create_notification",
    };

    const actionType: AutomationAction = actionMap[trigger.recommendedNextAction] || "create_notification";

    const engagementRuleName = `__engagement_hook__${trigger.triggerType}__${trigger.recommendedNextAction}`;

    const existingRules = await storage.getAutomationRules({
      cityId: options.cityId,
      triggerEvent: "content_published",
      isActive: true,
    });

    let ruleId: string;

    const matchingRule = existingRules.find(r => r.name === engagementRuleName);

    const actionConfig = await buildEngagementActionConfig(actionType, trigger, options);

    if (actionType === "send_email" && !actionConfig.toEmail) {
      console.log(`[EngagementHooks] Skipping send_email for ${trigger.entityName} — no recipient email found`);
      return { queued: false, method: "skipped_no_recipient" };
    }

    if (matchingRule) {
      ruleId = matchingRule.id;
    } else {
      const rule = await storage.createAutomationRule({
        cityId: options.cityId || null,
        triggerEvent: "content_published",
        delayMinutes: options.delayMinutes || 0,
        actionType: actionType,
        actionConfig,
        isActive: true,
        name: engagementRuleName,
        description: `Auto-created engagement trigger for ${trigger.triggerType}/${trigger.recommendedNextAction}`,
      });
      ruleId = rule.id;
    }

    await storage.enqueueAutomationItem({
      ruleId,
      triggerEvent: "content_published",
      entityType: "business",
      entityId: trigger.entityId,
      payload: {
        triggerType: trigger.triggerType,
        entityName: trigger.entityName,
        recommendedNextAction: trigger.recommendedNextAction,
        reason: trigger.reason,
        priority: trigger.priority,
        cityId: options.cityId || "",
        email: actionConfig.toEmail || "",
        title: actionConfig.title || "",
        contentType: actionConfig.contentType || "",
        prompt: actionConfig.prompt || "",
        excerpt: actionConfig.excerpt || "",
        ...trigger.metadata,
      },
      fireAt: new Date(Date.now() + (options.delayMinutes || 0) * 60 * 1000),
    });

    console.log(`[EngagementHooks] Queued ${trigger.triggerType} action for ${trigger.entityName} (${trigger.entityId})`);
    return { queued: true, method: actionType };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[EngagementHooks] Queue error:", msg);
    return { queued: false, method: "error" };
  }
}

async function handleSendEmail(
  config: Record<string, any>,
  queueItem: AutomationQueueItem
): Promise<ActionResult> {
  try {
    const templateKey = config.templateKey;
    if (!templateKey) {
      return { success: false, error: "No templateKey in action config" };
    }

    const templates = await storage.getEmailTemplates({ templateKey });
    const template = templates[0];
    if (!template) {
      return { success: false, error: `Email template not found: ${templateKey}` };
    }

    const payload = (queueItem.payload || {}) as Record<string, any>;
    const toEmail = payload.email || config.toEmail;
    if (!toEmail) {
      return { success: false, error: "No recipient email available" };
    }

    const { sendTemplatedEmail } = await import("../resend-client");
    let subject = template.subject;
    let html = template.htmlBody;

    if (payload) {
      for (const [key, value] of Object.entries(payload)) {
        if (typeof value === "string") {
          subject = subject.replaceAll(`{{${key}}}`, value);
          html = html.replaceAll(`{{${key}}}`, value);
        }
      }
    }

    const sent = await sendTemplatedEmail(toEmail, subject, html);
    return {
      success: sent,
      data: { toEmail, templateKey, subject },
      error: sent ? undefined : "Email send failed",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: msg };
  }
}

async function handleUpdateStatus(
  config: Record<string, any>,
  queueItem: AutomationQueueItem
): Promise<ActionResult> {
  try {
    const newStatus = config.newStatus;
    if (!newStatus) {
      return { success: false, error: "No newStatus in action config" };
    }

    const entityType = queueItem.entityType;
    const entityId = queueItem.entityId;

    switch (entityType) {
      case "business": {
        const businessUpdate: Partial<InsertBusiness> = { claimStatus: newStatus };
        await storage.updateBusiness(entityId, businessUpdate);
        break;
      }
      case "event": {
        const eventUpdate: Partial<InsertEvent> = { status: newStatus };
        await storage.updateEvent(entityId, eventUpdate);
        break;
      }
      case "cms_content":
        await storage.updateCmsContentItem(entityId, { status: newStatus });
        break;
      case "lead":
        await storage.updateLeadStatus(entityId, newStatus);
        break;
      case "submission":
        await storage.updateSubmissionStatus(entityId, newStatus);
        break;
      default:
        return { success: false, error: `Cannot update status for entity type: ${entityType}` };
    }

    return { success: true, data: { entityType, entityId, newStatus } };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: msg };
  }
}

async function handleGenerateContent(
  config: Record<string, any>,
  queueItem: AutomationQueueItem
): Promise<ActionResult> {
  try {
    const payload = (queueItem.payload || {}) as Record<string, any>;
    const { generateContentPackage } = await import("../content-studio-routes");

    await generateContentPackage({
      metroId: payload.cityId || config.cityId || "",
      sourceType: queueItem.entityType,
      sourceId: queueItem.entityId,
      sourceTitle: payload.title || "Untitled",
      sourceExcerpt: payload.excerpt || null,
      sourceImageUrl: payload.imageUrl || null,
    });

    return { success: true, data: { entityType: queueItem.entityType, entityId: queueItem.entityId } };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: msg };
  }
}

async function handleCreateNotification(
  config: Record<string, any>,
  queueItem: AutomationQueueItem,
  rule: AutomationRule
): Promise<ActionResult> {
  try {
    const payload = (queueItem.payload || {}) as Record<string, any>;
    const title = config.notificationTitle || `Automation: ${rule.name || rule.triggerEvent}`;
    const body = config.notificationBody || `Triggered by ${queueItem.entityType} ${queueItem.entityId}`;

    await storage.createInboxItem({
      itemType: "automation",
      title: title.replaceAll("{{entityType}}", queueItem.entityType).replaceAll("{{entityId}}", queueItem.entityId),
      body: body.replaceAll("{{entityType}}", queueItem.entityType).replaceAll("{{entityId}}", queueItem.entityId),
      priority: config.priority || "medium",
      status: "open",
      relatedTable: queueItem.entityType,
      relatedId: queueItem.entityId,
      tags: ["automation"],
    });

    return { success: true, data: { title, entityType: queueItem.entityType } };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: msg };
  }
}
