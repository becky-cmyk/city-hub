import type { Express, Request, Response } from "express";
import { db } from "./db";
import { pool } from "./db";
import { storage } from "./storage";
import { captureSessions, captureSessionItems, businesses, crmContacts, zones } from "@shared/schema";
import { eq, and, desc, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { extractDataFromItem } from "./lib/capture-extraction";
import { resolveEntities, type EntityReference } from "./charlotte-orchestrator";
import {
  evaluateOpportunities,
  type ProposalItem,
  type Proposal,
  type ActionTemplateKey,
  confirmProposalItems,
  confirmAllProposalItems,
  executeProposal,
  getProposal,
} from "./charlotte-proposal-engine";
import { generateBusinessSlug } from "./lib/slug-utils";
import { speechToText, ensureCompatibleFormat } from "./replit_integrations/audio/client";
import { Buffer } from "node:buffer";

export interface CaptureQueueItem {
  source: "capture";
  type: "action" | "review" | "followup" | "opportunity";
  entityId: string | null;
  entityType: string | null;
  entityName: string | null;
  priority: "high" | "medium" | "low";
  recommendedAction: string;
  captureSessionId: string;
  captureItemId: string;
  metadata?: Record<string, unknown>;
}

export function prepareCaptureForQueue(
  item: {
    id: string;
    sessionId: string;
    matchedEntityId: string | null;
    matchedEntityType: string | null;
    matchedEntityName: string | null;
    matchConfidence: string | null;
    isExistingEntity: boolean | null;
    extractedData: Record<string, unknown> | null;
    proposedActions: string[] | null;
  }
): CaptureQueueItem {
  const confidence = item.matchConfidence || "LOW";
  const hasEntity = !!item.matchedEntityId;
  const isExisting = item.isExistingEntity === true;

  let type: CaptureQueueItem["type"] = "review";
  let priority: CaptureQueueItem["priority"] = "medium";
  let recommendedAction = "manual_review";

  if (hasEntity && isExisting && confidence === "HIGH") {
    type = "action";
    priority = "high";
    recommendedAction = item.proposedActions?.[0] || "followup_outreach";
  } else if (hasEntity && isExisting) {
    type = "followup";
    priority = "medium";
    recommendedAction = "verify_and_followup";
  } else if (hasEntity && !isExisting) {
    type = "opportunity";
    priority = "high";
    recommendedAction = "create_listing_and_outreach";
  } else if (item.proposedActions?.length) {
    type = "opportunity";
    priority = "high";
    recommendedAction = item.proposedActions[0];
  } else if (item.extractedData && ((item.extractedData as Record<string, string>).company || (item.extractedData as Record<string, string>).name)) {
    type = "opportunity";
    priority = "medium";
    recommendedAction = "create_listing_and_outreach";
  } else {
    type = "review";
    priority = "low";
    recommendedAction = "manual_review";
  }

  return {
    source: "capture",
    type,
    entityId: item.matchedEntityId,
    entityType: item.matchedEntityType,
    entityName: item.matchedEntityName,
    priority,
    recommendedAction,
    captureSessionId: item.sessionId,
    captureItemId: item.id,
    metadata: {
      confidence,
      isExisting,
      extractedName: (item.extractedData as Record<string, string> | null)?.name || null,
      extractedCompany: (item.extractedData as Record<string, string> | null)?.company || null,
    },
  };
}

export async function enqueueCaptureAction(queueItem: CaptureQueueItem, inboxItemId?: string): Promise<string> {
  const result = await pool.query(
    `INSERT INTO capture_action_queue (source, action_type, entity_id, entity_type, entity_name, priority, recommended_action, capture_session_id, capture_item_id, inbox_item_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id`,
    [
      queueItem.source,
      queueItem.type,
      queueItem.entityId,
      queueItem.entityType,
      queueItem.entityName,
      queueItem.priority,
      queueItem.recommendedAction,
      queueItem.captureSessionId,
      queueItem.captureItemId,
      inboxItemId || null,
      JSON.stringify(queueItem.metadata || {}),
    ]
  );
  return result.rows[0].id;
}

function parseBulkTextLine(line: string): Record<string, string> | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 2) return null;

  const result: Record<string, string> = {};

  const emailMatch = trimmed.match(/[\w.+-]+@[\w.-]+\.\w{2,}/);
  if (emailMatch) result.email = emailMatch[0];

  const phoneMatch = trimmed.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  if (phoneMatch) result.phone = phoneMatch[0];

  let remaining = trimmed;
  if (result.email) remaining = remaining.replace(result.email, "");
  if (result.phone) remaining = remaining.replace(result.phone, "");

  const parts = remaining.split(/\s*[–—\-|,\t]\s*/).map(p => p.trim()).filter(Boolean);

  if (parts.length >= 2) {
    result.name = parts[0];
    result.company = parts[1];
  } else if (parts.length === 1) {
    if (parts[0].match(/^[A-Z]/)) {
      result.name = parts[0];
    } else {
      result.company = parts[0];
    }
  }

  if (!result.name && !result.company && !result.email && !result.phone) return null;
  return result;
}

const createSessionSchema = z.object({
  eventName: z.string().min(1),
  eventDate: z.string().optional(),
  location: z.string().optional(),
  hubId: z.string().optional(),
  notes: z.string().optional(),
});

const addItemSchema = z.object({
  itemType: z.enum(["business_card", "handwritten_note", "booth_photo", "ad_photo", "document", "contact_data", "qr_data"]),
  imageUrl: z.string().optional(),
  imageBase64: z.string().optional(),
  rawInput: z.record(z.any()).optional(),
});

const addItemsSchema = z.object({
  items: z.array(addItemSchema).min(1).max(50),
});

