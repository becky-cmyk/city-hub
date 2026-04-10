import { Router, type Request, type Response, type NextFunction } from "express";
import { pool } from "./db";
import { isAdminSession } from "./admin-check";

const router = Router();

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!(req.session as Record<string, unknown>).userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

async function requireOwner(req: Request, res: Response, next: NextFunction) {
  if ((req.session as Record<string, unknown>).ownerAccountId) {
    return next();
  }
  if (await isAdminSession(req)) return next();
  return res.status(401).json({ message: "Unauthorized" });
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 80);
}

function generateOccurrenceDates(
  recurrenceType: string,
  ruleJson: string | null,
  count: number = 8
): Date[] {
  const dates: Date[] = [];
  const now = new Date();
  let rule: Record<string, any> = {};
  try {
    if (ruleJson) rule = JSON.parse(ruleJson);
  } catch (parseErr) {
    console.warn("[EventSeries] Invalid recurrence_rule_json:", parseErr instanceof Error ? parseErr.message : parseErr);
  }

  if (recurrenceType === "weekly") {
    const dayOfWeek = rule.dayOfWeek ?? now.getDay();
    const startTime = rule.startTime || "19:00";
    const [hours, minutes] = startTime.split(":").map(Number);

    let current = new Date(now);
    current.setHours(hours, minutes, 0, 0);
    const dayDiff = (dayOfWeek - current.getDay() + 7) % 7;
    current.setDate(current.getDate() + (dayDiff === 0 && current <= now ? 7 : dayDiff));

    for (let i = 0; i < count; i++) {
      dates.push(new Date(current));
      current = new Date(current);
      current.setDate(current.getDate() + 7);
    }
  } else if (recurrenceType === "monthly") {
    const dayOfMonth = rule.dayOfMonth ?? now.getDate();
    const weekOfMonth = rule.weekOfMonth;
    const dayOfWeek = rule.dayOfWeek;
    const startTime = rule.startTime || "19:00";
    const [hours, minutes] = startTime.split(":").map(Number);

    let current = new Date(now);
    current.setHours(hours, minutes, 0, 0);

    for (let m = 0; m < count + 2 && dates.length < count; m++) {
      const targetMonth = now.getMonth() + m;
      const targetYear = now.getFullYear() + Math.floor(targetMonth / 12);
      const month = targetMonth % 12;

      let date: Date;
      if (weekOfMonth !== undefined && dayOfWeek !== undefined) {
        const firstDay = new Date(targetYear, month, 1);
        const firstDayOfWeek = firstDay.getDay();
        let day = 1 + ((dayOfWeek - firstDayOfWeek + 7) % 7) + (weekOfMonth - 1) * 7;
        date = new Date(targetYear, month, day, hours, minutes);
      } else {
        const daysInMonth = new Date(targetYear, month + 1, 0).getDate();
        date = new Date(targetYear, month, Math.min(dayOfMonth, daysInMonth), hours, minutes);
      }

      if (date > now) {
        dates.push(date);
      }
    }
  } else if (recurrenceType === "custom") {
    const customDates = rule.dates || [];
    const startTime = rule.startTime || "19:00";
    const [hours, minutes] = startTime.split(":").map(Number);

    for (const dateStr of customDates) {
      const d = new Date(dateStr);
      d.setHours(hours, minutes, 0, 0);
      if (d > now) {
        dates.push(d);
      }
    }
  }

  return dates.slice(0, count);
}

