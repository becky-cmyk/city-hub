import { db, pool } from "./db";
import { eq, and, sql, desc, count, gte, lte } from "drizzle-orm";
import {
  businesses, events, articles, trustProfiles, entityScores,
  crownParticipants, crownWinners, jobs, zones,
} from "@shared/schema";

export interface CommandCenterSummary {
  metro: {
    totalListings: number;
    claimedListings: number;
    verifiedListings: number;
    tierBreakdown: Record<string, number>;
  };
  trust: {
    profilesComputed: number;
    trustLevelBreakdown: Record<string, number>;
    atRiskCount: number;
    needsAttentionCount: number;
  };
  pipeline: {
    bucketBreakdown: Record<string, number>;
    highFitCount: number;
    contactReadyCount: number;
  };
  crown: {
    totalParticipants: number;
    totalWinners: number;
    activeCategories: number;
  };
  content: {
    totalArticles: number;
    featuredArticles: number;
    sponsoredArticles: number;
    publishedThisWeek: number;
    contentPipeline: {
      drafts: number;
      scheduled: number;
      published: number;
    };
  };
  events: {
    totalEvents: number;
    upcomingEvents: number;
  };
  jobs: {
    totalJobs: number;
    activeJobs: number;
  };
  recentCaptures: {
    newBusinessesThisWeek: number;
    newClaimsThisWeek: number;
    newVerificationsThisWeek: number;
    newTrustProfilesThisWeek: number;
  };
}

export interface AdvertiserOpportunity {
  businessId: string;
  businessName: string;
  trustLevel: string | null;
  listingTier: string;
  prospectFit: number;
  contactReady: number;
  bucket: string;
  signals: string[];
  suggestedActions: string[];
}

export interface CrownReadinessReport {
  businessId: string;
  businessName: string;
  trustLevel: string | null;
  isVerified: boolean;
  hasStory: boolean;
  storyDepthScore: number;
  isParticipant: boolean;
  isWinner: boolean;
  readinessScore: number;
  blockers: string[];
}

