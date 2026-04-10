import type { Express, Request, Response } from "express";
import { db } from "./db";
import { radioAdTiers, radioAdBookings, businesses } from "@shared/schema";
import { eq, and, desc, ilike, or } from "drizzle-orm";
import { z } from "zod";
import multer from "multer";
import path from "path";
import crypto from "crypto";

const uploadDir = path.join(process.cwd(), "uploads");

const audioUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".mp3";
      cb(null, `radio-ad-${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/aac", "audio/mp4"];
    cb(null, allowed.includes(file.mimetype));
  },
});

const createTierSchema = z.object({
  name: z.string().min(1),
  level: z.enum(["metro", "micro", "venue"]),
  timeSlot: z.enum(["prime", "standard", "overnight"]),
  priceCents: z.number().int().min(0),
  billingCycle: z.enum(["monthly", "quarterly", "annual"]).default("monthly"),
  description: z.string().optional().nullable(),
  maxSpotsPerHour: z.number().int().min(1).default(4),
  spotDurationSeconds: z.number().int().min(5).default(30),
  isActive: z.boolean().default(true),
  cityId: z.string().optional().nullable(),
});

const updateTierSchema = createTierSchema.partial();

const createBookingSchema = z.object({
  businessId: z.string().optional().nullable(),
  tierId: z.string().min(1),
  stationId: z.string().optional().nullable(),
  audioUrl: z.string().optional().nullable(),
  headline: z.string().optional().nullable(),
  scriptText: z.string().optional().nullable(),
  status: z.enum(["pending", "approved", "active", "paused", "completed", "rejected"]).default("pending"),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  stripeSubscriptionId: z.string().optional().nullable(),
  totalPaidCents: z.number().int().min(0).default(0),
  cityId: z.string().optional().nullable(),
});

const updateBookingSchema = createBookingSchema.partial();

const adInquirySchema = z.object({
  businessName: z.string().min(1),
  contactName: z.string().min(1),
  contactEmail: z.string().email(),
  contactPhone: z.string().optional().nullable(),
  preferredLevel: z.enum(["metro", "micro", "venue"]).optional().nullable(),
  preferredTimeSlot: z.enum(["prime", "standard", "overnight"]).optional().nullable(),
  message: z.string().optional().nullable(),
  cityId: z.string().optional().nullable(),
});

export function registerRadioAdRoutes(app: Express, requireAdmin: any) {
  app.get("/api/admin/radio/ad-tiers", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const tiers = await db.select().from(radioAdTiers).orderBy(radioAdTiers.level, radioAdTiers.timeSlot);
      res.json(tiers);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/radio/ad-tiers", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = createTierSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      }
      const [created] = await db.insert(radioAdTiers).values(parsed.data).returning();
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/radio/ad-tiers/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = updateTierSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      }
      const [updated] = await db.update(radioAdTiers)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(radioAdTiers.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Tier not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/radio/ad-tiers/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const [deleted] = await db.delete(radioAdTiers)
        .where(eq(radioAdTiers.id, req.params.id))
        .returning();
      if (!deleted) return res.status(404).json({ message: "Tier not found" });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/radio/ad-bookings", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { status, tierId, businessId } = req.query;
      const conditions: any[] = [];
      if (status && typeof status === "string") {
        conditions.push(eq(radioAdBookings.status, status as any));
      }
      if (tierId && typeof tierId === "string") {
        conditions.push(eq(radioAdBookings.tierId, tierId));
      }
      if (businessId && typeof businessId === "string") {
        conditions.push(eq(radioAdBookings.businessId, businessId));
      }

      const bookings = conditions.length > 0
        ? await db.select().from(radioAdBookings).where(and(...conditions)).orderBy(desc(radioAdBookings.createdAt))
        : await db.select().from(radioAdBookings).orderBy(desc(radioAdBookings.createdAt));

      const enriched = await Promise.all(bookings.map(async (booking) => {
        let businessName = null;
        let tierName = null;
        if (booking.businessId) {
          const [biz] = await db.select({ name: businesses.name }).from(businesses).where(eq(businesses.id, booking.businessId)).limit(1);
          businessName = biz?.name || null;
        }
        if (booking.tierId) {
          const [tier] = await db.select({ name: radioAdTiers.name }).from(radioAdTiers).where(eq(radioAdTiers.id, booking.tierId)).limit(1);
          tierName = tier?.name || null;
        }
        return { ...booking, businessName, tierName };
      }));
      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/radio/ad-bookings", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = createBookingSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      }
      const values: any = { ...parsed.data };
      if (values.startDate) values.startDate = new Date(values.startDate);
      if (values.endDate) values.endDate = new Date(values.endDate);
      const [created] = await db.insert(radioAdBookings).values(values).returning();
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/radio/ad-bookings/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = updateBookingSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      }
      const values: any = { ...parsed.data, updatedAt: new Date() };
      if (values.startDate) values.startDate = new Date(values.startDate);
      if (values.endDate) values.endDate = new Date(values.endDate);
      const [updated] = await db.update(radioAdBookings)
        .set(values)
        .where(eq(radioAdBookings.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Booking not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/radio/ad-bookings/:id/status", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { status } = req.body;
      const validStatuses = ["pending", "approved", "active", "paused", "completed", "rejected"];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status. Must be one of: " + validStatuses.join(", ") });
      }
      const updateData: any = { status, updatedAt: new Date() };
      if (status === "approved") {
        updateData.approvedAt = new Date();
      }
      const [updated] = await db.update(radioAdBookings)
        .set(updateData)
        .where(eq(radioAdBookings.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Booking not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/radio/ad-bookings/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const [deleted] = await db.delete(radioAdBookings)
        .where(eq(radioAdBookings.id, req.params.id))
        .returning();
      if (!deleted) return res.status(404).json({ message: "Booking not found" });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/radio/ad-bookings/:id/upload-audio", requireAdmin, audioUpload.single("audio"), async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: "No audio file provided" });
      }
      const audioUrl = `/uploads/${file.filename}`;
      const [updated] = await db.update(radioAdBookings)
        .set({ audioUrl, updatedAt: new Date() })
        .where(eq(radioAdBookings.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Booking not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/radio/ad-inquiry", async (req: Request, res: Response) => {
    try {
      const parsed = adInquirySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      }
      const data = parsed.data;
      const bookingValues: any = {
        headline: `Inquiry: ${data.businessName}`,
        scriptText: `Contact: ${data.contactName} (${data.contactEmail}${data.contactPhone ? ", " + data.contactPhone : ""})\nPreferred Level: ${data.preferredLevel || "any"}\nPreferred Time Slot: ${data.preferredTimeSlot || "any"}\nMessage: ${data.message || "N/A"}`,
        status: "pending" as const,
        cityId: data.cityId || null,
      };

      const tiers = await db.select().from(radioAdTiers).limit(1);
      if (tiers.length > 0) {
        let matchConditions: any[] = [];
        if (data.preferredLevel) {
          matchConditions.push(eq(radioAdTiers.level, data.preferredLevel));
        }
        if (data.preferredTimeSlot) {
          matchConditions.push(eq(radioAdTiers.timeSlot, data.preferredTimeSlot));
        }
        let matchedTier;
        if (matchConditions.length > 0) {
          const [matched] = await db.select().from(radioAdTiers).where(and(...matchConditions)).limit(1);
          matchedTier = matched;
        }
        if (!matchedTier) {
          matchedTier = tiers[0];
        }
        bookingValues.tierId = matchedTier.id;
      } else {
        return res.status(400).json({ message: "No ad tiers configured yet. Please contact us directly." });
      }

      const [created] = await db.insert(radioAdBookings).values(bookingValues).returning();
      res.status(201).json({ success: true, message: "Your radio advertising inquiry has been submitted. We'll be in touch soon!", bookingId: created.id });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
