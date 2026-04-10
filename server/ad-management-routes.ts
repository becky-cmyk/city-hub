import { type Express, type Request, type Response } from "express";
import { db } from "./db";
import {
  revenuePrograms, adInventorySlots, adPlacements, adCreatives, adInquiries,
  entitlements, businesses,
  insertRevenueProgramSchema, insertAdInventorySlotSchema, insertAdPlacementSchema,
  insertAdCreativeSchema, insertAdInquirySchema,
  type RevenueProgram, type AdInventorySlot, type AdPlacement,
} from "@shared/schema";
import { eq, and, sql, desc, lte, gte, or, isNull, ilike, inArray } from "drizzle-orm";
import { z } from "zod";

export function registerAdManagementRoutes(app: Express, requireAdmin: any) {

  // ===== REVENUE PROGRAMS =====

  app.get("/api/admin/ad-programs", requireAdmin, async (_req: Request, res: Response) => {
    const programs = await db.select().from(revenuePrograms).orderBy(revenuePrograms.name);
    res.json(programs);
  });

  app.post("/api/admin/ad-programs", requireAdmin, async (req: Request, res: Response) => {
    const parsed = insertRevenueProgramSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten().fieldErrors });
    const [program] = await db.insert(revenuePrograms).values(parsed.data).returning();
    res.json(program);
  });

  app.patch("/api/admin/ad-programs/:id", requireAdmin, async (req: Request, res: Response) => {
    const [program] = await db.update(revenuePrograms)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(revenuePrograms.id, req.params.id))
      .returning();
    if (!program) return res.status(404).json({ message: "Program not found" });
    res.json(program);
  });

  // ===== INVENTORY SLOTS =====

  app.get("/api/admin/ad-inventory", requireAdmin, async (req: Request, res: Response) => {
    const conditions: any[] = [];
    if (req.query.scopeType) conditions.push(eq(adInventorySlots.scopeType, req.query.scopeType as any));
    if (req.query.hubId) conditions.push(eq(adInventorySlots.hubId, req.query.hubId as string));
    if (req.query.categoryId) conditions.push(eq(adInventorySlots.categoryId, req.query.categoryId as string));

    const slots = conditions.length > 0
      ? await db.select().from(adInventorySlots).where(and(...conditions)).orderBy(adInventorySlots.slotName)
      : await db.select().from(adInventorySlots).orderBy(adInventorySlots.slotName);
    res.json(slots);
  });

  app.post("/api/admin/ad-inventory", requireAdmin, async (req: Request, res: Response) => {
    const parsed = insertAdInventorySlotSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten().fieldErrors });
    const [slot] = await db.insert(adInventorySlots).values(parsed.data).returning();
    res.json(slot);
  });

  app.patch("/api/admin/ad-inventory/:id", requireAdmin, async (req: Request, res: Response) => {
    const [slot] = await db.update(adInventorySlots)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(adInventorySlots.id, req.params.id))
      .returning();
    if (!slot) return res.status(404).json({ message: "Slot not found" });
    res.json(slot);
  });

  // ===== PLACEMENTS =====

  app.get("/api/admin/ad-placements", requireAdmin, async (req: Request, res: Response) => {
    const conditions: any[] = [];
    if (req.query.programId) conditions.push(eq(adPlacements.programId, req.query.programId as string));
    if (req.query.status) conditions.push(eq(adPlacements.status, req.query.status as any));
    if (req.query.businessId) conditions.push(eq(adPlacements.businessId, req.query.businessId as string));
    if (req.query.slotId) conditions.push(eq(adPlacements.slotId, req.query.slotId as string));

    const placements = conditions.length > 0
      ? await db.select().from(adPlacements).where(and(...conditions)).orderBy(desc(adPlacements.createdAt))
      : await db.select().from(adPlacements).orderBy(desc(adPlacements.createdAt));
    res.json(placements);
  });

  app.post("/api/admin/ad-placements", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = insertAdPlacementSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten().fieldErrors });

      if (parsed.data.status === "ACTIVE") {
        const gateError = await checkExpandedListingGate(parsed.data.programId, parsed.data.businessId);
        if (gateError) return res.status(400).json({ message: gateError });
      }

      const [slot] = parsed.data.slotId
        ? await db.select().from(adInventorySlots).where(eq(adInventorySlots.id, parsed.data.slotId))
        : [null];
      const scopeResolved = slot ? {
        scopeType: slot.scopeType,
        hubId: slot.hubId || null,
        metroId: slot.metroId || null,
        categoryId: slot.categoryId || null,
        microCategoryId: slot.microCategoryId || null,
      } : null;

      const [placement] = await db.insert(adPlacements).values({ ...parsed.data, scopeResolved }).returning();
      res.json(placement);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/ad-placements/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      if (req.body.status === "ACTIVE") {
        const [existing] = await db.select().from(adPlacements).where(eq(adPlacements.id, req.params.id));
        if (!existing) return res.status(404).json({ message: "Placement not found" });
        const gateError = await checkExpandedListingGate(existing.programId, existing.businessId);
        if (gateError) return res.status(400).json({ message: gateError });
      }
      const [placement] = await db.update(adPlacements)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(adPlacements.id, req.params.id))
        .returning();
      if (!placement) return res.status(404).json({ message: "Placement not found" });
      res.json(placement);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ===== CREATIVES =====

  app.get("/api/admin/ad-creatives", requireAdmin, async (req: Request, res: Response) => {
    const conditions: any[] = [];
    if (req.query.placementId) conditions.push(eq(adCreatives.placementId, req.query.placementId as string));

    const creatives = conditions.length > 0
      ? await db.select().from(adCreatives).where(and(...conditions)).orderBy(adCreatives.createdAt)
      : await db.select().from(adCreatives).orderBy(adCreatives.createdAt);
    res.json(creatives);
  });

  app.post("/api/admin/ad-creatives", requireAdmin, async (req: Request, res: Response) => {
    const parsed = insertAdCreativeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten().fieldErrors });
    const [creative] = await db.insert(adCreatives).values(parsed.data).returning();
    res.json(creative);
  });

  app.patch("/api/admin/ad-creatives/:id", requireAdmin, async (req: Request, res: Response) => {
    const [creative] = await db.update(adCreatives)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(adCreatives.id, req.params.id))
      .returning();
    if (!creative) return res.status(404).json({ message: "Creative not found" });
    res.json(creative);
  });

  // ===== INQUIRIES =====

  app.get("/api/admin/ad-inquiries", requireAdmin, async (req: Request, res: Response) => {
    const conditions: any[] = [];
    if (req.query.status) conditions.push(eq(adInquiries.status, req.query.status as any));
    if (req.query.programId) conditions.push(eq(adInquiries.programId, req.query.programId as string));

    const inquiries = conditions.length > 0
      ? await db.select().from(adInquiries).where(and(...conditions)).orderBy(desc(adInquiries.createdAt))
      : await db.select().from(adInquiries).orderBy(desc(adInquiries.createdAt));
    res.json(inquiries);
  });

  app.post("/api/admin/ad-inquiries", requireAdmin, async (req: Request, res: Response) => {
    const parsed = insertAdInquirySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten().fieldErrors });
    const [inquiry] = await db.insert(adInquiries).values(parsed.data).returning();
    res.json(inquiry);
  });

  app.patch("/api/admin/ad-inquiries/:id", requireAdmin, async (req: Request, res: Response) => {
    const [inquiry] = await db.update(adInquiries)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(adInquiries.id, req.params.id))
      .returning();
    if (!inquiry) return res.status(404).json({ message: "Inquiry not found" });
    res.json(inquiry);
  });

  // ===== REPORTING =====

  app.get("/api/admin/ad-reporting", requireAdmin, async (_req: Request, res: Response) => {
    const now = new Date();
    const thirtyDaysOut = new Date(now);
    thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);

    const allPlacements = await db.select().from(adPlacements);
    const allPrograms = await db.select().from(revenuePrograms);
    const allSlots = await db.select().from(adInventorySlots);

    const activePlacements = allPlacements.filter(p => p.status === "ACTIVE");
    const expiringSoon = activePlacements.filter(p =>
      p.endDate && new Date(p.endDate) <= thirtyDaysOut && new Date(p.endDate) >= now
    );
    const comingSoonPrograms = allPrograms.filter(p => p.comingSoon);

    const bySlot: Record<string, number> = {};
    for (const p of activePlacements) {
      bySlot[p.slotId] = (bySlot[p.slotId] || 0) + 1;
    }

    const byProgram: Record<string, number> = {};
    for (const p of activePlacements) {
      byProgram[p.programId] = (byProgram[p.programId] || 0) + 1;
    }

    res.json({
      totalActive: activePlacements.length,
      totalPlacements: allPlacements.length,
      expiringSoonCount: expiringSoon.length,
      expiringSoon: expiringSoon.map(p => ({ id: p.id, businessId: p.businessId, endDate: p.endDate })),
      totalPrograms: allPrograms.length,
      totalSlots: allSlots.length,
      availableSlots: allSlots.filter(s => s.status === "ACTIVE").length,
      comingSoonPrograms: comingSoonPrograms.map(p => ({ id: p.id, name: p.name })),
      placementsBySlot: bySlot,
      placementsByProgram: byProgram,
      revenueNote: "Billing integration pending — revenue data will appear once Stripe line items are connected to placements",
    });
  });

  // ===== PUBLIC RUNTIME: ACTIVE PLACEMENTS =====

  app.get("/api/placements/active", async (req: Request, res: Response) => {
    const { metroId, hubId, categoryId, slotName } = req.query;
    if (!slotName) return res.status(400).json({ message: "slotName is required" });

    const now = new Date();

    const matchingSlots = await db.select().from(adInventorySlots)
      .where(and(
        eq(adInventorySlots.slotName, slotName as string),
        eq(adInventorySlots.status, "ACTIVE"),
      ));

    if (matchingSlots.length === 0) return res.json([]);

    const slotIds = matchingSlots.map(s => s.id);
    const slotMap = new Map(matchingSlots.map(s => [s.id, s]));

    const activePlacements = await db.select().from(adPlacements)
      .where(and(
        eq(adPlacements.status, "ACTIVE"),
        inArray(adPlacements.slotId, slotIds),
        lte(adPlacements.startDate, now),
        or(isNull(adPlacements.endDate), gte(adPlacements.endDate, now)),
      ));

    if (activePlacements.length === 0) return res.json([]);

    const hubCategorySpecific: AdPlacement[] = [];
    const hubOnly: AdPlacement[] = [];
    const metroCategorySpecific: AdPlacement[] = [];
    const metroOnly: AdPlacement[] = [];

    for (const p of activePlacements) {
      const scope = p.scopeResolved as any;
      if (!scope) { metroOnly.push(p); continue; }

      const matchesHub = hubId && scope.hubId === hubId;
      const matchesCategory = categoryId && scope.categoryId === categoryId;

      if (matchesHub && matchesCategory) {
        hubCategorySpecific.push(p);
      } else if (matchesHub && !scope.categoryId) {
        hubOnly.push(p);
      } else if (!scope.hubId && matchesCategory) {
        metroCategorySpecific.push(p);
      } else if (!scope.hubId && !scope.categoryId) {
        metroOnly.push(p);
      }
    }

    let results = hubCategorySpecific.length > 0 ? hubCategorySpecific
      : hubOnly.length > 0 ? hubOnly
      : metroCategorySpecific.length > 0 ? metroCategorySpecific
      : metroOnly;

    const grouped = new Map<string, AdPlacement[]>();
    for (const p of results) {
      const arr = grouped.get(p.slotId) || [];
      arr.push(p);
      grouped.set(p.slotId, arr);
    }

    const final: AdPlacement[] = [];
    for (const [sId, placements] of grouped) {
      const slot = slotMap.get(sId);
      if (!slot) { final.push(...placements); continue; }
      const max = slot.maxActivePlacements;
      let selected = placements;
      if (slot.rotationStrategy === "RANDOM") {
        selected = placements.sort(() => Math.random() - 0.5).slice(0, max);
      } else {
        selected = placements.slice(0, max);
      }
      final.push(...selected);
    }

    res.json(final.map(p => ({
      id: p.id,
      slotId: p.slotId,
      programId: p.programId,
      businessId: p.businessId,
      headline: p.headline,
      body: p.body,
      ctaText: p.ctaText,
      ctaUrl: p.ctaUrl,
      imageUrl: p.imageUrl,
      creativeType: p.creativeType,
      startDate: p.startDate,
      endDate: p.endDate,
    })));
  });
}

async function checkExpandedListingGate(programId: string, businessId: string): Promise<string | null> {
  const [program] = await db.select().from(revenuePrograms).where(eq(revenuePrograms.id, programId));
  if (!program) return "Program not found";
  if (!program.requiresExpandedListing) return null;

  const activeEntitlements = await db.select().from(entitlements)
    .where(and(
      eq(entitlements.subjectId, businessId),
      eq(entitlements.subjectType, "BUSINESS"),
      eq(entitlements.productType, "LISTING_TIER"),
      eq(entitlements.status, "ACTIVE"),
    ));

  const hasEnhanced = activeEntitlements.some(e => {
    const meta = e.metadata as any;
    return meta?.tier === "ENHANCED" || meta?.tier === "enhanced";
  });

  if (!hasEnhanced) {
    return "Requires Enhanced listing ($99/yr) — this business does not have an active Enhanced listing";
  }

  return null;
}
