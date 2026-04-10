import { db } from "./db";
import { eq, sql, desc, and, isNotNull, inArray } from "drizzle-orm";
import {
  businesses,
  profileBadges,
  crownParticipants,
  crownWinners,
  charlotteFlowSessions,
  trustProfiles,
  trustStatusHistory,
  type TrustSignalSnapshot,
  type TrustProfile,
} from "@shared/schema";

type TrustLevel = "T0" | "T1" | "T2" | "T3" | "T4" | "T5";
type OperationalStatus = "eligible" | "qualified" | "active" | "needs_attention" | "at_risk" | "paused" | "removed";

const TRUST_BADGE_TYPES = ["TRUST_ACTIVE", "TRUST_GROWING", "TRUST_NEEDS_ATTENTION"] as const;
type TrustBadgeType = typeof TRUST_BADGE_TYPES[number];

const TRUST_LEVEL_RANK: Record<TrustLevel, number> = { T0: 0, T1: 1, T2: 2, T3: 3, T4: 4, T5: 5 };

function trustLevelAtLeast(level: TrustLevel, min: TrustLevel): boolean {
  return TRUST_LEVEL_RANK[level] >= TRUST_LEVEL_RANK[min];
}

const INACTIVITY_THRESHOLD_DAYS = 90;
const AT_RISK_THRESHOLD_DAYS = 180;

async function gatherSignals(businessId: string): Promise<TrustSignalSnapshot | null> {
  const [biz] = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
  if (!biz) return null;

  const allBadges = await db
    .select()
    .from(profileBadges)
    .where(and(eq(profileBadges.businessId, businessId), eq(profileBadges.enabled, true)));

  const badges = allBadges.filter(b => !TRUST_BADGE_TYPES.includes(b.badgeType as TrustBadgeType));

  const crownRows = await db
    .select()
    .from(crownParticipants)
    .where(eq(crownParticipants.businessId, businessId));

  const winnerRows = crownRows.length > 0
    ? await db
        .select()
        .from(crownWinners)
        .where(inArray(crownWinners.participantId, crownRows.map(r => r.id)))
    : [];

  const [latestSession] = await db
    .select()
    .from(charlotteFlowSessions)
    .where(eq(charlotteFlowSessions.businessId, businessId))
    .orderBy(desc(charlotteFlowSessions.updatedAt))
    .limit(1);

  const storyDepthScore = latestSession?.storyDepthScore ?? 0;

  const lastActivityAt = biz.updatedAt ? biz.updatedAt.toISOString() : null;
  let daysSinceLastActivity: number | null = null;
  if (biz.updatedAt) {
    daysSinceLastActivity = Math.floor((Date.now() - biz.updatedAt.getTime()) / (1000 * 60 * 60 * 24));
  }

  const reviewCount = biz.googleReviewCount ?? 0;
  const averageRating = biz.googleRating ? parseFloat(biz.googleRating) : 0;

  return {
    isVerified: biz.isVerified,
    claimStatus: biz.claimStatus,
    reviewCount,
    averageRating,
    badgeCount: badges.length,
    activeBadges: badges.map(b => b.badgeType),
    isCrownParticipant: crownRows.length > 0,
    isCrownWinner: winnerRows.length > 0,
    storyDepthScore,
    lastActivityAt,
    daysSinceLastActivity,
  };
}

function computeTrustLevel(signals: TrustSignalSnapshot): TrustLevel {
  let score = 0;

  if (signals.isVerified) score += 20;
  if (signals.claimStatus === "CLAIMED") score += 10;

  if (signals.reviewCount >= 50 && signals.averageRating >= 4.5) score += 20;
  else if (signals.reviewCount >= 20 && signals.averageRating >= 4.0) score += 15;
  else if (signals.reviewCount >= 5 && signals.averageRating >= 3.5) score += 10;
  else if (signals.reviewCount >= 1) score += 5;

  if (signals.badgeCount >= 5) score += 15;
  else if (signals.badgeCount >= 3) score += 10;
  else if (signals.badgeCount >= 1) score += 5;

  if (signals.isCrownWinner) score += 15;
  else if (signals.isCrownParticipant) score += 8;

  if (signals.storyDepthScore >= 80) score += 15;
  else if (signals.storyDepthScore >= 60) score += 10;
  else if (signals.storyDepthScore >= 30) score += 5;

  if (signals.daysSinceLastActivity !== null && signals.daysSinceLastActivity <= 30) score += 5;

  if (score >= 80) return "T5";
  if (score >= 65) return "T4";
  if (score >= 45) return "T3";
  if (score >= 25) return "T2";
  if (score >= 10) return "T1";
  return "T0";
}

