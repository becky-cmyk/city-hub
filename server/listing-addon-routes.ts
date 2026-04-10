import { type Express, type Request, type Response } from "express";
import { db } from "./db";
import {
  businessLocations, listingAddonSubscriptions, enterpriseInquiries,
  presenceCoverage, businesses, regions,
  insertBusinessLocationSchema, insertListingAddonSubscriptionSchema, insertEnterpriseInquirySchema,
} from "@shared/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";

const ADDON_PRICING = {
  PHYSICAL_LOCATION: 9900,
  EXTRA_HUB_VISIBILITY: 5000,
  SERVICE_AREA_HUB: 5000,
  METRO_WIDE: 250000,
} as const;

const MAX_SELF_SERVE_LOCATIONS = 5;

export function registerListingAddonRoutes(app: Express, requireAdmin: any) {

  // ===== BUSINESS LOCATIONS =====

  app.get("/api/admin/businesses/:businessId/locations", requireAdmin, async (req: Request, res: Response) => {
    const locs = await db.select().from(businessLocations)
      .where(eq(businessLocations.businessId, req.params.businessId))
      .orderBy(desc(businessLocations.isPrimary), businessLocations.label);
    res.json(locs);
  });

  app.post("/api/admin/businesses/:businessId/locations", requireAdmin, async (req: Request, res: Response) => {
    try {
      const businessId = req.params.businessId;
      const existingLocs = await db.select().from(businessLocations)
        .where(and(
          eq(businessLocations.businessId, businessId),
          eq(businessLocations.status, "ACTIVE"),
        ));

      if (existingLocs.length >= MAX_SELF_SERVE_LOCATIONS) {
        const [inquiry] = await db.insert(enterpriseInquiries).values({
          businessId,
          inquiryType: "FRANCHISE",
          locationsCount: existingLocs.length + 1,
          notes: "Auto-created: attempted to add location beyond self-serve limit",
          status: "NEW",
        }).returning();
        return res.status(400).json({
          message: `Maximum ${MAX_SELF_SERVE_LOCATIONS} locations for self-serve. Enterprise inquiry created.`,
          enterpriseInquiryId: inquiry.id,
        });
      }

      const parsed = insertBusinessLocationSchema.safeParse({ ...req.body, businessId });
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten().fieldErrors });

      const [loc] = await db.insert(businessLocations).values(parsed.data).returning();

      if (loc.hubId && !loc.isPrimary) {
        await db.insert(presenceCoverage).values({
          presenceId: businessId,
          coverageType: "HUB",
          targetId: loc.hubId,
          isAddon: true,
        });
      }

      res.json(loc);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/business-locations/:id", requireAdmin, async (req: Request, res: Response) => {
    const [loc] = await db.update(businessLocations)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(businessLocations.id, req.params.id))
      .returning();
    if (!loc) return res.status(404).json({ message: "Location not found" });
    res.json(loc);
  });

  app.delete("/api/admin/business-locations/:id", requireAdmin, async (req: Request, res: Response) => {
    const [loc] = await db.update(businessLocations)
      .set({ status: "INACTIVE", updatedAt: new Date() })
      .where(eq(businessLocations.id, req.params.id))
      .returning();
    if (!loc) return res.status(404).json({ message: "Location not found" });
    res.json(loc);
  });

  // ===== BUSINESS COVERAGE (uses existing presence_coverage) =====

  app.get("/api/admin/businesses/:businessId/coverage", requireAdmin, async (req: Request, res: Response) => {
    const rows = await db.select().from(presenceCoverage)
      .where(eq(presenceCoverage.presenceId, req.params.businessId));
    res.json(rows);
  });

  app.post("/api/admin/businesses/:businessId/coverage", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { coverageType, targetId } = req.body;
      if (!coverageType || !targetId) return res.status(400).json({ message: "coverageType and targetId required" });

      const validTypes = ["HUB", "ZONE", "REGION"];
      if (!validTypes.includes(coverageType)) return res.status(400).json({ message: "Invalid coverageType" });

      const [row] = await db.insert(presenceCoverage).values({
        presenceId: req.params.businessId,
        coverageType,
        targetId,
        isAddon: true,
      }).returning();
      res.json(row);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/business-coverage/:id", requireAdmin, async (req: Request, res: Response) => {
    const deleted = await db.delete(presenceCoverage)
      .where(eq(presenceCoverage.id, req.params.id))
      .returning();
    if (deleted.length === 0) return res.status(404).json({ message: "Coverage not found" });
    res.json({ success: true });
  });

  // ===== ADDON SUBSCRIPTIONS =====

  app.get("/api/admin/businesses/:businessId/addon-subscriptions", requireAdmin, async (req: Request, res: Response) => {
    const subs = await db.select().from(listingAddonSubscriptions)
      .where(eq(listingAddonSubscriptions.businessId, req.params.businessId))
      .orderBy(desc(listingAddonSubscriptions.createdAt));
    res.json(subs);
  });

  app.post("/api/admin/businesses/:businessId/addon-subscriptions", requireAdmin, async (req: Request, res: Response) => {
    try {
      const businessId = req.params.businessId;
      const { addonType, quantity, notesInternal } = req.body;

      const price = ADDON_PRICING[addonType as keyof typeof ADDON_PRICING];
      if (!price) return res.status(400).json({ message: "Invalid addon type" });

      const now = new Date();
      const endDate = new Date(now);
      endDate.setFullYear(endDate.getFullYear() + 1);

      const [sub] = await db.insert(listingAddonSubscriptions).values({
        businessId,
        addonType,
        unitPriceCents: price,
        quantity: quantity || 1,
        term: "ANNUAL",
        startDate: now,
        endDate,
        status: "PENDING_PAYMENT",
        notesInternal: notesInternal || null,
      }).returning();
      res.json(sub);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/addon-subscriptions/:id", requireAdmin, async (req: Request, res: Response) => {
    const [sub] = await db.update(listingAddonSubscriptions)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(listingAddonSubscriptions.id, req.params.id))
      .returning();
    if (!sub) return res.status(404).json({ message: "Subscription not found" });
    res.json(sub);
  });

  // ===== ENTERPRISE INQUIRIES =====

  app.get("/api/admin/enterprise-inquiries", requireAdmin, async (req: Request, res: Response) => {
    const conditions: any[] = [];
    if (req.query.status) conditions.push(eq(enterpriseInquiries.status, req.query.status as any));
    const rows = conditions.length > 0
      ? await db.select().from(enterpriseInquiries).where(and(...conditions)).orderBy(desc(enterpriseInquiries.createdAt))
      : await db.select().from(enterpriseInquiries).orderBy(desc(enterpriseInquiries.createdAt));
    res.json(rows);
  });

  app.post("/api/admin/enterprise-inquiries", requireAdmin, async (req: Request, res: Response) => {
    const parsed = insertEnterpriseInquirySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten().fieldErrors });
    const [inquiry] = await db.insert(enterpriseInquiries).values(parsed.data).returning();
    res.json(inquiry);
  });

  app.patch("/api/admin/enterprise-inquiries/:id", requireAdmin, async (req: Request, res: Response) => {
    const [inquiry] = await db.update(enterpriseInquiries)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(enterpriseInquiries.id, req.params.id))
      .returning();
    if (!inquiry) return res.status(404).json({ message: "Inquiry not found" });
    res.json(inquiry);
  });

  // ===== REPORTING =====

  app.get("/api/admin/listing-addon-reporting", requireAdmin, async (_req: Request, res: Response) => {
    const allLocs = await db.select().from(businessLocations).where(eq(businessLocations.status, "ACTIVE"));
    const allSubs = await db.select().from(listingAddonSubscriptions);
    const allInquiries = await db.select().from(enterpriseInquiries);
    const allCoverage = await db.select().from(presenceCoverage).where(eq(presenceCoverage.isAddon, true));

    const multiLocBizIds = new Set<string>();
    const locsByBiz = new Map<string, number>();
    for (const loc of allLocs) {
      locsByBiz.set(loc.businessId, (locsByBiz.get(loc.businessId) || 0) + 1);
    }
    for (const [bizId, count] of locsByBiz) {
      if (count > 1) multiLocBizIds.add(bizId);
    }

    const metroWideCoverage = allCoverage.filter(c => c.coverageType === "REGION");
    const activeSubs = allSubs.filter(s => s.status === "ACTIVE");
    const pendingSubs = allSubs.filter(s => s.status === "PENDING_PAYMENT");

    const activeRevenue = activeSubs.reduce((sum, s) => sum + s.unitPriceCents * s.quantity, 0);
    const pendingRevenue = pendingSubs.reduce((sum, s) => sum + s.unitPriceCents * s.quantity, 0);

    res.json({
      totalLocations: allLocs.length,
      multiLocationBusinesses: multiLocBizIds.size,
      metroWideBusinesses: metroWideCoverage.length,
      hubVisibilityAddons: allCoverage.filter(c => c.coverageType === "HUB").length,
      activeSubscriptions: activeSubs.length,
      pendingSubscriptions: pendingSubs.length,
      activeRevenueCents: activeRevenue,
      pendingRevenueCents: pendingRevenue,
      enterpriseInquiriesOpen: allInquiries.filter(i => i.status === "NEW" || i.status === "CONTACTED").length,
      enterpriseInquiriesTotal: allInquiries.length,
    });
  });

  // ===== OWNER-FACING ENDPOINTS =====

  app.get("/api/businesses/:businessId/locations", async (req: Request, res: Response) => {
    const locs = await db.select().from(businessLocations)
      .where(and(
        eq(businessLocations.businessId, req.params.businessId),
        eq(businessLocations.status, "ACTIVE"),
      ))
      .orderBy(desc(businessLocations.isPrimary), businessLocations.label);
    res.json(locs);
  });

  app.get("/api/businesses/:businessId/coverage-summary", async (req: Request, res: Response) => {
    const businessId = req.params.businessId;
    const locs = await db.select().from(businessLocations)
      .where(and(eq(businessLocations.businessId, businessId), eq(businessLocations.status, "ACTIVE")));
    const coverage = await db.select().from(presenceCoverage)
      .where(eq(presenceCoverage.presenceId, businessId));
    const subs = await db.select().from(listingAddonSubscriptions)
      .where(and(
        eq(listingAddonSubscriptions.businessId, businessId),
        eq(listingAddonSubscriptions.status, "ACTIVE"),
      ));

    const hubIds = [...new Set([
      ...locs.filter(l => l.hubId).map(l => l.hubId!),
      ...coverage.filter(c => c.coverageType === "HUB").map(c => c.targetId),
    ])];

    let hubNames: Record<string, string> = {};
    if (hubIds.length > 0) {
      const hubs = await db.select({ id: regions.id, name: regions.name }).from(regions)
        .where(inArray(regions.id, hubIds));
      hubNames = Object.fromEntries(hubs.map(h => [h.id, h.name]));
    }

    const hasMetroWide = coverage.some(c => c.coverageType === "REGION");

    res.json({
      locations: locs,
      locationsCount: locs.length,
      maxLocations: MAX_SELF_SERVE_LOCATIONS,
      hubVisibility: coverage.filter(c => c.coverageType === "HUB").map(c => ({ id: c.id, hubId: c.targetId, hubName: hubNames[c.targetId] || c.targetId })),
      serviceAreaHubs: coverage.filter(c => c.coverageType === "ZONE").map(c => ({ id: c.id, hubId: c.targetId, hubName: hubNames[c.targetId] || c.targetId })),
      hasMetroWide,
      activeSubscriptions: subs,
      pricing: {
        PHYSICAL_LOCATION: ADDON_PRICING.PHYSICAL_LOCATION,
        EXTRA_HUB_VISIBILITY: ADDON_PRICING.EXTRA_HUB_VISIBILITY,
        SERVICE_AREA_HUB: ADDON_PRICING.SERVICE_AREA_HUB,
        METRO_WIDE: ADDON_PRICING.METRO_WIDE,
      },
    });
  });

  // Owner can request add-ons (creates PENDING_PAYMENT subscription)
  app.post("/api/businesses/:businessId/request-addon", async (req: Request, res: Response) => {
    try {
      const businessId = req.params.businessId;
      const { addonType, hubId, locationData } = req.body;

      if (addonType === "PHYSICAL_LOCATION") {
        const existingLocs = await db.select().from(businessLocations)
          .where(and(eq(businessLocations.businessId, businessId), eq(businessLocations.status, "ACTIVE")));

        if (existingLocs.length >= MAX_SELF_SERVE_LOCATIONS) {
          const [inquiry] = await db.insert(enterpriseInquiries).values({
            businessId,
            inquiryType: "FRANCHISE",
            locationsCount: existingLocs.length + 1,
            notes: "Owner requested additional location beyond self-serve limit",
            status: "NEW",
          }).returning();
          return res.json({ requiresEnterprise: true, enterpriseInquiryId: inquiry.id });
        }

        if (locationData) {
          await db.insert(businessLocations).values({
            businessId,
            label: locationData.label || null,
            street: locationData.street || null,
            city: locationData.city || null,
            state: locationData.state || null,
            zip: locationData.zip || null,
            hubId: locationData.hubId || null,
            isPrimary: false,
            status: "ACTIVE",
          });

          if (locationData.hubId) {
            await db.insert(presenceCoverage).values({
              presenceId: businessId,
              coverageType: "HUB",
              targetId: locationData.hubId,
              isAddon: true,
            });
          }
        }
      }

      if (addonType === "EXTRA_HUB_VISIBILITY" && hubId) {
        await db.insert(presenceCoverage).values({
          presenceId: businessId,
          coverageType: "HUB",
          targetId: hubId,
          isAddon: true,
        });
      }

      if (addonType === "SERVICE_AREA_HUB" && hubId) {
        await db.insert(presenceCoverage).values({
          presenceId: businessId,
          coverageType: "ZONE",
          targetId: hubId,
          isAddon: true,
        });
      }

      if (addonType === "METRO_WIDE") {
        let metroId: string | null = null;
        if (hubId) {
          const metroRegion = (await db.select().from(regions).where(eq(regions.id, hubId)))[0];
          metroId = metroRegion?.parentRegionId || hubId;
        } else {
          const biz = (await db.select().from(businesses).where(eq(businesses.id, businessId)))[0];
          if (biz?.hubId) {
            const bizHub = (await db.select().from(regions).where(eq(regions.id, biz.hubId)))[0];
            metroId = bizHub?.parentRegionId || biz.hubId;
          }
        }
        if (metroId) {
          await db.insert(presenceCoverage).values({
            presenceId: businessId,
            coverageType: "REGION",
            targetId: metroId,
            isAddon: true,
          });
        }
      }

      const price = ADDON_PRICING[addonType as keyof typeof ADDON_PRICING];
      if (!price) return res.status(400).json({ message: "Invalid addon type" });

      const now = new Date();
      const endDate = new Date(now);
      endDate.setFullYear(endDate.getFullYear() + 1);

      const [sub] = await db.insert(listingAddonSubscriptions).values({
        businessId,
        addonType,
        unitPriceCents: price,
        quantity: 1,
        term: "ANNUAL",
        startDate: now,
        endDate,
        status: "PENDING_PAYMENT",
      }).returning();

      res.json({ subscription: sub, requiresEnterprise: false });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