export async function getCommandCenterSummary(metroId: string): Promise<CommandCenterSummary> {
  const [listingStats] = await db.select({
    total: count(),
    claimed: sql<number>`count(*) filter (where ${businesses.claimStatus} = 'CLAIMED')`,
    verified: sql<number>`count(*) filter (where ${businesses.isVerified} = true)`,
  }).from(businesses).where(eq(businesses.cityId, metroId));

  const tierRows = await pool.query(
    `SELECT listing_tier, count(*)::int as cnt FROM businesses WHERE city_id = $1 GROUP BY listing_tier`,
    [metroId]
  );
  const tierBreakdown: Record<string, number> = {};
  for (const row of tierRows.rows) {
    tierBreakdown[row.listing_tier || "BASIC"] = row.cnt;
  }

  const trustRows = await pool.query(
    `SELECT tp.trust_level, count(*)::int as cnt
     FROM trust_profiles tp
     JOIN businesses b ON b.id = tp.business_id
     WHERE b.city_id = $1
     GROUP BY tp.trust_level`,
    [metroId]
  );
  const trustLevelBreakdown: Record<string, number> = {};
  let profilesComputed = 0;
  for (const row of trustRows.rows) {
    trustLevelBreakdown[row.trust_level] = row.cnt;
    profilesComputed += row.cnt;
  }

  const [statusCounts] = await pool.query(
    `SELECT
       count(*) filter (where operational_status = 'at_risk')::int as at_risk,
       count(*) filter (where operational_status = 'needs_attention')::int as needs_attention
     FROM trust_profiles tp
     JOIN businesses b ON b.id = tp.business_id
     WHERE b.city_id = $1`,
    [metroId]
  ).then(r => r.rows);

  const bucketRows = await pool.query(
    `SELECT bucket, count(*)::int as cnt FROM entity_scores WHERE metro_id = $1 GROUP BY bucket`,
    [metroId]
  );
  const bucketBreakdown: Record<string, number> = {};
  for (const row of bucketRows.rows) {
    bucketBreakdown[row.bucket] = row.cnt;
  }

  const [fitCounts] = await pool.query(
    `SELECT
       count(*) filter (where prospect_fit_score >= 70)::int as high_fit,
       count(*) filter (where contact_ready_score >= 60)::int as contact_ready
     FROM entity_scores WHERE metro_id = $1`,
    [metroId]
  ).then(r => r.rows);

  const [crownStats] = await pool.query(
    `SELECT
       (SELECT count(*)::int FROM crown_participants cp WHERE cp.city_id = $1) as participants,
       (SELECT count(*)::int FROM crown_winners cw JOIN crown_participants cp ON cp.id = cw.participant_id WHERE cw.city_id = $1) as winners,
       (SELECT count(DISTINCT cp.category_id)::int FROM crown_participants cp WHERE cp.city_id = $1) as categories`,
    [metroId]
  ).then(r => r.rows);

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [articleStats] = await db.select({
    total: count(),
    featured: sql<number>`count(*) filter (where ${articles.isFeatured} = true)`,
    sponsored: sql<number>`count(*) filter (where ${articles.isSponsored} = true)`,
    thisWeek: sql<number>`count(*) filter (where ${articles.publishedAt} >= ${oneWeekAgo})`,
  }).from(articles).where(eq(articles.cityId, metroId));

  const now = new Date();
  const [eventStats] = await db.select({
    total: count(),
    upcoming: sql<number>`count(*) filter (where ${events.startDateTime} >= ${now})`,
  }).from(events).where(eq(events.cityId, metroId));

  const [jobStats] = await pool.query(
    `SELECT
       count(*)::int as total,
       count(*) filter (where job_status IS NULL OR job_status = 'active')::int as active
     FROM jobs WHERE city_id = $1`,
    [metroId]
  ).then(r => r.rows);

  const [contentPipelineStats] = await pool.query(
    `SELECT
       count(*) filter (where published_at IS NULL AND (content IS NULL OR content = ''))::int as drafts,
       count(*) filter (where published_at IS NULL AND content IS NOT NULL AND content != '' AND feature_start_at > now())::int as scheduled,
       count(*) filter (where published_at IS NOT NULL)::int as published
     FROM articles WHERE city_id = $1`,
    [metroId]
  ).then(r => r.rows);

  const [recentCaptureStats] = await pool.query(
    `SELECT
       (SELECT count(*)::int FROM businesses WHERE city_id = $1 AND created_at >= now() - interval '7 days') as new_businesses,
       (SELECT count(*)::int FROM businesses WHERE city_id = $1 AND claim_status = 'CLAIMED' AND updated_at >= now() - interval '7 days') as new_claims,
       (SELECT count(*)::int FROM businesses WHERE city_id = $1 AND is_verified = true AND updated_at >= now() - interval '7 days') as new_verifications,
       (SELECT count(*)::int FROM trust_profiles tp JOIN businesses b ON b.id = tp.business_id WHERE b.city_id = $1 AND tp.last_computed_at >= now() - interval '7 days') as new_trust_profiles`,
    [metroId]
  ).then(r => r.rows);

  return {
    metro: {
      totalListings: listingStats.total,
      claimedListings: Number(listingStats.claimed),
      verifiedListings: Number(listingStats.verified),
      tierBreakdown,
    },
    trust: {
      profilesComputed,
      trustLevelBreakdown,
      atRiskCount: statusCounts?.at_risk || 0,
      needsAttentionCount: statusCounts?.needs_attention || 0,
    },
    pipeline: {
      bucketBreakdown,
      highFitCount: fitCounts?.high_fit || 0,
      contactReadyCount: fitCounts?.contact_ready || 0,
    },
    crown: {
      totalParticipants: crownStats?.participants || 0,
      totalWinners: crownStats?.winners || 0,
      activeCategories: crownStats?.categories || 0,
    },
    content: {
      totalArticles: articleStats.total,
      featuredArticles: Number(articleStats.featured),
      sponsoredArticles: Number(articleStats.sponsored),
      publishedThisWeek: Number(articleStats.thisWeek),
      contentPipeline: {
        drafts: contentPipelineStats?.drafts || 0,
        scheduled: contentPipelineStats?.scheduled || 0,
        published: contentPipelineStats?.published || 0,
      },
    },
    events: {
      totalEvents: eventStats.total,
      upcomingEvents: Number(eventStats.upcoming),
    },
    jobs: {
      totalJobs: jobStats?.total || 0,
      activeJobs: jobStats?.active || 0,
    },
    recentCaptures: {
      newBusinessesThisWeek: recentCaptureStats?.new_businesses || 0,
      newClaimsThisWeek: recentCaptureStats?.new_claims || 0,
      newVerificationsThisWeek: recentCaptureStats?.new_verifications || 0,
      newTrustProfilesThisWeek: recentCaptureStats?.new_trust_profiles || 0,
    },
  };
}

