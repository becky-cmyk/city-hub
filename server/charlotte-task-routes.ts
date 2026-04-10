import { Router, type RequestHandler } from "express";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";
import { charlotteTasks, charlotteMemory } from "@shared/schema";
import type { CharlotteTask, InsertCharlotteTask } from "@shared/schema";
import { recordMemory, getRecentAdminMemory } from "./services/charlotte-memory-service";

export function registerCharlotteTaskRoutes(app: Router, requireAdmin?: RequestHandler) {
  const adminGuard: RequestHandler[] = requireAdmin ? [requireAdmin] : [];

  app.get("/api/admin/charlotte/tasks", ...adminGuard, async (req, res) => {
    try {
      const { status, type, limit: limitStr } = req.query;
      const limitNum = Math.min(parseInt(limitStr as string) || 50, 100);

      let query = db
        .select()
        .from(charlotteTasks)
        .orderBy(desc(charlotteTasks.createdAt))
        .limit(limitNum);

      const conditions = [];
      if (status && status !== "all") {
        conditions.push(eq(charlotteTasks.status, status as any));
      }
      if (type && type !== "all") {
        conditions.push(eq(charlotteTasks.type, type as any));
      }

      if (conditions.length > 0) {
        query = db
          .select()
          .from(charlotteTasks)
          .where(and(...conditions))
          .orderBy(desc(charlotteTasks.createdAt))
          .limit(limitNum);
      }

      const tasks = await query;
      res.json(tasks);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown";
      res.status(500).json({ error: msg });
    }
  });

  app.get("/api/admin/charlotte/tasks/summary/stats", ...adminGuard, async (req, res) => {
    try {
      const rows = await db.execute(sql`
        SELECT status, COUNT(*)::int as count 
        FROM charlotte_tasks 
        GROUP BY status
      `);
      const stats: Record<string, number> = {};
      for (const row of rows.rows) {
        stats[row.status as string] = row.count as number;
      }
      res.json(stats);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown";
      res.status(500).json({ error: msg });
    }
  });

  app.get("/api/admin/charlotte/tasks/:id", ...adminGuard, async (req, res) => {
    try {
      const [task] = await db
        .select()
        .from(charlotteTasks)
        .where(eq(charlotteTasks.id, req.params.id));
      if (!task) return res.status(404).json({ error: "Task not found" });
      res.json(task);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown";
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/admin/charlotte/tasks", ...adminGuard, async (req, res) => {
    try {
      const { type, title, payload, proposedPlan, status } = req.body;
      if (!title) return res.status(400).json({ error: "title is required" });

      const [task] = await db.insert(charlotteTasks).values({
        type: type || "general",
        title,
        payload: payload || {},
        proposedPlan: proposedPlan || null,
        status: status || "awaiting_approval",
        source: "charlotte",
      }).returning();

      res.json(task);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown";
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/admin/charlotte/tasks/:id/approve", ...adminGuard, async (req, res) => {
    try {
      const [task] = await db
        .select()
        .from(charlotteTasks)
        .where(eq(charlotteTasks.id, req.params.id));

      if (!task) return res.status(404).json({ error: "Task not found" });
      if (task.status !== "awaiting_approval") {
        return res.status(400).json({ error: `Task is ${task.status}, not awaiting approval` });
      }

      const [updated] = await db.update(charlotteTasks)
        .set({
          status: "pending",
          approvedAt: new Date(),
          operatorFeedback: req.body?.feedback || null,
          updatedAt: new Date(),
        })
        .where(eq(charlotteTasks.id, req.params.id))
        .returning();

      await recordMemory({
        scope: "admin_ops",
        type: "context_note",
        content: `Approved task: "${task.title}"`,
        referenceId: task.id,
      });

      res.json(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown";
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/admin/charlotte/tasks/:id/reject", ...adminGuard, async (req, res) => {
    try {
      const [task] = await db
        .select()
        .from(charlotteTasks)
        .where(eq(charlotteTasks.id, req.params.id));

      if (!task) return res.status(404).json({ error: "Task not found" });

      const [updated] = await db.update(charlotteTasks)
        .set({
          status: "cancelled",
          operatorFeedback: req.body?.feedback || "Rejected by operator",
          updatedAt: new Date(),
        })
        .where(eq(charlotteTasks.id, req.params.id))
        .returning();

      res.json(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown";
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/admin/charlotte/tasks/:id/retry", ...adminGuard, async (req, res) => {
    try {
      const [task] = await db
        .select()
        .from(charlotteTasks)
        .where(eq(charlotteTasks.id, req.params.id));

      if (!task) return res.status(404).json({ error: "Task not found" });
      if (task.status !== "failed") {
        return res.status(400).json({ error: `Can only retry failed tasks, this is ${task.status}` });
      }

      const [updated] = await db.update(charlotteTasks)
        .set({
          status: "pending",
          error: null,
          progress: 0,
          updatedAt: new Date(),
        })
        .where(eq(charlotteTasks.id, req.params.id))
        .returning();

      res.json(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown";
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/admin/charlotte/tasks/:id/feedback", ...adminGuard, async (req, res) => {
    try {
      const { feedback } = req.body;
      if (!feedback) return res.status(400).json({ error: "feedback is required" });

      const [task] = await db
        .select()
        .from(charlotteTasks)
        .where(eq(charlotteTasks.id, req.params.id));

      if (!task) return res.status(404).json({ error: "Task not found" });

      const [updated] = await db.update(charlotteTasks)
        .set({
          operatorFeedback: feedback,
          updatedAt: new Date(),
        })
        .where(eq(charlotteTasks.id, req.params.id))
        .returning();

      res.json(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown";
      res.status(500).json({ error: msg });
    }
  });

  app.delete("/api/admin/charlotte/tasks/:id", ...adminGuard, async (req, res) => {
    try {
      const [task] = await db
        .select()
        .from(charlotteTasks)
        .where(eq(charlotteTasks.id, req.params.id));

      if (!task) return res.status(404).json({ error: "Task not found" });
      if (task.status === "running" || task.status === "pending") {
        return res.status(400).json({ error: "Cannot delete a running or pending task" });
      }

      await db.delete(charlotteTasks).where(eq(charlotteTasks.id, req.params.id));
      res.json({ success: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown";
      res.status(500).json({ error: msg });
    }
  });

  app.get("/api/admin/charlotte/memory", ...adminGuard, async (req, res) => {
    try {
      const limitNum = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const withinDays = parseInt(req.query.days as string) || 7;
      const memories = await getRecentAdminMemory(limitNum, withinDays);
      res.json(memories);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown";
      res.status(500).json({ error: msg });
    }
  });
}

export async function createCharlotteTask(input: {
  type: InsertCharlotteTask["type"];
  title: string;
  payload?: Record<string, unknown>;
  proposedPlan?: { steps: { description: string; engine?: string }[] };
  status?: string;
}): Promise<CharlotteTask> {
  const [task] = await db.insert(charlotteTasks).values({
    type: input.type,
    title: input.title,
    payload: input.payload || {},
    proposedPlan: input.proposedPlan || null,
    status: (input.status as any) || "awaiting_approval",
    source: "charlotte",
  }).returning();
  return task;
}
