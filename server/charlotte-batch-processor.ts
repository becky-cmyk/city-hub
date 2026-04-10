import { pool } from "./db";
import { db } from "./db";
import { crmContacts } from "@shared/schema";
import { resolveEntities, type EntityReference, type ResolvedEntity } from "./charlotte-orchestrator";
import {
  evaluateOpportunities,
  type Proposal,
  type ActionTemplateKey,
  type ProposalItem,
} from "./charlotte-proposal-engine";
import { createInboxItemIfNotOpen } from "./admin-inbox";

export type CaptureSessionStatus =
  | "open"
  | "processing"
  | "ready_for_review"
  | "partially_executed"
  | "completed"
  | "failed";

export type CaptureItemProcessingStatus =
  | "pending"
  | "extracting"
  | "resolved"
  | "low_confidence"
  | "proposal_ready"
  | "executed"
  | "failed";

export interface CaptureSessionInput {
  eventName?: string;
  eventDate?: string;
  location?: string;
  metroId: string;
  operatorUserId: string;
  operatorName?: string;
  notes?: string;
}

export interface CaptureItemInput {
  captureType: "business_card" | "handwritten_note" | "photo" | "voice_note" | "contact_hint" | "business_hint" | "ad_spot" | "flyer" | "other";
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  website?: string;
  address?: string;
  notes?: string;
  photoUrls?: string[];
  rawData?: Record<string, unknown>;
  localId?: string;
}

