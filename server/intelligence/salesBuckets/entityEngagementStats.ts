import { db } from "../../db";
import { eq, sql } from "drizzle-orm";
import { businesses, entityEngagement30d } from "@shared/schema";

export async function computeAllEngagement30d(metroId?: string): Promise<{ computed: number }> {
  const metroFilter = metroId ? sql`AND iel.metro_id = ${metroId}` : sql``;

  const result = await db.execute(sql`
    INSERT INTO entity_engagement_30d (entity_id, metro_id, views_30d, call_clicks_30d, website_clicks_30d, directions_clicks_30d, leads_started_30d, leads_submitted_30d, updated_at)
    SELECT
      iel.entity_id,
      iel.metro_id,
      COALESCE(SUM(CASE WHEN iel.event_type = 'PROFILE_VIEW' THEN 1 ELSE 0 END), 0)::int,
      COALESCE(SUM(CASE WHEN iel.event_type = 'CALL_CLICK' THEN 1 ELSE 0 END), 0)::int,
      COALESCE(SUM(CASE WHEN iel.event_type = 'WEBSITE_CLICK' THEN 1 ELSE 0 END), 0)::int,
      COALESCE(SUM(CASE WHEN iel.event_type = 'DIRECTIONS_CLICK' THEN 1 ELSE 0 END), 0)::int,
      COALESCE(SUM(CASE WHEN iel.event_type = 'LEAD_START' THEN 1 ELSE 0 END), 0)::int,
      COALESCE(SUM(CASE WHEN iel.event_type = 'LEAD_SUBMIT' THEN 1 ELSE 0 END), 0)::int,
      NOW()
    FROM intelligence_event_log iel
    WHERE iel.created_at >= NOW() - INTERVAL '30 days'
      AND iel.entity_type = 'BUSINESS'
      ${metroFilter}
    GROUP BY iel.entity_id, iel.metro_id
    ON CONFLICT (entity_id) DO UPDATE SET
      views_30d = EXCLUDED.views_30d,
      call_clicks_30d = EXCLUDED.call_clicks_30d,
      website_clicks_30d = EXCLUDED.website_clicks_30d,
      directions_clicks_30d = EXCLUDED.directions_clicks_30d,
      leads_started_30d = EXCLUDED.leads_started_30d,
      leads_submitted_30d = EXCLUDED.leads_submitted_30d,
      updated_at = NOW()
  `);

  const countResult = await db.execute(sql`SELECT COUNT(*)::int as total FROM entity_engagement_30d`);
  const rows = (countResult as any).rows ?? countResult;
  const computed = rows[0]?.total || 0;

  console.log(`[EngagementStats] 30-day engagement computed for ${computed} entities`);
  return { computed };
}
