import type { Express, Request, Response, NextFunction } from "express";
import { db, pool } from "./db";
import { eq, and, asc, desc, inArray } from "drizzle-orm";
import {
  eventTicketTypes, eventArticleMentions, eventRssSuppressions,
  ticketPurchases, eventWaitlist,
  events, eventSeries, businesses, zones,
  insertEventTicketTypeSchema, insertEventArticleMentionSchema, insertEventRssSuppressionSchema,
} from "@shared/schema";
import { isAdminSession } from "./admin-check";
import { getStripe } from "./stripe/webhook";

async function autoAdvanceWaitlist(eventId: string, slotsFreed: number = 1) {
  try {
    const expireResult = await pool.query(
      `UPDATE event_waitlist SET expired_at = NOW()
       WHERE event_id = $1 AND notified_at IS NOT NULL AND converted_at IS NULL AND expired_at IS NULL
       AND notified_at < NOW() - INTERVAL '24 hours'
       RETURNING id`,
      [eventId]
    );

    const totalSlots = slotsFreed + expireResult.rows.length;

    const nextInLine = await pool.query(
      `SELECT id, name, email FROM event_waitlist
       WHERE event_id = $1 AND notified_at IS NULL AND converted_at IS NULL AND expired_at IS NULL
       ORDER BY created_at ASC LIMIT $2`,
      [eventId, totalSlots]
    );

    for (const entry of nextInLine.rows) {
      await pool.query(`UPDATE event_waitlist SET notified_at = NOW() WHERE id = $1`, [entry.id]);
      try {
        const { sendTemplatedEmail } = await import("./resend-client");
        const eventResult = await pool.query(
          `SELECT e.title, e.slug, c.slug AS city_slug
           FROM events e JOIN cities c ON c.id = e.city_id WHERE e.id = $1`,
          [eventId]
        );
        if (eventResult.rows.length > 0) {
          const evt = eventResult.rows[0];
          const appUrl = process.env.APP_PUBLIC_URL || "https://localpulse.city";
          const ticketUrl = `${appUrl}/${evt.city_slug}/events/${evt.slug}?waitlist=true`;
          await sendTemplatedEmail(
            entry.email,
            `Tickets Available: ${evt.title}`,
            `<h2>Good news, ${entry.name}!</h2>
             <p>Tickets are now available for <strong>${evt.title}</strong>.</p>
             <p>This offer expires in 24 hours. <a href="${ticketUrl}">Get your tickets now</a>.</p>`
          );
        }
      } catch (emailErr) {
        console.error("[WAITLIST] Auto-advance email failed:", emailErr);
      }
    }

    return { expired: expireResult.rows.length, advanced: nextInLine.rows.length };
  } catch (err) {
    console.error("[WAITLIST] Auto-advance error:", err);
    return { expired: 0, advanced: 0 };
  }
}

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const userId = (req.session as Record<string, unknown>).userId as string;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });
  const result = await pool.query(`SELECT role FROM users WHERE id = $1`, [userId]);
  if (result.rows.length === 0) return res.status(401).json({ message: "Unauthorized" });
  const role = result.rows[0].role;
  const adminRoles = ["PLATFORM_ADMIN", "SUPER_ADMIN", "super_admin", "admin", "ADMIN", "CITY_ADMIN"];
  if (!adminRoles.includes(role)) return res.status(403).json({ message: "Admin access required" });
  next();
}

async function requireOwner(req: Request, res: Response, next: NextFunction) {
  if ((req.session as Record<string, unknown>).ownerAccountId) {
    return next();
  }
  if (await isAdminSession(req)) return next();
  return res.status(401).json({ message: "Unauthorized" });
}

async function getAuthorizedCityId(req: Request, requestedCityId?: string): Promise<{ cityId: string | null; forbidden: boolean }> {
  const userId = (req.session as Record<string, unknown>).userId as string;
  if (!userId) return { cityId: null, forbidden: true };
  const userResult = await pool.query(`SELECT role, city_id FROM users WHERE id = $1`, [userId]);
  if (userResult.rows.length === 0) return { cityId: null, forbidden: true };
  const user = userResult.rows[0];
  const isPlatformAdmin = ["PLATFORM_ADMIN", "SUPER_ADMIN", "super_admin", "admin", "ADMIN"].includes(user.role);
  if (isPlatformAdmin) return { cityId: requestedCityId || null, forbidden: false };
  if (user.role === "CITY_ADMIN" && user.city_id) {
    if (requestedCityId && requestedCityId !== user.city_id) return { cityId: null, forbidden: true };
    return { cityId: user.city_id, forbidden: false };
  }
  return { cityId: requestedCityId || null, forbidden: false };
}

async function verifyEventCityAccess(req: Request, eventId: string): Promise<{ allowed: boolean; event?: Record<string, string> }> {
  const userId = (req.session as Record<string, unknown>).userId as string;
  if (!userId) return { allowed: false };
  const userResult = await pool.query(`SELECT role, city_id FROM users WHERE id = $1`, [userId]);
  if (userResult.rows.length === 0) return { allowed: false };
  const user = userResult.rows[0];
  const isPlatformAdmin = ["PLATFORM_ADMIN", "SUPER_ADMIN", "super_admin", "admin", "ADMIN"].includes(user.role);
  if (isPlatformAdmin) return { allowed: true };
  if (user.role === "CITY_ADMIN" && user.city_id) {
    const eventResult = await pool.query(`SELECT city_id FROM events WHERE id = $1`, [eventId]);
    if (eventResult.rows.length === 0) return { allowed: false };
    return { allowed: eventResult.rows[0].city_id === user.city_id, event: eventResult.rows[0] };
  }
  return { allowed: true };
}