export interface CaptureSession {
  id: string;
  eventName: string | null;
  eventDate: string | null;
  location: string | null;
  metroId: string;
  operatorUserId: string;
  operatorName: string | null;
  notes: string | null;
  status: CaptureSessionStatus;
  totalItems: number;
  processedItems: number;
  proposalId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessedCaptureItem {
  itemId: string;
  localId?: string;
  captureType: string;
  inputName: string | null;
  inputCompany: string | null;
  resolvedEntity: ResolvedEntity | null;
  matchType: "existing" | "new" | "unresolved";
  confidence: "HIGH" | "MEDIUM" | "LOW" | null;
  processingStatus: CaptureItemProcessingStatus;
  eligibleActions: ActionTemplateKey[];
  businessId: string | null;
  contactId: string | null;
  error?: string;
}

export interface BatchProcessingResult {
  sessionId: string;
  items: ProcessedCaptureItem[];
  proposal: Proposal | null;
  summary: {
    total: number;
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
    newEntities: number;
    existingMatches: number;
    needsReview: number;
    proposalItemCount: number;
  };
}

export async function createCaptureSession(input: CaptureSessionInput): Promise<CaptureSession> {
  const result = await pool.query(
    `INSERT INTO capture_sessions
      (metro_id, event_name, event_date, location, operator_user_id, operator_name, notes, status, total_items, processed_items)
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', 0, 0)
    RETURNING *`,
    [
      input.metroId,
      input.eventName || null,
      input.eventDate || null,
      input.location || null,
      input.operatorUserId,
      input.operatorName || null,
      input.notes || null,
    ]
  );
  const row = result.rows[0];
  return mapSessionRow(row);
}

export async function addItemsToSession(
  sessionId: string,
  items: CaptureItemInput[]
): Promise<{ added: number }> {
  let added = 0;
  for (const item of items) {
    await pool.query(
      `INSERT INTO capture_session_items
        (session_id, capture_type, input_name, input_email, input_phone, input_company, input_job_title, input_website, input_address, input_notes, photo_urls, raw_data, local_id, processing_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending')`,
      [
        sessionId,
        item.captureType,
        item.name || null,
        item.email || null,
        item.phone || null,
        item.company || null,
        item.jobTitle || null,
        item.website || null,
        item.address || null,
        item.notes || null,
        item.photoUrls && item.photoUrls.length > 0 ? item.photoUrls : null,
        item.rawData ? JSON.stringify(item.rawData) : null,
        item.localId || null,
      ]
    );
    added++;
  }

  await pool.query(
    `UPDATE capture_sessions SET total_items = total_items + $1, updated_at = NOW() WHERE id = $2`,
    [added, sessionId]
  );

  return { added };
}

export async function processCaptureBatch(sessionId: string): Promise<BatchProcessingResult> {
  await pool.query(
    `UPDATE capture_sessions SET status = 'processing', updated_at = NOW() WHERE id = $1`,
    [sessionId]
  );

  const sessionResult = await pool.query(
    `SELECT * FROM capture_sessions WHERE id = $1`,
    [sessionId]
  );
  if (sessionResult.rows.length === 0) {
    throw new Error(`Session ${sessionId} not found`);
  }
  const session = mapSessionRow(sessionResult.rows[0]);

  const itemsResult = await pool.query(
    `SELECT * FROM capture_session_items WHERE session_id = $1 ORDER BY created_at`,
    [sessionId]
  );

  const processedItems: ProcessedCaptureItem[] = [];
  const allProposalItems: ProposalItem[] = [];
  const seenEntities = new Map<string, { sourceItemId: string; entityId: string | null; entityType: string | null; confidence: string }>();

  let highConfidence = 0;
  let mediumConfidence = 0;
  let lowConfidence = 0;
  let newEntities = 0;
  let existingMatches = 0;
  let needsReview = 0;

  for (const row of itemsResult.rows) {
    try {
      await pool.query(
        `UPDATE capture_session_items SET processing_status = 'extracting' WHERE id = $1`,
        [row.id]
      );

      const entityRef = buildEntityReference(row);
      const dedupKey = buildDedupKey(row);

      const dedupEntry = dedupKey ? seenEntities.get(dedupKey) : undefined;
      if (dedupEntry && dedupEntry.entityId) {
        await pool.query(
          `UPDATE capture_session_items SET
            processing_status = $1,
            resolved_entity_id = $2,
            resolved_entity_type = $3,
            match_type = 'existing',
            confidence = $4,
            business_id = $5,
            contact_id = $6,
            dedup_of_item_id = $7
          WHERE id = $8`,
          [
            "resolved",
            dedupEntry.entityId,
            dedupEntry.entityType,
            dedupEntry.confidence,
            dedupEntry.entityType === "business" ? dedupEntry.entityId : null,
            dedupEntry.entityType === "contact" ? dedupEntry.entityId : null,
            dedupEntry.sourceItemId,
            row.id,
          ]
        );
        processedItems.push({
          itemId: row.id,
          localId: row.local_id,
          captureType: row.capture_type,
          inputName: row.input_name,
          inputCompany: row.input_company,
          resolvedEntity: null,
          matchType: "existing",
          confidence: dedupEntry.confidence as "HIGH" | "MEDIUM",
          processingStatus: "resolved",
          eligibleActions: [],
          businessId: dedupEntry.entityType === "business" ? dedupEntry.entityId : null,
          contactId: dedupEntry.entityType === "contact" ? dedupEntry.entityId : null,
        });
        existingMatches++;
        if (dedupEntry.confidence === "HIGH") highConfidence++;
        else mediumConfidence++;
        continue;
      }

      const resolved = await resolveEntities([entityRef], session.metroId);
      const entity = resolved[0];

      let matchType: "existing" | "new" | "unresolved" = "unresolved";
      let processingStatus: CaptureItemProcessingStatus = "resolved";
      let businessId: string | null = null;
      let contactId: string | null = null;
      let eligibleActions: ActionTemplateKey[] = [];

      if (entity && entity.entityId && entity.confidence !== "LOW") {
        matchType = "existing";
        existingMatches++;

        if (entity.confidence === "HIGH") highConfidence++;
        else mediumConfidence++;

        const entityTypeForEval = (["business", "contact", "event"] as const).includes(
          entity.entityType as "business" | "contact" | "event"
        )
          ? (entity.entityType as "business" | "contact" | "event")
          : "business";

        const opportunity = await evaluateOpportunities(
          entity.entityId,
          entityTypeForEval,
          session.metroId
        );
        eligibleActions = opportunity.eligibleTemplates;

        if (entity.entityType === "business") businessId = entity.entityId;
        if (entity.entityType === "contact") contactId = entity.entityId;

        for (const key of eligibleActions) {
          allProposalItems.push({
            templateKey: key,
            entityType: entity.entityType,
            entityId: entity.entityId,
            entityName: entity.name,
            status: "proposed",
            params: {
              reason: opportunity.reasons[key] || "Eligible",
              sessionId,
              captureItemId: row.id,
            },
          });
        }
      } else {
        const hasCreatableInput = hasSufficientInputForCreation(row);

        if (hasCreatableInput) {
          const newResult = await tryCreateNewEntity(row, session.metroId, session.operatorUserId);
          if (newResult.businessId) {
            matchType = "new";
            businessId = newResult.businessId;
            newEntities++;
            mediumConfidence++;

            const opportunity = await evaluateOpportunities(
              newResult.businessId,
              "business",
              session.metroId
            );
            eligibleActions = opportunity.eligibleTemplates;

            for (const key of eligibleActions) {
              allProposalItems.push({
                templateKey: key,
                entityType: "business",
                entityId: newResult.businessId,
                entityName: row.input_company || row.input_name || "New Business",
                status: "proposed",
                params: {
                  reason: opportunity.reasons[key] || "Eligible (new entity)",
                  sessionId,
                  captureItemId: row.id,
                  isNewEntity: true,
                },
              });
            }
          } else if (newResult.contactId) {
            matchType = "new";
            contactId = newResult.contactId;
            newEntities++;
            mediumConfidence++;

            const opportunity = await evaluateOpportunities(
              newResult.contactId,
              "contact",
              session.metroId
            );
            eligibleActions = opportunity.eligibleTemplates;

            for (const key of eligibleActions) {
              allProposalItems.push({
                templateKey: key,
                entityType: "contact",
                entityId: newResult.contactId,
                entityName: row.input_name || "New Contact",
                status: "proposed",
                params: {
                  reason: opportunity.reasons[key] || "Eligible (new entity)",
                  sessionId,
                  captureItemId: row.id,
                  isNewEntity: true,
                },
              });
            }
          } else {
            matchType = "unresolved";
            processingStatus = "low_confidence";
            lowConfidence++;
            needsReview++;
            await flagForInboxReview(row, session, sessionId);
          }
        } else {
          matchType = "unresolved";
          processingStatus = "low_confidence";
          lowConfidence++;
          needsReview++;
          await flagForInboxReview(row, session, sessionId);
        }
      }

      await pool.query(
        `UPDATE capture_session_items SET
          processing_status = $1,
          resolved_entity_id = $2,
          resolved_entity_type = $3,
          match_type = $4,
          confidence = $5,
          eligible_actions = $6,
          business_id = $7,
          contact_id = $8
        WHERE id = $9`,
        [
          eligibleActions.length > 0 ? "proposal_ready" : processingStatus,
          entity?.entityId || businessId || contactId || null,
          entity?.entityType || (businessId ? "business" : contactId ? "contact" : null),
          matchType,
          entity?.confidence || (matchType === "new" ? "MEDIUM" : null),
          eligibleActions.length > 0 ? eligibleActions : null,
          businessId,
          contactId,
          row.id,
        ]
      );

      if (dedupKey && (businessId || contactId || (entity && entity.entityId))) {
        const resolvedId = businessId || contactId || entity?.entityId || null;
        const resolvedType = businessId ? "business" : contactId ? "contact" : entity?.entityType || null;
        const resolvedConfidence = entity?.confidence || (matchType === "new" ? "MEDIUM" : "LOW");
        seenEntities.set(dedupKey, {
          sourceItemId: row.id,
          entityId: resolvedId,
          entityType: resolvedType,
          confidence: resolvedConfidence,
        });
      }

      processedItems.push({
        itemId: row.id,
        localId: row.local_id,
        captureType: row.capture_type,
        inputName: row.input_name,
        inputCompany: row.input_company,
        resolvedEntity: entity || null,
        matchType,
        confidence: entity?.confidence || (matchType === "new" ? "MEDIUM" : null),
        processingStatus: eligibleActions.length > 0 ? "proposal_ready" : processingStatus,
        eligibleActions,
        businessId,
        contactId,
      });
    } catch (itemErr: unknown) {
      const errMsg = itemErr instanceof Error ? itemErr.message : "Unknown processing error";
      console.error(`[BatchProcessor] Item ${row.id} failed:`, errMsg);

      await pool.query(
        `UPDATE capture_session_items SET processing_status = 'failed', error_message = $1 WHERE id = $2`,
        [errMsg, row.id]
      );

      try {
        await createInboxItemIfNotOpen({
          itemType: "pipeline_processing_failed",
          relatedTable: "capture_session_items",
          relatedId: row.id,
          title: `Processing failed: ${(row.input_name as string) || (row.input_company as string) || "Unknown"}`,
          summary: `Capture item processing failed: ${errMsg}. Session: ${session.eventName || sessionId}`,
          priority: "high",
          tags: ["CaptureSession", "ProcessingError", "Exception"],
        });
      } catch (inboxErr: unknown) {
        console.error("[BatchProcessor] Failed to create exception inbox item:", (inboxErr as Error).message);
      }

      processedItems.push({
        itemId: row.id,
        localId: row.local_id,
        captureType: row.capture_type,
        inputName: row.input_name,
        inputCompany: row.input_company,
        resolvedEntity: null,
        matchType: "unresolved",
        confidence: null,
        processingStatus: "failed",
        eligibleActions: [],
        businessId: null,
        contactId: null,
        error: errMsg,
      });
    }
  }

  let proposal: Proposal | null = null;
  if (allProposalItems.length > 0) {
    const proposalRecord: Proposal = {
      metroId: session.metroId,
      userId: session.operatorUserId,
      source: "capture_session",
      directive: session.eventName
        ? `Capture session: ${session.eventName}`
        : `Capture session batch processing`,
      status: "pending",
      mode: "proposal",
      items: allProposalItems,
      batchMode: true,
      orchestratorDecisionId: null,
      metadata: { sessionId, eventName: session.eventName, itemCount: processedItems.length },
    };

    proposal = await saveSessionProposal(proposalRecord);

    await pool.query(
      `UPDATE capture_sessions SET proposal_id = $1, updated_at = NOW() WHERE id = $2`,
      [proposal.id, sessionId]
    );
  }

  const finalStatus: CaptureSessionStatus = needsReview > 0 ? "ready_for_review" : (allProposalItems.length > 0 ? "ready_for_review" : "completed");
  await pool.query(
    `UPDATE capture_sessions SET status = $1, processed_items = $2, updated_at = NOW() WHERE id = $3`,
    [finalStatus, processedItems.length, sessionId]
  );

  console.log(
    `[BatchProcessor] Session ${sessionId} processed: ${processedItems.length} items, ` +
    `${existingMatches} matched, ${newEntities} new, ${needsReview} need review, ` +
    `${allProposalItems.length} proposal actions`
  );

  await runExpoLifecycleHooks(sessionId, processedItems, session.metroId, session.operatorUserId);

  return {
    sessionId,
    items: processedItems,
    proposal,
    summary: {
      total: processedItems.length,
      highConfidence,
      mediumConfidence,
      lowConfidence,
      newEntities,
      existingMatches,
      needsReview,
      proposalItemCount: allProposalItems.length,
    },
  };
}

async function runExpoLifecycleHooks(
  sessionId: string,
  items: ProcessedCaptureItem[],
  metroId: string,
  operatorUserId: string
): Promise<void> {
  try {
    const { executeExpoItemHook } = await import("./charlotte-lifecycle-hooks");

    const highConfidenceItems = items.filter(
      i => i.confidence === "HIGH" || i.confidence === "MEDIUM"
    );

    for (const item of highConfidenceItems) {
      try {
        await executeExpoItemHook(item.itemId, {
          metroId,
          operatorUserId,
          generateStory: !!item.contactId,
          queueOutreach: !!item.contactId,
          scheduleFollowUp: true,
        });
      } catch (hookErr: unknown) {
        console.error(
          `[BatchProcessor] Expo lifecycle hook error for item ${item.itemId}:`,
          hookErr instanceof Error ? hookErr.message : "Unknown"
        );
      }
    }

    const lowConfidenceItems = items.filter(
      i => i.confidence === "LOW" || i.processingStatus === "low_confidence"
    );

    for (const item of lowConfidenceItems) {
      try {
        await executeExpoItemHook(item.itemId, {
          metroId,
          operatorUserId,
          generateStory: false,
          queueOutreach: false,
          scheduleFollowUp: false,
        });
      } catch (hookErr: unknown) {
        console.error(
          `[BatchProcessor] Expo low-confidence hook error for item ${item.itemId}:`,
          hookErr instanceof Error ? hookErr.message : "Unknown"
        );
      }
    }

    console.log(
      `[BatchProcessor] Expo lifecycle hooks completed: ${highConfidenceItems.length} high/med confidence, ${lowConfidenceItems.length} low confidence`
    );
  } catch (err: unknown) {
    console.error("[BatchProcessor] Expo lifecycle hooks error:", err instanceof Error ? err.message : "Unknown");
  }
}

async function saveSessionProposal(proposal: Proposal): Promise<Proposal> {
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

  if (proposal.items.length > 0) {
    try {
      await createInboxItemIfNotOpen({
        itemType: "pipeline_needs_review",
        relatedTable: "charlotte_proposals",
        relatedId: proposalId,
        title: `Capture Session Proposal: ${proposal.directive || proposal.items.length + " actions"}`,
        summary: `${proposal.items.length} proposed actions from capture session (batch). Templates: ${[...new Set(proposal.items.map((i) => i.templateKey))].join(", ")}`,
        priority: proposal.items.length > 10 ? "high" : "med",
        tags: ["Proposal", "CaptureSession", "Charlotte"],
      });
    } catch (inboxErr: unknown) {
      const msg = inboxErr instanceof Error ? inboxErr.message : "Unknown";
      console.error("[BatchProcessor] Inbox creation failed for proposal:", msg);
    }
  }

  console.log(
    `[BatchProcessor] Proposal ${proposalId} created: ${proposal.items.length} items`
  );

  return proposal;
}

function buildEntityReference(row: Record<string, unknown>): EntityReference {
  const company = row.input_company as string | null;
  const name = row.input_name as string | null;
  const phone = row.input_phone as string | null;
  const email = row.input_email as string | null;

  if (company) {
    return {
      rawText: company,
      entityType: "business",
      identifiers: {
        name: company,
        phone: phone || undefined,
        email: email || undefined,
      },
    };
  }

  if (name) {
    return {
      rawText: name,
      entityType: "contact",
      identifiers: {
        name,
        phone: phone || undefined,
        email: email || undefined,
      },
    };
  }

  return {
    rawText: (row.input_notes as string) || "Unknown capture",
    entityType: "unknown",
    identifiers: {},
  };
}

function buildDedupKey(row: Record<string, unknown>): string | null {
  const company = (row.input_company as string | null)?.toLowerCase().trim();
  const email = (row.input_email as string | null)?.toLowerCase().trim();
  const phone = (row.input_phone as string | null)?.replace(/\D/g, "");

  if (email) return `email:${email}`;
  if (company && phone) return `biz:${company}:${phone}`;
  if (company) return `biz:${company}`;
  return null;
}

function hasSufficientInputForCreation(row: Record<string, unknown>): boolean {
  const name = (row.input_name as string | null)?.trim();
  const company = (row.input_company as string | null)?.trim();
  const email = (row.input_email as string | null)?.trim();
  const phone = (row.input_phone as string | null)?.trim();

  if (company) return true;
  if (name && (email || phone)) return true;
  return false;
}

async function flagForInboxReview(
  row: Record<string, unknown>,
  session: CaptureSession,
  sessionId: string,
): Promise<void> {
  try {
    await createInboxItemIfNotOpen({
      itemType: "field_capture_review",
      relatedTable: "capture_session_items",
      relatedId: row.id as string,
      title: `Review capture: ${(row.input_name as string) || (row.input_company as string) || "Unknown"}`,
      summary: `Capture item needs review. Name: "${(row.input_name as string) || ""}", Company: "${(row.input_company as string) || ""}", Type: ${row.capture_type}. Session: ${session.eventName || sessionId}`,
      priority: "med",
      tags: ["CaptureSession", "NeedsReview"],
    });
  } catch (inboxErr: unknown) {
    const msg = inboxErr instanceof Error ? inboxErr.message : "Unknown";
    console.error("[BatchProcessor] Inbox creation failed:", msg);
  }
}

async function tryCreateNewEntity(
  row: Record<string, unknown>,
  metroId: string,
  operatorUserId: string
): Promise<{ businessId: string | null; contactId: string | null }> {
  const company = row.input_company as string | null;
  const name = row.input_name as string | null;
  const email = row.input_email as string | null;
  const phone = row.input_phone as string | null;
  const website = row.input_website as string | null;
  const address = row.input_address as string | null;
  const jobTitle = row.input_job_title as string | null;

  if (company && company.trim().length > 1) {
    const slug = company
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100);

    if (!slug) return { businessId: null, contactId: null };

    const { storage } = await import("./storage");
    const existing = await storage.getBusinessBySlug(metroId, slug);
    if (existing) {
      return { businessId: existing.id, contactId: null };
    }

    const cityZones = await storage.getZonesByCityId(metroId);
    let zoneId: string | null = null;
    if (address) {
      const zipMatch = address.match(/\b(\d{5})(?:-\d{4})?\b/);
      if (zipMatch) {
        for (const zone of cityZones) {
          if (zone.zipCodes && zone.zipCodes.includes(zipMatch[1])) {
            zoneId = zone.id;
            break;
          }
        }
      }
    }
    if (!zoneId && cityZones.length > 0) zoneId = cityZones[0].id;
    if (!zoneId) return { businessId: null, contactId: null };

    const addressParts = address ? parseAddressPartsSimple(address) : { city: "", state: "", zip: "" };

    const biz = await storage.createBusiness({
      cityId: metroId,
      name: company,
      slug,
      zoneId,
      address: address?.split(",")[0]?.trim() || null,
      city: addressParts.city || "Charlotte",
      state: addressParts.state || "NC",
      zip: addressParts.zip || null,
      phone: phone || null,
      email: email || null,
      websiteUrl: website || null,
      imageUrl: null,
      listingTier: "FREE",
      claimStatus: "UNCLAIMED",
      seedSourceType: "CAPTURE",
    });

    try {
      const existingQueue = await pool.query(
        `SELECT id FROM listings_to_claim_queue WHERE presence_id = $1 LIMIT 1`,
        [biz.id]
      );
      if (existingQueue.rows.length === 0) {
        await pool.query(
          `INSERT INTO listings_to_claim_queue (presence_id, source, status, notes) VALUES ($1, 'capture_session', 'ready', $2)`,
          [biz.id, `Created from capture session batch: ${company}`]
        );
      }
    } catch (queueErr: unknown) {
      const msg = queueErr instanceof Error ? queueErr.message : "Unknown";
      console.warn(`[BatchProcessor] Claim queue add failed for ${company}:`, msg);
    }

    if (name && (email || phone)) {
      try {
        const [contact] = await db.insert(crmContacts).values({
          userId: operatorUserId,
          name,
          email: email || null,
          phone: phone || null,
          company,
          jobTitle: jobTitle || null,
          website: website || null,
          address: address || null,
          status: "inbox",
          linkedBusinessId: biz.id,
          captureMethod: "capture_session",
          preferredChannel: email ? "email" : phone ? "sms" : "email",
        }).returning();
        return { businessId: biz.id, contactId: contact?.id || null };
      } catch {
        return { businessId: biz.id, contactId: null };
      }
    }

    return { businessId: biz.id, contactId: null };
  }

