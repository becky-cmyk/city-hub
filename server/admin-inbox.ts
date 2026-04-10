import { storage } from "./storage";
import { pool } from "./db";
import type { InsertAdminInboxItem, InsertAdminInboxHistory, AdminInboxItem } from "@shared/schema";

export type TriageCategory = "needs_review" | "exception" | "unprocessed" | "notification";

const TRIAGE_CATEGORY_MAP: Record<string, TriageCategory> = {
  submission_business: "needs_review",
  submission_organization: "needs_review",
  submission_event: "needs_review",
  submission_article_pitch: "needs_review",
  submission_press_release: "needs_review",
  submission_shoutout: "needs_review",
  submission_media_mention: "needs_review",
  presence_claim_confirm: "needs_review",
  presence_transfer_request: "needs_review",
  presence_review_charlotte_verification: "needs_review",
  cms_content_review: "needs_review",
  vendor_review: "needs_review",
  event_review: "needs_review",
  capture_listing_review: "needs_review",
  field_capture_review: "needs_review",
  pipeline_needs_review: "needs_review",
  pipeline_processing_failed: "exception",
  marketplace_inquiry: "needs_review",
  listing_imported_needs_publish: "unprocessed",
  recommendation_gap: "unprocessed",
  spotlight_article_generated: "unprocessed",
  billing_past_due: "exception",
  billing_founder_grace_expiring: "exception",
  org_supporter_grace_started: "exception",
  org_supporter_grace_expiring: "exception",
  email_bounce_attention: "exception",
  email_complaint_attention: "exception",
  places_import_failed: "exception",
  site_error_report: "exception",
  story_interview_scheduled: "notification",
  new_activation: "notification",
  new_review: "notification",
  new_lead: "notification",
  new_vote: "notification",
  pipeline_promoted: "notification",
  stock_photo_capture: "needs_review",
  visitor_feedback: "needs_review",
};

export function classifyTriageCategory(itemType: string): TriageCategory {
  return TRIAGE_CATEGORY_MAP[itemType] || "notification";
}

const TRIAGE_REASON_MAP: Record<string, string> = {
  submission_business: "New business submission needs admin review",
  submission_organization: "New organization submission needs admin review",
  submission_event: "New event submission needs admin review",
  submission_article_pitch: "Article pitch submitted for editorial review",
  submission_press_release: "Press release submitted for review",
  submission_shoutout: "Hub shout-out submitted for review",
  submission_media_mention: "Media mention submitted for review",
  presence_claim_confirm: "Business ownership claim needs verification",
  presence_transfer_request: "Ownership transfer request needs approval",
  presence_review_charlotte_verification: "Charlotte verification needs admin confirmation",
  cms_content_review: "CMS content awaiting editorial review",
  vendor_review: "Vendor listing needs review",
  event_review: "Event listing needs review",
  capture_listing_review: "Captured listing data needs review before publishing",
  pipeline_needs_review: "Pipeline item needs manual review",
  marketplace_inquiry: "Marketplace inquiry received",
  listing_imported_needs_publish: "Imported listing ready for publish review",
  recommendation_gap: "Charlotte identified a recommendation gap",
  spotlight_article_generated: "AI-generated spotlight article ready for review",
  billing_past_due: "Billing is past due — action required",
  billing_founder_grace_expiring: "Founder grace period expiring soon",
  org_supporter_grace_started: "Organization supporter count below minimum",
  org_supporter_grace_expiring: "Supporter grace period expiring soon",
  email_bounce_attention: "Email delivery failure detected",
  email_complaint_attention: "Email complaint received — review suppression",
  places_import_failed: "Places import job failed",
  site_error_report: "Site error reported by user",
  story_interview_scheduled: "Story interview has been scheduled",
  new_activation: "New business activation",
  new_review: "New review received",
  new_lead: "New lead received",
  new_vote: "New vote cast",
  pipeline_promoted: "Pipeline item was promoted",
  visitor_feedback: "Visitor feedback submitted via Charlotte chat",
};

