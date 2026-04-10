import type { Express, Request, Response, RequestHandler } from "express";
import { db } from "./db";
import {
  intelligenceEventLog,
  entityEngagement30d,
  entityScores,
  entitySalesBuckets,
  pulseSignals,
  likes,
  follows,
  languageUsageLog,
  businesses,
  cities,
} from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import PDFDocument from "pdfkit";

function rows<T = Record<string, unknown>>(result: unknown): T[] {
  const r = result as { rows?: T[] };
  return r.rows ?? [];
}

function firstRow<T = Record<string, unknown>>(result: unknown, fallback: T): T {
  const arr = rows<T>(result);
  return arr[0] ?? fallback;
}

export function registerIntelligenceDashboardRoutes(app: Express, requireAdmin: RequestHandler) {

  app.get("/api/admin/intelligence/dashboard/readership", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { cityId, days } = req.query;
      const dayRange = Number.isFinite(Number(days)) ? Math.min(Math.max(Number(days), 1), 365) : 30;
      const since = new Date(Date.now() - dayRange * 24 * 60 * 60 * 1000);
      const cityFilter = cityId ? sql`AND metro_id = ${String(cityId)}` : sql``;

      const totalViews = await db.execute(sql`
        SELECT COUNT(*)::int as total FROM intelligence_event_log
        WHERE event_type = 'PROFILE_VIEW' AND created_at >= ${since} ${cityFilter}
      `);

      const uniqueVisitors = await db.execute(sql`
        SELECT (
          COUNT(DISTINCT (metadata_json->>'userId')) FILTER (WHERE metadata_json->>'userId' IS NOT NULL) +
          COUNT(*) FILTER (WHERE metadata_json->>'userId' IS NULL)
        )::int as total
        FROM intelligence_event_log
        WHERE event_type = 'PROFILE_VIEW' AND created_at >= ${since} ${cityFilter}
      `);

      const pageViewsByType = await db.execute(sql`
        SELECT page_type, COUNT(*)::int as total FROM language_usage_log
        WHERE event_type = 'page_view' AND created_at >= ${since}
        ${cityId ? sql`AND city_id = ${String(cityId)}` : sql``}
        GROUP BY page_type ORDER BY total DESC
      `);

      const viewsOverTime = await db.execute(sql`
        SELECT DATE(created_at) as date, COUNT(*)::int as views
        FROM intelligence_event_log
        WHERE event_type = 'PROFILE_VIEW' AND created_at >= ${since} ${cityFilter}
        GROUP BY DATE(created_at) ORDER BY date ASC
      `);

      const totalEvents = await db.execute(sql`
        SELECT COUNT(*)::int as total FROM intelligence_event_log
        WHERE created_at >= ${since} ${cityFilter}
      `);

      res.json({
        totalProfileViews: firstRow<{ total: number }>(totalViews, { total: 0 }).total,
        uniqueVisitors: firstRow<{ total: number }>(uniqueVisitors, { total: 0 }).total,
        totalEvents: firstRow<{ total: number }>(totalEvents, { total: 0 }).total,
        pageViewsByType: rows(pageViewsByType),
        viewsOverTime: rows(viewsOverTime),
        period: { days: dayRange, since: since.toISOString() },
      });
    } catch (error) {
      console.error("[IntelDashboard]", error); res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/intelligence/dashboard/engagement", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { cityId, days } = req.query;
      const dayRange = Number.isFinite(Number(days)) ? Math.min(Math.max(Number(days), 1), 365) : 30;
      const since = new Date(Date.now() - dayRange * 24 * 60 * 60 * 1000);
      const cityFilter = cityId ? sql`AND iel.metro_id = ${String(cityId)}` : sql``;

      const topByEngagement = await db.execute(sql`
        SELECT iel.entity_id, b.name, b.handle,
          SUM(CASE WHEN iel.event_type = 'PROFILE_VIEW' THEN 1 ELSE 0 END)::int as views,
          SUM(CASE WHEN iel.event_type IN ('WEBSITE_CLICK','CALL_CLICK','DIRECTIONS_CLICK') THEN 1 ELSE 0 END)::int as clicks,
          SUM(CASE WHEN iel.event_type = 'SAVE' OR iel.event_type = 'FEED_CARD_SAVE' THEN 1 ELSE 0 END)::int as saves,
          SUM(CASE WHEN iel.event_type = 'LEAD_SUBMIT' THEN 1 ELSE 0 END)::int as leads,
          COUNT(*)::int as total_events
        FROM intelligence_event_log iel
        JOIN businesses b ON b.id = iel.entity_id
        WHERE iel.created_at >= ${since} ${cityFilter}
        GROUP BY iel.entity_id, b.name, b.handle
        ORDER BY total_events DESC
        LIMIT 25
      `);

      const funnelData = await db.execute(sql`
        SELECT
          SUM(CASE WHEN event_type = 'PROFILE_VIEW' THEN 1 ELSE 0 END)::int as profile_views,
          SUM(CASE WHEN event_type IN ('WEBSITE_CLICK','CALL_CLICK','DIRECTIONS_CLICK') THEN 1 ELSE 0 END)::int as clicks,
          SUM(CASE WHEN event_type = 'LEAD_START' THEN 1 ELSE 0 END)::int as lead_starts,
          SUM(CASE WHEN event_type = 'LEAD_SUBMIT' THEN 1 ELSE 0 END)::int as lead_submits,
          SUM(CASE WHEN event_type IN ('SAVE','FEED_CARD_SAVE') THEN 1 ELSE 0 END)::int as saves
        FROM intelligence_event_log
        WHERE created_at >= ${since} ${cityId ? sql`AND metro_id = ${String(cityId)}` : sql``}
      `);

      const topSaved = await db.execute(sql`
        SELECT l.content_id as entity_id, b.name, COUNT(*)::int as save_count
        FROM likes l
        JOIN businesses b ON b.id = l.content_id
        WHERE l.content_type = 'business' AND l.created_at >= ${since}
        ${cityId ? sql`AND b.city_id = ${String(cityId)}` : sql``}
        GROUP BY l.content_id, b.name
        ORDER BY save_count DESC
        LIMIT 15
      `);

      const totalLikes = await db.execute(sql`
        SELECT COUNT(*)::int as total FROM likes l
        ${cityId ? sql`JOIN businesses b ON b.id = l.content_id WHERE l.created_at >= ${since} AND b.city_id = ${String(cityId)}` : sql`WHERE l.created_at >= ${since}`}
      `);
      const totalFollows = await db.execute(sql`
        SELECT COUNT(*)::int as total FROM follows f
        ${cityId ? sql`JOIN businesses b ON b.id = f.following_id WHERE f.created_at >= ${since} AND b.city_id = ${String(cityId)}` : sql`WHERE f.created_at >= ${since}`}
      `);

      res.json({
        topByEngagement: rows(topByEngagement),
        funnel: firstRow(funnelData, { profile_views: 0, clicks: 0, lead_starts: 0, lead_submits: 0, saves: 0 }),
        topSaved: rows(topSaved),
        totalLikes: firstRow<{ total: number }>(totalLikes, { total: 0 }).total,
        totalFollows: firstRow<{ total: number }>(totalFollows, { total: 0 }).total,
      });
    } catch (error) {
      console.error("[IntelDashboard]", error); res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/intelligence/dashboard/audience", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { cityId, days } = req.query;
      const dayRange = Number.isFinite(Number(days)) ? Math.min(Math.max(Number(days), 1), 365) : 30;
      const since = new Date(Date.now() - dayRange * 24 * 60 * 60 * 1000);

      const langBreakdown = await db.execute(sql`
        SELECT language, COUNT(*)::int as total FROM language_usage_log
        WHERE created_at >= ${since}
        ${cityId ? sql`AND city_id = ${String(cityId)}` : sql``}
        GROUP BY language ORDER BY total DESC
      `);

      const zipOrigins = await db.execute(sql`
        SELECT zip_origin, COUNT(*)::int as total FROM intelligence_event_log
        WHERE zip_origin IS NOT NULL AND created_at >= ${since}
        ${cityId ? sql`AND metro_id = ${String(cityId)}` : sql``}
        GROUP BY zip_origin ORDER BY total DESC LIMIT 20
      `);

      const referrerSources = await db.execute(sql`
        SELECT referrer, COUNT(*)::int as total FROM intelligence_event_log
        WHERE referrer IS NOT NULL AND referrer != '' AND created_at >= ${since}
        ${cityId ? sql`AND metro_id = ${String(cityId)}` : sql``}
        GROUP BY referrer ORDER BY total DESC LIMIT 15
      `);

      const hourOfDay = await db.execute(sql`
        SELECT EXTRACT(HOUR FROM created_at)::int as hour, COUNT(*)::int as total
        FROM intelligence_event_log
        WHERE created_at >= ${since}
        ${cityId ? sql`AND metro_id = ${String(cityId)}` : sql``}
        GROUP BY hour ORDER BY hour
      `);

      const dayOfWeek = await db.execute(sql`
        SELECT EXTRACT(DOW FROM created_at)::int as dow, COUNT(*)::int as total
        FROM intelligence_event_log
        WHERE created_at >= ${since}
        ${cityId ? sql`AND metro_id = ${String(cityId)}` : sql``}
        GROUP BY dow ORDER BY dow
      `);

      const deviceBreakdown = await db.execute(sql`
        SELECT
          COALESCE(metadata_json->>'device_type', 'unknown') as device,
          COUNT(*)::int as total
        FROM intelligence_event_log
        WHERE created_at >= ${since}
        ${cityId ? sql`AND metro_id = ${String(cityId)}` : sql``}
        GROUP BY COALESCE(metadata_json->>'device_type', 'unknown') ORDER BY total DESC
      `);

      const returningVsNew = await db.execute(sql`
        SELECT
          COUNT(DISTINCT zip_origin) FILTER (WHERE visit_count > 1)::int as returning_visitors,
          COUNT(DISTINCT zip_origin) FILTER (WHERE visit_count = 1)::int as new_visitors
        FROM (
          SELECT zip_origin, COUNT(*)::int as visit_count
          FROM intelligence_event_log
          WHERE zip_origin IS NOT NULL AND created_at >= ${since}
          ${cityId ? sql`AND metro_id = ${String(cityId)}` : sql``}
          GROUP BY zip_origin
        ) visitor_counts
      `);

      res.json({
        languageBreakdown: rows(langBreakdown),
        zipOrigins: rows(zipOrigins),
        referrerSources: rows(referrerSources),
        hourOfDay: rows(hourOfDay),
        dayOfWeek: rows(dayOfWeek),
        deviceBreakdown: rows(deviceBreakdown),
        returningVsNew: firstRow(returningVsNew, { returning_visitors: 0, new_visitors: 0 }),
      });
    } catch (error) {
      console.error("[IntelDashboard]", error); res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/intelligence/dashboard/content", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { cityId, days } = req.query;
      const dayRange = Number.isFinite(Number(days)) ? Math.min(Math.max(Number(days), 1), 365) : 30;
      const since = new Date(Date.now() - dayRange * 24 * 60 * 60 * 1000);

      const topRss = await db.execute(sql`
        SELECT title, source_name, view_count::int, url, city_id
        FROM rss_items
        WHERE review_status = 'APPROVED' AND created_at >= ${since}
        ${cityId ? sql`AND city_id = ${String(cityId)}` : sql``}
        ORDER BY view_count DESC LIMIT 20
      `);

      const topPosts = await db.execute(sql`
        SELECT p.id, p.title, p.primary_tag, p.status, p.created_at,
          COALESCE((SELECT COUNT(*)::int FROM likes l WHERE l.content_type = 'post' AND l.content_id = p.id), 0) as like_count
        FROM posts p
        WHERE p.status = 'approved' AND p.created_at >= ${since}
        ${cityId ? sql`AND p.city_id = ${String(cityId)}` : sql``}
        ORDER BY like_count DESC, p.created_at DESC
        LIMIT 20
      `);

      const topFeedItems = await db.execute(sql`
        SELECT entity_id, COUNT(*)::int as views,
          SUM(CASE WHEN event_type = 'FEED_CARD_TAP' THEN 1 ELSE 0 END)::int as taps,
          SUM(CASE WHEN event_type = 'FEED_CARD_SAVE' THEN 1 ELSE 0 END)::int as saves,
          SUM(CASE WHEN event_type = 'FEED_CARD_SHARE' THEN 1 ELSE 0 END)::int as shares
        FROM intelligence_event_log
        WHERE event_type IN ('FEED_CARD_VIEW','FEED_CARD_TAP','FEED_CARD_SAVE','FEED_CARD_SHARE')
          AND created_at >= ${since}
          ${cityId ? sql`AND metro_id = ${String(cityId)}` : sql``}
        GROUP BY entity_id
        ORDER BY views DESC
        LIMIT 20
      `);

      res.json({
        topRssArticles: rows(topRss),
        topPosts: rows(topPosts),
        topFeedItems: rows(topFeedItems),
      });
    } catch (error) {
      console.error("[IntelDashboard]", error); res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/intelligence/dashboard/signals", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { cityId, days } = req.query;
      const dayRange = Number.isFinite(Number(days)) ? Math.min(Math.max(Number(days), 1), 365) : 30;
      const since = new Date(Date.now() - dayRange * 24 * 60 * 60 * 1000);

      const signalsByType = await db.execute(sql`
        SELECT signal_type, status, COUNT(*)::int as total
        FROM pulse_signals
        WHERE created_at >= ${since}
        ${cityId ? sql`AND metro_id = ${String(cityId)}` : sql``}
        GROUP BY signal_type, status
        ORDER BY signal_type, status
      `);

      const recentSignals = await db.execute(sql`
        SELECT id, signal_type, entity_type, entity_id, title, summary, score, status, created_at
        FROM pulse_signals
        WHERE created_at >= ${since}
        ${cityId ? sql`AND metro_id = ${String(cityId)}` : sql``}
        ORDER BY created_at DESC
        LIMIT 30
      `);

      interface SignalRow { signal_type: string; status: string; total: number }
      const signalSummary: Record<string, { new: number; reviewed: number; dismissed: number; total: number }> = {};
      for (const r of rows<SignalRow>(signalsByType)) {
        if (!signalSummary[r.signal_type]) {
          signalSummary[r.signal_type] = { new: 0, reviewed: 0, dismissed: 0, total: 0 };
        }
        signalSummary[r.signal_type][r.status as keyof typeof signalSummary[string]] = r.total;
        signalSummary[r.signal_type].total += r.total;
      }

      res.json({
        signalSummary,
        recentSignals: rows(recentSignals),
      });
    } catch (error) {
      console.error("[IntelDashboard]", error); res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/intelligence/dashboard/pipeline", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { cityId, days } = req.query;
      const dayRange = Number.isFinite(Number(days)) ? Math.min(Math.max(Number(days), 1), 365) : 30;
      const since = new Date(Date.now() - dayRange * 24 * 60 * 60 * 1000);

      const bucketCounts = await db.execute(sql`
        SELECT es.bucket, COUNT(*)::int as total,
          ROUND(AVG(es.data_quality_score))::int as avg_dq,
          ROUND(AVG(es.contact_ready_score))::int as avg_cr,
          ROUND(AVG(es.prospect_fit_score))::int as avg_pf
        FROM entity_scores es
        ${cityId ? sql`WHERE es.metro_id = ${String(cityId)}` : sql``}
        GROUP BY es.bucket
        ORDER BY total DESC
      `);

      const salesBucketCounts = await db.execute(sql`
        SELECT bucket, COUNT(*)::int as total,
          ROUND(AVG(priority_score))::int as avg_priority
        FROM entity_sales_buckets
        ${cityId ? sql`WHERE metro_id = ${String(cityId)}` : sql``}
        GROUP BY bucket
        ORDER BY total DESC
      `);

      const claimedVsUnclaimed = await db.execute(sql`
        SELECT
          SUM(CASE WHEN claimed_by_user_id IS NOT NULL THEN 1 ELSE 0 END)::int as claimed,
          SUM(CASE WHEN claimed_by_user_id IS NULL THEN 1 ELSE 0 END)::int as unclaimed,
          COUNT(*)::int as total
        FROM businesses
        ${cityId ? sql`WHERE city_id = ${String(cityId)}` : sql``}
      `);

      const scoredToClaimedConversion = await db.execute(sql`
        SELECT
          COUNT(es.entity_id)::int as total_scored,
          SUM(CASE WHEN b.claimed_by_user_id IS NOT NULL THEN 1 ELSE 0 END)::int as scored_and_claimed
        FROM entity_scores es
        JOIN businesses b ON b.id = es.entity_id
        ${cityId ? sql`WHERE es.metro_id = ${String(cityId)}` : sql``}
      `);

      res.json({
        entityBuckets: rows(bucketCounts),
        salesBuckets: rows(salesBucketCounts),
        claimedVsUnclaimed: firstRow(claimedVsUnclaimed, { claimed: 0, unclaimed: 0, total: 0 }),
        scoredToClaimedConversion: firstRow(scoredToClaimedConversion, { total_scored: 0, scored_and_claimed: 0 }),
      });
    } catch (error) {
      console.error("[IntelDashboard]", error); res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/intelligence/dashboard/entity/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const entityId = req.params.id;

      const [engagement] = await db.select().from(entityEngagement30d).where(eq(entityEngagement30d.entityId, entityId)).limit(1);

      const [scores] = await db.select().from(entityScores).where(eq(entityScores.entityId, entityId)).limit(1);

      const salesBuckets = await db.select().from(entitySalesBuckets).where(eq(entitySalesBuckets.entityId, entityId));

      const priorSince = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      const currentSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const currentPeriod = await db.execute(sql`
        SELECT COUNT(*)::int as total FROM intelligence_event_log
        WHERE entity_id = ${entityId} AND created_at >= ${currentSince}
      `);
      const priorPeriod = await db.execute(sql`
        SELECT COUNT(*)::int as total FROM intelligence_event_log
        WHERE entity_id = ${entityId} AND created_at >= ${priorSince} AND created_at < ${currentSince}
      `);

      const current = firstRow<{ total: number }>(currentPeriod, { total: 0 }).total;
      const prior = firstRow<{ total: number }>(priorPeriod, { total: 0 }).total;
      let trend: "up" | "down" | "flat" = "flat";
      if (current > prior * 1.1) trend = "up";
      else if (current < prior * 0.9) trend = "down";

      res.json({
        engagement: engagement || null,
        scores: scores || null,
        salesBuckets,
        engagementTrend: { current, prior, trend },
      });
    } catch (error) {
      console.error("[IntelDashboard]", error); res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/intelligence/dashboard/metro-comparison", requireAdmin, async (req: Request, res: Response) => {
    try {
      const allCities = await db.select({ id: cities.id, name: cities.name }).from(cities);

      const metrics = [];
      for (const city of allCities) {
        const engagement = await db.execute(sql`
          SELECT
            COALESCE(SUM(views_30d), 0)::int as total_views,
            COALESCE(SUM(call_clicks_30d + website_clicks_30d + directions_clicks_30d), 0)::int as total_clicks,
            COALESCE(SUM(leads_submitted_30d), 0)::int as total_leads,
            COUNT(*)::int as entities_tracked
          FROM entity_engagement_30d
          WHERE metro_id = ${city.id}
        `);

        const businessStats = await db.execute(sql`
          SELECT
            COUNT(*)::int as total_businesses,
            SUM(CASE WHEN claimed_by_user_id IS NOT NULL THEN 1 ELSE 0 END)::int as claimed,
            ROUND(SUM(CASE WHEN claimed_by_user_id IS NOT NULL THEN 1 ELSE 0 END)::decimal / NULLIF(COUNT(*), 0) * 100, 1) as claimed_pct
          FROM businesses WHERE city_id = ${city.id}
        `);

        const contentVolume = await db.execute(sql`
          SELECT COUNT(*)::int as total FROM posts
          WHERE city_id = ${city.id} AND status = 'approved'
            AND created_at >= NOW() - INTERVAL '30 days'
        `);

        const signalCount = await db.execute(sql`
          SELECT COUNT(*)::int as total FROM pulse_signals
          WHERE metro_id = ${city.id} AND status = 'new'
        `);

        const engRow = firstRow<Record<string, number>>(engagement, {});
        const bizRow = firstRow<Record<string, number>>(businessStats, {});
        const contentRow = firstRow<Record<string, number>>(contentVolume, {});
        const signalRow = firstRow<Record<string, number>>(signalCount, {});

        metrics.push({
          cityId: city.id,
          cityName: city.name,
          totalViews: engRow.total_views || 0,
          totalClicks: engRow.total_clicks || 0,
          totalLeads: engRow.total_leads || 0,
          entitiesTracked: engRow.entities_tracked || 0,
          totalBusinesses: bizRow.total_businesses || 0,
          claimedBusinesses: bizRow.claimed || 0,
          claimedPct: parseFloat(bizRow.claimed_pct) || 0,
          contentVolume30d: contentRow.total || 0,
          activeSignals: signalRow.total || 0,
        });
      }

      res.json({ metros: metrics });
    } catch (error) {
      console.error("[IntelDashboard]", error); res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/intelligence/dashboard/report/pdf", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { cityId, days } = req.query;
      const dayRange = Number.isFinite(Number(days)) ? Math.min(Math.max(Number(days), 1), 365) : 30;
      const since = new Date(Date.now() - dayRange * 24 * 60 * 60 * 1000);
      const cityFilter = cityId ? sql`AND metro_id = ${String(cityId)}` : sql``;

      const readership = await db.execute(sql`
        SELECT
          SUM(CASE WHEN event_type = 'PROFILE_VIEW' THEN 1 ELSE 0 END)::int as profile_views,
          COUNT(DISTINCT zip_origin)::int as unique_visitors,
          COUNT(*)::int as total_events
        FROM intelligence_event_log
        WHERE created_at >= ${since} ${cityFilter}
      `);
      const rData = firstRow<Record<string, number>>(readership, {});

      const funnel = await db.execute(sql`
        SELECT
          SUM(CASE WHEN event_type = 'PROFILE_VIEW' THEN 1 ELSE 0 END)::int as profile_views,
          SUM(CASE WHEN event_type IN ('WEBSITE_CLICK','CALL_CLICK','DIRECTIONS_CLICK') THEN 1 ELSE 0 END)::int as clicks,
          SUM(CASE WHEN event_type = 'LEAD_START' THEN 1 ELSE 0 END)::int as lead_starts,
          SUM(CASE WHEN event_type = 'LEAD_SUBMIT' THEN 1 ELSE 0 END)::int as lead_submits,
          SUM(CASE WHEN event_type IN ('SAVE','FEED_CARD_SAVE') THEN 1 ELSE 0 END)::int as saves
        FROM intelligence_event_log
        WHERE created_at >= ${since} ${cityFilter}
      `);
      const fData = firstRow<Record<string, number>>(funnel, {});

      const entityBuckets = await db.execute(sql`
        SELECT es.bucket, COUNT(*)::int as total,
          ROUND(AVG(es.data_quality_score))::int as avg_dq,
          ROUND(AVG(es.contact_ready_score))::int as avg_cr,
          ROUND(AVG(es.prospect_fit_score))::int as avg_pf
        FROM entity_scores es
        ${cityId ? sql`WHERE es.metro_id = ${String(cityId)}` : sql``}
        GROUP BY es.bucket ORDER BY total DESC
      `);
      const buckets = rows<{ bucket: string; total: number; avg_dq: number; avg_cr: number; avg_pf: number }>(entityBuckets);

      const claimedStats = await db.execute(sql`
        SELECT
          SUM(CASE WHEN claimed_by_user_id IS NOT NULL THEN 1 ELSE 0 END)::int as claimed,
          SUM(CASE WHEN claimed_by_user_id IS NULL THEN 1 ELSE 0 END)::int as unclaimed,
          COUNT(*)::int as total
        FROM businesses
        ${cityId ? sql`WHERE city_id = ${String(cityId)}` : sql``}
      `);
      const cData = firstRow<Record<string, number>>(claimedStats, {});

      const signalsByType = await db.execute(sql`
        SELECT signal_type, COUNT(*)::int as total
        FROM pulse_signals
        ${cityId ? sql`WHERE metro_id = ${String(cityId)}` : sql``}
        GROUP BY signal_type ORDER BY total DESC
      `);
      const sRows = rows<{ signal_type: string; total: number }>(signalsByType);

      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));

      await new Promise<void>((resolve, reject) => {
        doc.on("end", resolve);
        doc.on("error", reject);

        const BRAND_BLUE = "#1e40af";
        const MUTED = "#6b7280";
        const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
        const scopeLabel = cityId ? "Metro" : "Platform";

        doc.rect(0, 0, doc.page.width, 80).fill(BRAND_BLUE);
        doc.fillColor("#ffffff").fontSize(22).font("Helvetica-Bold").text("Intelligence Report", 50, 25);
        doc.fontSize(10).font("Helvetica").text(`${scopeLabel} Report — ${dateStr} — ${dayRange}-Day Window`, 50, 52);
        doc.fillColor("#000000");

        let y = 110;

        const sectionHeader = (title: string) => {
          if (y > 700) { doc.addPage(); y = 50; }
          doc.fontSize(14).font("Helvetica-Bold").fillColor(BRAND_BLUE).text(title, 50, y);
          y += 4;
          doc.moveTo(50, y + 16).lineTo(545, y + 16).strokeColor(BRAND_BLUE).lineWidth(1).stroke();
          y += 26;
          doc.fillColor("#000000").font("Helvetica").fontSize(10);
        };

        const kv = (label: string, value: string | number) => {
          if (y > 750) { doc.addPage(); y = 50; }
          doc.font("Helvetica").fillColor(MUTED).text(label + ":", 60, y, { continued: true });
          doc.font("Helvetica-Bold").fillColor("#000000").text("  " + String(value));
          y += 16;
        };

        sectionHeader("Readership & Traffic");
        kv("Profile Views", rData.profile_views || 0);
        kv("Unique Visitors", rData.unique_visitors || 0);
        kv("Total Events", rData.total_events || 0);
        y += 8;

        sectionHeader("Conversion Funnel");
        kv("Views", fData.profile_views || 0);
        kv("Clicks", fData.clicks || 0);
        kv("Lead Starts", fData.lead_starts || 0);
        kv("Leads Submitted", fData.lead_submits || 0);
        kv("Saves", fData.saves || 0);
        if ((fData.profile_views || 0) > 0) {
          const convRate = (((fData.lead_submits || 0) / fData.profile_views) * 100).toFixed(2);
          kv("View→Lead Rate", convRate + "%");
        }
        y += 8;

        sectionHeader("Sales Pipeline");
        kv("Total Businesses", cData.total || 0);
        kv("Claimed", cData.claimed || 0);
        kv("Unclaimed", cData.unclaimed || 0);
        if ((cData.total || 0) > 0) {
          kv("Claimed %", ((cData.claimed / cData.total) * 100).toFixed(1) + "%");
        }
        y += 8;

        if (buckets.length > 0) {
          sectionHeader("Entity Scoring Buckets");
          for (const b of buckets) {
            if (y > 740) { doc.addPage(); y = 50; }
            doc.font("Helvetica").fontSize(10).fillColor("#000000")
              .text(`${b.bucket.replace(/_/g, " ")}: ${b.total} entities (DQ: ${b.avg_dq}, CR: ${b.avg_cr}, PF: ${b.avg_pf})`, 60, y);
            y += 16;
          }
          y += 8;
        }

        if (sRows.length > 0) {
          sectionHeader("Active Signals");
          for (const s of sRows) {
            if (y > 740) { doc.addPage(); y = 50; }
            doc.font("Helvetica").fontSize(10).fillColor("#000000")
              .text(`${s.signal_type.replace(/_/g, " ")}: ${s.total}`, 60, y);
            y += 16;
          }
          y += 8;
        }

        if (y > 700) { doc.addPage(); y = 50; }
        doc.fontSize(8).fillColor(MUTED).font("Helvetica")
          .text(`Generated ${new Date().toISOString()} — Platform Intelligence System`, 50, y);

        doc.end();
      });

      const pdfBuffer = Buffer.concat(chunks);
      const filename = `intelligence-report-${new Date().toISOString().split("T")[0]}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("[IntelDashboard]", error); res.status(500).json({ message: "Internal server error" });
    }
  });
}