  if (name && name.trim().length > 1 && (email || phone)) {
    try {
      const [contact] = await db.insert(crmContacts).values({
        userId: operatorUserId,
        name,
        email: email || null,
        phone: phone || null,
        company: company || null,
        jobTitle: jobTitle || null,
        website: website || null,
        address: address || null,
        status: "inbox",
        captureMethod: "capture_session",
        preferredChannel: email ? "email" : "sms",
      }).returning();
      return { businessId: null, contactId: contact?.id || null };
    } catch {
      return { businessId: null, contactId: null };
    }
  }

  return { businessId: null, contactId: null };
}

function parseAddressPartsSimple(address: string): { city: string; state: string; zip: string } {
  const zip = address.match(/\b(\d{5})(?:-\d{4})?\b/)?.[1] || "";
  const stateMatch = address.match(/\b([A-Z]{2})\b/);
  const state = stateMatch ? stateMatch[1] : "";
  const parts = address.split(",").map(p => p.trim());
  const city = parts.length >= 2 ? parts[parts.length - 2].replace(/\b[A-Z]{2}\b/, "").replace(/\d{5}/, "").trim() : "";
  return { city, state, zip };
}

export async function getCaptureSession(sessionId: string): Promise<CaptureSession | null> {
  const result = await pool.query(
    `SELECT * FROM capture_sessions WHERE id = $1`,
    [sessionId]
  );
  if (result.rows.length === 0) return null;
  return mapSessionRow(result.rows[0]);
}