type InboxItemInput = {
  itemType: InsertAdminInboxItem["itemType"];
  relatedTable: string;
  relatedId: string;
  title: string;
  summary?: string;
  priority?: InsertAdminInboxItem["priority"];
  tags?: string[];
  visibility?: InsertAdminInboxItem["visibility"];
  dueAt?: Date;
  links?: { label: string; urlOrRoute: string }[];
  confidence?: number;
  triageReason?: string;
  suggestedAction?: string;
  triageMetadata?: Record<string, unknown>;
  triageCategory?: TriageCategory;
};

export async function createInboxItemIfNotOpen(input: InboxItemInput): Promise<AdminInboxItem> {
  const existing = await storage.findOpenInboxItem(input.relatedTable, input.relatedId, input.itemType);
  if (existing) {
    if (input.summary && input.summary !== existing.summary) {
      await storage.updateInboxItem(existing.id, { summary: input.summary });
      await storage.createInboxHistory({
        inboxItemId: existing.id,
        actorType: "system",
        fieldName: "summary",
        oldValue: existing.summary || "",
        newValue: input.summary,
        reason: "Updated by system (duplicate prevented)",
      });
    }
    await storage.createInboxComment({
      inboxItemId: existing.id,
      commentText: `System: duplicate creation attempted — "${input.title}". Existing item updated.`,
    });
    return existing;
  }

  const triageCategory = input.triageCategory || classifyTriageCategory(input.itemType);
  const triageReason = input.triageReason || TRIAGE_REASON_MAP[input.itemType] || null;

  const item = await storage.createInboxItem({
    itemType: input.itemType,
    relatedTable: input.relatedTable,
    relatedId: input.relatedId,
    title: input.title,
    summary: input.summary,
    priority: input.priority || "med",
    tags: input.tags,
    visibility: input.visibility || "admin_only",
    dueAt: input.dueAt,
    status: "open",
    triageCategory,
    confidence: input.confidence != null ? String(input.confidence) : null,
    triageReason,
    suggestedAction: input.suggestedAction || null,
    triageMetadata: input.triageMetadata || null,
  });

  await storage.createInboxHistory({
    inboxItemId: item.id,
    actorType: "system",
    fieldName: "status",
    oldValue: null,
    newValue: "open",
    reason: "Item created by system",
  });

  if (input.links) {
    for (const link of input.links) {
      await storage.createInboxLink({
        inboxItemId: item.id,
        label: link.label,
        urlOrRoute: link.urlOrRoute,
      });
    }
  }

  return item;
}

export async function updateInboxItemWithHistory(
  itemId: string,
  updates: Partial<InsertAdminInboxItem>,
  actorType: "admin" | "sales" | "editor" | "system" = "admin",
  actorUserId?: string,
  reason?: string
): Promise<AdminInboxItem | undefined> {
  const existing = await storage.getInboxItemById(itemId);
  if (!existing) return undefined;

  const trackFields = ["status", "priority", "assignedToUserId", "summary", "dueAt", "visibility", "tags"] as const;
  for (const field of trackFields) {
    if (updates[field] !== undefined) {
      const oldVal = existing[field];
      const newVal = updates[field];
      const oldStr = oldVal == null ? null : String(oldVal);
      const newStr = newVal == null ? null : String(newVal);
      if (oldStr !== newStr) {
        await storage.createInboxHistory({
          inboxItemId: itemId,
          actorType,
          actorUserId: actorUserId || null,
          fieldName: field,
          oldValue: oldStr,
          newValue: newStr,
          reason,
        });
      }
    }
  }

  return storage.updateInboxItem(itemId, updates);
}

