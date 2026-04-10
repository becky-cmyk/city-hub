import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { updateInboxItemWithHistory, getTriageCounts, resolveInboxItem } from "./admin-inbox";
import { insertAdminInboxItemSchema, insertAdminInboxCommentSchema, captureSessionItems } from "@shared/schema";
import { pool } from "./db";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { prepareCaptureForQueue, enqueueCaptureAction } from "./capture-session-routes";
import { getCommandCenterOperationsOverview } from "./charlotte-ops-center";

export interface UnifiedInboxItem {
  id: string;
  source: "inbox" | "charlotte_ops" | "charlotte_tasks";
  category: "all" | "needs_review" | "charlotte_updates" | "tasks" | "exceptions" | "notifications";
  itemType: string;
  title: string;
  summary: string | null;
  priority: string;
  status: string;
  createdAt: string;
  readAt: string | null;
  isUnread: boolean;
  relatedTable: string | null;
  relatedId: string | null;
  tags: string[] | null;
  confidence: string | null;
  triageReason: string | null;
  suggestedAction: string | null;
  triageMetadata: Record<string, unknown> | null;
  triageCategory: string | null;
  dueAt: string | null;
  resolvedAt: string | null;
  visibility: string;
  assignedToUserId: string | null;
  createdByUserId: string | null;
  opsMetadata?: Record<string, unknown>;
  taskProgress?: number;
  taskProposedPlan?: { steps: { description: string; engine?: string }[] } | null;
  taskResult?: Record<string, unknown> | null;
  taskError?: string | null;
  opsEntityId?: string | null;
  opsEntityName?: string | null;
  opsSource?: string;
  opsQueueSection?: string;
  opsActionId?: string;
  hubId?: string | null;
  hubName?: string | null;
}

