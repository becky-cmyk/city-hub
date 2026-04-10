import type { Express, Request, Response, NextFunction } from "express";
import { db, pool } from "./db";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import {
  eventComments, insertEventCommentSchema,
  eventSyndications, insertEventSyndicationSchema,
  eventEmbedConfigs, insertEventEmbedConfigSchema,
  eventSurveys, insertEventSurveySchema,
  eventNominations, insertEventNominationSchema,
  eventNominationVotes, insertEventNominationVoteSchema,
  eventGiveaways, insertEventGiveawaySchema,
  eventGiveawayEntries, insertEventGiveawayEntrySchema,
  eventDripCampaigns, insertEventDripCampaignSchema,
  eventDripSteps, insertEventDripStepSchema,
  seenAroundTown, insertSeenAroundTownSchema,
  reviews, events,
} from "@shared/schema";
import { z } from "zod";

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

function getSessionUserId(req: Request): string | null {
  return (req.session as Record<string, unknown>).userId as string || null;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function getUserVerificationForEvent(userId: string, eventId: string): Promise<{ allowed: boolean; role: "attendee" | "sponsor" | "community_member" }> {
  const rsvpCheck = await pool.query(
    `SELECT id FROM event_rsvps WHERE event_id = $1 AND user_id = $2 AND response = 'attending'`,
    [eventId, userId]
  );
  if (rsvpCheck.rows.length > 0) return { allowed: true, role: "attendee" };

  const ticketCheck = await pool.query(
    `SELECT id FROM event_ticket_orders WHERE event_id = $1 AND user_id = $2 AND status = 'completed'`,
    [eventId, userId]
  );
  if (ticketCheck.rows.length > 0) return { allowed: true, role: "attendee" };

  const sponsorCheck = await pool.query(
    `SELECT id FROM event_sponsors WHERE event_id = $1 AND business_id IN (
      SELECT entity_id FROM owner_accounts WHERE id = (SELECT owner_account_id FROM users WHERE id = $2 LIMIT 1)
    )`,
    [eventId, userId]
  );
  if (sponsorCheck.rows.length > 0) return { allowed: true, role: "sponsor" };

  const verifiedCheck = await pool.query(
    `SELECT id FROM public_users WHERE id = $1 AND email_verified = true`,
    [userId]
  );
  if (verifiedCheck.rows.length > 0) return { allowed: true, role: "community_member" };

  return { allowed: false, role: "community_member" };
}

export function registerEventPhase3Routes(app: Express) {

  // ===== EVENT COMMENTS =====

  app.get("/api/events/:eventId/comments", async (req: Request, res: Response) => {
    try {
      const result = await pool.query(`
        SELECT ec.*, pu.display_name, pu.avatar_url
        FROM event_comments ec
        LEFT JOIN public_users pu ON pu.id = ec.user_id
        WHERE ec.event_id = $1 AND ec.status = 'visible'
        ORDER BY ec.created_at DESC
        LIMIT 100
      `, [req.params.eventId]);
      res.json(result.rows);
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Unknown error" });
    }
  });

  app.post("/api/events/:eventId/comments", async (req: Request, res: Response) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) return res.status(401).json({ message: "Login required" });

      let verification: { allowed: boolean; role: "attendee" | "sponsor" | "community_member" };
      try {
        verification = await getUserVerificationForEvent(userId, req.params.eventId);
      } catch {
        return res.status(500).json({ message: "Unable to verify user access" });
      }

      if (!verification.allowed) {
        return res.status(403).json({ message: "Only verified users can comment on events" });
      }

      const parsed = insertEventCommentSchema.safeParse({
        ...req.body,
        eventId: req.params.eventId,
        userId,
        roleBadge: verification.role,
      });
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });

      const [row] = await db.insert(eventComments).values(parsed.data).returning();
      res.status(201).json(row);
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Unknown error" });
    }
  });

  app.delete("/api/events/:eventId/comments/:commentId", async (req: Request, res: Response) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const [comment] = await db.select().from(eventComments)
        .where(and(eq(eventComments.id, req.params.commentId), eq(eventComments.eventId, req.params.eventId)));
      if (!comment) return res.status(404).json({ message: "Comment not found" });

      const isAdmin = await pool.query(`SELECT role FROM users WHERE id = $1`, [userId]);
      const adminRoles = ["PLATFORM_ADMIN", "SUPER_ADMIN", "super_admin", "admin", "ADMIN", "CITY_ADMIN"];
      const userIsAdmin = isAdmin.rows.length > 0 && adminRoles.includes(isAdmin.rows[0].role);

      if (comment.userId !== userId && !userIsAdmin) {
        return res.status(403).json({ message: "Cannot delete another user's comment" });
      }

      await db.update(eventComments).set({ status: "hidden", updatedAt: new Date() })
        .where(eq(eventComments.id, req.params.commentId));
      res.json({ success: true });
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Unknown error" });
    }
  });

  // ===== EVENT REVIEWS =====

  app.get("/api/events/:eventId/reviews", async (req: Request, res: Response) => {
    try {
      const result = await pool.query(`
        SELECT r.*, pu.display_name, pu.avatar_url
        FROM reviews r
        LEFT JOIN public_users pu ON pu.id = r.user_id
        WHERE r.event_id = $1 AND r.status = 'APPROVED'
        ORDER BY r.created_at DESC
        LIMIT 50
      `, [req.params.eventId]);
      res.json(result.rows);
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Unknown error" });
    }
  });

  app.get("/api/events/:eventId/reviews/aggregate", async (req: Request, res: Response) => {
    try {
      const result = await pool.query(`
        SELECT
          COUNT(*) AS review_count,
          COALESCE(AVG(rating)::numeric(3,2), 0) AS avg_rating
        FROM reviews
        WHERE event_id = $1 AND status = 'APPROVED'
      `, [req.params.eventId]);
      res.json({
        reviewCount: parseInt(result.rows[0].review_count),
        avgRating: parseFloat(result.rows[0].avg_rating),
      });
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Unknown error" });
    }
  });

  app.get("/api/event-series/:seriesId/reviews/aggregate", async (req: Request, res: Response) => {
    try {
      const result = await pool.query(`
        SELECT
          COUNT(*) AS review_count,
          COALESCE(AVG(r.rating)::numeric(3,2), 0) AS avg_rating
        FROM reviews r
        JOIN events e ON e.id = r.event_id
        WHERE e.event_series_id = $1 AND r.status = 'APPROVED'
      `, [req.params.seriesId]);
      res.json({
        reviewCount: parseInt(result.rows[0].review_count),
        avgRating: parseFloat(result.rows[0].avg_rating),
      });
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Unknown error" });
    }
  });

  app.post("/api/events/:eventId/reviews", async (req: Request, res: Response) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) return res.status(401).json({ message: "Login required" });

      const eventResult = await pool.query(
        `SELECT id, lifecycle_status FROM events WHERE id = $1`, [req.params.eventId]
      );
      if (eventResult.rows.length === 0) return res.status(404).json({ message: "Event not found" });
      if (eventResult.rows[0].lifecycle_status !== "completed") {
        return res.status(400).json({ message: "Reviews can only be left after the event has completed" });
      }

      let isAttendee = false;
      try {
        const rsvpCheck = await pool.query(
          `SELECT id FROM event_rsvps WHERE event_id = $1 AND user_id = $2 AND response = 'attending'`,
          [req.params.eventId, userId]
        );
        isAttendee = rsvpCheck.rows.length > 0;
        if (!isAttendee) {
          const ticketCheck = await pool.query(
            `SELECT id FROM event_ticket_orders WHERE event_id = $1 AND user_id = $2 AND status = 'completed'`,
            [req.params.eventId, userId]
          );
          isAttendee = ticketCheck.rows.length > 0;
        }
      } catch {
        return res.status(500).json({ message: "Unable to verify attendee status" });
      }

      if (!isAttendee) {
        return res.status(403).json({ message: "Only verified attendees can review events" });
      }

      const existing = await pool.query(
        `SELECT id FROM reviews WHERE event_id = $1 AND user_id = $2`,
        [req.params.eventId, userId]
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({ message: "You have already reviewed this event" });
      }

      const { rating, comment } = req.body;
      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Rating must be between 1 and 5" });
      }

      const [row] = await db.insert(reviews).values({
        eventId: req.params.eventId,
        userId,
        rating,
        comment: comment || null,
        status: "PENDING",
        sourceType: "internal",
      }).returning();
      res.status(201).json(row);
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Unknown error" });
    }
  });

  app.patch("/api/events/:eventId/reviews/:reviewId/respond", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { ownerResponse } = req.body;
      if (!ownerResponse) return res.status(400).json({ message: "Response text required" });

      await pool.query(
        `UPDATE reviews SET owner_response = $1, owner_responded_at = NOW(), updated_at = NOW()
         WHERE id = $2 AND event_id = $3`,
        [ownerResponse, req.params.reviewId, req.params.eventId]
      );
      res.json({ success: true });
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Unknown error" });
    }
  });

  // ===== SEEN AROUND TOWN =====

  app.get("/api/cities/:citySlug/seen-around-town", async (req: Request, res: Response) => {
    try {
      const cityResult = await pool.query(`SELECT id FROM cities WHERE slug = $1`, [req.params.citySlug]);
      if (cityResult.rows.length === 0) return res.status(404).json({ message: "City not found" });

      const result = await pool.query(`
        SELECT * FROM seen_around_town
        WHERE city_id = $1
          AND status = 'published'
          AND publish_at <= NOW()
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY publish_at DESC
        LIMIT 20
      `, [cityResult.rows[0].id]);
      res.json(result.rows);
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Unknown error" });
    }
  });

  app.get("/api/cities/:citySlug/seen-around-town/:slug", async (req: Request, res: Response) => {
    try {
      const cityResult = await pool.query(`SELECT id FROM cities WHERE slug = $1`, [req.params.citySlug]);
      if (cityResult.rows.length === 0) return res.status(404).json({ message: "City not found" });

      const result = await pool.query(`
        SELECT * FROM seen_around_town WHERE city_id = $1 AND slug = $2
      `, [cityResult.rows[0].id, req.params.slug]);
      if (result.rows.length === 0) return res.status(404).json({ message: "Not found" });
      res.json(result.rows[0]);
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Unknown error" });
    }
  });

  app.post("/api/admin/seen-around-town", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = insertSeenAroundTownSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });

      if (!parsed.data.expiresAt && parsed.data.publishAt) {
        parsed.data.expiresAt = new Date(new Date(parsed.data.publishAt).getTime() + 14 * 24 * 60 * 60 * 1000);
      }

      const [row] = await db.insert(seenAroundTown).values(parsed.data).returning();
      res.status(201).json(row);
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Unknown error" });
    }
  });

  app.patch("/api/admin/seen-around-town/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const updates = req.body;
      updates.updatedAt = new Date();
      await db.update(seenAroundTown).set(updates).where(eq(seenAroundTown.id, req.params.id));
      res.json({ success: true });
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Unknown error" });
    }
  });

  app.delete("/api/admin/seen-around-town/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await db.delete(seenAroundTown).where(eq(seenAroundTown.id, req.params.id));
      res.json({ success: true });
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Unknown error" });
    }
  });

  app.post("/api/admin/seen-around-town/generate", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { cityId, hubSlug, weekendDate } = req.body;
      if (!cityId) return res.status(400).json({ message: "cityId required" });

      const targetDate = weekendDate ? new Date(weekendDate) : new Date();
      const fridayStart = new Date(targetDate);
      fridayStart.setDate(fridayStart.getDate() - ((fridayStart.getDay() + 2) % 7));
      fridayStart.setHours(0, 0, 0, 0);
      const sundayEnd = new Date(fridayStart);
      sundayEnd.setDate(sundayEnd.getDate() + 2);
      sundayEnd.setHours(23, 59, 59, 999);

      const eventsResult = await pool.query(`
        SELECT id, title, slug, start_date_time, location_name, image_url, rsvp_count
        FROM events
        WHERE city_id = $1
          AND lifecycle_status IN ('completed', 'live', 'published')
          AND start_date_time BETWEEN $2 AND $3
        ORDER BY rsvp_count DESC
        LIMIT 10
      `, [cityId, fridayStart.toISOString(), sundayEnd.toISOString()]);

      if (eventsResult.rows.length === 0) {
        return res.json({ message: "No events found for that weekend", generated: false });
      }

      const eventTitles = eventsResult.rows.map((e: Record<string, unknown>) => e.title).join(", ");
      const eventIds = eventsResult.rows.map((e: Record<string, unknown>) => e.id as string);
      const photos = eventsResult.rows
        .filter((e: Record<string, unknown>) => e.image_url)
        .map((e: Record<string, unknown>) => e.image_url as string);

      const weekLabel = fridayStart.toLocaleDateString("en-US", { month: "long", day: "numeric" });
      const slug = `seen-around-town-${fridayStart.toISOString().slice(0, 10)}${hubSlug ? `-${hubSlug}` : ""}`;
      const title = `Seen Around Town — Weekend of ${weekLabel}`;
      const body = `Here's what went down this past weekend! From ${eventTitles} — Charlotte showed up and showed out. Check out highlights from ${eventsResult.rows.length} events across the metro.`;

      const publishAt = new Date();
      const expiresAt = new Date(publishAt.getTime() + 14 * 24 * 60 * 60 * 1000);

      const [row] = await db.insert(seenAroundTown).values({
        cityId,
        hubSlug: hubSlug || null,
        title,
        slug,
        body,
        coverImageUrl: photos[0] || null,
        photoHighlights: photos,
        eventIds,
        attendanceNotes: `${eventsResult.rows.length} events covered`,
        publishAt,
        expiresAt,
        generatedByAi: true,
        triggeredBy: getSessionUserId(req),
        status: "draft",
      }).returning();

      res.status(201).json({ generated: true, recap: row });
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Unknown error" });
    }
  });

  // ===== SYNDICATION =====

  app.get("/api/admin/events/:eventId/syndications", requireAdmin, async (req: Request, res: Response) => {
    try {
      const rows = await db.select().from(eventSyndications)
        .where(eq(eventSyndications.eventId, req.params.eventId))
        .orderBy(desc(eventSyndications.createdAt));
      res.json(rows);
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Unknown error" });
    }
  });

  app.post("/api/admin/events/:eventId/syndications", requireAdmin, async (req: Request, res: Response) => {
    try {
      const eventResult = await pool.query(`SELECT id, slug, city_id FROM events WHERE id = $1`, [req.params.eventId]);
      if (eventResult.rows.length === 0) return res.status(404).json({ message: "Event not found" });

      const cityResult = await pool.query(`SELECT slug FROM cities WHERE id = $1`, [eventResult.rows[0].city_id]);
      const citySlug = cityResult.rows[0]?.slug || "charlotte";
      const linkBackUrl = `${req.protocol}://${req.get("host")}/${citySlug}/events/${eventResult.rows[0].slug}`;

      const parsed = insertEventSyndicationSchema.safeParse({
        ...req.body,
        eventId: req.params.eventId,
        linkBackUrl,
      });
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });

      const [row] = await db.insert(eventSyndications).values(parsed.data).returning();
      res.status(201).json(row);
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Unknown error" });
    }
  });

  app.patch("/api/admin/syndications/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const updates = { ...req.body, updatedAt: new Date() };
      await db.update(eventSyndications).set(updates).where(eq(eventSyndications.id, req.params.id));
      res.json({ success: true });
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Unknown error" });
    }
  });

  // ===== EMBED WIDGET =====

  app.get("/api/events/:eventId/embed-config", async (req: Request, res: Response) => {
    try {
      const [config] = await db.select().from(eventEmbedConfigs)
        .where(eq(eventEmbedConfigs.eventId, req.params.eventId));
      res.json(config || { theme: "dark", showTicketButton: true, buttonText: "Get Tickets on CLT Hub" });
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Unknown error" });
    }
  });

  app.post("/api/admin/events/:eventId/embed-config", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = insertEventEmbedConfigSchema.safeParse({
        ...req.body,
        eventId: req.params.eventId,
      });
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });

      const existing = await db.select().from(eventEmbedConfigs)
        .where(eq(eventEmbedConfigs.eventId, req.params.eventId));

      if (existing.length > 0) {
        await db.update(eventEmbedConfigs).set(req.body)
          .where(eq(eventEmbedConfigs.eventId, req.params.eventId));
        res.json({ success: true, updated: true });
      } else {
        const [row] = await db.insert(eventEmbedConfigs).values(parsed.data).returning();
        res.status(201).json(row);
      }
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Unknown error" });
    }
  });

  app.get("/api/embed/event/:eventId", async (req: Request, res: Response) => {
    try {
      const eventResult = await pool.query(`
        SELECT e.id, e.title, e.slug, e.start_date_time, e.end_date_time,
               e.location_name, e.cost_text, e.image_url,
               c.slug AS city_slug
        FROM events e
        JOIN cities c ON c.id = e.city_id
        WHERE e.id = $1
      `, [req.params.eventId]);
      if (eventResult.rows.length === 0) return res.status(404).json({ message: "Event not found" });

      const event = eventResult.rows[0];
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const eventUrl = `${baseUrl}/${escapeHtml(event.city_slug)}/events/${escapeHtml(event.slug)}`;

      const [config] = await db.select().from(eventEmbedConfigs)
        .where(eq(eventEmbedConfigs.eventId, req.params.eventId));

      const theme = config?.theme || "dark";
      const buttonText = escapeHtml(config?.buttonText || "Get Tickets on CLT Hub");
      const showButton = config?.showTicketButton !== false;

      const startDate = new Date(event.start_date_time);
      const dateStr = startDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
      const timeStr = startDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

      const bgColor = theme === "dark" ? "#1E1B2E" : "#ffffff";
      const textColor = theme === "dark" ? "#ffffff" : "#1a1a1a";
      const mutedColor = theme === "dark" ? "#a0a0b0" : "#666666";
      const borderColor = theme === "dark" ? "#2a2840" : "#e5e5e5";

      const safeTitle = escapeHtml(event.title || "");
      const safeLocation = escapeHtml(event.location_name || "");
      const safeCost = escapeHtml(event.cost_text || "");
      const safeImageUrl = escapeHtml(event.image_url || "");

      const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:transparent}
.card{background:${bgColor};border:1px solid ${borderColor};border-radius:12px;overflow:hidden;max-width:400px}
.img{width:100%;height:160px;object-fit:cover}
.body{padding:16px}
.title{font-size:16px;font-weight:700;color:${textColor};margin-bottom:8px;line-height:1.3}
.meta{font-size:13px;color:${mutedColor};margin-bottom:4px}
.btn{display:inline-block;margin-top:12px;padding:10px 20px;background:#6B21A8;color:#fff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600}
.btn:hover{background:#7C3AED}
.brand{font-size:10px;color:${mutedColor};margin-top:12px;text-align:center;padding-bottom:8px}
</style></head><body>
<div class="card">
${event.image_url ? `<img class="img" src="${safeImageUrl}" alt="${safeTitle}">` : ""}
<div class="body">
<div class="title">${safeTitle}</div>
<div class="meta">📅 ${dateStr} at ${timeStr}</div>
${event.location_name ? `<div class="meta">📍 ${safeLocation}</div>` : ""}
${event.cost_text ? `<div class="meta">🎟️ ${safeCost}</div>` : ""}
${showButton ? `<a class="btn" href="${eventUrl}" target="_blank" rel="noopener">${buttonText}</a>` : ""}
</div>
<div class="brand">Powered by CLT Hub</div>
</div></body></html>`;

      res.set("Content-Type", "text/html");
      res.set("X-Frame-Options", "ALLOWALL");
      res.send(html);
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Unknown error" });
    }
  });

  // ===== .ICS CALENDAR EXPORT =====

  app.get("/api/events/:eventId/calendar.ics", async (req: Request, res: Response) => {
    try {
      const eventResult = await pool.query(`
        SELECT e.*, c.slug AS city_slug, c.name AS city_name, c.brand_name
        FROM events e
        JOIN cities c ON c.id = e.city_id
        WHERE e.id = $1
      `, [req.params.eventId]);
      if (eventResult.rows.length === 0) return res.status(404).json({ message: "Event not found" });

      const event = eventResult.rows[0];
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const eventUrl = `${baseUrl}/${event.city_slug}/events/${event.slug}`;
      const brandName = event.brand_name || "CLT Hub";

      const formatIcsDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      const start = formatIcsDate(new Date(event.start_date_time));
      const end = event.end_date_time
        ? formatIcsDate(new Date(event.end_date_time))
        : formatIcsDate(new Date(new Date(event.start_date_time).getTime() + 2 * 3600000));

      const description = [
        event.description || "",
        "",
        `View event details and get tickets on ${brandName}:`,
        eventUrl,
        "",
        `Powered by ${brandName} — Your local community hub`,
      ].join("\\n");

      const location = [event.location_name, event.address, event.city, event.state].filter(Boolean).join(", ");

      const ics = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        `PRODID:-//${brandName}//Events//EN`,
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        `UID:${event.id}@clthub.com`,
        `DTSTART:${start}`,
        `DTEND:${end}`,
        `SUMMARY:${event.title}`,
        `DESCRIPTION:${description}`,
        `LOCATION:${location}`,
        `URL:${eventUrl}`,
        `ORGANIZER;CN=${brandName}:mailto:events@clthub.com`,
        "END:VEVENT",
        "END:VCALENDAR",
      ].join("\r\n");

      res.set({
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${event.slug}.ics"`,
      });
      res.send(ics);
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Unknown error" });
    }
  });

  // ===== ORGANIZER TOOLKIT — SURVEYS =====

  app.get("/api/admin/events/:eventId/surveys", requireAdmin, async (req: Request, res: Response) => {
    try {
      const rows = await db.select().from(eventSurveys)
        .where(eq(eventSurveys.eventId, req.params.eventId));
      res.json(rows);
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Unknown error" });
    }
  });

  app.post("/api/admin/events/:eventId/surveys", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = insertEventSurveySchema.safeParse({
        ...req.body,
        eventId: req.params.eventId,
      });
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
      const [row] = await db.insert(eventSurveys).values(parsed.data).returning();
      res.status(201).json(row);
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Unknown error" });
    }
  });

  app.delete("/api/admin/event-surveys/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await db.delete(eventSurveys).where(eq(eventSurveys.id, req.params.id));
      res.json({ success: true });
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Unknown error" });
    }
  });

  // ===== ORGANIZER TOOLKIT — NOMINATIONS =====

  app.get("/api/events/:eventId/nominations", async (req: Request, res: Response) => {
    try {
      const rows = await db.select().from(eventNominations)
        .where(and(eq(eventNominations.eventId, req.params.eventId), eq(eventNominations.isActive, true)));
      res.json(rows);
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Unknown error" });
    }
  });

  app.post("/api/admin/events/:eventId/nominations", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = insertEventNominationSchema.safeParse({
        ...req.body,
        eventId: req.params.eventId,
      });
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
      const [row] = await db.insert(eventNominations).values(parsed.data).returning();
      res.status(201).json(row);
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Unknown error" });
    }
  });

  app.post("/api/events/:eventId/nominations/:nominationId/vote", async (req: Request, res: Response) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) return res.status(401).json({ message: "Login required" });

      const { nomineeLabel } = req.body;
      if (!nomineeLabel) return res.status(400).json({ message: "nomineeLabel required" });

      const [row] = await db.insert(eventNominationVotes).values({
        nominationId: req.params.nominationId,
        userId,
        nomineeLabel,
      }).returning();
      res.status(201).json(row);
    } catch (e: unknown) {
      if ((e as Error).message?.includes("duplicate") || (e as Error).message?.includes("unique")) {
        return res.status(400).json({ message: "You have already voted in this category" });
      }
      res.status(500).json({ message: e instanceof Error ? e.message : "Unknown error" });
    }
  });

  // ===== ORGANIZER TOOLKIT — GIVEAWAYS =====

  app.get("/api/events/:eventId/giveaways", async (req: Request, res: Response) => {
    try {
      const rows = await db.select().from(eventGiveaways)
        .where(and(eq(eventGiveaways.eventId, req.params.eventId), eq(eventGiveaways.isActive, true)));
      res.json(rows);
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Unknown error" });
    }
  });

  app.post("/api/admin/events/:eventId/giveaways", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = insertEventGiveawaySchema.safeParse({
        ...req.body,
        eventId: req.params.eventId,
      });
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
      const [row] = await db.insert(eventGiveaways).values(parsed.data).returning();
      res.status(201).json(row);
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Unknown error" });
    }
  });

  app.post("/api/events/:eventId/giveaways/:giveawayId/enter", async (req: Request, res: Response) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) return res.status(401).json({ message: "Login required" });

      const [row] = await db.insert(eventGiveawayEntries).values({
        giveawayId: req.params.giveawayId,
        userId,
      }).returning();
      res.status(201).json(row);
    } catch (e: unknown) {
      if ((e as Error).message?.includes("duplicate") || (e as Error).message?.includes("unique")) {
        return res.status(400).json({ message: "You have already entered this giveaway" });
      }
      res.status(500).json({ message: e instanceof Error ? e.message : "Unknown error" });
    }
  });

  app.post("/api/admin/giveaways/:giveawayId/draw", requireAdmin, async (req: Request, res: Response) => {
    try {
      const entries = await pool.query(
        `SELECT user_id FROM event_giveaway_entries WHERE giveaway_id = $1 ORDER BY RANDOM() LIMIT 1`,
        [req.params.giveawayId]
      );
      if (entries.rows.length === 0) return res.status(400).json({ message: "No entries to draw from" });

      const winnerId = entries.rows[0].user_id;
      await db.update(eventGiveaways).set({ winnerId, drawnAt: new Date() })
        .where(eq(eventGiveaways.id, req.params.giveawayId));

      res.json({ winnerId, drawn: true });
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Unknown error" });
    }
  });

  // ===== ATTENDEE CSV EXPORT =====

  app.get("/api/admin/events/:eventId/attendees/export", requireAdmin, async (req: Request, res: Response) => {
    try {
      const rsvps = await pool.query(`
        SELECT
          COALESCE(pu.display_name, er.name, '') AS name,
          COALESCE(pu.email, er.email, '') AS email,
          er.phone,
          er.response,
          er.checked_in,
          er.checked_in_at,
          er.created_at
        FROM event_rsvps er
        LEFT JOIN public_users pu ON pu.id = er.user_id
        WHERE er.event_id = $1
        ORDER BY er.created_at
      `, [req.params.eventId]);

      let ticketRows: Record<string, unknown>[] = [];
      try {
        const tickets = await pool.query(`
          SELECT
            COALESCE(pu.display_name, '') AS name,
            COALESCE(pu.email, '') AS email,
            eto.status AS ticket_status,
            ett.name AS ticket_type,
            eto.created_at
          FROM event_ticket_orders eto
          LEFT JOIN public_users pu ON pu.id = eto.user_id
          LEFT JOIN event_ticket_types ett ON ett.id = eto.ticket_type_id
          WHERE eto.event_id = $1
          ORDER BY eto.created_at
        `, [req.params.eventId]);
        ticketRows = tickets.rows;
      } catch {
        // ticket orders table may not exist yet
      }

      const csvHeaders = ["Name", "Email", "Phone", "Type", "Status", "Checked In", "Check-in Time", "Registered At"];
      const csvRows = rsvps.rows.map((r: Record<string, unknown>) => [
        r.name, r.email, r.phone || "", "RSVP", r.response,
        r.checked_in ? "Yes" : "No", r.checked_in_at || "", r.created_at,
      ]);

      for (const t of ticketRows) {
        csvRows.push([
          t.name as string, t.email as string, "", "Ticket", t.ticket_status as string,
          "", "", t.created_at as string,
        ]);
      }

      const csv = [csvHeaders.join(","), ...csvRows.map((row: unknown[]) =>
        row.map((cell: unknown) => `"${String(cell || "").replace(/"/g, '""')}"`).join(",")
      )].join("\n");

      res.set({
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="attendees-${req.params.eventId}.csv"`,
      });
      res.send(csv);
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Unknown error" });
    }
  });

  // ===== ORGANIZER FOLLOW-UP MESSAGING =====

  app.post("/api/admin/events/:eventId/follow-up", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { subject, body, channel } = req.body;
      if (!body) return res.status(400).json({ message: "Message body required" });

      const attendees = await pool.query(`
        SELECT DISTINCT COALESCE(pu.email, er.email) AS email, COALESCE(pu.display_name, er.name) AS name
        FROM event_rsvps er
        LEFT JOIN public_users pu ON pu.id = er.user_id
        WHERE er.event_id = $1 AND er.response = 'attending'
          AND COALESCE(pu.email, er.email) IS NOT NULL
      `, [req.params.eventId]);

      const recipientCount = attendees.rows.length;

      res.json({
        queued: true,
        recipientCount,
        subject: subject || "Follow-up from your event",
        channel: channel || "email",
        note: "Follow-up messages are queued for delivery. Credits will be deducted upon send.",
      });
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Unknown error" });
    }
  });

  // ===== DRIP CAMPAIGNS =====

  app.get("/api/admin/events/:eventId/drip-campaigns", requireAdmin, async (req: Request, res: Response) => {
    try {
      const campaigns = await db.select().from(eventDripCampaigns)
        .where(eq(eventDripCampaigns.eventId, req.params.eventId))
        .orderBy(desc(eventDripCampaigns.createdAt));

      const result = [];
      for (const campaign of campaigns) {
        const steps = await db.select().from(eventDripSteps)
          .where(eq(eventDripSteps.campaignId, campaign.id))
          .orderBy(asc(eventDripSteps.sortOrder));
        result.push({ ...campaign, steps });
      }
      res.json(result);
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Unknown error" });
    }
  });

  app.post("/api/admin/events/:eventId/drip-campaigns", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = insertEventDripCampaignSchema.safeParse({
        ...req.body,
        eventId: req.params.eventId,
        createdBy: getSessionUserId(req),
      });
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });

      const [campaign] = await db.insert(eventDripCampaigns).values(parsed.data).returning();

      if (Array.isArray(req.body.steps) && req.body.steps.length > 0) {
        for (let i = 0; i < req.body.steps.length; i++) {
          const stepData = insertEventDripStepSchema.safeParse({
            ...req.body.steps[i],
            campaignId: campaign.id,
            sortOrder: i,
          });
          if (stepData.success) {
            await db.insert(eventDripSteps).values(stepData.data);
          }
        }
      }

      const steps = await db.select().from(eventDripSteps)
        .where(eq(eventDripSteps.campaignId, campaign.id))
        .orderBy(asc(eventDripSteps.sortOrder));

      res.status(201).json({ ...campaign, steps });
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Unknown error" });
    }
  });

  app.patch("/api/admin/drip-campaigns/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { isActive, name } = req.body;
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (isActive !== undefined) updates.isActive = isActive;
      if (name !== undefined) updates.name = name;

      await db.update(eventDripCampaigns).set(updates)
        .where(eq(eventDripCampaigns.id, req.params.id));
      res.json({ success: true });
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Unknown error" });
    }
  });

  app.post("/api/admin/events/:eventId/drip-campaigns/:campaignId/steps", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { timing, channel, subject, body, includeSurveyLink, includeReviewPrompt, sortOrder, aiGenerated } = req.body;
      if (!body || !timing) {
        return res.status(400).json({ message: "Body and timing are required" });
      }
      const [step] = await db.insert(eventDripSteps).values({
        campaignId: req.params.campaignId,
        timing,
        channel: channel || "email",
        subject: subject || null,
        body,
        includeSurveyLink: includeSurveyLink || false,
        includeReviewPrompt: includeReviewPrompt || false,
        sortOrder: sortOrder || 0,
        aiGenerated: aiGenerated || false,
      }).returning();
      res.json(step);
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Unknown error" });
    }
  });

  app.delete("/api/admin/drip-campaigns/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await db.delete(eventDripSteps).where(eq(eventDripSteps.campaignId, req.params.id));
      await db.delete(eventDripCampaigns).where(eq(eventDripCampaigns.id, req.params.id));
      res.json({ success: true });
    } catch (e: unknown) {
      res.status(500).json({ message: e instanceof Error ? e.message : "Unknown error" });
    }
  });
}