function computeOperationalStatus(
  signals: TrustSignalSnapshot,
  trustLevel: TrustLevel,
  currentStatus?: OperationalStatus
): OperationalStatus {
  if (currentStatus === "removed" || currentStatus === "paused") {
    return currentStatus;
  }

  if (signals.daysSinceLastActivity !== null && signals.daysSinceLastActivity >= AT_RISK_THRESHOLD_DAYS) {
    return "at_risk";
  }

  if (signals.daysSinceLastActivity !== null && signals.daysSinceLastActivity >= INACTIVITY_THRESHOLD_DAYS) {
    return "needs_attention";
  }

  if (signals.averageRating > 0 && signals.averageRating < 2.5 && signals.reviewCount >= 5) {
    return "needs_attention";
  }

  if (trustLevel === "T0") return "eligible";

  if (signals.isVerified && trustLevelAtLeast(trustLevel, "T2")) return "active";
  if (signals.isVerified || trustLevelAtLeast(trustLevel, "T1")) return "qualified";

  return "eligible";
}

function computeNetworkEligibility(
  signals: TrustSignalSnapshot,
  trustLevel: TrustLevel,
  operationalStatus: OperationalStatus
): boolean {
  if (!signals.isVerified) return false;
  if (!trustLevelAtLeast(trustLevel, "T2")) return false;
  if (operationalStatus === "at_risk" || operationalStatus === "paused" || operationalStatus === "removed") return false;
  return true;
}

function determineTrustBadges(
  signals: TrustSignalSnapshot,
  operationalStatus: OperationalStatus
): TrustBadgeType[] {
  const badges: TrustBadgeType[] = [];

  if (operationalStatus === "active" && signals.daysSinceLastActivity !== null && signals.daysSinceLastActivity <= 30) {
    badges.push("TRUST_ACTIVE");
  }

  if (
    signals.reviewCount > 0 &&
    signals.averageRating >= 4.0 &&
    operationalStatus === "active"
  ) {
    badges.push("TRUST_GROWING");
  }

  if (operationalStatus === "needs_attention" || operationalStatus === "at_risk") {
    badges.push("TRUST_NEEDS_ATTENTION");
  }

  return badges;
}

async function syncTrustBadges(businessId: string, desiredBadges: TrustBadgeType[]): Promise<void> {
  const existingBadges = await db
    .select()
    .from(profileBadges)
    .where(
      and(
        eq(profileBadges.businessId, businessId),
        inArray(profileBadges.badgeType, TRUST_BADGE_TYPES as unknown as string[])
      )
    );

  const existingTypeSet = new Set(existingBadges.map(b => b.badgeType));
  const desiredSet = new Set(desiredBadges);

  for (const badge of desiredBadges) {
    if (!existingTypeSet.has(badge)) {
      await db.insert(profileBadges).values({
        businessId,
        badgeType: badge,
        enabled: true,
      }).onConflictDoNothing();
    } else {
      const existing = existingBadges.find(b => b.badgeType === badge);
      if (existing && !existing.enabled) {
        await db.update(profileBadges)
          .set({ enabled: true, updatedAt: new Date() })
          .where(eq(profileBadges.id, existing.id));
      }
    }
  }

  for (const existing of existingBadges) {
    if (!desiredSet.has(existing.badgeType as TrustBadgeType) && existing.enabled) {
      await db.update(profileBadges)
        .set({ enabled: false, updatedAt: new Date() })
        .where(eq(profileBadges.id, existing.id));
    }
  }
}

