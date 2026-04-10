import type { Express, Request, Response } from "express";
import multer from "multer";
import { db } from "./db";
import {
  businessFilingsLog,
  multifamilyLog,
  languageUsageLog,
  signalsFeed,
  metroSources,
  sourcePullRuns,
  sourceRawRows,
  rssItems,
  humanMicroPulseLog,
  humanFreeTextLog,
  leadAbandonmentLog,
  communityCampaigns,
  communityCampaignQuestions,
  communityCampaignResponses,
  intelligenceEventLog,
  intelligenceReportRequests,
  intelligenceReportTokens,
  intelligenceReportSnapshots,
  zones,
  cities,
} from "@shared/schema";
import { eq, and, desc, sql, gte, lte, ilike, count, asc, or, inArray, type SQL } from "drizzle-orm";
import { runPull, runAllDue } from "./intelligence/jobRunner";
import { openai } from "./lib/openai";
import crypto from "crypto";
import { sendTerritoryEmail } from "./services/territory-email";
import {
  normalizeBusinessFiling,
  normalizeMultifamily,
  resolveZipToZoneId,
  type RawBusinessFiling,
  type RawMultifamily,
} from "./services/normalize";
import {
  evaluateContentRouting,
  deriveQueueStatus,
  getPulseBlockReasons,
  computeIntegrityFlags,
} from "./services/content-routing-evaluator";
import { runContentIntegrityPass, getZoneType } from "./services/content-normalizer";
import { aiRewriteSummary, aiExtractZoneSlug } from "./lib/ai-content";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function parseCsvToArray(csvText: string): Record<string, string>[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"/, "").replace(/"$/, ""));
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim().replace(/^"/, "").replace(/"$/, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || "";
    });
    rows.push(row);
  }
  return rows;
}

function mapCsvToFiling(row: Record<string, string>): RawBusinessFiling {
  return {
    businessName: row.businessName || row.business_name || row.name || "",
    filingDate: row.filingDate || row.filing_date || row.date || "",
    stateCode: row.stateCode || row.state_code || row.state || "",
    filingExternalId: row.filingExternalId || row.filing_external_id || row.externalId || "",
    status: row.status || "",
    industryCode: row.industryCode || row.industry_code || row.industry || "",
    organizerName: row.organizerName || row.organizer_name || row.organizer || "",
    registeredAgent: row.registeredAgent || row.registered_agent || row.agent || "",
    registeredAddress: row.registeredAddress || row.registered_address || row.address || "",
    mailingAddress: row.mailingAddress || row.mailing_address || "",
    zipCode: row.zipCode || row.zip_code || row.zip || "",
    source: row.source || "csv_import",
    sourceUrl: row.sourceUrl || row.source_url || "",
    notes: row.notes || "",
  };
}

function mapCsvToMultifamily(row: Record<string, string>): RawMultifamily {
  return {
    propertyName: row.propertyName || row.property_name || row.name || "",
    address: row.address || "",
    city: row.city || "",
    stateCode: row.stateCode || row.state_code || row.state || "",
    zipCode: row.zipCode || row.zip_code || row.zip || "",
    unitCount: row.unitCount || row.unit_count || row.units || "",
    developer: row.developer || "",
    managementCompany: row.managementCompany || row.management_company || row.management || "",
    completionDate: row.completionDate || row.completion_date || "",
    leaseUpStatus: row.leaseUpStatus || row.lease_up_status || row.status || "",
    rentLow: row.rentLow || row.rent_low || "",
    rentHigh: row.rentHigh || row.rent_high || "",
    website: row.website || "",
    phone: row.phone || "",
    source: row.source || "csv_import",
    sourceUrl: row.sourceUrl || row.source_url || "",
    notes: row.notes || "",
  };
}

async function getCityId(req: Request): Promise<string | null> {
  const cityIdParam = req.body?.cityId || req.query?.cityId;
  if (cityIdParam) return cityIdParam;
  const result = await db.execute(sql`SELECT id FROM cities LIMIT 1`);
  const rows = result as any;
  if (rows?.rows?.length > 0) return rows.rows[0].id;
  if (Array.isArray(rows) && rows.length > 0) return rows[0].id;
  return null;
}

const cityIdCache = new Map<string, string>();
async function resolveCityId(cityIdOrSlug: string): Promise<string | null> {
  if (!cityIdOrSlug) return null;
  if (cityIdCache.has(cityIdOrSlug)) return cityIdCache.get(cityIdOrSlug)!;
  const byId = await db.select({ id: cities.id }).from(cities).where(eq(cities.id, cityIdOrSlug)).limit(1);
  if (byId.length > 0) { cityIdCache.set(cityIdOrSlug, byId[0].id); return byId[0].id; }
  const bySlug = await db.select({ id: cities.id }).from(cities).where(eq(cities.slug, cityIdOrSlug)).limit(1);
  if (bySlug.length > 0) { cityIdCache.set(cityIdOrSlug, bySlug[0].id); return bySlug[0].id; }
  const fallback = await db.select({ id: cities.id }).from(cities).limit(1);
  if (fallback.length > 0) { cityIdCache.set(cityIdOrSlug, fallback[0].id); return fallback[0].id; }
  return null;
}

