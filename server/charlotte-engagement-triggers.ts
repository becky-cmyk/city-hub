import { db } from "./db";
import { eq, and, sql, lt, isNull, isNotNull, gt, desc, count } from "drizzle-orm";
import { businesses, entityScores, trustProfiles, charlotteFlowSessions, events, posts, categories } from "@shared/schema";

export type EngagementTriggerType =
  | "inactivity"
  | "new_capability"
  | "opportunity_detected"
  | "seasonal_moment";

export type EngagementPriority = "high" | "medium" | "low";

export interface EngagementTrigger {
  triggerType: EngagementTriggerType;
  entityId: string;
  entityName: string;
  recommendedNextAction: string;
  priority: EngagementPriority;
  reason: string;
  metadata?: Record<string, unknown>;
}

export interface InactivityConfig {
  daysThreshold: number;
  checkClaimed: boolean;
  checkVerified: boolean;
}

const DEFAULT_INACTIVITY_CONFIG: InactivityConfig = {
  daysThreshold: 30,
  checkClaimed: true,
  checkVerified: true,
};

export async function evaluateInactivityTriggers(
  metroId: string,
  config: Partial<InactivityConfig> = {}
): Promise<EngagementTrigger[]> {
  const cfg = { ...DEFAULT_INACTIVITY_CONFIG, ...config };
  const cutoff = new Date(Date.now() - cfg.daysThreshold * 24 * 60 * 60 * 1000);
  const triggers: EngagementTrigger[] = [];

  try {
    const inactiveBusinesses = await db
      .select({
        id: businesses.id,
        name: businesses.name,
        updatedAt: businesses.updatedAt,
        listingTier: businesses.listingTier,
        claimStatus: businesses.claimStatus,
        isVerified: businesses.isVerified,
      })
      .from(businesses)
      .where(
        and(
          eq(businesses.cityId, metroId),
          cfg.checkClaimed ? eq(businesses.claimStatus, "CLAIMED") : undefined,
          cfg.checkVerified ? eq(businesses.isVerified, true) : undefined,
          lt(businesses.updatedAt, cutoff)
        )
      )
      .limit(50);

    for (const biz of inactiveBusinesses) {
      const daysSinceUpdate = Math.floor(
        (Date.now() - (biz.updatedAt?.getTime() || 0)) / (24 * 60 * 60 * 1000)
      );

      const priority: EngagementPriority =
        daysSinceUpdate > 90 ? "high" : daysSinceUpdate > 60 ? "medium" : "low";

      triggers.push({
        triggerType: "inactivity",
        entityId: biz.id,
        entityName: biz.name,
        recommendedNextAction: "send_reengagement_prompt",
        priority,
        reason: `No activity in ${daysSinceUpdate} days`,
        metadata: { daysSinceUpdate, listingTier: biz.listingTier },
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[EngagementTriggers] Inactivity check error:", msg);
  }

  return triggers;
}

export async function evaluateNewCapabilityTriggers(
  metroId: string
): Promise<EngagementTrigger[]> {
  const triggers: EngagementTrigger[] = [];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  try {
    const recentlyVerified = await db
      .select({
        id: businesses.id,
        name: businesses.name,
        listingTier: businesses.listingTier,
      })
      .from(businesses)
      .where(
        and(
          eq(businesses.cityId, metroId),
          eq(businesses.isVerified, true),
          eq(businesses.claimStatus, "CLAIMED"),
          sql`${businesses.claimedAt} > ${sevenDaysAgo}`
        )
      )
      .limit(30);

    for (const biz of recentlyVerified) {
      triggers.push({
        triggerType: "new_capability",
        entityId: biz.id,
        entityName: biz.name,
        recommendedNextAction: "suggest_story_creation",
        priority: "high",
        reason: "Recently verified — ready for story creation and deeper participation",
        metadata: { capability: "verified", listingTier: biz.listingTier },
      });
    }

    const tvVenueEligible = await db
      .select({
        id: businesses.id,
        name: businesses.name,
        listingTier: businesses.listingTier,
      })
      .from(businesses)
      .where(
        and(
          eq(businesses.cityId, metroId),
          eq(businesses.isVerified, true),
          eq(businesses.claimStatus, "CLAIMED"),
          eq(businesses.venueScreenLikely, true),
          sql`${businesses.claimedAt} > ${sevenDaysAgo}`
        )
      )
      .limit(20);

    for (const biz of tvVenueEligible) {
      triggers.push({
        triggerType: "new_capability",
        entityId: biz.id,
        entityName: biz.name,
        recommendedNextAction: "suggest_tv_venue",
        priority: "medium",
        reason: "Venue-type business recently claimed — eligible for venue screen placement",
        metadata: { capability: "tv_venue_eligible", listingTier: biz.listingTier },
      });
    }

    const jobMarketplaceReady = await db
      .select({
        id: businesses.id,
        name: businesses.name,
        listingType: businesses.listingType,
      })
      .from(businesses)
      .where(
        and(
          eq(businesses.cityId, metroId),
          eq(businesses.isVerified, true),
          eq(businesses.claimStatus, "CLAIMED"),
          sql`${businesses.listingType} IN ('business', 'org')`,
          sql`${businesses.claimedAt} > ${sevenDaysAgo}`
        )
      )
      .limit(20);

    for (const biz of jobMarketplaceReady) {
      const alreadyTriggered = triggers.some(t => t.entityId === biz.id);
      if (!alreadyTriggered) {
        triggers.push({
          triggerType: "new_capability",
          entityId: biz.id,
          entityName: biz.name,
          recommendedNextAction: "suggest_job_posting",
          priority: "low",
          reason: "Business/org recently verified — eligible for jobs board and marketplace",
          metadata: { capability: "jobs_marketplace_ready", listingType: biz.listingType },
        });
      }
    }

    const newCategoryBusinesses = await db
      .select({
        id: businesses.id,
        name: businesses.name,
        categoryIds: businesses.categoryIds,
        listingTier: businesses.listingTier,
      })
      .from(businesses)
      .where(
        and(
          eq(businesses.cityId, metroId),
          eq(businesses.claimStatus, "CLAIMED"),
          eq(businesses.isVerified, true),
          sql`${businesses.updatedAt} > ${sevenDaysAgo}`,
          sql`array_length(${businesses.categoryIds}, 1) > 0`
        )
      )
      .limit(20);

    for (const biz of newCategoryBusinesses) {
      const alreadyTriggered = triggers.some(t => t.entityId === biz.id);
      if (!alreadyTriggered && biz.categoryIds.length > 0) {
        triggers.push({
          triggerType: "new_capability",
          entityId: biz.id,
          entityName: biz.name,
          recommendedNextAction: "suggest_category_content",
          priority: "low",
          reason: "Recently updated categories — new category surfaces unlocked for content and discovery",
          metadata: { capability: "category_unlocked", categoryCount: biz.categoryIds.length, listingTier: biz.listingTier },
        });
      }
    }

    const recentStoryApprovals = await db
      .select({
        id: charlotteFlowSessions.id,
        businessId: charlotteFlowSessions.businessId,
        businessName: charlotteFlowSessions.businessName,
        onboardingState: charlotteFlowSessions.onboardingState,
      })
      .from(charlotteFlowSessions)
      .where(
        and(
          eq(charlotteFlowSessions.status, "completed"),
          eq(charlotteFlowSessions.cityId, metroId),
          sql`${charlotteFlowSessions.updatedAt} > ${sevenDaysAgo}`
        )
      )
      .limit(30);

    for (const session of recentStoryApprovals) {
      const state = session.onboardingState as Record<string, unknown> | null;
      if (state?.storyApproved && session.businessId) {
        triggers.push({
          triggerType: "new_capability",
          entityId: session.businessId,
          entityName: session.businessName || "Business",
          recommendedNextAction: "suggest_content_participation",
          priority: "medium",
          reason: "Story approved — ready for content participation and surface expansion",
          metadata: { capability: "story_approved", sessionId: session.id },
        });
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[EngagementTriggers] New capability check error:", msg);
  }

  return triggers;
}

export async function evaluateOpportunityTriggers(
  metroId: string
): Promise<EngagementTrigger[]> {
  const triggers: EngagementTrigger[] = [];

  try {
    const highScoreEntities = await db
      .select({
        entityId: entityScores.entityId,
        prospectFitScore: entityScores.prospectFitScore,
        dataQualityScore: entityScores.dataQualityScore,
        bucket: entityScores.bucket,
      })
      .from(entityScores)
      .where(
        and(
          eq(entityScores.metroId, metroId),
          eq(entityScores.bucket, "TARGET"),
          sql`${entityScores.prospectFitScore} >= 70`
        )
      )
      .limit(30);

    for (const score of highScoreEntities) {
      const [biz] = await db
        .select({ id: businesses.id, name: businesses.name, claimStatus: businesses.claimStatus, isVerified: businesses.isVerified })
        .from(businesses)
        .where(eq(businesses.id, score.entityId))
        .limit(1);

      if (!biz || (biz.claimStatus === "CLAIMED" && biz.isVerified)) continue;

      triggers.push({
        triggerType: "opportunity_detected",
        entityId: score.entityId,
        entityName: biz.name,
        recommendedNextAction: biz.claimStatus === "UNCLAIMED" ? "initiate_outreach" : "suggest_verification",
        priority: score.prospectFitScore >= 85 ? "high" : "medium",
        reason: `High prospect fit score (${score.prospectFitScore}) — strong candidate for engagement`,
        metadata: {
          prospectFitScore: score.prospectFitScore,
          dataQualityScore: score.dataQualityScore,
          bucket: score.bucket,
        },
      });
    }

    const venueOpportunities = await db
      .select({
        id: businesses.id,
        name: businesses.name,
        venueScreenLikely: businesses.venueScreenLikely,
        listingTier: businesses.listingTier,
      })
      .from(businesses)
      .where(
        and(
          eq(businesses.cityId, metroId),
          eq(businesses.claimStatus, "CLAIMED"),
          eq(businesses.isVerified, true),
          eq(businesses.venueScreenLikely, true),
          sql`${businesses.listingTier} IN ('FREE', 'VERIFIED')`
        )
      )
      .limit(15);

    for (const biz of venueOpportunities) {
      const alreadyTriggered = triggers.some(t => t.entityId === biz.id);
      if (!alreadyTriggered) {
        triggers.push({
          triggerType: "opportunity_detected",
          entityId: biz.id,
          entityName: biz.name,
          recommendedNextAction: "suggest_tv_venue",
          priority: "medium",
          reason: "Venue-type business on low tier — TV/venue screen upgrade opportunity",
          metadata: { currentTier: biz.listingTier, venueScreenLikely: true },
        });
      }
    }

    const jobMarketplaceFitCandidates = await db
      .select({
        entityId: entityScores.entityId,
        prospectFitScore: entityScores.prospectFitScore,
        dataQualityScore: entityScores.dataQualityScore,
      })
      .from(entityScores)
      .where(
        and(
          eq(entityScores.metroId, metroId),
          sql`${entityScores.prospectFitScore} >= 50`,
          sql`${entityScores.dataQualityScore} >= 60`
        )
      )
      .limit(20);

    for (const score of jobMarketplaceFitCandidates) {
      const [biz] = await db
        .select({ id: businesses.id, name: businesses.name, claimStatus: businesses.claimStatus, isVerified: businesses.isVerified, listingType: businesses.listingType })
        .from(businesses)
        .where(and(eq(businesses.id, score.entityId), eq(businesses.cityId, metroId)))
        .limit(1);

      if (!biz || !biz.isVerified || biz.claimStatus !== "CLAIMED") continue;
      if (biz.listingType !== "business" && biz.listingType !== "org") continue;

      const alreadyTriggered = triggers.some(t => t.entityId === biz.id);
      if (!alreadyTriggered) {
        triggers.push({
          triggerType: "opportunity_detected",
          entityId: biz.id,
          entityName: biz.name,
          recommendedNextAction: "suggest_marketplace_listing",
          priority: score.prospectFitScore >= 70 ? "medium" : "low",
          reason: `Good data quality (${score.dataQualityScore}) and fit score (${score.prospectFitScore}) — ready for jobs/marketplace participation`,
          metadata: {
            prospectFitScore: score.prospectFitScore,
            dataQualityScore: score.dataQualityScore,
            opportunityType: "job_marketplace_fit",
          },
        });
      }
    }

    const crownCandidates = await db
      .select({
        businessId: trustProfiles.businessId,
        trustLevel: trustProfiles.trustLevel,
        operationalStatus: trustProfiles.operationalStatus,
      })
      .from(trustProfiles)
      .where(
        and(
          sql`${trustProfiles.trustLevel} IN ('T4', 'T5')`,
          eq(trustProfiles.operationalStatus, "active")
        )
      )
      .limit(20);

    for (const profile of crownCandidates) {
      const [biz] = await db
        .select({ id: businesses.id, name: businesses.name, listingTier: businesses.listingTier })
        .from(businesses)
        .where(and(eq(businesses.id, profile.businessId), eq(businesses.cityId, metroId)))
        .limit(1);

      if (!biz) continue;

      const isAlreadyCrown = biz.listingTier === "ENHANCED" || biz.listingTier === "ENTERPRISE";
      if (isAlreadyCrown) continue;

      triggers.push({
        triggerType: "opportunity_detected",
        entityId: biz.id,
        entityName: biz.name,
        recommendedNextAction: "suggest_crown_participation",
        priority: "high",
        reason: `Trust level ${profile.trustLevel} — strong Crown candidate`,
        metadata: { trustLevel: profile.trustLevel, currentTier: biz.listingTier },
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[EngagementTriggers] Opportunity check error:", msg);
  }

  return triggers;
}

export async function evaluateSeasonalTriggers(
  metroId: string
): Promise<EngagementTrigger[]> {
  const triggers: EngagementTrigger[] = [];
  const now = new Date();
  const month = now.getMonth();
  const dayOfWeek = now.getDay();

  interface SeasonalMoment {
    label: string;
    months: number[];
    prompt: string;
    actionKey: string;
  }

  const seasonalMoments: SeasonalMoment[] = [
    { label: "New Year Fresh Start", months: [0], prompt: `Start the year strong — update your listing and share your ${new Date().getFullYear()} goals with the community.`, actionKey: "suggest_new_year_update" },
    { label: "Spring Season", months: [2, 3], prompt: "Spring is here — great time to share seasonal offerings or upcoming events.", actionKey: "suggest_spring_content" },
    { label: "Summer Season", months: [5, 6], prompt: "Summer's in full swing — share what's happening at your business this season.", actionKey: "suggest_summer_content" },
    { label: "Back to School", months: [7], prompt: "Back-to-school season — a great moment to connect with families in your area.", actionKey: "suggest_back_to_school" },
    { label: "Holiday Season", months: [10, 11], prompt: "Holiday season is here — share your specials, events, and gift ideas with the community.", actionKey: "suggest_holiday_content" },
  ];

  try {
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const upcomingLocalEvents = await db
      .select({
        id: events.id,
        title: events.title,
        startDateTime: events.startDateTime,
        hostBusinessId: events.hostBusinessId,
      })
      .from(events)
      .where(
        and(
          eq(events.cityId, metroId),
          sql`${events.startDateTime} BETWEEN NOW() AND ${nextWeek}`,
          eq(events.visibility, "public")
        )
      )
      .limit(10);

    for (const evt of upcomingLocalEvents) {
      if (!evt.hostBusinessId) continue;
      const [biz] = await db
        .select({ id: businesses.id, name: businesses.name, claimStatus: businesses.claimStatus })
        .from(businesses)
        .where(and(eq(businesses.id, evt.hostBusinessId), eq(businesses.claimStatus, "CLAIMED")))
        .limit(1);

      if (biz) {
        triggers.push({
          triggerType: "seasonal_moment",
          entityId: biz.id,
          entityName: biz.name,
          recommendedNextAction: "suggest_event_promotion",
          priority: "medium",
          reason: `Upcoming local event "${evt.title}" — great moment to promote and engage the community`,
          metadata: { localMomentType: "upcoming_event", eventId: evt.id, eventTitle: evt.title },
        });
      }
    }
  } catch (localErr: unknown) {
    const msg = localErr instanceof Error ? localErr.message : "Unknown error";
    console.error("[EngagementTriggers] Local moment check error:", msg);
  }

  const activeMoment = seasonalMoments.find(m => m.months.includes(month));
  if (!activeMoment) return triggers;

  if (dayOfWeek !== 1) return triggers;

  try {
    const claimedBusinesses = await db
      .select({ id: businesses.id, name: businesses.name })
      .from(businesses)
      .where(
        and(
          eq(businesses.cityId, metroId),
          eq(businesses.claimStatus, "CLAIMED"),
          eq(businesses.isVerified, true)
        )
      )
      .limit(20);

    for (const biz of claimedBusinesses) {
      triggers.push({
        triggerType: "seasonal_moment",
        entityId: biz.id,
        entityName: biz.name,
        recommendedNextAction: activeMoment.actionKey,
        priority: "low",
        reason: activeMoment.label,
        metadata: { seasonalPrompt: activeMoment.prompt, month },
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[EngagementTriggers] Seasonal check error:", msg);
  }

  return triggers;
}

export async function evaluateAllTriggers(
  metroId: string,
  options: { inactivityConfig?: Partial<InactivityConfig> } = {}
): Promise<EngagementTrigger[]> {
  const [inactivity, newCapability, opportunity, seasonal] = await Promise.all([
    evaluateInactivityTriggers(metroId, options.inactivityConfig),
    evaluateNewCapabilityTriggers(metroId),
    evaluateOpportunityTriggers(metroId),
    evaluateSeasonalTriggers(metroId),
  ]);

  const allTriggers = [...inactivity, ...newCapability, ...opportunity, ...seasonal];

  const priorityOrder: Record<EngagementPriority, number> = { high: 0, medium: 1, low: 2 };
  allTriggers.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  console.log(`[EngagementTriggers] Evaluated ${allTriggers.length} triggers for metro ${metroId} (${inactivity.length} inactivity, ${newCapability.length} new capability, ${opportunity.length} opportunity, ${seasonal.length} seasonal)`);

  return allTriggers;
}

export type ParticipationSurface =
  | "pulse"
  | "events"
  | "jobs"
  | "marketplace"
  | "tv_venue"
  | "radio"
  | "print";

export interface ParticipationSuggestion {
  surface: ParticipationSurface;
  reason: string;
  actionTemplateKey?: string;
  priority: EngagementPriority;
}

export async function getParticipationSuggestions(
  entityId: string
): Promise<ParticipationSuggestion[]> {
  const suggestions: ParticipationSuggestion[] = [];

  try {
    const [biz] = await db
      .select({
        id: businesses.id,
        name: businesses.name,
        listingTier: businesses.listingTier,
        listingType: businesses.listingType,
        claimStatus: businesses.claimStatus,
        isVerified: businesses.isVerified,
        categoryIds: businesses.categoryIds,
        description: businesses.description,
        address: businesses.address,
      })
      .from(businesses)
      .where(eq(businesses.id, entityId))
      .limit(1);

    if (!biz) return suggestions;

    const [scores] = await db
      .select({
        prospectFitScore: entityScores.prospectFitScore,
        dataQualityScore: entityScores.dataQualityScore,
      })
      .from(entityScores)
      .where(eq(entityScores.entityId, entityId))
      .limit(1);

    const [trust] = await db
      .select({
        trustLevel: trustProfiles.trustLevel,
        operationalStatus: trustProfiles.operationalStatus,
      })
      .from(trustProfiles)
      .where(eq(trustProfiles.businessId, entityId))
      .limit(1);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [recentPostCount] = await db
      .select({ total: count() })
      .from(posts)
      .where(
        and(
          eq(posts.businessId, entityId),
          gt(posts.createdAt, thirtyDaysAgo)
        )
      );

    const [recentEventCount] = await db
      .select({ total: count() })
      .from(events)
      .where(
        and(
          eq(events.hostBusinessId, entityId),
          gt(events.startDateTime, thirtyDaysAgo)
        )
      );

    const recentPosts = recentPostCount?.total || 0;
    const recentEvents = recentEventCount?.total || 0;
    const fitScore = scores?.prospectFitScore || 0;
    const qualityScore = scores?.dataQualityScore || 0;

    const trustRank: Record<string, number> = { T0: 0, T1: 1, T2: 2, T3: 3, T4: 4, T5: 5 };
    const currentTrustRank = trustRank[(trust?.trustLevel as string) || "T0"] || 0;

    if (biz.isVerified && biz.claimStatus === "CLAIMED") {
      const pulsePriority: EngagementPriority = recentPosts === 0 ? "high" : recentPosts < 3 ? "medium" : "low";
      const pulseReason = recentPosts === 0
        ? "No recent Pulse posts — sharing updates keeps your business visible and top-of-mind"
        : `${recentPosts} post(s) in the last 30 days — keep the momentum going with regular updates`;
      suggestions.push({
        surface: "pulse",
        reason: pulseReason,
        actionTemplateKey: "CREATE_PULSE_POST",
        priority: pulsePriority,
      });
    }

    const isVenueType = biz.listingType === "venue" ||
      (biz.description?.toLowerCase().includes("restaurant") ||
       biz.description?.toLowerCase().includes("bar") ||
       biz.description?.toLowerCase().includes("cafe") ||
       biz.description?.toLowerCase().includes("shop"));

    if (isVenueType && biz.address) {
      const eventPriority: EngagementPriority = recentEvents === 0 ? "medium" : "low";
      suggestions.push({
        surface: "events",
        reason: recentEvents === 0
          ? "Your space could host community events — no events listed recently, great opportunity for visibility"
          : `${recentEvents} recent event(s) — keep engaging the community with more gatherings`,
        actionTemplateKey: "CREATE_EVENT",
        priority: eventPriority,
      });

      suggestions.push({
        surface: "tv_venue",
        reason: "Venue screens bring the hub into your physical space — customers see local content on-screen",
        actionTemplateKey: "TV_VENUE_SCREEN",
        priority: "medium",
      });
    }

    if (biz.listingType === "business" || biz.listingType === "org") {
      const jobPriority: EngagementPriority = fitScore >= 70 ? "medium" : "low";
      suggestions.push({
        surface: "jobs",
        reason: fitScore >= 70
          ? `Strong community fit (score: ${fitScore}) — posting jobs helps you reach local talent`
          : "Post open positions to reach local talent through the hub's jobs board",
        actionTemplateKey: "POST_JOB",
        priority: jobPriority,
      });
    }

    const marketplacePriority: EngagementPriority = qualityScore >= 60 && fitScore >= 50 ? "medium" : "low";
    suggestions.push({
      surface: "marketplace",
      reason: qualityScore >= 60
        ? `Good data quality (${qualityScore}) — your profile is ready for marketplace listings`
        : "List products, services, or offers in the community marketplace",
      actionTemplateKey: "CREATE_MARKETPLACE_LISTING",
      priority: marketplacePriority,
    });

    if (currentTrustRank >= 2) {
      suggestions.push({
        surface: "radio",
        reason: `Trust level ${trust?.trustLevel} qualifies you for radio features — reach listeners across the metro`,
        actionTemplateKey: "RADIO_FEATURE",
        priority: currentTrustRank >= 4 ? "high" : "medium",
      });
    }

    if (currentTrustRank >= 3 && biz.listingTier !== "FREE") {
      suggestions.push({
        surface: "print",
        reason: `Trust level ${trust?.trustLevel} with ${biz.listingTier} tier — strong candidate for print features`,
        actionTemplateKey: "PRINT_FEATURE",
        priority: currentTrustRank >= 4 ? "medium" : "low",
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[EngagementTriggers] Participation suggestions error:", msg);
  }

  return suggestions;
}