export function registerInboxRoutes(app: Express, requireAdmin: any) {
  app.get("/api/admin/inbox", requireAdmin, async (req: Request, res: Response) => {
    try {
      const items = await storage.getInboxItems({
        status: req.query.status as string | undefined,
        priority: req.query.priority as string | undefined,
        itemType: req.query.itemType as string | undefined,
        assignedToUserId: req.query.assignedToUserId as string | undefined,
        overdue: req.query.overdue === "true",
        tag: req.query.tag as string | undefined,
        q: req.query.q as string | undefined,
        triageCategory: req.query.triageCategory as string | undefined,
      });
      res.json(items);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/inbox/count", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const count = await storage.getInboxOpenCount();
      res.json({ count });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/inbox/triage-counts", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const counts = await getTriageCounts();
      res.json(counts);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/inbox/unified", requireAdmin, async (req: Request, res: Response) => {
    try {
      const categoryFilter = req.query.category as string | undefined;
      const searchQ = req.query.q as string | undefined;
      const priorityFilter = req.query.priority as string | undefined;
      const statusFilter = req.query.status as string | undefined;
      const sourceFilter = req.query.source as string | undefined;
      const hubIdFilter = req.query.hubId as string | undefined;
      const cityIdFilter = req.query.cityId as string | undefined;

      const items: UnifiedInboxItem[] = [];

      const inboxFilters: { status?: string; statuses?: string[]; priority?: string; q?: string } = {};
      if (statusFilter === "archived") {
        inboxFilters.statuses = ["resolved", "closed"];
      } else if (statusFilter && statusFilter !== "open" && statusFilter !== "all") {
        inboxFilters.status = statusFilter;
      }
      if (priorityFilter && priorityFilter !== "all") inboxFilters.priority = priorityFilter;
      if (searchQ) inboxFilters.q = searchQ;

      const inboxItems = await storage.getInboxItems(inboxFilters);

      for (const inbox of inboxItems) {
        let category: UnifiedInboxItem["category"] = "notifications";
        if (inbox.triageCategory === "needs_review") category = "needs_review";
        else if (inbox.triageCategory === "exception") category = "exceptions";
        else if (inbox.triageCategory === "notification") category = "notifications";
        else if (inbox.triageCategory === "unprocessed") category = "needs_review";

        items.push({
          id: `inbox:${inbox.id}`,
          source: "inbox",
          category,
          itemType: inbox.itemType,
          title: inbox.title,
          summary: inbox.summary,
          priority: inbox.priority,
          status: inbox.status,
          createdAt: typeof inbox.createdAt === "string" ? inbox.createdAt : inbox.createdAt?.toISOString?.() || new Date().toISOString(),
          readAt: inbox.readAt ? (typeof inbox.readAt === "string" ? inbox.readAt : inbox.readAt?.toISOString?.() || null) : null,
          isUnread: !inbox.readAt,
          relatedTable: inbox.relatedTable,
          relatedId: inbox.relatedId,
          tags: inbox.tags,
          confidence: inbox.confidence,
          triageReason: inbox.triageReason,
          suggestedAction: inbox.suggestedAction,
          triageMetadata: inbox.triageMetadata as Record<string, unknown> | null,
          triageCategory: inbox.triageCategory,
          dueAt: inbox.dueAt ? (typeof inbox.dueAt === "string" ? inbox.dueAt : inbox.dueAt?.toISOString?.() || null) : null,
          resolvedAt: inbox.resolvedAt ? (typeof inbox.resolvedAt === "string" ? inbox.resolvedAt : inbox.resolvedAt?.toISOString?.() || null) : null,
          visibility: inbox.visibility,
          assignedToUserId: inbox.assignedToUserId,
          createdByUserId: inbox.createdByUserId,
        });
      }

      try {
        const opsOverview = await getCommandCenterOperationsOverview();
        const allOpsItems = [
          ...opsOverview.actionQueue.map(i => ({ ...i, queueSection: "action" })),
          ...opsOverview.reviewQueue.filter(i => !i.id.startsWith("inbox:")).map(i => ({ ...i, queueSection: "review" })),
          ...opsOverview.followUps.map(i => ({ ...i, queueSection: "followup" })),
        ];

        for (const opsItem of allOpsItems) {
          const existsInInbox = items.some(i => i.source === "inbox" && i.id === `inbox:${opsItem.id.split(":")[1]}`);
          if (existsInInbox) continue;

          items.push({
            id: `ops:${opsItem.id}`,
            source: "charlotte_ops",
            category: "charlotte_updates",
            itemType: opsItem.type,
            title: opsItem.title,
            summary: opsItem.summary,
            priority: opsItem.priority === "high" ? "high" : opsItem.priority === "low" ? "low" : "med",
            status: "open",
            createdAt: opsItem.createdAt,
            readAt: null,
            isUnread: true,
            relatedTable: null,
            relatedId: null,
            tags: null,
            confidence: null,
            triageReason: null,
            suggestedAction: null,
            triageMetadata: null,
            triageCategory: null,
            dueAt: null,
            resolvedAt: null,
            visibility: "admin_only",
            assignedToUserId: null,
            createdByUserId: null,
            opsMetadata: opsItem.metadata,
            opsEntityId: opsItem.entityId,
            opsEntityName: opsItem.entityName,
            opsSource: opsItem.source,
            opsQueueSection: (opsItem as { queueSection: string }).queueSection,
            opsActionId: opsItem.id,
          });
        }
      } catch (e) {
        console.error("[UnifiedInbox] Failed to fetch ops items:", e);
      }

      try {
        const tasksRes = await pool.query(
          `SELECT id, type, title, status, payload, proposed_plan, result, error, progress,
                  operator_feedback, created_at, started_at, completed_at, retry_count
           FROM charlotte_tasks
           ORDER BY created_at DESC
           LIMIT 50`
        );

        for (const task of tasksRes.rows) {
          const taskStatus = task.status || "pending";
          let priority = "med";
          if (taskStatus === "awaiting_approval") priority = "high";
          else if (taskStatus === "failed") priority = "high";

          items.push({
            id: `task:${task.id}`,
            source: "charlotte_tasks",
            category: "tasks",
            itemType: task.type || "general",
            title: task.title,
            summary: taskStatus === "running" ? `Running... ${task.progress || 0}% complete` :
                     taskStatus === "failed" ? `Failed: ${task.error || "Unknown error"}` :
                     taskStatus === "completed" ? "Task completed" :
                     taskStatus === "awaiting_approval" ? "Awaiting your approval" :
                     `Status: ${taskStatus}`,
            priority,
            status: taskStatus === "completed" ? "resolved" : taskStatus === "cancelled" ? "closed" : "open",
            createdAt: task.created_at?.toISOString?.() || new Date().toISOString(),
            readAt: null,
            isUnread: ["awaiting_approval", "failed"].includes(taskStatus),
            relatedTable: null,
            relatedId: null,
            tags: [task.type].filter(Boolean),
            confidence: null,
            triageReason: null,
            suggestedAction: null,
            triageMetadata: { taskId: task.id, taskStatus },
            triageCategory: null,
            dueAt: null,
            resolvedAt: task.completed_at?.toISOString?.() || null,
            visibility: "admin_only",
            assignedToUserId: null,
            createdByUserId: null,
            taskProgress: task.progress || 0,
            taskProposedPlan: task.proposed_plan,
            taskResult: task.result,
            taskError: task.error,
          });
        }
      } catch (e) {
        console.error("[UnifiedInbox] Failed to fetch task items:", e);
      }

      if (hubIdFilter || cityIdFilter) {
        const businessRelatedIds = items
          .filter(i => i.relatedTable === "businesses" && i.relatedId)
          .map(i => i.relatedId!);
        const opsEntityIds = items
          .filter(i => i.source === "charlotte_ops" && i.opsEntityId)
          .map(i => i.opsEntityId!);
        const allBizIds = [...new Set([...businessRelatedIds, ...opsEntityIds])];

        if (allBizIds.length > 0) {
          try {
            const bizRes = await pool.query(
              `SELECT b.id, b.hub_id, b.city_id, h.name as hub_name
               FROM businesses b
               LEFT JOIN hub_regions h ON h.id = b.hub_id
               WHERE b.id = ANY($1::text[])`,
              [allBizIds]
            );
            const bizMap = new Map<string, { hubId: string | null; hubName: string; cityId: string | null }>();
            for (const row of bizRes.rows) {
              bizMap.set(row.id, { hubId: row.hub_id, hubName: row.hub_name || "", cityId: row.city_id });
            }
            for (const item of items) {
              const bizId = item.relatedTable === "businesses" ? item.relatedId : item.opsEntityId;
              if (bizId && bizMap.has(bizId)) {
                const biz = bizMap.get(bizId)!;
                if (biz.hubId) {
                  item.hubId = biz.hubId;
                  item.hubName = biz.hubName;
                }
              }
            }
          } catch (e) {
            console.error("[UnifiedInbox] Failed to enrich hub/city data:", e);
          }
        }
      }

      let filtered = items;

      if (hubIdFilter) {
        filtered = filtered.filter(i => i.hubId === hubIdFilter);
      }
      if (cityIdFilter) {
        const bizIdsForCity = new Set<string>();
        try {
          const cityBizRes = await pool.query(
            `SELECT id FROM businesses WHERE city_id = $1`,
            [cityIdFilter]
          );
          for (const row of cityBizRes.rows) bizIdsForCity.add(row.id);
        } catch (e) {
          console.error("[UnifiedInbox] Failed to fetch city businesses:", e);
        }
        if (bizIdsForCity.size > 0) {
          filtered = filtered.filter(i => {
            const bizId = i.relatedTable === "businesses" ? i.relatedId : i.opsEntityId;
            return bizId ? bizIdsForCity.has(bizId) : false;
          });
        }
      }
      if (categoryFilter && categoryFilter !== "all") {
        filtered = filtered.filter(i => i.category === categoryFilter);
      }
      if (sourceFilter && sourceFilter !== "all") {
        filtered = filtered.filter(i => i.source === sourceFilter);
      }
      if (statusFilter && statusFilter !== "all") {
        if (statusFilter === "open") {
          filtered = filtered.filter(i => !["resolved", "closed"].includes(i.status));
        } else if (statusFilter === "archived") {
          filtered = filtered.filter(i => ["resolved", "closed"].includes(i.status));
        } else {
          filtered = filtered.filter(i => i.status === statusFilter);
        }
      }
      if (priorityFilter && priorityFilter !== "all") {
        filtered = filtered.filter(i => i.priority === priorityFilter);
      }
      if (searchQ) {
        const q = searchQ.toLowerCase();
        filtered = filtered.filter(i =>
          i.title.toLowerCase().includes(q) ||
          (i.summary || "").toLowerCase().includes(q) ||
          (i.opsEntityName || "").toLowerCase().includes(q)
        );
      }

      const priorityOrder: Record<string, number> = { urgent: 0, high: 1, med: 2, low: 3 };
      filtered.sort((a, b) => {
        if (a.isUnread && !b.isUnread) return -1;
        if (!a.isUnread && b.isUnread) return 1;
        const pDiff = (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
        if (pDiff !== 0) return pDiff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      const counts = {
        all: items.filter(i => !["resolved", "closed"].includes(i.status)).length,
        needs_review: items.filter(i => i.category === "needs_review" && !["resolved", "closed"].includes(i.status)).length,
        charlotte_updates: items.filter(i => i.category === "charlotte_updates" && !["resolved", "closed"].includes(i.status)).length,
        tasks: items.filter(i => i.category === "tasks" && !["resolved", "closed"].includes(i.status)).length,
        exceptions: items.filter(i => i.category === "exceptions" && !["resolved", "closed"].includes(i.status)).length,
        notifications: items.filter(i => i.category === "notifications" && !["resolved", "closed"].includes(i.status)).length,
        archived: items.filter(i => ["resolved", "closed"].includes(i.status)).length,
      };

      res.json({ items: filtered, counts });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.get("/api/admin/inbox/unified/count", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const openCount = await storage.getInboxOpenCount();

      let taskCount = 0;
      try {
        const taskRes = await pool.query(
          `SELECT COUNT(*) as cnt FROM charlotte_tasks WHERE status IN ('awaiting_approval', 'pending', 'running')`
        );
        taskCount = parseInt(taskRes.rows[0]?.cnt || "0");
      } catch (e) {
        console.error("[UnifiedInbox] Failed to fetch task count:", e);
      }

      let opsCount = 0;
      try {
        const opsOverview = await getCommandCenterOperationsOverview();
        opsCount = opsOverview.actionQueue.length
          + opsOverview.reviewQueue.filter(i => !i.id.startsWith("inbox:")).length
          + opsOverview.followUps.length;
      } catch (e) {
        console.error("[UnifiedInbox] Failed to fetch ops count:", e);
      }

      res.json({ count: openCount + taskCount + opsCount });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.get("/api/admin/inbox/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const item = await storage.getInboxItemById(req.params.id as string);
      if (!item) return res.status(404).json({ message: "Not found" });
      const comments = await storage.getInboxComments(item.id);
      const history = await storage.getInboxHistory(item.id);
      const links = await storage.getInboxLinks(item.id);
      res.json({ item, comments, history, links });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/inbox/:id/read", requireAdmin, async (req: Request, res: Response) => {
    try {
      const item = await storage.markInboxItemRead(req.params.id as string);
      if (!item) {
        const existing = await storage.getInboxItemById(req.params.id as string);
        if (!existing) return res.status(404).json({ message: "Not found" });
        return res.json(existing);
      }
      res.json(item);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/inbox", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = insertAdminInboxItemSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
      const data = { ...parsed.data, createdByUserId: (req.session as any).userId };
      const item = await storage.createInboxItem(data);
      await storage.createInboxHistory({
        inboxItemId: item.id,
        actorType: "admin",
        actorUserId: (req.session as any).userId,
        fieldName: "status",
        oldValue: null,
        newValue: "open",
        reason: "Manually created",
      });
      res.json(item);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/admin/inbox/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = insertAdminInboxItemSchema.partial().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
      const item = await updateInboxItemWithHistory(
        req.params.id as string,
        parsed.data,
        "admin",
        (req.session as any).userId,
        req.body.reason
      );
      if (!item) return res.status(404).json({ message: "Not found" });
      res.json(item);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/inbox/:id/assign-me", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      const item = await updateInboxItemWithHistory(
        req.params.id as string,
        { assignedToUserId: userId },
        "admin",
        userId,
        "Self-assigned"
      );
      if (!item) return res.status(404).json({ message: "Not found" });
      res.json(item);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/inbox/:id/approve", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      const item = await storage.getInboxItemById(req.params.id);
      if (!item) return res.status(404).json({ message: "Not found" });

      let queueItem = null;
      const meta = (item.triageMetadata || {}) as Record<string, unknown>;
      if (meta.captureItemId) {
        const captureItemResult = await pool.query(
          `SELECT id, session_id, matched_entity_id, matched_entity_type, matched_entity_name,
                  match_confidence, is_existing_entity, extracted_data, proposed_actions
           FROM capture_session_items WHERE id = $1`,
          [meta.captureItemId]
        );
        if (captureItemResult.rows.length > 0) {
          const row = captureItemResult.rows[0];
          const selectedEntityId = req.body.selectedEntityId || row.matched_entity_id;
          const isCreateNew = req.body.action === "create_new" || (!selectedEntityId && !row.matched_entity_id);
          queueItem = prepareCaptureForQueue({
            id: row.id,
            sessionId: row.session_id,
            matchedEntityId: selectedEntityId,
            matchedEntityType: row.matched_entity_type,
            matchedEntityName: req.body.selectedEntityName || row.matched_entity_name,
            matchConfidence: selectedEntityId ? "HIGH" : row.match_confidence,
            isExistingEntity: selectedEntityId ? true : false,
            extractedData: row.extracted_data,
            proposedActions: isCreateNew ? ["create_listing_and_outreach"] : row.proposed_actions,
          });
        }
      }

      let queueId = null;
      if (queueItem) {
        queueId = await enqueueCaptureAction(queueItem, item.id);
      }

      let forwardAction: string | null = null;
      if (!queueItem) {
        if (item.suggestedAction) {
          forwardAction = item.suggestedAction;
        } else if (item.itemType === "story_interview_scheduled") {
          forwardAction = "proceed_with_interview";
        } else {
          forwardAction = "acknowledged";
        }
      }

      const resolved = await resolveInboxItem(item.id, "approved", userId, req.body.reason || "Approved via triage");

      res.json({ item: resolved, queueItem, queueId, forwardAction });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/inbox/:id/dismiss", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      const item = await resolveInboxItem(req.params.id, "dismissed", userId, req.body.reason || "Dismissed via triage");
      if (!item) return res.status(404).json({ message: "Not found" });
      res.json(item);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/inbox/:id/reprocess", requireAdmin, async (req: Request, res: Response) => {
    try {
      const item = await storage.getInboxItemById(req.params.id);
      if (!item) return res.status(404).json({ message: "Not found" });

      const meta = (item.triageMetadata || {}) as Record<string, unknown>;
      if (!meta.captureItemId) {
        return res.status(400).json({ message: "No capture item linked to this inbox item" });
      }

      const userId = (req.session as any).userId;
      await updateInboxItemWithHistory(
        item.id,
        { status: "in_progress" },
        "admin",
        userId,
        "Reprocessing requested"
      );

      const captureItemResult = await pool.query(
        `SELECT id, session_id, extracted_data FROM capture_session_items WHERE id = $1`,
        [meta.captureItemId]
      );
      if (captureItemResult.rows.length === 0) {
        return res.status(404).json({ message: "Linked capture item not found" });
      }

      const captureRow = captureItemResult.rows[0];
      const extracted = captureRow.extracted_data || {};
      const sessionResult = await pool.query(`SELECT hub_id FROM capture_sessions WHERE id = $1`, [captureRow.session_id]);
      const hubId = sessionResult.rows[0]?.hub_id;

      const { resolveEntities } = await import("./charlotte-orchestrator");
      const company = extracted.company?.trim();
      let resolution = { entityId: null as string | null, entityType: null as string | null, entityName: null as string | null, confidence: "LOW", isExisting: false };

      if (company) {
        const ref = { rawText: company, entityType: "business" as const, identifiers: { name: company, phone: extracted.phone, email: extracted.email } };
        const resolved = await resolveEntities([ref], hubId);
        if (resolved.length > 0 && resolved[0].entityId) {
          resolution = { entityId: resolved[0].entityId, entityType: "business", entityName: resolved[0].name, confidence: resolved[0].confidence, isExisting: true };
        }
      }

      await db.update(captureSessionItems).set({
        matchedEntityId: resolution.entityId,
        matchedEntityType: resolution.entityType,
        matchedEntityName: resolution.entityName,
        matchConfidence: resolution.confidence,
        isExistingEntity: resolution.isExisting,
        status: resolution.entityId ? "matched" : "unmatched",
        processingError: null,
      }).where(eq(captureSessionItems.id, captureRow.id));

      if (resolution.confidence === "HIGH" && resolution.entityId) {
        const queueItem = prepareCaptureForQueue({
          id: captureRow.id,
          sessionId: captureRow.session_id,
          matchedEntityId: resolution.entityId,
          matchedEntityType: resolution.entityType,
          matchedEntityName: resolution.entityName,
          matchConfidence: resolution.confidence,
          isExistingEntity: resolution.isExisting,
          extractedData: extracted,
          proposedActions: null,
        });
        const queueId = await enqueueCaptureAction(queueItem, item.id);
        const resolved = await resolveInboxItem(item.id, "approved", userId, `Reprocessed: HIGH confidence match to ${resolution.entityName}`);
        res.json({ message: "Reprocessed and auto-approved", item: resolved, queueId });
      } else {
        const confNum = resolution.confidence === "HIGH" ? 0.9 : resolution.confidence === "MEDIUM" ? 0.5 : 0.2;
        await updateInboxItemWithHistory(
          item.id,
          {
            status: "open",
            confidence: String(confNum),
            triageReason: resolution.entityId
              ? `Re-resolved: ${resolution.confidence} confidence match`
              : "Re-resolved: no entity match found",
            suggestedAction: resolution.entityId ? "verify_and_followup" : "create_listing_and_outreach",
          },
          "system",
          userId,
          "Reprocessing completed — returned to triage"
        );
        res.json({ message: "Reprocessed — returned to triage for review", captureItemId: meta.captureItemId });
      }
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/inbox/:id/resolve-entity", requireAdmin, async (req: Request, res: Response) => {
    try {
      const item = await storage.getInboxItemById(req.params.id);
      if (!item) return res.status(404).json({ message: "Not found" });

      const { action, selectedEntityId, selectedEntityName } = req.body;
      if (!action) return res.status(400).json({ message: "action is required" });

      const userId = (req.session as any).userId;
      const meta = (item.triageMetadata || {}) as Record<string, unknown>;

      if (action === "select_match" && selectedEntityId) {
        if (meta.captureItemId) {
          await pool.query(
            `UPDATE capture_session_items SET matched_entity_id = $1, matched_entity_name = $2, match_confidence = 'HIGH', is_existing_entity = true WHERE id = $3`,
            [selectedEntityId, selectedEntityName || null, meta.captureItemId]
          );
        }

        let queueItem = null;
        if (meta.captureItemId) {
          const captureRow = await pool.query(`SELECT * FROM capture_session_items WHERE id = $1`, [meta.captureItemId]);
          if (captureRow.rows.length > 0) {
            const row = captureRow.rows[0];
            queueItem = prepareCaptureForQueue({
              id: row.id,
              sessionId: row.session_id,
              matchedEntityId: selectedEntityId,
              matchedEntityType: row.matched_entity_type,
              matchedEntityName: selectedEntityName || row.matched_entity_name,
              matchConfidence: "HIGH",
              isExistingEntity: true,
              extractedData: row.extracted_data,
              proposedActions: row.proposed_actions,
            });
          }
        }

        let queueId = null;
        if (queueItem) {
          queueId = await enqueueCaptureAction(queueItem, item.id);
        }

        const resolved = await resolveInboxItem(item.id, "approved", userId, `Entity resolved: selected match ${selectedEntityName || selectedEntityId}`);

        res.json({ item: resolved, queueItem, queueId });
      } else if (action === "create_new") {
        if (meta.captureItemId) {
          await pool.query(
            `UPDATE capture_session_items SET match_confidence = 'HIGH', is_existing_entity = false WHERE id = $1`,
            [meta.captureItemId]
          );
        }

        let queueItem = null;
        if (meta.captureItemId) {
          const captureRow = await pool.query(`SELECT * FROM capture_session_items WHERE id = $1`, [meta.captureItemId]);
          if (captureRow.rows.length > 0) {
            const row = captureRow.rows[0];
            queueItem = prepareCaptureForQueue({
              id: row.id,
              sessionId: row.session_id,
              matchedEntityId: null,
              matchedEntityType: row.matched_entity_type,
              matchedEntityName: row.matched_entity_name,
              matchConfidence: "HIGH",
              isExistingEntity: false,
              extractedData: row.extracted_data,
              proposedActions: ["create_listing_and_outreach"],
            });
          }
        }

        let queueId = null;
        if (queueItem) {
          queueId = await enqueueCaptureAction(queueItem, item.id);
        }

        const resolved = await resolveInboxItem(item.id, "approved", userId, "Entity resolved: creating new entity");

        res.json({ item: resolved, queueItem, queueId });
      } else if (action === "edit") {
        await updateInboxItemWithHistory(
          item.id,
          { status: "in_progress" },
          "admin",
          userId,
          "Editing item data"
        );
        res.json({ item, action: "edit" });
      } else if (action === "merge") {
        if (!selectedEntityId) return res.status(400).json({ message: "selectedEntityId required for merge" });

        if (meta.captureItemId) {
          await pool.query(
            `UPDATE capture_session_items SET matched_entity_id = $1, matched_entity_name = $2, match_confidence = 'HIGH', is_existing_entity = true WHERE id = $3`,
            [selectedEntityId, selectedEntityName || null, meta.captureItemId]
          );
        }

        let queueItem = null;
        if (meta.captureItemId) {
          const captureRow = await pool.query(`SELECT * FROM capture_session_items WHERE id = $1`, [meta.captureItemId]);
          if (captureRow.rows.length > 0) {
            const row = captureRow.rows[0];
            queueItem = prepareCaptureForQueue({
              id: row.id,
              sessionId: row.session_id,
              matchedEntityId: selectedEntityId,
              matchedEntityType: row.matched_entity_type,
              matchedEntityName: selectedEntityName || row.matched_entity_name,
              matchConfidence: "HIGH",
              isExistingEntity: true,
              extractedData: row.extracted_data,
              proposedActions: ["merge_and_update"],
            });
          }
        }

        let queueId = null;
        if (queueItem) {
          queueId = await enqueueCaptureAction(queueItem, item.id);
        }

        const resolved = await resolveInboxItem(item.id, "approved", userId, `Merged with existing entity: ${selectedEntityName || selectedEntityId}`);

        res.json({ item: resolved, queueItem, queueId });
      } else {
        return res.status(400).json({ message: "Invalid action. Use 'select_match', 'create_new', 'edit', or 'merge'" });
      }
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/inbox/:id/comments", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = insertAdminInboxCommentSchema.omit({ inboxItemId: true }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
      const comment = await storage.createInboxComment({
        inboxItemId: req.params.id as string,
        actorUserId: (req.session as any).userId,
        commentText: parsed.data.commentText,
      });
      res.json(comment);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/inbox/:id/history", requireAdmin, async (req: Request, res: Response) => {
    try {
      const history = await storage.getInboxHistory(req.params.id as string);
      res.json(history);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/inbox/:id/links", requireAdmin, async (req: Request, res: Response) => {
    try {
      const links = await storage.getInboxLinks(req.params.id as string);
      res.json(links);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/inbox/:id/add-to-media-library", requireAdmin, async (req: Request, res: Response) => {
    try {
      const inboxItem = await storage.getInboxItemById(req.params.id);
      if (!inboxItem) return res.status(404).json({ error: "Inbox item not found" });
      if (inboxItem.itemType !== "stock_photo_capture") {
        return res.status(400).json({ error: "Only stock photo captures can be added to the media library" });
      }

      const meta = (inboxItem.triageMetadata || {}) as Record<string, any>;
      const photoUrls: string[] = meta.photoUrls || (meta.photoUrl ? [meta.photoUrl] : []);
      if (photoUrls.length === 0) return res.status(400).json({ error: "No photo URLs found in inbox item" });

      const tags = meta.stockTags
        ? (meta.stockTags as string).split(",").map((t: string) => t.trim()).filter(Boolean)
        : (inboxItem.tags || []);

      let hubSlug: string | null = null;
      const hubRef = meta.hubSlug || meta.hubId;
      if (hubRef) {
        const cities = await storage.getAllCities();
        const city = cities.find(c => c.id === hubRef || c.slug === hubRef);
        if (city) hubSlug = city.slug || null;
        else hubSlug = typeof hubRef === "string" ? hubRef : null;
      }

      const userId = (req.session as any).userId;
      const assetIds: string[] = [];

      for (let i = 0; i < photoUrls.length; i++) {
        const result = await pool.query(
          `INSERT INTO cms_assets (file_url, file_type, alt_text_en, uploaded_by_user_id, license_type, hub_slug, tags, status, hub_use_approved)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id`,
          [
            photoUrls[i],
            "image",
            meta.notes || `${inboxItem.title || "Stock photo"} (${i + 1}/${photoUrls.length})`,
            userId,
            "stock",
            hubSlug,
            tags.length > 0 ? tags : null,
            "approved",
            true,
          ]
        );
        assetIds.push(result.rows[0]?.id);
      }

      await storage.updateInboxItem(inboxItem.id, { status: "resolved" });

      res.json({ message: `${assetIds.length} photo${assetIds.length !== 1 ? "s" : ""} added to media library`, assetIds });
    } catch (e: any) {
      console.error("[INBOX] Add to media library error:", e);
      res.status(500).json({ error: e.message });
    }
  });
}
