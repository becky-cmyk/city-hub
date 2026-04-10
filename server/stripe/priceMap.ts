export const STRIPE_PRICE_MAP: Record<string, string | undefined> = {
  LISTING_ENHANCED: process.env.STRIPE_PRICE_LISTING_ENHANCED || process.env.STRIPE_PRICE_ENHANCED,
  FEATURED_PLACEMENT: process.env.STRIPE_PRICE_FEATURED,
  SPOTLIGHT: process.env.STRIPE_PRICE_SPOTLIGHT,
  SPONSORSHIP: process.env.STRIPE_PRICE_SPONSOR,
  CONTRIBUTOR_PACKAGE: process.env.STRIPE_PRICE_CONTRIBUTOR,
  CROWN_HUB_PRESENCE: process.env.STRIPE_PRICE_CROWN_HUB_PRESENCE,

  HUB_PRESENCE_MONTHLY: process.env.STRIPE_PRICE_HUB_PRESENCE_MONTHLY,
  HUB_PRESENCE_ANNUAL: process.env.STRIPE_PRICE_HUB_PRESENCE_ANNUAL,
  HUB_PRESENCE_FOUNDER_MONTHLY: process.env.STRIPE_PRICE_HUB_PRESENCE_FOUNDER_MONTHLY,
  HUB_PRESENCE_FOUNDER_ANNUAL: process.env.STRIPE_PRICE_HUB_PRESENCE_FOUNDER_ANNUAL,

  HUB_ADDON_MONTHLY: process.env.STRIPE_PRICE_HUB_ADDON_MONTHLY,
  HUB_ADDON_ANNUAL: process.env.STRIPE_PRICE_HUB_ADDON_ANNUAL,

  CATEGORY_ADDON_MONTHLY: process.env.STRIPE_PRICE_CATEGORY_ADDON_MONTHLY,
  CATEGORY_ADDON_ANNUAL: process.env.STRIPE_PRICE_CATEGORY_ADDON_ANNUAL,

  MICRO_ADDON_MONTHLY: process.env.STRIPE_PRICE_MICRO_ADDON_MONTHLY,
  MICRO_ADDON_ANNUAL: process.env.STRIPE_PRICE_MICRO_ADDON_ANNUAL,

  CAPABILITY_JOBS_MONTHLY: process.env.STRIPE_PRICE_CAPABILITY_JOBS_MONTHLY,
  CAPABILITY_MARKETPLACE_MONTHLY: process.env.STRIPE_PRICE_CAPABILITY_MARKETPLACE_MONTHLY,
  CAPABILITY_CREATOR_MONTHLY: process.env.STRIPE_PRICE_CAPABILITY_CREATOR_MONTHLY,
  CAPABILITY_EXPERT_MONTHLY: process.env.STRIPE_PRICE_CAPABILITY_EXPERT_MONTHLY,
  CAPABILITY_EVENTS_MONTHLY: process.env.STRIPE_PRICE_CAPABILITY_EVENTS_MONTHLY,
  CAPABILITY_PROVIDER_MONTHLY: process.env.STRIPE_PRICE_CAPABILITY_PROVIDER_MONTHLY,
  CAPABILITY_COMMUNITY_MONTHLY: process.env.STRIPE_PRICE_CAPABILITY_COMMUNITY_MONTHLY,

  MARKETPLACE_PURCHASE: process.env.STRIPE_PRICE_MARKETPLACE_PURCHASE,
  MARKETPLACE_FEATURED: process.env.STRIPE_PRICE_MARKETPLACE_FEATURED || process.env.STRIPE_PRICE_FEATURED,

  CONTENT_BOOST: process.env.STRIPE_PRICE_CONTENT_BOOST,
  CONTENT_SPONSORSHIP: process.env.STRIPE_PRICE_CONTENT_SPONSORSHIP,
};

let _dbTierPrices: Record<string, string> | null = null;
let _dbPlanPrices: Record<string, string> | null = null;

export async function loadTierPricesFromDb(): Promise<void> {
  try {
    const { storage } = await import("../storage");
    const tiers = await storage.getListingTierFeatures();
    _dbTierPrices = {};
    for (const t of tiers) {
      if (t.stripePriceIdMonthly) _dbTierPrices[`${t.tier}_MONTHLY`] = t.stripePriceIdMonthly;
      if (t.stripePriceIdAnnual) _dbTierPrices[`${t.tier}_ANNUAL`] = t.stripePriceIdAnnual;
    }
  } catch { _dbTierPrices = null; }

  try {
    const { pool } = await import("../db");
    const { rows } = await pool.query(
      `SELECT version_key, is_founder_plan,
              stripe_price_presence_monthly, stripe_price_presence_annual,
              stripe_price_hub_addon_monthly, stripe_price_hub_addon_annual,
              stripe_price_category_addon_monthly, stripe_price_category_addon_annual,
              stripe_price_micro_addon_monthly, stripe_price_micro_addon_annual
       FROM plan_versions WHERE is_current_offering = TRUE OR is_founder_plan = TRUE`
    );
    if (rows.length > 0) {
      _dbPlanPrices = {};
      for (const row of rows) {
        const prefix = row.is_founder_plan ? "FOUNDER_" : "STANDARD_";
        if (row.stripe_price_presence_monthly) _dbPlanPrices[`${prefix}PRESENCE_MONTHLY`] = row.stripe_price_presence_monthly;
        if (row.stripe_price_presence_annual) _dbPlanPrices[`${prefix}PRESENCE_ANNUAL`] = row.stripe_price_presence_annual;
        if (row.stripe_price_hub_addon_monthly) _dbPlanPrices[`${prefix}HUB_ADDON_MONTHLY`] = row.stripe_price_hub_addon_monthly;
        if (row.stripe_price_hub_addon_annual) _dbPlanPrices[`${prefix}HUB_ADDON_ANNUAL`] = row.stripe_price_hub_addon_annual;
        if (row.stripe_price_category_addon_monthly) _dbPlanPrices[`${prefix}CATEGORY_ADDON_MONTHLY`] = row.stripe_price_category_addon_monthly;
        if (row.stripe_price_category_addon_annual) _dbPlanPrices[`${prefix}CATEGORY_ADDON_ANNUAL`] = row.stripe_price_category_addon_annual;
        if (row.stripe_price_micro_addon_monthly) _dbPlanPrices[`${prefix}MICRO_ADDON_MONTHLY`] = row.stripe_price_micro_addon_monthly;
        if (row.stripe_price_micro_addon_annual) _dbPlanPrices[`${prefix}MICRO_ADDON_ANNUAL`] = row.stripe_price_micro_addon_annual;
      }
    }
  } catch { _dbPlanPrices = null; }
}

