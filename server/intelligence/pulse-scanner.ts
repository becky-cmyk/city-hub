import { db } from "../db";
import { sql, eq, and, gt, lt, count, desc, isNull, isNotNull } from "drizzle-orm";
import {
  businesses, intelligenceEventLog, publicUsers, posts,
  pulseSignals, adminInboxItems, cities,
} from "@shared/schema";

interface ScanResult {
  signalsCreated: number;
  inboxItemsCreated: number;
}

async function scanUnclaimedHighDemand(metroId: string): Promise<number> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rows = await db.execute(sql`
    SELECT e.entity_id, b.name, COUNT(*) as event_count,
      COUNT(CASE WHEN e.event_type = 'FEED_CARD_SAVE' OR e.event_type = 'SAVE' THEN 1 END) as save_count
    FROM intelligence_event_log e
    JOIN businesses b ON b.id = e.entity_id
    WHERE e.metro_id = ${metroId}
      AND e.created_at > ${thirtyDaysAgo}
      AND b.claimed_by_user_id IS NULL
    GROUP BY e.entity_id, b.name
    HAVING COUNT(*) >= 20
    ORDER BY COUNT(*) DESC
    LIMIT 20
  `);

  let created = 0;
  for (const row of rows.rows) {
    const r = row as any;
    const existing = await db.select({ id: pulseSignals.id }).from(pulseSignals)
      .where(and(
        eq(pulseSignals.metroId, metroId),
        eq(pulseSignals.signalType, "UNCLAIMED_HIGH_DEMAND"),
        eq(pulseSignals.entityId, r.entity_id),
        eq(pulseSignals.status, "new"),
      )).limit(1);
    if (existing.length > 0) continue;

    const inboxItems = await db.insert(adminInboxItems).values({
      itemType: "lead" as any,
      relatedTable: "businesses",
      relatedId: r.entity_id,
      title: `Unclaimed high-demand: ${r.name}`,
      summary: `${r.event_count} interactions, ${r.save_count} saves in 30 days. No owner claimed.`,
      priority: "high" as any,
      tags: ["pulse-intelligence", "unclaimed"],
    }).returning({ id: adminInboxItems.id });

    await db.insert(pulseSignals).values({
      metroId,
      signalType: "UNCLAIMED_HIGH_DEMAND",
      entityType: "business",
      entityId: r.entity_id,
      title: `Unclaimed high-demand: ${r.name}`,
      summary: `${r.event_count} interactions, ${r.save_count} saves in 30 days`,
      score: Number(r.event_count),
      dataJson: { eventCount: r.event_count, saveCount: r.save_count, businessName: r.name },
      inboxItemId: inboxItems[0]?.id,
    });
    created++;
  }
  return created;
}

async function scanUpgradeReady(metroId: string): Promise<number> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rows = await db.execute(sql`
    SELECT b.id, b.name, b.listing_tier, COUNT(*) as post_count
    FROM posts p
    JOIN businesses b ON b.id = p.business_id
    WHERE b.city_id = ${metroId}
      AND b.claimed_by_user_id IS NOT NULL
      AND b.listing_tier = 'VERIFIED'
      AND p.created_at > ${thirtyDaysAgo}
      AND p.status = 'approved'
    GROUP BY b.id, b.name, b.listing_tier
    HAVING COUNT(*) >= 8
    ORDER BY COUNT(*) DESC
    LIMIT 10
  `);

  let created = 0;
  for (const row of rows.rows) {
    const r = row as any;
    const existing = await db.select({ id: pulseSignals.id }).from(pulseSignals)
      .where(and(
        eq(pulseSignals.metroId, metroId),
        eq(pulseSignals.signalType, "UPGRADE_READY"),
        eq(pulseSignals.entityId, r.id),
        eq(pulseSignals.status, "new"),
      )).limit(1);
    if (existing.length > 0) continue;

    const inboxItems = await db.insert(adminInboxItems).values({
      itemType: "lead" as any,
      relatedTable: "businesses",
      relatedId: r.id,
      title: `Upgrade ready: ${r.name}`,
      summary: `${r.post_count} approved posts in 30 days. Recommend Charter upgrade.`,
      priority: "med" as any,
      tags: ["pulse-intelligence", "upgrade-ready"],
    }).returning({ id: adminInboxItems.id });

    await db.insert(pulseSignals).values({
      metroId,
      signalType: "UPGRADE_READY",
      entityType: "business",
      entityId: r.id,
      title: `Upgrade ready: ${r.name}`,
      summary: `${r.post_count} approved posts in 30 days on Verified tier`,
      score: Number(r.post_count),
      dataJson: { postCount: r.post_count, businessName: r.name, currentTier: r.listing_tier },
      inboxItemId: inboxItems[0]?.id,
    });
    created++;
  }
  return created;
}

