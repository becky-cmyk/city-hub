export interface RoutingSurface {
  eligible: boolean;
  reasons: string[];
  logicSummary: string;
  [key: string]: unknown;
}

export interface RoutingResult {
  surfaces: {
    pulse: RoutingSurface;
    hub: RoutingSurface;
    category: RoutingSurface;
    map: RoutingSurface;
    article: RoutingSurface;
    search: RoutingSurface;
  };
  lifecycle: {
    isEvergreen: boolean;
    activeUntil: unknown;
    isExpired: boolean;
    publishedAt: unknown;
    createdAt: unknown;
  };
  hasRoutingIssues: boolean;
}

export function evaluateContentRouting(item: Record<string, unknown>): RoutingResult {
  const isExpiredByDate = item.activeUntil && !item.isEvergreen
    ? new Date(item.activeUntil as string) <= new Date()
    : false;

  const isPulseEligible = item.publishStatus === "PUBLISHED" &&
    item.policyStatus === "ALLOW" &&
    item.pulseEligible !== false &&
    !isExpiredByDate;

  const hasHub = !!(item.geoPrimarySlug || item.geoSecondarySlug || item.hubSlug);
  const hasCategory = !!item.categoryCoreSlug;
  const hasVenueInfo = !!(item.venueName && item.venueAddress);
  const hasGeoPrecision = !!(item.geoPrimarySlug && item.geoSecondarySlug);
  const hasMap = hasVenueInfo || hasGeoPrecision;
  const hasArticle = !!(item.localArticleBody || item.localArticleSlug);
  const hasSearch = !!(item.title && item.publishStatus === "PUBLISHED");

  const pulseReasons = !isPulseEligible ? getPulseBlockReasons(item) : [];

  const hubReasons: string[] = [];
  if (!item.geoPrimarySlug) hubReasons.push("No primary zone assigned");
  if (!item.hubSlug) hubReasons.push("No hub assigned");

  const categoryReasons: string[] = [];
  if (!item.categoryCoreSlug) categoryReasons.push("No core category assigned");

  const mapReasons: string[] = [];
  if (!hasVenueInfo && !hasGeoPrecision) {
    if (!item.venueName) mapReasons.push("No venue name");
    if (!item.venueAddress) mapReasons.push("No venue address");
    if (!item.geoSecondarySlug) mapReasons.push("No secondary geo for precision fallback");
  }

  const articleReasons: string[] = [];
  if (!item.localArticleBody && !item.localArticleSlug) articleReasons.push("No local article generated");

  const searchReasons: string[] = [];
  if (!item.title) searchReasons.push("No title");
  if (item.publishStatus !== "PUBLISHED") searchReasons.push("Not published");

  const hasRoutingIssues = !hasHub || !hasCategory;

  return {
    surfaces: {
      pulse: {
        eligible: isPulseEligible,
        reasons: pulseReasons,
        logicSummary: isPulseEligible
          ? "Published + ALLOW + pulse-eligible + not expired"
          : "Requires publishStatus=PUBLISHED, policyStatus=ALLOW, pulseEligible=true, not expired (or evergreen)",
      },
      hub: {
        eligible: hasHub,
        zone: item.geoPrimarySlug,
        hub: item.hubSlug,
        reasons: !hasHub ? hubReasons : [],
        logicSummary: hasHub
          ? `Routed to zone ${item.geoPrimarySlug || ""}${item.hubSlug ? " / hub " + item.hubSlug : ""}`
          : "Requires geoPrimarySlug, geoSecondarySlug, or hubSlug",
      },
      category: {
        eligible: hasCategory,
        core: item.categoryCoreSlug,
        sub: item.categorySubSlug,
        reasons: !hasCategory ? categoryReasons : [],
        logicSummary: hasCategory
          ? `Categorized as ${item.categoryCoreSlug}${item.categorySubSlug ? " > " + item.categorySubSlug : ""}`
          : "Requires categoryCoreSlug assignment",
      },
      map: {
        eligible: hasMap,
        venue: item.venueName,
        address: item.venueAddress,
        reasons: !hasMap ? mapReasons : [],
        logicSummary: hasMap
          ? (hasVenueInfo ? `Venue: ${item.venueName} at ${item.venueAddress}` : `Geo precision: ${item.geoPrimarySlug} + ${item.geoSecondarySlug}`)
          : "Requires venue name + address OR primary + secondary geo for map placement",
      },
      article: {
        eligible: hasArticle,
        slug: item.localArticleSlug,
        reasons: !hasArticle ? articleReasons : [],
        logicSummary: hasArticle
          ? `Local article at /news/${item.localArticleSlug}`
          : "Requires localArticleBody or localArticleSlug",
      },
      search: {
        eligible: hasSearch,
        reasons: !hasSearch ? searchReasons : [],
        logicSummary: hasSearch
          ? "Indexed for search (title present + published)"
          : "Requires title and publishStatus=PUBLISHED",
      },
    },
    lifecycle: {
      isEvergreen: !!item.isEvergreen,
      activeUntil: item.activeUntil,
      isExpired: isExpiredByDate,
      publishedAt: item.publishedAt,
      createdAt: item.createdAt,
    },
    hasRoutingIssues,
  };
}

