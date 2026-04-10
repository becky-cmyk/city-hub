import { Router, Request, Response } from "express";
import { db } from "./db";
import { profileBadges, insertProfileBadgeSchema } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export function registerBadgeRoutes(app: Router, requireAdmin: any) {
  app.get("/api/businesses/:id/badges", async (req: Request, res: Response) => {
    try {
      const rows = await db
        .select()
        .from(profileBadges)
        .where(
          and(
            eq(profileBadges.businessId, req.params.id),
            eq(profileBadges.enabled, true)
          )
        )
        .orderBy(profileBadges.displayOrder);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/businesses/:id/badges", requireAdmin, async (req: Request, res: Response) => {
    try {
      const rows = await db
        .select()
        .from(profileBadges)
        .where(eq(profileBadges.businessId, req.params.id))
        .orderBy(profileBadges.displayOrder);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/businesses/:id/badges", requireAdmin, async (req: Request, res: Response) => {
    try {
      const data = insertProfileBadgeSchema.parse({
        ...req.body,
        businessId: req.params.id,
      });

      const existing = await db
        .select()
        .from(profileBadges)
        .where(
          and(
            eq(profileBadges.businessId, req.params.id),
            eq(profileBadges.badgeType, data.badgeType)
          )
        );

      if (existing.length > 0) {
        const [updated] = await db
          .update(profileBadges)
          .set({ enabled: true, updatedAt: new Date() })
          .where(eq(profileBadges.id, existing[0].id))
          .returning();
        return res.json(updated);
      }

      const [badge] = await db.insert(profileBadges).values(data).returning();
      res.status(201).json(badge);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.patch("/api/admin/badges/:badgeId", requireAdmin, async (req: Request, res: Response) => {
    try {
      const updates: any = { updatedAt: new Date() };
      if (typeof req.body.enabled === "boolean") updates.enabled = req.body.enabled;
      if (typeof req.body.displayOrder === "number") updates.displayOrder = req.body.displayOrder;
      if (req.body.metadata) updates.metadata = req.body.metadata;

      const [updated] = await db
        .update(profileBadges)
        .set(updates)
        .where(eq(profileBadges.id, req.params.badgeId))
        .returning();

      if (!updated) return res.status(404).json({ error: "Badge not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete("/api/admin/badges/:badgeId", requireAdmin, async (req: Request, res: Response) => {
    try {
      const [deleted] = await db
        .delete(profileBadges)
        .where(eq(profileBadges.id, req.params.badgeId))
        .returning();

      if (!deleted) return res.status(404).json({ error: "Badge not found" });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/businesses/:id/badges/bulk-toggle", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { badges } = req.body as { badges: Array<{ badgeType: string; enabled: boolean }> };
      if (!Array.isArray(badges)) return res.status(400).json({ error: "badges array required" });

      const results = [];
      for (const b of badges) {
        const existing = await db
          .select()
          .from(profileBadges)
          .where(
            and(
              eq(profileBadges.businessId, req.params.id),
              eq(profileBadges.badgeType, b.badgeType as any)
            )
          );

        if (existing.length > 0) {
          const [updated] = await db
            .update(profileBadges)
            .set({ enabled: b.enabled, updatedAt: new Date() })
            .where(eq(profileBadges.id, existing[0].id))
            .returning();
          results.push(updated);
        } else if (b.enabled) {
          const [created] = await db
            .insert(profileBadges)
            .values({
              businessId: req.params.id,
              badgeType: b.badgeType as any,
              enabled: true,
            })
            .returning();
          results.push(created);
        }
      }
      res.json(results);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });
}