export async function computeTrustProfile(businessId: string): Promise<TrustProfile | null> {
  const signals = await gatherSignals(businessId);
  if (!signals) return null;

  const [existing] = await db
    .select()
    .from(trustProfiles)
    .where(eq(trustProfiles.businessId, businessId))
    .limit(1);

  const existingStoryFields = existing?.storyTrustFields as { serviceClarity: number; localRelevance: number; communityInvolvement: number } | null;
  if (existingStoryFields) {
    signals.storyTrustFields = existingStoryFields;
  }

  const trustLevel = computeTrustLevel(signals);

  const currentStatus = existing?.operationalStatus as OperationalStatus | undefined;
  const operationalStatus = computeOperationalStatus(signals, trustLevel, currentStatus);
  const isEligibleForNetwork = computeNetworkEligibility(signals, trustLevel, operationalStatus);
  const isQualified = trustLevelAtLeast(trustLevel, "T2") && signals.isVerified;
  const trustBadges = determineTrustBadges(signals, operationalStatus);
  const now = new Date();

  const systemLabels = trustBadges.map(b => b.replace("TRUST_", ""));

  await syncTrustBadges(businessId, trustBadges);

  const decayDetectedAt = (signals.daysSinceLastActivity !== null && signals.daysSinceLastActivity >= INACTIVITY_THRESHOLD_DAYS) ? now : null;

  if (existing) {
    const levelChanged = existing.trustLevel !== trustLevel;
    const statusChanged = existing.operationalStatus !== operationalStatus;

    if (levelChanged || statusChanged) {
      await db.insert(trustStatusHistory).values({
        profileId: existing.id,
        previousLevel: existing.trustLevel as TrustLevel,
        newLevel: trustLevel,
        previousStatus: existing.operationalStatus as OperationalStatus,
        newStatus: operationalStatus,
        reason: buildChangeReason(existing.trustLevel as TrustLevel, trustLevel, existing.operationalStatus as OperationalStatus, operationalStatus),
        changedBy: "system",
      });
    }

    const existingLabels = ((existing.contextLabels || []) as string[]).filter(l => !["ACTIVE", "GROWING", "NEEDS_ATTENTION"].includes(l));
    const mergedLabels = [...new Set([...existingLabels, ...systemLabels])];

    const [updated] = await db
      .update(trustProfiles)
      .set({
        trustLevel,
        operationalStatus,
        signalSnapshot: signals,
        contextLabels: mergedLabels,
        storyTrustFields: existing.storyTrustFields,
        isEligibleForNetwork,
        isQualified,
        decayDetectedAt,
        lastComputedAt: now,
        updatedAt: now,
      })
      .where(eq(trustProfiles.id, existing.id))
      .returning();

    return updated;
  }

  const [created] = await db
    .insert(trustProfiles)
    .values({
      businessId,
      trustLevel,
      operationalStatus,
      signalSnapshot: signals,
      contextLabels: systemLabels,
      isEligibleForNetwork,
      isQualified,
      decayDetectedAt,
      lastComputedAt: now,
    })
    .returning();

  await db.insert(trustStatusHistory).values({
    profileId: created.id,
    previousLevel: null,
    newLevel: trustLevel,
    previousStatus: null,
    newStatus: operationalStatus,
    reason: "Initial trust profile computation",
    changedBy: "system",
  });

  return created;
}

function buildChangeReason(
  prevLevel: TrustLevel,
  newLevel: TrustLevel,
  prevStatus: OperationalStatus,
  newStatus: OperationalStatus
): string {
  const parts: string[] = [];
  if (prevLevel !== newLevel) {
    parts.push(`Trust level changed from ${prevLevel} to ${newLevel}`);
  }
  if (prevStatus !== newStatus) {
    parts.push(`Operational status changed from ${prevStatus} to ${newStatus}`);
  }
  return parts.join("; ") || "Trust profile recomputed";
}

export async function getTrustProfile(businessId: string): Promise<TrustProfile | null> {
  const [profile] = await db
    .select()
    .from(trustProfiles)
    .where(eq(trustProfiles.businessId, businessId))
    .limit(1);
  return profile || null;
}

export async function getTrustHistory(profileId: string, limit = 50) {
  const safeLimit = Math.max(1, Math.min(limit, 200));
  return db
    .select()
    .from(trustStatusHistory)
    .where(eq(trustStatusHistory.profileId, profileId))
    .orderBy(desc(trustStatusHistory.createdAt))
    .limit(safeLimit);
}

