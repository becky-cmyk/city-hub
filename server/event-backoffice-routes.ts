import type { Express, Request, Response } from "express";
import { db } from "./db";
import { eq, and, asc, ilike, or } from "drizzle-orm";
import {
  eventSponsors, eventVendorsManaged, events, businesses,
  insertEventSponsorSchema, insertEventVendorManagedSchema,
  type EventSponsor, type EventVendorManaged,
} from "@shared/schema";
import { z } from "zod";

async function isEventOwner(req: Request, eventId: string): Promise<boolean> {
  const session = req.session as any;
  if (!session?.publicUserId) return false;
  const [evt] = await db.select({
    hostBusinessId: events.hostBusinessId,
    eventClaimedByUserId: events.eventClaimedByUserId,
  }).from(events).where(eq(events.id, eventId)).limit(1);
  if (!evt) return false;
  if (evt.eventClaimedByUserId === session.publicUserId) return true;
  if (!evt.hostBusinessId) return false;
  const [biz] = await db.select({ id: businesses.id }).from(businesses).where(and(eq(businesses.id, evt.hostBusinessId), eq(businesses.claimedByUserId, session.publicUserId))).limit(1);
  return !!biz;
}

function isAdmin(req: Request): boolean {
  return !!(req.session as any)?.userId;
}

