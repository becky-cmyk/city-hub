import type { Express, Request, Response } from "express";
import { db } from "./db";
import { liveBroadcasts } from "@shared/schema";
import { eq, desc, sql, and, or } from "drizzle-orm";
import { z } from "zod";

const createBroadcastSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  hostName: z.string().optional().nullable(),
  streamUrl: z.string().optional().nullable(),
  status: z.enum(["scheduled", "live", "ended", "cancelled"]).default("scheduled"),
  broadcastType: z.enum(["interview", "event", "show", "breaking"]).default("interview"),
  thumbnailUrl: z.string().optional().nullable(),
  recordingUrl: z.string().optional().nullable(),
  viewerCount: z.number().int().min(0).default(0),
  cityId: z.string().optional().nullable(),
  hubSlug: z.string().optional().nullable(),
  scheduledStartAt: z.string().optional().nullable(),
  actualStartAt: z.string().optional().nullable(),
  endedAt: z.string().optional().nullable(),
});

const updateBroadcastSchema = createBroadcastSchema.partial();

export function registerLiveBroadcastRoutes(app: Express, requireAdmin: any) {
  app.get("/api/broadcasts", async (_req: Request, res: Response) => {
    try {
      const rows = await db.select().from(liveBroadcasts)
        .where(or(
          eq(liveBroadcasts.status, "live"),
          eq(liveBroadcasts.status, "scheduled")
        ))
        .orderBy(desc(liveBroadcasts.scheduledStartAt));
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/broadcasts/:id", async (req: Request, res: Response) => {
    try {
      const [broadcast] = await db.select().from(liveBroadcasts)
        .where(eq(liveBroadcasts.id, req.params.id))
        .limit(1);
      if (!broadcast) return res.status(404).json({ message: "Broadcast not found" });
      res.json(broadcast);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/broadcasts", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = createBroadcastSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      }
      const data = parsed.data;
      const [created] = await db.insert(liveBroadcasts).values({
        title: data.title,
        description: data.description || null,
        hostName: data.hostName || null,
        streamUrl: data.streamUrl || null,
        status: data.status,
        broadcastType: data.broadcastType,
        thumbnailUrl: data.thumbnailUrl || null,
        recordingUrl: data.recordingUrl || null,
        viewerCount: data.viewerCount,
        cityId: data.cityId || null,
        hubSlug: data.hubSlug || null,
        scheduledStartAt: data.scheduledStartAt ? new Date(data.scheduledStartAt) : null,
        actualStartAt: data.actualStartAt ? new Date(data.actualStartAt) : null,
        endedAt: data.endedAt ? new Date(data.endedAt) : null,
      }).returning();
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/broadcasts/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = updateBroadcastSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      }
      const data = parsed.data;
      const updateData: Record<string, any> = {};
      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.hostName !== undefined) updateData.hostName = data.hostName;
      if (data.streamUrl !== undefined) updateData.streamUrl = data.streamUrl;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.broadcastType !== undefined) updateData.broadcastType = data.broadcastType;
      if (data.thumbnailUrl !== undefined) updateData.thumbnailUrl = data.thumbnailUrl;
      if (data.recordingUrl !== undefined) updateData.recordingUrl = data.recordingUrl;
      if (data.viewerCount !== undefined) updateData.viewerCount = data.viewerCount;
      if (data.cityId !== undefined) updateData.cityId = data.cityId;
      if (data.hubSlug !== undefined) updateData.hubSlug = data.hubSlug;
      if (data.scheduledStartAt !== undefined) updateData.scheduledStartAt = data.scheduledStartAt ? new Date(data.scheduledStartAt) : null;
      if (data.actualStartAt !== undefined) updateData.actualStartAt = data.actualStartAt ? new Date(data.actualStartAt) : null;
      if (data.endedAt !== undefined) updateData.endedAt = data.endedAt ? new Date(data.endedAt) : null;

      const [updated] = await db.update(liveBroadcasts)
        .set(updateData)
        .where(eq(liveBroadcasts.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Broadcast not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/broadcasts/:id/go-live", requireAdmin, async (req: Request, res: Response) => {
    try {
      const [updated] = await db.update(liveBroadcasts)
        .set({
          status: "live",
          actualStartAt: new Date(),
        })
        .where(eq(liveBroadcasts.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Broadcast not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/broadcasts/:id/end", requireAdmin, async (req: Request, res: Response) => {
    try {
      const [updated] = await db.update(liveBroadcasts)
        .set({
          status: "ended",
          endedAt: new Date(),
        })
        .where(eq(liveBroadcasts.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Broadcast not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/broadcasts/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const [deleted] = await db.delete(liveBroadcasts)
        .where(eq(liveBroadcasts.id, req.params.id))
        .returning();
      if (!deleted) return res.status(404).json({ message: "Broadcast not found" });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/broadcasts/:id/recording", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { recordingUrl } = req.body;
      if (!recordingUrl) {
        return res.status(400).json({ message: "recordingUrl is required" });
      }
      const [updated] = await db.update(liveBroadcasts)
        .set({ recordingUrl })
        .where(eq(liveBroadcasts.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Broadcast not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/broadcasts", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const rows = await db.select().from(liveBroadcasts)
        .orderBy(desc(liveBroadcasts.createdAt));
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