export function registerEventManagementRoutes(app: Express) {

  app.get("/api/admin/events/:eventId/ticket-types", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { allowed } = await verifyEventCityAccess(req, req.params.eventId);
      if (!allowed) return res.status(403).json({ message: "Access denied" });
      const rows = await db.select().from(eventTicketTypes)
        .where(eq(eventTicketTypes.eventId, req.params.eventId))
        .orderBy(asc(eventTicketTypes.sortOrder));
      res.json(rows);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.post("/api/admin/events/:eventId/ticket-types", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { allowed } = await verifyEventCityAccess(req, req.params.eventId);
      if (!allowed) return res.status(403).json({ message: "Access denied" });
      const parsed = insertEventTicketTypeSchema.safeParse({ ...req.body, eventId: req.params.eventId });
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
      const [row] = await db.insert(eventTicketTypes).values(parsed.data).returning();
      res.status(201).json(row);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.patch("/api/admin/ticket-types/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const [existing] = await db.select({ eventId: eventTicketTypes.eventId }).from(eventTicketTypes).where(eq(eventTicketTypes.id, req.params.id));
      if (!existing) return res.status(404).json({ message: "Not found" });
      const { allowed } = await verifyEventCityAccess(req, existing.eventId);
      if (!allowed) return res.status(403).json({ message: "Access denied" });
      const parsed = insertEventTicketTypeSchema.partial().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
      const [row] = await db.update(eventTicketTypes)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(eventTicketTypes.id, req.params.id))
        .returning();
      res.json(row);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.delete("/api/admin/ticket-types/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const [existing] = await db.select({ eventId: eventTicketTypes.eventId }).from(eventTicketTypes).where(eq(eventTicketTypes.id, req.params.id));
      if (!existing) return res.status(404).json({ message: "Not found" });
      const { allowed } = await verifyEventCityAccess(req, existing.eventId);
      if (!allowed) return res.status(403).json({ message: "Access denied" });
      await db.delete(eventTicketTypes).where(eq(eventTicketTypes.id, req.params.id));
      res.json({ success: true });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.get("/api/events/:eventId/ticket-types", async (req: Request, res: Response) => {
    try {
      const rows = await db.select().from(eventTicketTypes)
        .where(and(eq(eventTicketTypes.eventId, req.params.eventId), eq(eventTicketTypes.isActive, true)))
        .orderBy(asc(eventTicketTypes.sortOrder));
      res.json(rows);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.get("/api/admin/events/:eventId/mentions", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { allowed } = await verifyEventCityAccess(req, req.params.eventId);
      if (!allowed) return res.status(403).json({ message: "Access denied" });
      const rows = await db.select().from(eventArticleMentions)
        .where(eq(eventArticleMentions.eventId, req.params.eventId))
        .orderBy(desc(eventArticleMentions.createdAt));
      res.json(rows);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.post("/api/admin/events/:eventId/mentions", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { allowed } = await verifyEventCityAccess(req, req.params.eventId);
      if (!allowed) return res.status(403).json({ message: "Access denied" });
      const userId = (req.session as Record<string, string>).userId;
      const parsed = insertEventArticleMentionSchema.safeParse({
        ...req.body,
        eventId: req.params.eventId,
        addedByUserId: userId,
      });
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
      const [row] = await db.insert(eventArticleMentions).values(parsed.data).returning();
      res.status(201).json(row);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.delete("/api/admin/mentions/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const [existing] = await db.select({ eventId: eventArticleMentions.eventId }).from(eventArticleMentions).where(eq(eventArticleMentions.id, req.params.id));
      if (!existing) return res.status(404).json({ message: "Not found" });
      const { allowed } = await verifyEventCityAccess(req, existing.eventId);
      if (!allowed) return res.status(403).json({ message: "Access denied" });
      await db.delete(eventArticleMentions).where(eq(eventArticleMentions.id, req.params.id));
      res.json({ success: true });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.get("/api/events/:eventId/mentions", async (req: Request, res: Response) => {
    try {
      const rows = await db.select().from(eventArticleMentions)
        .where(eq(eventArticleMentions.eventId, req.params.eventId))
        .orderBy(desc(eventArticleMentions.publishedAt));
      res.json(rows);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.get("/api/admin/event-rss-suppressions", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { cityId, forbidden } = await getAuthorizedCityId(req, req.query.cityId as string);
      if (forbidden) return res.status(403).json({ message: "Access denied" });
      let rows;
      if (cityId) {
        rows = await db.select().from(eventRssSuppressions)
          .where(eq(eventRssSuppressions.cityId, cityId))
          .orderBy(desc(eventRssSuppressions.createdAt));
      } else {
        rows = await db.select().from(eventRssSuppressions)
          .orderBy(desc(eventRssSuppressions.createdAt));
      }
      res.json(rows);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.post("/api/admin/event-rss-suppressions", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { cityId, forbidden } = await getAuthorizedCityId(req, req.query.cityId as string);
      if (forbidden) return res.status(403).json({ message: "Access denied" });
      const userId = (req.session as Record<string, string>).userId;
      const parsed = insertEventRssSuppressionSchema.safeParse({
        ...req.body,
        suppressedByUserId: userId,
        cityId: cityId || req.body.cityId,
      });
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
      const [row] = await db.insert(eventRssSuppressions).values(parsed.data).returning();
      res.status(201).json(row);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.delete("/api/admin/event-rss-suppressions/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { cityId, forbidden } = await getAuthorizedCityId(req, req.query.cityId as string);
      if (forbidden) return res.status(403).json({ message: "Access denied" });
      if (cityId) {
        const [existing] = await db.select({ cityId: eventRssSuppressions.cityId }).from(eventRssSuppressions).where(eq(eventRssSuppressions.id, req.params.id));
        if (existing && existing.cityId && existing.cityId !== cityId) return res.status(403).json({ message: "Access denied" });
      }
      await db.delete(eventRssSuppressions).where(eq(eventRssSuppressions.id, req.params.id));
      res.json({ success: true });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.get("/api/admin/events/command-center/overview", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { cityId, forbidden } = await getAuthorizedCityId(req, req.query.cityId as string);
      if (forbidden) return res.status(403).json({ message: "Access denied" });

      const cityFilter = cityId ? `AND e.city_id = $1` : "";
      const params = cityId ? [cityId] : [];

      const [
        upcomingResult,
        unclaimedResult,
        draftResult,
        rsvpWeekResult,
        capacityResult,
        missingImageResult,
        noTicketResult,
        statusBreakdownResult,
      ] = await Promise.all([
        pool.query(`SELECT COUNT(*) AS cnt FROM events e WHERE e.start_date_time > NOW() ${cityFilter}`, params),
        pool.query(`SELECT COUNT(*) AS cnt FROM events e WHERE e.event_claim_status = 'UNCLAIMED' AND e.start_date_time > NOW() ${cityFilter}`, params),
        pool.query(`SELECT COUNT(*) AS cnt FROM events e WHERE e.lifecycle_status = 'draft' ${cityFilter}`, params),
        pool.query(`SELECT COUNT(*) AS cnt FROM event_rsvps r JOIN events e ON e.id = r.event_id WHERE r.created_at > NOW() - INTERVAL '7 days' ${cityFilter}`, params),
        pool.query(`SELECT COUNT(*) AS cnt FROM events e WHERE e.max_capacity IS NOT NULL AND e.start_date_time > NOW() AND (SELECT COUNT(*) FROM event_rsvps WHERE event_id = e.id AND response = 'attending') >= e.max_capacity * 0.9 ${cityFilter}`, params),
        pool.query(`SELECT COUNT(*) AS cnt FROM events e WHERE (e.image_url IS NULL OR e.image_url = '') AND e.start_date_time > NOW() ${cityFilter}`, params),
        pool.query(`SELECT COUNT(*) AS cnt FROM events e WHERE e.cost_text IS NULL AND e.start_date_time > NOW() ${cityFilter}`, params),
        pool.query(`SELECT lifecycle_status, COUNT(*) AS cnt FROM events e WHERE 1=1 ${cityFilter} GROUP BY lifecycle_status`, params),
      ]);

      const statusBreakdown: Record<string, number> = {};
      for (const row of statusBreakdownResult.rows) {
        statusBreakdown[row.lifecycle_status] = parseInt(row.cnt);
      }

      res.json({
        kpis: {
          upcomingCount: parseInt(upcomingResult.rows[0].cnt),
          unclaimedCount: parseInt(unclaimedResult.rows[0].cnt),
          draftCount: parseInt(draftResult.rows[0].cnt),
          rsvpsThisWeek: parseInt(rsvpWeekResult.rows[0].cnt),
          capacityAlerts: parseInt(capacityResult.rows[0].cnt),
        },
        actionItems: {
          missingImages: parseInt(missingImageResult.rows[0].cnt),
          noTicketInfo: parseInt(noTicketResult.rows[0].cnt),
        },
        statusBreakdown,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.patch("/api/admin/events/:id/lifecycle", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { allowed } = await verifyEventCityAccess(req, req.params.id);
      if (!allowed) return res.status(403).json({ message: "Access denied" });
      const { status } = req.body;
      const validStatuses = ["draft", "under_review", "published", "live", "completed", "canceled", "archived"];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ message: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
      }
      const result = await pool.query(
        `UPDATE events SET lifecycle_status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [status, req.params.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ message: "Event not found" });
      res.json(result.rows[0]);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.post("/api/admin/events/bulk-action", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { cityId, forbidden } = await getAuthorizedCityId(req, req.query.cityId as string);
      if (forbidden) return res.status(403).json({ message: "Access denied" });
      const { eventIds, action, value } = req.body;
      if (!Array.isArray(eventIds) || eventIds.length === 0) {
        return res.status(400).json({ message: "eventIds array required" });
      }

      if (cityId) {
        const check = await pool.query(
          `SELECT id FROM events WHERE id = ANY($1::uuid[]) AND city_id != $2`,
          [eventIds, cityId]
        );
        if (check.rows.length > 0) return res.status(403).json({ message: "Access denied: events outside your city scope" });
      }

      const queryParams = [...eventIds];
      const placeholders = eventIds.map((_: string, i: number) => `$${i + 1}`).join(",");
      let query = "";

      switch (action) {
        case "publish":
          query = `UPDATE events SET lifecycle_status = 'published', updated_at = NOW() WHERE id IN (${placeholders})`;
          break;
        case "archive":
          query = `UPDATE events SET lifecycle_status = 'archived', updated_at = NOW() WHERE id IN (${placeholders})`;
          break;
        case "assign_category":
          if (!value) return res.status(400).json({ message: "Category value required" });
          query = `UPDATE events SET category_ids = ARRAY[$${eventIds.length + 1}]::text[], updated_at = NOW() WHERE id IN (${placeholders})`;
          queryParams.push(value);
          break;
        default:
          return res.status(400).json({ message: "Invalid action" });
      }

      await pool.query(query, queryParams);
      res.json({ success: true, affected: eventIds.length });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.post("/api/events/:id/track-click", async (req: Request, res: Response) => {
    try {
      await pool.query(
        `UPDATE events SET outbound_ticket_clicks = outbound_ticket_clicks + 1 WHERE id = $1`,
        [req.params.id]
      );
      res.json({ success: true });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.get("/api/admin/events/rss-sourced", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { cityId, forbidden } = await getAuthorizedCityId(req, req.query.cityId as string);
      if (forbidden) return res.status(403).json({ message: "Access denied" });
      const cityFilter = cityId ? `AND e.city_id = $1` : "";
      const params = cityId ? [cityId] : [];
      const result = await pool.query(`
        SELECT e.*, e.seed_source_type, e.source_url, e.capture_source
        FROM events e
        WHERE (e.seed_source_type = 'rss_item' OR e.capture_source = 'rss')
        ${cityFilter}
        ORDER BY e.created_at DESC
        LIMIT 200
      `, params);
      res.json(result.rows);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.post("/api/owner/events", requireOwner, async (req: Request, res: Response) => {
    try {
      const ownerEntityId = (req.session as Record<string, string>).ownerEntityId;
      if (!ownerEntityId) {
        return res.status(403).json({ message: "No entity linked" });
      }

      const bizResult = await pool.query(
        `SELECT id, listing_tier, city_id, name FROM businesses WHERE id = $1`,
        [ownerEntityId]
      );
      if (bizResult.rows.length === 0) {
        return res.status(404).json({ message: "Business not found" });
      }
      const biz = bizResult.rows[0];

      const enhancedTiers = ["ENHANCED", "ENTERPRISE", "CHARTER", "PREMIUM"];
      if (!enhancedTiers.includes(biz.listing_tier)) {
        return res.status(403).json({ message: "Enhanced tier or above required to create events" });
      }

      const capResult = await pool.query(
        `SELECT id FROM capability_entitlements WHERE presence_id = $1 AND capability_type = 'EVENTS' AND status = 'ACTIVE'`,
        [ownerEntityId]
      );
      if (capResult.rows.length === 0) {
        return res.status(403).json({ message: "Events module must be active" });
      }

      const { title, description, startDateTime, endDateTime, locationName, address,
        costText, imageUrl, visibility, rsvpEnabled, maxCapacity, categoryIds,
        latitude, longitude, recurrenceType, recurrenceRuleJson, ticketTypes } = req.body;

      if (!title) return res.status(400).json({ message: "Title is required" });
      if (!startDateTime) return res.status(400).json({ message: "Start date/time is required" });

      const zoneResult = await pool.query(
        `SELECT id FROM zones WHERE city_id = $1 LIMIT 1`, [biz.city_id]
      );
      const zoneId = zoneResult.rows[0]?.id || biz.city_id;

      const { generateEventSlug } = await import("./lib/slug-utils");
      const slug = await generateEventSlug(title, biz.city_id, {
        startDate: startDateTime, venueName: locationName || null, zoneName: null,
      });

      let eventSeriesId = null;
      if (recurrenceType && recurrenceType !== "none") {
        const seriesSlug = slug + "-series";
        const seriesResult = await pool.query(`
          INSERT INTO event_series (title, slug, description, host_presence_id, city_id, zone_id,
            recurrence_type, recurrence_rule_json, default_location_name, default_address,
            default_cost_text, status, created_by_user_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active', $12)
          RETURNING id
        `, [title, seriesSlug, description || null, ownerEntityId, biz.city_id, zoneId,
            recurrenceType, recurrenceRuleJson || null, locationName || null,
            address || null, costText || null,
            (req.session as Record<string, string>).ownerAccountId || null]);
        eventSeriesId = seriesResult.rows[0]?.id;
      }

      const eventResult = await pool.query(`
        INSERT INTO events (title, slug, description, start_date_time, end_date_time,
          location_name, address, cost_text, image_url, visibility,
          rsvp_enabled, max_capacity, category_ids, latitude, longitude,
          city_id, zone_id, host_business_id, event_series_id,
          lifecycle_status, event_claim_status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
          $13::text[], $14, $15, $16, $17, $18, $19, 'draft', 'CLAIMED')
        RETURNING *
      `, [title, slug, description || null,
          new Date(startDateTime).toISOString(), endDateTime ? new Date(endDateTime).toISOString() : null,
          locationName || null, address || null, costText || null, imageUrl || null,
          visibility || "public", rsvpEnabled || false, maxCapacity || null,
          categoryIds || [], latitude || null, longitude || null,
          biz.city_id, zoneId, ownerEntityId, eventSeriesId]);

      const evt = eventResult.rows[0];

      if (Array.isArray(ticketTypes) && ticketTypes.length > 0) {
        for (let i = 0; i < ticketTypes.length; i++) {
          const tt = ticketTypes[i];
          await pool.query(`
            INSERT INTO event_ticket_types (event_id, name, description, price_display,
              quantity, sale_start_at, sale_end_at, external_checkout_url, sort_order)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [evt.id, tt.name, tt.description || null, tt.priceDisplay || null,
              tt.quantity || null, tt.saleStartAt || null, tt.saleEndAt || null,
              tt.externalCheckoutUrl || null, i]);
        }
      }

      res.status(201).json(evt);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.patch("/api/owner/events/:id", requireOwner, async (req: Request, res: Response) => {
    try {
      const ownerEntityId = (req.session as Record<string, string>).ownerEntityId;
      const evtCheck = await pool.query(
        `SELECT id FROM events WHERE id = $1 AND host_business_id = $2`,
        [req.params.id, ownerEntityId]
      );
      if (evtCheck.rows.length === 0) {
        return res.status(403).json({ message: "Not your event" });
      }

      const allowedFields = [
        "title", "description", "start_date_time", "end_date_time", "location_name",
        "address", "cost_text", "image_url", "visibility", "rsvp_enabled",
        "max_capacity", "category_ids", "latitude", "longitude",
      ];

      const updates: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      for (const [key, val] of Object.entries(req.body)) {
        const snakeKey = key.replace(/[A-Z]/g, m => `_${m.toLowerCase()}`);
        if (allowedFields.includes(snakeKey)) {
          updates.push(`${snakeKey} = $${idx}`);
          values.push(val);
          idx++;
        }
      }

      if (updates.length === 0) return res.status(400).json({ message: "No valid fields to update" });

      updates.push(`updated_at = NOW()`);
      values.push(req.params.id);

      const result = await pool.query(
        `UPDATE events SET ${updates.join(", ")} WHERE id = $${idx} RETURNING *`,
        values
      );

      res.json(result.rows[0]);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.get("/api/owner/events/:eventId/ticket-types", requireOwner, async (req: Request, res: Response) => {
    try {
      const ownerEntityId = (req.session as Record<string, string>).ownerEntityId;
      const evtCheck = await pool.query(
        `SELECT id FROM events WHERE id = $1 AND host_business_id = $2`,
        [req.params.eventId, ownerEntityId]
      );
      if (evtCheck.rows.length === 0) {
        return res.status(403).json({ message: "Not your event" });
      }
      const rows = await db.select().from(eventTicketTypes)
        .where(eq(eventTicketTypes.eventId, req.params.eventId))
        .orderBy(asc(eventTicketTypes.sortOrder));
      res.json(rows);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.post("/api/owner/events/:eventId/ticket-types", requireOwner, async (req: Request, res: Response) => {
    try {
      const ownerEntityId = (req.session as Record<string, string>).ownerEntityId;
      const evtCheck = await pool.query(
        `SELECT id FROM events WHERE id = $1 AND host_business_id = $2`,
        [req.params.eventId, ownerEntityId]
      );
      if (evtCheck.rows.length === 0) {
        return res.status(403).json({ message: "Not your event" });
      }
      const parsed = insertEventTicketTypeSchema.safeParse({ ...req.body, eventId: req.params.eventId });
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
      const [row] = await db.insert(eventTicketTypes).values(parsed.data).returning();
      res.status(201).json(row);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.get("/api/businesses/:businessId/events", async (req: Request, res: Response) => {
    try {
      const result = await pool.query(`
        SELECT e.id, e.title, e.slug, e.start_date_time, e.end_date_time,
          e.location_name, e.cost_text, e.image_url, e.lifecycle_status
        FROM events e
        WHERE (e.host_business_id = $1 OR e.venue_presence_id = $1)
          AND e.lifecycle_status IN ('published', 'live')
          AND e.visibility = 'public'
        ORDER BY e.start_date_time ASC
        LIMIT 20
      `, [req.params.businessId]);
      res.json(result.rows);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.get("/api/admin/event-series/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const result = await pool.query(
        `SELECT es.*, c.name AS city_name, c.slug AS city_slug
         FROM event_series es
         LEFT JOIN cities c ON c.id = es.city_id
         WHERE es.id = $1`,
        [req.params.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ message: "Series not found" });
      res.json(result.rows[0]);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.patch("/api/admin/event-series/:id/archive", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { cityId, forbidden } = await getAuthorizedCityId(req, req.query.cityId as string);
      if (forbidden) return res.status(403).json({ message: "Access denied" });
      if (cityId) {
        const check = await pool.query(`SELECT city_id FROM event_series WHERE id = $1`, [req.params.id]);
        if (check.rows.length > 0 && check.rows[0].city_id && check.rows[0].city_id !== cityId) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      const result = await pool.query(
        `UPDATE event_series SET status = 'archived', archived_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
        [req.params.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ message: "Series not found" });
      res.json(result.rows[0]);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.patch("/api/admin/event-series/:id/unarchive", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { cityId, forbidden } = await getAuthorizedCityId(req, req.query.cityId as string);
      if (forbidden) return res.status(403).json({ message: "Access denied" });
      if (cityId) {
        const check = await pool.query(`SELECT city_id FROM event_series WHERE id = $1`, [req.params.id]);
        if (check.rows.length > 0 && check.rows[0].city_id && check.rows[0].city_id !== cityId) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      const result = await pool.query(
        `UPDATE event_series SET status = 'active', archived_at = NULL, updated_at = NOW() WHERE id = $1 RETURNING *`,
        [req.params.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ message: "Series not found" });
      res.json(result.rows[0]);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.get("/api/admin/events/calendar", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { cityId, forbidden } = await getAuthorizedCityId(req, req.query.cityId as string);
      if (forbidden) return res.status(403).json({ message: "Access denied" });

      const start = req.query.start as string || new Date().toISOString();
      const end = req.query.end as string || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const params: string[] = [start, end];
      let cityWhere = "";
      if (cityId) {
        params.push(cityId);
        cityWhere = `AND e.city_id = $${params.length}`;
      }

      const result = await pool.query(`
        SELECT e.id, e.title, e.slug, e.start_date_time, e.end_date_time,
          e.location_name, e.zone_id, e.lifecycle_status, e.image_url,
          e.host_business_id, e.event_claim_status, e.visibility
        FROM events e
        WHERE e.start_date_time >= $1 AND e.start_date_time <= $2
        ${cityWhere}
        ORDER BY e.start_date_time ASC
      `, params);

      res.json(result.rows);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.post("/api/events/:eventId/checkout", async (req: Request, res: Response) => {
    try {
      const { eventId } = req.params;
      const { items, buyerName, buyerEmail, buyerPhone, customFieldResponses, citySlug } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "items array is required" });
      }
      if (!buyerName || !buyerEmail) {
        return res.status(400).json({ message: "buyerName and buyerEmail are required" });
      }

      const eventResult = await pool.query(
        `SELECT e.id, e.title, e.slug, e.city_id, e.host_business_id, c.slug AS city_slug
         FROM events e JOIN cities c ON c.id = e.city_id WHERE e.id = $1`,
        [eventId]
      );
      if (eventResult.rows.length === 0) {
        return res.status(404).json({ message: "Event not found" });
      }
      const evt = eventResult.rows[0];
      const resolvedCitySlug = citySlug || evt.city_slug;

      const ticketTypeIds = items.map((i: { ticketTypeId: string }) => i.ticketTypeId);
      const ttResult = await pool.query(
        `SELECT id, name, price_cents, quantity, quantity_sold, sale_start_at, sale_end_at, is_active
         FROM event_ticket_types WHERE id = ANY($1::varchar[]) AND event_id = $2`,
        [ticketTypeIds, eventId]
      );

      const ttMap = new Map(ttResult.rows.map((r: any) => [r.id, r]));
      const lineItems: Array<{ price_data: { currency: string; product_data: { name: string }; unit_amount: number }; quantity: number }> = [];
      let totalAmount = 0;
      const validatedItems: Array<{ ticketTypeId: string; quantity: number; unitPrice: number; name: string }> = [];

      for (const item of items) {
        const tt = ttMap.get(item.ticketTypeId) as any;
        if (!tt) return res.status(400).json({ message: `Ticket type ${item.ticketTypeId} not found` });
        if (!tt.is_active) return res.status(400).json({ message: `Ticket type "${tt.name}" is not available` });
        if (!tt.price_cents || tt.price_cents <= 0) {
          return res.status(400).json({ message: `Ticket type "${tt.name}" has no price set for native checkout` });
        }

        const now = new Date();
        if (tt.sale_start_at && new Date(tt.sale_start_at) > now) {
          return res.status(400).json({ message: `Sales for "${tt.name}" have not started yet` });
        }
        if (tt.sale_end_at && new Date(tt.sale_end_at) < now) {
          return res.status(400).json({ message: `Sales for "${tt.name}" have ended` });
        }

        const remaining = tt.quantity ? tt.quantity - (tt.quantity_sold || 0) : null;
        if (remaining !== null && item.quantity > remaining) {
          return res.status(400).json({ message: `Only ${remaining} tickets left for "${tt.name}"` });
        }

        const itemTotal = tt.price_cents * item.quantity;
        totalAmount += itemTotal;
        lineItems.push({
          price_data: {
            currency: "usd",
            product_data: { name: `${evt.title} - ${tt.name}` },
            unit_amount: tt.price_cents,
          },
          quantity: item.quantity,
        });
        validatedItems.push({
          ticketTypeId: item.ticketTypeId,
          quantity: item.quantity,
          unitPrice: tt.price_cents,
          name: tt.name,
        });
      }

      const stripe = getStripe();
      const appUrl = process.env.APP_PUBLIC_URL || `https://${req.get("host")}`;

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: lineItems,
        success_url: `${appUrl}/${resolvedCitySlug}/events/${evt.slug}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/${resolvedCitySlug}/events/${evt.slug}`,
        customer_email: buyerEmail,
        metadata: {
          type: "EVENT_TICKET",
          event_id: eventId,
          city_slug: resolvedCitySlug,
          buyer_name: buyerName,
          buyer_email: buyerEmail,
          buyer_phone: buyerPhone || "",
          items_json: JSON.stringify(validatedItems),
          custom_field_responses: customFieldResponses ? JSON.stringify(customFieldResponses) : "",
          host_business_id: evt.host_business_id || "",
        },
      });

      res.json({ url: session.url, sessionId: session.id });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      console.error("[EVENT_CHECKOUT]", message);
      res.status(500).json({ message });
    }
  });

  app.post("/api/events/:eventId/rsvp-free", async (req: Request, res: Response) => {
    try {
      const { eventId } = req.params;
      const { buyerName, buyerEmail, buyerPhone, ticketTypeId, customFieldResponses } = req.body;

      if (!buyerName || !buyerEmail) {
        return res.status(400).json({ message: "Name and email are required" });
      }

      const eventResult = await pool.query(
        `SELECT id, title, max_capacity FROM events WHERE id = $1`, [eventId]
      );
      if (eventResult.rows.length === 0) return res.status(404).json({ message: "Event not found" });

      let resolvedTicketTypeId = ticketTypeId;
      if (resolvedTicketTypeId) {
        const ttCheck = await pool.query(
          `SELECT id, quantity, quantity_sold, price_cents FROM event_ticket_types WHERE id = $1 AND event_id = $2 AND is_active = true`,
          [resolvedTicketTypeId, eventId]
        );
        if (ttCheck.rows.length === 0) return res.status(400).json({ message: "Ticket type not found" });
        const tt = ttCheck.rows[0];
        if (tt.price_cents && tt.price_cents > 0) {
          return res.status(400).json({ message: "This ticket type requires payment. Use the checkout flow instead." });
        }
        if (tt.quantity && tt.quantity_sold >= tt.quantity) {
          return res.status(400).json({ message: "This ticket type is sold out" });
        }
      } else {
        const autoTT = await pool.query(
          `SELECT id FROM event_ticket_types WHERE event_id = $1 AND is_active = true AND (price_cents IS NULL OR price_cents = 0) ORDER BY sort_order ASC, created_at ASC LIMIT 1`,
          [eventId]
        );
        if (autoTT.rows.length > 0) {
          resolvedTicketTypeId = autoTT.rows[0].id;
        }
      }

      const evtRow = eventResult.rows[0];
      if (evtRow.max_capacity) {
        const countResult = await pool.query(
          `SELECT COUNT(*) AS cnt FROM ticket_purchases WHERE event_id = $1`, [eventId]
        );
        if (parseInt(countResult.rows[0].cnt) >= evtRow.max_capacity) {
          return res.status(400).json({ message: "This event is at capacity" });
        }
      }

      const existing = await pool.query(
        `SELECT id FROM ticket_purchases WHERE event_id = $1 AND buyer_email = $2`,
        [eventId, buyerEmail]
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({ message: "You already have a ticket for this event" });
      }

      const result = await pool.query(
        `INSERT INTO ticket_purchases (event_id, ticket_type_id, buyer_name, buyer_email, buyer_phone,
          quantity, unit_price, total_paid, custom_field_responses)
         VALUES ($1, $2, $3, $4, $5, 1, 0, 0, $6) RETURNING *`,
        [eventId, resolvedTicketTypeId || null, buyerName, buyerEmail, buyerPhone || null,
         customFieldResponses ? JSON.stringify(customFieldResponses) : null]
      );

      if (resolvedTicketTypeId) {
        await pool.query(
          `UPDATE event_ticket_types SET quantity_sold = quantity_sold + 1 WHERE id = $1`,
          [resolvedTicketTypeId]
        );
      }

      res.status(201).json(result.rows[0]);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.get("/api/events/:eventId/my-tickets", async (req: Request, res: Response) => {
    try {
      const email = req.query.email as string;
      if (!email) return res.status(400).json({ message: "email query param required" });

      const result = await pool.query(
        `SELECT tp.*, tt.name AS ticket_type_name
         FROM ticket_purchases tp
         LEFT JOIN event_ticket_types tt ON tt.id = tp.ticket_type_id
         WHERE tp.event_id = $1 AND tp.buyer_email = $2
         ORDER BY tp.created_at ASC`,
        [req.params.eventId, email]
      );
      res.json(result.rows);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.get("/api/events/:eventId/confirmation", async (req: Request, res: Response) => {
    try {
      const sessionId = req.query.session_id as string;
      if (!sessionId) return res.status(400).json({ message: "session_id required" });

      const result = await pool.query(
        `SELECT tp.id, tp.buyer_name, tp.total_paid, tp.qr_token, tp.quantity, tt.name AS ticket_type_name
         FROM ticket_purchases tp
         LEFT JOIN event_ticket_types tt ON tt.id = tp.ticket_type_id
         WHERE tp.stripe_session_id = $1 AND tp.event_id = $2
         ORDER BY tp.created_at ASC`,
        [sessionId, req.params.eventId]
      );
      res.json(result.rows);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  async function requireCheckinAuth(req: Request, res: Response, next: NextFunction) {
    if (await isAdminSession(req)) return next();
    const ownerAccountId = (req.session as Record<string, unknown>).ownerAccountId as string;
    if (ownerAccountId) {
      const { eventId } = req.params;
      const evtResult = await pool.query(
        `SELECT e.host_business_id FROM events e
         JOIN businesses b ON b.id = e.host_business_id
         WHERE e.id = $1 AND b.owner_account_id = $2`,
        [eventId, ownerAccountId]
      );
      if (evtResult.rows.length > 0) return next();
    }
    return res.status(403).json({ message: "Only event organizers and admins can check in attendees" });
  }

  app.post("/api/events/:eventId/checkin/:token", requireCheckinAuth, async (req: Request, res: Response) => {
    try {
      const { eventId, token } = req.params;
      const result = await pool.query(
        `SELECT tp.*, tt.name AS ticket_type_name, e.title AS event_title, e.host_business_id
         FROM ticket_purchases tp
         LEFT JOIN event_ticket_types tt ON tt.id = tp.ticket_type_id
         LEFT JOIN events e ON e.id = tp.event_id
         WHERE tp.qr_token = $1 AND tp.event_id = $2`,
        [token, eventId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Invalid ticket", valid: false });
      }

      const ticket = result.rows[0];

      if (ticket.checkin_status === "checked_in") {
        return res.status(400).json({
          message: "Already checked in",
          valid: false,
          alreadyCheckedIn: true,
          checkinAt: ticket.checkin_at,
          buyerName: ticket.buyer_name,
          ticketTypeName: ticket.ticket_type_name,
        });
      }

      await pool.query(
        `UPDATE ticket_purchases SET checkin_status = 'checked_in', checkin_at = NOW() WHERE id = $1`,
        [ticket.id]
      );

      res.json({
        valid: true,
        buyerName: ticket.buyer_name,
        buyerEmail: ticket.buyer_email,
        ticketTypeName: ticket.ticket_type_name,
        eventTitle: ticket.event_title,
        quantity: ticket.quantity,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.get("/api/events/:eventId/checkin-validate/:token", async (req: Request, res: Response) => {
    try {
      const { eventId, token } = req.params;
      const result = await pool.query(
        `SELECT tp.*, tt.name AS ticket_type_name, e.title AS event_title
         FROM ticket_purchases tp
         LEFT JOIN event_ticket_types tt ON tt.id = tp.ticket_type_id
         LEFT JOIN events e ON e.id = tp.event_id
         WHERE tp.qr_token = $1 AND tp.event_id = $2`,
        [token, eventId]
      );
      if (result.rows.length === 0) {
        return res.json({ valid: false, message: "Invalid ticket" });
      }
      const ticket = result.rows[0];
      res.json({
        valid: true,
        alreadyCheckedIn: ticket.checkin_status === "checked_in",
        checkinAt: ticket.checkin_at,
        buyerName: ticket.buyer_name,
        ticketTypeName: ticket.ticket_type_name,
        eventTitle: ticket.event_title,
        quantity: ticket.quantity,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.post("/api/events/:eventId/waitlist", async (req: Request, res: Response) => {
    try {
      const { eventId } = req.params;
      const { name, email, phone } = req.body;
      if (!name || !email) return res.status(400).json({ message: "Name and email are required" });

      const existing = await pool.query(
        `SELECT id FROM event_waitlist WHERE event_id = $1 AND email = $2 AND converted_at IS NULL AND expired_at IS NULL`,
        [eventId, email]
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({ message: "You are already on the waitlist" });
      }

      const result = await pool.query(
        `INSERT INTO event_waitlist (event_id, name, email, phone) VALUES ($1, $2, $3, $4) RETURNING *`,
        [eventId, name, email, phone || null]
      );
      res.status(201).json(result.rows[0]);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.get("/api/events/:eventId/waitlist/status", async (req: Request, res: Response) => {
    try {
      const email = req.query.email as string;
      if (!email) return res.json({ onWaitlist: false });
      const result = await pool.query(
        `SELECT id, created_at FROM event_waitlist WHERE event_id = $1 AND email = $2 AND converted_at IS NULL AND expired_at IS NULL`,
        [req.params.eventId, email]
      );
      res.json({ onWaitlist: result.rows.length > 0, entry: result.rows[0] || null });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.get("/api/events/:eventId/ics", async (req: Request, res: Response) => {
    try {
      const eventResult = await pool.query(
        `SELECT e.title, e.description, e.start_date_time, e.end_date_time,
                e.location_name, e.address, e.city, e.state, e.zip, e.slug,
                c.slug AS city_slug
         FROM events e JOIN cities c ON c.id = e.city_id
         WHERE e.id = $1`,
        [req.params.eventId]
      );
      if (eventResult.rows.length === 0) return res.status(404).json({ message: "Event not found" });
      const evt = eventResult.rows[0];

      const formatIcsDate = (d: string) => {
        const date = new Date(d);
        return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
      };

      const startDt = formatIcsDate(evt.start_date_time);
      const endDt = evt.end_date_time
        ? formatIcsDate(evt.end_date_time)
        : formatIcsDate(new Date(new Date(evt.start_date_time).getTime() + 2 * 60 * 60 * 1000).toISOString());

      const location = [evt.location_name, evt.address, evt.city, evt.state, evt.zip].filter(Boolean).join(", ");
      const description = (evt.description || "").replace(/\n/g, "\\n").substring(0, 500);

      const ics = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//LocalPulse//Events//EN",
        "BEGIN:VEVENT",
        `DTSTART:${startDt}`,
        `DTEND:${endDt}`,
        `SUMMARY:${evt.title}`,
        `DESCRIPTION:${description}`,
        `LOCATION:${location}`,
        `UID:${req.params.eventId}@localpulse`,
        "END:VEVENT",
        "END:VCALENDAR",
      ].join("\r\n");

      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${evt.slug}.ics"`);
      res.send(ics);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.get("/api/admin/events/:eventId/attendees", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { allowed } = await verifyEventCityAccess(req, req.params.eventId);
      if (!allowed) return res.status(403).json({ message: "Access denied" });

      const result = await pool.query(
        `SELECT tp.*, tt.name AS ticket_type_name
         FROM ticket_purchases tp
         LEFT JOIN event_ticket_types tt ON tt.id = tp.ticket_type_id
         WHERE tp.event_id = $1
         ORDER BY tp.created_at ASC`,
        [req.params.eventId]
      );
      res.json(result.rows);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.post("/api/admin/events/:eventId/attendees/:purchaseId/checkin", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { allowed } = await verifyEventCityAccess(req, req.params.eventId);
      if (!allowed) return res.status(403).json({ message: "Access denied" });

      const result = await pool.query(
        `UPDATE ticket_purchases SET checkin_status = 'checked_in', checkin_at = NOW()
         WHERE id = $1 AND event_id = $2 RETURNING *`,
        [req.params.purchaseId, req.params.eventId]
      );
      if (result.rows.length === 0) return res.status(404).json({ message: "Purchase not found" });
      res.json(result.rows[0]);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.post("/api/admin/events/:eventId/attendees/:purchaseId/refund", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { allowed } = await verifyEventCityAccess(req, req.params.eventId);
      if (!allowed) return res.status(403).json({ message: "Access denied" });

      const purchase = await pool.query(
        `SELECT * FROM ticket_purchases WHERE id = $1 AND event_id = $2`,
        [req.params.purchaseId, req.params.eventId]
      );
      if (purchase.rows.length === 0) return res.status(404).json({ message: "Purchase not found" });

      const p = purchase.rows[0];
      if (p.total_paid > 0 && p.stripe_payment_intent_id) {
        try {
          const stripe = getStripe();
          await stripe.refunds.create({ payment_intent: p.stripe_payment_intent_id });
        } catch (stripeErr: any) {
          if (stripeErr?.code !== "charge_already_refunded") {
            return res.status(400).json({ message: `Stripe refund failed: ${stripeErr?.message || "Unknown error"}` });
          }
        }
      }

      await pool.query(
        `DELETE FROM ticket_purchases WHERE id = $1`,
        [req.params.purchaseId]
      );

      if (p.ticket_type_id) {
        await pool.query(
          `UPDATE event_ticket_types SET quantity_sold = GREATEST(0, quantity_sold - $1) WHERE id = $2`,
          [p.quantity, p.ticket_type_id]
        );
      }

      autoAdvanceWaitlist(req.params.eventId, p.quantity).catch(() => {});

      res.json({ message: "Refund processed and ticket removed" });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.get("/api/admin/events/:eventId/attendees/csv", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { allowed } = await verifyEventCityAccess(req, req.params.eventId);
      if (!allowed) return res.status(403).json({ message: "Access denied" });

      const result = await pool.query(
        `SELECT tp.buyer_name, tp.buyer_email, tp.buyer_phone, tp.quantity, tp.unit_price,
                tp.total_paid, tp.checkin_status, tp.checkin_at, tp.created_at,
                tt.name AS ticket_type_name, tp.custom_field_responses
         FROM ticket_purchases tp
         LEFT JOIN event_ticket_types tt ON tt.id = tp.ticket_type_id
         WHERE tp.event_id = $1
         ORDER BY tp.created_at ASC`,
        [req.params.eventId]
      );

      const headers = ["Name", "Email", "Phone", "Ticket Type", "Qty", "Unit Price", "Total Paid", "Check-in Status", "Checked In At", "Purchased At", "Custom Fields"];
      const rows = result.rows.map((r: any) => [
        r.buyer_name,
        r.buyer_email,
        r.buyer_phone || "",
        r.ticket_type_name || "",
        r.quantity,
        (r.unit_price / 100).toFixed(2),
        (r.total_paid / 100).toFixed(2),
        r.checkin_status,
        r.checkin_at || "",
        r.created_at,
        r.custom_field_responses ? JSON.stringify(r.custom_field_responses) : "",
      ]);

      const csv = [headers.join(","), ...rows.map((r: any[]) => r.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="attendees-${req.params.eventId}.csv"`);
      res.send(csv);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.get("/api/admin/events/:eventId/waitlist", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { allowed } = await verifyEventCityAccess(req, req.params.eventId);
      if (!allowed) return res.status(403).json({ message: "Access denied" });

      const result = await pool.query(
        `SELECT * FROM event_waitlist WHERE event_id = $1 ORDER BY created_at ASC`,
        [req.params.eventId]
      );
      res.json(result.rows);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.post("/api/admin/events/:eventId/waitlist/:entryId/notify", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { allowed } = await verifyEventCityAccess(req, req.params.eventId);
      if (!allowed) return res.status(403).json({ message: "Access denied" });

      const entry = await pool.query(
        `SELECT * FROM event_waitlist WHERE id = $1 AND event_id = $2`,
        [req.params.entryId, req.params.eventId]
      );
      if (entry.rows.length === 0) return res.status(404).json({ message: "Waitlist entry not found" });

      await pool.query(
        `UPDATE event_waitlist SET notified_at = NOW() WHERE id = $1`,
        [req.params.entryId]
      );

      try {
        const { sendTemplatedEmail } = await import("./resend-client");
        const eventResult = await pool.query(
          `SELECT e.title, e.slug, c.slug AS city_slug
           FROM events e JOIN cities c ON c.id = e.city_id WHERE e.id = $1`,
          [req.params.eventId]
        );
        if (eventResult.rows.length > 0) {
          const evt = eventResult.rows[0];
          const appUrl = process.env.APP_PUBLIC_URL || "https://localpulse.city";
          const ticketUrl = `${appUrl}/${evt.city_slug}/events/${evt.slug}?waitlist=true`;
          await sendTemplatedEmail(
            entry.rows[0].email,
            `Tickets Available: ${evt.title}`,
            `<h2>Good news, ${entry.rows[0].name}!</h2>
             <p>Tickets are now available for <strong>${evt.title}</strong>.</p>
             <p>This offer expires in 24 hours. <a href="${ticketUrl}">Get your tickets now</a>.</p>`
          );
        }
      } catch (emailErr) {
        console.error("[WAITLIST] Email notification failed:", emailErr);
      }

      res.json({ success: true });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.post("/api/admin/events/:eventId/waitlist/expire-stale", requireAdmin, async (req: Request, res: Response) => {
    try {
      const result = await autoAdvanceWaitlist(req.params.eventId, 0);
      res.json(result);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.get("/api/owner/events/:eventId/earnings", requireOwner, async (req: Request, res: Response) => {
    try {
      const ownerEntityId = (req.session as Record<string, string>).ownerEntityId;
      const evtCheck = await pool.query(
        `SELECT id FROM events WHERE id = $1 AND host_business_id = $2`,
        [req.params.eventId, ownerEntityId]
      );
      if (evtCheck.rows.length === 0) return res.status(403).json({ message: "Not your event" });

      const result = await pool.query(
        `SELECT
           COUNT(*) AS total_purchases,
           COALESCE(SUM(quantity), 0) AS total_tickets,
           COALESCE(SUM(total_paid), 0) AS total_revenue,
           COUNT(CASE WHEN checkin_status = 'checked_in' THEN 1 END) AS checked_in_count
         FROM ticket_purchases WHERE event_id = $1`,
        [req.params.eventId]
      );

      const stats = result.rows[0];
      const grossRevenue = parseInt(stats.total_revenue) || 0;
      const platformShare = Math.round(grossRevenue * 0.40);
      const operatorShare = Math.round(grossRevenue * 0.30);
      const organizerShare = grossRevenue - platformShare - operatorShare;

      res.json({
        totalPurchases: parseInt(stats.total_purchases),
        totalTickets: parseInt(stats.total_tickets),
        grossRevenue,
        platformShare,
        operatorShare,
        organizerShare,
        checkedInCount: parseInt(stats.checked_in_count),
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.get("/api/owner/earnings-summary", requireOwner, async (req: Request, res: Response) => {
    try {
      const ownerEntityId = (req.session as Record<string, string>).ownerEntityId;
      if (!ownerEntityId) return res.status(403).json({ message: "No entity linked" });

      const result = await pool.query(
        `SELECT e.id, e.title, e.slug, e.start_date_time,
                COUNT(tp.id) AS purchase_count,
                COALESCE(SUM(tp.quantity), 0) AS ticket_count,
                COALESCE(SUM(tp.total_paid), 0) AS gross_revenue
         FROM events e
         LEFT JOIN ticket_purchases tp ON tp.event_id = e.id
         WHERE e.host_business_id = $1
         GROUP BY e.id
         ORDER BY e.start_date_time DESC`,
        [ownerEntityId]
      );

      const eventEarnings = result.rows.map((r: any) => {
        const gross = parseInt(r.gross_revenue) || 0;
        const platformShare = Math.round(gross * 0.40);
        const operatorShare = Math.round(gross * 0.30);
        const organizerShare = gross - platformShare - operatorShare;
        return {
          eventId: r.id,
          title: r.title,
          slug: r.slug,
          startDateTime: r.start_date_time,
          purchaseCount: parseInt(r.purchase_count),
          ticketCount: parseInt(r.ticket_count),
          grossRevenue: gross,
          platformShare,
          operatorShare,
          organizerShare,
        };
      });

      const totals = eventEarnings.reduce((acc: any, e: any) => ({
        grossRevenue: acc.grossRevenue + e.grossRevenue,
        organizerShare: acc.organizerShare + e.organizerShare,
        platformShare: acc.platformShare + e.platformShare,
        totalTickets: acc.totalTickets + e.ticketCount,
      }), { grossRevenue: 0, organizerShare: 0, platformShare: 0, totalTickets: 0 });

      res.json({ events: eventEarnings, totals });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message });
    }
  });

  app.get("/api/admin/events/:eventId/revenue", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { allowed } = await verifyEventCityAccess(req, req.params.eventId);
      if (!allowed) return res.status(403).json({ message: "Access denied" });

      const result = await pool.query(
        `SELECT
           COUNT(*) AS total_purchases,
           COALESCE(SUM(quantity), 0) AS total_tickets,
           COALESCE(SUM(total_paid), 0) AS total_revenue,
           COUNT(CASE WHEN checkin_status = 'checked_in' THEN 1 END) AS checked_in_count
         FROM ticket_purchases WHERE event_id = $1`,
        [req.params.eventId]
      );

      const stats = result.rows[0];
      const grossRevenue = parseInt(stats.total_revenue) || 0;
      const platformShare = Math.round(grossRevenue * 0.40);
      const operatorShare = Math.round(grossRevenue * 0.30);
      const organizerShare = grossRevenue - platformShare - operatorShare;

      res.json({
        totalPurchases: parseInt(stats.total_purchases),
        totalTickets: parseInt(stats.total_tickets),
        grossRevenue,
        platformShare,
        operatorShare,
        organizerShare,
        checkedInCount: parseInt(stats.checked_in_count),
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ message });
    }
  });
}
