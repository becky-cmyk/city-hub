import { db, pool } from "./db";
import { eq, and, isNull } from "drizzle-orm";
import { businesses, crmContacts, events } from "@shared/schema";
import { createInboxItemIfNotOpen } from "./admin-inbox";
import type { ResolvedEntity, OrchestratorResult } from "./charlotte-orchestrator";

export type ProposalStatus = "pending" | "confirmed" | "executing" | "completed" | "partial" | "failed" | "cancelled";
export type ProposalItemStatus = "proposed" | "confirmed" | "skipped" | "executing" | "completed" | "failed";

export type ActionTemplateKey =
  | "CLAIM_LISTING"
  | "STORY_DRAFT"
  | "BECKY_OUTREACH"
  | "CROWN_CANDIDATE"
  | "FOLLOWUP_EMAIL"
  | "LISTING_UPGRADE"
  | "TV_VENUE_SCREEN"
  | "CONTENT_ARTICLE"
  | "EVENT_PROMOTION"
  | "SEARCH_RECOMMENDATION";

export interface ActionTemplate {
  key: ActionTemplateKey;
  label: string;
  description: string;
  requiredEntityType: "business" | "contact" | "event" | "any";
  requiresConfirmation: boolean;
  estimatedDurationMs: number;
}

export interface ProposalItem {
  id?: string;
  templateKey: ActionTemplateKey;
  entityType: string | null;
  entityId: string | null;
  entityName: string | null;
  status: ProposalItemStatus;
  params: Record<string, unknown>;
  result?: Record<string, unknown> | null;
  errorMessage?: string | null;
}