export async function updateOperationalStatus(
  businessId: string,
  newStatus: OperationalStatus,
  reason: string,
  changedBy: string
): Promise<TrustProfile | null> {
  const [profile] = await db
    .select()
    .from(trustProfiles)
    .where(eq(trustProfiles.businessId, businessId))
    .limit(1);

  if (!profile) return null;

  await db.insert(trustStatusHistory).values({
    profileId: profile.id,
    previousLevel: profile.trustLevel as TrustLevel,
    newLevel: profile.trustLevel as TrustLevel,
    previousStatus: profile.operationalStatus as OperationalStatus,
    newStatus: newStatus,
    reason,
    changedBy,
  });

  const isEligibleForNetwork = computeNetworkEligibility(
    profile.signalSnapshot as TrustSignalSnapshot,
    profile.trustLevel as TrustLevel,
    newStatus
  );

  const signals = profile.signalSnapshot as TrustSignalSnapshot;
  const trustBadges = determineTrustBadges(signals, newStatus);
  await syncTrustBadges(profile.businessId, trustBadges);

  const newSystemLabels = trustBadges.map(b => b.replace("TRUST_", ""));
  const existingLabels = ((profile.contextLabels || []) as string[]).filter(l => !["ACTIVE", "GROWING", "NEEDS_ATTENTION"].includes(l));
  const mergedLabels = [...new Set([...existingLabels, ...newSystemLabels])];

  const [updated] = await db
    .update(trustProfiles)
    .set({
      operationalStatus: newStatus,
      isEligibleForNetwork,
      contextLabels: mergedLabels,
      updatedAt: new Date(),
    })
    .where(eq(trustProfiles.id, profile.id))
    .returning();

  return updated;
}

export async function addContextLabel(businessId: string, label: string): Promise<TrustProfile | null> {
  const [profile] = await db
    .select()
    .from(trustProfiles)
    .where(eq(trustProfiles.businessId, businessId))
    .limit(1);

  if (!profile) return null;

  const currentLabels = (profile.contextLabels || []) as string[];
  if (currentLabels.includes(label)) return profile;

  const [updated] = await db
    .update(trustProfiles)
    .set({
      contextLabels: [...currentLabels, label],
      updatedAt: new Date(),
    })
    .where(eq(trustProfiles.id, profile.id))
    .returning();

  return updated;
}

export async function removeContextLabel(businessId: string, label: string): Promise<TrustProfile | null> {
  const [profile] = await db
    .select()
    .from(trustProfiles)
    .where(eq(trustProfiles.businessId, businessId))
    .limit(1);

  if (!profile) return null;

  const currentLabels = (profile.contextLabels || []) as string[];
  const [updated] = await db
    .update(trustProfiles)
    .set({
      contextLabels: currentLabels.filter(l => l !== label),
      updatedAt: new Date(),
    })
    .where(eq(trustProfiles.id, profile.id))
    .returning();

  return updated;
}

export async function runDecayDetection(): Promise<{ flagged: number; atRisk: number; errors: number }> {
  let flagged = 0;
  let atRisk = 0;
  let errors = 0;

  const profiles = await db
    .select()
    .from(trustProfiles)
    .where(
      and(
        sql`${trustProfiles.operationalStatus} NOT IN ('paused', 'removed')`,
        isNotNull(trustProfiles.signalSnapshot)
      )
    );

  for (const profile of profiles) {
    try {
      const freshSignals = await gatherSignals(profile.businessId);
      if (!freshSignals) continue;

      const days = freshSignals.daysSinceLastActivity;
      if (days === null) continue;

      if (days >= AT_RISK_THRESHOLD_DAYS && profile.operationalStatus !== "at_risk") {
        await updateOperationalStatus(profile.businessId, "at_risk", `Inactive for ${days} days (threshold: ${AT_RISK_THRESHOLD_DAYS})`, "decay_detection");
        atRisk++;
      } else if (days >= INACTIVITY_THRESHOLD_DAYS && profile.operationalStatus !== "needs_attention" && profile.operationalStatus !== "at_risk") {
        await updateOperationalStatus(profile.businessId, "needs_attention", `Inactive for ${days} days (threshold: ${INACTIVITY_THRESHOLD_DAYS})`, "decay_detection");
        flagged++;
      }

      if (freshSignals.averageRating > 0 && freshSignals.averageRating < 2.5 && freshSignals.reviewCount >= 5) {
        if (profile.operationalStatus !== "needs_attention" && profile.operationalStatus !== "at_risk") {
          await updateOperationalStatus(profile.businessId, "needs_attention", `Low review rating: ${freshSignals.averageRating} with ${freshSignals.reviewCount} reviews`, "decay_detection");
          flagged++;
        }
      }
    } catch (err) {
      console.error(`[TrustDecay] Error processing profile ${profile.id}:`, err);
      errors++;
    }
  }

  console.log(`[TrustDecay] Scan complete: ${flagged} flagged, ${atRisk} at-risk, ${errors} errors`);
  return { flagged, atRisk, errors };
}

