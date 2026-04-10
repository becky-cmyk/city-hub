import { pool } from "./db";
import { storage } from "./storage";
import { createInboxItemIfNotOpen } from "./admin-inbox";
import type { AdminInboxItem } from "@shared/schema";

export type OpsPriority = "high" | "medium" | "low";

export interface OpsQueueItem {
  id: string;
  type: string;
  title: string;
  summary: string;
  priority: OpsPriority;
  source: string;
  entityId?: string | null;
  entityName?: string | null;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface OpsOverview {
  actionQueue: OpsQueueItem[];
  reviewQueue: OpsQueueItem[];
  followUps: OpsQueueItem[];
  opportunities: OpsQueueItem[];
  recentActivity: OpsQueueItem[];
  generatedAt: string;
}

function assignPriority(confidence: number | null, actionable: boolean): OpsPriority {
  if (actionable && (confidence === null || confidence >= 0.7)) return "high";
  if (actionable) return "medium";
  return "low";
}

function toISOString(val: unknown): string {
  if (val instanceof Date) return val.toISOString();
  if (typeof val === "string") return val;
  return new Date().toISOString();
}

async function buildActionQueue(): Promise<OpsQueueItem[]> {
  const items: OpsQueueItem[] = [];

  const pendingProposals = await pool.query(
    `SELECT p.id, p.directive, p.source, p.metro_id, p.status, p.created_at,
            (SELECT count(*) FROM charlotte_proposal_items pi WHERE pi.proposal_id = p.id AND pi.status = 'confirmed') as confirmed_count,
            (SELECT count(*) FROM charlotte_proposal_items pi WHERE pi.proposal_id = p.id) as total_items
     FROM charlotte_proposals p
     WHERE p.status IN ('pending', 'confirmed')
     ORDER BY p.created_at DESC
     LIMIT 30`
  );

  for (const row of pendingProposals.rows) {
    items.push({
      id: `proposal:${row.id}`,
      type: "proposal",
      title: `Proposal: ${row.directive || "Unnamed proposal"}`,
      summary: `${row.confirmed_count}/${row.total_items} items confirmed. Status: ${row.status}. Source: ${row.source}.`,
      priority: row.status === "confirmed" ? "high" : "medium",
      source: "proposal_engine",
      createdAt: toISOString(row.created_at),
      metadata: { proposalId: row.id, metroId: row.metro_id, status: row.status },
    });
  }

  const readyWorkflowSteps = await pool.query(
    `SELECT ws.id, ws.current_step, ws.business_name, ws.contact_name, ws.source, ws.created_at
     FROM workflow_sessions ws
     WHERE ws.status = 'active'
       AND ws.current_step IN ('verification', 'basic_activation', 'story_builder', 'capability_activation')
     ORDER BY ws.created_at DESC
     LIMIT 20`
  );

  for (const row of readyWorkflowSteps.rows) {
    items.push({
      id: `workflow:${row.id}`,
      type: "workflow_step",
      title: `Onboarding: ${row.business_name || row.contact_name || "Unknown"} — ${row.current_step}`,
      summary: `Active workflow at step "${row.current_step}". Source: ${row.source}.`,
      priority: "high",
      source: "workflow_engine",
      entityName: row.business_name || row.contact_name,
      createdAt: toISOString(row.created_at),
      metadata: { sessionId: row.id, step: row.current_step, workflowSource: row.source },
    });
  }

  const pendingCapture = await pool.query(
    `SELECT id, action_type, entity_id, entity_type, entity_name, priority,
            recommended_action, capture_session_id, capture_item_id, inbox_item_id,
            status, metadata, created_at
     FROM capture_action_queue
     WHERE status = 'pending'
     ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, created_at DESC
     LIMIT 30`
  );

  for (const row of pendingCapture.rows) {
    items.push({
      id: `capture:${row.id}`,
      type: "capture_action",
      title: `Capture: ${row.entity_name || row.action_type}`,
      summary: `${row.recommended_action}. Entity: ${row.entity_name || "new"}. Type: ${row.entity_type || "unknown"}.`,
      priority: row.priority === "high" ? "high" : row.priority === "low" ? "low" : "medium",
      source: "capture_engine",
      entityId: row.entity_id,
      entityName: row.entity_name,
      createdAt: toISOString(row.created_at),
      metadata: { queueId: row.id, captureSessionId: row.capture_session_id, captureItemId: row.capture_item_id, inboxItemId: row.inbox_item_id, actionType: row.action_type },
    });
  }

  return items;
}

async function buildReviewQueue(): Promise<OpsQueueItem[]> {
  const items: OpsQueueItem[] = [];

  const openInbox: AdminInboxItem[] = await storage.getInboxItems({ status: "open" });
  for (const inbox of openInbox.slice(0, 30)) {
    items.push({
      id: `inbox:${inbox.id}`,
      type: "inbox_item",
      title: inbox.title,
      summary: inbox.summary || "",
      priority: inbox.priority === "high" ? "high" : inbox.priority === "low" ? "low" : "medium",
      source: "admin_inbox",
      entityId: inbox.relatedId,
      createdAt: toISOString(inbox.createdAt),
      metadata: { inboxItemId: inbox.id, itemType: inbox.itemType, tags: inbox.tags },
    });
  }

  const lowConfidenceDecisions = await pool.query(
    `SELECT id, mode, intent, confidence, target_engines, created_at
     FROM orchestrator_decisions
     WHERE confidence < 0.5
     ORDER BY created_at DESC
     LIMIT 20`
  );

  for (const row of lowConfidenceDecisions.rows) {
    items.push({
      id: `decision:${row.id}`,
      type: "low_confidence_decision",
      title: `Low confidence: ${row.intent}`,
      summary: `Orchestrator decision with ${(Number(row.confidence) * 100).toFixed(0)}% confidence. Mode: ${row.mode}.`,
      priority: "medium",
      source: "orchestrator",
      createdAt: toISOString(row.created_at),
      metadata: { decisionId: row.id, confidence: row.confidence, mode: row.mode },
    });
  }

  const failedSessions = await pool.query(
    `SELECT id, event_name, status, total_items, processed_items, created_at
     FROM capture_sessions
     WHERE status = 'failed'
     ORDER BY created_at DESC
     LIMIT 10`
  );

  for (const row of failedSessions.rows) {
    items.push({
      id: `failed-session:${row.id}`,
      type: "failed_capture_session",
      title: `Failed session: ${row.event_name || "Capture session"}`,
      summary: `Session processing failed. Processed ${row.processed_items}/${row.total_items} items before failure.`,
      priority: "high",
      source: "batch_processor",
      createdAt: toISOString(row.created_at),
      metadata: { sessionId: row.id, totalItems: row.total_items, processedItems: row.processed_items },
    });
  }

  return items;
}

async function buildFollowUps(): Promise<OpsQueueItem[]> {
  const items: OpsQueueItem[] = [];

  const incompleteFlows = await pool.query(
    `SELECT id, flow_type, business_name, contact_name, status, onboarding_state, created_at
     FROM charlotte_flow_sessions
     WHERE status = 'in_progress'
     ORDER BY updated_at DESC
     LIMIT 20`
  );

  for (const row of incompleteFlows.rows) {
    const state = (row.onboarding_state || {}) as Record<string, unknown>;
    const stage = (state.currentStage as string) || "unknown";
    items.push({
      id: `flow:${row.id}`,
      type: "incomplete_flow",
      title: `Onboarding in progress: ${row.business_name || row.contact_name || "Unknown"}`,
      summary: `Flow type: ${row.flow_type}. Current stage: ${stage}.`,
      priority: state.escalatedToBecky ? "high" : "medium",
      source: "lifecycle_hooks",
      entityName: row.business_name || row.contact_name,
      createdAt: toISOString(row.created_at),
      metadata: { sessionId: row.id, flowType: row.flow_type, stage },
    });
  }

  const pendingStoryApprovals = await pool.query(
    `SELECT id, flow_type, business_name, contact_name, onboarding_state, created_at
     FROM charlotte_flow_sessions
     WHERE status = 'in_progress'
       AND onboarding_state->>'storyCreated' = 'true'
       AND (onboarding_state->>'storyApproved' IS NULL OR onboarding_state->>'storyApproved' = 'false')
     ORDER BY updated_at DESC
     LIMIT 10`
  );

  for (const row of pendingStoryApprovals.rows) {
    items.push({
      id: `story-approval:${row.id}`,
      type: "pending_story_approval",
      title: `Story awaiting approval: ${row.business_name || row.contact_name || "Unknown"}`,
      summary: `Story has been created but not yet approved.`,
      priority: "high",
      source: "lifecycle_hooks",
      entityName: row.business_name || row.contact_name,
      createdAt: toISOString(row.created_at),
      metadata: { sessionId: row.id, flowType: row.flow_type },
    });
  }

  const pausedWorkflows = await pool.query(
    `SELECT id, business_name, contact_name, current_step, source, created_at
     FROM workflow_sessions
     WHERE status = 'paused'
     ORDER BY updated_at DESC
     LIMIT 15`
  );

  for (const row of pausedWorkflows.rows) {
    items.push({
      id: `paused-workflow:${row.id}`,
      type: "paused_workflow",
      title: `Paused workflow: ${row.business_name || row.contact_name || "Unknown"}`,
      summary: `Workflow paused at step "${row.current_step}". Source: ${row.source}.`,
      priority: "medium",
      source: "workflow_engine",
      entityName: row.business_name || row.contact_name,
      createdAt: toISOString(row.created_at),
      metadata: { sessionId: row.id, step: row.current_step },
    });
  }

  const overdueInbox: AdminInboxItem[] = await storage.getInboxItems({ status: "open", overdue: true });
  for (const inbox of overdueInbox.slice(0, 10)) {
    if (!items.some(i => i.id === `inbox:${inbox.id}`)) {
      items.push({
        id: `overdue-inbox:${inbox.id}`,
        type: "overdue_inbox",
        title: `Overdue: ${inbox.title}`,
        summary: inbox.summary || `Due: ${inbox.dueAt?.toISOString() || "unknown"}`,
        priority: "high",
        source: "admin_inbox",
        entityId: inbox.relatedId,
        createdAt: toISOString(inbox.createdAt),
        metadata: { inboxItemId: inbox.id, dueAt: inbox.dueAt?.toISOString() },
      });
    }
  }

  return items;
}

async function buildOpportunities(): Promise<OpsQueueItem[]> {
  const items: OpsQueueItem[] = [];

  const highScoring = await pool.query(
    `SELECT es.entity_id, es.prospect_fit_score, es.contact_ready_score, es.bucket, es.metro_id,
            b.name as business_name, b.listing_tier, b.is_verified
     FROM entity_scores es
     JOIN businesses b ON b.id = es.entity_id
     WHERE es.prospect_fit_score >= 70 AND es.contact_ready_score >= 50
     ORDER BY es.prospect_fit_score DESC, es.contact_ready_score DESC
     LIMIT 20`
  );

  for (const row of highScoring.rows) {
    const signals: string[] = [];
    if (row.listing_tier === "FREE" || row.listing_tier === "BASIC") signals.push("upgrade candidate");
    if (!row.is_verified) signals.push("not verified");

    items.push({
      id: `opportunity:${row.entity_id}`,
      type: "high_score_entity",
      title: `Opportunity: ${row.business_name}`,
      summary: `Prospect fit: ${row.prospect_fit_score}, Contact ready: ${row.contact_ready_score}. Bucket: ${row.bucket}.${signals.length ? " Signals: " + signals.join(", ") : ""}`,
      priority: row.prospect_fit_score >= 85 ? "high" : "medium",
      source: "entity_scoring",
      entityId: row.entity_id,
      entityName: row.business_name,
      createdAt: new Date().toISOString(),
      metadata: { prospectFit: row.prospect_fit_score, contactReady: row.contact_ready_score, bucket: row.bucket, metroId: row.metro_id },
    });
  }

  const crownCandidates = await pool.query(
    `SELECT b.id, b.name, b.is_verified, tp.trust_level
     FROM businesses b
     JOIN trust_profiles tp ON tp.business_id = b.id
     LEFT JOIN crown_participants cp ON cp.business_id = b.id
     WHERE tp.trust_level IN ('T4', 'T5')
       AND b.is_verified = true
       AND cp.id IS NULL
     ORDER BY tp.trust_level DESC
     LIMIT 10`
  );

  for (const row of crownCandidates.rows) {
    items.push({
      id: `crown-candidate:${row.id}`,
      type: "crown_candidate",
      title: `Crown candidate: ${row.name}`,
      summary: `Trust level ${row.trust_level}, verified, not yet a Crown participant.`,
      priority: row.trust_level === "T5" ? "high" : "medium",
      source: "crown_readiness",
      entityId: row.id,
      entityName: row.name,
      createdAt: new Date().toISOString(),
      metadata: { trustLevel: row.trust_level },
    });
  }

  const tvVenueCandidates = await pool.query(
    `SELECT b.id, b.name, b.listing_tier
     FROM businesses b
     JOIN trust_profiles tp ON tp.business_id = b.id
     WHERE b.listing_tier IN ('VERIFIED', 'ENHANCED')
       AND tp.trust_level IN ('T3', 'T4', 'T5')
       AND b.is_verified = true
       AND NOT EXISTS (
         SELECT 1 FROM entity_scores es
         WHERE es.entity_id = b.id AND es.bucket = 'CONTENT_SOURCE_ONLY'
       )
     ORDER BY tp.trust_level DESC
     LIMIT 10`
  );

  for (const row of tvVenueCandidates.rows) {
    items.push({
      id: `tv-venue:${row.id}`,
      type: "tv_venue_candidate",
      title: `TV/Venue candidate: ${row.name}`,
      summary: `Tier: ${row.listing_tier}. Potential TV screen or venue placement.`,
      priority: "low",
      source: "upsell_signal",
      entityId: row.id,
      entityName: row.name,
      createdAt: new Date().toISOString(),
      metadata: { listingTier: row.listing_tier },
    });
  }

  return items;
}

async function buildRecentActivity(): Promise<OpsQueueItem[]> {
  const items: OpsQueueItem[] = [];

  const recentDecisions = await pool.query(
    `SELECT id, mode, intent, confidence, target_engines, created_at
     FROM orchestrator_decisions
     ORDER BY created_at DESC
     LIMIT 15`
  );

  for (const row of recentDecisions.rows) {
    items.push({
      id: `activity-decision:${row.id}`,
      type: "orchestrator_decision",
      title: `Decision: ${row.intent}`,
      summary: `Mode: ${row.mode}. Confidence: ${(Number(row.confidence) * 100).toFixed(0)}%. Engines: ${Array.isArray(row.target_engines) ? row.target_engines.join(", ") : "none"}.`,
      priority: assignPriority(Number(row.confidence), false),
      source: "orchestrator",
      createdAt: toISOString(row.created_at),
      metadata: { decisionId: row.id, mode: row.mode, confidence: row.confidence },
    });
  }

  const completedBatches = await pool.query(
    `SELECT id, event_name, status, total_items, processed_items, created_at
     FROM capture_sessions
     WHERE status IN ('completed', 'ready_for_review', 'partially_executed')
     ORDER BY created_at DESC
     LIMIT 10`
  );

  for (const row of completedBatches.rows) {
    items.push({
      id: `activity-batch:${row.id}`,
      type: "batch_session",
      title: `Batch: ${row.event_name || "Capture session"}`,
      summary: `Status: ${row.status}. Processed: ${row.processed_items}/${row.total_items} items.`,
      priority: row.status === "ready_for_review" ? "medium" : "low",
      source: "batch_processor",
      createdAt: toISOString(row.created_at),
      metadata: { sessionId: row.id, status: row.status, totalItems: row.total_items, processedItems: row.processed_items },
    });
  }

  const recentProposalExecutions = await pool.query(
    `SELECT p.id, p.directive, p.status, p.source, p.created_at, p.updated_at,
            (SELECT count(*) FROM charlotte_proposal_items pi WHERE pi.proposal_id = p.id AND pi.status = 'completed') as completed_items,
            (SELECT count(*) FROM charlotte_proposal_items pi WHERE pi.proposal_id = p.id) as total_items
     FROM charlotte_proposals p
     WHERE p.status IN ('completed', 'partial', 'failed')
     ORDER BY p.updated_at DESC
     LIMIT 10`
  );

  for (const row of recentProposalExecutions.rows) {
    items.push({
      id: `activity-proposal:${row.id}`,
      type: "proposal_execution",
      title: `Executed: ${row.directive || "Proposal"}`,
      summary: `${row.completed_items}/${row.total_items} items completed. Final status: ${row.status}.`,
      priority: row.status === "failed" ? "high" : "low",
      source: "proposal_engine",
      createdAt: toISOString(row.updated_at || row.created_at),
      metadata: { proposalId: row.id, status: row.status },
    });
  }

  const completedOnboarding = await pool.query(
    `SELECT id, business_name, contact_name, flow_type, created_at, updated_at
     FROM charlotte_flow_sessions
     WHERE status = 'completed'
     ORDER BY updated_at DESC
     LIMIT 10`
  );

  for (const row of completedOnboarding.rows) {
    items.push({
      id: `activity-onboarding:${row.id}`,
      type: "onboarding_completion",
      title: `Onboarding complete: ${row.business_name || row.contact_name || "Unknown"}`,
      summary: `Flow type: ${row.flow_type}.`,
      priority: "low",
      source: "lifecycle_hooks",
      entityName: row.business_name || row.contact_name,
      createdAt: toISOString(row.updated_at || row.created_at),
      metadata: { sessionId: row.id, flowType: row.flow_type },
    });
  }

  return items;
}

export async function getCommandCenterOperationsOverview(): Promise<OpsOverview> {
  const [actionQueue, reviewQueue, followUps, opportunities, recentActivity] = await Promise.all([
    buildActionQueue(),
    buildReviewQueue(),
    buildFollowUps(),
    buildOpportunities(),
    buildRecentActivity(),
  ]);

  return {
    actionQueue,
    reviewQueue,
    followUps,
    opportunities,
    recentActivity,
    generatedAt: new Date().toISOString(),
  };
}

export async function approveAction(actionId: string): Promise<{ success: boolean; message: string }> {
  const [prefix, id] = actionId.split(":", 2);
  if (!id) return { success: false, message: "Invalid action ID format. Expected 'type:id'." };

  if (prefix === "proposal") {
    const { confirmAllProposalItems, getProposal } = await import("./charlotte-proposal-engine");
    const proposal = await getProposal(id);
    if (!proposal) return { success: false, message: `Proposal ${id} not found.` };
    if (proposal.status !== "pending") return { success: false, message: `Proposal is ${proposal.status}, expected pending.` };

    const result = await confirmAllProposalItems(id);
    return { success: true, message: `Confirmed ${result.updated} proposal items.` };
  }

  if (prefix === "capture") {
    const result = await pool.query(
      `UPDATE capture_action_queue SET status = 'in_progress' WHERE id = $1 AND status = 'pending' RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) return { success: false, message: `Capture queue item ${id} not found or already processed.` };

    const queueItem = result.rows[0];
    try {
      console.log(`[OpsCenter] Executing capture action ${id}: ${queueItem.recommended_action} for ${queueItem.entity_name || "unknown"}`);

      await pool.query(`UPDATE capture_action_queue SET status = 'completed', resolved_at = NOW() WHERE id = $1`, [id]);

      if (queueItem.inbox_item_id) {
        try {
          await pool.query(
            `UPDATE admin_inbox_items SET status = 'resolved', resolved_at = NOW() WHERE id = $1 AND status != 'resolved'`,
            [queueItem.inbox_item_id]
          );
        } catch (syncErr: unknown) {
          console.warn(`[OpsCenter] Inbox sync failed for capture approval ${id}:`, (syncErr as Error).message);
        }
      }

      return { success: true, message: `Capture action ${id} approved and completed.` };
    } catch (execErr: unknown) {
      const errMsg = execErr instanceof Error ? execErr.message : "Unknown execution error";
      await pool.query(`UPDATE capture_action_queue SET status = 'pending' WHERE id = $1`, [id]);
      console.error(`[OpsCenter] Capture action ${id} execution failed:`, errMsg);
      return { success: false, message: `Capture action ${id} execution failed: ${errMsg}` };
    }
  }

  if (prefix === "workflow") {
    console.log(`[OpsCenter] Workflow ${id} approved`);
    await pool.query(`UPDATE workflow_sessions SET status = 'active' WHERE id = $1 AND status = 'paused'`, [id]);
    return { success: true, message: `Workflow ${id} resumed.` };
  }

  if (prefix === "inbox" || prefix === "overdue-inbox") {
    await pool.query(`UPDATE admin_inbox_items SET status = 'resolved', resolved_at = now() WHERE id = $1`, [id]);
    return { success: true, message: `Inbox item ${id} resolved.` };
  }

  if (prefix === "decision") {
    const inboxItem = await createInboxItemIfNotOpen({
      itemType: "pipeline_needs_review",
      relatedTable: "orchestrator_decisions",
      relatedId: id,
      title: `Decision approved: ${id}`,
      summary: "Approved from ops center.",
      priority: "low",
      tags: ["OpsCenter", "approved"],
    });
    return { success: true, message: `Decision ${id} approved and logged (inbox ${inboxItem.id}).` };
  }

  return { success: false, message: `Cannot approve item type "${prefix}".` };
}

export async function rejectAction(actionId: string): Promise<{ success: boolean; message: string }> {
  const [prefix, id] = actionId.split(":", 2);
  if (!id) return { success: false, message: "Invalid action ID format. Expected 'type:id'." };

  if (prefix === "proposal") {
    const { cancelProposal, getProposal } = await import("./charlotte-proposal-engine");
    const proposal = await getProposal(id);
    if (!proposal) return { success: false, message: `Proposal ${id} not found.` };
    if (!["pending", "confirmed"].includes(proposal.status)) {
      return { success: false, message: `Proposal is ${proposal.status}, cannot reject.` };
    }
    const result = await cancelProposal(id);
    return { success: true, message: `Proposal ${id} cancelled. ${result.cancelled} items skipped.` };
  }

  if (prefix === "capture") {
    const result = await pool.query(
      `UPDATE capture_action_queue SET status = 'cancelled', resolved_at = NOW() WHERE id = $1 AND status IN ('pending', 'in_progress') RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) return { success: false, message: `Capture queue item ${id} not found or already resolved.` };

    const queueItem = result.rows[0];
    if (queueItem.inbox_item_id) {
      try {
        await pool.query(
          `UPDATE admin_inbox_items SET status = 'closed', resolved_at = NOW() WHERE id = $1 AND status NOT IN ('resolved', 'closed')`,
          [queueItem.inbox_item_id]
        );
      } catch (syncErr: unknown) {
        console.warn(`[OpsCenter] Inbox sync failed for capture rejection ${id}:`, (syncErr as Error).message);
      }
    }

    return { success: true, message: `Capture action ${id} rejected.` };
  }

  if (prefix === "inbox" || prefix === "overdue-inbox") {
    await pool.query(`UPDATE admin_inbox_items SET status = 'closed' WHERE id = $1`, [id]);
    return { success: true, message: `Inbox item ${id} closed.` };
  }

  if (prefix === "decision") {
    const inboxItem = await createInboxItemIfNotOpen({
      itemType: "pipeline_needs_review",
      relatedTable: "orchestrator_decisions",
      relatedId: id,
      title: `Decision dismissed: ${id}`,
      summary: "Dismissed from ops center.",
      priority: "low",
      tags: ["OpsCenter", "dismissed"],
    });
    return { success: true, message: `Decision ${id} dismissed (inbox ${inboxItem.id}).` };
  }

  if (prefix === "flow" || prefix === "story-approval") {
    await pool.query(`UPDATE charlotte_flow_sessions SET status = 'cancelled' WHERE id = $1`, [id]);
    return { success: true, message: `Flow session ${id} dismissed.` };
  }

  if (prefix === "workflow" || prefix === "paused-workflow") {
    console.log(`[OpsCenter] Workflow ${id} rejected`);
    await pool.query(`UPDATE workflow_sessions SET status = 'abandoned' WHERE id = $1`, [id]);
    return { success: true, message: `Workflow ${id} dismissed.` };
  }

  if (prefix === "opportunity" || prefix === "crown-candidate" || prefix === "tv-venue") {
    await pool.query(`UPDATE entity_scores SET bucket = 'CONTENT_SOURCE_ONLY' WHERE entity_id = $1`, [id]);
    return { success: true, message: `Opportunity ${id} dismissed.` };
  }

  return { success: false, message: `Cannot reject item type "${prefix}".` };
}

export async function runActionNow(actionId: string): Promise<{ success: boolean; message: string; result?: unknown }> {
  const [prefix, id] = actionId.split(":", 2);
  if (!id) return { success: false, message: "Invalid action ID format. Expected 'type:id'." };

  if (prefix === "proposal") {
    const { executeProposal, getProposal, confirmAllProposalItems } = await import("./charlotte-proposal-engine");
    const proposal = await getProposal(id);
    if (!proposal) return { success: false, message: `Proposal ${id} not found.` };

    if (proposal.status === "pending") {
      await confirmAllProposalItems(id);
    }

    const result = await executeProposal(id);
    return {
      success: true,
      message: `Executed proposal: ${result.executed} succeeded, ${result.failed} failed.`,
      result,
    };
  }

  if (prefix === "capture") {
    const result = await pool.query(
      `UPDATE capture_action_queue SET status = 'in_progress' WHERE id = $1 AND status = 'pending' RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) return { success: false, message: `Capture queue item ${id} not found or already processed.` };

    const queueItem = result.rows[0];
    console.log(`[OpsCenter] Running capture action ${id} now: ${queueItem.recommended_action} for ${queueItem.entity_name || "unknown"}`);
    await pool.query(`UPDATE capture_action_queue SET status = 'completed', resolved_at = NOW() WHERE id = $1`, [id]);

    if (queueItem.inbox_item_id) {
      try {
        await pool.query(
          `UPDATE admin_inbox_items SET status = 'resolved', resolved_at = NOW() WHERE id = $1 AND status != 'resolved'`,
          [queueItem.inbox_item_id]
        );
      } catch (syncErr: unknown) {
        console.warn(`[OpsCenter] Inbox sync failed for capture run-now ${id}:`, (syncErr as Error).message);
      }
    }

    return { success: true, message: `Capture action ${id} executed.`, result: queueItem };
  }

  if (prefix === "workflow" || prefix === "paused-workflow") {
    console.log(`[OpsCenter] Workflow ${id} run-now`);
    await pool.query(`UPDATE workflow_sessions SET status = 'active' WHERE id = $1`, [id]);
    return { success: true, message: `Workflow ${id} resumed/activated.` };
  }

  if (prefix === "flow" || prefix === "story-approval") {
    const inboxItem = await createInboxItemIfNotOpen({
      itemType: "pipeline_needs_review",
      relatedTable: "charlotte_flow_sessions",
      relatedId: id,
      title: `Follow-up action: ${prefix} ${id}`,
      summary: "Escalated from ops center for immediate follow-up.",
      priority: "high",
      tags: ["OpsCenter", "follow-up", prefix],
    });
    return { success: true, message: `Follow-up escalated to inbox (${inboxItem.id}).` };
  }

  if (prefix === "inbox" || prefix === "overdue-inbox") {
    await pool.query(`UPDATE admin_inbox_items SET status = 'in_progress' WHERE id = $1`, [id]);
    return { success: true, message: `Inbox item ${id} marked as in-progress.` };
  }

  return { success: false, message: `Cannot execute item type "${prefix}".` };
}

export async function sendToInbox(itemId: string, title?: string): Promise<{ success: boolean; message: string }> {
  const [prefix, id] = itemId.split(":", 2);
  if (!id) return { success: false, message: "Invalid item ID format. Expected 'type:id'." };

  const relatedTable = prefix === "proposal" ? "charlotte_proposals"
    : prefix === "decision" ? "orchestrator_decisions"
    : prefix === "flow" ? "charlotte_flow_sessions"
    : prefix === "workflow" ? "workflow_sessions"
    : prefix === "opportunity" ? "entity_scores"
    : prefix === "capture" ? "capture_action_queue"
    : prefix;

  const inboxItem = await createInboxItemIfNotOpen({
    itemType: "pipeline_needs_review",
    relatedTable,
    relatedId: id,
    title: title || `Review requested: ${prefix} ${id}`,
    summary: `Manually sent to inbox from ops center.`,
    priority: "med",
    tags: ["OpsCenter", prefix],
  });

  return { success: true, message: `Created inbox item ${inboxItem.id}.` };
}

export function integrateOrchestratorDecision(decision: {
  id: string;
  confidence: number;
  intent: string;
  mode: string;
  proposalId?: string | null;
}): { queue: "action" | "review"; reason: string } {
  if (decision.confidence >= 0.7 && decision.proposalId) {
    return { queue: "action", reason: "High confidence decision with proposal" };
  }
  if (decision.confidence < 0.5) {
    return { queue: "review", reason: "Low confidence — needs human review" };
  }
  return { queue: "action", reason: "Moderate confidence decision" };
}

export function integrateBatchResult(item: {
  processingStatus: string;
  confidence?: number;
  prospectFitScore?: number;
}): "action" | "review" | "opportunity" {
  if (item.processingStatus === "resolved" && (item.confidence === undefined || item.confidence >= 0.7)) {
    return "action";
  }
  if (item.processingStatus === "low_confidence") {
    return "review";
  }
  if (item.prospectFitScore && item.prospectFitScore >= 70) {
    return "opportunity";
  }
  return "review";
}
