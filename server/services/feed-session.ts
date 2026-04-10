import { randomUUID } from "crypto";

export type GeoContext = "near_me" | "home" | "work" | "metro";

export const FEED_CAP_CONFIG = {
  STRICT_PHASE_LENGTH: 40,
  SPONSORED_CAP_FIRST_15: 1,
  SAME_ENTITY_CAP_FIRST_25: 2,
  VIDEO_STREAK_CAP: 4,
  TYPE_REPEAT_CAP_FIRST_20: 2,
  SOURCE_CAP_PER_20: 2,

  SPONSORED_CAP_RELAXED_PER_25: 2,
  SAME_ENTITY_CAP_RELAXED_PER_40: 3,
  VIDEO_STREAK_CAP_RELAXED: 6,
  TYPE_REPEAT_CAP_RELAXED: 2,

  ENHANCED_CAP_FIRST_10: 1,
  ENHANCED_CAP_PER_PAGE: 3,
  ENHANCED_SPONSORED_MIN_GAP: 3,
};

const SESSION_TTL_MS = 30 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

interface AcceptedItemRecord {
  position: number;
  isSponsored: boolean;
  entityId: string | null;
  isVideo: boolean;
  type: string;
  sourceName: string | null;
  categorySlug: string | null;
}

export interface FeedSession {
  feedSessionId: string;
  userId: string | null;
  metroId: string;
  geoContext: GeoContext;
  startedAt: number;
  lastSeenAt: number;
  consumedCount: number;
  acceptedHistory: AcceptedItemRecord[];
  videoStreak: number;
  typeStreak: number;
  lastType: string | null;
  skippedLog: Array<{ itemId: string; reason: string }>;
}