interface CandidateMatch {
  id: string;
  name: string;
  confidence: number;
  matchFields: Record<string, string>;
}

async function resolveEntityForItem(
  extracted: Record<string, any>,
  hubId?: string
): Promise<{
  entityId: string | null;
  entityType: string | null;
  entityName: string | null;
  confidence: string;
  isExisting: boolean;
  businessId: string | null;
  candidates: CandidateMatch[];
}> {
  const company = extracted.company?.trim();
  const name = extracted.name?.trim();
  const email = extracted.email?.trim();
  const phone = extracted.phone?.trim();
  const website = extracted.website?.trim();

  if (company) {
    const ref: EntityReference = {
      rawText: company,
      entityType: "business",
      identifiers: { name: company, phone, email },
    };

    const resolved = await resolveEntities([ref], hubId);
    if (resolved.length > 0 && resolved[0].entityId) {
      return {
        entityId: resolved[0].entityId,
        entityType: "business",
        entityName: resolved[0].name,
        confidence: resolved[0].confidence,
        isExisting: true,
        businessId: resolved[0].entityId,
        candidates: resolved.filter(r => r.entityId).map(r => ({
          id: r.entityId!,
          name: r.name,
          confidence: r.confidence === "HIGH" ? 0.9 : r.confidence === "MEDIUM" ? 0.6 : 0.3,
          matchFields: { name: r.name, type: r.entityType || "business" },
        })),
      };
    }

    const bizConditions = [];
    if (website) {
      bizConditions.push(ilike(businesses.websiteUrl, `%${website.replace(/^https?:\/\//, "").replace(/\/$/, "")}%`));
    }
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, "").slice(-10);
      if (cleanPhone.length === 10) {
        bizConditions.push(ilike(businesses.phone, `%${cleanPhone.slice(-7)}%`));
      }
    }
    if (email) {
      bizConditions.push(eq(businesses.ownerEmail, email));
    }

    if (bizConditions.length > 0) {
      const scopeCondition = hubId ? eq(businesses.cityId, hubId) : undefined;
      const where = scopeCondition
        ? and(scopeCondition, or(...bizConditions))
        : or(...bizConditions);

      const matches = await db.select({ id: businesses.id, name: businesses.name, phone: businesses.phone, ownerEmail: businesses.ownerEmail })
        .from(businesses)
        .where(where!)
        .limit(5);

      const candidateList: CandidateMatch[] = matches.map(m => ({
        id: m.id,
        name: m.name,
        confidence: 0.5,
        matchFields: {
          name: m.name,
          ...(m.phone ? { phone: m.phone } : {}),
          ...(m.ownerEmail ? { email: m.ownerEmail } : {}),
        },
      }));

      if (matches.length === 1) {
        return {
          entityId: matches[0].id,
          entityType: "business",
          entityName: matches[0].name,
          confidence: "MEDIUM",
          isExisting: true,
          businessId: matches[0].id,
          candidates: candidateList,
        };
      }

      if (matches.length > 1) {
        return {
          entityId: null,
          entityType: "business",
          entityName: company,
          confidence: "LOW",
          isExisting: false,
          businessId: null,
          candidates: candidateList,
        };
      }
    }

    return {
      entityId: null,
      entityType: "business",
      entityName: company,
      confidence: "LOW",
      isExisting: false,
      businessId: null,
      candidates: [],
    };
  }

  if (name || email || phone) {
    const contactRef: EntityReference = {
      rawText: name || email || phone || "",
      entityType: "contact",
      identifiers: { name, phone, email },
    };

    const resolved = await resolveEntities([contactRef], hubId);
    if (resolved.length > 0 && resolved[0].entityId) {
      const [contact] = await db.select({ linkedBusinessId: crmContacts.linkedBusinessId })
        .from(crmContacts)
        .where(eq(crmContacts.id, resolved[0].entityId))
        .limit(1);

      return {
        entityId: resolved[0].entityId,
        entityType: "contact",
        entityName: resolved[0].name,
        confidence: resolved[0].confidence,
        isExisting: true,
        businessId: contact?.linkedBusinessId || null,
        candidates: resolved.filter(r => r.entityId).map(r => ({
          id: r.entityId!,
          name: r.name,
          confidence: r.confidence === "HIGH" ? 0.9 : r.confidence === "MEDIUM" ? 0.6 : 0.3,
          matchFields: { name: r.name, type: r.entityType || "contact" },
        })),
      };
    }

    return {
      entityId: null,
      entityType: "contact",
      entityName: name || email || phone || "Unknown",
      confidence: "LOW",
      isExisting: false,
      businessId: null,
      candidates: [],
    };
  }

  return {
    entityId: null,
    entityType: null,
    entityName: null,
    confidence: "LOW",
    isExisting: false,
    businessId: null,
    candidates: [],
  };
}

function deduplicateItems(
  items: Array<{ id: string; extractedData: Record<string, any> | null; matchedEntityId: string | null }>
): Map<string, string[]> {
  const groupMap = new Map<string, string[]>();

  for (const item of items) {
    if (!item.extractedData) continue;

    const company = (item.extractedData.company || "").trim().toLowerCase();
    const email = (item.extractedData.email || "").trim().toLowerCase();
    const phone = (item.extractedData.phone || "").replace(/\D/g, "");

    let groupKey = item.matchedEntityId || "";
    if (!groupKey && company) groupKey = `company:${company}`;
    else if (!groupKey && email) groupKey = `email:${email}`;
    else if (!groupKey && phone) groupKey = `phone:${phone}`;
    else if (!groupKey) groupKey = `item:${item.id}`;

    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, []);
    }
    groupMap.get(groupKey)!.push(item.id);
  }

  return groupMap;
}