export async function recoverBusiness(businessId: string, reason: string, changedBy: string): Promise<TrustProfile | null> {
  const result = await computeTrustProfile(businessId);
  if (!result) return null;

  const signals = result.signalSnapshot as TrustSignalSnapshot;
  const trustLevel = result.trustLevel as TrustLevel;
  const newStatus = computeOperationalStatus(signals, trustLevel);

  if (newStatus === "at_risk" || newStatus === "needs_attention") {
    return result;
  }

  return updateOperationalStatus(businessId, newStatus, `Recovery: ${reason}`, changedBy);
}

export async function computeAllTrustProfiles(cityId?: string): Promise<{ processed: number; errors: number }> {
  let query = db.select({ id: businesses.id }).from(businesses);

  let rows: { id: string }[];
  if (cityId) {
    rows = await query.where(eq(businesses.cityId, cityId));
  } else {
    rows = await query;
  }

  let processed = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      await computeTrustProfile(row.id);
      processed++;
    } catch (err) {
      console.error(`[TrustCompute] Error computing trust for ${row.id}:`, err);
      errors++;
    }
  }

  console.log(`[TrustCompute] Batch complete: ${processed} processed, ${errors} errors`);
  return { processed, errors };
}

export async function checkNetworkEligibility(businessId: string): Promise<{ eligible: boolean; reasons: string[] }> {
  const profile = await getTrustProfile(businessId);
  const reasons: string[] = [];

  if (!profile) {
    return { eligible: false, reasons: ["No trust profile found"] };
  }

  const signals = profile.signalSnapshot as TrustSignalSnapshot;

  if (!signals?.isVerified) {
    reasons.push("Business must be verified");
  }

  if (!trustLevelAtLeast(profile.trustLevel as TrustLevel, "T2")) {
    reasons.push(`Trust level must be T2 or higher (current: ${profile.trustLevel})`);
  }

  const blockedStatuses: OperationalStatus[] = ["at_risk", "paused", "removed"];
  if (blockedStatuses.includes(profile.operationalStatus as OperationalStatus)) {
    reasons.push(`Operational status '${profile.operationalStatus}' blocks network eligibility`);
  }

  return { eligible: reasons.length === 0, reasons };
}

export async function updateStoryTrustFields(
  businessId: string,
  storyTrustFields: { serviceClarity: number; localRelevance: number; communityInvolvement: number }
): Promise<TrustProfile | null> {
  const [profile] = await db
    .select()
    .from(trustProfiles)
    .where(eq(trustProfiles.businessId, businessId))
    .limit(1);

  if (!profile) {
    const computed = await computeTrustProfile(businessId);
    if (!computed) return null;

    const snapshot = (computed.signalSnapshot || {}) as TrustSignalSnapshot;
    snapshot.storyTrustFields = storyTrustFields;

    const [updated] = await db
      .update(trustProfiles)
      .set({ storyTrustFields, signalSnapshot: snapshot, updatedAt: new Date() })
      .where(eq(trustProfiles.id, computed.id))
      .returning();

    return updated;
  }

  const snapshot = (profile.signalSnapshot || {}) as TrustSignalSnapshot;
  snapshot.storyTrustFields = storyTrustFields;

  const [updated] = await db
    .update(trustProfiles)
    .set({ storyTrustFields, signalSnapshot: snapshot, updatedAt: new Date() })
    .where(eq(trustProfiles.id, profile.id))
    .returning();

  return updated;
}
