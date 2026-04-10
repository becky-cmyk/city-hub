import type { Express, Request, Response } from "express";
import { db } from "./db";
import { territories, cities, operators, operatorTerritories, territoryListings, businesses, zones } from "@shared/schema";
import { eq, and, sql, inArray, desc, count, or } from "drizzle-orm";
import { storage } from "./storage";

const isSuperAdminRole = (role: string | undefined) =>
  ["PLATFORM_ADMIN", "SUPER_ADMIN", "super_admin", "admin", "ADMIN"].includes(role || "");

export function registerHubManagementRoutes(app: Express, requireAdmin: any, requirePlatformAdmin?: any) {
  const platformGuard = requirePlatformAdmin || requireAdmin;

  app.get("/api/admin/my-hub", requireAdmin, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUserById((req.session as any).userId);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const superAdmin = isSuperAdminRole(user.role);

      let cityId: string | null = null;
      if (superAdmin && req.query.cityId && typeof req.query.cityId === "string") {
        cityId = req.query.cityId;
      } else if (user.cityId) {
        cityId = user.cityId;
      } else if (superAdmin) {
        const [firstCity] = await db.select({ id: cities.id }).from(cities).orderBy(cities.name).limit(1);
        cityId = firstCity?.id || null;
      }

      if (!cityId) {
        return res.json(null);
      }

      const [city] = await db.select().from(cities).where(eq(cities.id, cityId));
      if (!city) return res.json(null);

      const cityTerritories = await db.select().from(territories)
        .where(eq(territories.cityId, cityId))
        .orderBy(territories.type, territories.name);

      const territoryIds = cityTerritories.map(t => t.id);

      let operatorAssignments: any[] = [];
      if (territoryIds.length > 0) {
        operatorAssignments = await db
          .select({
            territoryId: operatorTerritories.territoryId,
            operatorId: operatorTerritories.operatorId,
            exclusivity: operatorTerritories.exclusivity,
            operatorName: operators.displayName,
            operatorEmail: operators.email,
            operatorType: operators.operatorType,
            operatorStatus: operators.status,
            pipelineStage: operators.pipelineStage,
          })
          .from(operatorTerritories)
          .innerJoin(operators, eq(operatorTerritories.operatorId, operators.id))
          .where(inArray(operatorTerritories.territoryId, territoryIds));
      }

      const opMap = new Map<string, any[]>();
      for (const oa of operatorAssignments) {
        const arr = opMap.get(oa.territoryId) || [];
        arr.push(oa);
        opMap.set(oa.territoryId, arr);
      }

      let listingCounts: { territoryId: string; count: number }[] = [];
      if (territoryIds.length > 0) {
        const raw = await db
          .select({ territoryId: territoryListings.territoryId, count: count() })
          .from(territoryListings)
          .where(inArray(territoryListings.territoryId, territoryIds))
          .groupBy(territoryListings.territoryId);
        listingCounts = raw.map(r => ({ territoryId: r.territoryId, count: Number(r.count) }));
      }
      const listingMap = new Map(listingCounts.map(lc => [lc.territoryId, lc.count]));

      const zoneCounts = await db
        .select({ type: zones.type, count: count() })
        .from(zones)
        .where(eq(zones.cityId, cityId))
        .groupBy(zones.type);

      const zoneSummary: Record<string, number> = {};
      let totalZones = 0;
      for (const zc of zoneCounts) {
        zoneSummary[zc.type] = Number(zc.count);
        totalZones += Number(zc.count);
      }

      const enrichedTerritories = cityTerritories.map(t => ({
        ...t,
        operators: opMap.get(t.id) || [],
        listingCount: listingMap.get(t.id) || 0,
      }));

      const metros = enrichedTerritories.filter(t => t.type === "METRO");
      const micros = enrichedTerritories.filter(t => t.type === "MICRO");

      const metrosWithMicros = metros.map(metro => ({
        ...metro,
        microHubs: micros.filter(m => m.parentTerritoryId === metro.id),
      }));

      const orphanMicros = micros.filter(m =>
        !m.parentTerritoryId || !metros.find(mt => mt.id === m.parentTerritoryId)
      );

      res.json({
        id: city.id,
        name: city.name,
        slug: city.slug,
        cityCode: (city as any).cityCode || null,
        isActive: city.isActive,
        brandName: city.brandName,
        primaryColor: city.primaryColor,
        siteUrl: city.siteUrl,
        emailDomain: city.emailDomain,
        territories: metrosWithMicros,
        orphanMicros,
        zoneSummary,
        totalZones,
        metroCount: metros.length,
        microCount: micros.length,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/hub-management", platformGuard, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUserById((req.session as any).userId);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const superAdmin = isSuperAdminRole(user.role);

      let cityConditions: any[] = [];
      if (!superAdmin) {
        if (user.cityId) {
          cityConditions.push(eq(cities.id, user.cityId));
        } else {
          return res.json({ cities: [], totalMetros: 0, totalMicros: 0 });
        }
      }
      if (req.query.cityId && typeof req.query.cityId === "string" && superAdmin) {
        cityConditions.push(eq(cities.id, req.query.cityId));
      }

      const allCities = cityConditions.length > 0
        ? await db.select().from(cities).where(and(...cityConditions)).orderBy(cities.name)
        : await db.select().from(cities).orderBy(cities.name);

      const cityIds = allCities.map(c => c.id);
      if (cityIds.length === 0) {
        return res.json({ cities: [], totalMetros: 0, totalMicros: 0 });
      }

      const allTerritories = await db.select().from(territories)
        .where(inArray(territories.cityId, cityIds))
        .orderBy(territories.type, territories.name);

      const territoryIds = allTerritories.map(t => t.id);

      let operatorAssignments: any[] = [];
      if (territoryIds.length > 0) {
        operatorAssignments = await db
          .select({
            territoryId: operatorTerritories.territoryId,
            operatorId: operatorTerritories.operatorId,
            exclusivity: operatorTerritories.exclusivity,
            operatorName: operators.displayName,
            operatorEmail: operators.email,
            operatorType: operators.operatorType,
            operatorStatus: operators.status,
            pipelineStage: operators.pipelineStage,
          })
          .from(operatorTerritories)
          .innerJoin(operators, eq(operatorTerritories.operatorId, operators.id))
          .where(inArray(operatorTerritories.territoryId, territoryIds));
      }

      const opMap = new Map<string, any[]>();
      for (const oa of operatorAssignments) {
        const arr = opMap.get(oa.territoryId) || [];
        arr.push(oa);
        opMap.set(oa.territoryId, arr);
      }

      let listingCounts: { territoryId: string; count: number }[] = [];
      if (territoryIds.length > 0) {
        const raw = await db
          .select({ territoryId: territoryListings.territoryId, count: count() })
          .from(territoryListings)
          .where(inArray(territoryListings.territoryId, territoryIds))
          .groupBy(territoryListings.territoryId);
        listingCounts = raw.map(r => ({ territoryId: r.territoryId, count: Number(r.count) }));
      }
      const listingMap = new Map(listingCounts.map(lc => [lc.territoryId, lc.count]));

      const zoneCounts = await db
        .select({
          cityId: zones.cityId,
          type: zones.type,
          count: count(),
        })
        .from(zones)
        .where(inArray(zones.cityId, cityIds))
        .groupBy(zones.cityId, zones.type);

      const zoneCountMap = new Map<string, Record<string, number>>();
      for (const zc of zoneCounts) {
        const existing = zoneCountMap.get(zc.cityId) || {};
        existing[zc.type] = Number(zc.count);
        zoneCountMap.set(zc.cityId, existing);
      }

      const enrichedTerritories = allTerritories.map(t => ({
        ...t,
        operators: opMap.get(t.id) || [],
        listingCount: listingMap.get(t.id) || 0,
      }));

      const metros = enrichedTerritories.filter(t => t.type === "METRO");
      const micros = enrichedTerritories.filter(t => t.type === "MICRO");

      const cityHierarchy = allCities.map(city => {
        const cityMetros = metros.filter(t => t.cityId === city.id);
        const cityMicros = micros.filter(t => t.cityId === city.id);
        const zoneSummary = zoneCountMap.get(city.id) || {};
        const totalZones = Object.values(zoneSummary).reduce((a, b) => a + b, 0);

        const metrosWithMicros = cityMetros.map(metro => ({
          ...metro,
          microHubs: cityMicros.filter(m => m.parentTerritoryId === metro.id),
        }));

        const orphanMicros = cityMicros.filter(m =>
          !m.parentTerritoryId || !cityMetros.find(mt => mt.id === m.parentTerritoryId)
        );

        return {
          id: city.id,
          name: city.name,
          slug: city.slug,
          cityCode: (city as any).cityCode || null,
          isActive: city.isActive,
          brandName: city.brandName,
          primaryColor: city.primaryColor,
          siteUrl: city.siteUrl,
          emailDomain: city.emailDomain,
          territories: metrosWithMicros,
          orphanMicros,
          zoneSummary,
          totalZones,
          metroCount: cityMetros.length,
          microCount: cityMicros.length,
        };
      });

      res.json({
        cities: cityHierarchy,
        totalMetros: metros.length,
        totalMicros: micros.length,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/hub-management/city/:cityId/zones", requireAdmin, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUserById((req.session as any).userId);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const superAdmin = isSuperAdminRole(user.role);

      if (!superAdmin && user.cityId && user.cityId !== req.params.cityId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const conditions: any[] = [eq(zones.cityId, req.params.cityId)];
      if (req.query.type && typeof req.query.type === "string") {
        conditions.push(eq(zones.type, req.query.type as any));
      }

      const cityZones = await db.select().from(zones)
        .where(and(...conditions))
        .orderBy(zones.type, zones.name);

      res.json(cityZones);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/hub-management/city/:cityId/zones", requireAdmin, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUserById((req.session as any).userId);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const superAdmin = isSuperAdminRole(user.role);

      if (!superAdmin && user.cityId && user.cityId !== req.params.cityId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { name, slug, type, county, stateCode, zipCodes, parentZoneId } = req.body;
      if (!name || !type) return res.status(400).json({ message: "Name and type are required" });

      const zoneSlug = slug || name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

      const existing = await db.select({ id: zones.id }).from(zones)
        .where(and(eq(zones.cityId, req.params.cityId), eq(zones.slug, zoneSlug)));
      if (existing.length > 0) {
        return res.status(409).json({ message: `Zone with slug "${zoneSlug}" already exists in this city` });
      }

      const [newZone] = await db.insert(zones).values({
        id: crypto.randomUUID(),
        cityId: req.params.cityId,
        name,
        slug: zoneSlug,
        type,
        county: county || null,
        stateCode: stateCode || null,
        zipCodes: Array.isArray(zipCodes) ? zipCodes : zipCodes ? [zipCodes] : [],
        parentZoneId: parentZoneId || null,
      }).returning();

      res.status(201).json(newZone);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/hub-management/city/:cityId/zones/bulk-zip", requireAdmin, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUserById((req.session as any).userId);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const superAdmin = isSuperAdminRole(user.role);

      if (!superAdmin && user.cityId && user.cityId !== req.params.cityId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { zips } = req.body;
      if (!zips || typeof zips !== "string") {
        return res.status(400).json({ message: "Provide comma-separated ZIP codes" });
      }

      const zipList = zips.split(",").map((z: string) => z.trim()).filter(Boolean);
      let created = 0, skipped = 0;

      for (const zip of zipList) {
        const zipSlug = `zip-${zip}`;
        const existing = await db.select({ id: zones.id }).from(zones)
          .where(and(eq(zones.cityId, req.params.cityId), eq(zones.slug, zipSlug)));
        if (existing.length > 0) {
          skipped++;
          continue;
        }
        await db.insert(zones).values({
          id: crypto.randomUUID(),
          cityId: req.params.cityId,
          name: zip,
          slug: zipSlug,
          type: "ZIP",
          zipCodes: [zip],
        });
        created++;
      }

      res.json({ created, skipped, total: zipList.length });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/admin/hub-management/zones/:id", platformGuard, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUserById((req.session as any).userId);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const [existing] = await db.select().from(zones).where(eq(zones.id, req.params.id));
      if (!existing) return res.status(404).json({ message: "Zone not found" });

      if (!isSuperAdminRole(user.role) && user.cityId && existing.cityId !== user.cityId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updates: Record<string, any> = {};
      if (req.body.name !== undefined) updates.name = req.body.name;
      if (req.body.slug !== undefined) updates.slug = req.body.slug;
      if (req.body.type !== undefined) updates.type = req.body.type;
      if (req.body.county !== undefined) updates.county = req.body.county;
      if (req.body.stateCode !== undefined) updates.stateCode = req.body.stateCode;
      if (req.body.zipCodes !== undefined) updates.zipCodes = req.body.zipCodes;
      if (req.body.parentZoneId !== undefined) updates.parentZoneId = req.body.parentZoneId;
      updates.updatedAt = new Date();

      const [updated] = await db.update(zones).set(updates).where(eq(zones.id, req.params.id)).returning();
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/admin/hub-management/zones/:id", platformGuard, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUserById((req.session as any).userId);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const [existing] = await db.select().from(zones).where(eq(zones.id, req.params.id));
      if (!existing) return res.status(404).json({ message: "Zone not found" });

      if (!isSuperAdminRole(user.role) && user.cityId && existing.cityId !== user.cityId) {
        return res.status(403).json({ message: "Access denied" });
      }

      await db.delete(zones).where(eq(zones.id, req.params.id));
      res.json({ message: "Zone deleted" });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/territories", platformGuard, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUserById((req.session as any).userId);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      if (!isSuperAdminRole(user.role) && user.cityId && req.body.cityId && user.cityId !== req.body.cityId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { name, code, type, cityId, status, geoType, geoCodes, siteUrl, emailDomain, parentTerritoryId } = req.body;
      if (!name || !code || !type) return res.status(400).json({ message: "Name, code, and type are required" });

      const existing = await db.select({ id: territories.id }).from(territories).where(eq(territories.code, code));
      if (existing.length > 0) return res.status(409).json({ message: `Territory with code "${code}" already exists` });

      const [newTerritory] = await db.insert(territories).values({
        id: crypto.randomUUID(),
        name,
        code,
        type: type || "METRO",
        cityId: cityId || null,
        status: status || "ACTIVE",
        geoType: geoType || "ZIP",
        geoCodes: Array.isArray(geoCodes) ? geoCodes : [],
        siteUrl: siteUrl || null,
        emailDomain: emailDomain || null,
        parentTerritoryId: parentTerritoryId || null,
      }).returning();

      res.status(201).json(newTerritory);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/hub-management/:id", platformGuard, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUserById((req.session as any).userId);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const superAdmin = isSuperAdminRole(user.role);

      const [territory] = await db.select().from(territories).where(eq(territories.id, req.params.id));
      if (!territory) return res.status(404).json({ message: "Hub not found" });

      if (!superAdmin && user.cityId && territory.cityId !== user.cityId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const [city] = territory.cityId
        ? await db.select({ id: cities.id, name: cities.name }).from(cities).where(eq(cities.id, territory.cityId))
        : [null];

      const ops = await db
        .select({
          id: operatorTerritories.id,
          operatorId: operatorTerritories.operatorId,
          exclusivity: operatorTerritories.exclusivity,
          operatorName: operators.displayName,
          operatorEmail: operators.email,
          operatorType: operators.operatorType,
          operatorStatus: operators.status,
          pipelineStage: operators.pipelineStage,
        })
        .from(operatorTerritories)
        .innerJoin(operators, eq(operatorTerritories.operatorId, operators.id))
        .where(eq(operatorTerritories.territoryId, territory.id));

      const listingsRaw = await db
        .select({ id: territoryListings.id, businessId: territoryListings.businessId })
        .from(territoryListings)
        .where(eq(territoryListings.territoryId, territory.id));

      const businessIds = listingsRaw.map(l => l.businessId);
      let topBusinesses: { id: string; name: string }[] = [];
      if (businessIds.length > 0) {
        topBusinesses = await db
          .select({ id: businesses.id, name: businesses.name })
          .from(businesses)
          .where(inArray(businesses.id, businessIds.slice(0, 10)));
      }

      const children = territory.type === "METRO"
        ? await db.select().from(territories).where(eq(territories.parentTerritoryId, territory.id))
        : [];

      res.json({
        ...territory,
        cityName: city?.name || null,
        operators: ops,
        listingCount: listingsRaw.length,
        topBusinesses,
        children,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/admin/hub-management/:id", platformGuard, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUserById((req.session as any).userId);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const [existing] = await db.select().from(territories).where(eq(territories.id, req.params.id));
      if (!existing) return res.status(404).json({ message: "Hub not found" });

      if (!isSuperAdminRole(user.role) && user.cityId && existing.cityId !== user.cityId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const allowedFields: Record<string, any> = {};
      const { name, code, status, cityId, geoType, geoCodes, siteUrl, emailDomain, parentTerritoryId } = req.body;
      if (name !== undefined) allowedFields.name = name;
      if (code !== undefined) allowedFields.code = code;
      if (status !== undefined) allowedFields.status = status;
      if (cityId !== undefined) allowedFields.cityId = cityId;
      if (geoType !== undefined) allowedFields.geoType = geoType;
      if (geoCodes !== undefined) allowedFields.geoCodes = geoCodes;
      if (siteUrl !== undefined) allowedFields.siteUrl = siteUrl;
      if (emailDomain !== undefined) allowedFields.emailDomain = emailDomain;
      if (parentTerritoryId !== undefined) allowedFields.parentTerritoryId = parentTerritoryId;
      allowedFields.updatedAt = new Date();

      const [updated] = await db.update(territories).set(allowedFields).where(eq(territories.id, req.params.id)).returning();
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/admin/hub-management/:id", platformGuard, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUserById((req.session as any).userId);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const superAdmin = isSuperAdminRole(user.role);
      if (!superAdmin) return res.status(403).json({ message: "Only Super Admins can delete hubs" });

      const [existing] = await db.select().from(territories).where(eq(territories.id, req.params.id));
      if (!existing) return res.status(404).json({ message: "Hub not found" });

      const children = await db.select({ id: territories.id }).from(territories).where(eq(territories.parentTerritoryId, req.params.id));
      if (children.length > 0) {
        return res.status(400).json({ message: "Cannot delete a metro hub with micro hubs. Remove micro hubs first." });
      }

      const assignments = await db.select({ id: operatorTerritories.id }).from(operatorTerritories).where(eq(operatorTerritories.territoryId, req.params.id));
      if (assignments.length > 0) {
        return res.status(400).json({ message: "Cannot delete a hub with operator assignments. Remove assignments first." });
      }

      await db.delete(territoryListings).where(eq(territoryListings.territoryId, req.params.id));
      await db.delete(territories).where(eq(territories.id, req.params.id));
      res.json({ message: "Hub deleted" });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/tools/hubs/ensure-slugs", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { runHubSlugAudit } = await import("./hub-slug-audit");
      const dryRun = req.query.dryRun === "true";
      const entries = await runHubSlugAudit(dryRun);

      const ok = entries.filter(e => e.status === "OK").length;
      const created = entries.filter(e => e.status === "CREATED").length;
      const fixedInvalid = entries.filter(e => e.status === "FIXED_INVALID").length;
      const fixedDuplicate = entries.filter(e => e.status === "FIXED_DUPLICATE").length;

      res.json({
        summary: { total: entries.length, ok, created, fixedInvalid, fixedDuplicate, dryRun },
        entries: entries.map(e => ({
          hubId: e.id,
          hubName: e.name,
          table: e.table,
          county: e.county,
          zips: e.zips,
          oldSlug: e.oldSlug,
          newSlug: e.newSlug,
          status: e.status,
          collisionNotes: e.collisionNotes,
        })),
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });
}
