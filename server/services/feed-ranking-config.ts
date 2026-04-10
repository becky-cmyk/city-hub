export const RANKING_CONFIG = {
  geo: {
    tier1_primaryMatch: 200,
    tier2_secondaryMatch: 140,
    tier3_hubMatch: 100,
    cityWide: 80,
    tier4_countyMatch: 60,
    tier5_metro: 10,
  },

  recency: {
    maxBonus: 40,
    halfLifeHours: 48,
    floorBonus: 2,
  },

  engagement: {
    maxBonus: 50,
    tapWeight: 1,
    likeWeight: 3,
    saveWeight: 5,
    shareWeight: 4,
    logScaleBase: 10,
    lookbackDays: 14,
  },

  impressionDecay: {
    maxPenalty: 30,
    halfLifeImpressions: 200,
    lookbackDays: 7,
  },

  diversity: {
    contentTypeMaxConsecutive: 2,
    categoryMaxConsecutive: 2,
    nearDuplicateTitleThreshold: 0.6,
    sourceMaxPerWindow: 2,
    sourceWindowSize: 20,
    minDistinctCategoriesFirst10: 3,
    sourceTopSlotMax: 1,
    sourceTopSlotWindow: 5,
  },

  rotation: {
    bucketHours: 2,
    maxJitter: 35,
  },

  negativeContentFilter: {
    excludedCategorySlugs: ["public-safety", "government", "opinion"],
    titleBlocklist: [
      "murder", "murdered", "killing", "killed", "homicide",
      "shooting", "shot dead", "gunfire", "gunshot",
      "stabbing", "stabbed",
      "arrest", "arrested", "charged with", "indicted",
      "robbery", "robbed", "carjacking", "burglary",
      "assault", "assaulted", "domestic violence",
      "fatal", "fatally", "dead body", "body found",
      "rape", "sexual assault",
      "drug bust", "drug trafficking", "overdose",
      "manslaughter", "arson",
      "hit and run", "hit-and-run",
      "amber alert", "missing person",
    ],
  },

  eventBoost: {
    happeningToday: 3,
    next7Days: 1,
  },

  articleBoost: 8,

  rssBoost: 0,

  typeQuota: {
    event: { maxInTopN: 4, topN: 10 },
  },

  tierBoost: {
    enhanced: 15,
  },

  surfaceWeights: {
    pulse: { geo: 1.0, recency: 1.0 },
    hub: { geo: 1.3, recency: 0.8 },
    category: { geo: 0.7, recency: 1.2 },
    default: { geo: 1.0, recency: 1.0 },
  },

  sponsoredInsertionInterval: 8,
  defaultPageSize: 20,
};

export type SurfaceType = "pulse" | "hub" | "category" | "default";

export interface GeoContext {
  geoPrimarySlug?: string;
  hubSlug?: string;
  countySlug?: string;
}

export interface ScoredFeedItem {
  id: string;
  type: string;
  title: string;
  priorityScore: number;
  createdAt: string;
  sponsored: boolean;
  primaryTag: { slug: string; label: string; type: string } | null;
  locationTags: { slug: string; label: string }[];
  whyShown: string;
  geoMeta?: {
    geoPrimarySlug?: string | null;
    geoSecondarySlug?: string | null;
    hubSlug?: string | null;
    countySlug?: string | null;
    categoryCoreSlug?: string | null;
  };
  startDate?: string | null;
  sponsorshipMeta?: { tier: string; businessName: string };
  sourceName?: string | null;
  engagementScore?: number;
  impressionCount?: number;
  [key: string]: unknown;
}