async function scanContributorCandidates(metroId: string): Promise<number> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rows = await db.execute(sql`
    SELECT p.author_user_id, pu.display_name, pu.handle, pu.role_tier, COUNT(*) as submission_count
    FROM posts p
    JOIN public_users pu ON pu.id = p.author_user_id
    WHERE p.city_id = ${metroId}
      AND p.created_at > ${thirtyDaysAgo}
      AND p.author_user_id IS NOT NULL
      AND pu.role_tier = 'user'
    GROUP BY p.author_user_id, pu.display_name, pu.handle, pu.role_tier
    HAVING COUNT(*) >= 5
    ORDER BY COUNT(*) DESC
    LIMIT 10
  `);

  let created = 0;
  for (const row of rows.rows) {
    const r = row as any;
    const existing = await db.select({ id: pulseSignals.id }).from(pulseSignals)
      .where(and(
        eq(pulseSignals.metroId, metroId),
        eq(pulseSignals.signalType, "CONTRIBUTOR_CANDIDATE"),
        eq(pulseSignals.entityId, r.author_user_id),
        eq(pulseSignals.status, "new"),
      )).limit(1);
    if (existing.length > 0) continue;

    await db.insert(pulseSignals).values({
      metroId,
      signalType: "CONTRIBUTOR_CANDIDATE",
      entityType: "user",
      entityId: r.author_user_id,
      title: `Contributor candidate: ${r.display_name || r.handle}`,
      summary: `${r.submission_count} submissions in 30 days. Consider promoting to Contributor role.`,
      score: Number(r.submission_count),
      dataJson: { submissionCount: r.submission_count, displayName: r.display_name, handle: r.handle },
    });
    created++;
  }
  return created;
}

async function scanDormantClaimed(metroId: string): Promise<number> {
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const rows = await db.execute(sql`
    SELECT b.id, b.name, b.handle,
      MAX(e.created_at) as last_activity,
      MAX(p.created_at) as last_post
    FROM businesses b
    LEFT JOIN intelligence_event_log e ON e.entity_id = b.id AND e.metro_id = ${metroId}
    LEFT JOIN posts p ON p.business_id = b.id
    WHERE b.city_id = ${metroId}
      AND b.claimed_by_user_id IS NOT NULL
    GROUP BY b.id, b.name, b.handle
    HAVING COALESCE(MAX(e.created_at), '1970-01-01') < ${sixtyDaysAgo}
      AND COALESCE(MAX(p.created_at), '1970-01-01') < ${sixtyDaysAgo}
    LIMIT 20
  `);

  let created = 0;
  for (const row of rows.rows) {
    const r = row as any;
    const existing = await db.select({ id: pulseSignals.id }).from(pulseSignals)
      .where(and(
        eq(pulseSignals.metroId, metroId),
        eq(pulseSignals.signalType, "DORMANT_CLAIMED"),
        eq(pulseSignals.entityId, r.id),
        eq(pulseSignals.status, "new"),
      )).limit(1);
    if (existing.length > 0) continue;

    const inboxItems = await db.insert(adminInboxItems).values({
      itemType: "alert" as any,
      relatedTable: "businesses",
      relatedId: r.id,
      title: `Dormant claimed: ${r.name}`,
      summary: `No activity in 60+ days. Consider re-engagement outreach.`,
      priority: "low" as any,
      tags: ["pulse-intelligence", "dormant"],
    }).returning({ id: adminInboxItems.id });

    await db.insert(pulseSignals).values({
      metroId,
      signalType: "DORMANT_CLAIMED",
      entityType: "business",
      entityId: r.id,
      title: `Dormant claimed: ${r.name}`,
      summary: `No activity in 60+ days since claiming`,
      score: 30,
      dataJson: { businessName: r.name, handle: r.handle },
      inboxItemId: inboxItems[0]?.id,
    });
    created++;
  }
  return created;
}