export function registerIntelligenceRoutes(app: Express, requireAdmin: any) {
  // ── Business Filings Ingestion (JSON) ──
  app.post("/api/admin/intelligence/ingest/business-filings", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { filings, cityId: cidOverride } = req.body;
      if (!Array.isArray(filings) || filings.length === 0) {
        return res.status(400).json({ message: "filings array required" });
      }
      const cityId = cidOverride || await getCityId(req);
      if (!cityId) return res.status(400).json({ message: "cityId required" });

      let inserted = 0;
      let skipped = 0;

      for (const raw of filings) {
        try {
          const normalized = await normalizeBusinessFiling(raw, cityId);

          if (normalized.filingExternalId) {
            const existing = await db
              .select({ id: businessFilingsLog.id })
              .from(businessFilingsLog)
              .where(eq(businessFilingsLog.filingExternalId, normalized.filingExternalId))
              .limit(1);
            if (existing.length > 0) {
              await db
                .update(businessFilingsLog)
                .set({ ...normalized, updatedAt: new Date() })
                .where(eq(businessFilingsLog.id, existing[0].id));
              skipped++;
              continue;
            }
          } else {
            const existing = await db
              .select({ id: businessFilingsLog.id })
              .from(businessFilingsLog)
              .where(
                and(
                  eq(businessFilingsLog.businessName, normalized.businessName),
                  eq(businessFilingsLog.cityId, cityId),
                  normalized.filingDate ? eq(businessFilingsLog.filingDate, normalized.filingDate) : sql`true`
                )
              )
              .limit(1);
            if (existing.length > 0) {
              skipped++;
              continue;
            }
          }

          const [record] = await db.insert(businessFilingsLog).values(normalized).returning();

          await db.insert(signalsFeed).values({
            cityId,
            zoneId: normalized.zoneId,
            signalType: "business_filing",
            title: `New Filing: ${normalized.businessName}`,
            summary: `${normalized.stateCode} filing${normalized.status ? ` (${normalized.status})` : ""}${normalized.filingDate ? ` on ${normalized.filingDate}` : ""}`,
            relatedTable: "business_filings_log",
            relatedId: record.id,
            signalDate: normalized.filingDate,
          });

          inserted++;
        } catch (e) {
          console.error("[Intelligence] Filing ingestion error:", e);
          skipped++;
        }
      }

      res.json({ inserted, skipped, total: filings.length });
    } catch (error: any) {
      console.error("[Intelligence] Filings batch error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ── Business Filings CSV Upload ──
  app.post("/api/admin/intelligence/ingest/csv/business-filings", requireAdmin, upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ message: "CSV file required" });
      const csvText = req.file.buffer.toString("utf-8");
      const rows = parseCsvToArray(csvText);
      if (rows.length === 0) return res.status(400).json({ message: "No data rows found in CSV" });

      const filings = rows.map(mapCsvToFiling).filter((f) => f.businessName);
      req.body = { filings, cityId: req.body?.cityId || req.query?.cityId };

      const cityId = req.body.cityId || await getCityId(req);
      if (!cityId) return res.status(400).json({ message: "cityId required" });
      req.body.cityId = cityId;

      let inserted = 0;
      let skipped = 0;

      for (const raw of filings) {
        try {
          const normalized = await normalizeBusinessFiling(raw, cityId);
          if (normalized.filingExternalId) {
            const existing = await db
              .select({ id: businessFilingsLog.id })
              .from(businessFilingsLog)
              .where(eq(businessFilingsLog.filingExternalId, normalized.filingExternalId))
              .limit(1);
            if (existing.length > 0) { skipped++; continue; }
          }
          const [record] = await db.insert(businessFilingsLog).values(normalized).returning();
          await db.insert(signalsFeed).values({
            cityId,
            zoneId: normalized.zoneId,
            signalType: "business_filing",
            title: `New Filing: ${normalized.businessName}`,
            summary: `CSV import: ${normalized.stateCode}`,
            relatedTable: "business_filings_log",
            relatedId: record.id,
            signalDate: normalized.filingDate,
          });
          inserted++;
        } catch (e) { skipped++; }
      }

      res.json({ inserted, skipped, total: rows.length });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ── Multifamily Ingestion (JSON) ──
  app.post("/api/admin/intelligence/ingest/multifamily", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { properties, cityId: cidOverride } = req.body;
      if (!Array.isArray(properties) || properties.length === 0) {
        return res.status(400).json({ message: "properties array required" });
      }
      const cityId = cidOverride || await getCityId(req);
      if (!cityId) return res.status(400).json({ message: "cityId required" });

      let inserted = 0;
      let skipped = 0;

      for (const raw of properties) {
        try {
          const normalized = await normalizeMultifamily(raw, cityId);

          const existing = await db
            .select({ id: multifamilyLog.id })
            .from(multifamilyLog)
            .where(
              and(
                eq(multifamilyLog.propertyName, normalized.propertyName),
                eq(multifamilyLog.address, normalized.address),
                eq(multifamilyLog.cityId, cityId)
              )
            )
            .limit(1);

          if (existing.length > 0) {
            await db
              .update(multifamilyLog)
              .set({ ...normalized, updatedAt: new Date() })
              .where(eq(multifamilyLog.id, existing[0].id));
            skipped++;
            continue;
          }

          const [record] = await db.insert(multifamilyLog).values(normalized).returning();

          await db.insert(signalsFeed).values({
            cityId,
            zoneId: normalized.zoneId,
            signalType: "multifamily",
            title: `New Property: ${normalized.propertyName}`,
            summary: `${normalized.address}${normalized.unitCount ? ` (${normalized.unitCount} units)` : ""}`,
            relatedTable: "multifamily_log",
            relatedId: record.id,
            signalDate: normalized.completionDate,
          });

          inserted++;
        } catch (e) {
          console.error("[Intelligence] Multifamily ingestion error:", e);
          skipped++;
        }
      }

      res.json({ inserted, skipped, total: properties.length });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ── Multifamily CSV Upload ──
  app.post("/api/admin/intelligence/ingest/csv/multifamily", requireAdmin, upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ message: "CSV file required" });
      const csvText = req.file.buffer.toString("utf-8");
      const rows = parseCsvToArray(csvText);
      if (rows.length === 0) return res.status(400).json({ message: "No data rows found" });

      const properties = rows.map(mapCsvToMultifamily).filter((p) => p.propertyName && p.address);
      const cityId = req.body?.cityId || req.query?.cityId || await getCityId(req);
      if (!cityId) return res.status(400).json({ message: "cityId required" });

      let inserted = 0;
      let skipped = 0;

      for (const raw of properties) {
        try {
          const normalized = await normalizeMultifamily(raw, cityId);
          const existing = await db
            .select({ id: multifamilyLog.id })
            .from(multifamilyLog)
            .where(
              and(
                eq(multifamilyLog.propertyName, normalized.propertyName),
                eq(multifamilyLog.address, normalized.address),
                eq(multifamilyLog.cityId, cityId)
              )
            )
            .limit(1);
          if (existing.length > 0) { skipped++; continue; }

          const [record] = await db.insert(multifamilyLog).values(normalized).returning();
          await db.insert(signalsFeed).values({
            cityId,
            zoneId: normalized.zoneId,
            signalType: "multifamily",
            title: `New Property: ${normalized.propertyName}`,
            summary: `CSV import: ${normalized.address}`,
            relatedTable: "multifamily_log",
            relatedId: record.id,
            signalDate: normalized.completionDate,
          });
          inserted++;
        } catch (e) { skipped++; }
      }

      res.json({ inserted, skipped, total: rows.length });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ── List / Query Endpoints ──
  app.get("/api/admin/intelligence/business-filings", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { zoneId, outreachStatus, stateCode, dateFrom, dateTo, search, limit: limitParam, offset: offsetParam } = req.query;
      const conditions: any[] = [];

      if (zoneId) conditions.push(eq(businessFilingsLog.zoneId, zoneId as string));
      if (outreachStatus) conditions.push(eq(businessFilingsLog.outreachStatus, outreachStatus as any));
      if (stateCode) conditions.push(eq(businessFilingsLog.stateCode, stateCode as string));
      if (dateFrom) conditions.push(gte(businessFilingsLog.filingDate, dateFrom as string));
      if (dateTo) conditions.push(lte(businessFilingsLog.filingDate, dateTo as string));
      if (search) conditions.push(ilike(businessFilingsLog.businessName, `%${search}%`));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const limit = Math.min(parseInt(limitParam as string) || 100, 500);
      const offset = parseInt(offsetParam as string) || 0;

      const [results, countResult] = await Promise.all([
        db
          .select()
          .from(businessFilingsLog)
          .where(whereClause)
          .orderBy(desc(businessFilingsLog.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ total: count() })
          .from(businessFilingsLog)
          .where(whereClause),
      ]);

      res.json({ filings: results, total: countResult[0]?.total || 0, limit, offset });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/intelligence/multifamily", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { zoneId, leaseUpStatus, partnerStatus, search, limit: limitParam, offset: offsetParam } = req.query;
      const conditions: any[] = [];

      if (zoneId) conditions.push(eq(multifamilyLog.zoneId, zoneId as string));
      if (leaseUpStatus) conditions.push(eq(multifamilyLog.leaseUpStatus, leaseUpStatus as any));
      if (partnerStatus) conditions.push(eq(multifamilyLog.partnerStatus, partnerStatus as any));
      if (search) conditions.push(ilike(multifamilyLog.propertyName, `%${search}%`));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const limit = Math.min(parseInt(limitParam as string) || 100, 500);
      const offset = parseInt(offsetParam as string) || 0;

      const [results, countResult] = await Promise.all([
        db
          .select()
          .from(multifamilyLog)
          .where(whereClause)
          .orderBy(desc(multifamilyLog.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ total: count() })
          .from(multifamilyLog)
          .where(whereClause),
      ]);

      res.json({ properties: results, total: countResult[0]?.total || 0, limit, offset });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/intelligence/signals", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { signalType, zoneId, limit: limitParam, offset: offsetParam } = req.query;
      const conditions: any[] = [];

      if (signalType) conditions.push(eq(signalsFeed.signalType, signalType as any));
      if (zoneId) conditions.push(eq(signalsFeed.zoneId, zoneId as string));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const limit = Math.min(parseInt(limitParam as string) || 100, 500);
      const offset = parseInt(offsetParam as string) || 0;

      const [results, countResult] = await Promise.all([
        db
          .select()
          .from(signalsFeed)
          .where(whereClause)
          .orderBy(desc(signalsFeed.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ total: count() })
          .from(signalsFeed)
          .where(whereClause),
      ]);

      res.json({ signals: results, total: countResult[0]?.total || 0, limit, offset });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/intelligence/language-stats", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { dateFrom, dateTo, zoneId } = req.query;
      const conditions: any[] = [];
      if (zoneId) conditions.push(eq(languageUsageLog.zoneId, zoneId as string));
      if (dateFrom) conditions.push(gte(languageUsageLog.createdAt, new Date(dateFrom as string)));
      if (dateTo) conditions.push(lte(languageUsageLog.createdAt, new Date(dateTo as string)));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [byLanguage, byEventType, topSearches, byZone, totalCount] = await Promise.all([
        db
          .select({ language: languageUsageLog.language, count: count() })
          .from(languageUsageLog)
          .where(whereClause)
          .groupBy(languageUsageLog.language),
        db
          .select({ eventType: languageUsageLog.eventType, count: count() })
          .from(languageUsageLog)
          .where(whereClause)
          .groupBy(languageUsageLog.eventType),
        db
          .select({ queryText: languageUsageLog.queryText, count: count() })
          .from(languageUsageLog)
          .where(
            and(
              whereClause,
              eq(languageUsageLog.eventType, "search_submit"),
              sql`${languageUsageLog.queryText} IS NOT NULL`
            )
          )
          .groupBy(languageUsageLog.queryText)
          .orderBy(desc(count()))
          .limit(20),
        db
          .select({ zoneId: languageUsageLog.zoneId, count: count() })
          .from(languageUsageLog)
          .where(and(whereClause, sql`${languageUsageLog.zoneId} IS NOT NULL`))
          .groupBy(languageUsageLog.zoneId)
          .orderBy(desc(count()))
          .limit(30),
        db
          .select({ total: count() })
          .from(languageUsageLog)
          .where(whereClause),
      ]);

      res.json({
        total: totalCount[0]?.total || 0,
        byLanguage,
        byEventType,
        topSearches,
        byZone,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ── Update Status Endpoints ──
  app.patch("/api/admin/intelligence/business-filings/:id/status", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { outreachStatus, notes } = req.body;
      const updates: any = { updatedAt: new Date() };
      if (outreachStatus) updates.outreachStatus = outreachStatus;
      if (notes !== undefined) updates.notes = notes;

      await db.update(businessFilingsLog).set(updates).where(eq(businessFilingsLog.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/admin/intelligence/multifamily/:id/status", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { partnerStatus, leaseUpStatus, qrInstalledFlag, hubIntegratedFlag, notes } = req.body;
      const updates: any = { updatedAt: new Date() };
      if (partnerStatus) updates.partnerStatus = partnerStatus;
      if (leaseUpStatus) updates.leaseUpStatus = leaseUpStatus;
      if (qrInstalledFlag !== undefined) updates.qrInstalledFlag = qrInstalledFlag;
      if (hubIntegratedFlag !== undefined) updates.hubIntegratedFlag = hubIntegratedFlag;
      if (notes !== undefined) updates.notes = notes;

      await db.update(multifamilyLog).set(updates).where(eq(multifamilyLog.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ── CSV Export Endpoints ──
  app.get("/api/admin/intelligence/export/business-filings.csv", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { zoneId, outreachStatus, stateCode } = req.query;
      const conditions: any[] = [];
      if (zoneId) conditions.push(eq(businessFilingsLog.zoneId, zoneId as string));
      if (outreachStatus) conditions.push(eq(businessFilingsLog.outreachStatus, outreachStatus as any));
      if (stateCode) conditions.push(eq(businessFilingsLog.stateCode, stateCode as string));

      const results = await db
        .select()
        .from(businessFilingsLog)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(businessFilingsLog.createdAt));

      const headers = ["id","businessName","filingDate","stateCode","filingExternalId","status","industryCode","organizerName","registeredAgent","registeredAddress","mailingAddress","source","outreachStatus","notes","createdAt"];
      const csvLines = [headers.join(",")];
      for (const r of results) {
        csvLines.push(headers.map((h) => {
          const val = (r as any)[h];
          if (val == null) return "";
          return `"${String(val).replace(/"/g, '""')}"`;
        }).join(","));
      }

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=business-filings.csv");
      res.send(csvLines.join("\n"));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/intelligence/export/multifamily.csv", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { zoneId, leaseUpStatus, partnerStatus } = req.query;
      const conditions: any[] = [];
      if (zoneId) conditions.push(eq(multifamilyLog.zoneId, zoneId as string));
      if (leaseUpStatus) conditions.push(eq(multifamilyLog.leaseUpStatus, leaseUpStatus as any));
      if (partnerStatus) conditions.push(eq(multifamilyLog.partnerStatus, partnerStatus as any));

      const results = await db
        .select()
        .from(multifamilyLog)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(multifamilyLog.createdAt));

      const headers = ["id","propertyName","address","city","stateCode","unitCount","developer","managementCompany","completionDate","leaseUpStatus","rentLow","rentHigh","website","phone","source","partnerStatus","qrInstalledFlag","hubIntegratedFlag","notes","createdAt"];
      const csvLines = [headers.join(",")];
      for (const r of results) {
        csvLines.push(headers.map((h) => {
          const val = (r as any)[h];
          if (val == null) return "";
          return `"${String(val).replace(/"/g, '""')}"`;
        }).join(","));
      }

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=multifamily.csv");
      res.send(csvLines.join("\n"));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/intelligence/export/signals.csv", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { signalType, zoneId } = req.query;
      const conditions: any[] = [];
      if (signalType) conditions.push(eq(signalsFeed.signalType, signalType as any));
      if (zoneId) conditions.push(eq(signalsFeed.zoneId, zoneId as string));

      const results = await db
        .select()
        .from(signalsFeed)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(signalsFeed.createdAt));

      const headers = ["id","signalType","title","summary","relatedTable","relatedId","signalDate","score","createdAt"];
      const csvLines = [headers.join(",")];
      for (const r of results) {
        csvLines.push(headers.map((h) => {
          const val = (r as any)[h];
          if (val == null) return "";
          return `"${String(val).replace(/"/g, '""')}"`;
        }).join(","));
      }

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=signals.csv");
      res.send(csvLines.join("\n"));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ── Public Language/Demand Logging (NO auth — lightweight fire-and-forget) ──
  app.post("/api/log/page-view", async (req: Request, res: Response) => {
    res.status(200).json({ ok: true });
    try {
      const { cityId: rawCityId, zipCode, pageType, pageRefId, language } = req.body;
      if (!rawCityId || !pageType || !language) return;
      const cityId = await resolveCityId(rawCityId);
      if (!cityId) return;
      const zoneId = await resolveZipToZoneId(zipCode, cityId);
      await db.insert(languageUsageLog).values({
        cityId,
        zoneId,
        pageType,
        pageRefId: pageRefId || null,
        language: language === "es" ? "es" : "en",
        eventType: "page_view",
      });
    } catch (e) {}
  });

  app.post("/api/log/language-toggle", async (req: Request, res: Response) => {
    res.status(200).json({ ok: true });
    try {
      const { cityId: rawCityId, zipCode, pageType, pageRefId, language } = req.body;
      if (!rawCityId || !language) return;
      const cityId = await resolveCityId(rawCityId);
      if (!cityId) return;
      const zoneId = await resolveZipToZoneId(zipCode, cityId);
      await db.insert(languageUsageLog).values({
        cityId,
        zoneId,
        pageType: pageType || "unknown",
        pageRefId: pageRefId || null,
        language: language === "es" ? "es" : "en",
        eventType: "toggle_language",
      });
    } catch (e) {}
  });

  app.post("/api/log/search", async (req: Request, res: Response) => {
    res.status(200).json({ ok: true });
    try {
      const { cityId: rawCityId, citySlug, zipCode, language, queryText, query, categoryId, locationDetected, locationName, locationType } = req.body;
      const resolvedQuery = (typeof queryText === "string" ? queryText : typeof query === "string" ? query : "").substring(0, 200);
      if (!resolvedQuery) return;
      let cityId: string | null = null;
      if (rawCityId) {
        cityId = await resolveCityId(rawCityId);
      } else if (citySlug) {
        const bySlug = await db.select({ id: cities.id }).from(cities).where(eq(cities.slug, String(citySlug).substring(0, 100))).limit(1);
        cityId = bySlug[0]?.id || null;
      }
      if (!cityId) return;
      const zoneId = await resolveZipToZoneId(zipCode, cityId);
      const locationSource = locationDetected
        ? `location:${(typeof locationType === "string" ? locationType : "unknown").substring(0, 20)}:${(typeof locationName === "string" ? locationName : "").substring(0, 100)}`
        : undefined;
      await db.insert(languageUsageLog).values({
        cityId,
        zoneId,
        pageType: "search",
        language: language === "es" ? "es" : "en",
        eventType: "search_submit",
        queryText: resolvedQuery,
        categoryId: categoryId || null,
        source: locationSource || "search",
      });
    } catch (e) {}
  });

  // ── Admin Zone list for dropdowns ──
  app.get("/api/admin/intelligence/zones", requireAdmin, async (req: Request, res: Response) => {
    try {
      const results = await db
        .select({ id: zones.id, name: zones.name, type: zones.type, zipCodes: zones.zipCodes })
        .from(zones)
        .where(eq(zones.type, "ZIP"))
        .orderBy(zones.name);
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ═══════════════════════════════════════════════════════
  // Metro Sources Framework — Connector Registry + Job Runner
  // ═══════════════════════════════════════════════════════

  app.get("/api/admin/intelligence/sources", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { cityId } = req.query;
      const conditions: SQL[] = [];
      if (cityId) conditions.push(eq(metroSources.cityId, String(cityId)));

      const rows = conditions.length
        ? await db.select().from(metroSources).where(and(...conditions)).orderBy(asc(metroSources.name))
        : await db.select().from(metroSources).orderBy(asc(metroSources.name));

      const itemCounts = await db
        .select({
          metroSourceId: sourceRawRows.metroSourceId,
          itemCount: sql<number>`count(*)::int`,
        })
        .from(sourceRawRows)
        .groupBy(sourceRawRows.metroSourceId);

      const countMap = new Map(itemCounts.map(r => [r.metroSourceId, r.itemCount]));
      const enriched = rows.map(r => ({ ...r, itemCount: countMap.get(r.id) ?? 0 }));

      res.json(enriched);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ message: msg });
    }
  });

  app.post("/api/admin/intelligence/sources", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { cityId, name, sourceType, baseUrl, datasetId, layerUrl, paramsJson, pullFrequency, enabled } = req.body;
      if (!cityId || !name || !sourceType) {
        return res.status(400).json({ message: "cityId, name, sourceType required" });
      }
      let parsedParams = paramsJson;
      if (typeof paramsJson === "string") {
        try { parsedParams = JSON.parse(paramsJson); } catch { parsedParams = {}; }
      }
      const [row] = await db.insert(metroSources).values({
        cityId,
        name,
        sourceType,
        baseUrl: baseUrl || null,
        datasetId: datasetId || null,
        layerUrl: layerUrl || null,
        paramsJson: parsedParams || {},
        pullFrequency: pullFrequency || "DAILY",
        enabled: enabled ?? false,
      }).returning();
      res.json(row);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/admin/intelligence/sources/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates: any = { updatedAt: new Date() };
      const allowed = ["name", "sourceType", "baseUrl", "datasetId", "layerUrl", "pullFrequency", "enabled"];
      for (const key of allowed) {
        if (req.body[key] !== undefined) updates[key] = req.body[key];
      }
      if (req.body.paramsJson !== undefined) {
        let p = req.body.paramsJson;
        if (typeof p === "string") {
          try { p = JSON.parse(p); } catch { p = {}; }
        }
        updates.paramsJson = p;
      }
      const [row] = await db.update(metroSources).set(updates).where(eq(metroSources.id, id)).returning();
      if (!row) return res.status(404).json({ message: "Source not found" });
      res.json(row);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/admin/intelligence/sources/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await db.delete(sourceRawRows).where(eq(sourceRawRows.metroSourceId, id));
      await db.delete(sourcePullRuns).where(eq(sourcePullRuns.metroSourceId, id));
      await db.delete(metroSources).where(eq(metroSources.id, id));
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/intelligence/sources/:id/runs", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const limit = Math.min(parseInt(String(req.query.limit) || "20"), 100);
      const rows = await db
        .select()
        .from(sourcePullRuns)
        .where(eq(sourcePullRuns.metroSourceId, id))
        .orderBy(desc(sourcePullRuns.startedAt))
        .limit(limit);
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/intelligence/sources/:id/rows", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const limit = Math.min(parseInt(String(req.query.limit) || "20"), 100);
      const offset = parseInt(String(req.query.offset) || "0");
      const [countResult] = await db
        .select({ total: count() })
        .from(sourceRawRows)
        .where(eq(sourceRawRows.metroSourceId, id));
      const rows = await db
        .select()
        .from(sourceRawRows)
        .where(eq(sourceRawRows.metroSourceId, id))
        .orderBy(desc(sourceRawRows.createdAt))
        .limit(limit)
        .offset(offset);
      res.json({ total: countResult?.total || 0, rows });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/intelligence/run-pulls", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { cityId, sourceType, sourceId } = req.body || {};

      if (sourceId) {
        const [src] = await db.select().from(metroSources).where(eq(metroSources.id, sourceId));
        if (!src) return res.status(404).json({ message: "Source not found" });
        const result = await runPull(src);
        return res.json({ ran: 1, results: [{ sourceId: src.id, name: src.name, ...result }] });
      }

      const conditions: any[] = [eq(metroSources.enabled, true)];
      if (cityId) conditions.push(eq(metroSources.cityId, cityId));
      if (sourceType) conditions.push(eq(metroSources.sourceType, sourceType));

      const sources = await db.select().from(metroSources).where(and(...conditions));
      const results: any[] = [];
      for (const src of sources) {
        console.log(`[RunPulls] Pulling: ${src.name} (${src.sourceType})`);
        const r = await runPull(src);
        results.push({ sourceId: src.id, name: src.name, ...r });
      }
      res.json({ ran: results.length, results });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ═══════════════════════════════════════════════════════
  // RSS Review Routes (T003)
  // ═══════════════════════════════════════════════════════

  app.get("/api/admin/intelligence/rss-items", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { reviewStatus, cityId, sourceId, search, integrityFlag, limit: lim, offset: off } = req.query;
      const conditions: any[] = [];
      if (reviewStatus && reviewStatus !== "all") conditions.push(eq(rssItems.reviewStatus, String(reviewStatus) as any));
      if (cityId) conditions.push(eq(rssItems.cityId, String(cityId)));
      if (sourceId) conditions.push(eq(rssItems.metroSourceId, String(sourceId)));
      if (search) conditions.push(ilike(rssItems.title, `%${search}%`));
      if (integrityFlag && String(integrityFlag) !== "all") {
        conditions.push(sql`${rssItems.integrityFlags}::jsonb @> ${JSON.stringify([String(integrityFlag)])}::jsonb`);
      }

      const limit = Math.min(parseInt(String(lim) || "50"), 200);
      const offset = parseInt(String(off) || "0");

      const [countResult] = await db
        .select({ total: count() })
        .from(rssItems)
        .where(conditions.length ? and(...conditions) : undefined);

      const rows = await db
        .select()
        .from(rssItems)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(rssItems.createdAt))
        .limit(limit)
        .offset(offset);

      const pendingCount = await db
        .select({ total: count() })
        .from(rssItems)
        .where(eq(rssItems.reviewStatus, "PENDING"));

      res.json({ total: countResult?.total || 0, pendingCount: pendingCount[0]?.total || 0, rows });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/admin/intelligence/rss-items/:id/review", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      if (!["APPROVED", "SKIPPED", "FLAGGED"].includes(status)) {
        return res.status(400).json({ message: "Status must be APPROVED, SKIPPED, or FLAGGED" });
      }

      const updates: any = {
        reviewStatus: status,
        reviewedAt: new Date(),
        reviewedBy: (req as any).user?.id || "admin",
        updatedAt: new Date(),
      };

      if (status === "APPROVED") {
        const [item] = await db.select().from(rssItems).where(eq(rssItems.id, id));
        if (item) {
          const result = await aiRewriteSummary(item.title, item.summary, item.sourceName);
          if (result.skip) {
            updates.reviewStatus = "SKIPPED";
            updates.rewrittenSummary = `[AUTO-SKIPPED] ${result.reason}`;
          } else {
            updates.rewrittenSummary = result.rewritten;
            const zoneSlug = await aiExtractZoneSlug(item.title, item.summary);
            if (zoneSlug) updates.zoneSlug = zoneSlug;
          }
        }
      }

      const [row] = await db.update(rssItems).set(updates).where(eq(rssItems.id, id)).returning();
      if (!row) return res.status(404).json({ message: "RSS item not found" });
      res.json(row);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/intelligence/rss-items/bulk-review", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { ids, status } = req.body;
      if (!ids?.length || !["APPROVED", "SKIPPED", "FLAGGED"].includes(status)) {
        return res.status(400).json({ message: "ids array and valid status required" });
      }
      if (status === "APPROVED") {
        let processed = 0;
        let skipped = 0;
        const batchSize = 10;
        const itemRows = await db.select().from(rssItems).where(inArray(rssItems.id, ids));
        for (let i = 0; i < itemRows.length; i += batchSize) {
          const batch = itemRows.slice(i, i + batchSize);
          await Promise.all(batch.map(async (item) => {
            try {
              const result = await aiRewriteSummary(item.title, item.summary, item.sourceName);
              const setObj: any = {
                reviewedAt: new Date(),
                reviewedBy: (req as any).user?.id || "admin",
                updatedAt: new Date(),
              };
              if (result.skip) {
                setObj.reviewStatus = "SKIPPED";
                setObj.rewrittenSummary = `[AUTO-SKIPPED] ${result.reason}`;
                skipped++;
              } else {
                setObj.reviewStatus = status;
                setObj.rewrittenSummary = result.rewritten;
                const zoneSlug = await aiExtractZoneSlug(item.title, item.summary);
                if (zoneSlug) setObj.zoneSlug = zoneSlug;
                processed++;
              }
              await db.update(rssItems).set(setObj).where(eq(rssItems.id, item.id));
            } catch {}
          }));
          if (i + batchSize < itemRows.length) await new Promise(r => setTimeout(r, 1000));
        }
        return res.json({ ok: true, updated: processed, skipped });
      }

      await db.update(rssItems).set({
        reviewStatus: status,
        reviewedAt: new Date(),
        reviewedBy: (req as any).user?.id || "admin",
        updatedAt: new Date(),
      }).where(inArray(rssItems.id, ids));
      res.json({ ok: true, updated: ids.length });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/intelligence/rss-items/bulk-approve-all", requireAdmin, async (req: Request, res: Response) => {
    try {
      const pending = await db
        .select()
        .from(rssItems)
        .where(eq(rssItems.reviewStatus, "PENDING"))
        .orderBy(rssItems.publishedAt);

      if (pending.length === 0) {
        return res.json({ ok: true, total: 0, processed: 0, failed: 0, message: "No pending items" });
      }

      res.writeHead(200, { "Content-Type": "application/x-ndjson", "Transfer-Encoding": "chunked" });

      const stats = { total: pending.length, processed: 0, failed: 0, skipped: 0 };
      const batchSize = 10;

      for (let i = 0; i < pending.length; i += batchSize) {
        const batch = pending.slice(i, i + batchSize);
        await Promise.all(batch.map(async (item) => {
          try {
            const result = await aiRewriteSummary(item.title, item.summary, item.sourceName);
            const setObj: any = {
              reviewedAt: new Date(),
              reviewedBy: (req as any).user?.id || "admin",
              updatedAt: new Date(),
            };
            if (result.skip) {
              setObj.reviewStatus = "SKIPPED";
              setObj.rewrittenSummary = `[AUTO-SKIPPED] ${result.reason}`;
              stats.skipped++;
            } else {
              setObj.reviewStatus = "APPROVED";
              setObj.rewrittenSummary = result.rewritten;
              const zoneSlug = await aiExtractZoneSlug(item.title, item.summary);
              if (zoneSlug) setObj.zoneSlug = zoneSlug;
              stats.processed++;
            }
            await db.update(rssItems).set(setObj).where(eq(rssItems.id, item.id));
          } catch {
            stats.failed++;
          }
        }));

        res.write(JSON.stringify({ ...stats, batch: Math.floor(i / batchSize) + 1 }) + "\n");
        if (i + batchSize < pending.length) await new Promise(r => setTimeout(r, 1000));
      }

      res.write(JSON.stringify({ ...stats, done: true }) + "\n");
      res.end();
    } catch (error: any) {
      if (!res.headersSent) {
        res.status(500).json({ message: error.message });
      } else {
        res.write(JSON.stringify({ error: error.message }) + "\n");
        res.end();
      }
    }
  });

  app.post("/api/admin/intelligence/rss-items/:id/rewrite", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const [item] = await db.select().from(rssItems).where(eq(rssItems.id, id));
      if (!item) return res.status(404).json({ message: "RSS item not found" });

      const result = await aiRewriteSummary(item.title, item.summary, item.sourceName);
      const setObj: any = { updatedAt: new Date() };
      if (result.skip) {
        setObj.rewrittenSummary = `[AUTO-SKIPPED] ${result.reason}`;
      } else {
        setObj.rewrittenSummary = result.rewritten;
      }
      const [updated] = await db.update(rssItems).set(setObj).where(eq(rssItems.id, id)).returning();
      res.json({ ...updated, contentSkipped: result.skip, skipReason: result.reason });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ═══════════════════════════════════════════════════════
  // Public Local Updates API (T005)
  // ═══════════════════════════════════════════════════════

  app.get("/api/content/local-updates", async (req: Request, res: Response) => {
    try {
      const { citySlug, limit: lim, zone } = req.query;
      if (!citySlug) return res.status(400).json({ message: "citySlug required" });

      const cityId = await resolveCityId(String(citySlug));
      if (!cityId) return res.status(404).json({ message: "City not found" });

      const conditions = [eq(rssItems.cityId, cityId), eq(rssItems.reviewStatus, "APPROVED")];
      if (zone) conditions.push(eq(rssItems.zoneSlug, String(zone)));

      const limit = Math.min(parseInt(String(lim) || "12"), 50);
      const rows = await db
        .select({
          id: rssItems.id,
          title: rssItems.title,
          titleEs: rssItems.titleEs,
          url: rssItems.url,
          sourceName: rssItems.sourceName,
          publishedAt: rssItems.publishedAt,
          summary: rssItems.rewrittenSummary,
          summaryEs: rssItems.rewrittenSummaryEs,
          imageUrl: rssItems.imageUrl,
          viewCount: rssItems.viewCount,
          zoneSlug: rssItems.zoneSlug,
        })
        .from(rssItems)
        .where(and(...conditions))
        .orderBy(desc(rssItems.publishedAt))
        .limit(limit);

      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/content/local-updates/page", async (req: Request, res: Response) => {
    try {
      const { citySlug, page, limit: lim, sourceId, zone } = req.query;
      if (!citySlug) return res.status(400).json({ message: "citySlug required" });

      const cityId = await resolveCityId(String(citySlug));
      if (!cityId) return res.status(404).json({ message: "City not found" });

      const limit = Math.min(parseInt(String(lim) || "20"), 50);
      const offset = (Math.max(parseInt(String(page) || "1"), 1) - 1) * limit;

      const conditions = [eq(rssItems.cityId, cityId), eq(rssItems.reviewStatus, "APPROVED")];
      if (sourceId) conditions.push(eq(rssItems.metroSourceId, String(sourceId)));
      if (zone) conditions.push(eq(rssItems.zoneSlug, String(zone)));

      const [countResult] = await db.select({ total: count() }).from(rssItems).where(and(...conditions));
      const rows = await db
        .select({
          id: rssItems.id,
          title: rssItems.title,
          url: rssItems.url,
          sourceName: rssItems.sourceName,
          publishedAt: rssItems.publishedAt,
          summary: rssItems.rewrittenSummary,
          rawSummary: rssItems.summary,
          imageUrl: rssItems.imageUrl,
          viewCount: rssItems.viewCount,
          zoneSlug: rssItems.zoneSlug,
        })
        .from(rssItems)
        .where(and(...conditions))
        .orderBy(desc(rssItems.publishedAt))
        .limit(limit)
        .offset(offset);

      res.json({ total: countResult?.total || 0, page: Math.max(parseInt(String(page) || "1"), 1), rows });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/content/local-updates/:id/view", async (req: Request, res: Response) => {
    try {
      await db.update(rssItems).set({
        viewCount: sql`${rssItems.viewCount} + 1`,
      }).where(eq(rssItems.id, req.params.id));
      res.json({ ok: true });
    } catch (e) {}
  });

  // ═══════════════════════════════════════════════════════
  // Human Intelligence — Micro-Pulse + Abandonment (T008)
  // ═══════════════════════════════════════════════════════

  app.post("/api/human/micro-pulse", async (req: Request, res: Response) => {
    res.json({ ok: true });
    try {
      const { citySlug, zoneId, categoryId, listingId, eventContext, decisionFactor, language, sessionHash } = req.body;
      if (!citySlug || !eventContext || !decisionFactor) return;
      const cityId = await resolveCityId(String(citySlug));
      if (!cityId) return;
      await db.insert(humanMicroPulseLog).values({
        cityId,
        zoneId: zoneId || null,
        categoryId: categoryId || null,
        listingId: listingId || null,
        eventContext,
        decisionFactor,
        language: language || "en",
        sessionHash: sessionHash || null,
      });
    } catch (e) {}
  });

  app.post("/api/human/micro-pulse/free-text", async (req: Request, res: Response) => {
    res.json({ ok: true });
    try {
      const { citySlug, zoneId, listingId, shortReasonText, language, sessionHash } = req.body;
      if (!citySlug || !shortReasonText) return;
      const cityId = await resolveCityId(String(citySlug));
      if (!cityId) return;
      await db.insert(humanFreeTextLog).values({
        cityId,
        zoneId: zoneId || null,
        listingId: listingId || null,
        shortReasonText: String(shortReasonText).slice(0, 250),
        language: language || "en",
        sessionHash: sessionHash || null,
      });
    } catch (e) {}
  });

  app.post("/api/human/lead-abandon", async (req: Request, res: Response) => {
    res.json({ ok: true });
    try {
      const { citySlug, zoneId, categoryId, abandonmentReason, language, sessionHash } = req.body;
      if (!citySlug || !abandonmentReason) return;
      const cityId = await resolveCityId(String(citySlug));
      if (!cityId) return;
      await db.insert(leadAbandonmentLog).values({
        cityId,
        zoneId: zoneId || null,
        categoryId: categoryId || null,
        abandonmentReason,
        language: language || "en",
        sessionHash: sessionHash || null,
      });
    } catch (e) {}
  });

  // ═══════════════════════════════════════════════════════
  // Community Campaign Engine (T010)
  // ═══════════════════════════════════════════════════════

  app.get("/api/admin/intelligence/campaigns", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { cityId } = req.query;
      const conditions: any[] = [];
      if (cityId) conditions.push(eq(communityCampaigns.cityId, String(cityId)));
      const rows = conditions.length
        ? await db.select().from(communityCampaigns).where(and(...conditions)).orderBy(desc(communityCampaigns.createdAt))
        : await db.select().from(communityCampaigns).orderBy(desc(communityCampaigns.createdAt));
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/intelligence/campaigns", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { cityId, title, description, startDate, endDate, isActive } = req.body;
      if (!cityId || !title || !startDate || !endDate) {
        return res.status(400).json({ message: "cityId, title, startDate, endDate required" });
      }
      const [row] = await db.insert(communityCampaigns).values({
        cityId,
        title,
        description: description || null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive: isActive ?? false,
      }).returning();
      res.json(row);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/admin/intelligence/campaigns/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates: any = {};
      if (req.body.title !== undefined) updates.title = req.body.title;
      if (req.body.description !== undefined) updates.description = req.body.description;
      if (req.body.startDate !== undefined) updates.startDate = new Date(req.body.startDate);
      if (req.body.endDate !== undefined) updates.endDate = new Date(req.body.endDate);
      if (req.body.isActive !== undefined) updates.isActive = req.body.isActive;

      const [row] = await db.update(communityCampaigns).set(updates).where(eq(communityCampaigns.id, id)).returning();
      if (!row) return res.status(404).json({ message: "Campaign not found" });
      res.json(row);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/intelligence/campaigns/:id/questions", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { questionText, questionType, optionsJson, language, sortOrder } = req.body;
      if (!questionText || !questionType) {
        return res.status(400).json({ message: "questionText, questionType required" });
      }
      const [row] = await db.insert(communityCampaignQuestions).values({
        campaignId: id,
        questionText,
        questionType,
        optionsJson: optionsJson || null,
        language: language || "en",
        sortOrder: sortOrder || 0,
      }).returning();
      res.json(row);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/intelligence/campaigns/:id/questions", requireAdmin, async (req: Request, res: Response) => {
    try {
      const rows = await db.select().from(communityCampaignQuestions)
        .where(eq(communityCampaignQuestions.campaignId, req.params.id))
        .orderBy(asc(communityCampaignQuestions.sortOrder));
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/admin/intelligence/campaigns/:id/questions/:qid", requireAdmin, async (req: Request, res: Response) => {
    try {
      await db.delete(communityCampaignResponses).where(eq(communityCampaignResponses.questionId, req.params.qid));
      await db.delete(communityCampaignQuestions).where(eq(communityCampaignQuestions.id, req.params.qid));
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/intelligence/campaigns/:id/responses", requireAdmin, async (req: Request, res: Response) => {
    try {
      const questions = await db.select().from(communityCampaignQuestions)
        .where(eq(communityCampaignQuestions.campaignId, req.params.id))
        .orderBy(asc(communityCampaignQuestions.sortOrder));

      const responses = await db.select().from(communityCampaignResponses)
        .where(eq(communityCampaignResponses.campaignId, req.params.id));

      const totalResponders = new Set(responses.map(r => r.sessionHash)).size;

      const summary = questions.map(q => {
        const qResponses = responses.filter(r => r.questionId === q.id);
        if (q.questionType === "MULTIPLE_CHOICE") {
          const optionCounts: Record<string, number> = {};
          qResponses.forEach(r => {
            if (r.selectedOption) optionCounts[r.selectedOption] = (optionCounts[r.selectedOption] || 0) + 1;
          });
          return { question: q.questionText, type: q.questionType, total: qResponses.length, optionCounts };
        } else if (q.questionType === "SCALE") {
          const values = qResponses.filter(r => r.scaleValue != null).map(r => r.scaleValue!);
          const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
          return { question: q.questionText, type: q.questionType, total: values.length, average: Math.round(avg * 10) / 10 };
        } else {
          return { question: q.questionText, type: q.questionType, total: qResponses.length, responses: qResponses.map(r => r.freeTextResponse).filter(Boolean).slice(0, 50) };
        }
      });

      res.json({ totalResponders, questions: summary });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Public campaign endpoints
  app.get("/api/community/active-campaign", async (req: Request, res: Response) => {
    try {
      const { citySlug } = req.query;
      if (!citySlug) return res.status(400).json({ message: "citySlug required" });
      const cityId = await resolveCityId(String(citySlug));
      if (!cityId) return res.json(null);

      const now = new Date();
      const [campaign] = await db.select().from(communityCampaigns)
        .where(and(
          eq(communityCampaigns.cityId, cityId),
          eq(communityCampaigns.isActive, true),
          lte(communityCampaigns.startDate, now),
          gte(communityCampaigns.endDate, now),
        ))
        .limit(1);

      if (!campaign) return res.json(null);

      const questions = await db.select().from(communityCampaignQuestions)
        .where(eq(communityCampaignQuestions.campaignId, campaign.id))
        .orderBy(asc(communityCampaignQuestions.sortOrder))
        .limit(3);

      res.json({ campaign, questions });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/human/campaign-response", async (req: Request, res: Response) => {
    res.json({ ok: true });
    try {
      const { campaignId, citySlug, zoneId, responses, language, sessionHash } = req.body;
      if (!campaignId || !citySlug || !responses?.length) return;
      const cityId = await resolveCityId(String(citySlug));
      if (!cityId) return;

      for (const r of responses) {
        await db.insert(communityCampaignResponses).values({
          campaignId,
          cityId,
          zoneId: zoneId || null,
          questionId: r.questionId,
          selectedOption: r.selectedOption || null,
          freeTextResponse: r.freeTextResponse || null,
          scaleValue: r.scaleValue ?? null,
          language: language || "en",
          sessionHash: sessionHash || null,
        });
      }
    } catch (e) {}
  });

  // ═══════════════════════════════════════════════════════
  // Intelligence Report (T011)
  // ═══════════════════════════════════════════════════════

  app.get("/api/admin/intelligence/report", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { cityId, days } = req.query;
      const dayRange = parseInt(String(days) || "30");
      const since = new Date(Date.now() - dayRange * 24 * 60 * 60 * 1000);
      const conditions: any[] = [];
      if (cityId) conditions.push(eq(languageUsageLog.cityId, String(cityId)));

      // Search Intelligence
      const topSearches = await db
        .select({
          query: languageUsageLog.queryText,
          total: count(),
        })
        .from(languageUsageLog)
        .where(and(
          eq(languageUsageLog.eventType, "search_submit"),
          gte(languageUsageLog.createdAt, since),
          ...(cityId ? [eq(languageUsageLog.cityId, String(cityId))] : []),
        ))
        .groupBy(languageUsageLog.queryText)
        .orderBy(desc(count()))
        .limit(20);

      // Language split
      const langSplit = await db
        .select({
          language: languageUsageLog.language,
          total: count(),
        })
        .from(languageUsageLog)
        .where(and(
          gte(languageUsageLog.createdAt, since),
          ...(cityId ? [eq(languageUsageLog.cityId, String(cityId))] : []),
        ))
        .groupBy(languageUsageLog.language);

      // Page views by type
      const pageViews = await db
        .select({
          pageType: languageUsageLog.pageType,
          total: count(),
        })
        .from(languageUsageLog)
        .where(and(
          eq(languageUsageLog.eventType, "page_view"),
          gte(languageUsageLog.createdAt, since),
          ...(cityId ? [eq(languageUsageLog.cityId, String(cityId))] : []),
        ))
        .groupBy(languageUsageLog.pageType)
        .orderBy(desc(count()));

      // Decision factors (micro-pulse)
      const decisionFactors = await db
        .select({
          factor: humanMicroPulseLog.decisionFactor,
          total: count(),
        })
        .from(humanMicroPulseLog)
        .where(and(
          gte(humanMicroPulseLog.createdAt, since),
          ...(cityId ? [eq(humanMicroPulseLog.cityId, String(cityId))] : []),
        ))
        .groupBy(humanMicroPulseLog.decisionFactor)
        .orderBy(desc(count()));

      // Decision factors by category
      const factorsByCategory = await db
        .select({
          categoryId: humanMicroPulseLog.categoryId,
          factor: humanMicroPulseLog.decisionFactor,
          total: count(),
        })
        .from(humanMicroPulseLog)
        .where(and(
          gte(humanMicroPulseLog.createdAt, since),
          ...(cityId ? [eq(humanMicroPulseLog.cityId, String(cityId))] : []),
        ))
        .groupBy(humanMicroPulseLog.categoryId, humanMicroPulseLog.decisionFactor)
        .orderBy(desc(count()))
        .limit(50);

      // Abandonment reasons
      const abandonmentReasons = await db
        .select({
          reason: leadAbandonmentLog.abandonmentReason,
          total: count(),
        })
        .from(leadAbandonmentLog)
        .where(and(
          gte(leadAbandonmentLog.createdAt, since),
          ...(cityId ? [eq(leadAbandonmentLog.cityId, String(cityId))] : []),
        ))
        .groupBy(leadAbandonmentLog.abandonmentReason)
        .orderBy(desc(count()));

      // Top RSS content
      const topContent = await db
        .select({
          title: rssItems.title,
          sourceName: rssItems.sourceName,
          viewCount: rssItems.viewCount,
          url: rssItems.url,
        })
        .from(rssItems)
        .where(and(
          eq(rssItems.reviewStatus, "APPROVED"),
          ...(cityId ? [eq(rssItems.cityId, String(cityId))] : []),
        ))
        .orderBy(desc(rssItems.viewCount))
        .limit(20);

      // Activity by zone
      const activityByZone = await db
        .select({
          zoneId: humanMicroPulseLog.zoneId,
          total: count(),
        })
        .from(humanMicroPulseLog)
        .where(and(
          gte(humanMicroPulseLog.createdAt, since),
          ...(cityId ? [eq(humanMicroPulseLog.cityId, String(cityId))] : []),
        ))
        .groupBy(humanMicroPulseLog.zoneId)
        .orderBy(desc(count()))
        .limit(30);

      res.json({
        period: { days: dayRange, since: since.toISOString() },
        searchIntelligence: { topSearches },
        languageDemand: { split: langSplit },
        contentEngagement: { pageViews, topContent },
        decisionIntelligence: { overall: decisionFactors, byCategory: factorsByCategory },
        abandonmentPatterns: { reasons: abandonmentReasons },
        activityByZone,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // RSS sources list for public filtering
  app.get("/api/content/rss-sources", async (req: Request, res: Response) => {
    try {
      const { citySlug } = req.query;
      if (!citySlug) return res.json([]);
      const cityId = await resolveCityId(String(citySlug));
      if (!cityId) return res.json([]);
      const rows = await db
        .select({ id: metroSources.id, name: metroSources.name })
        .from(metroSources)
        .where(and(eq(metroSources.cityId, cityId), eq(metroSources.sourceType, "RSS"), eq(metroSources.enabled, true)))
        .orderBy(asc(metroSources.name));
      res.json(rows);
    } catch (error: any) {
      res.json([]);
    }
  });

  // ═══════════════════════════════════════════════════════
  // Public Pulses — Randomized Content Rotation
  // ═══════════════════════════════════════════════════════

  app.get("/api/metro/:citySlug/pulses", async (req: Request, res: Response) => {
    try {
      const cityId = await resolveCityId(req.params.citySlug);
      if (!cityId) return res.status(404).json({ message: "City not found" });

      const limit = Math.min(parseInt(String(req.query.limit) || "20"), 50);
      const contentType = req.query.contentType ? String(req.query.contentType) : null;

      let contentTypeFilter = sql``;
      if (contentType) {
        contentTypeFilter = sql`AND ms.params_json->>'content_type' = ${contentType}`;
      }

      const result = await db.execute(sql`
        SELECT ri.id, ri.title, ri.url, ri.source_name, ri.summary, ri.image_url,
               ri.published_at, ms.params_json->>'content_type' AS content_type
        FROM rss_items ri
        LEFT JOIN metro_sources ms ON ms.id = ri.metro_source_id
        WHERE ri.city_id = ${cityId}
          AND ri.review_status = 'APPROVED'
          ${contentTypeFilter}
        ORDER BY RANDOM()
        LIMIT ${limit}
      `);
      const rows = (result as any).rows ?? result;
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/metro/:citySlug/events", async (req: Request, res: Response) => {
    try {
      const cityId = await resolveCityId(req.params.citySlug);
      if (!cityId) return res.status(404).json({ message: "City not found" });

      const limit = Math.min(parseInt(String(req.query.limit) || "20"), 50);
      const startFilter = req.query.start ? new Date(String(req.query.start)) : new Date();
      const endFilter = req.query.end ? new Date(String(req.query.end)) : null;

      let endClause = sql``;
      if (endFilter && !isNaN(endFilter.getTime())) {
        endClause = sql`AND e.start_date_time <= ${endFilter}`;
      }

      const result = await db.execute(sql`
        SELECT e.id, e.title, e.slug, e.description, e.start_date_time, e.end_date_time,
               e.location_name, e.address, e.city, e.state, e.cost_text, e.image_url,
               e.source_url, e.seed_source_type
        FROM events e
        WHERE e.city_id = ${cityId}
          AND e.start_date_time >= ${startFilter}
          ${endClause}
        ORDER BY e.start_date_time ASC
        LIMIT ${limit}
      `);
      const rows = (result as any).rows ?? result;
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ═══════════════════════════════════════════════════════
  // Admin: Run Feed Ingestion Now
  // ═══════════════════════════════════════════════════════

  app.post("/api/admin/intelligence/run-feed-ingestion", requireAdmin, async (req: Request, res: Response) => {
    try {
      const result = await runAllDue();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ═══════════════════════════════════════════════════════
  // Intelligence Event Log (T002)
  // ═══════════════════════════════════════════════════════

  app.post("/api/intelligence/log", async (req: Request, res: Response) => {
    res.json({ ok: true });
    try {
      const { metroId, citySlug, entityType, entityId, eventType, zipOrigin, language, referrer, metadata } = req.body;
      if (!entityType || !entityId || !eventType) return;

      let resolvedMetroId = metroId;
      if (!resolvedMetroId && citySlug) {
        resolvedMetroId = await resolveCityId(String(citySlug));
      }
      if (!resolvedMetroId) return;

      await db.insert(intelligenceEventLog).values({
        metroId: resolvedMetroId,
        entityType,
        entityId,
        eventType,
        zipOrigin: zipOrigin || null,
        language: language || null,
        referrer: referrer || null,
        metadataJson: metadata || null,
      });
    } catch (e) {}
  });

  // ═══════════════════════════════════════════════════════
  // Intelligence Report Request Funnel (T003)
  // ═══════════════════════════════════════════════════════

  app.post("/api/intelligence/request-report", async (req: Request, res: Response) => {
    try {
      const {
        citySlug, entityType, entityId, requesterName, requesterEmail,
        requesterPhone, requesterRole, preferredLanguage, requestReason, consentToContact,
      } = req.body;

      if (!citySlug || !entityType || !entityId || !requesterName || !requesterEmail || !requesterRole || !requestReason) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const metroId = await resolveCityId(String(citySlug));
      if (!metroId) return res.status(404).json({ message: "City not found" });

      const [request] = await db.insert(intelligenceReportRequests).values({
        metroId,
        entityType,
        entityId,
        requesterName,
        requesterEmail,
        requesterPhone: requesterPhone || null,
        requesterRole,
        preferredLanguage: preferredLanguage || "en",
        requestReason,
        consentToContact: consentToContact !== false,
      }).returning();

      const token = crypto.randomUUID();
      await db.insert(intelligenceReportTokens).values({
        requestId: request.id,
        token,
      });

      await db.insert(intelligenceReportSnapshots).values({
        requestId: request.id,
        metroId,
        entityType,
        entityId,
        reportJson: null,
      });

      const reportLink = `${req.protocol}://${req.get("host")}/intelligence/report/${token}`;

      try {
        await sendTerritoryEmail({
          cityId: metroId,
          to: requesterEmail,
          subject: "Your Intelligence Report Request — Received",
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
              <h2 style="color:#6b21a8;">Your Intelligence Report Request</h2>
              <p>Hi ${requesterName},</p>
              <p>We've received your request for an Intelligence Report. Our team is preparing your personalized insights.</p>
              <p>You can check on your report status anytime:</p>
              <p><a href="${reportLink}" style="display:inline-block;background:#6b21a8;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">View Report Status</a></p>
              <p style="color:#666;font-size:13px;margin-top:24px;">We'll email you when your full report is ready.</p>
            </div>
          `,
        });
      } catch (emailErr: any) {
        console.error("[IntelReport] Confirmation email failed:", emailErr.message);
      }

      const opsEmail = process.env.INTELLIGENCE_OPS_EMAIL || process.env.RESEND_FROM_EMAIL || "noreply@cltcityhub.com";
      try {
        await sendTerritoryEmail({
          cityId: metroId,
          to: opsEmail,
          subject: `New Intelligence Report Request — ${entityType}`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
              <h2>New Intelligence Report Request</h2>
              <table style="border-collapse:collapse;width:100%;">
                <tr><td style="padding:6px;font-weight:bold;">Entity Type:</td><td style="padding:6px;">${entityType}</td></tr>
                <tr><td style="padding:6px;font-weight:bold;">Entity ID:</td><td style="padding:6px;">${entityId}</td></tr>
                <tr><td style="padding:6px;font-weight:bold;">Requester:</td><td style="padding:6px;">${requesterName} (${requesterEmail})</td></tr>
                <tr><td style="padding:6px;font-weight:bold;">Phone:</td><td style="padding:6px;">${requesterPhone || "—"}</td></tr>
                <tr><td style="padding:6px;font-weight:bold;">Role:</td><td style="padding:6px;">${requesterRole}</td></tr>
                <tr><td style="padding:6px;font-weight:bold;">Reason:</td><td style="padding:6px;">${requestReason}</td></tr>
                <tr><td style="padding:6px;font-weight:bold;">Language:</td><td style="padding:6px;">${preferredLanguage || "en"}</td></tr>
              </table>
              <p style="margin-top:16px;"><a href="${reportLink}">View Token Page</a></p>
            </div>
          `,
        });
      } catch (emailErr: any) {
        console.error("[IntelReport] Ops notification email failed:", emailErr.message);
      }

      res.json({ ok: true, requestId: request.id });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ═══════════════════════════════════════════════════════
  // Private Token Report Page API (T005)
  // ═══════════════════════════════════════════════════════

  app.get("/api/intelligence/report/:token", async (req: Request, res: Response) => {
    try {
      const { token } = req.params;

      const [tokenRow] = await db.select().from(intelligenceReportTokens)
        .where(eq(intelligenceReportTokens.token, token));

      if (!tokenRow) return res.status(404).json({ message: "Report not found" });

      if (tokenRow.expiresAt && new Date(tokenRow.expiresAt) < new Date()) {
        return res.status(410).json({ message: "Report link has expired" });
      }

      const [request] = await db.select().from(intelligenceReportRequests)
        .where(eq(intelligenceReportRequests.id, tokenRow.requestId));

      if (!request) return res.status(404).json({ message: "Report request not found" });

      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const [viewsResult] = await db
        .select({ total: count() })
        .from(intelligenceEventLog)
        .where(and(
          eq(intelligenceEventLog.entityId, request.entityId),
          eq(intelligenceEventLog.eventType, "PROFILE_VIEW"),
          gte(intelligenceEventLog.createdAt, since),
        ));

      const topZipRows = await db
        .select({ zip: intelligenceEventLog.zipOrigin, total: count() })
        .from(intelligenceEventLog)
        .where(and(
          eq(intelligenceEventLog.entityId, request.entityId),
          gte(intelligenceEventLog.createdAt, since),
          sql`${intelligenceEventLog.zipOrigin} IS NOT NULL`,
        ))
        .groupBy(intelligenceEventLog.zipOrigin)
        .orderBy(desc(count()))
        .limit(1);

      const langRows = await db
        .select({ lang: intelligenceEventLog.language, total: count() })
        .from(intelligenceEventLog)
        .where(and(
          eq(intelligenceEventLog.entityId, request.entityId),
          gte(intelligenceEventLog.createdAt, since),
          sql`${intelligenceEventLog.language} IS NOT NULL`,
        ))
        .groupBy(intelligenceEventLog.language);

      const totalLang = langRows.reduce((s, r) => s + (r.total || 0), 0);
      const enCount = langRows.find(r => r.lang === "en")?.total || 0;
      const esCount = langRows.find(r => r.lang === "es")?.total || 0;

      res.json({
        request: {
          entityType: request.entityType,
          entityId: request.entityId,
          requesterName: request.requesterName,
          status: request.status,
          createdAt: request.createdAt,
        },
        teaserStats: {
          profileViews30d: viewsResult?.total || 0,
          topZipOrigin: topZipRows[0]?.zip || null,
          languageSplit: totalLang > 0 ? {
            en: Math.round((enCount / totalLang) * 100),
            es: Math.round((esCount / totalLang) * 100),
          } : null,
        },
        status: "preparing",
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ═══════════════════════════════════════════════════════
  // Admin Report Requests (T006)
  // ═══════════════════════════════════════════════════════

  app.get("/api/admin/intelligence/report-requests", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { metroId, entityType, status, search, limit: lim, offset: off } = req.query;
      const conditions: any[] = [];
      if (metroId) conditions.push(eq(intelligenceReportRequests.metroId, String(metroId)));
      if (entityType) conditions.push(eq(intelligenceReportRequests.entityType, String(entityType) as any));
      if (status && status !== "all") conditions.push(eq(intelligenceReportRequests.status, String(status) as any));
      if (search) {
        conditions.push(or(
          ilike(intelligenceReportRequests.requesterName, `%${search}%`),
          ilike(intelligenceReportRequests.requesterEmail, `%${search}%`),
        ));
      }

      const limit = Math.min(parseInt(String(lim) || "50"), 200);
      const offset = parseInt(String(off) || "0");

      const [countResult] = await db
        .select({ total: count() })
        .from(intelligenceReportRequests)
        .where(conditions.length ? and(...conditions) : undefined);

      const rows = await db.select({
        request: intelligenceReportRequests,
        token: intelligenceReportTokens.token,
      })
        .from(intelligenceReportRequests)
        .leftJoin(intelligenceReportTokens, eq(intelligenceReportTokens.requestId, intelligenceReportRequests.id))
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(intelligenceReportRequests.createdAt))
        .limit(limit)
        .offset(offset);

      res.json({
        total: countResult?.total || 0,
        rows: rows.map(r => ({ ...r.request, token: r.token })),
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const VALID_REPORT_STATUSES = ["NEW", "IN_REVIEW", "SENT", "DECLINED", "NEEDS_INFO"];

  app.patch("/api/admin/intelligence/report-requests/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates: any = { updatedAt: new Date() };
      if (req.body.status !== undefined) {
        if (!VALID_REPORT_STATUSES.includes(req.body.status)) {
          return res.status(400).json({ message: `Invalid status. Must be one of: ${VALID_REPORT_STATUSES.join(", ")}` });
        }
        updates.status = req.body.status;
      }
      if (req.body.notes !== undefined) updates.notes = req.body.notes;

      const [row] = await db.update(intelligenceReportRequests)
        .set(updates)
        .where(eq(intelligenceReportRequests.id, id))
        .returning();

      if (!row) return res.status(404).json({ message: "Request not found" });
      res.json(row);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ═══════════════════════════════════════════════════════
  // Talent Layer — Website Crawl + Scoring Admin Controls
  // ═══════════════════════════════════════════════════════

  app.post("/api/admin/intelligence/crawl/enqueue", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const { enqueueCrawlJobs } = await import("./intelligence/crawl/crawlJobRunner");
      const metroId = _req.body.metroId || undefined;
      const count = await enqueueCrawlJobs(metroId);
      res.json({ message: `Enqueued ${count} crawl jobs`, count });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/intelligence/crawl/run", requireAdmin, async (req: Request, res: Response) => {
    try {
      const enabled = process.env.ENABLE_WEBSITE_CRAWL !== "false";
      if (!enabled) {
        return res.status(400).json({ message: "Website crawling is disabled. Set ENABLE_WEBSITE_CRAWL=true to enable." });
      }
      const { processCrawlQueue } = await import("./intelligence/crawl/crawlJobRunner");
      const limit = parseInt(req.body.limit || "50", 10);
      const result = await processCrawlQueue(limit);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/intelligence/scoring/run", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { runScoringBatch } = await import("./intelligence/crawl/crawlJobRunner");
      const metroId = req.body.metroId || undefined;
      const result = await runScoringBatch(metroId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/intelligence/crawl/stats", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { getCrawlStats, getScoreDistribution, getRecentCrawlResults } = await import("./intelligence/crawl/crawlJobRunner");
      const metroId = (req.query.metroId as string) || undefined;
      const [crawlStats, scoreDistribution, recentResults] = await Promise.all([
        getCrawlStats(metroId),
        getScoreDistribution(metroId),
        getRecentCrawlResults(20),
      ]);

      let classificationStats: any = { STOREFRONT: 0, OFFICE: 0, HOME_BASED: 0, VIRTUAL: 0, UNKNOWN: 0 };
      let outreachStats: any = { WALK_IN: 0, MAILER: 0, PHONE_FIRST: 0, WEBSITE_FORM: 0, SOCIAL_DM: 0, EMAIL: 0, UNKNOWN: 0 };
      try {
        const { entityLocationProfile, entityOutreachRecommendation } = await import("@shared/schema");
        const metroWhere = metroId ? sql`WHERE metro_id = ${metroId}` : sql``;
        const locResult = await db.execute(sql`SELECT location_type, COUNT(*)::int as count FROM entity_location_profile ${metroWhere} GROUP BY location_type`);
        const locRows = (locResult as any).rows ?? locResult;
        if (Array.isArray(locRows)) {
          for (const r of locRows) classificationStats[r.location_type] = r.count;
        }
        const outResult = await db.execute(sql`SELECT recommended_method, COUNT(*)::int as count FROM entity_outreach_recommendation ${metroWhere} GROUP BY recommended_method`);
        const outRows = (outResult as any).rows ?? outResult;
        if (Array.isArray(outRows)) {
          for (const r of outRows) outreachStats[r.recommended_method] = r.count;
        }
      } catch {}

      let industryTagStats: any = {};
      try {
        const metroIndustryWhere = metroId ? sql`WHERE metro_id = ${metroId}` : sql``;
        const industryResult = await db.execute(sql`
          SELECT tag, COUNT(*)::int as count FROM entity_asset_tags ${metroIndustryWhere} GROUP BY tag ORDER BY count DESC
        `);
        const industryRows = (industryResult as any).rows ?? industryResult;
        if (Array.isArray(industryRows)) {
          for (const r of industryRows) industryTagStats[r.tag] = r.count;
        }
      } catch {}

      res.json({
        crawl: crawlStats,
        scores: scoreDistribution,
        recent: recentResults,
        crawlEnabled: process.env.ENABLE_WEBSITE_CRAWL !== "false",
        classification: classificationStats,
        outreach: outreachStats,
        industryTags: industryTagStats,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/intelligence/classify/run", requireAdmin, async (req: Request, res: Response) => {
    try {
      const metroId = req.body.metroId || undefined;
      const { classifyAllLocations } = await import("./intelligence/classify/locationClassifier");
      const { recommendAllOutreach } = await import("./intelligence/classify/outreachRecommender");
      const classifyResult = await classifyAllLocations(metroId);
      const outreachResult = await recommendAllOutreach(metroId);
      res.json({
        classification: classifyResult,
        outreach: outreachResult,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/intelligence/pipeline/run", requireAdmin, async (req: Request, res: Response) => {
    try {
      const metroId = req.body.metroId || undefined;
      const { runProspectPipeline } = await import("./intelligence/pipeline/prospectPipeline");
      const result = await runProspectPipeline(metroId, "MANUAL");
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/intelligence/pipeline/runs", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { prospectPipelineRuns } = await import("@shared/schema");
      const runs = await db.select().from(prospectPipelineRuns)
        .orderBy(sql`started_at DESC`)
        .limit(20);
      res.json(runs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/intelligence/industry/run", requireAdmin, async (req: Request, res: Response) => {
    try {
      const metroId = req.body.metroId || undefined;
      const { tagAllEntities } = await import("./intelligence/classify/industryTagger");
      const result = await tagAllEntities(metroId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/intelligence/industry/stats", requireAdmin, async (req: Request, res: Response) => {
    try {
      const metroId = (req.query.metroId as string) || undefined;
      const metroWhere = metroId ? sql`WHERE metro_id = ${metroId}` : sql``;

      const tagResult = await db.execute(sql`
        SELECT tag, COUNT(*)::int as count, ROUND(AVG(confidence))::int as avg_confidence
        FROM entity_asset_tags ${metroWhere}
        GROUP BY tag ORDER BY count DESC
      `);
      const tagRows = (tagResult as any).rows ?? tagResult;

      const totalResult = await db.execute(sql`
        SELECT COUNT(DISTINCT entity_id)::int as total FROM entity_asset_tags ${metroWhere}
      `);
      const totalRows = (totalResult as any).rows ?? totalResult;

      res.json({
        tagDistribution: tagRows,
        totalTaggedEntities: totalRows[0]?.total || 0,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/intelligence/industry/entities", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { tag, minConfidence, hasPhone, hasWebsite, search, limit: lim, offset: off } = req.query;
      const limit = Math.min(parseInt(lim as string) || 50, 200);
      const offset = parseInt(off as string) || 0;

      const conditions: ReturnType<typeof sql>[] = [];

      if (tag) {
        conditions.push(sql`eat.tag = ${tag}`);
      }
      if (minConfidence) {
        conditions.push(sql`eat.confidence >= ${parseInt(minConfidence as string)}`);
      }
      if (hasPhone === "true") {
        conditions.push(sql`(b.phone IS NOT NULL OR ecv.detected_phone IS NOT NULL)`);
      }
      if (hasWebsite === "true") {
        conditions.push(sql`b.website_url IS NOT NULL`);
      }
      if (hasWebsite === "false") {
        conditions.push(sql`b.website_url IS NULL`);
      }
      if (search) {
        conditions.push(sql`b.name ILIKE ${'%' + (search as string) + '%'}`);
      }

      const whereClause = conditions.length > 0
        ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
        : sql``;

      const result = await db.execute(sql`
        SELECT
          eat.entity_id, eat.tag, eat.confidence, eat.evidence_json,
          b.name, b.phone, b.owner_email, b.website_url, b.address,
          ecv.detected_phone, ecv.detected_email,
          eor.recommended_method,
          es.prospect_fit_score, es.bucket
        FROM entity_asset_tags eat
        JOIN businesses b ON b.id = eat.entity_id
        LEFT JOIN entity_contact_verification ecv ON ecv.entity_id = eat.entity_id
        LEFT JOIN entity_outreach_recommendation eor ON eor.entity_id = eat.entity_id
        LEFT JOIN entity_scores es ON es.entity_id = eat.entity_id
        ${whereClause}
        ORDER BY eat.confidence DESC, b.name ASC
        LIMIT ${limit} OFFSET ${offset}
      `);
      const rows = (result as any).rows ?? result;

      const countResult = await db.execute(sql`
        SELECT COUNT(DISTINCT eat.entity_id)::int as total
        FROM entity_asset_tags eat
        JOIN businesses b ON b.id = eat.entity_id
        LEFT JOIN entity_contact_verification ecv ON ecv.entity_id = eat.entity_id
        ${whereClause}
      `);
      const countRows = (countResult as any).rows ?? countResult;

      res.json({ data: rows, total: countRows[0]?.total || 0 });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/intelligence/pipeline/status", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { prospectPipelineRuns, entityScores } = await import("@shared/schema");
      const [lastRun] = await db.select().from(prospectPipelineRuns)
        .orderBy(sql`started_at DESC`)
        .limit(1);

      const isRunning = lastRun?.status === "RUNNING";

      const promotedResult = await db.execute(sql`
        SELECT COUNT(*)::int as count FROM entity_scores WHERE pipeline_promoted_at IS NOT NULL
      `);
      const promotedRows = (promotedResult as any).rows ?? promotedResult;
      const totalPromoted = promotedRows[0]?.count || 0;

      const targetResult = await db.execute(sql`
        SELECT COUNT(*)::int as count FROM entity_scores
        WHERE bucket = 'TARGET' AND pipeline_promoted_at IS NULL
      `);
      const targetRows = (targetResult as any).rows ?? targetResult;
      const pendingTargets = targetRows[0]?.count || 0;

      const scheduleHour = parseInt(process.env.PIPELINE_SCHEDULE_HOUR || "2", 10);

      res.json({
        isRunning,
        lastRun: lastRun || null,
        totalPromoted,
        pendingTargets,
        scheduleHour,
        schedulerActive: true,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/intelligence/sales-buckets/recompute", requireAdmin, async (req: Request, res: Response) => {
    try {
      const metroId = req.body.metroId || undefined;
      const { computeAllEngagement30d } = await import("./intelligence/salesBuckets/entityEngagementStats");
      const { computeAllSalesBuckets } = await import("./intelligence/salesBuckets/salesBucketEngine");
      const engResult = await computeAllEngagement30d(metroId);
      const bucketResult = await computeAllSalesBuckets(metroId);
      res.json({ engagement: engResult, buckets: bucketResult });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/intelligence/sales-buckets/stats", requireAdmin, async (req: Request, res: Response) => {
    try {
      const metroId = (req.query.metroId as string) || undefined;
      const metroWhere = metroId ? sql`WHERE metro_id = ${metroId}` : sql``;

      const bucketResult = await db.execute(sql`
        SELECT bucket, COUNT(*)::int as count, ROUND(AVG(priority_score))::int as avg_priority
        FROM entity_sales_buckets ${metroWhere}
        GROUP BY bucket ORDER BY count DESC
      `);
      const bucketRows = (bucketResult as any).rows ?? bucketResult;

      const totalResult = await db.execute(sql`
        SELECT COUNT(DISTINCT entity_id)::int as total FROM entity_sales_buckets ${metroWhere}
      `);
      const totalRows = (totalResult as any).rows ?? totalResult;

      res.json({
        bucketDistribution: bucketRows,
        totalBucketedEntities: totalRows[0]?.total || 0,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/intelligence/sales-buckets/entities", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { bucket, minPriority, search, limit: lim, offset: off } = req.query;
      const limit = Math.min(parseInt(lim as string) || 50, 200);
      const offset = parseInt(off as string) || 0;

      const conditions: ReturnType<typeof sql>[] = [];
      if (bucket) conditions.push(sql`esb.bucket = ${bucket}`);
      if (minPriority) conditions.push(sql`esb.priority_score >= ${parseInt(minPriority as string)}`);
      if (search) conditions.push(sql`b.name ILIKE ${'%' + (search as string) + '%'}`);

      const whereClause = conditions.length > 0
        ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
        : sql``;

      const result = await db.execute(sql`
        SELECT
          esb.entity_id, esb.bucket, esb.priority_score, esb.reasons_json, esb.computed_at,
          b.name, b.phone, b.owner_email, b.website_url, b.address, b.claim_status, b.presence_status,
          ecv.detected_phone, ecv.detected_email, ecv.crawl_status,
          eor.recommended_method,
          es.prospect_fit_score, es.bucket as score_bucket
        FROM entity_sales_buckets esb
        JOIN businesses b ON b.id = esb.entity_id
        LEFT JOIN entity_contact_verification ecv ON ecv.entity_id = esb.entity_id
        LEFT JOIN entity_outreach_recommendation eor ON eor.entity_id = esb.entity_id
        LEFT JOIN entity_scores es ON es.entity_id = esb.entity_id
        ${whereClause}
        ORDER BY esb.priority_score DESC, b.name ASC
        LIMIT ${limit} OFFSET ${offset}
      `);
      const rows = (result as any).rows ?? result;

      const countResult = await db.execute(sql`
        SELECT COUNT(*)::int as total
        FROM entity_sales_buckets esb
        JOIN businesses b ON b.id = esb.entity_id
        ${whereClause}
      `);
      const countRows = (countResult as any).rows ?? countResult;

      res.json({ data: rows, total: countRows[0]?.total || 0 });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/intelligence/directory-prospects/generate", requireAdmin, async (req: Request, res: Response) => {
    try {
      const metroId = req.body.metroId || undefined;
      const { generateDirectoryCandidates } = await import("./intelligence/directoryProspects/generateDirectoryCandidates");
      const result = await generateDirectoryCandidates(metroId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/intelligence/directory-prospects/crawl", requireAdmin, async (req: Request, res: Response) => {
    try {
      const metroId = req.body.metroId || undefined;
      const { crawlAllDirectoryProspects } = await import("./intelligence/directoryProspects/directoryCrawler");
      const result = await crawlAllDirectoryProspects(metroId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/intelligence/directory-prospects/stats", requireAdmin, async (req: Request, res: Response) => {
    try {
      const bucketResult = await db.execute(sql`
        SELECT bucket, COUNT(*)::int as count, ROUND(AVG(directory_score))::int as avg_score
        FROM directory_prospects GROUP BY bucket ORDER BY count DESC
      `);
      const bucketRows = (bucketResult as any).rows ?? bucketResult;

      const statusResult = await db.execute(sql`
        SELECT crawl_status, COUNT(*)::int as count
        FROM directory_prospects GROUP BY crawl_status ORDER BY count DESC
      `);
      const statusRows = (statusResult as any).rows ?? statusResult;

      const totalResult = await db.execute(sql`
        SELECT COUNT(*)::int as total FROM directory_prospects
      `);
      const totalRows = (totalResult as any).rows ?? totalResult;

      res.json({
        bucketDistribution: bucketRows,
        crawlStatusBreakdown: statusRows,
        totalProspects: totalRows[0]?.total || 0,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/intelligence/directory-prospects", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { bucket, minScore, search, niche, crawl_status, limit: lim, offset: off } = req.query;
      const limit = Math.min(parseInt(lim as string) || 50, 200);
      const offset = parseInt(off as string) || 0;

      const conditions: ReturnType<typeof sql>[] = [];
      if (bucket && bucket !== "ALL") conditions.push(sql`dp.bucket = ${bucket}::directory_bucket`);
      if (crawl_status && crawl_status !== "ALL") conditions.push(sql`dp.crawl_status = ${crawl_status}::directory_crawl_status`);
      if (minScore) conditions.push(sql`dp.directory_score >= ${parseInt(minScore as string)}`);
      if (search) conditions.push(sql`(dp.root_domain ILIKE ${'%' + (search as string) + '%'} OR b.name ILIKE ${'%' + (search as string) + '%'})`);
      if (niche && niche !== "ALL") conditions.push(sql`dp.niche_tags_json::text ILIKE ${'%' + (niche as string) + '%'}`);

      const whereClause = conditions.length > 0
        ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
        : sql``;

      const result = await db.execute(sql`
        SELECT
          dp.*,
          b.name as entity_name
        FROM directory_prospects dp
        LEFT JOIN businesses b ON b.id = dp.entity_id
        ${whereClause}
        ORDER BY dp.directory_score DESC, dp.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);
      const rows = (result as any).rows ?? result;

      const countResult = await db.execute(sql`
        SELECT COUNT(*)::int as total
        FROM directory_prospects dp
        LEFT JOIN businesses b ON b.id = dp.entity_id
        ${whereClause}
      `);
      const countRows = (countResult as any).rows ?? countResult;

      res.json({ data: rows, total: countRows[0]?.total || 0 });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/admin/intelligence/directory-prospects/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { notes, contacted_at, follow_up_at, bucket } = req.body;

      const validBuckets = ["MICRO_LICENSE_TARGET", "PARTNER_TARGET", "IGNORE"];
      if (bucket !== undefined && !validBuckets.includes(bucket)) {
        return res.status(400).json({ message: "Invalid bucket value" });
      }

      const setClauses: ReturnType<typeof sql>[] = [sql`updated_at = NOW()`];
      if (notes !== undefined) setClauses.push(sql`notes = ${notes}`);
      if (contacted_at !== undefined) setClauses.push(sql`contacted_at = ${contacted_at ? new Date(contacted_at) : null}`);
      if (follow_up_at !== undefined) setClauses.push(sql`follow_up_at = ${follow_up_at ? new Date(follow_up_at) : null}`);
      if (bucket !== undefined) setClauses.push(sql`bucket = ${bucket}::directory_bucket`);

      const updated = await db.execute(sql`
        UPDATE directory_prospects SET ${sql.join(setClauses, sql`, `)}
        WHERE id = ${id}::uuid
        RETURNING *
      `);
      const rows = (updated as any).rows ?? updated;
      res.json(rows[0] || {});
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/intelligence/directory-prospects/:id/recrawl", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await db.execute(sql`UPDATE directory_prospects SET crawl_status = 'PENDING', updated_at = NOW() WHERE id = ${id}::uuid`);
      const { crawlDirectoryProspect } = await import("./intelligence/directoryProspects/directoryCrawler");
      const result = await crawlDirectoryProspect(id);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const EDITABLE_FIELDS = [
    "title", "rewrittenSummary", "localArticleBody",
    "contentType", "categoryCoreSlug", "categorySubSlug",
    "geoPrimarySlug", "geoSecondarySlug", "hubSlug", "countySlug",
    "venueName", "venueSlug", "venueAddress",
    "publishStatus", "policyStatus", "pulseEligible",
    "imageUrl", "imageCredit", "sourceAttribution",
    "activeUntil", "isEvergreen", "suppressionReason",
  ] as const;

  app.patch("/api/admin/intelligence/rss-items/:id/edit", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const editorId = (req.session as any).userId || "admin";

      const [existing] = await db.select().from(rssItems).where(eq(rssItems.id, id));
      if (!existing) return res.status(404).json({ message: "RSS item not found" });

      const ALLOWED_PUBLISH = new Set(["DRAFT", "REVIEW_NEEDED", "PUBLISHED", "ARCHIVED", "SUPPRESSED"]);
      const ALLOWED_POLICY = new Set(["ALLOW", "REVIEW_NEEDED", "SUPPRESS"]);
      const ALLOWED_CONTENT_TYPE = new Set(["story", "event", "job", "business-update", "community-update", "listing", "deal", "announcement"]);
      const NON_NULLABLE = new Set(["title"]);

      const updates: Record<string, unknown> = {};
      const changedFields: string[] = [];

      for (const field of EDITABLE_FIELDS) {
        if (req.body[field] !== undefined) {
          const newVal = req.body[field];
          const oldVal = (existing as Record<string, unknown>)[field];

          if (field === "publishStatus" && newVal && !ALLOWED_PUBLISH.has(String(newVal))) {
            return res.status(400).json({ message: `Invalid publishStatus: ${newVal}` });
          }
          if (field === "policyStatus" && newVal && !ALLOWED_POLICY.has(String(newVal))) {
            return res.status(400).json({ message: `Invalid policyStatus: ${newVal}` });
          }
          if (field === "contentType" && newVal && !ALLOWED_CONTENT_TYPE.has(String(newVal))) {
            return res.status(400).json({ message: `Invalid contentType: ${newVal}` });
          }

          if (newVal === "" || newVal === null) {
            if (NON_NULLABLE.has(field)) {
              return res.status(400).json({ message: `${field} cannot be empty` });
            }
            if (field === "pulseEligible" || field === "isEvergreen") {
              updates[field] = false;
            } else {
              updates[field] = null;
            }
            if (oldVal !== null && oldVal !== undefined) changedFields.push(field);
          } else {
            if (field === "pulseEligible" || field === "isEvergreen") {
              updates[field] = !!newVal;
            } else if (field === "activeUntil") {
              updates[field] = new Date(String(newVal));
            } else {
              updates[field] = String(newVal);
            }
            if (String(oldVal ?? "") !== String(newVal)) changedFields.push(field);
          }
        }
      }

      if (changedFields.length === 0) {
        return res.json({ message: "No changes detected", item: existing });
      }

      updates.lastEditedBy = editorId;
      updates.lastEditedAt = new Date();
      updates.updatedAt = new Date();

      const previousValues: Record<string, unknown> = {};
      const newValues: Record<string, unknown> = {};
      for (const field of changedFields) {
        previousValues[field] = (existing as Record<string, unknown>)[field] ?? null;
        newValues[field] = updates[field] ?? null;
      }
      const historyEntry = {
        fields: changedFields,
        editorId,
        editedAt: new Date().toISOString(),
        previousValues,
        newValues,
      };
      const currentHistory = (existing.editHistory || []) as Array<Record<string, unknown>>;
      const newHistory = [...currentHistory.slice(-49), historyEntry];
      updates.editHistory = newHistory;

      if (updates.publishStatus === "PUBLISHED" && !updates.policyStatus) {
        if (!existing.policyStatus || existing.policyStatus === "REVIEW_NEEDED") {
          updates.policyStatus = "ALLOW";
        }
      }

      if (changedFields.includes("title") && !existing.originalTitle) {
        updates.originalTitle = existing.title;
      }
      if ((changedFields.includes("rewrittenSummary")) && !existing.originalSummary) {
        updates.originalSummary = existing.rewrittenSummary || existing.summary;
      }
      if (changedFields.includes("imageUrl") && !existing.originalImageUrl) {
        updates.originalImageUrl = existing.imageUrl;
      }

      if (changedFields.includes("isEvergreen") && updates.isEvergreen === true) {
        updates.activeUntil = null;
      }

      const finalPublish = (updates.publishStatus ?? existing.publishStatus) as string;
      const finalPolicy = (updates.policyStatus ?? existing.policyStatus) as string;
      const finalPulse = updates.pulseEligible !== undefined ? updates.pulseEligible : existing.pulseEligible;
      const publishOrPolicyChanged = updates.publishStatus !== undefined || updates.policyStatus !== undefined || updates.pulseEligible !== undefined;
      if (publishOrPolicyChanged) {
        updates.queueStatus = deriveQueueStatus(finalPublish, finalPolicy, finalPulse as boolean, existing.queueStatus as string);
      }

      if (updates.queueStatus === "SUPPRESSED" && existing.queueStatus !== "SUPPRESSED") {
        if (!updates.suppressionReason && !existing.suppressionReason) {
          return res.status(400).json({ message: "Suppression reason is required when suppressing content" });
        }
        updates.suppressedBy = editorId;
        updates.suppressedAt = new Date();
      }

      const [updated] = await db.update(rssItems).set(updates).where(eq(rssItems.id, id)).returning();
      res.json({ item: updated, changedFields });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ message: msg });
    }
  });

  app.get("/api/admin/intelligence/review-queue", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { cityId, limit: lim, offset: off } = req.query;
      const limitNum = Math.min(parseInt(String(lim) || "50"), 200);
      const offsetNum = parseInt(String(off) || "0");

      const conditions: SQL[] = [];
      if (cityId) conditions.push(eq(rssItems.cityId, String(cityId)));

      conditions.push(or(eq(rssItems.reviewStatus, "APPROVED"), eq(rssItems.reviewStatus, "PENDING")));

      const reviewCondition = or(
        eq(rssItems.policyStatus, "REVIEW_NEEDED"),
        sql`${rssItems.publishStatus} = 'REVIEW_NEEDED'`,
        sql`${rssItems.categoryCoreSlug} IS NULL`,
        sql`${rssItems.geoPrimarySlug} IS NULL`,
        sql`(${rssItems.aiConfidence}->>'category')::float < 0.7`,
        sql`(${rssItems.aiConfidence}->>'geo')::float < 0.7`,
        sql`(${rssItems.aiConfidence}->>'policy')::float < 0.7`,
      );

      const whereClause = and(...conditions, reviewCondition);

      const [countResult] = await db
        .select({ total: count() })
        .from(rssItems)
        .where(whereClause);

      const rows = await db
        .select()
        .from(rssItems)
        .where(whereClause)
        .orderBy(desc(rssItems.createdAt))
        .limit(limitNum)
        .offset(offsetNum);

      res.json({ total: countResult?.total || 0, items: rows });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ message: msg });
    }
  });

  app.post("/api/admin/intelligence/rss-items/:id/quick-action", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { action } = req.body;
      const editorId = (req.session as any).userId || "admin";

      const [existing] = await db.select().from(rssItems).where(eq(rssItems.id, id));
      if (!existing) return res.status(404).json({ message: "RSS item not found" });

      const updates: Record<string, unknown> = {
        lastEditedBy: editorId,
        lastEditedAt: new Date(),
        updatedAt: new Date(),
      };

      let actionLabel = "";
      switch (action) {
        case "approve-publish":
          updates.publishStatus = "PUBLISHED";
          updates.policyStatus = "ALLOW";
          updates.pulseEligible = true;
          updates.queueStatus = "PUBLISHED";
          updates.suppressionReason = null;
          updates.suppressedBy = null;
          updates.suppressedAt = null;
          actionLabel = "approve-publish";
          break;
        case "approve-no-pulse":
          updates.publishStatus = "PUBLISHED";
          updates.policyStatus = "ALLOW";
          updates.pulseEligible = false;
          updates.queueStatus = "PULSE_SUPPRESSED";
          updates.suppressionReason = null;
          updates.suppressedBy = null;
          updates.suppressedAt = null;
          actionLabel = "approve-no-pulse";
          break;
        case "suppress":
          if (!req.body.reason) return res.status(400).json({ message: "Suppression reason is required" });
          updates.policyStatus = "SUPPRESS";
          updates.publishStatus = "SUPPRESSED";
          updates.pulseEligible = false;
          updates.queueStatus = "SUPPRESSED";
          updates.suppressedBy = editorId;
          updates.suppressedAt = new Date();
          updates.suppressionReason = String(req.body.reason);
          actionLabel = "suppress";
          break;
        case "send-back-to-review":
          updates.queueStatus = "REVIEW_REQUIRED";
          updates.publishStatus = "REVIEW_NEEDED";
          actionLabel = "send-back-to-review";
          break;
        case "archive":
          updates.publishStatus = "ARCHIVED";
          updates.pulseEligible = false;
          updates.queueStatus = "ARCHIVED";
          actionLabel = "archive";
          break;
        case "unpublish":
          updates.publishStatus = "DRAFT";
          updates.pulseEligible = false;
          updates.queueStatus = "UNPUBLISHED";
          actionLabel = "unpublish";
          break;
        case "ready-to-publish":
          updates.queueStatus = "READY_TO_PUBLISH";
          actionLabel = "ready-to-publish";
          break;
        default:
          return res.status(400).json({ message: "Invalid action" });
      }

      const historyEntry = {
        fields: [actionLabel],
        editorId,
        editedAt: new Date().toISOString(),
      };
      const currentHistory = (existing.editHistory || []) as Array<{ fields: string[]; editorId: string; editedAt: string }>;
      updates.editHistory = [...currentHistory.slice(-49), historyEntry];

      let geoIsLowPrecision = false;
      const geoSlug = (updates.geoPrimarySlug || existing.geoPrimarySlug) as string | null;
      if (geoSlug && existing.cityId) {
        const precision = await getZoneType(geoSlug, existing.cityId);
        geoIsLowPrecision = precision === "METRO" || precision === "NONE";
      }
      const mergedItem = {
        ...existing,
        ...updates,
        _geoIsLowPrecision: geoIsLowPrecision,
      };
      const flags = computeIntegrityFlags(mergedItem as Record<string, unknown>);
      updates.integrityFlags = flags;
      updates.lastIntegrityPassAt = new Date();

      const warnings: string[] = [];
      if ((action === "approve-publish" || action === "approve-no-pulse" || action === "ready-to-publish") && flags.length > 0) {
        const flagLabels: Record<string, string> = {
          MISSING_CATEGORY: "Missing category assignment",
          MISSING_GEO: "Missing geo assignment",
          LOW_GEO_PRECISION: "Low geo precision (metro-level only)",
          LOW_CATEGORY_CONFIDENCE: "Low category confidence",
          LOW_GEO_CONFIDENCE: "Low geo confidence",
          LOW_POLICY_CONFIDENCE: "Low policy confidence",
          ROUTING_ISSUE: "Routing issue detected",
        };
        for (const flag of flags) {
          if (flagLabels[flag]) warnings.push(flagLabels[flag]);
        }

        const hasCriticalFlags = flags.includes("MISSING_CATEGORY") || flags.includes("MISSING_GEO");
        if (hasCriticalFlags) {
          warnings.push("Content published with unresolved integrity issues - review recommended");
        }
      }

      const [updated] = await db.update(rssItems).set(updates).where(eq(rssItems.id, id)).returning();
      res.json({ item: updated, action: actionLabel, integrityWarnings: warnings.length > 0 ? warnings : undefined });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ message: msg });
    }
  });

  app.get("/api/admin/intelligence/editorial-queue", requireAdmin, async (req: Request, res: Response) => {
    try {
      const {
        cityId, queueStatus: qs, categoryCoreSlug, categorySubSlug,
        sourceName, search, limit: lim, offset: off, sortBy,
        contentType, geoPrimarySlug, geoSecondarySlug,
        publishStatus, policyStatus, lastEditedBy,
        createdAfter, createdBefore, updatedAfter, updatedBefore,
        hasRoutingIssues, lowConfidence, lowGeoPrecision, integrityFlag,
      } = req.query;
      const limitNum = Math.min(parseInt(String(lim) || "50"), 200);
      const offsetNum = parseInt(String(off) || "0");

      const conditions: SQL[] = [];
      if (cityId) conditions.push(eq(rssItems.cityId, String(cityId)));
      if (qs && qs !== "ALL") conditions.push(eq(rssItems.queueStatus, String(qs)));
      if (categoryCoreSlug) conditions.push(eq(rssItems.categoryCoreSlug, String(categoryCoreSlug)));
      if (categorySubSlug) conditions.push(eq(rssItems.categorySubSlug, String(categorySubSlug)));
      if (sourceName) conditions.push(eq(rssItems.sourceName, String(sourceName)));
      if (search) conditions.push(ilike(rssItems.title, `%${String(search)}%`));
      if (contentType) conditions.push(eq(rssItems.contentType, String(contentType)));
      if (geoPrimarySlug) conditions.push(eq(rssItems.geoPrimarySlug, String(geoPrimarySlug)));
      if (geoSecondarySlug) conditions.push(eq(rssItems.geoSecondarySlug, String(geoSecondarySlug)));
      if (publishStatus) conditions.push(eq(rssItems.publishStatus, String(publishStatus)));
      if (policyStatus) conditions.push(eq(rssItems.policyStatus, String(policyStatus)));
      if (lastEditedBy) conditions.push(eq(rssItems.lastEditedBy, String(lastEditedBy)));
      if (createdAfter) conditions.push(gte(rssItems.createdAt, new Date(String(createdAfter))));
      if (createdBefore) conditions.push(lte(rssItems.createdAt, new Date(String(createdBefore))));
      if (updatedAfter) conditions.push(gte(rssItems.updatedAt, new Date(String(updatedAfter))));
      if (updatedBefore) conditions.push(lte(rssItems.updatedAt, new Date(String(updatedBefore))));
      if (hasRoutingIssues === "true") {
        conditions.push(or(
          sql`${rssItems.integrityFlags}::jsonb ? 'ROUTING_ISSUE'`,
          sql`${rssItems.integrityFlags}::jsonb ? 'MISSING_CATEGORY'`,
          sql`${rssItems.integrityFlags}::jsonb ? 'MISSING_GEO'`
        )!);
      }
      if (lowConfidence === "true") {
        conditions.push(sql`(${rssItems.aiConfidence}->>'category')::float < 0.7`);
      }
      if (lowGeoPrecision === "true") {
        conditions.push(sql`${rssItems.integrityFlags}::jsonb ? 'LOW_GEO_PRECISION'`);
      }
      const VALID_INTEGRITY_FLAGS = ["MISSING_CATEGORY", "MISSING_GEO", "LOW_CATEGORY_CONFIDENCE", "LOW_GEO_CONFIDENCE", "LOW_POLICY_CONFIDENCE", "LOW_GEO_PRECISION", "ROUTING_ISSUE"];
      if (integrityFlag && VALID_INTEGRITY_FLAGS.includes(String(integrityFlag))) {
        conditions.push(sql`${rssItems.integrityFlags}::jsonb ? ${String(integrityFlag)}`);
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [countResult] = await db
        .select({ total: count() })
        .from(rssItems)
        .where(whereClause);

      const orderCol = sortBy === "publishedAt" ? desc(rssItems.publishedAt) :
        sortBy === "updatedAt" ? desc(rssItems.updatedAt) :
        desc(rssItems.createdAt);

      const rows = await db
        .select()
        .from(rssItems)
        .where(whereClause)
        .orderBy(orderCol)
        .limit(limitNum)
        .offset(offsetNum);

      const statusCounts = await db
        .select({
          queueStatus: rssItems.queueStatus,
          cnt: count(),
        })
        .from(rssItems)
        .where(cityId ? eq(rssItems.cityId, String(cityId)) : undefined)
        .groupBy(rssItems.queueStatus);

      const counts: Record<string, number> = {};
      for (const row of statusCounts) {
        counts[row.queueStatus || "UNKNOWN"] = Number(row.cnt);
      }

      res.json({ total: countResult?.total || 0, items: rows, statusCounts: counts });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ message: msg });
    }
  });

  app.patch("/api/admin/intelligence/rss-items/:id/queue-status", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { queueStatus: newStatus, reason } = req.body;
      const editorId = (req.session as any).userId || "admin";
      const VALID = new Set(["REVIEW_REQUIRED", "READY_TO_PUBLISH", "PUBLISHED", "PULSE_SUPPRESSED", "UNPUBLISHED", "ARCHIVED", "SUPPRESSED"]);
      if (!newStatus || !VALID.has(String(newStatus))) {
        return res.status(400).json({ message: `Invalid queueStatus: ${newStatus}` });
      }

      const [existing] = await db.select().from(rssItems).where(eq(rssItems.id, id));
      if (!existing) return res.status(404).json({ message: "RSS item not found" });

      const updates: Record<string, unknown> = {
        queueStatus: String(newStatus),
        lastEditedBy: editorId,
        lastEditedAt: new Date(),
        updatedAt: new Date(),
      };

      if (newStatus === "SUPPRESSED") {
        if (!reason) return res.status(400).json({ message: "Suppression reason is required" });
        updates.suppressedBy = editorId;
        updates.suppressedAt = new Date();
        updates.suppressionReason = String(reason);
        updates.publishStatus = "SUPPRESSED";
        updates.policyStatus = "SUPPRESS";
        updates.pulseEligible = false;
      } else if (newStatus === "PUBLISHED") {
        updates.publishStatus = "PUBLISHED";
        updates.policyStatus = "ALLOW";
        updates.pulseEligible = true;
        updates.suppressionReason = null;
        updates.suppressedBy = null;
        updates.suppressedAt = null;
      } else if (newStatus === "PULSE_SUPPRESSED") {
        updates.publishStatus = "PUBLISHED";
        updates.policyStatus = "ALLOW";
        updates.pulseEligible = false;
        updates.suppressionReason = null;
        updates.suppressedBy = null;
        updates.suppressedAt = null;
      } else if (newStatus === "ARCHIVED") {
        updates.publishStatus = "ARCHIVED";
        updates.pulseEligible = false;
      } else if (newStatus === "UNPUBLISHED") {
        updates.publishStatus = "DRAFT";
        updates.pulseEligible = false;
      }

      const historyEntry = {
        fields: [`queue-status:${newStatus}`],
        editorId,
        editedAt: new Date().toISOString(),
      };
      const currentHistory = (existing.editHistory || []) as Array<{ fields: string[]; editorId: string; editedAt: string }>;
      updates.editHistory = [...currentHistory.slice(-49), historyEntry];

      const [updated] = await db.update(rssItems).set(updates).where(eq(rssItems.id, id)).returning();
      res.json({ item: updated });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ message: msg });
    }
  });

  app.get("/api/admin/intelligence/rss-items/:id/routing", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const [item] = await db.select().from(rssItems).where(eq(rssItems.id, id));
      if (!item) return res.status(404).json({ message: "RSS item not found" });

      const routing = evaluateContentRouting(item as Record<string, unknown>);
      res.json(routing);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ message: msg });
    }
  });

  app.get("/api/admin/intelligence/rss-items/:id/versions", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const [item] = await db.select().from(rssItems).where(eq(rssItems.id, id));
      if (!item) return res.status(404).json({ message: "RSS item not found" });

      const history = (item.editHistory || []) as Array<{ fields: string[]; editorId: string; editedAt: string; previousValues?: Record<string, unknown>; newValues?: Record<string, unknown> }>;

      const origTitle = item.originalTitle || item.title;
      const origSummary = item.originalSummary || item.summary;
      const origImage = item.originalImageUrl || item.imageUrl;

      const fieldDiffs: Array<{ field: string; original: unknown; aiGenerated: unknown; current: unknown }> = [];
      if (origTitle !== item.title) {
        fieldDiffs.push({ field: "title", original: origTitle, aiGenerated: item.aiGeneratedTitle, current: item.title });
      }
      if (origSummary !== (item.rewrittenSummary || item.summary)) {
        fieldDiffs.push({ field: "summary", original: origSummary, aiGenerated: item.aiGeneratedSummary, current: item.rewrittenSummary || item.summary });
      }
      if (origImage !== item.imageUrl) {
        fieldDiffs.push({ field: "imageUrl", original: origImage, aiGenerated: null, current: item.imageUrl });
      }

      const systemEvents: Array<{ type: string; timestamp: string; detail?: string }> = [];
      if (item.createdAt) {
        systemEvents.push({ type: "ingested", timestamp: new Date(item.createdAt).toISOString(), detail: `Source: ${item.sourceName || "unknown"}` });
      }
      if (item.aiClassifiedAt) {
        systemEvents.push({ type: "ai_classified", timestamp: new Date(item.aiClassifiedAt).toISOString(), detail: `Category: ${item.categoryCoreSlug || "none"}, Geo: ${item.geoPrimarySlug || "none"}` });
      }
      if (item.publishedAt) {
        systemEvents.push({ type: "published", timestamp: new Date(item.publishedAt).toISOString() });
      }
      if (item.suppressedAt) {
        systemEvents.push({ type: "suppressed", timestamp: new Date(item.suppressedAt).toISOString(), detail: `Reason: ${item.suppressionReason || "unknown"}, By: ${item.suppressedBy || "system"}` });
      }

      const editEntries = history.map((entry) => ({
        type: "edit" as const,
        editorId: entry.editorId,
        editedAt: entry.editedAt,
        fieldsChanged: entry.fields,
        previousValues: entry.previousValues || null,
        newValues: entry.newValues || null,
      }));

      const timeline = [
        ...systemEvents.map(e => ({ type: e.type, editedAt: e.timestamp, editorId: "system", fieldsChanged: [] as string[], previousValues: null, newValues: null, detail: e.detail })),
        ...editEntries,
      ].sort((a, b) => new Date(a.editedAt).getTime() - new Date(b.editedAt).getTime());

      res.json({
        current: {
          title: item.title,
          summary: item.rewrittenSummary || item.summary,
          imageUrl: item.imageUrl,
          updatedAt: item.updatedAt,
          lastEditedBy: item.lastEditedBy,
          lastEditedAt: item.lastEditedAt,
        },
        original: {
          title: origTitle,
          summary: origSummary,
          imageUrl: origImage,
          createdAt: item.createdAt,
        },
        aiGenerated: {
          title: item.aiGeneratedTitle,
          summary: item.aiGeneratedSummary,
          classifiedAt: item.aiClassifiedAt,
        },
        fieldDiffs,
        timeline,
        suppression: (item.suppressedBy || item.suppressionReason) ? {
          reason: item.suppressionReason,
          by: item.suppressedBy,
          at: item.suppressedAt,
        } : null,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ message: msg });
    }
  });

  app.post("/api/admin/intelligence/content-integrity-pass", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { cityId } = req.body || {};
      const result = await runContentIntegrityPass(cityId || undefined);
      res.json(result);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ message: msg });
    }
  });

  app.get("/api/admin/intelligence/dedup/stats", requireAdmin, async (req: Request, res: Response) => {
    try {
      const cityId = req.query.cityId as string | undefined;
      const { getDedupStats } = await import("./services/retroactive-dedup");
      const stats = await getDedupStats(cityId || null);
      res.json(stats);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ message: msg });
    }
  });

  app.get("/api/admin/intelligence/dedup/progress", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const { getDedupRunState } = await import("./services/retroactive-dedup");
      const state = getDedupRunState();
      res.json(state);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ message: msg });
    }
  });
}