const sessions = new Map<string, FeedSession>();

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function startCleanupIfNeeded() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (now - session.lastSeenAt > SESSION_TTL_MS) {
        sessions.delete(id);
      }
    }
    if (sessions.size === 0 && cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  }, CLEANUP_INTERVAL_MS);
  if (cleanupTimer && typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

export function createFeedSession(
  metroId: string,
  geoContext: GeoContext,
  userId: string | null = null
): FeedSession {
  const now = Date.now();
  const session: FeedSession = {
    feedSessionId: randomUUID(),
    userId,
    metroId,
    geoContext,
    startedAt: now,
    lastSeenAt: now,
    consumedCount: 0,
    acceptedHistory: [],
    videoStreak: 0,
    typeStreak: 1,
    lastType: null,
    skippedLog: [],
  };
  sessions.set(session.feedSessionId, session);
  startCleanupIfNeeded();
  return session;
}

export function getFeedSession(feedSessionId: string): FeedSession | null {
  const session = sessions.get(feedSessionId);
  if (!session) return null;
  const now = Date.now();
  if (now - session.lastSeenAt > SESSION_TTL_MS) {
    sessions.delete(feedSessionId);
    return null;
  }
  session.lastSeenAt = now;
  return session;
}

export function deleteFeedSession(feedSessionId: string): boolean {
  return sessions.delete(feedSessionId);
}

export function getActiveSessionCount(): number {
  return sessions.size;
}

export interface SkipReason {
  itemId: string;
  reason: string;
}

function isVideoType(item: { mediaType?: string; type: string; videoUrl?: string | null; videoEmbedUrl?: string | null }): boolean {
  return (
    item.type === "reel" ||
    item.mediaType === "video" ||
    item.mediaType === "reel" ||
    !!(item.videoUrl || item.videoEmbedUrl)
  );
}

function getEntityId(item: { type: string; id: string; sponsorshipMeta?: { businessName?: string } }): string | null {
  if ((item.type === "sponsored" || item.type === "business" || item.type === "enhanced_listing") && item.sponsorshipMeta?.businessName) {
    return `biz:${item.sponsorshipMeta.businessName}`;
  }
  if (item.type === "business" || item.type === "sponsored" || item.type === "enhanced_listing") {
    return `biz:${item.id}`;
  }
  return null;
}

function countInWindow(history: AcceptedItemRecord[], windowSize: number, predicate: (r: AcceptedItemRecord) => boolean): number {
  const start = Math.max(0, history.length - windowSize);
  let count = 0;
  for (let i = start; i < history.length; i++) {
    if (predicate(history[i])) count++;
  }
  return count;
}

export function constrainedSelect<T extends {
  id: string;
  type: string;
  sponsored: boolean;
  mediaType?: string;
  videoUrl?: string | null;
  videoEmbedUrl?: string | null;
  sponsorshipMeta?: { tier: string; businessName: string };
  sourceName?: string | null;
  geoMeta?: { categoryCoreSlug?: string | null };
  primaryTag?: { slug: string } | null;
}>(
  rankedPool: T[],
  session: FeedSession,
  pageLimit: number
): { accepted: T[]; skipped: SkipReason[] } {
  const accepted: T[] = [];
  const skipped: SkipReason[] = [];
  const typeStreakDeferred: T[] = [];

  const localHistory: AcceptedItemRecord[] = [];
  let localVideoStreak = session.videoStreak;
  let localTypeStreak = session.typeStreak;
  let localLastType = session.lastType;

  const fullHistory = () => [...session.acceptedHistory, ...localHistory];

  function getItemSourceName(item: T): string | null {
    return item.sourceName || null;
  }

  function getItemCategory(item: T): string | null {
    return item.geoMeta?.categoryCoreSlug || item.primaryTag?.slug || null;
  }

  const acceptItem = (item: T) => {
    const isSponsored = item.sponsored || item.type === "sponsored";
    const entityId = getEntityId(item);
    const isVideo = isVideoType(item);
    const itemType = item.type;
    const position = session.consumedCount + accepted.length + 1;
    const srcName = getItemSourceName(item);
    const catSlug = getItemCategory(item);

    accepted.push(item);
    localHistory.push({ position, isSponsored, entityId, isVideo, type: itemType, sourceName: srcName, categorySlug: catSlug });

    if (isVideo) { localVideoStreak++; } else { localVideoStreak = 0; }
    if (localLastType === itemType) { localTypeStreak++; } else { localTypeStreak = 1; }
    localLastType = itemType;
  };

  for (const item of rankedPool) {
    if (accepted.length >= pageLimit) break;

    const position = session.consumedCount + accepted.length + 1;
    const isRelaxed = position > FEED_CAP_CONFIG.STRICT_PHASE_LENGTH;
    const reasons: string[] = [];
    let isTypeStreakOnly = false;

    const isSponsored = item.sponsored || item.type === "sponsored";
    const entityId = getEntityId(item);
    const isVideo = isVideoType(item);
    const itemType = item.type;

    if (isSponsored) {
      if (!isRelaxed) {
        if (position <= 15) {
          const sponsoredInFirst15 = fullHistory().filter(r => r.position <= 15 && r.isSponsored).length + 1;
          if (sponsoredInFirst15 > FEED_CAP_CONFIG.SPONSORED_CAP_FIRST_15) {
            reasons.push(`Sponsored cap: ${sponsoredInFirst15}/${FEED_CAP_CONFIG.SPONSORED_CAP_FIRST_15} in first 15`);
          }
        }
      } else {
        const sponsoredInLast25 = countInWindow(fullHistory(), 25, r => r.isSponsored) + 1;
        if (sponsoredInLast25 > FEED_CAP_CONFIG.SPONSORED_CAP_RELAXED_PER_25) {
          reasons.push(`Relaxed sponsored cap: ${sponsoredInLast25}/${FEED_CAP_CONFIG.SPONSORED_CAP_RELAXED_PER_25} per 25`);
        }
      }
    }

    const isEnhanced = itemType === "enhanced_listing";
    if (isEnhanced) {
      const history = fullHistory();
      if (position <= 10) {
        const enhInFirst10 = history.filter(r => r.position <= 10 && r.type === "enhanced_listing").length + 1;
        if (enhInFirst10 > FEED_CAP_CONFIG.ENHANCED_CAP_FIRST_10) {
          reasons.push(`Enhanced cap: ${enhInFirst10}/${FEED_CAP_CONFIG.ENHANCED_CAP_FIRST_10} in first 10`);
        }
      }
      const enhInPage = localHistory.filter(r => r.type === "enhanced_listing").length + 1;
      if (enhInPage > FEED_CAP_CONFIG.ENHANCED_CAP_PER_PAGE) {
        reasons.push(`Enhanced page cap: ${enhInPage}/${FEED_CAP_CONFIG.ENHANCED_CAP_PER_PAGE} per page`);
      }
      const recentItems = [...history, ...localHistory].slice(-FEED_CAP_CONFIG.ENHANCED_SPONSORED_MIN_GAP);
      if (recentItems.some(r => r.isSponsored || r.type === "enhanced_listing")) {
        reasons.push(`Enhanced/sponsored spacing: too close to sponsored or another enhanced`);
      }
    }

    if (entityId) {
      if (!isRelaxed) {
        if (position <= 25) {
          const entityInFirst25 = fullHistory().filter(r => r.position <= 25 && r.entityId === entityId).length + 1;
          if (entityInFirst25 > FEED_CAP_CONFIG.SAME_ENTITY_CAP_FIRST_25) {
            reasons.push(`Entity cap: ${entityId} at ${entityInFirst25}/${FEED_CAP_CONFIG.SAME_ENTITY_CAP_FIRST_25} in first 25`);
          }
        }
      } else {
        const entityInLast40 = countInWindow(fullHistory(), 40, r => r.entityId === entityId) + 1;
        if (entityInLast40 > FEED_CAP_CONFIG.SAME_ENTITY_CAP_RELAXED_PER_40) {
          reasons.push(`Relaxed entity cap: ${entityId} at ${entityInLast40}/${FEED_CAP_CONFIG.SAME_ENTITY_CAP_RELAXED_PER_40} per 40`);
        }
      }
    }

    const itemSourceName = getItemSourceName(item);
    if (itemSourceName) {
      const combined = fullHistory();
      const sourceInLast20 = countInWindow(combined, 20, r => r.sourceName === itemSourceName);
      if (sourceInLast20 >= FEED_CAP_CONFIG.SOURCE_CAP_PER_20) {
        reasons.push(`Source hard cap: ${itemSourceName} at ${sourceInLast20 + 1}/${FEED_CAP_CONFIG.SOURCE_CAP_PER_20} per 20`);
      }
    }

    if (isVideo) {
      const streakCap = isRelaxed ? FEED_CAP_CONFIG.VIDEO_STREAK_CAP_RELAXED : FEED_CAP_CONFIG.VIDEO_STREAK_CAP;
      if (localVideoStreak + 1 > streakCap) {
        reasons.push(`Video streak cap: ${localVideoStreak + 1}/${streakCap} in a row`);
      }
    }

    if (localLastType === itemType) {
      const repeatCap = isRelaxed ? FEED_CAP_CONFIG.TYPE_REPEAT_CAP_RELAXED : FEED_CAP_CONFIG.TYPE_REPEAT_CAP_FIRST_20;
      const newStreak = localTypeStreak + 1;
      if (newStreak > repeatCap) {
        if (reasons.length === 0) {
          isTypeStreakOnly = true;
        }
        reasons.push(`Type streak cap: ${itemType} repeated ${newStreak}/${repeatCap}`);
      }
    }

    if (reasons.length > 0) {
      if (isTypeStreakOnly) {
        typeStreakDeferred.push(item);
      } else {
        skipped.push({ itemId: item.id, reason: reasons.join("; ") });
      }
      continue;
    }

    acceptItem(item);
  }

  if (accepted.length < pageLimit && typeStreakDeferred.length > 0) {
    for (const item of typeStreakDeferred) {
      if (accepted.length >= pageLimit) break;
      acceptItem(item);
    }
  }

  session.consumedCount += accepted.length;
  session.acceptedHistory.push(...localHistory);
  session.videoStreak = localVideoStreak;
  session.typeStreak = localTypeStreak;
  session.lastType = localLastType;
  session.skippedLog.push(...skipped);
  session.lastSeenAt = Date.now();

  return { accepted, skipped };
}

export function computeSessionFatiguePenalty(
  session: FeedSession,
  sourceName: string | null,
  categorySlug: string | null
): number {
  if (session.acceptedHistory.length === 0) return 0;

  let penalty = 0;
  const history = session.acceptedHistory;
  const window20 = history.slice(-20);

  if (sourceName) {
    const sourceCount = window20.filter(r => r.sourceName === sourceName).length;
    if (sourceCount >= FEED_CAP_CONFIG.SOURCE_CAP_PER_20) {
      penalty += 10 * (sourceCount - FEED_CAP_CONFIG.SOURCE_CAP_PER_20 + 1);
    }
  }

  if (categorySlug) {
    const window10 = history.slice(-10);
    const catCount = window10.filter(r => r.categorySlug === categorySlug).length;
    if (catCount >= 3) {
      penalty += 8 * (catCount - 2);
    }
  }

  return penalty;
}

export function getSessionStats(feedSessionId: string): Record<string, any> | null {
  const session = sessions.get(feedSessionId);
  if (!session) return null;

  const entityCounts = new Map<string, number>();
  for (const rec of session.acceptedHistory) {
    if (rec.entityId) {
      entityCounts.set(rec.entityId, (entityCounts.get(rec.entityId) || 0) + 1);
    }
  }
  const sponsoredCount = session.acceptedHistory.filter(r => r.isSponsored).length;

  return {
    feedSessionId: session.feedSessionId,
    userId: session.userId,
    metroId: session.metroId,
    geoContext: session.geoContext,
    startedAt: new Date(session.startedAt).toISOString(),
    lastSeenAt: new Date(session.lastSeenAt).toISOString(),
    consumedCount: session.consumedCount,
    sponsoredCount,
    entityCounts: Object.fromEntries(entityCounts),
    videoStreak: session.videoStreak,
    typeStreak: session.typeStreak,
    lastType: session.lastType,
    isRelaxed: session.consumedCount >= FEED_CAP_CONFIG.STRICT_PHASE_LENGTH,
    acceptedHistoryLength: session.acceptedHistory.length,
    skippedLog: session.skippedLog.slice(-50),
  };
}
