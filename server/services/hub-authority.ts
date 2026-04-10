import { db } from "../db";
import { sql } from "drizzle-orm";

export interface HubAuthority {
  hubId: string;
  hubName: string;
  hubCode: string;
  categorySlug: string;
  categoryName: string;
  score: number;
  bizCount: number;
  eventCount: number;
  articleCount: number;
  reviewCount: number;
  engagementCount: number;
  rank: number;
}

export async function computeHubAuthority(cityId: string): Promise<HubAuthority[]> {
  const rows = await db.execute(sql`
    WITH hub_biz AS (
      SELECT
        r.id AS hub_id,
        r.name AS hub_name,
        r.code AS hub_code,
        c.slug AS category_slug,
        c.name AS category_name,
        COUNT(DISTINCT b.id) AS biz_count
      FROM regions r
      JOIN businesses b ON b.zone_id = r.id AND b.city_id = ${cityId} AND b.status = 'ACTIVE'
      JOIN categories c ON c.id = ANY(b.category_ids)
      WHERE r.region_type = 'hub'
      GROUP BY r.id, r.name, r.code, c.slug, c.name
      HAVING COUNT(DISTINCT b.id) >= 2
    ),
    hub_cat_events AS (
      SELECT r.id AS hub_id, c.slug AS category_slug, COUNT(DISTINCT e.id) AS event_count
      FROM regions r
      JOIN events e ON e.zone_id = r.id AND e.city_id = ${cityId}
        AND e.start_date >= NOW() - INTERVAL '90 days'
      JOIN categories c ON c.id = ANY(e.category_ids)
      WHERE r.region_type = 'hub'
      GROUP BY r.id, c.slug
    ),
    hub_cat_articles AS (
      SELECT r.id AS hub_id, c.slug AS category_slug, COUNT(DISTINCT a.id) AS article_count
      FROM regions r
      JOIN articles a ON a.zone_id = r.id AND a.city_id = ${cityId}
        AND a.status = 'published'
        AND a.published_at >= NOW() - INTERVAL '90 days'
      JOIN categories c ON c.id = ANY(a.category_ids)
      WHERE r.region_type = 'hub'
      GROUP BY r.id, c.slug
    ),
    hub_cat_reviews AS (
      SELECT b.zone_id AS hub_id, c.slug AS category_slug, COUNT(DISTINCT rv.id) AS review_count
      FROM reviews rv
      JOIN businesses b ON b.id = rv.business_id AND b.city_id = ${cityId}
      JOIN categories c ON c.id = ANY(b.category_ids)
      WHERE rv.created_at >= NOW() - INTERVAL '90 days'
      GROUP BY b.zone_id, c.slug
    ),
    hub_cat_engagement AS (
      SELECT b.zone_id AS hub_id, c.slug AS category_slug, COUNT(DISTINCT iel.id) AS engagement_count
      FROM intelligence_event_log iel
      JOIN businesses b ON b.id = iel.entity_id AND b.city_id = ${cityId}
      JOIN categories c ON c.id = ANY(b.category_ids)
      WHERE iel.created_at >= NOW() - INTERVAL '90 days'
      GROUP BY b.zone_id, c.slug
    )
    SELECT
      hb.hub_id,
      hb.hub_name,
      hb.hub_code,
      hb.category_slug,
      hb.category_name,
      hb.biz_count,
      COALESCE(hce.event_count, 0) AS event_count,
      COALESCE(hca.article_count, 0) AS article_count,
      COALESCE(hcr.review_count, 0) AS review_count,
      COALESCE(hceng.engagement_count, 0) AS engagement_count
    FROM hub_biz hb
    LEFT JOIN hub_cat_events hce ON hce.hub_id = hb.hub_id AND hce.category_slug = hb.category_slug
    LEFT JOIN hub_cat_articles hca ON hca.hub_id = hb.hub_id AND hca.category_slug = hb.category_slug
    LEFT JOIN hub_cat_reviews hcr ON hcr.hub_id = hb.hub_id AND hcr.category_slug = hb.category_slug
    LEFT JOIN hub_cat_engagement hceng ON hceng.hub_id = hb.hub_id AND hceng.category_slug = hb.category_slug
    ORDER BY hb.biz_count DESC
  `);

  const grouped: Record<string, HubAuthority[]> = {};
  for (const row of rows.rows as any[]) {
    const catSlug = row.category_slug;
    if (!grouped[catSlug]) grouped[catSlug] = [];
    const bizCount = Number(row.biz_count);
    const eventCount = Number(row.event_count);
    const articleCount = Number(row.article_count);
    const reviewCount = Number(row.review_count);
    const engagementCount = Number(row.engagement_count);
    const score = bizCount * 3 + eventCount * 2 + articleCount * 2 + reviewCount + engagementCount;
    grouped[catSlug].push({
      hubId: row.hub_id,
      hubName: row.hub_name,
      hubCode: row.hub_code,
      categorySlug: catSlug,
      categoryName: row.category_name,
      score,
      bizCount,
      eventCount,
      articleCount,
      reviewCount,
      engagementCount,
      rank: 0,
    });
  }

  const result: HubAuthority[] = [];
  for (const catSlug of Object.keys(grouped)) {
    const items = grouped[catSlug].sort((a, b) => b.score - a.score);
    items.forEach((item, idx) => {
      item.rank = idx + 1;
      result.push(item);
    });
  }

  return result;
}

export async function getTopAuthoritiesForHub(cityId: string, hubCode: string, limit = 5): Promise<HubAuthority[]> {
  const all = await computeHubAuthority(cityId);
  return all
    .filter(a => a.hubCode === hubCode && a.rank <= 3)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit);
}

export async function getHubRankForCategory(cityId: string, hubCode: string, categorySlug: string): Promise<HubAuthority | null> {
  const all = await computeHubAuthority(cityId);
  return all.find(a => a.hubCode === hubCode && a.categorySlug === categorySlug) || null;
}
