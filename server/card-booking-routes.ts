import type { Express, Request, Response } from "express";
import { db } from "./db";
import { digitalCards, cardBookings, crmContacts } from "@shared/schema";
import { eq, and, gte, lte, gt, lt, desc, ilike } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatIcsDate(d: Date): string {
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`;
}

function foldLine(line: string): string {
  const parts: string[] = [];
  let remaining = line;
  while (remaining.length > 75) {
    parts.push(remaining.slice(0, 75));
    remaining = " " + remaining.slice(75);
  }
  parts.push(remaining);
  return parts.join("\r\n");
}

function generateSingleIcs(booking: {
  icsUid: string | null;
  startTime: Date | null;
  endTime: Date | null;
  guestName: string;
  guestEmail: string;
  notes: string | null;
}, cardName: string): string {
  const uid = booking.icsUid || `${crypto.randomUUID()}@cityhub`;
  const start = booking.startTime ? formatIcsDate(new Date(booking.startTime)) : "";
  const end = booking.endTime ? formatIcsDate(new Date(booking.endTime)) : "";
  const summary = `Meeting with ${cardName}`;
  const description = booking.notes ? booking.notes.replace(/\n/g, "\\n") : "";

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CityHub//Digital Cards//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    foldLine(`UID:${uid}`),
    `DTSTART:${start}`,
    `DTEND:${end}`,
    foldLine(`SUMMARY:${summary}`),
    foldLine(`DESCRIPTION:${description}`),
    `ATTENDEE;CN=${booking.guestName}:mailto:${booking.guestEmail}`,
    `STATUS:CONFIRMED`,
    `END:VEVENT`,
    `END:VCALENDAR`,
  ];
  return lines.join("\r\n");
}

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function getTimezoneOffsetMs(timezone: string, refDate: Date): number {
  const utcStr = refDate.toLocaleString("en-US", { timeZone: "UTC" });
  const tzStr = refDate.toLocaleString("en-US", { timeZone: timezone });
  return new Date(utcStr).getTime() - new Date(tzStr).getTime();
}

function localTimeToUTC(dateStr: string, hours: number, minutes: number, timezone: string): Date {
  const naiveUTC = new Date(`${dateStr}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00Z`);
  const offsetMs = getTimezoneOffsetMs(timezone, naiveUTC);
  return new Date(naiveUTC.getTime() + offsetMs);
}

function getDayOfWeekInTimezone(dateStr: string, timezone: string): number {
  const noon = new Date(`${dateStr}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).formatToParts(noon);
  const weekday = parts.find(p => p.type === "weekday")?.value || "";
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[weekday] ?? noon.getUTCDay();
}

function getAvailableSlots(
  date: string,
  availability: Record<string, { start: string; end: string; enabled: boolean }> | null,
  slotMinutes: number,
  bufferMinutes: number,
  timezone: string,
  existingBookings: Array<{ startTime: Date | null; endTime: Date | null; status: string | null }>
): Array<{ start: string; end: string }> {
  if (!availability) return [];

  const dayOfWeek = getDayOfWeekInTimezone(date, timezone);
  const dayName = DAY_NAMES[dayOfWeek];

  const dayConfig = availability[dayName];
  if (!dayConfig || !dayConfig.enabled) return [];

  const [startH, startM] = dayConfig.start.split(":").map(Number);
  const [endH, endM] = dayConfig.end.split(":").map(Number);

  const dayStartMinutes = startH * 60 + startM;
  const dayEndMinutes = endH * 60 + endM;

  const confirmedBookings = existingBookings
    .filter(b => b.status === "confirmed" && b.startTime && b.endTime)
    .map(b => ({
      start: new Date(b.startTime!).getTime(),
      end: new Date(b.endTime!).getTime(),
    }));

  const slots: Array<{ start: string; end: string }> = [];
  const now = Date.now();

  for (let m = dayStartMinutes; m + slotMinutes <= dayEndMinutes; m += slotMinutes + bufferMinutes) {
    const slotStartUTC = localTimeToUTC(date, Math.floor(m / 60), m % 60, timezone);
    const slotEndUTC = new Date(slotStartUTC.getTime() + slotMinutes * 60 * 1000);

    const hasConflict = confirmedBookings.some(b =>
      slotStartUTC.getTime() < b.end && slotEndUTC.getTime() > b.start
    );

    if (!hasConflict && slotStartUTC.getTime() > now) {
      slots.push({
        start: slotStartUTC.toISOString(),
        end: slotEndUTC.toISOString(),
      });
    }
  }

  return slots;
}