export async function identifyAdvertiserOpportunities(
  metroId: string,
  options: {
    minProspectFit?: number;
    minContactReady?: number;
    buckets?: string[];
    limit?: number;
  } = {}
): Promise<AdvertiserOpportunity[]> {
  const minFit = options.minProspectFit || 50;
  const minContact = options.minContactReady || 40;
  const limit = Math.min(options.limit || 25, 100);

  let bucketFilter = "";
  const params: unknown[] = [metroId, minFit, minContact, limit];
  if (options.buckets && options.buckets.length > 0) {
    bucketFilter = `AND es.bucket = ANY($5)`;
    params.push(options.buckets);
  }

  const result = await pool.query(
    `SELECT
       b.id as business_id, b.name as business_name, b.listing_tier,
       b.is_verified, b.claim_status, b.google_rating, b.google_review_count,
       b.website_url, b.phone,
       es.prospect_fit_score, es.contact_ready_score, es.bucket,
       tp.trust_level, tp.operational_status
     FROM entity_scores es
     JOIN businesses b ON b.id = es.entity_id
     LEFT JOIN trust_profiles tp ON tp.business_id = b.id
     WHERE es.metro_id = $1
       AND es.prospect_fit_score >= $2
       AND es.contact_ready_score >= $3
       ${bucketFilter}
     ORDER BY es.prospect_fit_score DESC, es.contact_ready_score DESC
     LIMIT $4`,
    params
  );

  return result.rows.map((row: Record<string, unknown>) => {
    const signals: string[] = [];
    const suggestedActions: string[] = [];

    if (row.claim_status !== "CLAIMED") {
      signals.push("Unclaimed listing");
      suggestedActions.push("Claim their listing");
    }
    if (!row.is_verified) {
      signals.push("Not yet verified");
      suggestedActions.push("Complete verification");
    }
    if (row.listing_tier === "BASIC" || row.listing_tier === "FREE") {
      signals.push("On basic/free tier");
      suggestedActions.push("Upgrade to premium listing");
    }
    if (row.google_rating && parseFloat(String(row.google_rating)) >= 4.0) {
      signals.push("High Google rating");
      suggestedActions.push("Feature their reviews in story");
    }
    if (row.google_review_count && Number(row.google_review_count) >= 20) {
      signals.push("Active review presence");
    }
    if (!row.website_url) {
      signals.push("No website");
      suggestedActions.push("Offer microsite builder");
    }
    if (row.phone) {
      signals.push("Phone available");
      suggestedActions.push("Direct outreach call");
    }

    return {
      businessId: String(row.business_id),
      businessName: String(row.business_name),
      trustLevel: row.trust_level ? String(row.trust_level) : null,
      listingTier: String(row.listing_tier || "BASIC"),
      prospectFit: Number(row.prospect_fit_score),
      contactReady: Number(row.contact_ready_score),
      bucket: String(row.bucket),
      signals,
      suggestedActions,
    };
  });
}