export function registerEventBackofficeRoutes(app: Express, requireAdmin: any) {

  app.get("/api/admin/events/:eventId/sponsors", requireAdmin, async (req: Request, res: Response) => {
    try {
      const rows = await db.select().from(eventSponsors).where(eq(eventSponsors.eventId, req.params.eventId)).orderBy(asc(eventSponsors.sortOrder));
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/events/:eventId/sponsors", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = insertEventSponsorSchema.safeParse({ ...req.body, eventId: req.params.eventId });
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
      const [row] = await db.insert(eventSponsors).values(parsed.data).returning();
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/admin/event-sponsors/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = insertEventSponsorSchema.partial().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
      const [row] = await db.update(eventSponsors).set({ ...parsed.data, updatedAt: new Date() }).where(eq(eventSponsors.id, req.params.id)).returning();
      if (!row) return res.status(404).json({ message: "Not found" });
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/admin/event-sponsors/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await db.delete(eventSponsors).where(eq(eventSponsors.id, req.params.id));
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/events/:eventId/vendors-managed", requireAdmin, async (req: Request, res: Response) => {
    try {
      const rows = await db.select().from(eventVendorsManaged).where(eq(eventVendorsManaged.eventId, req.params.eventId)).orderBy(asc(eventVendorsManaged.sortOrder));
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/events/:eventId/vendors-managed", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = insertEventVendorManagedSchema.safeParse({ ...req.body, eventId: req.params.eventId });
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
      const [row] = await db.insert(eventVendorsManaged).values(parsed.data).returning();
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/admin/event-vendors-managed/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = insertEventVendorManagedSchema.partial().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
      const [row] = await db.update(eventVendorsManaged).set({ ...parsed.data, updatedAt: new Date() }).where(eq(eventVendorsManaged.id, req.params.id)).returning();
      if (!row) return res.status(404).json({ message: "Not found" });
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/admin/event-vendors-managed/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await db.delete(eventVendorsManaged).where(eq(eventVendorsManaged.id, req.params.id));
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  const VALID_VENDOR_STATUSES = ["applied", "under_review", "approved", "rejected", "waitlisted", "confirmed", "withdrawn"];
  app.patch("/api/admin/event-vendors-managed/:id/status", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { status } = req.body;
      if (!status || !VALID_VENDOR_STATUSES.includes(status)) return res.status(400).json({ message: `Invalid status. Must be one of: ${VALID_VENDOR_STATUSES.join(", ")}` });
      const [row] = await db.update(eventVendorsManaged).set({ status, updatedAt: new Date() }).where(eq(eventVendorsManaged.id, req.params.id)).returning();
      if (!row) return res.status(404).json({ message: "Not found" });
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/owner/events/:eventId/sponsors", async (req: Request, res: Response) => {
    try {
      const canAccess = await isEventOwner(req, req.params.eventId) || isAdmin(req);
      if (!canAccess) return res.status(403).json({ message: "Forbidden" });
      const rows = await db.select().from(eventSponsors).where(eq(eventSponsors.eventId, req.params.eventId)).orderBy(asc(eventSponsors.sortOrder));
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/owner/events/:eventId/sponsors", async (req: Request, res: Response) => {
    try {
      const canAccess = await isEventOwner(req, req.params.eventId) || isAdmin(req);
      if (!canAccess) return res.status(403).json({ message: "Forbidden" });
      const parsed = insertEventSponsorSchema.safeParse({ ...req.body, eventId: req.params.eventId });
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
      const [row] = await db.insert(eventSponsors).values(parsed.data).returning();
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/owner/event-sponsors/:id", async (req: Request, res: Response) => {
    try {
      const [sponsor] = await db.select().from(eventSponsors).where(eq(eventSponsors.id, req.params.id)).limit(1);
      if (!sponsor?.eventId) return res.status(404).json({ message: "Not found" });
      const canAccess = await isEventOwner(req, sponsor.eventId) || isAdmin(req);
      if (!canAccess) return res.status(403).json({ message: "Forbidden" });
      const parsed = insertEventSponsorSchema.partial().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
      const { eventId, eventSeriesId, ...safeData } = parsed.data as any;
      const [row] = await db.update(eventSponsors).set({ ...safeData, updatedAt: new Date() }).where(eq(eventSponsors.id, req.params.id)).returning();
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/owner/event-sponsors/:id", async (req: Request, res: Response) => {
    try {
      const [sponsor] = await db.select().from(eventSponsors).where(eq(eventSponsors.id, req.params.id)).limit(1);
      if (!sponsor?.eventId) return res.status(404).json({ message: "Not found" });
      const canAccess = await isEventOwner(req, sponsor.eventId) || isAdmin(req);
      if (!canAccess) return res.status(403).json({ message: "Forbidden" });
      await db.delete(eventSponsors).where(eq(eventSponsors.id, req.params.id));
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/owner/events/:eventId/vendors-managed", async (req: Request, res: Response) => {
    try {
      const canAccess = await isEventOwner(req, req.params.eventId) || isAdmin(req);
      if (!canAccess) return res.status(403).json({ message: "Forbidden" });
      const rows = await db.select().from(eventVendorsManaged).where(eq(eventVendorsManaged.eventId, req.params.eventId)).orderBy(asc(eventVendorsManaged.sortOrder));
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/owner/events/:eventId/vendors-managed", async (req: Request, res: Response) => {
    try {
      const canAccess = await isEventOwner(req, req.params.eventId) || isAdmin(req);
      if (!canAccess) return res.status(403).json({ message: "Forbidden" });
      const parsed = insertEventVendorManagedSchema.safeParse({ ...req.body, eventId: req.params.eventId });
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
      const [row] = await db.insert(eventVendorsManaged).values(parsed.data).returning();
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/owner/event-vendors-managed/:id", async (req: Request, res: Response) => {
    try {
      const [vendor] = await db.select().from(eventVendorsManaged).where(eq(eventVendorsManaged.id, req.params.id)).limit(1);
      if (!vendor?.eventId) return res.status(404).json({ message: "Not found" });
      const canAccess = await isEventOwner(req, vendor.eventId) || isAdmin(req);
      if (!canAccess) return res.status(403).json({ message: "Forbidden" });
      const parsed = insertEventVendorManagedSchema.partial().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
      const { eventId, eventSeriesId, ...safeData } = parsed.data as any;
      const [row] = await db.update(eventVendorsManaged).set({ ...safeData, updatedAt: new Date() }).where(eq(eventVendorsManaged.id, req.params.id)).returning();
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/owner/event-vendors-managed/:id", async (req: Request, res: Response) => {
    try {
      const [vendor] = await db.select().from(eventVendorsManaged).where(eq(eventVendorsManaged.id, req.params.id)).limit(1);
      if (!vendor?.eventId) return res.status(404).json({ message: "Not found" });
      const canAccess = await isEventOwner(req, vendor.eventId) || isAdmin(req);
      if (!canAccess) return res.status(403).json({ message: "Forbidden" });
      await db.delete(eventVendorsManaged).where(eq(eventVendorsManaged.id, req.params.id));
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/events/:eventId/sponsors/public", async (_req: Request, res: Response) => {
    try {
      const rows = await db.select().from(eventSponsors)
        .where(and(eq(eventSponsors.eventId, _req.params.eventId), eq(eventSponsors.status, "confirmed"), eq(eventSponsors.displayPublicly, true)))
        .orderBy(asc(eventSponsors.sortOrder));
      const enriched = await Promise.all(rows.map(async (s) => {
        let presenceSlug: string | null = null;
        let presenceImageUrl: string | null = null;
        if (s.presenceId) {
          const [biz] = await db.select({ slug: businesses.slug, imageUrl: businesses.imageUrl, micrositeLogo: businesses.micrositeLogo }).from(businesses).where(eq(businesses.id, s.presenceId)).limit(1);
          if (biz) {
            presenceSlug = biz.slug;
            presenceImageUrl = biz.micrositeLogo || biz.imageUrl;
          }
        }
        return { ...s, presenceSlug, presenceImageUrl };
      }));
      res.json(enriched);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/events/:eventId/vendors-managed/public", async (_req: Request, res: Response) => {
    try {
      const rows = await db.select().from(eventVendorsManaged)
        .where(and(eq(eventVendorsManaged.eventId, _req.params.eventId), eq(eventVendorsManaged.status, "confirmed"), eq(eventVendorsManaged.displayPublicly, true)))
        .orderBy(asc(eventVendorsManaged.sortOrder));
      const enriched = await Promise.all(rows.map(async (v) => {
        let presenceSlug: string | null = null;
        let presenceImageUrl: string | null = null;
        if (v.presenceId) {
          const [biz] = await db.select({ slug: businesses.slug, imageUrl: businesses.imageUrl, micrositeLogo: businesses.micrositeLogo }).from(businesses).where(eq(businesses.id, v.presenceId)).limit(1);
          if (biz) {
            presenceSlug = biz.slug;
            presenceImageUrl = biz.micrositeLogo || biz.imageUrl;
          }
        }
        return { ...v, presenceSlug, presenceImageUrl };
      }));
      res.json(enriched);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/events/:eventId/sponsor-interest", async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        name: z.string().min(1).max(200),
        contactName: z.string().min(1).max(200),
        contactEmail: z.string().email().max(200),
        contactPhone: z.string().max(50).optional(),
        tier: z.string().optional(),
        notes: z.string().max(2000).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
      const [row] = await db.insert(eventSponsors).values({
        eventId: req.params.eventId,
        name: parsed.data.name,
        contactName: parsed.data.contactName,
        contactEmail: parsed.data.contactEmail,
        contactPhone: parsed.data.contactPhone || null,
        tier: (parsed.data.tier as any) || "community",
        status: "prospect",
        displayPublicly: false,
        notes: parsed.data.notes || null,
      }).returning();
      res.status(201).json(row);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/events/:eventId/vendor-application", async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        name: z.string().min(1).max(200),
        category: z.string().max(100).optional(),
        contactName: z.string().min(1).max(200),
        contactEmail: z.string().email().max(200),
        contactPhone: z.string().max(50).optional(),
        description: z.string().max(2000).optional(),
        websiteUrl: z.string().max(500).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
      const [row] = await db.insert(eventVendorsManaged).values({
        eventId: req.params.eventId,
        name: parsed.data.name,
        category: parsed.data.category || null,
        contactName: parsed.data.contactName,
        contactEmail: parsed.data.contactEmail,
        contactPhone: parsed.data.contactPhone || null,
        description: parsed.data.description || null,
        websiteUrl: parsed.data.websiteUrl || null,
        status: "applied",
        displayPublicly: false,
      }).returning();
      res.status(201).json(row);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/businesses/search-presence", requireAdmin, async (req: Request, res: Response) => {
    try {
      const q = (req.query.q as string || "").trim();
      if (q.length < 2) return res.json([]);
      const rows = await db.select({ id: businesses.id, name: businesses.name, slug: businesses.slug, imageUrl: businesses.imageUrl })
        .from(businesses)
        .where(ilike(businesses.name, `%${q}%`))
        .limit(10);
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/owner/businesses/search-presence", async (req: Request, res: Response) => {
    const publicUserId = (req.session as any).publicUserId;
    if (!publicUserId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const q = (req.query.q as string || "").trim();
      if (q.length < 2) return res.json([]);
      const rows = await db.select({ id: businesses.id, name: businesses.name, slug: businesses.slug, imageUrl: businesses.imageUrl })
        .from(businesses)
        .where(ilike(businesses.name, `%${q}%`))
        .limit(10);
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });
}