export function deriveQueueStatus(publishStatus: string, policyStatus: string, pulseEligible: boolean, currentQueueStatus?: string): string {
  if (policyStatus === "SUPPRESS" || publishStatus === "SUPPRESSED") return "SUPPRESSED";
  if (publishStatus === "ARCHIVED") return "ARCHIVED";
  if (publishStatus === "PUBLISHED" && policyStatus === "ALLOW" && pulseEligible) return "PUBLISHED";
  if (publishStatus === "PUBLISHED" && policyStatus === "ALLOW" && !pulseEligible) return "PULSE_SUPPRESSED";
  if (publishStatus === "DRAFT") return "UNPUBLISHED";
  if (currentQueueStatus === "READY_TO_PUBLISH" && publishStatus !== "REVIEW_NEEDED" && policyStatus !== "REVIEW_NEEDED") return "READY_TO_PUBLISH";
  if (publishStatus === "REVIEW_NEEDED" || policyStatus === "REVIEW_NEEDED") return "REVIEW_REQUIRED";
  return "REVIEW_REQUIRED";
}

export function getPulseBlockReasons(item: Record<string, unknown>): string[] {
  const reasons: string[] = [];
  if (item.publishStatus !== "PUBLISHED") reasons.push("Not published");
  if (item.policyStatus !== "ALLOW") reasons.push("Policy not ALLOW");
  if (item.pulseEligible === false) reasons.push("Pulse excluded");
  if (item.activeUntil && !item.isEvergreen && new Date(item.activeUntil as string) <= new Date()) reasons.push("Content expired");
  return reasons;
}

export function computeIntegrityFlags(item: Record<string, unknown>): string[] {
  const flags: string[] = [];

  if (!item.categoryCoreSlug) {
    flags.push("MISSING_CATEGORY");
  }

  if (!item.geoPrimarySlug) {
    flags.push("MISSING_GEO");
  }

  const confidence = (item.aiConfidence || {}) as Record<string, number>;
  if (confidence.category !== undefined && confidence.category < 0.7) {
    flags.push("LOW_CATEGORY_CONFIDENCE");
  }
  if (confidence.geo !== undefined && confidence.geo < 0.7) {
    flags.push("LOW_GEO_CONFIDENCE");
  }
  if (confidence.policy !== undefined && confidence.policy < 0.7) {
    flags.push("LOW_POLICY_CONFIDENCE");
  }

  if (item._geoPrecision === "METRO" || item._geoIsLowPrecision === true) {
    flags.push("LOW_GEO_PRECISION");
  }

  const routing = evaluateContentRouting(item);
  if (routing.hasRoutingIssues) {
    flags.push("ROUTING_ISSUE");
  }

  return flags;
}
