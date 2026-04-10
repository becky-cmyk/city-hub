import type { Express, Request, Response, NextFunction } from "express";
import { pool } from "./db";
import { db } from "./db";
import { storage } from "./storage";
import { eq, and, asc, desc, sql, inArray } from "drizzle-orm";
import { events, eventCollections, eventCollectionItems, categories } from "@shared/schema";

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!(req.session as Record<string, unknown>).userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

async function resolveCity(citySlug: string) {
  const CITY_SLUG_ALIASES: Record<string, string> = { clt: "charlotte" };
  const resolved = CITY_SLUG_ALIASES[citySlug] || citySlug;
  return storage.getCityBySlug(resolved);
}

export function registerEventDiscoveryRoutes(app: Express) {
  app.get("/api/cities/:citySlug/events/discover", async (req: Request, res: Response) => {
    try {
      const city = await resolveCity(req.params.citySlug);
      if (!city) return res.status(404).json({ message: "City not found" });

      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize as string) || 20));
      const sort = (req.query.sort as string) || "soonest";
      const zoneSlug = req.query.zone as string;
      const categorySlug = req.query.category as string;
      const costFilter = req.query.cost as string;
      const q = (req.query.q as string || "").trim();
      const dateFrom = req.query.dateFrom as string;
      const dateTo = req.query.dateTo as string;
      const recurringOnly = req.query.recurring as string;

      const now = new Date();
      let whereClause = `WHERE e.city_id = $1 AND COALESCE(e.visibility, 'public') = 'public' AND COALESCE(e.end_date_time, e.start_date_time + interval '3 hours') > $2`;
      const params: (string | number | Date)[] = [city.id, now];

      whereClause += ` AND COALESCE(e.location_name, '') != ''`;
      whereClause += ` AND COALESCE(e.seed_source_type, '') NOT IN ('ESPN', 'espn', 'SportsService', 'sports')`;

      if (zoneSlug && zoneSlug !== "all") {
        const zone = await storage.getZoneBySlug(city.id, zoneSlug);
        if (zone) {
          params.push(zone.id);
          whereClause += ` AND e.zone_id = $${params.length}`;
        }
      }

      if (categorySlug && categorySlug !== "all") {
        const cat = await storage.getCategoryBySlug(categorySlug);
        if (cat) {
          params.push(cat.id);
          whereClause += ` AND $${params.length} = ANY(e.category_ids)`;
        }
      }

      if (costFilter === "free") {
        whereClause += ` AND (LOWER(e.cost_text) LIKE '%free%' OR e.cost_text IS NULL OR e.cost_text = '')`;
      } else if (costFilter === "paid") {
        whereClause += ` AND e.cost_text IS NOT NULL AND e.cost_text != '' AND LOWER(e.cost_text) NOT LIKE '%free%'`;
      }

      if (recurringOnly === "true") {
        whereClause += ` AND e.recurring_rule IS NOT NULL AND e.recurring_rule != ''`;
      }

      if (q) {
        params.push(`%${q}%`);
        whereClause += ` AND (e.title ILIKE $${params.length} OR e.description ILIKE $${params.length})`;
      }

      if (dateFrom) {
        params.push(new Date(dateFrom));
        whereClause += ` AND e.start_date_time >= $${params.length}`;
      }

      if (dateTo) {
        params.push(new Date(dateTo));
        whereClause += ` AND e.start_date_time <= $${params.length}`;
      }

      let orderBy = "ORDER BY e.start_date_time ASC";
      if (sort === "trending") {
        orderBy = "ORDER BY e.is_featured DESC, e.priority_rank DESC, e.start_date_time ASC";
      } else if (sort === "recent") {
        orderBy = "ORDER BY e.created_at DESC";
      }

      const countResult = await pool.query(`SELECT COUNT(*) AS total FROM events e ${whereClause}`, params);
      const total = parseInt(countResult.rows[0].total);

      const offset = (page - 1) * pageSize;
      const result = await pool.query(
        `SELECT e.* FROM events e ${whereClause} ${orderBy} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, pageSize, offset]
      );

      res.json({
        events: result.rows,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      });
    } catch (err: unknown) {
      console.error("[EVENT-DISCOVER]", err);
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  app.get("/api/cities/:citySlug/events/tonight", async (req: Request, res: Response) => {
    try {
      const city = await resolveCity(req.params.citySlug);
      if (!city) return res.status(404).json({ message: "City not found" });

      const now = new Date();
      const today4pm = new Date(now);
      today4pm.setHours(16, 0, 0, 0);
      const todayMidnight = new Date(now);
      todayMidnight.setDate(todayMidnight.getDate() + 1);
      todayMidnight.setHours(0, 0, 0, 0);

      const result = await pool.query(
        `SELECT * FROM events
         WHERE city_id = $1
         AND COALESCE(visibility, 'public') = 'public'
         AND start_date_time >= $2
         AND start_date_time < $3
         AND COALESCE(location_name, '') != ''
         AND COALESCE(seed_source_type, '') NOT IN ('ESPN', 'espn', 'SportsService', 'sports')
         ORDER BY start_date_time ASC`,
        [city.id, today4pm, todayMidnight]
      );

      res.json(result.rows);
    } catch (err: unknown) {
      console.error("[EVENT-TONIGHT]", err);
      res.status(500).json({ message: "Failed to fetch tonight's events" });
    }
  });

  app.get("/api/cities/:citySlug/events/weekend", async (req: Request, res: Response) => {
    try {
      const city = await resolveCity(req.params.citySlug);
      if (!city) return res.status(404).json({ message: "City not found" });

      const now = new Date();
      const dayOfWeek = now.getDay();
      const daysToFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : (dayOfWeek === 6 ? 6 : 0);

      const friday4pm = new Date(now);
      if (dayOfWeek === 0) {
        friday4pm.setDate(now.getDate() - 2);
      } else if (dayOfWeek === 6) {
        friday4pm.setDate(now.getDate() - 1);
      } else {
        friday4pm.setDate(now.getDate() + daysToFriday);
      }
      friday4pm.setHours(16, 0, 0, 0);

      const sundayMidnight = new Date(friday4pm);
      if (dayOfWeek === 0) {
        sundayMidnight.setDate(friday4pm.getDate() + 2);
      } else {
        sundayMidnight.setDate(friday4pm.getDate() + 2);
      }
      sundayMidnight.setHours(23, 59, 59, 999);

      const startFilter = now > friday4pm ? now : friday4pm;

      const result = await pool.query(
        `SELECT * FROM events
         WHERE city_id = $1
         AND COALESCE(visibility, 'public') = 'public'
         AND start_date_time >= $2
         AND start_date_time <= $3
         AND COALESCE(location_name, '') != ''
         AND COALESCE(seed_source_type, '') NOT IN ('ESPN', 'espn', 'SportsService', 'sports')
         ORDER BY start_date_time ASC`,
        [city.id, startFilter, sundayMidnight]
      );

      res.json(result.rows);
    } catch (err: unknown) {
      console.error("[EVENT-WEEKEND]", err);
      res.status(500).json({ message: "Failed to fetch weekend events" });
    }
  });

  app.get("/api/cities/:citySlug/events/category/:categorySlug", async (req: Request, res: Response) => {
    try {
      const city = await resolveCity(req.params.citySlug);
      if (!city) return res.status(404).json({ message: "City not found" });

      const cat = await storage.getCategoryBySlug(req.params.categorySlug);
      if (!cat) return res.status(404).json({ message: "Category not found" });

      const now = new Date();
      const result = await pool.query(
        `SELECT * FROM events
         WHERE city_id = $1
         AND COALESCE(visibility, 'public') = 'public'
         AND $2 = ANY(category_ids)
         AND COALESCE(end_date_time, start_date_time + interval '3 hours') > $3
         AND COALESCE(location_name, '') != ''
         AND COALESCE(seed_source_type, '') NOT IN ('ESPN', 'espn', 'SportsService', 'sports')
         ORDER BY start_date_time ASC`,
        [city.id, cat.id, now]
      );

      res.json({ category: cat, events: result.rows });
    } catch (err: unknown) {
      console.error("[EVENT-CATEGORY]", err);
      res.status(500).json({ message: "Failed to fetch category events" });
    }
  });

  app.get("/api/cities/:citySlug/events/map", async (req: Request, res: Response) => {
    try {
      const city = await resolveCity(req.params.citySlug);
      if (!city) return res.status(404).json({ message: "City not found" });

      const now = new Date();
      const result = await pool.query(
        `SELECT e.id, e.title, e.slug, e.start_date_time, e.end_date_time, e.location_name, e.address, e.cost_text, e.image_url, e.is_featured,
                b.latitude, b.longitude, b.name AS host_business_name
         FROM events e
         LEFT JOIN businesses b ON e.host_business_id = b.id
         WHERE e.city_id = $1
         AND COALESCE(e.visibility, 'public') = 'public'
         AND COALESCE(e.end_date_time, e.start_date_time + interval '3 hours') > $2
         AND COALESCE(e.location_name, '') != ''
         AND COALESCE(e.seed_source_type, '') NOT IN ('ESPN', 'espn', 'SportsService', 'sports')
         AND b.latitude IS NOT NULL AND b.longitude IS NOT NULL
         ORDER BY e.start_date_time ASC
         LIMIT 200`,
        [city.id, now]
      );

      res.json(result.rows);
    } catch (err: unknown) {
      console.error("[EVENT-MAP]", err);
      res.status(500).json({ message: "Failed to fetch map events" });
    }
  });

  app.get("/api/cities/:citySlug/events/calendar", async (req: Request, res: Response) => {
    try {
      const city = await resolveCity(req.params.citySlug);
      if (!city) return res.status(404).json({ message: "City not found" });

      const month = parseInt(req.query.month as string) || (new Date().getMonth() + 1);
      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      const categorySlug = (req.query.category as string) || "";

      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

      let categoryFilter = "";
      const params: (string | Date | string[])[] = [city.id, startOfMonth, endOfMonth];
      if (categorySlug) {
        const catResult = await pool.query<{ id: string }>(
          `SELECT id FROM categories WHERE slug = $1
           UNION ALL
           SELECT id FROM categories WHERE parent_category_id IN (SELECT id FROM categories WHERE slug = $1)`,
          [categorySlug]
        );
        const catIds = catResult.rows.map(r => r.id);
        if (catIds.length > 0) {
          params.push(catIds);
          categoryFilter = ` AND category_ids && $${params.length}::text[]`;
        }
      }

      const result = await pool.query(
        `SELECT id, title, slug, start_date_time, end_date_time, location_name, cost_text, is_featured, recurring_rule
         FROM events
         WHERE city_id = $1
         AND COALESCE(visibility, 'public') = 'public'
         AND (
           (start_date_time >= $2 AND start_date_time <= $3)
           OR (recurring_rule IS NOT NULL AND recurring_rule != '' AND start_date_time <= $3)
         )
         AND COALESCE(location_name, '') != ''
         AND COALESCE(seed_source_type, '') NOT IN ('ESPN', 'espn', 'SportsService', 'sports')
         ${categoryFilter}
         ORDER BY start_date_time ASC`,
        params
      );

      interface CalendarEvent {
        id: string;
        title: string;
        slug: string;
        start_date_time: string;
        end_date_time: string | null;
        location_name: string | null;
        cost_text: string | null;
        is_featured: boolean;
        recurring_rule: string | null;
        _occurrence?: boolean;
        _source?: string;
      }
      const expanded: CalendarEvent[] = [];
      for (const row of result.rows) {
        const eventStart = new Date(row.start_date_time);
        if (!row.recurring_rule || eventStart >= startOfMonth) {
          if (eventStart >= startOfMonth && eventStart <= endOfMonth) {
            expanded.push(row);
          }
        } else {
          const rule = (row.recurring_rule || "").toLowerCase().trim();
          let intervalDays = 0;
          if (rule === "weekly" || rule.includes("freq=weekly")) intervalDays = 7;
          else if (rule === "biweekly" || rule.includes("freq=biweekly")) intervalDays = 14;
          else if (rule === "daily" || rule.includes("freq=daily")) intervalDays = 1;
          else if (rule === "monthly" || rule.includes("freq=monthly")) {
            let occ = new Date(eventStart);
            while (occ <= endOfMonth) {
              if (occ >= startOfMonth && occ <= endOfMonth) {
                expanded.push({ ...row, start_date_time: occ.toISOString(), _occurrence: true });
              }
              occ = new Date(occ);
              occ.setMonth(occ.getMonth() + 1);
            }
            continue;
          }

          if (intervalDays > 0) {
            let occ = new Date(eventStart);
            while (occ <= endOfMonth) {
              if (occ >= startOfMonth && occ <= endOfMonth) {
                expanded.push({ ...row, start_date_time: occ.toISOString(), _occurrence: true });
              }
              occ = new Date(occ.getTime() + intervalDays * 24 * 60 * 60 * 1000);
            }
          } else {
            if (eventStart >= startOfMonth && eventStart <= endOfMonth) {
              expanded.push(row);
            }
          }
        }
      }

      const includeRssEvents = req.query.includeShows !== "false" && !categorySlug;
      if (includeRssEvents) {
        try {
          const rssEvtResult = await pool.query(
            `SELECT ri.id, ri.title, ri.local_article_slug as slug, ri.published_at as start_date_time,
                    ri.image_url, ri.source_name, ms.name as source_label
             FROM rss_items ri
             JOIN metro_sources ms ON ri.metro_source_id = ms.id
             WHERE ri.city_id = $1 AND ms.is_event_source = true
               AND ri.review_status = 'APPROVED'
               AND ri.published_at >= $2 AND ri.published_at <= $3
             ORDER BY ri.published_at ASC`,
            [city.id, startOfMonth, endOfMonth]
          );
          for (const row of rssEvtResult.rows) {
            expanded.push({
              id: row.id,
              title: row.title,
              slug: row.slug || row.id,
              start_date_time: row.start_date_time,
              end_date_time: null,
              location_name: row.source_label || row.source_name,
              cost_text: null,
              is_featured: false,
              recurring_rule: null,
              _source: "rss_event",
            });
          }
        } catch (rssErr: unknown) {
          console.error("[EVENT-CALENDAR] RSS event merge failed:", rssErr);
        }
      }

      expanded.sort((a, b) => new Date(a.start_date_time).getTime() - new Date(b.start_date_time).getTime());
      res.json(expanded);
    } catch (err: unknown) {
      console.error("[EVENT-CALENDAR]", err);
      res.status(500).json({ message: "Failed to fetch calendar events" });
    }
  });

  const CIVIC_TITLE_PATTERNS = [
    /\bcouncil\b/i, /\bcommission\b/i, /\bcommittee\b/i, /\bbudget\b/i,
    /\bboard meeting\b/i, /\bpublic hearing\b/i, /\btown hall\b/i,
    /\bplanning board\b/i, /\bzoning\b/i, /\bcity manager\b/i,
    /\bgovernment\b/i, /\bordinance\b/i, /\bcouncilmember\b/i,
    /\bwork session\b/i, /\bcaucus\b/i, /\bpublic forum\b/i,
  ];

  function isCivicEvent(title: string): boolean {
    return CIVIC_TITLE_PATTERNS.some(p => p.test(title));
  }

  app.get("/api/cities/:citySlug/events/curated", async (req: Request, res: Response) => {
    try {
      const city = await resolveCity(req.params.citySlug);
      if (!city) return res.status(404).json({ message: "City not found" });

      const now = new Date();
      const baseWhere = `WHERE e.city_id = $1 AND COALESCE(e.visibility, 'public') = 'public'
        AND COALESCE(e.end_date_time, e.start_date_time + interval '3 hours') > $2
        AND COALESCE(e.location_name, '') != ''
        AND COALESCE(e.seed_source_type, '') NOT IN ('ESPN', 'espn', 'SportsService', 'sports')`;

      const today4pm = new Date(now);
      today4pm.setHours(16, 0, 0, 0);
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);

      const dayOfWeek = now.getDay();
      const friday4pm = new Date(now);
      if (dayOfWeek === 0) friday4pm.setDate(now.getDate() + 5);
      else if (dayOfWeek === 6) friday4pm.setDate(now.getDate() + 6);
      else friday4pm.setDate(now.getDate() + (5 - dayOfWeek));
      friday4pm.setHours(16, 0, 0, 0);
      const sundayEnd = new Date(friday4pm);
      sundayEnd.setDate(friday4pm.getDate() + 2);
      sundayEnd.setHours(23, 59, 59, 999);

      const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;
      const weekendStart = isWeekend ? now : friday4pm;

      const tonightResult = await pool.query(
        `SELECT e.* FROM events e ${baseWhere} AND e.start_date_time >= $3 AND e.start_date_time <= $4 ORDER BY e.is_featured DESC, e.priority_rank DESC, e.start_date_time ASC LIMIT 12`,
        [city.id, now, today4pm, todayEnd]
      );

      const weekendResult = await pool.query(
        `SELECT e.* FROM events e ${baseWhere} AND e.start_date_time >= $3 AND e.start_date_time <= $4 ORDER BY e.is_featured DESC, e.priority_rank DESC, e.start_date_time ASC LIMIT 12`,
        [city.id, now, weekendStart, sundayEnd]
      );

      let featuredResult = await pool.query(
        `SELECT e.* FROM events e ${baseWhere} AND (e.is_featured = true OR e.is_sponsored = true OR e.image_url IS NOT NULL)
         ORDER BY e.is_sponsored DESC, e.is_featured DESC, e.priority_rank DESC, e.start_date_time ASC LIMIT 20`,
        [city.id, now]
      );
      if (featuredResult.rows.length < 6) {
        featuredResult = await pool.query(
          `SELECT e.* FROM events e ${baseWhere}
           ORDER BY e.is_featured DESC, e.priority_rank DESC, e.start_date_time ASC LIMIT 20`,
          [city.id, now]
        );
      }

      const categoriesResult = await pool.query(
        `SELECT c.id, c.name, c.slug, c.icon, COUNT(e.id)::int as event_count
         FROM categories c
         JOIN events e ON c.id = ANY(e.category_ids)
         WHERE e.city_id = $1 AND COALESCE(e.visibility, 'public') = 'public'
           AND COALESCE(e.end_date_time, e.start_date_time + interval '3 hours') > $2
           AND COALESCE(e.location_name, '') != ''
         GROUP BY c.id, c.name, c.slug, c.icon
         HAVING COUNT(e.id) > 0
         ORDER BY event_count DESC LIMIT 12`,
        [city.id, now]
      );

      const countResult = await pool.query(
        `SELECT COUNT(*)::int as total FROM events e ${baseWhere}`,
        [city.id, now]
      );

      let showsAndPerformances: Record<string, unknown>[] = [];
      try {
        const rssEvtResult = await pool.query(
          `SELECT ri.id, ri.title, ri.local_article_slug as slug, ri.published_at,
                  ri.image_url, ri.source_name, ms.name as source_label
           FROM rss_items ri
           JOIN metro_sources ms ON ri.metro_source_id = ms.id
           WHERE ri.city_id = $1 AND ms.is_event_source = true
             AND ri.review_status = 'APPROVED'
             AND ri.published_at > $2
           ORDER BY ri.published_at ASC LIMIT 20`,
          [city.id, now]
        );
        showsAndPerformances = rssEvtResult.rows.map((r: Record<string, unknown>) => ({
          ...r,
          start_date_time: r.published_at,
          location_name: r.source_label || r.source_name,
          _source: "rss_event",
        }));
      } catch (rssErr: unknown) {
        console.error("[EVENT-CURATED] RSS shows merge failed:", rssErr);
      }

      const filterCivic = (rows: Record<string, unknown>[]) =>
        rows.filter(r => !isCivicEvent(String(r.title || "")));

      res.json({
        tonight: filterCivic(tonightResult.rows),
        weekend: filterCivic(weekendResult.rows),
        featured: filterCivic(featuredResult.rows).slice(0, 12),
        shows: showsAndPerformances,
        categories: categoriesResult.rows,
        totalUpcoming: countResult.rows[0]?.total || 0,
      });
    } catch (err: unknown) {
      console.error("[EVENT-CURATED]", err);
      res.status(500).json({ message: "Failed to fetch curated events" });
    }
  });

  app.get("/api/cities/:citySlug/events/:eventSlug/story", async (req: Request, res: Response) => {
    try {
      const city = await resolveCity(req.params.citySlug);
      if (!city) return res.status(404).json({ message: "City not found" });

      const result = await pool.query(
        `SELECT ri.id, ri.title, ri.local_article_slug, ri.rewritten_summary, ri.image_url, ri.source_name
         FROM rss_items ri
         JOIN metro_sources ms ON ri.metro_source_id = ms.id
         WHERE ri.city_id = $1 AND ms.is_event_source = true AND ri.review_status = 'APPROVED'
           AND ri.local_article_body IS NOT NULL
           AND (ri.title ILIKE '%' || $2 || '%' OR $2 ILIKE '%' || LEFT(ri.title, 30) || '%')
         LIMIT 1`,
        [city.id, req.params.eventSlug.replace(/-/g, ' ')]
      );

      if (result.rows.length === 0) return res.json(null);
      res.json(result.rows[0]);
    } catch (err: unknown) {
      console.error("[EVENT-STORY]", err);
      res.status(500).json({ message: "Failed to fetch event story" });
    }
  });

  app.get("/api/cities/:citySlug/events/stories", async (req: Request, res: Response) => {
    try {
      const city = await resolveCity(req.params.citySlug);
      if (!city) return res.status(404).json({ message: "City not found" });

      const result = await pool.query(
        `SELECT ri.id, ri.title, ri.local_article_slug, ri.rewritten_summary, ri.image_url, ri.source_name, ri.published_at
         FROM rss_items ri
         JOIN metro_sources ms ON ri.metro_source_id = ms.id
         WHERE ri.city_id = $1 AND ms.is_event_source = true AND ri.review_status = 'APPROVED'
           AND ri.local_article_body IS NOT NULL
         ORDER BY ri.published_at DESC
         LIMIT 20`,
        [city.id]
      );

      res.json(result.rows);
    } catch (err: unknown) {
      console.error("[EVENT-STORIES]", err);
      res.status(500).json({ message: "Failed to fetch event stories" });
    }
  });

  app.get("/api/cities/:citySlug/event-collections", async (req: Request, res: Response) => {
    try {
      const city = await resolveCity(req.params.citySlug);
      if (!city) return res.status(404).json({ message: "City not found" });

      const now = new Date();
      const collections = await pool.query(
        `SELECT ec.*, 
          (SELECT json_agg(row_to_json(sub) ORDER BY sub.sort_order)
           FROM (
             SELECT eci.sort_order, ev.id, ev.title, ev.slug, ev.start_date_time, ev.end_date_time, ev.location_name, ev.cost_text, ev.image_url, ev.is_featured, ev.description
             FROM event_collection_items eci
             JOIN events ev ON ev.id = eci.event_id
             WHERE eci.collection_id = ec.id
             AND COALESCE(ev.visibility, 'public') = 'public'
             AND COALESCE(ev.end_date_time, ev.start_date_time + interval '3 hours') > $2
             AND COALESCE(ev.seed_source_type, '') NOT IN ('ESPN', 'espn', 'SportsService', 'sports')
           ) sub
          ) AS events
         FROM event_collections ec
         WHERE ec.city_id = $1 AND ec.is_active = true
         ORDER BY ec.sort_order ASC`,
        [city.id, now]
      );

      const result = collections.rows.filter((c: Record<string, unknown>) => c.events && Array.isArray(c.events) && (c.events as unknown[]).length > 0);
      res.json(result);
    } catch (err: unknown) {
      console.error("[EVENT-COLLECTIONS]", err);
      res.status(500).json({ message: "Failed to fetch event collections" });
    }
  });

  app.get("/api/cities/:citySlug/businesses/:businessSlug/events", async (req: Request, res: Response) => {
    try {
      const city = await resolveCity(req.params.citySlug);
      if (!city) return res.status(404).json({ message: "City not found" });

      const biz = await storage.getBusinessBySlug(city.id, req.params.businessSlug);
      if (!biz) return res.status(404).json({ message: "Business not found" });

      const now = new Date();
      const upcoming = await pool.query(
        `SELECT * FROM events WHERE host_business_id = $1 AND COALESCE(end_date_time, start_date_time + interval '3 hours') > $2 ORDER BY start_date_time ASC`,
        [biz.id, now]
      );
      const past = await pool.query(
        `SELECT * FROM events WHERE host_business_id = $1 AND COALESCE(visibility, 'public') = 'public' AND COALESCE(end_date_time, start_date_time + interval '3 hours') <= $2 ORDER BY start_date_time DESC LIMIT 20`,
        [biz.id, now]
      );

      const safeUpcoming = upcoming.rows.map((evt: Record<string, unknown>) => {
        if (evt.visibility && evt.visibility !== "public") {
          return {
            id: evt.id,
            title: "Private Event Scheduled",
            slug: evt.slug,
            start_date_time: evt.start_date_time,
            end_date_time: evt.end_date_time,
            is_featured: false,
            visibility: evt.visibility,
            _private: true,
          };
        }
        return evt;
      });

      res.json({ upcoming: safeUpcoming, past: past.rows });
    } catch (err: unknown) {
      console.error("[BIZ-EVENTS]", err);
      res.status(500).json({ message: "Failed to fetch business events" });
    }
  });

  app.post("/api/admin/event-collections", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { cityId, title, slug, description } = req.body;
      if (!cityId || !title || !slug) {
        return res.status(400).json({ message: "cityId, title, and slug are required" });
      }
      const result = await pool.query(
        `INSERT INTO event_collections (city_id, title, slug, description) VALUES ($1, $2, $3, $4) RETURNING *`,
        [cityId, title, slug, description || null]
      );
      res.status(201).json(result.rows[0]);
    } catch (err: unknown) {
      console.error("[ADMIN-COLLECTIONS-CREATE]", err);
      res.status(500).json({ message: "Failed to create collection" });
    }
  });

  app.get("/api/admin/event-collections", requireAdmin, async (req: Request, res: Response) => {
    try {
      const cityId = req.query.cityId as string;
      let query = `SELECT ec.*, (SELECT COUNT(*) FROM event_collection_items WHERE collection_id = ec.id) AS item_count FROM event_collections ec`;
      const params: string[] = [];
      if (cityId) {
        params.push(cityId);
        query += ` WHERE ec.city_id = $1`;
      }
      query += ` ORDER BY ec.sort_order ASC, ec.created_at DESC`;
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (err: unknown) {
      console.error("[ADMIN-COLLECTIONS-LIST]", err);
      res.status(500).json({ message: "Failed to fetch collections" });
    }
  });

  app.patch("/api/admin/event-collections/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { title, slug, description, isActive, sortOrder } = req.body;
      const sets: string[] = [];
      const params: (string | number | boolean)[] = [];
      let idx = 1;

      if (title !== undefined) { sets.push(`title = $${idx++}`); params.push(title); }
      if (slug !== undefined) { sets.push(`slug = $${idx++}`); params.push(slug); }
      if (description !== undefined) { sets.push(`description = $${idx++}`); params.push(description); }
      if (isActive !== undefined) { sets.push(`is_active = $${idx++}`); params.push(isActive); }
      if (sortOrder !== undefined) { sets.push(`sort_order = $${idx++}`); params.push(sortOrder); }
      sets.push(`updated_at = NOW()`);

      params.push(req.params.id);
      const result = await pool.query(
        `UPDATE event_collections SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
        params
      );
      if (result.rows.length === 0) return res.status(404).json({ message: "Not found" });
      res.json(result.rows[0]);
    } catch (err: unknown) {
      console.error("[ADMIN-COLLECTIONS-UPDATE]", err);
      res.status(500).json({ message: "Failed to update collection" });
    }
  });

  app.delete("/api/admin/event-collections/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await pool.query(`DELETE FROM event_collection_items WHERE collection_id = $1`, [req.params.id]);
      await pool.query(`DELETE FROM event_collections WHERE id = $1`, [req.params.id]);
      res.json({ success: true });
    } catch (err: unknown) {
      console.error("[ADMIN-COLLECTIONS-DELETE]", err);
      res.status(500).json({ message: "Failed to delete collection" });
    }
  });

  app.post("/api/admin/event-collections/:id/items", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { eventId, sortOrder } = req.body;
      if (!eventId) return res.status(400).json({ message: "eventId required" });
      const result = await pool.query(
        `INSERT INTO event_collection_items (collection_id, event_id, sort_order) VALUES ($1, $2, $3) ON CONFLICT (collection_id, event_id) DO UPDATE SET sort_order = $3 RETURNING *`,
        [req.params.id, eventId, sortOrder || 0]
      );
      res.status(201).json(result.rows[0]);
    } catch (err: unknown) {
      console.error("[ADMIN-COLLECTIONS-ADD-ITEM]", err);
      res.status(500).json({ message: "Failed to add item to collection" });
    }
  });

  app.delete("/api/admin/event-collection-items/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await pool.query(`DELETE FROM event_collection_items WHERE id = $1`, [req.params.id]);
      res.json({ success: true });
    } catch (err: unknown) {
      console.error("[ADMIN-COLLECTIONS-REMOVE-ITEM]", err);
      res.status(500).json({ message: "Failed to remove item from collection" });
    }
  });

  app.get("/api/admin/event-collections/:id/items", requireAdmin, async (req: Request, res: Response) => {
    try {
      const result = await pool.query(
        `SELECT eci.*, e.title AS event_title, e.slug AS event_slug, e.start_date_time, e.image_url
         FROM event_collection_items eci
         JOIN events e ON e.id = eci.event_id
         WHERE eci.collection_id = $1
         ORDER BY eci.sort_order ASC`,
        [req.params.id]
      );
      res.json(result.rows);
    } catch (err: unknown) {
      console.error("[ADMIN-COLLECTIONS-LIST-ITEMS]", err);
      res.status(500).json({ message: "Failed to fetch collection items" });
    }
  });
}
