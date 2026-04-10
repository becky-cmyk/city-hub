import { type Express, type Request, type Response } from "express";
import { storage } from "./storage";
import { runImportJob, getDailyUsage, fetchPlaceDetails, type ImportSummary } from "./google-places";
import { seedPlacesImport } from "./seed-places-import";
import { seedPinevillePlaces, runPinevilleCrownScan } from "./seed-pineville";
import { createInboxItemIfNotOpen } from "./admin-inbox";
import { db } from "./db";
import { regions } from "@shared/schema";
import { eq, and, asc } from "drizzle-orm";
import { z } from "zod";
import { generateBusinessSlug } from "./lib/slug-utils";
import { queueTranslation } from "./services/auto-translate";

export function registerPlacesRoutes(app: Express, requireAdmin: (req: Request, res: Response, next: Function) => void) {
  // ===== PLACES IMPORT JOBS =====

  app.get("/api/admin/places/usage", requireAdmin, async (_req: Request, res: Response) => {
    res.json(getDailyUsage());
  });

  app.post("/api/admin/places/import-jobs", requireAdmin, async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        mode: z.enum(["text_search", "nearby_search"]),
        areaMode: z.enum(["zip", "manual", "clt_default", "hub"]).default("clt_default"),
        hubRegionId: z.string().optional(),
        zipCode: z.string().optional(),
        queryText: z.string().optional(),
        categoryKeyword: z.string().optional(),
        centerLat: z.string().optional(),
        centerLng: z.string().optional(),
        radiusMeters: z.number().optional(),
        requestedCount: z.number().min(1).max(60).default(20),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });

      const data = parsed.data;
      let resolvedLat = data.centerLat;
      let resolvedLng = data.centerLng;
      let resolvedRadius = data.radiusMeters;
      let resolvedAreaLabel = "";

      if (data.areaMode === "hub") {
        if (!data.hubRegionId) return res.status(400).json({ message: "Hub region ID required for hub area mode" });
        const [hub] = await db.select().from(regions).where(eq(regions.id, data.hubRegionId)).limit(1);
        if (!hub) return res.status(400).json({ message: "Hub region not found" });
        if (!hub.centerLat || !hub.centerLng) return res.status(400).json({ message: "Hub has no center coordinates" });
        resolvedLat = hub.centerLat;
        resolvedLng = hub.centerLng;
        resolvedRadius = data.radiusMeters || 5000;
        resolvedAreaLabel = `Hub: ${hub.name}`;
      } else if (data.areaMode === "zip") {
        if (!data.zipCode) return res.status(400).json({ message: "ZIP code is required for zip area mode" });
        const zipGeo = await storage.getZipGeo(data.zipCode);
        if (!zipGeo) return res.status(400).json({ message: `ZIP ${data.zipCode} not found in zip_geos. Import ZIP dataset first.` });
        resolvedLat = zipGeo.lat;
        resolvedLng = zipGeo.lng;
        resolvedRadius = data.radiusMeters || zipGeo.radiusMeters;
        resolvedAreaLabel = `ZIP ${data.zipCode}`;
      } else if (data.areaMode === "manual") {
        if (!data.centerLat || !data.centerLng) return res.status(400).json({ message: "Center coordinates required for manual mode" });
        resolvedRadius = data.radiusMeters || 5000;
        resolvedAreaLabel = `Manual ${data.centerLat},${data.centerLng} r=${resolvedRadius}`;
      } else {
        resolvedLat = process.env.CLT_CENTER_LAT || "35.2271";
        resolvedLng = process.env.CLT_CENTER_LNG || "-80.8431";
        resolvedRadius = parseInt(process.env.CLT_DEFAULT_RADIUS_METERS || "6000");
        resolvedAreaLabel = "Charlotte default";
      }

      if (data.mode === "text_search" && !data.queryText) {
        return res.status(400).json({ message: "Query text is required for text search" });
      }

      if (data.mode === "nearby_search" && !resolvedLat) {
        return res.status(400).json({ message: "Could not resolve center coordinates" });
      }

      const job = await storage.createPlaceImportJob({
        createdByUserId: (req as any).session.userId,
        mode: data.mode,
        areaMode: data.areaMode as any,
        hubRegionId: data.hubRegionId || null,
        zipCode: data.zipCode || null,
        queryText: data.queryText || null,
        categoryKeyword: data.categoryKeyword || null,
        centerLat: resolvedLat || null,
        centerLng: resolvedLng || null,
        radiusMeters: resolvedRadius || null,
        resolvedAreaLabel,
        requestedCount: data.requestedCount,
        status: "queued",
        importedCount: 0,
      });

      runImportJob(job.id)
        .then((summary: ImportSummary) => {
          console.log(`[Places Import] Job ${job.id} completed:`, JSON.stringify(summary));
        })
        .catch((err) => {
          console.error(`[Places Import] Job ${job.id} failed:`, err.message);
        });

      res.status(201).json(job);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/places/import-jobs", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const jobs = await storage.listPlaceImportJobs();
      res.json(jobs);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/places/import-jobs/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const job = await storage.getPlaceImportJob(req.params.id as string);
      if (!job) return res.status(404).json({ message: "Not found" });
      if (job.status === "completed" || job.status === "failed") {
        const results = await storage.getPlaceImportResults(req.params.id as string);
        const summary = {
          totalFound: results.length,
          imported: results.filter((r: any) => r.status === "presence_created").length,
          skipped: results.filter((r: any) => r.status === "skipped").length,
          failed: results.filter((r: any) => r.status === "failed").length,
          skipReasons: {} as Record<string, number>,
          failReasons: {} as Record<string, number>,
        };
        for (const r of results as any[]) {
          if (r.status === "skipped" && r.skipReason) {
            summary.skipReasons[r.skipReason] = (summary.skipReasons[r.skipReason] || 0) + 1;
          }
          if (r.status === "failed" && r.skipReason) {
            summary.failReasons[r.skipReason] = (summary.failReasons[r.skipReason] || 0) + 1;
          }
        }
        res.json({ ...job, summary });
      } else {
        res.json(job);
      }
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/places/import-jobs/:id/results", requireAdmin, async (req: Request, res: Response) => {
    try {
      const results = await storage.getPlaceImportResults(req.params.id as string);
      const summary = {
        totalFound: results.length,
        imported: results.filter((r: any) => r.status === "presence_created").length,
        skipped: results.filter((r: any) => r.status === "skipped").length,
        failed: results.filter((r: any) => r.status === "failed").length,
        pending: results.filter((r: any) => r.status === "discovered" || r.status === "details_fetched").length,
        skipReasons: {} as Record<string, number>,
        failReasons: {} as Record<string, number>,
      };
      for (const r of results as any[]) {
        if (r.status === "skipped" && r.skipReason) {
          summary.skipReasons[r.skipReason] = (summary.skipReasons[r.skipReason] || 0) + 1;
        }
        if (r.status === "failed" && r.skipReason) {
          summary.failReasons[r.skipReason] = (summary.failReasons[r.skipReason] || 0) + 1;
        }
      }
      res.json({ results, summary });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ===== LISTINGS TO CLAIM QUEUE =====

  app.get("/api/admin/listings-to-claim", requireAdmin, async (req: Request, res: Response) => {
    try {
      const filters: { status?: string; source?: string } = {};
      if (req.query.status) filters.status = req.query.status as string;
      if (req.query.source) filters.source = req.query.source as string;
      const items = await storage.listListingsToClaimQueue(filters);
      res.json(items);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/admin/listings-to-claim/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        status: z.enum(["ready", "published_free", "claimed", "archived"]).optional(),
        notes: z.string().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });

      const item = await storage.updateListingsToClaimQueue(req.params.id as string, parsed.data);
      if (!item) return res.status(404).json({ message: "Not found" });

      if (parsed.data.status === "published_free") {
        await storage.updateBusiness(item.presenceId, {
          presenceStatus: "ACTIVE",
          listingTier: "VERIFIED",
        });
      }

      res.json(item);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/listings-to-claim/bulk", requireAdmin, async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        ids: z.array(z.string()).min(1),
        action: z.enum(["publish_free", "archive"]),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });

      const results = [];
      for (const id of parsed.data.ids) {
        const newStatus = parsed.data.action === "publish_free" ? "published_free" : "archived";
        const item = await storage.updateListingsToClaimQueue(id, { status: newStatus });
        if (item && parsed.data.action === "publish_free") {
          await storage.updateBusiness(item.presenceId, {
            presenceStatus: "ACTIVE",
            listingTier: "VERIFIED",
          });
        }
        results.push(item);
      }
      res.json({ updated: results.length });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ===== ZIP GEOS =====

  app.get("/api/admin/zip-geos", requireAdmin, async (req: Request, res: Response) => {
    try {
      const search = req.query.search as string | undefined;
      const items = await storage.listZipGeos(search);
      const count = await storage.getZipGeoCount();
      res.json({ items, totalCount: count });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/zip-geos/:zip", requireAdmin, async (req: Request, res: Response) => {
    try {
      const geo = await storage.getZipGeo(req.params.zip as string);
      if (!geo) return res.status(404).json({ message: "ZIP not found" });
      res.json(geo);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/zip-geos/import-csv", requireAdmin, async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        rows: z.array(z.object({
          zip: z.string().min(3),
          city: z.string().min(1),
          state: z.string().min(1),
          lat: z.string(),
          lng: z.string(),
          radiusMeters: z.number().optional(),
        })),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });

      let imported = 0;
      for (const row of parsed.data.rows) {
        await storage.upsertZipGeo({
          zip: row.zip,
          city: row.city,
          state: row.state,
          lat: row.lat,
          lng: row.lng,
          radiusMeters: row.radiusMeters || 3500,
        });
        imported++;
      }
      res.json({ imported, total: await storage.getZipGeoCount() });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ===== HUB REGIONS + ZIP COVERAGE =====

  app.get("/api/admin/hubs", requireAdmin, async (req: Request, res: Response) => {
    try {
      const countyId = req.query.countyId as string | undefined;
      const hubs = await storage.listHubRegions(countyId);
      res.json(hubs);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/hubs/counties", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const counties = await db.select().from(regions)
        .where(eq(regions.regionType, "county"))
        .orderBy(asc(regions.name));
      res.json(counties);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/hubs/:hubId/coverage", requireAdmin, async (req: Request, res: Response) => {
    try {
      const coverage = await storage.getHubCoverage(req.params.hubId as string);
      res.json(coverage);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/hubs/:hubId/coverage", requireAdmin, async (req: Request, res: Response) => {
    try {
      const covSchema = z.object({
        zip: z.string().min(3),
        confidence: z.enum(["high", "med", "low"]).default("low"),
        notes: z.string().optional(),
      });
      const parsed = covSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });

      const zipGeo = await storage.getZipGeo(parsed.data.zip);
      if (!zipGeo) return res.status(400).json({ message: `ZIP ${parsed.data.zip} not found in zip_geos` });

      const row = await storage.upsertHubZipCoverage({
        hubRegionId: req.params.hubId as string,
        zip: parsed.data.zip,
        confidence: parsed.data.confidence,
        notes: parsed.data.notes || null,
      });
      res.status(201).json(row);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/hubs/:hubId/coverage/bulk", requireAdmin, async (req: Request, res: Response) => {
    try {
      const bulkSchema = z.object({
        zips: z.array(z.string().min(3)),
        confidence: z.enum(["high", "med", "low"]).default("low"),
        notes: z.string().optional(),
      });
      const parsed = bulkSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });

      const results = { inserted: 0, missing: [] as string[] };
      for (const zip of parsed.data.zips) {
        const zipGeo = await storage.getZipGeo(zip);
        if (!zipGeo) {
          results.missing.push(zip);
          continue;
        }
        await storage.upsertHubZipCoverage({
          hubRegionId: req.params.hubId as string,
          zip,
          confidence: parsed.data.confidence,
          notes: parsed.data.notes || null,
        });
        results.inserted++;
      }
      res.json(results);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/admin/hubs/coverage/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await storage.deleteHubZipCoverage(req.params.id as string);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ===== QUICK CLAIM: LOOKUP =====
  app.post("/api/admin/claim-lookup", requireAdmin, async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        input: z.string().min(1, "Please provide a Google Maps URL, Place ID, or business name"),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });

      const raw = parsed.data.input.trim();
      let placeId: string | null = null;

      // Try to extract Place ID from Google Maps URLs
      // Formats: https://maps.google.com/?cid=... , https://www.google.com/maps/place/...
      // Also: place_id directly like "ChIJ..."
      const cidMatch = raw.match(/[?&]cid=(\d+)/);
      const placeIdParam = raw.match(/[?&]place_id=([^&]+)/);
      const ftidMatch = raw.match(/[?&]ftid=(0x[^&:]+:[^&]+)/);

      if (placeIdParam) {
        placeId = decodeURIComponent(placeIdParam[1]);
      } else if (raw.startsWith("ChIJ") || raw.startsWith("0x")) {
        placeId = raw;
      } else if (cidMatch || ftidMatch || raw.includes("google.com/maps")) {
        // For CID-based or complex URLs, use Find Place to resolve
        const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.googel_API_Places || process.env.GOOGLE_PLACES_API_KEY;
        if (!apiKey) return res.status(503).json({ message: "Google Maps API key not configured" });

        // Extract business name from URL path if possible
        let searchInput = raw;
        const nameMatch = raw.match(/\/maps\/place\/([^/]+)/);
        if (nameMatch) {
          searchInput = decodeURIComponent(nameMatch[1]).replace(/\+/g, " ");
        }

        const findUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(searchInput)}&inputtype=textquery&fields=place_id,name,formatted_address&key=${apiKey}`;
        const findResp = await fetch(findUrl);
        const findData = await findResp.json() as any;

        if (findData.status === "OK" && findData.candidates?.length > 0) {
          placeId = findData.candidates[0].place_id;
        } else {
          return res.status(404).json({ message: "Could not find a matching business from that URL. Try pasting a direct Google Maps link or a Place ID." });
        }
      } else {
        // Treat as a business name search
        const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.googel_API_Places || process.env.GOOGLE_PLACES_API_KEY;
        if (!apiKey) return res.status(503).json({ message: "Google Maps API key not configured" });

        const findUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(raw)}&inputtype=textquery&fields=place_id,name,formatted_address&locationbias=circle:50000@35.2271,-80.8431&key=${apiKey}`;
        const findResp = await fetch(findUrl);
        const findData = await findResp.json() as any;

        if (findData.status === "OK" && findData.candidates?.length > 0) {
          placeId = findData.candidates[0].place_id;
        } else {
          return res.status(404).json({ message: "No matching business found. Try a more specific name or paste a Google Maps URL." });
        }
      }

      if (!placeId) {
        return res.status(400).json({ message: "Could not extract a Place ID from the input." });
      }

      // Check if already imported
      const existing = await storage.getPresencePlacesSource(placeId);
      let existingPresence = null;
      if (existing) {
        existingPresence = await storage.getBusinessById(existing.presenceId?.toString());
      }

      // Fetch full details
      const details = await fetchPlaceDetails(placeId);

      // Parse address components
      let city = "";
      let state = "";
      let zip = "";
      if (details.address_components) {
        for (const comp of details.address_components) {
          if (comp.types.includes("locality")) city = comp.long_name;
          if (comp.types.includes("administrative_area_level_1")) state = comp.short_name;
          if (comp.types.includes("postal_code")) zip = comp.long_name;
        }
      }

      // Parse hours
      let hours: Record<string, string> | null = null;
      if (details.opening_hours?.weekday_text) {
        hours = {};
        for (const line of details.opening_hours.weekday_text) {
          const parts = line.split(": ");
          if (parts.length >= 2) hours[parts[0].trim()] = parts.slice(1).join(": ").trim();
        }
      }

      res.json({
        placeId: details.place_id,
        name: details.name,
        address: details.formatted_address || "",
        city,
        state,
        zip,
        phone: details.formatted_phone_number || "",
        website: details.website || "",
        hours,
        types: details.types || [],
        lat: details.geometry?.location.lat?.toString() || "",
        lng: details.geometry?.location.lng?.toString() || "",
        alreadyExists: !!existing,
        existingPresence: existingPresence ? { id: existingPresence.id, name: existingPresence.name, slug: existingPresence.slug } : null,
      });
    } catch (e: any) {
      console.error("Claim lookup error:", e);
      res.status(500).json({ message: e.message });
    }
  });

  // ===== QUICK CLAIM: CREATE =====
  app.post("/api/admin/claim-create", requireAdmin, async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        placeId: z.string().optional(),
        name: z.string().min(1),
        address: z.string().optional().default(""),
        city: z.string().optional().default("Charlotte"),
        state: z.string().optional().default("NC"),
        zip: z.string().optional().default(""),
        phone: z.string().optional().default(""),
        websiteUrl: z.string().optional().default(""),
        hours: z.record(z.string()).optional().nullable(),
        lat: z.string().optional().default(""),
        lng: z.string().optional().default(""),
        presenceType: z.enum(["commerce", "organization"]).optional().default("commerce"),
        listingTier: z.enum(["VERIFIED", "ENHANCED"]).optional().default("VERIFIED"),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });

      const data = parsed.data;

      // Check for duplicate place ID
      if (data.placeId) {
        const existing = await storage.getPresencePlacesSource(data.placeId);
        if (existing) {
          const biz = await storage.getBusinessById(existing.presenceId?.toString());
          return res.status(409).json({
            message: `This business already exists as "${biz?.name || "Unknown"}"`,
            existingId: existing.presenceId,
          });
        }
      }

      // Get default city and zone
      const allCities = await storage.getAllCities();
      const cityRecord = allCities.find((c: any) => c.slug === "charlotte") || allCities[0];
      if (!cityRecord) return res.status(500).json({ message: "No city configured" });

      const zones = await storage.getZonesByCityId(cityRecord.id);
      const defaultZone = zones[0];
      if (!defaultZone) return res.status(500).json({ message: "No zone configured" });

      const slug = await generateBusinessSlug(data.name, cityRecord.id, {
        zoneId: defaultZone.id,
        cityName: cityRecord.name || null,
      });

      const presence = await storage.createBusiness({
        cityId: cityRecord.id,
        zoneId: defaultZone.id,
        name: data.name,
        slug,
        description: null,
        address: data.address || null,
        city: data.city || "Charlotte",
        state: data.state || "NC",
        zip: data.zip || null,
        phone: data.phone || null,
        websiteUrl: data.websiteUrl || null,
        hoursOfOperation: data.hours || null,
        googlePlaceId: data.placeId || null,
        latitude: data.lat || null,
        longitude: data.lng || null,
        claimStatus: "UNCLAIMED",
        micrositeTier: "none",
        listingTier: data.listingTier || "VERIFIED",
        categoryIds: [],
        tagIds: [],
        presenceType: data.presenceType || "commerce",
      });

      queueTranslation("business", presence.id);

      if (data.placeId) {
        await storage.createPresencePlacesSource({
          presenceId: presence.id,
          placeId: data.placeId,
        });
      }

      // Add to listings-to-claim queue
      await storage.createListingsToClaimQueue({
        presenceId: presence.id,
        source: data.placeId ? "google_places" : "manual",
        status: "ready",
      });

      // Notify admin inbox
      try {
        await createInboxItemIfNotOpen({
          itemType: "listing_imported_needs_publish",
          relatedTable: "businesses",
          relatedId: presence.id,
          title: `New listing created: ${data.name}`,
          summary: `Quick claim: ${data.address || "No address"}`,
          priority: "low",
        });
      } catch (_) {}

      res.status(201).json(presence);
    } catch (e: any) {
      console.error("Claim create error:", e);
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/places/seed-import", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const result = await seedPlacesImport();
      res.json(result);
    } catch (e: any) {
      console.error("Seed places import error:", e);
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/places/seed-pineville", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const importResult = await seedPinevillePlaces();
      res.json(importResult);
    } catch (e: any) {
      console.error("Seed Pineville error:", e);
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/places/pineville-crown-scan", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const scanResult = await runPinevilleCrownScan();
      res.json(scanResult);
    } catch (e: any) {
      console.error("Pineville Crown scan error:", e);
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/places/seed-pineville-full", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const importResult = await seedPinevillePlaces();
      const scanResult = await runPinevilleCrownScan();
      res.json({
        import: importResult,
        scan: scanResult,
      });
    } catch (e: any) {
      console.error("Pineville full seed error:", e);
      res.status(500).json({ message: e.message });
    }
  });
}