const PRESENCE_PRODUCT_TYPES = new Set([
  "HUB_PRESENCE", "HUB_ADDON", "CATEGORY_ADDON", "MICRO_ADDON", "CAPABILITY",
]);

const SUBSCRIPTION_PRODUCT_TYPES = new Set([
  "LISTING_TIER", "CROWN_HUB_PRESENCE",
  "HUB_PRESENCE", "HUB_ADDON", "CATEGORY_ADDON", "MICRO_ADDON", "CAPABILITY",
]);

export function resolvePriceId(
  productType: string,
  tier?: string,
  billingInterval?: string,
  options?: { isFounder?: boolean; capabilityType?: string },
): string | undefined {
  if (productType === "LISTING_TIER") {
    const normalizedTier = (tier === "CHARTER" || tier === "CHAMBER") ? "VERIFIED" : tier;
    const envPrice = normalizedTier === "ENHANCED" ? STRIPE_PRICE_MAP.LISTING_ENHANCED : undefined;
    if (envPrice) return envPrice;

    if (_dbTierPrices && normalizedTier) {
      const suffix = billingInterval === "annual" ? "ANNUAL" : "MONTHLY";
      return _dbTierPrices[`${normalizedTier}_${suffix}`];
    }
    return undefined;
  }

  if (productType === "HUB_PRESENCE") {
    const suffix = billingInterval === "annual" ? "ANNUAL" : "MONTHLY";
    if (options?.isFounder) {
      const founderKey = `HUB_PRESENCE_FOUNDER_${suffix}`;
      if (STRIPE_PRICE_MAP[founderKey]) return STRIPE_PRICE_MAP[founderKey];
      if (_dbPlanPrices?.[`FOUNDER_PRESENCE_${suffix}`]) return _dbPlanPrices[`FOUNDER_PRESENCE_${suffix}`];
    }
    const key = `HUB_PRESENCE_${suffix}`;
    if (STRIPE_PRICE_MAP[key]) return STRIPE_PRICE_MAP[key];
    return _dbPlanPrices?.[`STANDARD_PRESENCE_${suffix}`];
  }

  if (productType === "HUB_ADDON") {
    const suffix = billingInterval === "annual" ? "ANNUAL" : "MONTHLY";
    if (STRIPE_PRICE_MAP[`HUB_ADDON_${suffix}`]) return STRIPE_PRICE_MAP[`HUB_ADDON_${suffix}`];
    return _dbPlanPrices?.[`STANDARD_HUB_ADDON_${suffix}`];
  }

  if (productType === "CATEGORY_ADDON") {
    const suffix = billingInterval === "annual" ? "ANNUAL" : "MONTHLY";
    if (STRIPE_PRICE_MAP[`CATEGORY_ADDON_${suffix}`]) return STRIPE_PRICE_MAP[`CATEGORY_ADDON_${suffix}`];
    return _dbPlanPrices?.[`STANDARD_CATEGORY_ADDON_${suffix}`];
  }

  if (productType === "MICRO_ADDON") {
    const suffix = billingInterval === "annual" ? "ANNUAL" : "MONTHLY";
    if (STRIPE_PRICE_MAP[`MICRO_ADDON_${suffix}`]) return STRIPE_PRICE_MAP[`MICRO_ADDON_${suffix}`];
    return _dbPlanPrices?.[`STANDARD_MICRO_ADDON_${suffix}`];
  }

  if (productType === "CAPABILITY" && options?.capabilityType) {
    return STRIPE_PRICE_MAP[`CAPABILITY_${options.capabilityType}_MONTHLY`];
  }

  return STRIPE_PRICE_MAP[productType];
}

export function resolveCheckoutMode(
  productType: string
): "subscription" | "payment" {
  if (SUBSCRIPTION_PRODUCT_TYPES.has(productType)) return "subscription";
  return "payment";
}

export function isPresenceProductType(productType: string): boolean {
  return PRESENCE_PRODUCT_TYPES.has(productType);
}