export interface Proposal {
  id?: string;
  metroId: string | null;
  userId: string | null;
  source: string;
  directive: string | null;
  status: ProposalStatus;
  mode: string | null;
  items: ProposalItem[];
  batchMode: boolean;
  orchestratorDecisionId: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface BatchDirective {
  directive: string;
  metroId: string;
  entityType: "business" | "contact" | "event";
  filters?: {
    claimStatus?: string;
    listingTier?: string;
    outreachStatus?: string;
    zoneId?: string;
    categorySlug?: string;
  };
  templateKeys: ActionTemplateKey[];
  limit?: number;
}

export interface OpportunityResult {
  entityId: string;
  entityName: string;
  entityType: "business" | "contact" | "event";
  eligibleTemplates: ActionTemplateKey[];
  reasons: Record<ActionTemplateKey, string>;
}

const ACTION_TEMPLATES: Record<ActionTemplateKey, ActionTemplate> = {
  CLAIM_LISTING: {
    key: "CLAIM_LISTING",
    label: "Claim Listing Outreach",
    description: "Queue unclaimed listing for outreach via Becky intro flow",
    requiredEntityType: "business",
    requiresConfirmation: true,
    estimatedDurationMs: 3000,
  },
  STORY_DRAFT: {
    key: "STORY_DRAFT",
    label: "Generate Story Draft",
    description: "Create AI-generated story article from capture or business data",
    requiredEntityType: "contact",
    requiresConfirmation: false,
    estimatedDurationMs: 5000,
  },
  BECKY_OUTREACH: {
    key: "BECKY_OUTREACH",
    label: "Becky Intro Email",
    description: "Send personalized intro email from Becky with story preview and booking link",
    requiredEntityType: "contact",
    requiresConfirmation: true,
    estimatedDurationMs: 4000,
  },
  CROWN_CANDIDATE: {
    key: "CROWN_CANDIDATE",
    label: "Crown Nomination Candidate",
    description: "Flag business as eligible Crown competition candidate",
    requiredEntityType: "business",
    requiresConfirmation: true,
    estimatedDurationMs: 2000,
  },
  FOLLOWUP_EMAIL: {
    key: "FOLLOWUP_EMAIL",
    label: "Follow-up Email",
    description: "Queue Charlotte follow-up email for contacts who haven't responded",
    requiredEntityType: "contact",
    requiresConfirmation: true,
    estimatedDurationMs: 3000,
  },
  LISTING_UPGRADE: {
    key: "LISTING_UPGRADE",
    label: "Listing Tier Upgrade",
    description: "Recommend listing tier upgrade based on engagement signals",
    requiredEntityType: "business",
    requiresConfirmation: true,
    estimatedDurationMs: 1000,
  },
  TV_VENUE_SCREEN: {
    key: "TV_VENUE_SCREEN",
    label: "TV Venue Screen Feature",
    description: "Add business to venue TV screen rotation for local exposure",
    requiredEntityType: "business",
    requiresConfirmation: true,
    estimatedDurationMs: 2000,
  },
  CONTENT_ARTICLE: {
    key: "CONTENT_ARTICLE",
    label: "Content Article Draft",
    description: "Generate editorial content article about entity for the hub",
    requiredEntityType: "any",
    requiresConfirmation: false,
    estimatedDurationMs: 6000,
  },
  EVENT_PROMOTION: {
    key: "EVENT_PROMOTION",
    label: "Event Promotion",
    description: "Boost event visibility through featured placement and notifications",
    requiredEntityType: "event",
    requiresConfirmation: true,
    estimatedDurationMs: 2000,
  },
  SEARCH_RECOMMENDATION: {
    key: "SEARCH_RECOMMENDATION",
    label: "Search Priority Boost",
    description: "Adjust search ranking signals for entity based on trust and geo relevance",
    requiredEntityType: "business",
    requiresConfirmation: false,
    estimatedDurationMs: 1000,
  },
};

export function getActionTemplate(key: ActionTemplateKey): ActionTemplate | null {
  return ACTION_TEMPLATES[key] || null;
}

export function getAllActionTemplates(): ActionTemplate[] {
  return Object.values(ACTION_TEMPLATES);
}

export async function evaluateOpportunities(
  entityId: string,
  entityType: "business" | "contact" | "event",
  metroId?: string
): Promise<OpportunityResult> {
  const eligibleTemplates: ActionTemplateKey[] = [];
  const reasons: Partial<Record<ActionTemplateKey, string>> = {};

  if (entityType === "business") {
    const bizConditions = [eq(businesses.id, entityId)];
    if (metroId) bizConditions.push(eq(businesses.cityId, metroId));
    const [biz] = await db
      .select()
      .from(businesses)
      .where(and(...bizConditions))
      .limit(1);

    if (biz) {
      if (biz.claimStatus === "UNCLAIMED") {
        eligibleTemplates.push("CLAIM_LISTING");
        reasons.CLAIM_LISTING = "Business listing is unclaimed";
      }

      if (biz.listingTier === "FREE") {
        eligibleTemplates.push("LISTING_UPGRADE");
        reasons.LISTING_UPGRADE = "Business is on FREE tier, eligible for upgrade";
      }

      eligibleTemplates.push("CROWN_CANDIDATE");
      reasons.CROWN_CANDIDATE = "All active businesses eligible for Crown evaluation";

      eligibleTemplates.push("TV_VENUE_SCREEN");
      reasons.TV_VENUE_SCREEN = "Business eligible for venue TV rotation";

      eligibleTemplates.push("CONTENT_ARTICLE");
      reasons.CONTENT_ARTICLE = "Business eligible for editorial content";

      eligibleTemplates.push("SEARCH_RECOMMENDATION");
      reasons.SEARCH_RECOMMENDATION = "Business eligible for search signal adjustment";

      return {
        entityId,
        entityName: biz.name,
        entityType: "business",
        eligibleTemplates,
        reasons: reasons as Record<ActionTemplateKey, string>,
      };
    }
  }

  if (entityType === "contact") {
    const [contact] = await db
      .select()
      .from(crmContacts)
      .where(eq(crmContacts.id, entityId))
      .limit(1);

    if (contact) {
      if (!contact.linkedArticleId) {
        eligibleTemplates.push("STORY_DRAFT");
        reasons.STORY_DRAFT = "Contact has no linked story article yet";
      }

      if (
        contact.email &&
        (!contact.outreachStatus || contact.outreachStatus === "NEW" || contact.outreachStatus === "PENDING")
      ) {
        eligibleTemplates.push("BECKY_OUTREACH");
        reasons.BECKY_OUTREACH = "Contact has email and hasn't received outreach";
      }

      if (
        contact.email &&
        contact.outreachStatus === "INVITE_SENT" &&
        !contact.calendarBookedAt
      ) {
        eligibleTemplates.push("FOLLOWUP_EMAIL");
        reasons.FOLLOWUP_EMAIL = "Contact received invite but hasn't booked";
      }

      eligibleTemplates.push("CONTENT_ARTICLE");
      reasons.CONTENT_ARTICLE = "Contact eligible for editorial content";

      return {
        entityId,
        entityName: contact.name,
        entityType: "contact",
        eligibleTemplates,
        reasons: reasons as Record<ActionTemplateKey, string>,
      };
    }
  }

  if (entityType === "event") {
    const [evt] = await db
      .select()
      .from(events)
      .where(eq(events.id, entityId))
      .limit(1);

    if (evt) {
      eligibleTemplates.push("EVENT_PROMOTION");
      reasons.EVENT_PROMOTION = "Event eligible for featured promotion";

      eligibleTemplates.push("CONTENT_ARTICLE");
      reasons.CONTENT_ARTICLE = "Event eligible for editorial coverage";

      return {
        entityId,
        entityName: evt.title,
        entityType: "event",
        eligibleTemplates,
        reasons: reasons as Record<ActionTemplateKey, string>,
      };
    }
  }

  return {
    entityId,
    entityName: "Unknown",
    entityType,
    eligibleTemplates: [],
    reasons: {} as Record<ActionTemplateKey, string>,
  };
}

export async function buildProposal(
  entity: ResolvedEntity,
  templateKeys: ActionTemplateKey[],
  options: {
    metroId?: string;
    userId?: string;
    source?: string;
    directive?: string;
    orchestratorDecisionId?: string;
    mode?: string;
  } = {}
): Promise<Proposal> {
  if (!entity.entityId) {
    return {
      metroId: options.metroId || null,
      userId: options.userId || null,
      source: options.source || "orchestrator",
      directive: options.directive || null,
      status: "failed",
      mode: options.mode || null,
      items: [],
      batchMode: false,
      orchestratorDecisionId: options.orchestratorDecisionId || null,
    };
  }

  const validEntityTypes = ["business", "contact", "event"] as const;
  const entityTypeForEval = validEntityTypes.includes(entity.entityType as typeof validEntityTypes[number])
    ? (entity.entityType as "business" | "contact" | "event")
    : "business";

  const opportunity = await evaluateOpportunities(
    entity.entityId,
    entityTypeForEval,
    options.metroId
  );

  const applicableKeys = templateKeys.length > 0
    ? templateKeys.filter((k) => opportunity.eligibleTemplates.includes(k))
    : opportunity.eligibleTemplates;

  const items: ProposalItem[] = applicableKeys.map((key) => ({
    templateKey: key,
    entityType: entity.entityType,
    entityId: entity.entityId,
    entityName: entity.name || opportunity.entityName,
    status: "proposed" as ProposalItemStatus,
    params: {
      reason: opportunity.reasons[key] || "Eligible",
      templateLabel: ACTION_TEMPLATES[key]?.label || key,
    },
  }));

  const proposal: Proposal = {
    metroId: options.metroId || null,
    userId: options.userId || null,
    source: options.source || "orchestrator",
    directive: options.directive || null,
    status: "pending",
    mode: options.mode || "proposal",
    items,
    batchMode: false,
    orchestratorDecisionId: options.orchestratorDecisionId || null,
  };

  return saveProposal(proposal);
}

export async function buildBatchProposal(directive: BatchDirective): Promise<Proposal> {
  const limit = Math.min(directive.limit || 50, 200);
  let entityRows: { id: string; name: string }[] = [];

  if (directive.entityType === "business") {
    const bizConditions = [eq(businesses.cityId, directive.metroId)];
    if (directive.filters?.claimStatus) {
      bizConditions.push(eq(businesses.claimStatus, directive.filters.claimStatus));
    }
    if (directive.filters?.listingTier) {
      bizConditions.push(eq(businesses.listingTier, directive.filters.listingTier));
    }
    if (directive.filters?.zoneId) {
      bizConditions.push(eq(businesses.zoneId, directive.filters.zoneId));
    }

    entityRows = await db
      .select({ id: businesses.id, name: businesses.name })
      .from(businesses)
      .where(and(...bizConditions))
      .limit(limit);
  } else if (directive.entityType === "contact") {
    const contactConditions = [isNull(crmContacts.deletedAt)];
    if (directive.filters?.outreachStatus) {
      contactConditions.push(eq(crmContacts.outreachStatus, directive.filters.outreachStatus));
    }

    entityRows = await db
      .select({ id: crmContacts.id, name: crmContacts.name })
      .from(crmContacts)
      .where(and(...contactConditions))
      .limit(limit);
  } else if (directive.entityType === "event") {
    entityRows = await db
      .select({ id: events.id, name: events.title })
      .from(events)
      .where(eq(events.cityId, directive.metroId))
      .limit(limit);
  }

  const allItems: ProposalItem[] = [];

  for (const row of entityRows) {
    const opportunity = await evaluateOpportunities(
      row.id,
      directive.entityType,
      directive.metroId
    );

    const applicableKeys = directive.templateKeys.filter((k) =>
      opportunity.eligibleTemplates.includes(k)
    );

    for (const key of applicableKeys) {
      allItems.push({
        templateKey: key,
        entityType: directive.entityType,
        entityId: row.id,
        entityName: row.name,
        status: "proposed",
        params: {
          reason: opportunity.reasons[key] || "Eligible",
          templateLabel: ACTION_TEMPLATES[key]?.label || key,
        },
      });
    }
  }

  const proposal: Proposal = {
    metroId: directive.metroId,
    userId: null,
    source: "batch_directive",
    directive: directive.directive,
    status: "pending",
    mode: "proposal",
    items: allItems,
    batchMode: true,
    orchestratorDecisionId: null,
  };

  return saveProposal(proposal);
}

async function saveProposal(proposal: Proposal): Promise<Proposal> {
  const result = await pool.query(
    `INSERT INTO charlotte_proposals
      (metro_id, user_id, source, directive, status, mode, total_items, confirmed_items, executed_items, failed_items, batch_mode, orchestrator_decision_id, metadata)
    VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 0, 0, $8, $9, $10)
    RETURNING id`,
    [
      proposal.metroId,
      proposal.userId,
      proposal.source,
      proposal.directive,
      proposal.status,
      proposal.mode,
      proposal.items.length,
      proposal.batchMode,
      proposal.orchestratorDecisionId,
      proposal.metadata ? JSON.stringify(proposal.metadata) : null,
    ]
  );

  const proposalId = result.rows[0].id;
  proposal.id = proposalId;

  for (const item of proposal.items) {
    const itemResult = await pool.query(
      `INSERT INTO charlotte_proposal_items
        (proposal_id, template_key, entity_type, entity_id, entity_name, status, params)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id`,
      [
        proposalId,
        item.templateKey,
        item.entityType,
        item.entityId,
        item.entityName,
        item.status,
        JSON.stringify(item.params),
      ]
    );
    item.id = itemResult.rows[0].id;
  }

  if (proposal.items.some((i) => ACTION_TEMPLATES[i.templateKey]?.requiresConfirmation)) {
    try {
      await createInboxItemIfNotOpen({
        itemType: "pipeline_needs_review",
        relatedTable: "charlotte_proposals",
        relatedId: proposalId,
        title: `Proposal: ${proposal.directive || proposal.items.length + " actions pending"}`,
        summary: `${proposal.items.length} proposed actions${proposal.batchMode ? " (batch)" : ""}. Templates: ${[...new Set(proposal.items.map((i) => i.templateKey))].join(", ")}`,
        priority: proposal.items.length > 10 ? "high" : "med",
        tags: ["Proposal", "Charlotte"],
      });
    } catch (inboxErr: unknown) {
      const msg = inboxErr instanceof Error ? inboxErr.message : "Unknown";
      console.error("[ProposalEngine] Inbox item creation failed:", msg);
    }
  }

  console.log(
    `[ProposalEngine] Proposal ${proposalId} created: ${proposal.items.length} items, batch=${proposal.batchMode}`
  );

  return proposal;
}

export async function confirmProposalItems(
  proposalId: string,
  itemIds: string[],
  action: "confirm" | "skip"
): Promise<{ updated: number }> {
  const newStatus: ProposalItemStatus = action === "confirm" ? "confirmed" : "skipped";

  const result = await pool.query(
    `UPDATE charlotte_proposal_items SET status = $1 WHERE proposal_id = $2 AND id = ANY($3) AND status = 'proposed' RETURNING id`,
    [newStatus, proposalId, itemIds]
  );

  if (action === "confirm") {
    await pool.query(
      `UPDATE charlotte_proposals SET confirmed_items = confirmed_items + $1, updated_at = NOW() WHERE id = $2`,
      [result.rowCount, proposalId]
    );
  }

  return { updated: result.rowCount || 0 };
}

export async function cancelProposal(proposalId: string): Promise<{ cancelled: number }> {
  const itemResult = await pool.query(
    `UPDATE charlotte_proposal_items SET status = 'skipped' WHERE proposal_id = $1 AND status IN ('proposed', 'confirmed') RETURNING id`,
    [proposalId]
  );

  await pool.query(
    `UPDATE charlotte_proposals SET status = 'cancelled', updated_at = NOW() WHERE id = $1 AND status IN ('pending', 'confirmed')`,
    [proposalId]
  );

  return { cancelled: itemResult.rowCount || 0 };
}

export async function confirmAllProposalItems(proposalId: string): Promise<{ updated: number }> {
  const result = await pool.query(
    `UPDATE charlotte_proposal_items SET status = 'confirmed' WHERE proposal_id = $1 AND status = 'proposed' RETURNING id`,
    [proposalId]
  );

  await pool.query(
    `UPDATE charlotte_proposals SET confirmed_items = $1, updated_at = NOW() WHERE id = $2`,
    [result.rowCount, proposalId]
  );

  return { updated: result.rowCount || 0 };
}

export async function executeProposal(proposalId: string): Promise<{
  executed: number;
  failed: number;
  results: { itemId: string; status: string; error?: string }[];
}> {
  await pool.query(
    `UPDATE charlotte_proposals SET status = 'executing', updated_at = NOW() WHERE id = $1`,
    [proposalId]
  );

  const itemsResult = await pool.query(
    `SELECT id, template_key, entity_type, entity_id, entity_name, params FROM charlotte_proposal_items WHERE proposal_id = $1 AND status = 'confirmed' ORDER BY created_at`,
    [proposalId]
  );

  let executed = 0;
  let failed = 0;
  const results: { itemId: string; status: string; error?: string }[] = [];

  for (const row of itemsResult.rows) {
    await pool.query(
      `UPDATE charlotte_proposal_items SET status = 'executing' WHERE id = $1`,
      [row.id]
    );

    try {
      const execResult = await executeTemplateAction(
        row.template_key as ActionTemplateKey,
        row.entity_id,
        row.entity_type,
        row.params ? (typeof row.params === "string" ? JSON.parse(row.params) : row.params) : {}
      );

      if (execResult.success === false) {
        const reason = String(execResult.reason || execResult.error || "Action returned unsuccessful");
        await pool.query(
          `UPDATE charlotte_proposal_items SET status = 'failed', result = $1, error_message = $2, executed_at = NOW() WHERE id = $3`,
          [JSON.stringify(execResult), reason, row.id]
        );
        failed++;
        results.push({ itemId: row.id, status: "failed", error: reason });
      } else {
        await pool.query(
          `UPDATE charlotte_proposal_items SET status = 'completed', result = $1, executed_at = NOW() WHERE id = $2`,
          [JSON.stringify(execResult), row.id]
        );
        executed++;
        results.push({ itemId: row.id, status: "completed" });
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Unknown execution error";

      await pool.query(
        `UPDATE charlotte_proposal_items SET status = 'failed', error_message = $1, executed_at = NOW() WHERE id = $2`,
        [errMsg, row.id]
      );

      failed++;
      results.push({ itemId: row.id, status: "failed", error: errMsg });
    }
  }

  const finalStatus = failed === 0 ? "completed" : executed === 0 ? "failed" : "partial";
  await pool.query(
    `UPDATE charlotte_proposals SET status = $1, executed_items = $2, failed_items = $3, updated_at = NOW() WHERE id = $4`,
    [finalStatus, executed, failed, proposalId]
  );

  console.log(
    `[ProposalEngine] Proposal ${proposalId} execution complete: ${executed} succeeded, ${failed} failed`
  );

  if (failed > 0) {
    try {
      const { createInboxItemIfNotOpen } = await import("./admin-inbox");
      const failedDetails = results.filter(r => r.status === "failed").map(r => r.error || "unknown").join("; ");
      await createInboxItemIfNotOpen({
        itemType: "pipeline_processing_failed",
        relatedTable: "charlotte_proposals",
        relatedId: proposalId,
        title: `Proposal execution failures: ${failed} of ${executed + failed} items failed`,
        summary: `Proposal ${proposalId} completed with ${failed} failures. Errors: ${failedDetails.substring(0, 500)}`,
        priority: failed === executed + failed ? "high" : "med",
        tags: ["Proposal", "ExecutionError", "Exception"],
      });
    } catch (inboxErr: unknown) {
      console.error("[ProposalEngine] Failed to create exception inbox item:", (inboxErr as Error).message);
    }
  }

  return { executed, failed, results };
}

async function executeTemplateAction(
  templateKey: ActionTemplateKey,
  entityId: string,
  entityType: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  switch (templateKey) {
    case "STORY_DRAFT": {
      const { generateStoryForCapture } = await import("./services/capture-story-generator");
      const storyResult = await generateStoryForCapture(entityId);
      if (!storyResult) return { success: false, reason: "Story generation returned null" };
      return { success: true, articleId: storyResult.articleId, title: storyResult.title };
    }

    case "BECKY_OUTREACH": {
      const { sendBeckyIntroEmail } = await import("./services/becky-outreach");
      const outreachResult = await sendBeckyIntroEmail(entityId);
      return { success: outreachResult.success, error: outreachResult.error || undefined };
    }

    case "CLAIM_LISTING": {
      const { pool: claimPool } = await import("./db");
      const existing = await claimPool.query(
        `SELECT id FROM listings_to_claim_queue WHERE presence_id = $1 LIMIT 1`,
        [entityId]
      );
      if (existing.rows.length === 0) {
        await claimPool.query(
          `INSERT INTO listings_to_claim_queue (presence_id, source, status, notes) VALUES ($1, 'proposal_engine', 'ready', $2)`,
          [entityId, `Queued via Charlotte Proposal Engine`]
        );
      }
      return { success: true, queued: true };
    }

    case "CROWN_CANDIDATE": {
      const { pool: crownPool } = await import("./db");
      const [biz] = await db.select().from(businesses).where(eq(businesses.id, entityId)).limit(1);
      if (!biz) return { success: false, reason: "Business not found" };

      const existingParticipant = await crownPool.query(
        `SELECT id FROM crown_participants WHERE business_id = $1 LIMIT 1`,
        [entityId]
      );
      if (existingParticipant.rows.length > 0) {
        return { success: true, alreadyCandidate: true, participantId: existingParticipant.rows[0].id };
      }

      await createInboxItemIfNotOpen({
        itemType: "pipeline_needs_review",
        relatedTable: "businesses",
        relatedId: entityId,
        title: `Crown Candidate Review: ${biz.name}`,
        summary: `Business "${biz.name}" flagged as potential Crown competition candidate via Proposal Engine.`,
        priority: "med",
        tags: ["Crown", "Candidate", "Proposal"],
      });
      return { success: true, flagged: true, businessName: biz.name, inboxCreated: true };
    }

    case "FOLLOWUP_EMAIL": {
      const [contact] = await db.select().from(crmContacts).where(eq(crmContacts.id, entityId)).limit(1);
      if (!contact || !contact.email) return { success: false, reason: "Contact missing or no email" };

      const { enqueueAutomationTrigger } = await import("./services/automation-triggers");
      await enqueueAutomationTrigger({
        triggerEvent: "booking_no_response",
        entityType: "lead",
        entityId: contact.id,
        cityId: contact.capturedWithHubId || undefined,
        payload: {
          email: contact.email,
          name: contact.name,
          company: contact.company || undefined,
        },
      });
      return { success: true, triggered: "booking_no_response" };
    }

    case "LISTING_UPGRADE": {
      const [upgradeBiz] = await db.select().from(businesses).where(eq(businesses.id, entityId)).limit(1);
      if (!upgradeBiz) return { success: false, reason: "Business not found" };

      await createInboxItemIfNotOpen({
        itemType: "pipeline_needs_review",
        relatedTable: "businesses",
        relatedId: entityId,
        title: `Tier Upgrade Review: ${upgradeBiz.name}`,
        summary: `Business "${upgradeBiz.name}" (current tier: ${upgradeBiz.listingTier}) recommended for tier upgrade via Proposal Engine.`,
        priority: "med",
        tags: ["Upgrade", "Proposal"],
      });
      return { success: true, businessName: upgradeBiz.name, currentTier: upgradeBiz.listingTier, inboxCreated: true };
    }

    case "TV_VENUE_SCREEN": {
      const [tvBiz] = await db.select().from(businesses).where(eq(businesses.id, entityId)).limit(1);
      if (!tvBiz) return { success: false, reason: "Business not found" };

      await createInboxItemIfNotOpen({
        itemType: "pipeline_needs_review",
        relatedTable: "businesses",
        relatedId: entityId,
        title: `Venue TV Screen: ${tvBiz.name}`,
        summary: `Business "${tvBiz.name}" flagged for venue TV screen rotation via Proposal Engine.`,
        priority: "low",
        tags: ["TV", "Venue", "Proposal"],
      });
      return { success: true, businessName: tvBiz.name, inboxCreated: true };
    }

    case "CONTENT_ARTICLE": {
      if (entityType === "contact") {
        const { generateStoryForCapture } = await import("./services/capture-story-generator");
        const result = await generateStoryForCapture(entityId);
        if (!result) return { success: false, reason: "Content generation returned null" };
        return { success: true, articleId: result.articleId, title: result.title };
      }
      return {
        success: true,
        note: "Entity flagged for editorial content creation",
      };
    }

    case "EVENT_PROMOTION": {
      const [evt] = await db.select().from(events).where(eq(events.id, entityId)).limit(1);
      if (!evt) return { success: false, reason: "Event not found" };

      if (!evt.isFeatured) {
        await db.update(events).set({ isFeatured: true }).where(eq(events.id, entityId));
      }
      return { success: true, featured: true, eventTitle: evt.title };
    }

    case "SEARCH_RECOMMENDATION": {
      const [searchBiz] = await db.select().from(businesses).where(eq(businesses.id, entityId)).limit(1);
      if (!searchBiz) return { success: false, reason: "Business not found" };

      const boostPayload = JSON.stringify({ source: "proposal_engine", businessName: searchBiz.name, appliedAt: new Date().toISOString() });
      const metroIdForScore = searchBiz.cityId || params.metroId as string || "";

      try {
        const { pool: searchPool } = await import("./db");
        await searchPool.query(
          `INSERT INTO entity_scores (id, metro_id, entity_id, prospect_fit_score, reasons_json, computed_at, created_at, updated_at)
           VALUES (gen_random_uuid(), $3, $1, 10, $2::json, NOW(), NOW(), NOW())
           ON CONFLICT (entity_id) DO UPDATE
           SET prospect_fit_score = GREATEST(entity_scores.prospect_fit_score, 10),
               reasons_json = $2::json,
               updated_at = NOW()`,
          [entityId, boostPayload, metroIdForScore]
        );
      } catch (searchErr) {
        console.error("[ProposalEngine] SEARCH_RECOMMENDATION score upsert error:", searchErr instanceof Error ? searchErr.message : searchErr);
      }
      return { success: true, businessName: searchBiz.name, searchBoostApplied: true };
    }

    default:
      return { success: false, reason: `Unknown template: ${templateKey}` };
  }
}

export async function getProposal(proposalId: string): Promise<Proposal | null> {
  const result = await pool.query(
    `SELECT * FROM charlotte_proposals WHERE id = $1`,
    [proposalId]
  );
  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  const itemsResult = await pool.query(
    `SELECT * FROM charlotte_proposal_items WHERE proposal_id = $1 ORDER BY created_at`,
    [proposalId]
  );

  return {
    id: row.id,
    metroId: row.metro_id,
    userId: row.user_id,
    source: row.source,
    directive: row.directive,
    status: row.status,
    mode: row.mode,
    batchMode: row.batch_mode,
    orchestratorDecisionId: row.orchestrator_decision_id,
    metadata: row.metadata,
    items: itemsResult.rows.map((i: Record<string, unknown>) => ({
      id: i.id as string,
      templateKey: i.template_key as ActionTemplateKey,
      entityType: i.entity_type as string | null,
      entityId: i.entity_id as string | null,
      entityName: i.entity_name as string | null,
      status: i.status as ProposalItemStatus,
      params: (typeof i.params === "string" ? JSON.parse(i.params as string) : i.params) as Record<string, unknown>,
      result: i.result ? (typeof i.result === "string" ? JSON.parse(i.result as string) : i.result) as Record<string, unknown> : null,
      errorMessage: i.error_message as string | null,
    })),
  };
}

export async function listProposals(filters: {
  metroId?: string;
  status?: string;
  limit?: number;
}): Promise<Proposal[]> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (filters.metroId) {
    conditions.push(`metro_id = $${paramIdx++}`);
    values.push(filters.metroId);
  }
  if (filters.status) {
    conditions.push(`status = $${paramIdx++}`);
    values.push(filters.status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = Math.min(filters.limit || 50, 200);

  const result = await pool.query(
    `SELECT * FROM charlotte_proposals ${where} ORDER BY created_at DESC LIMIT $${paramIdx}`,
    [...values, limit]
  );

  const proposals: Proposal[] = [];
  for (const row of result.rows) {
    const itemsResult = await pool.query(
      `SELECT * FROM charlotte_proposal_items WHERE proposal_id = $1 ORDER BY created_at`,
      [row.id]
    );

    proposals.push({
      id: row.id,
      metroId: row.metro_id,
      userId: row.user_id,
      source: row.source,
      directive: row.directive,
      status: row.status,
      mode: row.mode,
      batchMode: row.batch_mode,
      orchestratorDecisionId: row.orchestrator_decision_id,
      metadata: row.metadata,
      items: itemsResult.rows.map((i: Record<string, unknown>) => ({
        id: i.id as string,
        templateKey: i.template_key as ActionTemplateKey,
        entityType: i.entity_type as string | null,
        entityId: i.entity_id as string | null,
        entityName: i.entity_name as string | null,
        status: i.status as ProposalItemStatus,
        params: (typeof i.params === "string" ? JSON.parse(i.params as string) : i.params) as Record<string, unknown>,
        result: i.result ? (typeof i.result === "string" ? JSON.parse(i.result as string) : i.result) as Record<string, unknown> : null,
        errorMessage: i.error_message as string | null,
      })),
    });
  }

  return proposals;
}

export async function buildProposalFromOrchestrator(
  orchestratorResult: OrchestratorResult,
  options: { metroId?: string; userId?: string } = {}
): Promise<Proposal | null> {
  const { command, logId } = orchestratorResult;

  if (!command.requiresProposal && command.mode !== "proposal") return null;

  const resolvedEntities = command.entities.filter(
    (e) => e.entityId && e.confidence !== "LOW"
  );

  if (resolvedEntities.length === 0) return null;

  if (resolvedEntities.length === 1) {
    return buildProposal(resolvedEntities[0], [], {
      metroId: options.metroId || undefined,
      userId: options.userId || undefined,
      source: "orchestrator",
      directive: command.intent,
      orchestratorDecisionId: logId || undefined,
      mode: command.mode,
    });
  }

  const allItems: ProposalItem[] = [];
  for (const entity of resolvedEntities) {
    const validTypes = ["business", "contact", "event"] as const;
    const entityTypeForEval = validTypes.includes(entity.entityType as typeof validTypes[number])
      ? (entity.entityType as "business" | "contact" | "event")
      : "business";

    const opportunity = await evaluateOpportunities(
      entity.entityId,
      entityTypeForEval,
      options.metroId
    );

    for (const key of opportunity.eligibleTemplates) {
      allItems.push({
        templateKey: key,
        entityType: entity.entityType,
        entityId: entity.entityId,
        entityName: entity.name || opportunity.entityName,
        status: "proposed",
        params: {
          reason: opportunity.reasons[key] || "Eligible",
          templateLabel: ACTION_TEMPLATES[key]?.label || key,
        },
      });
    }
  }

  const proposal: Proposal = {
    metroId: options.metroId || null,
    userId: options.userId || null,
    source: "orchestrator",
    directive: command.intent,
    status: "pending",
    mode: command.mode || null,
    items: allItems,
    batchMode: resolvedEntities.length > 1,
    orchestratorDecisionId: logId || null,
  };

  return saveProposal(proposal);
}

export function getProposalSummary(proposal: Proposal): string {
  const templateCounts = new Map<string, number>();
  for (const item of proposal.items) {
    templateCounts.set(item.templateKey, (templateCounts.get(item.templateKey) || 0) + 1);
  }

  const breakdown = [...templateCounts.entries()]
    .map(([key, count]) => `${ACTION_TEMPLATES[key as ActionTemplateKey]?.label || key}: ${count}`)
    .join(", ");

  const parts = [
    `Proposal ${proposal.id || "new"}: ${proposal.items.length} items`,
    `Status: ${proposal.status}`,
    breakdown,
  ];

  if (proposal.batchMode) parts.push("(batch)");
  if (proposal.directive) parts.push(`Directive: "${proposal.directive}"`);

  return parts.join(" | ");
}
