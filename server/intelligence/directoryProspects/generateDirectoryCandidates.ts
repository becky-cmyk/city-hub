import { db } from "../../db";
import { sql } from "drizzle-orm";

const DIRECTORY_CATEGORY_SLUGS = [
  "marketing-advertising",
  "community-orgs",
  "events-weddings",
  "networking-groups",
  "guided-tours",
  "community-outreach",
  "community-events",
  "social-media-marketing",
];

const DIRECTORY_NAME_PATTERNS = [
  /\bmedia\b/i,
  /\bmagazine\b/i,
  /\bnews\b/i,
  /\bguide\b/i,
  /\bdirectory\b/i,
  /\bcommunity\b/i,
  /\btourism\b/i,
  /\bevents?\b/i,
  /\bblog\b/i,
  /\blist(ing)?s?\b/i,
  /\bcollect(or|ive|ion)\b/i,
  /\bpublish/i,
  /\bweekly\b/i,
  /\bdaily\b/i,
  /\bobserver\b/i,
  /\bchronicle\b/i,
  /\btribune\b/i,
  /\bjournal\b/i,
  /\bpress\b/i,
  /\bsource\b/i,
  /\bscene\b/i,
  /\bagenda\b/i,
];

function extractRootDomain(url: string): string | null {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export async function generateDirectoryCandidates(metroId?: string): Promise<{ generated: number; skipped: number }> {
  console.log("[DirectoryCandidates] Starting candidate generation...");

  const candidateMap = new Map<string, { websiteUrl: string; entityId: string | null; metroId: string | null }>();

  const metroWhere = metroId ? sql`AND b.city_id = ${metroId}` : sql``;

  const slugList = sql.join(DIRECTORY_CATEGORY_SLUGS.map(s => sql`${s}`), sql`, `);
  const catResult = await db.execute(sql`
    SELECT DISTINCT b.id, b.website_url, b.name, b.city_id
    FROM businesses b
    JOIN entity_category_map ecm ON ecm.entity_id = b.id
    JOIN categories c ON c.id = ecm.category_id
    WHERE b.website_url IS NOT NULL
      AND b.website_url != ''
      AND c.slug IN (${slugList})
      ${metroWhere}
  `);
  const catRows = (catResult as any).rows ?? catResult;
  for (const row of catRows) {
    const domain = extractRootDomain(row.website_url);
    if (domain && !candidateMap.has(domain)) {
      candidateMap.set(domain, { websiteUrl: row.website_url, entityId: row.id, metroId: row.city_id });
    }
  }
  console.log(`[DirectoryCandidates] Category matches: ${catRows.length}`);

  const nameResult = await db.execute(sql`
    SELECT b.id, b.website_url, b.name, b.city_id
    FROM businesses b
    WHERE b.website_url IS NOT NULL
      AND b.website_url != ''
      ${metroWhere}
  `);
  const nameRows = (nameResult as any).rows ?? nameResult;
  for (const row of nameRows) {
    if (DIRECTORY_NAME_PATTERNS.some(p => p.test(row.name || ""))) {
      const domain = extractRootDomain(row.website_url);
      if (domain && !candidateMap.has(domain)) {
        candidateMap.set(domain, { websiteUrl: row.website_url, entityId: row.id, metroId: row.city_id });
      }
    }
  }
  console.log(`[DirectoryCandidates] After name patterns: ${candidateMap.size}`);

  const contentSourceResult = await db.execute(sql`
    SELECT b.id, b.website_url, b.city_id
    FROM businesses b
    JOIN entity_scores es ON es.entity_id = b.id
    WHERE es.bucket = 'CONTENT_SOURCE_ONLY'
      AND b.website_url IS NOT NULL
      AND b.website_url != ''
      ${metroWhere}
  `);
  const csRows = (contentSourceResult as any).rows ?? contentSourceResult;
  for (const row of csRows) {
    const domain = extractRootDomain(row.website_url);
    if (domain && !candidateMap.has(domain)) {
      candidateMap.set(domain, { websiteUrl: row.website_url, entityId: row.id, metroId: row.city_id });
    }
  }
  console.log(`[DirectoryCandidates] After CONTENT_SOURCE_ONLY: ${candidateMap.size}`);

  const feedResult = await db.execute(sql`
    SELECT ecv.entity_id, b.website_url, b.city_id
    FROM entity_contact_verification ecv
    JOIN businesses b ON b.id = ecv.entity_id
    WHERE ecv.detected_feed_url IS NOT NULL
      AND b.website_url IS NOT NULL
      AND b.website_url != ''
      ${metroWhere}
  `);
  const feedRows = (feedResult as any).rows ?? feedResult;
  for (const row of feedRows) {
    const domain = extractRootDomain(row.website_url);
    if (domain && !candidateMap.has(domain)) {
      candidateMap.set(domain, { websiteUrl: row.website_url, entityId: row.entity_id, metroId: row.city_id });
    }
  }
  console.log(`[DirectoryCandidates] After feed detection: ${candidateMap.size}`);

  let generated = 0;
  let skipped = 0;

  for (const [domain, info] of candidateMap) {
    try {
      const insertResult = await db.execute(sql`
        INSERT INTO directory_prospects (root_domain, website_url, entity_id, metro_id, crawl_status, created_at, updated_at)
        VALUES (${domain}, ${info.websiteUrl}, ${info.entityId}, ${info.metroId}, 'PENDING', NOW(), NOW())
        ON CONFLICT (root_domain) DO NOTHING
        RETURNING id
      `);
      const rows = (insertResult as any).rows ?? insertResult;
      if (rows.length > 0) {
        generated++;
      } else {
        skipped++;
      }
    } catch (err: any) {
      console.error(`[DirectoryCandidates] Error inserting ${domain}:`, err.message);
      skipped++;
    }
  }

  console.log(`[DirectoryCandidates] Complete: ${generated} new candidates, ${skipped} skipped (already exist)`);
  return { generated, skipped };
}