export function registerCardBookingRoutes(app: Express, requireAdmin: any) {
  app.get("/api/card/:slug/availability", async (req: Request, res: Response) => {
    try {
      const { date } = req.query;
      if (!date || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: "date query parameter required in YYYY-MM-DD format" });
      }

      const [card] = await db.select().from(digitalCards)
        .where(and(eq(digitalCards.slug, req.params.slug), eq(digitalCards.isActive, true)));
      if (!card) return res.status(404).json({ message: "Card not found" });

      if (!card.bookingEnabled) {
        return res.status(400).json({ message: "Booking is not enabled for this card" });
      }

      const maxDays = card.bookingMaxDaysAhead || 30;
      const requestedDate = new Date(date + "T00:00:00Z");
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + maxDays);
      if (requestedDate > maxDate) {
        return res.json({ slots: [] });
      }

      const tz = card.bookingTimezone || "America/New_York";
      const dayStartUTC = localTimeToUTC(date, 0, 0, tz);
      const dayEndUTC = new Date(dayStartUTC.getTime() + 24 * 60 * 60 * 1000);

      const existingBookings = await db.select().from(cardBookings)
        .where(
          and(
            eq(cardBookings.cardId, card.id),
            lt(cardBookings.startTime, dayEndUTC),
            gt(cardBookings.endTime, dayStartUTC)
          )
        );

      const slots = getAvailableSlots(
        date,
        card.bookingAvailability as Record<string, { start: string; end: string; enabled: boolean }> | null,
        card.bookingSlotMinutes || 30,
        card.bookingBufferMinutes || 0,
        card.bookingTimezone || "America/New_York",
        existingBookings
      );

      res.json({ slots });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  const bookingSchema = z.object({
    guestName: z.string().min(1).max(200),
    guestEmail: z.string().email().max(200),
    guestPhone: z.string().max(50).optional(),
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
    notes: z.string().max(2000).optional(),
  });

  app.post("/api/card/:slug/book", async (req: Request, res: Response) => {
    try {
      const [card] = await db.select().from(digitalCards)
        .where(and(eq(digitalCards.slug, req.params.slug), eq(digitalCards.isActive, true)));
      if (!card) return res.status(404).json({ message: "Card not found" });

      if (!card.bookingEnabled) {
        return res.status(400).json({ message: "Booking is not enabled for this card" });
      }

      const data = bookingSchema.parse(req.body);
      const startTime = new Date(data.startTime);
      const endTime = new Date(data.endTime);

      if (endTime <= startTime) {
        return res.status(400).json({ message: "End time must be after start time" });
      }

      const conflicting = await db.select().from(cardBookings)
        .where(
          and(
            eq(cardBookings.cardId, card.id),
            eq(cardBookings.status, "confirmed"),
            lt(cardBookings.startTime, endTime),
            gt(cardBookings.endTime, startTime)
          )
        );

      if (conflicting.length > 0) {
        return res.status(409).json({ message: "This time slot is no longer available" });
      }

      const icsUid = `${crypto.randomUUID()}@cityhub`;
      const [booking] = await db.insert(cardBookings).values({
        cardId: card.id,
        guestName: data.guestName,
        guestEmail: data.guestEmail,
        guestPhone: data.guestPhone || null,
        startTime,
        endTime,
        status: "confirmed",
        notes: data.notes || null,
        icsUid,
      }).returning();

      const ics = generateSingleIcs(booking, card.name);

      if (data.guestEmail) {
        try {
          const matchingCaptures = await db.select({ id: crmContacts.id }).from(crmContacts)
            .where(ilike(crmContacts.email, data.guestEmail))
            .limit(5);

          for (const cap of matchingCaptures) {
            await db.update(crmContacts).set({
              outreachStatus: "BOOKED",
              calendarBookedAt: new Date(),
              updatedAt: new Date(),
            }).where(eq(crmContacts.id, cap.id));
          }
          if (matchingCaptures.length > 0) {
            console.log(`[Booking] Auto-marked ${matchingCaptures.length} capture(s) as BOOKED for ${data.guestEmail}`);
          }
        } catch (linkErr: unknown) {
          const msg = linkErr instanceof Error ? linkErr.message : "Unknown";
          console.error("[Booking] CRM auto-link error (non-fatal):", msg);
        }
      }

      res.status(201).json({
        booking,
        ics,
      });
    } catch (e: unknown) {
      const err = e as Record<string, unknown>;
      if (err.name === "ZodError") return res.status(400).json({ message: "Validation error", errors: err.errors });
      const msg = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message: msg });
    }
  });

  app.get("/api/card/:slug/calendar.ics", async (req: Request, res: Response) => {
    try {
      const [card] = await db.select().from(digitalCards)
        .where(and(eq(digitalCards.slug, req.params.slug), eq(digitalCards.isActive, true)));
      if (!card) return res.status(404).json({ message: "Card not found" });

      const bookings = await db.select().from(cardBookings)
        .where(
          and(
            eq(cardBookings.cardId, card.id),
            eq(cardBookings.status, "confirmed")
          )
        );

      const events = bookings.map(b => {
        const uid = b.icsUid || `${crypto.randomUUID()}@cityhub`;
        const start = b.startTime ? formatIcsDate(new Date(b.startTime)) : "";
        const end = b.endTime ? formatIcsDate(new Date(b.endTime)) : "";
        const summary = `Meeting: ${b.guestName}`;
        const description = b.notes ? b.notes.replace(/\n/g, "\\n") : "";
        const created = b.createdAt ? formatIcsDate(new Date(b.createdAt)) : formatIcsDate(new Date());

        return [
          "BEGIN:VEVENT",
          foldLine(`UID:${uid}`),
          `DTSTART:${start}`,
          `DTEND:${end}`,
          foldLine(`SUMMARY:${summary}`),
          foldLine(`DESCRIPTION:${description}`),
          `ATTENDEE;CN=${b.guestName}:mailto:${b.guestEmail}`,
          `DTSTAMP:${created}`,
          `STATUS:CONFIRMED`,
          "END:VEVENT",
        ].join("\r\n");
      });

      const cal = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//CityHub//Digital Cards//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        foldLine(`X-WR-CALNAME:${card.name} - Bookings`),
        ...events,
        "END:VCALENDAR",
      ].join("\r\n");

      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${card.slug}-calendar.ics"`);
      res.send(cal);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/digital-cards/:id/bookings", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      const [card] = await db.select().from(digitalCards)
        .where(and(eq(digitalCards.id, req.params.id), eq(digitalCards.userId, userId)));
      if (!card) return res.status(404).json({ message: "Card not found" });

      const bookings = await db.select().from(cardBookings)
        .where(eq(cardBookings.cardId, card.id))
        .orderBy(desc(cardBookings.startTime));

      res.json({ data: bookings });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/digital-cards/:id/bookings/:bookingId", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      const [card] = await db.select().from(digitalCards)
        .where(and(eq(digitalCards.id, req.params.id), eq(digitalCards.userId, userId)));
      if (!card) return res.status(404).json({ message: "Card not found" });

      const [existing] = await db.select().from(cardBookings)
        .where(and(eq(cardBookings.id, req.params.bookingId), eq(cardBookings.cardId, card.id)));
      if (!existing) return res.status(404).json({ message: "Booking not found" });

      const { status } = req.body;
      if (status && ["confirmed", "cancelled", "completed"].includes(status)) {
        const [updated] = await db.update(cardBookings)
          .set({ status, updatedAt: new Date() })
          .where(eq(cardBookings.id, req.params.bookingId))
          .returning();
        return res.json(updated);
      }

      return res.status(400).json({ message: "Invalid status. Must be: confirmed, cancelled, or completed" });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });
}