async function resolveNewEntitiesForProposal(proposalId: string, hubId: string | null, operatorId: string): Promise<{ resolved: number; failed: number }> {
  const proposalItems = await pool.query(
    `SELECT id, template_key, entity_type, entity_id, entity_name, status, params FROM charlotte_proposal_items WHERE proposal_id = $1 AND status = 'confirmed'`,
    [proposalId]
  );

  let cityId = hubId || null;
  let defaultZoneId: string | null = null;

  if (cityId) {
    const zoneRows = await db.select({ id: zones.id }).from(zones).where(eq(zones.cityId, cityId)).limit(1);
    defaultZoneId = zoneRows[0]?.id || null;
  }

  if (!cityId || !defaultZoneId) {
    const fallbackZone = await db.select({ id: zones.id, cityId: zones.cityId }).from(zones).limit(1);
    if (fallbackZone[0]) {
      if (!cityId) cityId = fallbackZone[0].cityId;
      if (!defaultZoneId) defaultZoneId = fallbackZone[0].id;
    }
  }

  if (!defaultZoneId || !cityId) {
    const newEntityItems = proposalItems.rows.filter((r: any) => {
      const p = typeof r.params === "string" ? JSON.parse(r.params) : r.params;
      return p?.isNewEntity && !r.entity_id;
    });
    for (const row of newEntityItems) {
      await pool.query(
        `UPDATE charlotte_proposal_items SET status = 'failed', error_message = $1 WHERE id = $2`,
        ["Cannot create entity: no city/zone available. Please set a hub on the session.", row.id]
      );
    }
    return { resolved: 0, failed: newEntityItems.length };
  }

  const createdEntities = new Map<string, { businessId: string | null; contactId: string | null }>();
  let resolved = 0;
  let failed = 0;

  for (const row of proposalItems.rows) {
    const params = typeof row.params === "string" ? JSON.parse(row.params) : row.params;
    if (!params?.isNewEntity || row.entity_id) continue;

    const extracted = params.extractedData || {};
    const entityKey = `${(extracted.company || extracted.name || "").toLowerCase().trim()}:${(extracted.email || "").toLowerCase().trim()}`;

    const cached = createdEntities.get(entityKey);

    if (row.entity_type === "business") {
      if (cached?.businessId) {
        await pool.query(`UPDATE charlotte_proposal_items SET entity_id = $1 WHERE id = $2`, [cached.businessId, row.id]);
        resolved++;
        continue;
      }

      if (extracted.company) {
        try {
          const slug = await generateBusinessSlug(extracted.company, cityId);
          const [newBiz] = await db.insert(businesses).values({
            cityId,
            zoneId: defaultZoneId,
            name: extracted.company,
            slug,
            description: `Discovered at expo/field visit`,
            phone: extracted.phone || null,
            websiteUrl: extracted.website || null,
            ownerEmail: extracted.email || null,
            address: extracted.address || null,
            claimStatus: "UNCLAIMED",
            presenceStatus: "ACTIVE",
            listingTier: "FREE",
          }).returning({ id: businesses.id });

          const entry = cached || { businessId: null, contactId: null };
          entry.businessId = newBiz.id;
          createdEntities.set(entityKey, entry);

          await pool.query(`UPDATE charlotte_proposal_items SET entity_id = $1 WHERE id = $2`, [newBiz.id, row.id]);
          console.log(`[CaptureSession] Created new business: ${extracted.company} (${newBiz.id})`);
          resolved++;
        } catch (bizErr: any) {
          console.error(`[CaptureSession] Failed to create business ${extracted.company}:`, bizErr.message);
          await pool.query(
            `UPDATE charlotte_proposal_items SET status = 'failed', error_message = $1 WHERE id = $2`,
            [`Failed to create business entity: ${bizErr.message}`, row.id]
          );
          failed++;
        }
      }
    }

    if (row.entity_type === "contact") {
      if (cached?.contactId) {
        await pool.query(`UPDATE charlotte_proposal_items SET entity_id = $1 WHERE id = $2`, [cached.contactId, row.id]);
        resolved++;
        continue;
      }

      if (extracted.name || extracted.email) {
        try {
          const linkedBizId = cached?.businessId || null;
          const [newContact] = await db.insert(crmContacts).values({
            userId: operatorId,
            name: extracted.name || extracted.email || "Unknown",
            email: extracted.email || null,
            phone: extracted.phone || null,
            company: extracted.company || null,
            jobTitle: extracted.jobTitle || null,
            website: extracted.website || null,
            address: extracted.address || null,
            captureMethod: "expo_session",
            captureOrigin: "capture_session",
            linkedBusinessId: linkedBizId,
            status: "active",
          }).returning({ id: crmContacts.id });

          const entry = cached || { businessId: null, contactId: null };
          entry.contactId = newContact.id;
          createdEntities.set(entityKey, entry);

          await pool.query(`UPDATE charlotte_proposal_items SET entity_id = $1 WHERE id = $2`, [newContact.id, row.id]);
          console.log(`[CaptureSession] Created new contact: ${extracted.name || extracted.email} (${newContact.id})`);
          resolved++;
        } catch (contactErr: any) {
          console.error(`[CaptureSession] Failed to create contact:`, contactErr.message);
          await pool.query(
            `UPDATE charlotte_proposal_items SET status = 'failed', error_message = $1 WHERE id = $2`,
            [`Failed to create contact entity: ${contactErr.message}`, row.id]
          );
          failed++;
        }
      }
    }
  }

  return { resolved, failed };
}

const ADMIN_ROLES = ["PLATFORM_ADMIN", "SUPER_ADMIN", "super_admin", "admin", "ADMIN", "CITY_ADMIN", "city_admin"];

