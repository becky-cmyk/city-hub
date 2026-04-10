import { db } from "./db";
import { eq, and, sql, count } from "drizzle-orm";
import {
  businesses, entityScores, trustProfiles, events,
  articles, posts, charlotteFlowSessions,
} from "@shared/schema";

export type UpsellType =
  | "high_activity_low_tier"
  | "strong_story_no_content"
  | "event_potential_no_events"
  | "multi_location"
  | "high_trust_low_tier"
  | "active_poster_no_upgrade";

export interface UpsellOpportunity {
  upsellType: UpsellType;
  entityId: string;
  entityName: string;
  reason: string;
  recommendedAction: string;
  confidence: "high" | "medium" | "low";
  metadata?: Record<string, unknown>;
}

export async function detectUpsellOpportunities(
  entityId: string
): Promise<UpsellOpportunity[]> {
  const opportunities: UpsellOpportunity[] = [];

  try {
    const [biz] = await db
      .select({
        id: businesses.id,
        name: businesses.name,
        listingTier: businesses.listingTier,
        listingType: businesses.listingType,
        claimStatus: businesses.claimStatus,
        isVerified: businesses.isVerified,
        address: businesses.address,
        description: businesses.description,
        cityId: businesses.cityId,
      })
      .from(businesses)
      .where(eq(businesses.id, entityId))
      .limit(1);

    if (!biz || biz.claimStatus !== "CLAIMED") return opportunities;

    const [scores] = await db
      .select({
        prospectFitScore: entityScores.prospectFitScore,
        dataQualityScore: entityScores.dataQualityScore,
        contactReadyScore: entityScores.contactReadyScore,
      })
      .from(entityScores)
      .where(eq(entityScores.entityId, entityId))
      .limit(1);

    const [trust] = await db
      .select({
        trustLevel: trustProfiles.trustLevel,
        operationalStatus: trustProfiles.operationalStatus,
        signalSnapshot: trustProfiles.signalSnapshot,
      })
      .from(trustProfiles)
      .where(eq(trustProfiles.businessId, entityId))
      .limit(1);

    const trustRank: Record<string, number> = { T0: 0, T1: 1, T2: 2, T3: 3, T4: 4, T5: 5 };
    const currentTrustRank = trustRank[(trust?.trustLevel as string) || "T0"] || 0;
    const isLowTier = biz.listingTier === "FREE" || biz.listingTier === "VERIFIED";

    if (currentTrustRank >= 3 && isLowTier) {
      opportunities.push({
        upsellType: "high_trust_low_tier",
        entityId: biz.id,
        entityName: biz.name,
        reason: `Trust level ${trust?.trustLevel} but on ${biz.listingTier} tier — significant untapped potential`,
        recommendedAction: "Present Enhanced tier benefits with trust-based positioning",
        confidence: "high",
        metadata: { trustLevel: trust?.trustLevel, currentTier: biz.listingTier },
      });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [postCount] = await db
      .select({ total: count() })
      .from(posts)
      .where(and(eq(posts.businessId, entityId), sql`${posts.createdAt} > ${thirtyDaysAgo}`));

    const recentPostCount = postCount?.total || 0;

    if (recentPostCount >= 5 && isLowTier) {
      opportunities.push({
        upsellType: "active_poster_no_upgrade",
        entityId: biz.id,
        entityName: biz.name,
        reason: `${recentPostCount} posts in 30 days on ${biz.listingTier} tier — high engagement shows readiness for more`,
        recommendedAction: "Highlight how Enhanced tier amplifies their existing activity",
        confidence: "medium",
        metadata: { recentPostCount, currentTier: biz.listingTier },
      });
    }

    if (recentPostCount >= 3 && isLowTier && scores && scores.dataQualityScore >= 60) {
      opportunities.push({
        upsellType: "high_activity_low_tier",
        entityId: biz.id,
        entityName: biz.name,
        reason: `Active with ${recentPostCount} recent posts and data quality score ${scores.dataQualityScore} but on ${biz.listingTier} tier`,
        recommendedAction: "Show how upgrading increases visibility for their already-strong content",
        confidence: "medium",
        metadata: {
          recentPostCount,
          dataQualityScore: scores.dataQualityScore,
          currentTier: biz.listingTier,
        },
      });
    }

    const snapshot = trust?.signalSnapshot as Record<string, unknown> | null;
    const storyDepthScore = snapshot ? Number(snapshot.storyDepthScore || 0) : 0;

    if (storyDepthScore >= 60) {
      const [articleCount] = await db
        .select({ total: count() })
        .from(articles)
        .where(sql`${entityId} = ANY(${articles.mentionedBusinessIds})`);

      if ((articleCount?.total || 0) === 0 && recentPostCount < 2) {
        opportunities.push({
          upsellType: "strong_story_no_content",
          entityId: biz.id,
          entityName: biz.name,
          reason: `Strong story (depth ${storyDepthScore}) but no ongoing content presence`,
          recommendedAction: "Suggest regular content creation to build on their strong story foundation",
          confidence: "medium",
          metadata: { storyDepthScore, articleCount: articleCount?.total || 0 },
        });
      }
    }

    const isVenueType = biz.listingType === "venue" ||
      biz.description?.toLowerCase().includes("restaurant") ||
      biz.description?.toLowerCase().includes("bar") ||
      biz.description?.toLowerCase().includes("cafe") ||
      biz.description?.toLowerCase().includes("event space");

    if (isVenueType || biz.address) {
      const [eventCount] = await db
        .select({ total: count() })
        .from(events)
        .where(eq(events.hostBusinessId, entityId));

      if ((eventCount?.total || 0) === 0 && isVenueType) {
        opportunities.push({
          upsellType: "event_potential_no_events",
          entityId: biz.id,
          entityName: biz.name,
          reason: "Venue-type business with no events created — natural event host",
          recommendedAction: "Suggest creating a community event to drive foot traffic",
          confidence: "low",
          metadata: { listingType: biz.listingType, hasAddress: !!biz.address },
        });
      }
    }

    if (biz.cityId) {
      const [locationCount] = await db
        .select({ total: count() })
        .from(businesses)
        .where(
          and(
            eq(businesses.name, biz.name),
            eq(businesses.claimStatus, "CLAIMED"),
            eq(businesses.cityId, biz.cityId)
          )
        );

      if ((locationCount?.total || 0) > 1 && biz.listingTier !== "CHARTER" && biz.listingTier !== "ENHANCED") {
        opportunities.push({
          upsellType: "multi_location",
          entityId: biz.id,
          entityName: biz.name,
          reason: `Multiple locations detected (${locationCount?.total}) — Enhanced/Charter tier provides multi-location management`,
          recommendedAction: "Present Enhanced or Charter tier for unified multi-location management",
          confidence: "low",
          metadata: { locationCount: locationCount?.total },
        });
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[UpsellDetector] Error detecting opportunities:", msg);
  }

  return opportunities;
}

export async function detectBatchUpsellOpportunities(
  metroId: string,
  options: { limit?: number } = {}
): Promise<UpsellOpportunity[]> {
  const limit = options.limit || 30;
  const allOpportunities: UpsellOpportunity[] = [];

  try {
    const claimedBusinesses = await db
      .select({ id: businesses.id })
      .from(businesses)
      .where(
        and(
          eq(businesses.cityId, metroId),
          eq(businesses.claimStatus, "CLAIMED"),
          eq(businesses.isVerified, true)
        )
      )
      .limit(limit);

    for (const biz of claimedBusinesses) {
      const opportunities = await detectUpsellOpportunities(biz.id);
      allOpportunities.push(...opportunities);
    }

    allOpportunities.sort((a, b) => {
      const confidenceOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
      return confidenceOrder[a.confidence] - confidenceOrder[b.confidence];
    });

    console.log(`[UpsellDetector] Detected ${allOpportunities.length} upsell opportunities across ${claimedBusinesses.length} businesses in metro ${metroId}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[UpsellDetector] Batch detection error:", msg);
  }

  return allOpportunities;
}
