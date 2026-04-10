import { type Express, type Request, type Response } from "express";
import { db } from "./db";
import { cmsContentItems, contentBoosts, adInventorySlots } from "@shared/schema";
import { eq, and, desc, lt, lte, gte, sql } from "drizzle-orm";
import { z } from "zod";

const sponsorshipAssignSchema = z.object({
  isSponsored: z.boolean(),
  sponsorId: z.string().nullable().optional(),
  sponsorshipType: z.enum(["NATIVE", "BRANDED", "AFFILIATE", "PROMOTED"]).nullable().optional(),
});

const boostCreateSchema = z.object({
  contentItemId: z.string().min(1),
  boostLevel: z.number().int().min(1).max(5),
  durationDays: z.number().int().min(1).max(365),
  cityId: z.string().min(1),
});

export function registerRevenueRoutes(app: Express, requireAdmin: (req: Request, res: Response, next: () => void) => void) {

  function requireAdminSession(req: Request, res: Response, next: () => void) {
    const session = (req as Record<string, unknown>).session as Record<string, unknown> | undefined;
    if (!session?.userId) {
      return res.status(401).json({ error: "Admin session required" });
    }
    next();
  }

  app.get("/api/admin/sponsorships", requireAdmin, requireAdminSession, async (req: Request, res: Response) => {
    try {
      const cityFilter = req.query.cityId as string | undefined;
      const conditions = [eq(cmsContentItems.isSponsored, true)];
      if (cityFilter) conditions.push(eq(cmsContentItems.cityId, cityFilter));

      const items = await db.select({
        id: cmsContentItems.id,
        titleEn: cmsContentItems.titleEn,
        contentType: cmsContentItems.contentType,
        status: cmsContentItems.status,
        isSponsored: cmsContentItems.isSponsored,
        sponsorId: cmsContentItems.sponsorId,
        sponsorshipType: cmsContentItems.sponsorshipType,
        cityId: cmsContentItems.cityId,
        publishedAt: cmsContentItems.publishedAt,
      }).from(cmsContentItems)
        .where(and(...conditions))
        .orderBy(desc(cmsContentItems.updatedAt));

      res.json(items);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: msg });
    }
  });

  app.get("/api/admin/sponsorship-candidates", requireAdmin, requireAdminSession, async (req: Request, res: Response) => {
    try {
      const cityFilter = req.query.cityId as string | undefined;
      const conditions = [eq(cmsContentItems.isSponsored, false)];
      if (cityFilter) conditions.push(eq(cmsContentItems.cityId, cityFilter));

      const items = await db.select({
        id: cmsContentItems.id,
        titleEn: cmsContentItems.titleEn,
        contentType: cmsContentItems.contentType,
        status: cmsContentItems.status,
        cityId: cmsContentItems.cityId,
      }).from(cmsContentItems)
        .where(and(...conditions))
        .orderBy(desc(cmsContentItems.updatedAt))
        .limit(100);

      res.json(items);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: msg });
    }
  });

  app.patch("/api/admin/sponsorships/:id", requireAdmin, requireAdminSession, async (req: Request, res: Response) => {
    try {
      const parsed = sponsorshipAssignSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid data", details: parsed.error.errors });

      const [existing] = await db.select({ id: cmsContentItems.id }).from(cmsContentItems).where(eq(cmsContentItems.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ error: "Content item not found" });

      const updates: Record<string, unknown> = {
        isSponsored: parsed.data.isSponsored,
        updatedAt: new Date(),
      };
      if (parsed.data.sponsorId !== undefined) updates.sponsorId = parsed.data.sponsorId;
      if (parsed.data.sponsorshipType !== undefined) updates.sponsorshipType = parsed.data.sponsorshipType;

      if (!parsed.data.isSponsored) {
        updates.sponsorId = null;
        updates.sponsorshipType = null;
      }

      await db.update(cmsContentItems).set(updates).where(eq(cmsContentItems.id, req.params.id));
      res.json({ success: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: msg });
    }
  });

  app.get("/api/sponsored-content", async (req: Request, res: Response) => {
    try {
      const cityId = req.query.cityId as string | undefined;
      if (!cityId) return res.status(400).json({ error: "cityId is required" });

      const placement = req.query.placement as string | undefined;
      const validPlacements = ["NATIVE", "BRANDED", "AFFILIATE", "PROMOTED"];
      if (placement && !validPlacements.includes(placement)) {
        return res.status(400).json({ error: "Invalid placement. Must be NATIVE, BRANDED, AFFILIATE, or PROMOTED" });
      }

      const conditions = [
        eq(cmsContentItems.isSponsored, true),
        eq(cmsContentItems.cityId, cityId),
        eq(cmsContentItems.status, "published"),
      ];
      if (placement) {
        conditions.push(eq(cmsContentItems.sponsorshipType, placement as "NATIVE" | "BRANDED" | "AFFILIATE" | "PROMOTED"));
      }

      const items = await db.select({
        id: cmsContentItems.id,
        titleEn: cmsContentItems.titleEn,
        contentType: cmsContentItems.contentType,
        slug: cmsContentItems.slug,
        excerptEn: cmsContentItems.excerptEn,
        sponsorId: cmsContentItems.sponsorId,
        sponsorshipType: cmsContentItems.sponsorshipType,
        heroImageAssetId: cmsContentItems.heroImageAssetId,
        publishedAt: cmsContentItems.publishedAt,
      }).from(cmsContentItems)
        .where(and(...conditions))
        .orderBy(desc(cmsContentItems.publishedAt))
        .limit(20);

      res.json(items);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: msg });
    }
  });

  app.get("/api/admin/boosts", requireAdmin, requireAdminSession, async (req: Request, res: Response) => {
    try {
      await db.update(contentBoosts)
        .set({ status: "EXPIRED" })
        .where(and(eq(contentBoosts.status, "ACTIVE"), lt(contentBoosts.endsAt, new Date())));

      const cityFilter = req.query.cityId as string | undefined;
      const statusFilter = req.query.status as string | undefined;
      const validStatuses = ["ACTIVE", "EXPIRED", "CANCELLED"] as const;
      if (statusFilter && !validStatuses.includes(statusFilter as typeof validStatuses[number])) {
        return res.status(400).json({ error: "Invalid status filter. Must be ACTIVE, EXPIRED, or CANCELLED" });
      }
      const conditions: ReturnType<typeof eq>[] = [];
      if (cityFilter) conditions.push(eq(contentBoosts.cityId, cityFilter));
      if (statusFilter) conditions.push(eq(contentBoosts.status, statusFilter as "ACTIVE" | "EXPIRED" | "CANCELLED"));

      const boosts = conditions.length > 0
        ? await db.select().from(contentBoosts).where(and(...conditions)).orderBy(desc(contentBoosts.createdAt))
        : await db.select().from(contentBoosts).orderBy(desc(contentBoosts.createdAt));

      const contentIds = [...new Set(boosts.map(b => b.contentItemId))];
      let contentMap: Record<string, string> = {};
      if (contentIds.length > 0) {
        const items = await db.select({ id: cmsContentItems.id, titleEn: cmsContentItems.titleEn })
          .from(cmsContentItems)
          .where(sql`${cmsContentItems.id} IN (${sql.join(contentIds.map(id => sql`${id}`), sql`, `)})`);
        for (const item of items) {
          contentMap[item.id] = item.titleEn;
        }
      }

      res.json(boosts.map(b => ({
        ...b,
        contentTitle: contentMap[b.contentItemId] || "Unknown",
      })));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/admin/boosts", requireAdmin, requireAdminSession, async (req: Request, res: Response) => {
    try {
      const parsed = boostCreateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid data", details: parsed.error.errors });

      const [existing] = await db.select({ id: cmsContentItems.id, cityId: cmsContentItems.cityId }).from(cmsContentItems).where(eq(cmsContentItems.id, parsed.data.contentItemId)).limit(1);
      if (!existing) return res.status(404).json({ error: "Content item not found" });
      if (existing.cityId !== parsed.data.cityId) return res.status(400).json({ error: "Content item does not belong to the specified city" });

      const startsAt = new Date();
      const endsAt = new Date();
      endsAt.setDate(endsAt.getDate() + parsed.data.durationDays);

      const session = (req as Record<string, unknown>).session as Record<string, unknown> | undefined;

      const [boost] = await db.insert(contentBoosts).values({
        contentItemId: parsed.data.contentItemId,
        boostLevel: parsed.data.boostLevel,
        startsAt,
        endsAt,
        status: "ACTIVE",
        createdByUserId: (session?.userId as string) || null,
        cityId: parsed.data.cityId,
      }).returning();

      res.json(boost);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/admin/boosts/:id/cancel", requireAdmin, requireAdminSession, async (req: Request, res: Response) => {
    try {
      const [existing] = await db.select({ id: contentBoosts.id, status: contentBoosts.status }).from(contentBoosts).where(eq(contentBoosts.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ error: "Boost not found" });
      if (existing.status !== "ACTIVE") return res.status(400).json({ error: "Only active boosts can be cancelled" });

      await db.update(contentBoosts).set({ status: "CANCELLED" }).where(eq(contentBoosts.id, req.params.id));
      res.json({ success: true, status: "CANCELLED" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: msg });
    }
  });

  app.get("/api/admin/revenue/ad-slots", requireAdmin, requireAdminSession, async (req: Request, res: Response) => {
    try {
      const slots = await db.select().from(adInventorySlots).orderBy(desc(adInventorySlots.createdAt));
      res.json(slots);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/admin/revenue/ad-slots", requireAdmin, requireAdminSession, async (req: Request, res: Response) => {
    try {
      const createSchema = z.object({
        slotName: z.string().min(1),
        placementType: z.enum(["BANNER", "CARD", "LIST_ITEM", "BADGE", "FEATURED_BLOCK", "CTA"]),
        scopeType: z.enum(["HUB_ONLY", "METRO_ONLY", "HUB_OR_METRO"]),
        metroId: z.string().nullable().optional(),
        hubId: z.string().nullable().optional(),
        maxActivePlacements: z.number().int().min(1).max(100).default(1),
        rotationStrategy: z.enum(["NONE", "ROUND_ROBIN", "WEIGHTED", "RANDOM"]).default("NONE"),
        slotSize: z.enum(["SMALL", "MEDIUM", "LARGE", "FULL_WIDTH"]).default("MEDIUM"),
        pricePerUnit: z.number().int().min(0).default(0),
      });
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid data", details: parsed.error.errors });

      const [slot] = await db.insert(adInventorySlots).values({
        slotName: parsed.data.slotName,
        placementType: parsed.data.placementType,
        scopeType: parsed.data.scopeType,
        metroId: parsed.data.metroId || null,
        hubId: parsed.data.hubId || null,
        maxActivePlacements: parsed.data.maxActivePlacements,
        rotationStrategy: parsed.data.rotationStrategy,
        slotSize: parsed.data.slotSize,
        pricePerUnit: parsed.data.pricePerUnit,
        status: "ACTIVE",
      }).returning();

      res.json(slot);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: msg });
    }
  });

  app.patch("/api/admin/revenue/ad-slots/:id", requireAdmin, requireAdminSession, async (req: Request, res: Response) => {
    try {
      const updateSchema = z.object({
        status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
        maxActivePlacements: z.number().int().min(1).max(100).optional(),
        slotName: z.string().min(1).optional(),
        slotSize: z.enum(["SMALL", "MEDIUM", "LARGE", "FULL_WIDTH"]).optional(),
        pricePerUnit: z.number().int().min(0).optional(),
      });
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid data", details: parsed.error.errors });

      const [existing] = await db.select({ id: adInventorySlots.id }).from(adInventorySlots).where(eq(adInventorySlots.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ error: "Ad slot not found" });

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (parsed.data.status !== undefined) updates.status = parsed.data.status;
      if (parsed.data.maxActivePlacements !== undefined) updates.maxActivePlacements = parsed.data.maxActivePlacements;
      if (parsed.data.slotName !== undefined) updates.slotName = parsed.data.slotName;
      if (parsed.data.slotSize !== undefined) updates.slotSize = parsed.data.slotSize;
      if (parsed.data.pricePerUnit !== undefined) updates.pricePerUnit = parsed.data.pricePerUnit;

      await db.update(adInventorySlots).set(updates).where(eq(adInventorySlots.id, req.params.id));
      res.json({ success: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: msg });
    }
  });

  app.get("/api/active-boosts", async (req: Request, res: Response) => {
    try {
      const cityId = req.query.cityId as string | undefined;
      if (!cityId) return res.status(400).json({ error: "cityId is required" });

      const now = new Date();
      const boosts = await db.select({
        id: contentBoosts.id,
        contentItemId: contentBoosts.contentItemId,
        boostLevel: contentBoosts.boostLevel,
        startsAt: contentBoosts.startsAt,
        endsAt: contentBoosts.endsAt,
      }).from(contentBoosts)
        .where(and(
          eq(contentBoosts.cityId, cityId),
          eq(contentBoosts.status, "ACTIVE"),
          lte(contentBoosts.startsAt, now),
          gte(contentBoosts.endsAt, now),
        ))
        .orderBy(desc(contentBoosts.boostLevel));

      res.json(boosts);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: msg });
    }
  });
}