async function isAdminUser(req: Request): Promise<boolean> {
  const session = req.session as any;
  const userId = session?.userId;
  if (!userId) return false;
  try {
    const user = await storage.getUserById(userId);
    return !!user && ADMIN_ROLES.includes(user.role || "");
  } catch {
    return false;
  }
}

function getActorId(req: Request): string | null {
  const session = req.session as any;
  return session.userId || session.operatorId || null;
}

export function registerCaptureSessionRoutes(app: Express, requireAdmin: any) {
  app.post("/api/capture-sessions", requireAdmin, async (req: Request, res: Response) => {
    try {
      const actorId = getActorId(req);
      const reqSession = req.session as any;
      const operatorName = reqSession?.operatorName || reqSession?.userName || reqSession?.user?.name || "Operator";
      const parsed = createSessionSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });

      const [created] = await db.insert(captureSessions).values({
        eventName: parsed.data.eventName,
        eventDate: parsed.data.eventDate || null,
        location: parsed.data.location || null,
        operatorId: actorId,
        operatorName,
        hubId: parsed.data.hubId || null,
        notes: parsed.data.notes || null,
        status: "open",
        totalItems: 0,
        processedItems: 0,
        matchedExisting: 0,
        matchedNew: 0,
      }).returning();

      res.status(201).json(created);
    } catch (err: any) {
      console.error("[CaptureSession] Create error:", err.message);
      res.status(500).json({ error: "Failed to create session" });
    }
  });

  app.post("/api/capture-sessions/:id/items", requireAdmin, async (req: Request, res: Response) => {
    try {
      const sessionId = String(req.params.id);
      const [session] = await db.select().from(captureSessions).where(eq(captureSessions.id, sessionId)).limit(1);
      if (!session) return res.status(404).json({ error: "Session not found" });
      if (!(await isAdminUser(req)) && session.operatorId !== getActorId(req)) return res.status(403).json({ error: "Access denied" });
      if (session.status !== "open" && session.status !== "uploading") {
        return res.status(400).json({ error: "Session is not accepting new items" });
      }

      const parsed = addItemsSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });

      await db.update(captureSessions).set({ status: "uploading", updatedAt: new Date() }).where(eq(captureSessions.id, sessionId));

      const insertedItems = [];
      for (const item of parsed.data.items) {
        const resolvedImageUrl = item.imageUrl || item.rawInput?.imageUrl || null;
        const mergedRawInput = { ...(item.rawInput || {}) };
        if (item.imageBase64 && !mergedRawInput.imageBase64) {
          mergedRawInput.imageBase64 = item.imageBase64;
        }
        const [inserted] = await db.insert(captureSessionItems).values({
          sessionId,
          itemType: item.itemType,
          status: "pending",
          imageUrl: resolvedImageUrl,
          rawInput: Object.keys(mergedRawInput).length > 0 ? mergedRawInput : null,
        }).returning();
        insertedItems.push(inserted);
      }

      await db.update(captureSessions).set({
        totalItems: session.totalItems + insertedItems.length,
        status: "open",
        updatedAt: new Date(),
      }).where(eq(captureSessions.id, sessionId));

      res.status(201).json({ items: insertedItems, totalItems: session.totalItems + insertedItems.length });
    } catch (err: any) {
      console.error("[CaptureSession] Add items error:", err.message);
      res.status(500).json({ error: "Failed to add items" });
    }
  });

  app.post("/api/capture-sessions/:id/process", requireAdmin, async (req: Request, res: Response) => {
    try {
      const sessionId = String(req.params.id);
      const [session] = await db.select().from(captureSessions).where(eq(captureSessions.id, sessionId)).limit(1);
      if (!session) return res.status(404).json({ error: "Session not found" });
      if (!(await isAdminUser(req)) && session.operatorId !== getActorId(req)) return res.status(403).json({ error: "Access denied" });

      const allowedProcessStates = ["open", "uploading", "failed"];
      if (!allowedProcessStates.includes(session.status)) {
        return res.status(400).json({ error: `Session cannot be processed in '${session.status}' state` });
      }

      await db.update(captureSessions).set({ status: "processing", updatedAt: new Date() }).where(eq(captureSessions.id, sessionId));

      const items = await db.select().from(captureSessionItems).where(eq(captureSessionItems.sessionId, sessionId));

      let processedCount = 0;

      for (const item of items) {
        try {
          await db.update(captureSessionItems).set({ status: "extracting" }).where(eq(captureSessionItems.id, item.id));

          const rawInput = (item.rawInput as Record<string, any>) || undefined;
          const imageBase64 = rawInput?.imageBase64;
          const itemImageUrl = item.imageUrl || rawInput?.imageUrl;
          const extracted = await extractDataFromItem(
            item.itemType,
            imageBase64,
            itemImageUrl,
            rawInput
          );

          await db.update(captureSessionItems).set({
            status: "extracted",
            extractedData: extracted,
          }).where(eq(captureSessionItems.id, item.id));

          const resolution = await resolveEntityForItem(extracted, session.hubId || undefined);

          const itemStatus = resolution.entityId ? "matched" : "unmatched";
          await db.update(captureSessionItems).set({
            status: itemStatus,
            matchedEntityId: resolution.entityId,
            matchedEntityType: resolution.entityType,
            matchedEntityName: resolution.entityName,
            matchConfidence: resolution.confidence,
            isExistingEntity: resolution.isExisting,
            businessId: resolution.businessId,
          }).where(eq(captureSessionItems.id, item.id));

          if (resolution.confidence === "HIGH" && resolution.entityId) {
            const queueItem = prepareCaptureForQueue({
              id: item.id,
              sessionId: item.sessionId,
              matchedEntityId: resolution.entityId,
              matchedEntityType: resolution.entityType,
              matchedEntityName: resolution.entityName,
              matchConfidence: resolution.confidence,
              isExistingEntity: resolution.isExisting,
              extractedData: extracted,
              proposedActions: null,
            });
            await enqueueCaptureAction(queueItem);
          }

          const { createCaptureTriageItem } = await import("./admin-inbox");
          const confNum = resolution.confidence === "HIGH" ? 0.9 : resolution.confidence === "MEDIUM" ? 0.5 : 0.2;
          const candidates = resolution.candidates.length > 0
            ? resolution.candidates
            : (resolution.entityId ? [{
                id: resolution.entityId,
                name: resolution.entityName || "Unknown",
                confidence: confNum,
                matchFields: { type: resolution.entityType || "unknown" },
              }] : []);
          const suggestedAction = !resolution.entityId
            ? "create_listing_and_outreach"
            : "verify_and_followup";
          await createCaptureTriageItem({
            captureItemId: item.id,
            captureSessionId: item.sessionId,
            entityName: resolution.entityName,
            confidence: confNum,
            matchCandidates: candidates,
            extractedData: extracted,
            suggestedAction,
          });

          processedCount++;
        } catch (itemErr: any) {
          console.error(`[CaptureSession] Item ${item.id} processing error:`, itemErr.message);
          await db.update(captureSessionItems).set({
            status: "error",
            processingError: itemErr.message,
          }).where(eq(captureSessionItems.id, item.id));
          try {
            const { createCaptureTriageItem } = await import("./admin-inbox");
            await createCaptureTriageItem({
              captureItemId: item.id,
              captureSessionId: item.sessionId,
              entityName: (item.extractedData as Record<string, any>)?.company || null,
              confidence: 0,
              matchCandidates: [],
              extractedData: item.extractedData as Record<string, any>,
              suggestedAction: "investigate_error",
              triageCategory: "exception",
              triageReason: `Processing error: ${itemErr.message}`,
            });
          } catch (_inboxErr) {}
          processedCount++;
        }
      }

      const updatedItems = await db.select().from(captureSessionItems).where(eq(captureSessionItems.sessionId, sessionId));
      const deduped = deduplicateItems(
        updatedItems.map(i => ({
          id: i.id,
          extractedData: i.extractedData as Record<string, any> | null,
          matchedEntityId: i.matchedEntityId,
        }))
      );

      let proposalId: string | null = null;
      try {
        const proposalItems: ProposalItem[] = [];
        const processedEntities = new Set<string>();

        for (const [groupKey, itemIds] of Array.from(deduped.entries())) {
          const primaryItem = updatedItems.find(i => i.id === itemIds[0]);
          if (!primaryItem) continue;

          const entityId = primaryItem.matchedEntityId;
          const entityType = primaryItem.matchedEntityType;
          const entityName = primaryItem.matchedEntityName || "Unknown";

          if (entityId && processedEntities.has(entityId)) continue;
          if (entityId) processedEntities.add(entityId);

          if (entityId && (entityType === "business" || entityType === "contact")) {
            const opportunity = await evaluateOpportunities(
              entityId,
              entityType as "business" | "contact",
              session.hubId || undefined
            );

            for (const key of opportunity.eligibleTemplates) {
              proposalItems.push({
                templateKey: key,
                entityType,
                entityId,
                entityName: opportunity.entityName || entityName,
                status: "proposed",
                params: {
                  reason: opportunity.reasons[key] || "Eligible",
                  templateLabel: key,
                  captureSessionId: sessionId,
                  itemIds,
                },
              });
            }
          } else if (!entityId) {
            const extracted = primaryItem.extractedData as Record<string, any> | null;
            const hasCompany = !!extracted?.company?.trim();
            const hasName = !!extracted?.name?.trim();
            const hasEmail = !!extracted?.email?.trim();
            const hasPhone = !!extracted?.phone?.trim();

            if (!hasCompany && !hasName && !hasEmail && !hasPhone) {
              continue;
            }

            if (hasCompany) {
              proposalItems.push({
                templateKey: "CLAIM_LISTING",
                entityType: "business",
                entityId: null,
                entityName: extracted!.company,
                status: "proposed",
                params: {
                  reason: "New business discovered at expo — create listing and queue for outreach",
                  templateLabel: "Create New Listing",
                  captureSessionId: sessionId,
                  itemIds,
                  extractedData: extracted,
                  isNewEntity: true,
                },
              });
            }

            if ((hasName || hasEmail) && hasEmail) {
              proposalItems.push({
                templateKey: "BECKY_OUTREACH",
                entityType: "contact",
                entityId: null,
                entityName: extracted?.name || extracted?.email || "Unknown",
                status: "proposed",
                params: {
                  reason: "New contact from expo — queue Becky intro",
                  templateLabel: "Becky Intro Email",
                  captureSessionId: sessionId,
                  itemIds,
                  extractedData: extracted,
                  isNewEntity: true,
                },
              });
            }

            if (hasName) {
              proposalItems.push({
                templateKey: "STORY_DRAFT",
                entityType: "contact",
                entityId: null,
                entityName: extracted!.name,
                status: "proposed",
                params: {
                  reason: "New contact captured — draft story article",
                  templateLabel: "Generate Story Draft",
                  captureSessionId: sessionId,
                  itemIds,
                  extractedData: extracted,
                  isNewEntity: true,
                },
              });
            }
          }
        }

        if (proposalItems.length > 0) {
          const result = await pool.query(
            `INSERT INTO charlotte_proposals
              (metro_id, user_id, source, directive, status, mode, total_items, confirmed_items, executed_items, failed_items, batch_mode, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 0, 0, $8, $9)
            RETURNING id`,
            [
              session.hubId,
              session.operatorId,
              "capture_session",
              `Expo capture: ${session.eventName}`,
              "pending",
              "proposal",
              proposalItems.length,
              true,
              JSON.stringify({ captureSessionId: sessionId, eventName: session.eventName }),
            ]
          );

          proposalId = result.rows[0].id;

          for (const item of proposalItems) {
            await pool.query(
              `INSERT INTO charlotte_proposal_items
                (proposal_id, template_key, entity_type, entity_id, entity_name, status, params)
              VALUES ($1, $2, $3, $4, $5, $6, $7)`,
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
          }
        }
      } catch (proposalErr: any) {
        console.error("[CaptureSession] Proposal generation error:", proposalErr.message);
      }

      let matchedExisting = 0;
      let matchedNew = 0;
      const seenEntities = new Set<string>();
      for (const [groupKey, itemIds] of Array.from(deduped.entries())) {
        const primaryItem = updatedItems.find(i => i.id === itemIds[0]);
        if (!primaryItem) continue;
        const entityKey = primaryItem.matchedEntityId || groupKey;
        if (seenEntities.has(entityKey)) continue;
        seenEntities.add(entityKey);
        if (primaryItem.isExistingEntity) matchedExisting++;
        else if (primaryItem.matchedEntityType) matchedNew++;
      }

      const errorCount = updatedItems.filter(i => i.status === "error").length;
      const allFailed = errorCount === items.length;
      const finalStatus = allFailed ? "failed" : "ready_for_review";

      await db.update(captureSessions).set({
        status: finalStatus,
        processedItems: processedCount,
        matchedExisting,
        matchedNew,
        proposalId,
        updatedAt: new Date(),
      }).where(eq(captureSessions.id, sessionId));

      const finalSession = await db.select().from(captureSessions).where(eq(captureSessions.id, sessionId)).limit(1);
      const finalItems = await db.select().from(captureSessionItems).where(eq(captureSessionItems.sessionId, sessionId));

      const queueReadyItems = finalItems
        .filter(fi => fi.status === "matched" || fi.status === "unmatched" || fi.status === "extracted")
        .map(fi => prepareCaptureForQueue({
          id: fi.id,
          sessionId: fi.sessionId,
          matchedEntityId: fi.matchedEntityId,
          matchedEntityType: fi.matchedEntityType,
          matchedEntityName: fi.matchedEntityName,
          matchConfidence: fi.matchConfidence,
          isExistingEntity: fi.isExistingEntity,
          extractedData: fi.extractedData as Record<string, unknown> | null,
          proposedActions: fi.proposedActions as string[] | null,
        }));

      let proposal = null;
      if (proposalId) {
        proposal = await getProposal(proposalId);
      }

      res.json({
        session: finalSession[0],
        items: finalItems,
        proposal,
        queueReadyItems,
        summary: {
          total: items.length,
          processed: processedCount,
          matchedExisting,
          matchedNew,
          proposalActions: proposal?.items.length || 0,
          deduplicatedGroups: deduped.size,
        },
      });
    } catch (err: any) {
      console.error("[CaptureSession] Process error:", err.message);
      await db.update(captureSessions).set({ status: "failed", updatedAt: new Date() }).where(eq(captureSessions.id, String(req.params.id)));
      res.status(500).json({ error: "Processing failed" });
    }
  });

  app.get("/api/capture-sessions", requireAdmin, async (req: Request, res: Response) => {
    try {
      const actorId = getActorId(req);
      const isAdmin = await isAdminUser(req);
      const conditions = isAdmin || !actorId ? [] : [eq(captureSessions.operatorId, actorId)];
      const sessions = await db.select()
        .from(captureSessions)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(captureSessions.createdAt))
        .limit(100);
      res.json(sessions);
    } catch (err: any) {
      console.error("[CaptureSession] List error:", err.message);
      res.status(500).json({ error: "Failed to list sessions" });
    }
  });

  app.get("/api/capture-sessions/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const [session] = await db.select().from(captureSessions).where(eq(captureSessions.id, String(req.params.id))).limit(1);
      if (!session) return res.status(404).json({ error: "Session not found" });
      if (!(await isAdminUser(req)) && session.operatorId !== getActorId(req)) return res.status(403).json({ error: "Access denied" });

      const items = await db.select().from(captureSessionItems).where(eq(captureSessionItems.sessionId, session.id));

      let proposal = null;
      if (session.proposalId) {
        proposal = await getProposal(session.proposalId);
      }

      const queueReadyItems = items
        .filter(fi => fi.status === "matched" || fi.status === "unmatched" || fi.status === "extracted")
        .map(fi => prepareCaptureForQueue({
          id: fi.id,
          sessionId: fi.sessionId,
          matchedEntityId: fi.matchedEntityId,
          matchedEntityType: fi.matchedEntityType,
          matchedEntityName: fi.matchedEntityName,
          matchConfidence: fi.matchConfidence,
          isExistingEntity: fi.isExistingEntity,
          extractedData: fi.extractedData as Record<string, unknown> | null,
          proposedActions: fi.proposedActions as string[] | null,
        }));

      res.json({ session, items, proposal, queueReadyItems });
    } catch (err: any) {
      console.error("[CaptureSession] Get error:", err.message);
      res.status(500).json({ error: "Failed to get session" });
    }
  });

  app.post("/api/capture-sessions/:id/proposal/confirm", requireAdmin, async (req: Request, res: Response) => {
    try {
      const [session] = await db.select().from(captureSessions).where(eq(captureSessions.id, String(req.params.id))).limit(1);
      if (!session) return res.status(404).json({ error: "Session not found" });
      if (!(await isAdminUser(req)) && session.operatorId !== getActorId(req)) return res.status(403).json({ error: "Access denied" });
      if (!session.proposalId) return res.status(400).json({ error: "No proposal for this session" });

      const { itemIds, action, confirmAll } = req.body;

      let result;
      if (confirmAll) {
        result = await confirmAllProposalItems(session.proposalId);
      } else if (itemIds && Array.isArray(itemIds) && (action === "confirm" || action === "skip")) {
        result = await confirmProposalItems(session.proposalId, itemIds, action);
      } else {
        return res.status(400).json({ error: "Provide itemIds+action or confirmAll" });
      }

      const confirmedCheck = await pool.query(
        `SELECT COUNT(*) as cnt FROM charlotte_proposal_items WHERE proposal_id = $1 AND status = 'confirmed'`,
        [session.proposalId]
      );
      const hasConfirmedItems = parseInt(confirmedCheck.rows[0].cnt, 10) > 0;

      await pool.query(
        `UPDATE charlotte_proposals SET status = $1, updated_at = NOW() WHERE id = $2`,
        [hasConfirmedItems ? "confirmed" : "completed", session.proposalId]
      );

      if (!hasConfirmedItems) {
        await db.update(captureSessions).set({
          status: "complete",
          updatedAt: new Date(),
        }).where(eq(captureSessions.id, session.id));
      }

      res.json(result);
    } catch (err: any) {
      console.error("[CaptureSession] Confirm error:", err.message);
      res.status(500).json({ error: "Confirmation failed" });
    }
  });

  app.patch("/api/capture-sessions/:id/proposal/items/:itemId", requireAdmin, async (req: Request, res: Response) => {
    try {
      const [session] = await db.select().from(captureSessions).where(eq(captureSessions.id, String(req.params.id))).limit(1);
      if (!session) return res.status(404).json({ error: "Session not found" });
      if (!(await isAdminUser(req)) && session.operatorId !== getActorId(req)) return res.status(403).json({ error: "Access denied" });
      if (!session.proposalId) return res.status(400).json({ error: "No proposal for this session" });

      const itemId = String(req.params.itemId);

      const patchSchema = z.object({
        entityName: z.string().min(1).max(500).optional(),
        entityType: z.enum(["business", "contact"]).optional(),
        templateKey: z.enum(["CLAIM_LISTING", "STORY_DRAFT", "BECKY_OUTREACH", "CROWN_CANDIDATE", "FOLLOWUP_EMAIL", "LISTING_UPGRADE", "TV_VENUE_SCREEN", "CONTENT_ARTICLE", "EVENT_PROMOTION", "SEARCH_RECOMMENDATION"]).optional(),
        params: z.record(z.any()).optional(),
      }).strict();

      const parsed = patchSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });

      const { entityName, entityType, params, templateKey } = parsed.data;

      const updates: string[] = [];
      const values: any[] = [];
      let paramIdx = 1;

      if (entityName !== undefined) {
        updates.push(`entity_name = $${paramIdx++}`);
        values.push(entityName);
      }
      if (entityType !== undefined) {
        updates.push(`entity_type = $${paramIdx++}`);
        values.push(entityType);
      }
      if (templateKey !== undefined) {
        updates.push(`template_key = $${paramIdx++}`);
        values.push(templateKey);
      }
      if (params !== undefined) {
        updates.push(`params = $${paramIdx++}`);
        values.push(JSON.stringify(params));
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: "No fields to update" });
      }

      updates.push(`updated_at = NOW()`);
      values.push(itemId);
      values.push(session.proposalId);

      const result = await pool.query(
        `UPDATE charlotte_proposal_items SET ${updates.join(", ")} WHERE id = $${paramIdx++} AND proposal_id = $${paramIdx} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Proposal item not found" });
      }

      res.json(result.rows[0]);
    } catch (err: any) {
      console.error("[CaptureSession] Modify proposal item error:", err.message);
      res.status(500).json({ error: "Failed to modify proposal item" });
    }
  });

  app.post("/api/capture-sessions/:id/proposal/execute", requireAdmin, async (req: Request, res: Response) => {
    try {
      const [session] = await db.select().from(captureSessions).where(eq(captureSessions.id, String(req.params.id))).limit(1);
      if (!session) return res.status(404).json({ error: "Session not found" });
      if (!(await isAdminUser(req)) && session.operatorId !== getActorId(req)) return res.status(403).json({ error: "Access denied" });
      if (!session.proposalId) return res.status(400).json({ error: "No proposal for this session" });

      const allowedExecStates = ["ready_for_review", "partially_executed"];
      if (!allowedExecStates.includes(session.status)) {
        return res.status(400).json({ error: `Session cannot be executed in '${session.status}' state` });
      }

      await db.update(captureSessions).set({
        status: "partially_executed",
        updatedAt: new Date(),
      }).where(eq(captureSessions.id, session.id));

      const resolveResult = await resolveNewEntitiesForProposal(session.proposalId, session.hubId, session.operatorId || getActorId(req) || "system");

      await pool.query(
        `UPDATE charlotte_proposal_items SET status = 'skipped', error_message = 'Entity ID could not be resolved' WHERE proposal_id = $1 AND status = 'confirmed' AND entity_id IS NULL`,
        [session.proposalId]
      );
      if (resolveResult.failed > 0 && resolveResult.resolved === 0) {
        await db.update(captureSessions).set({
          status: "failed",
          updatedAt: new Date(),
        }).where(eq(captureSessions.id, session.id));
        return res.status(400).json({
          error: `Failed to resolve ${resolveResult.failed} new entities. Ensure a hub is set on the session.`,
          resolved: resolveResult.resolved,
          failed: resolveResult.failed,
        });
      }

      const result = await executeProposal(session.proposalId);

      const totalFailed = result.failed + resolveResult.failed;
      const finalStatus = totalFailed === 0 ? "complete" : "partially_executed";
      await db.update(captureSessions).set({
        status: finalStatus,
        updatedAt: new Date(),
      }).where(eq(captureSessions.id, session.id));

      const updatedProposal = await getProposal(session.proposalId);

      res.json({ ...result, proposal: updatedProposal });
    } catch (err: any) {
      console.error("[CaptureSession] Execute error:", err.message);
      res.status(500).json({ error: "Execution failed" });
    }
  });

  app.post("/api/capture-sessions/:id/items/voice", requireAdmin, async (req: Request, res: Response) => {
    try {
      const sessionId = String(req.params.id);
      const [session] = await db.select().from(captureSessions).where(eq(captureSessions.id, sessionId)).limit(1);
      if (!session) return res.status(404).json({ error: "Session not found" });
      if (!(await isAdminUser(req)) && session.operatorId !== getActorId(req)) return res.status(403).json({ error: "Access denied" });
      if (session.status !== "open" && session.status !== "uploading") {
        return res.status(400).json({ error: "Session is not accepting new items" });
      }

      const { audioBase64 } = req.body;
      if (!audioBase64 || typeof audioBase64 !== "string") {
        return res.status(400).json({ error: "audioBase64 is required" });
      }

      const raw = audioBase64.includes(",") ? audioBase64.split(",")[1] : audioBase64;
      const audioBuffer = Buffer.from(raw, "base64");
      const { buffer: compatBuffer, format } = await ensureCompatibleFormat(audioBuffer);
      const transcript = await speechToText(compatBuffer, format);

      if (!transcript || transcript.trim().length === 0) {
        return res.status(400).json({ error: "Could not transcribe audio" });
      }

      const extractedData: Record<string, string> = { transcript };
      const emailMatch = transcript.match(/[\w.+-]+@[\w.-]+\.\w{2,}/i);
      if (emailMatch) extractedData.email = emailMatch[0];
      const phoneMatch = transcript.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
      if (phoneMatch) extractedData.phone = phoneMatch[0];
      const namePatterns = [
        /(?:my name is|i'm|i am)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
        /(?:name'?s?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
      ];
      for (const pattern of namePatterns) {
        const match = transcript.match(pattern);
        if (match) { extractedData.name = match[1]; break; }
      }
      const companyPatterns = [
        /(?:with|from|at|represent(?:ing)?)\s+([A-Z][A-Za-z\s&.']+?)(?:\.|,|$|\s+(?:and|we|i|they|our))/i,
      ];
      for (const pattern of companyPatterns) {
        const match = transcript.match(pattern);
        if (match && match[1].trim().length > 2) { extractedData.company = match[1].trim(); break; }
      }

      const [inserted] = await db.insert(captureSessionItems).values({
        sessionId,
        itemType: "contact_data",
        status: "extracted",
        rawInput: { audioBase64: "[stored]", transcript },
        extractedData,
      }).returning();

      await db.update(captureSessions).set({
        totalItems: session.totalItems + 1,
        updatedAt: new Date(),
      }).where(eq(captureSessions.id, sessionId));

      res.status(201).json({ item: inserted, transcript });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[CaptureSession] Voice item error:", msg);
      res.status(500).json({ error: "Voice transcription failed" });
    }
  });

  app.post("/api/capture-sessions/:id/items/bulk-text", requireAdmin, async (req: Request, res: Response) => {
    try {
      const sessionId = String(req.params.id);
      const [session] = await db.select().from(captureSessions).where(eq(captureSessions.id, sessionId)).limit(1);
      if (!session) return res.status(404).json({ error: "Session not found" });
      if (!(await isAdminUser(req)) && session.operatorId !== getActorId(req)) return res.status(403).json({ error: "Access denied" });
      if (session.status !== "open" && session.status !== "uploading") {
        return res.status(400).json({ error: "Session is not accepting new items" });
      }

      const { text } = req.body;
      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "text is required" });
      }

      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      const parsed = lines.map(parseBulkTextLine).filter((p): p is Record<string, string> => p !== null);

      if (parsed.length === 0) {
        return res.status(400).json({ error: "No valid entries found in text" });
      }

      const insertedItems = [];
      for (const data of parsed) {
        const [inserted] = await db.insert(captureSessionItems).values({
          sessionId,
          itemType: "contact_data",
          status: "pending",
          rawInput: data,
          extractedData: data,
        }).returning();
        insertedItems.push(inserted);
      }

      await db.update(captureSessions).set({
        totalItems: session.totalItems + insertedItems.length,
        updatedAt: new Date(),
      }).where(eq(captureSessions.id, sessionId));

      res.status(201).json({
        items: insertedItems,
        parsed: parsed.length,
        skipped: lines.length - parsed.length,
        totalItems: session.totalItems + insertedItems.length,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[CaptureSession] Bulk text error:", msg);
      res.status(500).json({ error: "Bulk text processing failed" });
    }
  });

  app.delete("/api/capture-sessions/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const [session] = await db.select().from(captureSessions).where(eq(captureSessions.id, String(req.params.id))).limit(1);
      if (!session) return res.status(404).json({ error: "Session not found" });
      if (!(await isAdminUser(req)) && session.operatorId !== getActorId(req)) return res.status(403).json({ error: "Access denied" });

      await db.delete(captureSessionItems).where(eq(captureSessionItems.sessionId, session.id));
      await db.delete(captureSessions).where(eq(captureSessions.id, session.id));

      res.json({ deleted: true });
    } catch (err: any) {
      console.error("[CaptureSession] Delete error:", err.message);
      res.status(500).json({ error: "Delete failed" });
    }
  });
}