export async function getCrownReadinessReport(
  metroId: string,
  options: { minTrustLevel?: string; limit?: number } = {}
): Promise<CrownReadinessReport[]> {
  const limit = Math.min(options.limit || 25, 100);

  const result = await pool.query(
    `SELECT
       b.id as business_id, b.name as business_name, b.is_verified,
       tp.trust_level, tp.signal_snapshot,
       (SELECT count(*) > 0 FROM crown_participants cp WHERE cp.business_id = b.id) as is_participant,
       (SELECT count(*) > 0 FROM crown_winners cw JOIN crown_participants cp ON cp.id = cw.participant_id WHERE cp.business_id = b.id) as is_winner
     FROM businesses b
     LEFT JOIN trust_profiles tp ON tp.business_id = b.id
     WHERE b.city_id = $1 AND b.claim_status = 'CLAIMED'
     ORDER BY tp.trust_level DESC NULLS LAST
     LIMIT $2`,
    [metroId, limit]
  );

  const trustRank: Record<string, number> = { T0: 0, T1: 1, T2: 2, T3: 3, T4: 4, T5: 5 };
  const minRank = options.minTrustLevel ? (trustRank[options.minTrustLevel] || 0) : 0;

  return result.rows
    .filter((row: Record<string, unknown>) => {
      if (!options.minTrustLevel) return true;
      const level = String(row.trust_level || "T0");
      return (trustRank[level] || 0) >= minRank;
    })
    .map((row: Record<string, unknown>) => {
      const snapshot = (row.signal_snapshot || {}) as Record<string, unknown>;
      const hasStory = !!(snapshot.storyDepthScore && Number(snapshot.storyDepthScore) > 0);
      const storyDepthScore = Number(snapshot.storyDepthScore || 0);
      const blockers: string[] = [];
      let readinessScore = 0;

      if (row.is_verified) readinessScore += 25;
      else blockers.push("Not verified");

      const level = String(row.trust_level || "T0");
      const rank = trustRank[level] || 0;
      readinessScore += Math.min(rank * 10, 30);
      if (rank < 2) blockers.push(`Trust level ${level} below T2 minimum`);

      if (hasStory) readinessScore += 20;
      else blockers.push("No story published");

      if (storyDepthScore >= 50) readinessScore += 15;
      else if (hasStory) blockers.push("Story depth below 50");

      if (row.is_participant) readinessScore += 10;

      return {
        businessId: String(row.business_id),
        businessName: String(row.business_name),
        trustLevel: row.trust_level ? String(row.trust_level) : null,
        isVerified: !!row.is_verified,
        hasStory,
        storyDepthScore,
        isParticipant: !!row.is_participant,
        isWinner: !!row.is_winner,
        readinessScore,
        blockers,
      };
    });
}

export async function getZoneActivitySummary(
  metroId: string
): Promise<Array<{ zoneId: string; zoneName: string; listingCount: number; claimedCount: number; verifiedCount: number; avgTrustLevel: string }>> {
  const result = await pool.query(
    `SELECT
       z.id as zone_id, z.name as zone_name,
       count(b.id)::int as listing_count,
       count(*) filter (where b.claim_status = 'CLAIMED')::int as claimed_count,
       count(*) filter (where b.is_verified = true)::int as verified_count,
       round(avg(
         CASE tp.trust_level
           WHEN 'T5' THEN 5 WHEN 'T4' THEN 4 WHEN 'T3' THEN 3
           WHEN 'T2' THEN 2 WHEN 'T1' THEN 1 ELSE 0
         END
       ), 1) as avg_trust_num
     FROM zones z
     LEFT JOIN businesses b ON b.zone_id = z.id
     LEFT JOIN trust_profiles tp ON tp.business_id = b.id
     WHERE z.city_id = $1 AND z.is_active = true
     GROUP BY z.id, z.name
     ORDER BY listing_count DESC`,
    [metroId]
  );

  return result.rows.map((row: Record<string, unknown>) => {
    const avgNum = parseFloat(String(row.avg_trust_num || 0));
    const avgLevel = avgNum >= 4.5 ? "T5" : avgNum >= 3.5 ? "T4" : avgNum >= 2.5 ? "T3" : avgNum >= 1.5 ? "T2" : avgNum >= 0.5 ? "T1" : "T0";
    return {
      zoneId: String(row.zone_id),
      zoneName: String(row.zone_name),
      listingCount: Number(row.listing_count),
      claimedCount: Number(row.claimed_count),
      verifiedCount: Number(row.verified_count),
      avgTrustLevel: avgLevel,
    };
  });
}

export async function getRecentOrchestratorActivity(
  metroId: string,
  limit: number = 20
): Promise<Array<{ id: string; mode: string; intent: string; confidence: number; engines: string[]; createdAt: string }>> {
  const result = await pool.query(
    `SELECT id, mode, intent, confidence, target_engines, created_at
     FROM orchestrator_decisions
     WHERE metro_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [metroId, Math.min(limit, 50)]
  );

  return result.rows.map((row: Record<string, unknown>) => ({
    id: String(row.id),
    mode: String(row.mode),
    intent: String(row.intent),
    confidence: Number(row.confidence),
    engines: Array.isArray(row.target_engines) ? row.target_engines.map(String) : [],
    createdAt: String(row.created_at),
  }));
}