export async function listCaptureSessions(
  metroId?: string,
  limit = 50,
  offset = 0
): Promise<{ sessions: CaptureSession[]; total: number }> {
  const countQuery = metroId
    ? await pool.query(`SELECT COUNT(*) as count FROM capture_sessions WHERE metro_id = $1`, [metroId])
    : await pool.query(`SELECT COUNT(*) as count FROM capture_sessions`);
  const total = parseInt(countQuery.rows[0].count, 10);

  const dataQuery = metroId
    ? await pool.query(
        `SELECT * FROM capture_sessions WHERE metro_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [metroId, limit, offset]
      )
    : await pool.query(
        `SELECT * FROM capture_sessions ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

  return {
    sessions: dataQuery.rows.map(mapSessionRow),
    total,
  };
}

export async function getSessionItems(sessionId: string): Promise<Record<string, unknown>[]> {
  const result = await pool.query(
    `SELECT * FROM capture_session_items WHERE session_id = $1 ORDER BY created_at`,
    [sessionId]
  );
  return result.rows;
}

function mapSessionRow(row: Record<string, unknown>): CaptureSession {
  return {
    id: row.id as string,
    eventName: row.event_name as string | null,
    eventDate: row.event_date as string | null,
    location: row.location as string | null,
    metroId: row.metro_id as string,
    operatorUserId: row.operator_user_id as string,
    operatorName: row.operator_name as string | null,
    notes: row.notes as string | null,
    status: row.status as CaptureSessionStatus,
    totalItems: (row.total_items as number) || 0,
    processedItems: (row.processed_items as number) || 0,
    proposalId: row.proposal_id as string | null,
    createdAt: (row.created_at as Date)?.toISOString?.() || String(row.created_at),
    updatedAt: (row.updated_at as Date)?.toISOString?.() || String(row.updated_at),
  };
}