export async function getTriageCounts(): Promise<{ needsReview: number; exceptions: number; unprocessed: number; notifications: number; resolvedToday: number }> {
  const result = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE triage_category = 'needs_review' AND status IN ('open', 'in_progress', 'waiting')) AS needs_review,
      COUNT(*) FILTER (WHERE triage_category = 'exception' AND status IN ('open', 'in_progress', 'waiting')) AS exceptions,
      COUNT(*) FILTER (WHERE triage_category = 'unprocessed' AND status IN ('open', 'in_progress', 'waiting')) AS unprocessed,
      COUNT(*) FILTER (WHERE triage_category = 'notification' AND status IN ('open', 'in_progress', 'waiting')) AS notifications,
      COUNT(*) FILTER (WHERE status IN ('resolved', 'closed') AND resolved_at >= CURRENT_DATE) AS resolved_today
    FROM admin_inbox_items
  `);
  const row = result.rows[0] || {};
  return {
    needsReview: parseInt(row.needs_review || "0"),
    exceptions: parseInt(row.exceptions || "0"),
    unprocessed: parseInt(row.unprocessed || "0"),
    notifications: parseInt(row.notifications || "0"),
    resolvedToday: parseInt(row.resolved_today || "0"),
  };
}

export async function resolveInboxItem(
  itemId: string,
  resolution: "approved" | "dismissed",
  actorUserId?: string,
  reason?: string
): Promise<AdminInboxItem | undefined> {
  const status = resolution === "approved" ? "resolved" : "closed";
  return updateInboxItemWithHistory(itemId, { status }, "admin", actorUserId, reason || `Item ${resolution} by admin`);
}

const SUBMISSION_TYPE_MAP: Record<string, InsertAdminInboxItem["itemType"]> = {
  BUSINESS: "submission_business",
  ORGANIZATION: "submission_organization",
  EVENT: "submission_event",
  ARTICLE_PITCH: "submission_article_pitch",
  PRESS_RELEASE: "submission_press_release",
  HUB_SHOUT_OUT: "submission_shoutout",
  MEDIA_MENTION: "submission_media_mention",
};

export async function onSubmissionCreated(submission: { id: string; type: string; businessName?: string | null; contactName?: string | null }) {
  const itemType = SUBMISSION_TYPE_MAP[submission.type];
  if (!itemType) return;
  const label = submission.type.replace(/_/g, " ").toLowerCase();
  const name = submission.businessName || submission.contactName || "Unknown";
  await createInboxItemIfNotOpen({
    itemType,
    relatedTable: "submissions",
    relatedId: submission.id,
    title: `New ${label}: ${name}`,
    summary: `A new ${label} submission was received for "${name}".`,
    tags: ["Submission"],
    links: [{ label: "Review Submission", urlOrRoute: "/admin/submissions" }],
  });
}

export async function onCmsContentReview(contentItem: { id: string; title: string }) {
  await createInboxItemIfNotOpen({
    itemType: "cms_content_review",
    relatedTable: "cms_content_items",
    relatedId: contentItem.id,
    title: `CMS Review: ${contentItem.title}`,
    summary: `Content "${contentItem.title}" is awaiting editorial review.`,
    tags: ["CMS"],
    visibility: "editor_ok",
    links: [{ label: "Open in CMS Editor", urlOrRoute: `/admin/cms/edit/${contentItem.id}` }],
  });
}

export async function onCmsContentResolved(contentItemId: string) {
  const existing = await storage.findOpenInboxItem("cms_content_items", contentItemId, "cms_content_review");
  if (existing) {
    await updateInboxItemWithHistory(existing.id, { status: "resolved" }, "system", undefined, "Content published/archived/returned to draft");
  }
}

export async function onPresenceClaimConfirm(claim: { id: string; businessName: string }) {
  await createInboxItemIfNotOpen({
    itemType: "presence_claim_confirm",
    relatedTable: "businesses",
    relatedId: claim.id,
    title: `Presence Claim: ${claim.businessName}`,
    summary: `A claim confirmation is pending for "${claim.businessName}".`,
    tags: ["Presence"],
    links: [{ label: "Review Presence", urlOrRoute: `/admin/businesses?openBiz=${claim.id}` }],
  });
}

export async function onPresenceTransferRequest(transfer: { id: string; businessName: string }) {
  await createInboxItemIfNotOpen({
    itemType: "presence_transfer_request",
    relatedTable: "ownership_transfer_requests",
    relatedId: transfer.id,
    title: `Transfer Request: ${transfer.businessName}`,
    summary: `An ownership transfer has been requested for "${transfer.businessName}".`,
    priority: "high",
    tags: ["Presence", "Transfer"],
    links: [{ label: "Review Transfer", urlOrRoute: `/admin/transfers` }],
  });
}

export async function onBillingPastDue(subscription: { id: string; presenceName: string }) {
  await createInboxItemIfNotOpen({
    itemType: "billing_past_due",
    relatedTable: "presence_subscriptions",
    relatedId: subscription.id,
    title: `Billing Past Due: ${subscription.presenceName}`,
    summary: `Subscription for "${subscription.presenceName}" is past due.`,
    priority: "high",
    tags: ["Billing"],
    links: [{ label: "Review Billing", urlOrRoute: `/admin/listing-tiers` }],
  });
}

export async function onFounderGraceExpiring(subscription: { id: string; presenceName: string; graceExpiresAt: Date }) {
  await createInboxItemIfNotOpen({
    itemType: "billing_founder_grace_expiring",
    relatedTable: "presence_subscriptions",
    relatedId: subscription.id,
    title: `Founder Grace Expiring: ${subscription.presenceName}`,
    summary: `Founder grace period for "${subscription.presenceName}" expires ${subscription.graceExpiresAt.toISOString().slice(0, 10)}.`,
    priority: "high",
    dueAt: subscription.graceExpiresAt,
    tags: ["Billing", "Founder"],
    links: [{ label: "Review Billing", urlOrRoute: `/admin/listing-tiers` }],
  });
}

export async function onOrgSupporterGraceStarted(org: { id: string; name: string }) {
  await createInboxItemIfNotOpen({
    itemType: "org_supporter_grace_started",
    relatedTable: "businesses",
    relatedId: org.id,
    title: `Supporter Grace Started: ${org.name}`,
    summary: `Organization "${org.name}" has fewer than 3 supporters. Grace period started.`,
    priority: "med",
    tags: ["Org", "Supporter"],
  });
}

export async function onOrgSupporterGraceExpiring(org: { id: string; name: string; graceEnd: Date }) {
  await createInboxItemIfNotOpen({
    itemType: "org_supporter_grace_expiring",
    relatedTable: "businesses",
    relatedId: org.id,
    title: `Supporter Grace Expiring: ${org.name}`,
    summary: `Supporter grace for "${org.name}" expires ${org.graceEnd.toISOString().slice(0, 10)}.`,
    priority: "high",
    dueAt: org.graceEnd,
    tags: ["Org", "Supporter"],
  });
}

export async function onEmailBounce(email: string, campaignId?: string) {
  await createInboxItemIfNotOpen({
    itemType: "email_bounce_attention",
    relatedTable: "email_suppression",
    relatedId: email,
    title: `Email Bounce: ${email}`,
    summary: `Email to "${email}" bounced${campaignId ? ` (campaign ${campaignId})` : ""}.`,
    priority: "low",
    tags: ["Email", "Bounce"],
    links: [{ label: "View Suppression", urlOrRoute: `/admin/email-suppression` }],
  });
}

export async function onEmailComplaint(email: string, campaignId?: string) {
  await createInboxItemIfNotOpen({
    itemType: "email_complaint_attention",
    relatedTable: "email_suppression",
    relatedId: email,
    title: `Email Complaint: ${email}`,
    summary: `Complaint received from "${email}"${campaignId ? ` (campaign ${campaignId})` : ""}.`,
    priority: "high",
    tags: ["Email", "Complaint"],
    links: [{ label: "View Suppression", urlOrRoute: `/admin/email-suppression` }],
  });
}

export async function onStoryInterviewScheduled(opts: {
  businessId: string;
  businessName: string;
  businessSlug: string;
  ownerName: string;
  ownerEmail: string;
  tier: string;
  bookingDate: string;
  bookingTime: string;
  citySlug?: string;
  preferredLanguage?: string;
}) {
  const tierLabel = opts.tier === "ENHANCED" ? "Expanded Hub Presence" : "Hub Presence";
  const slug = opts.citySlug || "charlotte";
  const langNote = opts.preferredLanguage === "es" ? " | Preferred language: Spanish" : "";
  const tags = ["Story", "Interview", tierLabel];
  if (opts.preferredLanguage === "es") tags.push("Spanish");
  await createInboxItemIfNotOpen({
    itemType: "story_interview_scheduled",
    relatedTable: "businesses",
    relatedId: opts.businessId,
    title: `Story Interview: ${opts.businessName}`,
    summary: `Scheduled for ${opts.bookingDate} at ${opts.bookingTime} with ${opts.ownerName} (${opts.ownerEmail}). Tier: ${tierLabel}.${langNote}`,
    priority: "high",
    tags,
    links: [
      { label: "View Business", urlOrRoute: `/admin?section=presence-spine&id=${opts.businessId}` },
      { label: "View Listing", urlOrRoute: `/${slug}/directory/${opts.businessSlug}` },
    ],
  });
}

export async function createCaptureTriageItem(opts: {
  captureItemId: string;
  captureSessionId: string;
  entityName: string | null;
  confidence: number;
  matchCandidates: Array<{ id: string; name: string; confidence: number; matchFields: Record<string, string> }>;
  extractedData: Record<string, unknown> | null;
  suggestedAction: string;
  triageCategory?: TriageCategory;
  triageReason?: string;
}): Promise<AdminInboxItem> {
  const name = opts.entityName || (opts.extractedData?.name as string) || (opts.extractedData?.company as string) || "Unknown entity";
  const confPct = Math.round(opts.confidence * 100);
  const reason = opts.triageReason || (opts.matchCandidates.length > 0
    ? (confPct >= 80
      ? `Match found (${confPct}%) — ${opts.matchCandidates.length} candidate${opts.matchCandidates.length > 1 ? "s" : ""} for review`
      : `Low-confidence match (${confPct}%) — ${opts.matchCandidates.length} possible match${opts.matchCandidates.length > 1 ? "es" : ""} found`)
    : `No confident match found for captured data (${confPct}%)`);

  return createInboxItemIfNotOpen({
    itemType: "capture_listing_review",
    relatedTable: "capture_session_items",
    relatedId: opts.captureItemId,
    title: opts.triageCategory === "exception" ? `Capture error: ${name}` : `Review capture: ${name}`,
    summary: reason,
    priority: opts.triageCategory === "exception" ? "high" : opts.confidence < 0.3 ? "high" : "med",
    tags: opts.triageCategory === "exception" ? ["Capture", "Error"] : ["Capture", "Triage"],
    triageCategory: opts.triageCategory || "needs_review",
    confidence: opts.confidence,
    triageReason: reason,
    suggestedAction: opts.suggestedAction,
    triageMetadata: {
      captureSessionId: opts.captureSessionId,
      captureItemId: opts.captureItemId,
      matchCandidates: opts.matchCandidates,
      extractedData: opts.extractedData,
    },
    links: [
      { label: "View Capture Session", urlOrRoute: `/admin?section=field-captures` },
    ],
  });
}

export async function onVisitorFeedback(opts: {
  sessionId: string;
  summary: string;
  category: "bug" | "suggestion" | "complaint" | "praise";
  pageContext?: string;
}) {
  const categoryLabels: Record<string, string> = {
    bug: "Bug Report",
    suggestion: "Suggestion",
    complaint: "Complaint",
    praise: "Praise",
  };
  const categoryLabel = categoryLabels[opts.category] || "Feedback";
  const priority = opts.category === "bug" || opts.category === "complaint" ? "high" as const : "med" as const;

  return createInboxItemIfNotOpen({
    itemType: "visitor_feedback",
    relatedTable: "charlotte_public_sessions",
    relatedId: opts.sessionId,
    title: `Visitor ${categoryLabel}: ${opts.summary.substring(0, 80)}${opts.summary.length > 80 ? "…" : ""}`,
    summary: opts.summary,
    priority,
    tags: ["Feedback", categoryLabel],
    triageMetadata: {
      chatSessionId: opts.sessionId,
      feedbackCategory: opts.category,
      pageContext: opts.pageContext || null,
    },
    links: [
      { label: "Review Chat Session", urlOrRoute: `/admin?section=inbox` },
    ],
  });
}
