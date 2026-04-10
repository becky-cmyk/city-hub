import type { Express, Request, Response } from "express";
import { db } from "./db";
import { expertShowSlots, businesses, cities } from "@shared/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { z } from "zod";

const createExpertShowSchema = z.object({
  businessId: z.string().optional().nullable(),
  cityId: z.string(),
  expertName: z.string().min(1),
  showTitle: z.string().min(1),
  showDescription: z.string().optional().nullable(),
  dayOfWeek: z.array(z.string()).default([]),
  startTime: z.string().default("12:00"),
  durationMinutes: z.number().int().min(5).max(120).default(15),
  segmentType: z.enum(["real_estate_update", "health_tips", "small_business_strategy", "restaurant_highlights", "general"]).default("general"),
  status: z.enum(["pending", "active", "cancelled"]).default("pending"),
  pricePerEpisodeCents: z.number().int().min(0).default(0),
  hubSlug: z.string().optional().nullable(),
  thumbnailUrl: z.string().optional().nullable(),
});

const updateExpertShowSchema = createExpertShowSchema.partial();

export function registerExpertShowRoutes(app: Express, requireAdmin: any) {
  app.get("/api/admin/expert-shows", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const slots = await db.select().from(expertShowSlots).orderBy(desc(expertShowSlots.createdAt));
      const enriched = await Promise.all(slots.map(async (slot) => {
        let businessName = null;
        if (slot.businessId) {
          const [biz] = await db.select({ name: businesses.name }).from(businesses).where(eq(businesses.id, slot.businessId)).limit(1);
          businessName = biz?.name || null;
        }
        return { ...slot, businessName };
      }));
      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/expert-shows", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = createExpertShowSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      }
      const [created] = await db.insert(expertShowSlots).values(parsed.data).returning();
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/expert-shows/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = updateExpertShowSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      }
      const [updated] = await db.update(expertShowSlots)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(expertShowSlots.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Expert show slot not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/expert-shows/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const [deleted] = await db.delete(expertShowSlots)
        .where(eq(expertShowSlots.id, req.params.id))
        .returning();
      if (!deleted) return res.status(404).json({ message: "Expert show slot not found" });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/owner/expert-shows/request", async (req: Request, res: Response) => {
    try {
      const ownerEntityId = (req.session as any).ownerEntityId;
      if (!ownerEntityId) {
        return res.status(401).json({ message: "Unauthorized — owner login required" });
      }

      const [biz] = await db.select().from(businesses).where(eq(businesses.id, ownerEntityId)).limit(1);
      if (!biz) return res.status(404).json({ message: "Business not found" });

      const { expertName, showTitle, showDescription, dayOfWeek, startTime, durationMinutes, segmentType } = req.body;
      if (!expertName || !showTitle) {
        return res.status(400).json({ message: "Expert name and show title are required" });
      }

      const [created] = await db.insert(expertShowSlots).values({
        businessId: ownerEntityId,
        cityId: biz.cityId,
        expertName,
        showTitle,
        showDescription: showDescription || null,
        dayOfWeek: dayOfWeek || [],
        startTime: startTime || "12:00",
        durationMinutes: durationMinutes || 15,
        segmentType: segmentType || "general",
        status: "pending",
        pricePerEpisodeCents: 0,
      }).returning();

      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/owner/expert-shows", async (req: Request, res: Response) => {
    try {
      const ownerEntityId = (req.session as any).ownerEntityId;
      if (!ownerEntityId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const slots = await db.select().from(expertShowSlots)
        .where(eq(expertShowSlots.businessId, ownerEntityId))
        .orderBy(desc(expertShowSlots.createdAt));
      res.json(slots);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