router.get("/api/event-series", async (req: Request, res: Response) => {
  try {
    const cityId = req.query.cityId as string;
    const status = req.query.status as string;
    let query = `SELECT es.*, 
      b1.name AS host_presence_name, b1.slug AS host_presence_slug, b1.image_url AS host_image_url,
      b2.name AS venue_presence_name, b2.slug AS venue_presence_slug, b2.image_url AS venue_image_url,
      (SELECT COUNT(*) FROM events e WHERE e.event_series_id = es.id) AS occurrence_count,
      (SELECT MIN(e.start_date_time) FROM events e WHERE e.event_series_id = es.id AND e.start_date_time > NOW() AND e.occurrence_status = 'scheduled') AS next_occurrence
    FROM event_series es
    LEFT JOIN businesses b1 ON b1.id = es.host_presence_id
    LEFT JOIN businesses b2 ON b2.id = es.venue_presence_id
    WHERE 1=1`;
    const params: any[] = [];

    if (cityId) {
      params.push(cityId);
      query += ` AND es.city_id = $${params.length}`;
    }
    query += ` AND es.status = 'active'`;
    query += ` ORDER BY es.created_at DESC LIMIT 100`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

router.get("/api/event-series/by-slug/:slug", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const citySlug = req.query.citySlug as string;
    const cityId = req.query.cityId as string;

    let resolvedCityId = cityId;
    if (!resolvedCityId && citySlug) {
      const cityResult = await pool.query(`SELECT id FROM cities WHERE slug = $1 LIMIT 1`, [citySlug]);
      if (cityResult.rows.length > 0) {
        resolvedCityId = cityResult.rows[0].id;
      }
    }

    let query = `SELECT es.*, 
      b1.name AS host_presence_name, b1.slug AS host_presence_slug, b1.image_url AS host_image_url,
      b2.name AS venue_presence_name, b2.slug AS venue_presence_slug, b2.image_url AS venue_image_url
    FROM event_series es
    LEFT JOIN businesses b1 ON b1.id = es.host_presence_id
    LEFT JOIN businesses b2 ON b2.id = es.venue_presence_id
    WHERE es.slug = $1 AND es.status IN ('active', 'archived')`;
    const params: any[] = [slug];

    if (resolvedCityId) {
      params.push(resolvedCityId);
      query += ` AND es.city_id = $${params.length}`;
    }
    query += ` LIMIT 1`;

    const result = await pool.query(query, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Series not found" });
    }

    const series = result.rows[0];

    const occurrencesResult = await pool.query(
      `SELECT * FROM events WHERE event_series_id = $1 ORDER BY start_date_time ASC`,
      [series.id]
    );

    const now = new Date();
    const upcoming = occurrencesResult.rows.filter(
      (e: any) => new Date(e.start_date_time) >= now && e.occurrence_status === "scheduled"
    );
    const past = occurrencesResult.rows.filter(
      (e: any) => new Date(e.start_date_time) < now
    );

    res.json({
      ...series,
      upcoming_occurrences: upcoming,
      past_occurrences: past,
      total_occurrences: occurrencesResult.rows.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

router.get("/api/event-series/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT es.*, 
        b1.name AS host_presence_name, b1.slug AS host_presence_slug,
        b2.name AS venue_presence_name, b2.slug AS venue_presence_slug
      FROM event_series es
      LEFT JOIN businesses b1 ON b1.id = es.host_presence_id
      LEFT JOIN businesses b2 ON b2.id = es.venue_presence_id
      WHERE es.id = $1 AND es.status IN ('active', 'archived')`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Series not found" });
    }
    res.json(result.rows[0]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

router.post("/api/admin/event-series", requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      title, titleEs, description, descriptionEs, imageUrl,
      hostPresenceId, venuePresenceId, hubId, cityId, zoneId, categoryId,
      visibilityDefault, recurrenceType, recurrenceRuleJson,
      defaultStartTime, defaultEndTime, defaultDurationMinutes,
      defaultLocationName, defaultAddress, defaultCity, defaultState, defaultZip,
      defaultCostText, defaultMaxCapacity, defaultRsvpEnabled, status,
    } = req.body;

    if (!title || !cityId) {
      return res.status(400).json({ message: "Title and cityId are required" });
    }

    const slug = generateSlug(title) + "-" + Date.now().toString(36);

    const result = await pool.query(
      `INSERT INTO event_series (
        title, title_es, slug, description, description_es, image_url,
        host_presence_id, venue_presence_id, hub_id, city_id, zone_id, category_id,
        visibility_default, recurrence_type, recurrence_rule_json,
        default_start_time, default_end_time, default_duration_minutes,
        default_location_name, default_address, default_city, default_state, default_zip,
        default_cost_text, default_max_capacity, default_rsvp_enabled, status,
        created_by_user_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28) RETURNING *`,
      [
        title, titleEs || null, slug, description || null, descriptionEs || null, imageUrl || null,
        hostPresenceId || null, venuePresenceId || null, hubId || null, cityId, zoneId || null, categoryId || null,
        visibilityDefault || "public", recurrenceType || "none", recurrenceRuleJson || null,
        defaultStartTime || null, defaultEndTime || null, defaultDurationMinutes || null,
        defaultLocationName || null, defaultAddress || null, defaultCity || null, defaultState || null, defaultZip || null,
        defaultCostText || null, defaultMaxCapacity || null, defaultRsvpEnabled || false, status || "draft",
        (req.session as any).userId,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

router.patch("/api/admin/event-series/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const fields = req.body;
    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;

    const allowedFields: Record<string, string> = {
      title: "title", titleEs: "title_es", description: "description",
      descriptionEs: "description_es", imageUrl: "image_url",
      hostPresenceId: "host_presence_id", venuePresenceId: "venue_presence_id",
      hubId: "hub_id", zoneId: "zone_id", categoryId: "category_id",
      visibilityDefault: "visibility_default", recurrenceType: "recurrence_type",
      recurrenceRuleJson: "recurrence_rule_json",
      defaultStartTime: "default_start_time", defaultEndTime: "default_end_time",
      defaultDurationMinutes: "default_duration_minutes",
      defaultLocationName: "default_location_name", defaultAddress: "default_address",
      defaultCity: "default_city", defaultState: "default_state", defaultZip: "default_zip",
      defaultCostText: "default_cost_text", defaultMaxCapacity: "default_max_capacity",
      defaultRsvpEnabled: "default_rsvp_enabled", status: "status",
    };

    for (const [key, col] of Object.entries(allowedFields)) {
      if (fields[key] !== undefined) {
        setClauses.push(`${col} = $${idx}`);
        values.push(fields[key]);
        idx++;
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE event_series SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Series not found" });
    }
    res.json(result.rows[0]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

router.delete("/api/admin/event-series/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query(`UPDATE events SET event_series_id = NULL WHERE event_series_id = $1`, [id]);
    await pool.query(`DELETE FROM event_series WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

router.post("/api/admin/event-series/:id/generate-occurrences", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { count } = req.body;

    const seriesResult = await pool.query(`SELECT * FROM event_series WHERE id = $1`, [id]);
    if (seriesResult.rows.length === 0) {
      return res.status(404).json({ message: "Series not found" });
    }
    const series = seriesResult.rows[0];

    if (series.recurrence_type === "none") {
      return res.status(400).json({ message: "Series has no recurrence rule" });
    }

    const dates = generateOccurrenceDates(
      series.recurrence_type,
      series.recurrence_rule_json,
      count || 8
    );

    if (dates.length === 0) {
      return res.status(400).json({ message: "No dates generated — check recurrence rule" });
    }

    const existingResult = await pool.query(
      `SELECT start_date_time FROM events WHERE event_series_id = $1`,
      [id]
    );
    const existingDates = new Set(
      existingResult.rows.map((r: any) => new Date(r.start_date_time).toISOString().split("T")[0])
    );

    const created: any[] = [];
    let occIndex = existingResult.rows.length;

    for (const date of dates) {
      const dateKey = date.toISOString().split("T")[0];
      if (existingDates.has(dateKey)) continue;

      occIndex++;
      const endDate = series.default_duration_minutes
        ? new Date(date.getTime() + series.default_duration_minutes * 60000)
        : null;

      const slug = `${series.slug}-${dateKey}`;

      const result = await pool.query(
        `INSERT INTO events (
          city_id, zone_id, title, title_es, slug, description, description_es,
          start_date_time, end_date_time, location_name, address, city, state, zip,
          cost_text, image_url, host_business_id, venue_presence_id,
          visibility, max_capacity, rsvp_enabled,
          event_series_id, occurrence_status, occurrence_index, venue_name,
          category_ids, tag_ids
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27) RETURNING *`,
        [
          series.city_id, series.zone_id || null,
          series.title, series.title_es || null,
          slug, series.description || null, series.description_es || null,
          date, endDate,
          series.default_location_name || null, series.default_address || null,
          series.default_city || null, series.default_state || null, series.default_zip || null,
          series.default_cost_text || null, series.image_url || null,
          series.host_presence_id || null, series.venue_presence_id || null,
          series.visibility_default || "public",
          series.default_max_capacity || null,
          series.default_rsvp_enabled || false,
          id, "scheduled", occIndex,
          series.default_location_name || null,
          series.category_id ? `{${series.category_id}}` : "{}",
          "{}",
        ]
      );
      created.push(result.rows[0]);
    }

    res.status(201).json({ generated: created.length, occurrences: created });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

router.patch("/api/admin/event-series/:seriesId/occurrences/:eventId", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { seriesId, eventId } = req.params;
    const { occurrenceStatus } = req.body;

    if (!occurrenceStatus || !["scheduled", "skipped", "cancelled"].includes(occurrenceStatus)) {
      return res.status(400).json({ message: "Valid occurrenceStatus required" });
    }

    const result = await pool.query(
      `UPDATE events SET occurrence_status = $1, updated_at = NOW() WHERE id = $2 AND event_series_id = $3 RETURNING *`,
      [occurrenceStatus, eventId, seriesId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Occurrence not found" });
    }
    res.json(result.rows[0]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

router.patch("/api/admin/event-series/:seriesId/occurrences/:eventId/details", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { seriesId, eventId } = req.params;
    const fields = req.body;

    const check = await pool.query(
      `SELECT id FROM events WHERE id = $1 AND event_series_id = $2`,
      [eventId, seriesId]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ message: "Occurrence not found in this series" });
    }

    const allowedFields: Record<string, string> = {
      title: "title", description: "description",
      startDateTime: "start_date_time", endDateTime: "end_date_time",
      locationName: "location_name", address: "address",
      costText: "cost_text", imageUrl: "image_url",
      maxCapacity: "max_capacity", venueName: "venue_name",
      pulseReminderEnabled: "pulse_reminder_enabled",
    };

    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [key, col] of Object.entries(allowedFields)) {
      if (fields[key] !== undefined) {
        setClauses.push(`${col} = $${idx}`);
        values.push(fields[key]);
        idx++;
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(eventId);

    const result = await pool.query(
      `UPDATE events SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );
    res.json(result.rows[0]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

router.get("/api/admin/event-series/:seriesId/occurrences", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { seriesId } = req.params;
    const result = await pool.query(
      `SELECT e.*, 
        (SELECT COUNT(*) FROM event_rsvps r WHERE r.event_id = e.id AND r.response = 'attending') AS attending_count
      FROM events e WHERE e.event_series_id = $1 ORDER BY e.start_date_time ASC`,
      [seriesId]
    );
    res.json(result.rows);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

router.post("/api/venue-event-submissions", async (req: Request, res: Response) => {
  try {
    const {
      venuePresenceId, submitterName, submitterEmail,
      title, description, proposedStartDateTime, proposedEndDateTime,
      isRecurring, recurrenceDescription, costText, imageUrl, categoryId, cityId,
    } = req.body;

    if (!venuePresenceId || !title || !cityId) {
      return res.status(400).json({ message: "venuePresenceId, title, and cityId are required" });
    }

    const publicUserId = (req.session as any).publicUserId || null;
    const ownerEntityId = (req.session as any).ownerEntityId || null;

    const result = await pool.query(
      `INSERT INTO venue_event_submissions (
        venue_presence_id, submitter_presence_id, submitter_user_id,
        submitter_name, submitter_email, title, description,
        proposed_start_date_time, proposed_end_date_time,
        is_recurring, recurrence_description, cost_text, image_url,
        category_id, city_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [
        venuePresenceId, ownerEntityId || null, publicUserId || null,
        submitterName || null, submitterEmail || null,
        title, description || null,
        proposedStartDateTime || null, proposedEndDateTime || null,
        isRecurring || false, recurrenceDescription || null,
        costText || null, imageUrl || null,
        categoryId || null, cityId,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

router.get("/api/venue-event-submissions", async (req: Request, res: Response) => {
  try {
    const venueId = req.query.venueId as string;
    const status = req.query.status as string;

    let query = `SELECT ves.id, ves.title, ves.description, ves.proposed_start_date_time,
      ves.proposed_end_date_time, ves.is_recurring, ves.cost_text, ves.image_url,
      ves.status, ves.created_at, ves.venue_presence_id,
      b.name AS venue_name, b.slug AS venue_slug
    FROM venue_event_submissions ves
    JOIN businesses b ON b.id = ves.venue_presence_id
    WHERE 1=1`;
    const params: any[] = [];

    if (venueId) {
      params.push(venueId);
      query += ` AND ves.venue_presence_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND ves.status = $${params.length}`;
    }
    query += ` ORDER BY ves.created_at DESC LIMIT 100`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

router.patch("/api/admin/venue-event-submissions/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, reviewNote } = req.body;

    if (!status || !["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Valid status required" });
    }

    const result = await pool.query(
      `UPDATE venue_event_submissions SET status = $1, review_note = $2, reviewed_by_user_id = $3, reviewed_at = NOW(), updated_at = NOW() WHERE id = $4 RETURNING *`,
      [status, reviewNote || null, (req.session as any).userId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Submission not found" });
    }
    res.json(result.rows[0]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

router.post("/api/admin/venue-event-submissions/:id/convert", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { convertToSeries } = req.body;

    const subResult = await pool.query(
      `SELECT * FROM venue_event_submissions WHERE id = $1`,
      [id]
    );
    if (subResult.rows.length === 0) {
      return res.status(404).json({ message: "Submission not found" });
    }
    const sub = subResult.rows[0];

    if (sub.status === "converted") {
      return res.status(400).json({ message: "Submission already converted" });
    }
    if (sub.status !== "approved") {
      return res.status(400).json({ message: "Submission must be approved first" });
    }

    const slug = generateSlug(sub.title) + "-" + Date.now().toString(36);

    if (convertToSeries) {
      const seriesResult = await pool.query(
        `INSERT INTO event_series (
          title, slug, description, image_url,
          host_presence_id, venue_presence_id, city_id, category_id,
          default_cost_text, status, created_by_user_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',$10) RETURNING *`,
        [
          sub.title, slug, sub.description || null, sub.image_url || null,
          sub.submitter_presence_id || null, sub.venue_presence_id,
          sub.city_id, sub.category_id || null,
          sub.cost_text || null, (req.session as any).userId,
        ]
      );
      await pool.query(
        `UPDATE venue_event_submissions SET converted_series_id = $1, status = 'converted', updated_at = NOW() WHERE id = $2`,
        [seriesResult.rows[0].id, id]
      );
      res.json({ type: "series", series: seriesResult.rows[0] });
    } else {
      const zoneResult = await pool.query(
        `SELECT zone_id FROM businesses WHERE id = $1`,
        [sub.venue_presence_id]
      );
      const zoneId = zoneResult.rows[0]?.zone_id || null;

      const eventResult = await pool.query(
        `INSERT INTO events (
          city_id, zone_id, title, slug, description, image_url,
          start_date_time, end_date_time,
          host_business_id, venue_presence_id, cost_text,
          visibility, category_ids, tag_ids
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'public',$12,'{}') RETURNING *`,
        [
          sub.city_id, zoneId, sub.title, slug, sub.description || null, sub.image_url || null,
          sub.proposed_start_date_time || new Date(), sub.proposed_end_date_time || null,
          sub.submitter_presence_id || null, sub.venue_presence_id,
          sub.cost_text || null,
          sub.category_id ? `{${sub.category_id}}` : "{}",
        ]
      );
      await pool.query(
        `UPDATE venue_event_submissions SET converted_event_id = $1, status = 'converted', updated_at = NOW() WHERE id = $2`,
        [eventResult.rows[0].id, id]
      );
      res.json({ type: "event", event: eventResult.rows[0] });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

router.get("/api/owner/event-series", requireOwner, async (req: Request, res: Response) => {
  try {
    const ownerEntityId = (req.session as Record<string, string>).ownerEntityId;
    if (!ownerEntityId) {
      return res.status(403).json({ message: "No entity linked" });
    }

    const result = await pool.query(
      `SELECT es.*,
        (SELECT COUNT(*) FROM events e WHERE e.event_series_id = es.id) AS occurrence_count,
        (SELECT MIN(e.start_date_time) FROM events e WHERE e.event_series_id = es.id AND e.start_date_time > NOW() AND e.occurrence_status = 'scheduled') AS next_occurrence
      FROM event_series es
      WHERE es.host_presence_id = $1 OR es.venue_presence_id = $1
      ORDER BY es.created_at DESC`,
      [ownerEntityId]
    );
    res.json(result.rows);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

router.get("/api/owner/venue-submissions", requireOwner, async (req: Request, res: Response) => {
  try {
    const ownerEntityId = (req.session as Record<string, string>).ownerEntityId;
    if (!ownerEntityId) {
      return res.status(403).json({ message: "No entity linked" });
    }

    const result = await pool.query(
      `SELECT ves.*,
        b.name AS venue_name
      FROM venue_event_submissions ves
      JOIN businesses b ON b.id = ves.venue_presence_id
      WHERE ves.venue_presence_id = $1
      ORDER BY ves.created_at DESC`,
      [ownerEntityId]
    );
    res.json(result.rows);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

router.patch("/api/owner/venue-submissions/:id", requireOwner, async (req: Request, res: Response) => {
  try {
    const ownerEntityId = (req.session as Record<string, string>).ownerEntityId;
    const { id } = req.params;
    const { status, reviewNote } = req.body;

    if (!status || !["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Valid status required (approved or rejected)" });
    }

    const check = await pool.query(
      `SELECT id FROM venue_event_submissions WHERE id = $1 AND venue_presence_id = $2`,
      [id, ownerEntityId]
    );
    if (check.rows.length === 0) {
      return res.status(403).json({ message: "Not your venue submission" });
    }

    const result = await pool.query(
      `UPDATE venue_event_submissions SET status = $1, review_note = $2, reviewed_at = NOW(), updated_at = NOW() WHERE id = $3 RETURNING *`,
      [status, reviewNote || null, id]
    );
    res.json(result.rows[0]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

router.get("/api/owner/event-series/:seriesId/occurrences", requireOwner, async (req: Request, res: Response) => {
  try {
    const ownerEntityId = (req.session as Record<string, string>).ownerEntityId;
    const { seriesId } = req.params;

    const seriesCheck = await pool.query(
      `SELECT id FROM event_series WHERE id = $1 AND (host_presence_id = $2 OR venue_presence_id = $2)`,
      [seriesId, ownerEntityId]
    );
    if (seriesCheck.rows.length === 0) {
      return res.status(403).json({ message: "Not your series" });
    }

    const result = await pool.query(
      `SELECT e.*, 
        (SELECT COUNT(*) FROM event_rsvps r WHERE r.event_id = e.id AND r.response = 'attending') AS attending_count
      FROM events e WHERE e.event_series_id = $1 ORDER BY e.start_date_time ASC`,
      [seriesId]
    );
    res.json(result.rows);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

router.post("/api/owner/event-series", requireOwner, async (req: Request, res: Response) => {
  try {
    const ownerEntityId = (req.session as Record<string, string>).ownerEntityId;
    if (!ownerEntityId) {
      return res.status(403).json({ message: "No entity linked" });
    }

    const {
      title, titleEs, description, descriptionEs, imageUrl,
      venuePresenceId, hubId, cityId, citySlug, zoneId, categoryId,
      visibilityDefault, recurrenceType, recurrenceRuleJson,
      defaultStartTime, defaultEndTime, defaultDurationMinutes,
      defaultLocationName, defaultAddress, defaultCity, defaultState, defaultZip,
      defaultCostText, defaultMaxCapacity, defaultRsvpEnabled, status,
    } = req.body;

    if (!title) {
      return res.status(400).json({ message: "Title is required" });
    }

    if (venuePresenceId && venuePresenceId !== ownerEntityId) {
      const venueCheck = await pool.query(
        `SELECT id FROM businesses WHERE id = $1 AND (id = $2 OR owner_user_id = (SELECT owner_user_id FROM businesses WHERE id = $2))`,
        [venuePresenceId, ownerEntityId]
      );
      if (venueCheck.rows.length === 0) {
        return res.status(403).json({ message: "You do not control this venue. Submit through the venue's submission form instead." });
      }
    }

    let resolvedCityId = cityId;
    if (!resolvedCityId && citySlug) {
      const cityResult = await pool.query(`SELECT id FROM cities WHERE slug = $1 LIMIT 1`, [citySlug]);
      if (cityResult.rows.length > 0) {
        resolvedCityId = cityResult.rows[0].id;
      }
    }
    if (!resolvedCityId) {
      const bizResult = await pool.query(`SELECT city_id FROM businesses WHERE id = $1`, [ownerEntityId]);
      resolvedCityId = bizResult.rows[0]?.city_id;
    }
    if (!resolvedCityId) {
      return res.status(400).json({ message: "Could not determine city" });
    }

    const slug = generateSlug(title) + "-" + Date.now().toString(36);

    const result = await pool.query(
      `INSERT INTO event_series (
        title, title_es, slug, description, description_es, image_url,
        host_presence_id, venue_presence_id, hub_id, city_id, zone_id, category_id,
        visibility_default, recurrence_type, recurrence_rule_json,
        default_start_time, default_end_time, default_duration_minutes,
        default_location_name, default_address, default_city, default_state, default_zip,
        default_cost_text, default_max_capacity, default_rsvp_enabled, status,
        created_by_user_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28) RETURNING *`,
      [
        title, titleEs || null, slug, description || null, descriptionEs || null, imageUrl || null,
        ownerEntityId, venuePresenceId || null, hubId || null, resolvedCityId, zoneId || null, categoryId || null,
        visibilityDefault || "public", recurrenceType || "none", recurrenceRuleJson || null,
        defaultStartTime || null, defaultEndTime || null, defaultDurationMinutes || null,
        defaultLocationName || null, defaultAddress || null, defaultCity || null, defaultState || null, defaultZip || null,
        defaultCostText || null, defaultMaxCapacity || null, defaultRsvpEnabled || false, status || "draft",
        (req.session as any).ownerAccountId,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

router.post("/api/owner/event-series/:id/generate-occurrences", requireOwner, async (req: Request, res: Response) => {
  try {
    const ownerEntityId = (req.session as Record<string, string>).ownerEntityId;
    const { id } = req.params;
    const { count } = req.body;

    const seriesResult = await pool.query(
      `SELECT * FROM event_series WHERE id = $1 AND (host_presence_id = $2 OR venue_presence_id = $2)`,
      [id, ownerEntityId]
    );
    if (seriesResult.rows.length === 0) {
      return res.status(403).json({ message: "Not your series" });
    }
    const series = seriesResult.rows[0];

    if (series.recurrence_type === "none") {
      return res.status(400).json({ message: "Series has no recurrence rule" });
    }

    const dates = generateOccurrenceDates(series.recurrence_type, series.recurrence_rule_json, count || 8);
    if (dates.length === 0) {
      return res.status(400).json({ message: "No dates generated — check recurrence rule" });
    }

    const existingResult = await pool.query(
      `SELECT start_date_time FROM events WHERE event_series_id = $1`,
      [id]
    );
    const existingDates = new Set(
      existingResult.rows.map((r: any) => new Date(r.start_date_time).toISOString().split("T")[0])
    );

    const created: any[] = [];
    let occIndex = existingResult.rows.length;

    for (const date of dates) {
      const dateKey = date.toISOString().split("T")[0];
      if (existingDates.has(dateKey)) continue;

      occIndex++;
      const endDate = series.default_duration_minutes
        ? new Date(date.getTime() + series.default_duration_minutes * 60000)
        : null;

      const occSlug = `${series.slug}-${dateKey}`;

      const result = await pool.query(
        `INSERT INTO events (
          city_id, zone_id, title, title_es, slug, description, description_es,
          start_date_time, end_date_time, location_name, address, city, state, zip,
          cost_text, image_url, host_business_id, venue_presence_id,
          visibility, max_capacity, rsvp_enabled,
          event_series_id, occurrence_status, occurrence_index, venue_name,
          category_ids, tag_ids
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27) RETURNING *`,
        [
          series.city_id, series.zone_id || null,
          series.title, series.title_es || null,
          occSlug, series.description || null, series.description_es || null,
          date, endDate,
          series.default_location_name || null, series.default_address || null,
          series.default_city || null, series.default_state || null, series.default_zip || null,
          series.default_cost_text || null, series.image_url || null,
          series.host_presence_id || null, series.venue_presence_id || null,
          series.visibility_default || "public",
          series.default_max_capacity || null,
          series.default_rsvp_enabled || false,
          id, "scheduled", occIndex,
          series.default_location_name || null,
          series.category_id ? `{${series.category_id}}` : "{}",
          "{}",
        ]
      );
      created.push(result.rows[0]);
    }

    res.status(201).json({ generated: created.length, occurrences: created });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

router.patch("/api/owner/event-series/:id", requireOwner, async (req: Request, res: Response) => {
  try {
    const ownerEntityId = (req.session as Record<string, string>).ownerEntityId;
    const { id } = req.params;

    const seriesCheck = await pool.query(
      `SELECT id FROM event_series WHERE id = $1 AND (host_presence_id = $2 OR venue_presence_id = $2)`,
      [id, ownerEntityId]
    );
    if (seriesCheck.rows.length === 0) {
      return res.status(403).json({ message: "Not your series" });
    }

    const fields = req.body;

    if (fields.venuePresenceId && fields.venuePresenceId !== ownerEntityId) {
      const venueCheck = await pool.query(
        `SELECT id FROM businesses WHERE id = $1 AND (id = $2 OR owner_user_id = (SELECT owner_user_id FROM businesses WHERE id = $2))`,
        [fields.venuePresenceId, ownerEntityId]
      );
      if (venueCheck.rows.length === 0) {
        return res.status(403).json({ message: "You do not control this venue" });
      }
    }

    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;

    const allowedFields: Record<string, string> = {
      title: "title", titleEs: "title_es", description: "description",
      descriptionEs: "description_es", imageUrl: "image_url",
      venuePresenceId: "venue_presence_id",
      visibilityDefault: "visibility_default", recurrenceType: "recurrence_type",
      recurrenceRuleJson: "recurrence_rule_json",
      defaultStartTime: "default_start_time", defaultEndTime: "default_end_time",
      defaultDurationMinutes: "default_duration_minutes",
      defaultLocationName: "default_location_name", defaultAddress: "default_address",
      defaultCity: "default_city", defaultState: "default_state", defaultZip: "default_zip",
      defaultCostText: "default_cost_text", defaultMaxCapacity: "default_max_capacity",
      defaultRsvpEnabled: "default_rsvp_enabled", status: "status",
    };

    for (const [key, col] of Object.entries(allowedFields)) {
      if (fields[key] !== undefined) {
        setClauses.push(`${col} = $${idx}`);
        values.push(fields[key]);
        idx++;
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE event_series SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Series not found" });
    }
    res.json(result.rows[0]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

router.patch("/api/owner/event-series/:seriesId/occurrences/:eventId", requireOwner, async (req: Request, res: Response) => {
  try {
    const ownerEntityId = (req.session as Record<string, string>).ownerEntityId;
    const { seriesId, eventId } = req.params;
    const { occurrenceStatus } = req.body;

    const seriesCheck = await pool.query(
      `SELECT id FROM event_series WHERE id = $1 AND (host_presence_id = $2 OR venue_presence_id = $2)`,
      [seriesId, ownerEntityId]
    );
    if (seriesCheck.rows.length === 0) {
      return res.status(403).json({ message: "Not your series" });
    }

    if (!occurrenceStatus || !["scheduled", "skipped", "cancelled"].includes(occurrenceStatus)) {
      return res.status(400).json({ message: "Valid occurrenceStatus required" });
    }

    const result = await pool.query(
      `UPDATE events SET occurrence_status = $1, updated_at = NOW() WHERE id = $2 AND event_series_id = $3 RETURNING *`,
      [occurrenceStatus, eventId, seriesId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Occurrence not found" });
    }
    res.json(result.rows[0]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

router.patch("/api/owner/event-series/:seriesId/occurrences/:eventId/details", requireOwner, async (req: Request, res: Response) => {
  try {
    const ownerEntityId = (req.session as Record<string, string>).ownerEntityId;
    const { seriesId, eventId } = req.params;
    const fields = req.body;

    const seriesCheck = await pool.query(
      `SELECT id FROM event_series WHERE id = $1 AND (host_presence_id = $2 OR venue_presence_id = $2)`,
      [seriesId, ownerEntityId]
    );
    if (seriesCheck.rows.length === 0) {
      return res.status(403).json({ message: "Not your series" });
    }

    const occCheck = await pool.query(
      `SELECT id FROM events WHERE id = $1 AND event_series_id = $2`,
      [eventId, seriesId]
    );
    if (occCheck.rows.length === 0) {
      return res.status(404).json({ message: "Occurrence not found in this series" });
    }

    const allowedFields: Record<string, string> = {
      title: "title", description: "description",
      startDateTime: "start_date_time", endDateTime: "end_date_time",
      locationName: "location_name", address: "address",
      costText: "cost_text", imageUrl: "image_url",
      maxCapacity: "max_capacity", venueName: "venue_name",
      pulseReminderEnabled: "pulse_reminder_enabled",
    };

    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [key, col] of Object.entries(allowedFields)) {
      if (fields[key] !== undefined) {
        setClauses.push(`${col} = $${idx}`);
        values.push(fields[key]);
        idx++;
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(eventId);

    const result = await pool.query(
      `UPDATE events SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );
    res.json(result.rows[0]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

router.post("/api/owner/venue-submissions/:id/convert", requireOwner, async (req: Request, res: Response) => {
  try {
    const ownerEntityId = (req.session as Record<string, string>).ownerEntityId;
    const { id } = req.params;
    const { convertToSeries } = req.body;

    const subResult = await pool.query(
      `SELECT * FROM venue_event_submissions WHERE id = $1 AND venue_presence_id = $2`,
      [id, ownerEntityId]
    );
    if (subResult.rows.length === 0) {
      return res.status(403).json({ message: "Not your venue submission" });
    }
    const sub = subResult.rows[0];

    if (sub.status === "converted") {
      return res.status(400).json({ message: "Submission already converted" });
    }
    if (sub.status !== "approved") {
      return res.status(400).json({ message: "Submission must be approved first" });
    }

    const slug = generateSlug(sub.title) + "-" + Date.now().toString(36);

    if (convertToSeries) {
      const seriesResult = await pool.query(
        `INSERT INTO event_series (
          title, slug, description, image_url,
          host_presence_id, venue_presence_id, city_id, category_id,
          default_cost_text, status, created_by_user_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',$10) RETURNING *`,
        [
          sub.title, slug, sub.description || null, sub.image_url || null,
          sub.submitter_presence_id || null, sub.venue_presence_id,
          sub.city_id, sub.category_id || null,
          sub.cost_text || null, (req.session as any).ownerAccountId,
        ]
      );
      await pool.query(
        `UPDATE venue_event_submissions SET converted_series_id = $1, status = 'converted', updated_at = NOW() WHERE id = $2`,
        [seriesResult.rows[0].id, id]
      );
      res.json({ type: "series", series: seriesResult.rows[0] });
    } else {
      const zoneResult = await pool.query(
        `SELECT zone_id FROM businesses WHERE id = $1`,
        [sub.venue_presence_id]
      );
      const zoneId = zoneResult.rows[0]?.zone_id || null;

      const eventResult = await pool.query(
        `INSERT INTO events (
          city_id, zone_id, title, slug, description, image_url,
          start_date_time, end_date_time,
          host_business_id, venue_presence_id, cost_text,
          visibility, category_ids, tag_ids
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'public',$12,'{}') RETURNING *`,
        [
          sub.city_id, zoneId, sub.title, slug, sub.description || null, sub.image_url || null,
          sub.proposed_start_date_time || new Date(), sub.proposed_end_date_time || null,
          sub.submitter_presence_id || null, sub.venue_presence_id,
          sub.cost_text || null,
          sub.category_id ? `{${sub.category_id}}` : "{}",
        ]
      );
      await pool.query(
        `UPDATE venue_event_submissions SET converted_event_id = $1, status = 'converted', updated_at = NOW() WHERE id = $2`,
        [eventResult.rows[0].id, id]
      );
      res.json({ type: "event", event: eventResult.rows[0] });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

router.post("/api/owner/event-series/:id/pulse-announce", requireOwner, async (req: Request, res: Response) => {
  try {
    const ownerEntityId = (req.session as Record<string, string>).ownerEntityId;
    const { id } = req.params;

    const seriesResult = await pool.query(
      `SELECT * FROM event_series WHERE id = $1 AND (host_presence_id = $2 OR venue_presence_id = $2)`,
      [id, ownerEntityId]
    );
    if (seriesResult.rows.length === 0) {
      return res.status(403).json({ message: "Not your series" });
    }
    const series = seriesResult.rows[0];

    const nextOcc = await pool.query(
      `SELECT start_date_time FROM events WHERE event_series_id = $1 AND start_date_time > NOW() AND occurrence_status = 'scheduled' ORDER BY start_date_time ASC LIMIT 1`,
      [id]
    );

    const nextDate = nextOcc.rows.length > 0
      ? new Date(nextOcc.rows[0].start_date_time).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
      : null;

    const body = nextDate
      ? `${series.description || series.title}. Next date: ${nextDate}`
      : series.description || series.title;

    try {
      const postResult = await pool.query(
        `INSERT INTO posts (
          title, body, city_id, status, media_type, post_type,
          published_at, business_id
        ) VALUES ($1, $2, $3, 'published', 'image', 'standard', NOW(), $4) RETURNING id`,
        [
          `📅 ${series.title}`,
          body,
          series.city_id,
          series.host_presence_id || series.venue_presence_id || null,
        ]
      );

      await pool.query(
        `UPDATE event_series SET pulse_announcement_post_id = $1, updated_at = NOW() WHERE id = $2`,
        [postResult.rows[0].id, id]
      );

      res.json({ success: true, postId: postResult.rows[0].id });
    } catch (postErr) {
      res.json({ success: true, message: "Pulse post table not available — series marked" });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

router.get("/api/venues/:venueId/events", async (req: Request, res: Response) => {
  try {
    const { venueId } = req.params;
    const includeArchived = req.query.includeArchived === "true";

    let query = `SELECT e.*, 
      es.title AS series_title, es.slug AS series_slug, es.recurrence_type
    FROM events e
    LEFT JOIN event_series es ON es.id = e.event_series_id
    WHERE (e.venue_presence_id = $1 OR e.host_business_id = $1)
      AND e.visibility = 'public'`;
    const params: any[] = [venueId];

    if (!includeArchived) {
      query += ` AND (e.start_date_time >= NOW() OR e.start_date_time >= NOW() - INTERVAL '30 days')`;
    }

    query += ` ORDER BY e.start_date_time ASC LIMIT 200`;

    const result = await pool.query(query, params);

    const seriesResult = await pool.query(
      `SELECT es.*,
        (SELECT MIN(e.start_date_time) FROM events e WHERE e.event_series_id = es.id AND e.start_date_time > NOW() AND e.occurrence_status = 'scheduled') AS next_occurrence,
        (SELECT COUNT(*) FROM events e WHERE e.event_series_id = es.id) AS occurrence_count
      FROM event_series es
      WHERE (es.venue_presence_id = $1 OR es.host_presence_id = $1)
        AND es.status = 'active'
      ORDER BY next_occurrence ASC NULLS LAST`,
      [venueId]
    );

    const now = new Date();
    const events = result.rows;
    const upcoming = events.filter((e: any) => new Date(e.start_date_time) >= now && e.occurrence_status !== "cancelled");
    const past = events.filter((e: any) => new Date(e.start_date_time) < now);

    res.json({
      upcoming,
      past,
      series: seriesResult.rows,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

router.post("/api/admin/event-series/:id/pulse-announce", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const seriesResult = await pool.query(`SELECT * FROM event_series WHERE id = $1`, [id]);
    if (seriesResult.rows.length === 0) {
      return res.status(404).json({ message: "Series not found" });
    }
    const series = seriesResult.rows[0];

    const nextOcc = await pool.query(
      `SELECT start_date_time FROM events WHERE event_series_id = $1 AND start_date_time > NOW() AND occurrence_status = 'scheduled' ORDER BY start_date_time ASC LIMIT 1`,
      [id]
    );

    const nextDate = nextOcc.rows.length > 0
      ? new Date(nextOcc.rows[0].start_date_time).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
      : null;

    const body = nextDate
      ? `${series.description || series.title}. Next date: ${nextDate}`
      : series.description || series.title;

    try {
      const postResult = await pool.query(
        `INSERT INTO posts (
          title, body, city_id, status, media_type, post_type,
          published_at, business_id
        ) VALUES ($1, $2, $3, 'published', 'image', 'standard', NOW(), $4) RETURNING id`,
        [
          `📅 ${series.title}`,
          body,
          series.city_id,
          series.host_presence_id || series.venue_presence_id || null,
        ]
      );

      await pool.query(
        `UPDATE event_series SET pulse_announcement_post_id = $1, updated_at = NOW() WHERE id = $2`,
        [postResult.rows[0].id, id]
      );

      res.json({ success: true, postId: postResult.rows[0].id });
    } catch (postErr) {
      res.json({ success: true, message: "Pulse post table not available — series marked" });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

export default router;