async function scanTrendingTopics(metroId: string): Promise<number> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const rows = await db.execute(sql`
    WITH recent AS (
      SELECT p.primary_tag, COUNT(*) as recent_count
      FROM posts p
      WHERE p.city_id = ${metroId} AND p.created_at > ${sevenDaysAgo} AND p.primary_tag IS NOT NULL
      GROUP BY p.primary_tag
    ),
    prior AS (
      SELECT p.primary_tag, COUNT(*) as prior_count
      FROM posts p
      WHERE p.city_id = ${metroId} AND p.created_at BETWEEN ${fourteenDaysAgo} AND ${sevenDaysAgo} AND p.primary_tag IS NOT NULL
      GROUP BY p.primary_tag
    )
    SELECT r.primary_tag, r.recent_count, COALESCE(p.prior_count, 0) as prior_count
    FROM recent r
    LEFT JOIN prior p ON p.primary_tag = r.primary_tag
    WHERE r.recent_count >= 3 AND r.recent_count > COALESCE(p.prior_count, 0) * 1.5
    ORDER BY r.recent_count DESC
    LIMIT 5
  `);

  let created = 0;
  for (const row of rows.rows) {
    const r = row as any;
    const existing = await db.select({ id: pulseSignals.id }).from(pulseSignals)
      .where(and(
        eq(pulseSignals.metroId, metroId),
        eq(pulseSignals.signalType, "TRENDING_TOPIC"),
        eq(pulseSignals.entityId, r.primary_tag || ""),
        eq(pulseSignals.status, "new"),
      )).limit(1);
    if (existing.length > 0) continue;

    await db.insert(pulseSignals).values({
      metroId,
      signalType: "TRENDING_TOPIC",
      entityType: "topic",
      entityId: r.primary_tag,
      title: `Trending topic: ${r.primary_tag}`,
      summary: `${r.recent_count} posts this week vs ${r.prior_count} last week. Consider a Spotlight article.`,
      score: Number(r.recent_count),
      dataJson: { tag: r.primary_tag, recentCount: r.recent_count, priorCount: r.prior_count },
    });
    created++;
  }
  return created;
}

export async function runPulseScanner(): Promise<ScanResult> {
  console.log("[PulseScanner] Starting Charlotte Pulse Intelligence scan...");
  const allCities = await db.select({ id: cities.id }).from(cities);
  let totalSignals = 0;
  let totalInbox = 0;

  for (const city of allCities) {
    try {
      const s1 = await scanUnclaimedHighDemand(city.id);
      const s2 = await scanUpgradeReady(city.id);
      const s3 = await scanContributorCandidates(city.id);
      const s4 = await scanDormantClaimed(city.id);
      const s5 = await scanTrendingTopics(city.id);
      const cityTotal = s1 + s2 + s3 + s4 + s5;
      totalSignals += cityTotal;
      if (cityTotal > 0) {
        console.log(`[PulseScanner] ${city.id}: ${cityTotal} signals created`);
      }
    } catch (err: any) {
      console.error(`[PulseScanner] Error scanning ${city.id}:`, err.message);
    }
  }

  console.log(`[PulseScanner] Scan complete: ${totalSignals} signals created`);
  return { signalsCreated: totalSignals, inboxItemsCreated: totalInbox };
}
