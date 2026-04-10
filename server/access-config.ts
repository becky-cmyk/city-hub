import type { EntitlementTier } from "./entitlements";
import type { CapabilityType } from "@shared/schema";

export type AddonKey =
  | "JOB_BOARD"
  | "EVENT_HOST"
  | "MARKETPLACE_STOREFRONT"
  | "VIDEO_CHANNEL"
  | "PODCAST_CHANNEL"
  | "CREATOR_NETWORK"
  | "EXPERT_PROFILE"
  | "FEATURED_DISTRIBUTION"
  | "PREMIUM_PLACEMENT";

export type CreditActionKey =
  | "JOB_POST"
  | "EVENT_PROMOTION"
  | "EVENT_INVITE_SEND"
  | "LISTING_BOOST"
  | "SMALL_BOOST"
  | "FEATURED_ROTATION"
  | "CROWN_PROMOTION"
  | "MARKETPLACE_LISTING"
  | "FEATURE_TO_PULSE"
  | "STORY_BOOST"
  | "SPOTLIGHT_ARTICLE";

export type AccessModel = "TIER_INCLUDED" | "ADDON_REQUIRED" | "CREDIT_ACTION" | "ADMIN_ONLY" | "ADMIN_OVERRIDE";

export interface AddonDefinition {
  key: AddonKey;
  label: string;
  description: string;
  capabilities: CapabilityType[];
  monthlyPriceCents: number;
}

export interface CreditActionDefinition {
  key: CreditActionKey;
  label: string;
  costCredits: number;
  canSubstituteForAddon: AddonKey | null;
}

export interface TierInclusion {
  label: string;
  monthlyCredits: number;
  includedModules: string[];
  postingLimits: Record<string, number>;
  distributionEligible: boolean;
  micrositeEnabled: boolean;
  priorityBoost: number;
}

export const ADDON_DEFINITIONS: Record<AddonKey, AddonDefinition> = {
  JOB_BOARD: {
    key: "JOB_BOARD",
    label: "Employer Tools",
    description: "Post jobs, manage applicants, employer dashboard",
    capabilities: ["JOBS"],
    monthlyPriceCents: 2900,
  },
  EVENT_HOST: {
    key: "EVENT_HOST",
    label: "Event Host",
    description: "Create and manage events, send invitations, track RSVPs",
    capabilities: ["EVENTS"],
    monthlyPriceCents: 1900,
  },
  MARKETPLACE_STOREFRONT: {
    key: "MARKETPLACE_STOREFRONT",
    label: "Social Selling",
    description: "List products and services, manage storefront",
    capabilities: ["MARKETPLACE"],
    monthlyPriceCents: 1900,
  },
  VIDEO_CHANNEL: {
    key: "VIDEO_CHANNEL",
    label: "Video Channel",
    description: "Host and publish video content",
    capabilities: ["CREATOR"],
    monthlyPriceCents: 2900,
  },
  PODCAST_CHANNEL: {
    key: "PODCAST_CHANNEL",
    label: "Podcast Channel",
    description: "Distribute and manage podcast episodes",
    capabilities: ["CREATOR"],
    monthlyPriceCents: 2900,
  },
  CREATOR_NETWORK: {
    key: "CREATOR_NETWORK",
    label: "Creator & Media",
    description: "Full creator tools and media publishing",
    capabilities: ["CREATOR"],
    monthlyPriceCents: 3900,
  },
  EXPERT_PROFILE: {
    key: "EXPERT_PROFILE",
    label: "Ask-an-Expert",
    description: "Expert profile, Q&A, consultation booking",
    capabilities: ["EXPERT"],
    monthlyPriceCents: 1900,
  },
  FEATURED_DISTRIBUTION: {
    key: "FEATURED_DISTRIBUTION",
    label: "Featured Distribution",
    description: "Priority placement in feeds and directories",
    capabilities: [],
    monthlyPriceCents: 4900,
  },
  PREMIUM_PLACEMENT: {
    key: "PREMIUM_PLACEMENT",
    label: "Premium Placement",
    description: "Top-of-page sponsored placement across the platform",
    capabilities: [],
    monthlyPriceCents: 9900,
  },
};

export const CREDIT_ACTION_DEFINITIONS: Record<CreditActionKey, CreditActionDefinition> = {
  JOB_POST: {
    key: "JOB_POST",
    label: "Job Posting",
    costCredits: 3,
    canSubstituteForAddon: "JOB_BOARD",
  },
  EVENT_PROMOTION: {
    key: "EVENT_PROMOTION",
    label: "Event Promotion",
    costCredits: 2,
    canSubstituteForAddon: "EVENT_HOST",
  },
  EVENT_INVITE_SEND: {
    key: "EVENT_INVITE_SEND",
    label: "Event Invitation Batch (25)",
    costCredits: 2,
    canSubstituteForAddon: "EVENT_HOST",
  },
  LISTING_BOOST: {
    key: "LISTING_BOOST",
    label: "Listing Priority Boost",
    costCredits: 5,
    canSubstituteForAddon: null,
  },
  SMALL_BOOST: {
    key: "SMALL_BOOST",
    label: "Small Visibility Boost",
    costCredits: 1,
    canSubstituteForAddon: null,
  },
  FEATURED_ROTATION: {
    key: "FEATURED_ROTATION",
    label: "Featured Rotation Slot",
    costCredits: 10,
    canSubstituteForAddon: "FEATURED_DISTRIBUTION",
  },
  CROWN_PROMOTION: {
    key: "CROWN_PROMOTION",
    label: "Crown Amplification",
    costCredits: 8,
    canSubstituteForAddon: "PREMIUM_PLACEMENT",
  },
  MARKETPLACE_LISTING: {
    key: "MARKETPLACE_LISTING",
    label: "Marketplace Listing",
    costCredits: 2,
    canSubstituteForAddon: "MARKETPLACE_STOREFRONT",
  },
  FEATURE_TO_PULSE: {
    key: "FEATURE_TO_PULSE",
    label: "Feature to Pulse Feed",
    costCredits: 3,
    canSubstituteForAddon: null,
  },
  STORY_BOOST: {
    key: "STORY_BOOST",
    label: "Story Boost",
    costCredits: 4,
    canSubstituteForAddon: null,
  },
  SPOTLIGHT_ARTICLE: {
    key: "SPOTLIGHT_ARTICLE",
    label: "AI Spotlight Article",
    costCredits: 5,
    canSubstituteForAddon: null,
  },
};

export const TIER_INCLUSIONS: Record<EntitlementTier, TierInclusion> = {
  FREE: {
    label: "Free",
    monthlyCredits: 0,
    includedModules: [
      "directory_listing",
      "basic_profile",
    ],
    postingLimits: {
      community_posts_per_month: 0,
      photos: 0,
      social_links: 0,
    },
    distributionEligible: false,
    micrositeEnabled: false,
    priorityBoost: 0,
  },
  VERIFIED: {
    label: "Verified",
    monthlyCredits: 5,
    includedModules: [
      "directory_listing",
      "basic_profile",
      "claim_management",
      "community_posting",
      "badges",
    ],
    postingLimits: {
      community_posts_per_month: 5,
      photos: 3,
      social_links: 2,
    },
    distributionEligible: false,
    micrositeEnabled: false,
    priorityBoost: 0,
  },
  ENHANCED: {
    label: "Enhanced",
    monthlyCredits: 15,
    includedModules: [
      "directory_listing",
      "basic_profile",
      "claim_management",
      "community_posting",
      "badges",
      "microsite",
      "gallery",
      "media_blocks",
      "priority_ranking",
      "custom_domain",
      "faq",
      "expert_qa",
      "video_embed",
      "external_reviews",
      "internal_reviews",
    ],
    postingLimits: {
      community_posts_per_month: -1,
      photos: 50,
      social_links: -1,
    },
    distributionEligible: true,
    micrositeEnabled: true,
    priorityBoost: 5,
  },
  ENTERPRISE: {
    label: "Enterprise",
    monthlyCredits: 30,
    includedModules: [
      "directory_listing",
      "basic_profile",
      "claim_management",
      "community_posting",
      "badges",
      "microsite",
      "gallery",
      "media_blocks",
      "priority_ranking",
      "custom_domain",
      "faq",
      "expert_qa",
      "video_embed",
      "external_reviews",
      "internal_reviews",
      "api_access",
      "white_label",
      "multi_location",
      "analytics_dashboard",
      "dedicated_support",
    ],
    postingLimits: {
      community_posts_per_month: -1,
      photos: -1,
      social_links: -1,
    },
    distributionEligible: true,
    micrositeEnabled: true,
    priorityBoost: 15,
  },
};

export type UnlockType = "UPGRADE_TIER" | "BUY_ADDON" | "SPEND_CREDITS" | "ADMIN_ONLY";

export interface UpgradePathOption {
  type: UnlockType;
  label: string;
  description: string;
  tierRequired?: EntitlementTier;
  addonKey?: AddonKey;
  creditCost?: number;
  creditActionKey?: CreditActionKey;
}

export interface AccessResolution {
  allowed: boolean;
  accessModel: AccessModel;
  upgradePaths: UpgradePathOption[];
}

export { PROFILE_TYPES, PROFILE_TYPE_MODULES, getVisibleModulesForProfileTypes, getVisibleModulesForActiveType, isModuleVisibleForActiveType, isModuleVisibleForProfileTypes } from "@shared/profile-types";
export type { ProfileType } from "@shared/profile-types";

export interface AccessContext {
  currentTier: EntitlementTier;
  activeAddons: AddonKey[];
  creditBalance: number;
  isAdmin: boolean;
  profileTypes: ProfileType[];
  activeProfileType: ProfileType;
  moduleOverrides?: Record<string, boolean>;
}

const MODULE_ADDON_MAP: Record<string, AddonKey> = {
  jobs: "JOB_BOARD",
  job_board: "JOB_BOARD",
  events: "EVENT_HOST",
  event_hosting: "EVENT_HOST",
  marketplace: "MARKETPLACE_STOREFRONT",
  storefront: "MARKETPLACE_STOREFRONT",
  video_channel: "VIDEO_CHANNEL",
  podcast_channel: "PODCAST_CHANNEL",
  creator_tools: "CREATOR_NETWORK",
  expert_qa_hosting: "EXPERT_PROFILE",
  featured_distribution: "FEATURED_DISTRIBUTION",
  premium_placement: "PREMIUM_PLACEMENT",
};

export function resolveAccessForModule(
  ctx: AccessContext,
  moduleKey: string,
): AccessResolution {
  if (ctx.isAdmin) {
    return { allowed: true, accessModel: "ADMIN_ONLY", upgradePaths: [] };
  }

  if (ctx.moduleOverrides && moduleKey in ctx.moduleOverrides) {
    return {
      allowed: ctx.moduleOverrides[moduleKey],
      accessModel: "ADMIN_OVERRIDE",
      upgradePaths: [],
    };
  }

  if (!isModuleVisibleForActiveType(ctx.activeProfileType, moduleKey)) {
    return {
      allowed: false,
      accessModel: "TIER_INCLUDED",
      upgradePaths: [],
    };
  }

  const tierConfig = TIER_INCLUSIONS[ctx.currentTier];

  if (tierConfig.includedModules.includes(moduleKey)) {
    return { allowed: true, accessModel: "TIER_INCLUDED", upgradePaths: [] };
  }

  const addonKey = MODULE_ADDON_MAP[moduleKey];
  if (addonKey && ctx.activeAddons.includes(addonKey)) {
    return { allowed: true, accessModel: "ADDON_REQUIRED", upgradePaths: [] };
  }

  const tierOrder: EntitlementTier[] = ["FREE", "VERIFIED", "ENHANCED", "ENTERPRISE"];
  const currentIdx = tierOrder.indexOf(ctx.currentTier);
  for (let i = currentIdx + 1; i < tierOrder.length; i++) {
    const nextTier = tierOrder[i];
    const nextConfig = TIER_INCLUSIONS[nextTier];
    if (nextConfig.includedModules.includes(moduleKey)) {
      return {
        allowed: false,
        accessModel: "TIER_INCLUDED",
        upgradePaths: [{
          type: "UPGRADE_TIER",
          label: `Included in ${nextConfig.label}`,
          description: `Upgrade to ${nextConfig.label} to access this feature`,
          tierRequired: nextTier,
        }],
      };
    }
  }

  const paths: UpgradePathOption[] = [];
  if (addonKey) {
    const addonDef = ADDON_DEFINITIONS[addonKey];
    paths.push({
      type: "BUY_ADDON",
      label: `Get ${addonDef.label}`,
      description: `$${(addonDef.monthlyPriceCents / 100).toFixed(0)}/mo add-on`,
      addonKey,
    });
  }

  return {
    allowed: false,
    accessModel: "ADDON_REQUIRED",
    upgradePaths: paths,
  };
}

export function resolveAccessForAction(
  ctx: AccessContext,
  actionKey: CreditActionKey,
): AccessResolution {
  if (ctx.isAdmin) {
    return { allowed: true, accessModel: "ADMIN_ONLY", upgradePaths: [] };
  }

  const actionDef = CREDIT_ACTION_DEFINITIONS[actionKey];
  if (!actionDef) {
    return {
      allowed: false,
      accessModel: "ADMIN_ONLY",
      upgradePaths: [{
        type: "ADMIN_ONLY",
        label: "Operator Access Required",
        description: "This action is restricted to platform operators",
      }],
    };
  }

  if (actionDef.canSubstituteForAddon && ctx.activeAddons.includes(actionDef.canSubstituteForAddon)) {
    return { allowed: true, accessModel: "ADDON_REQUIRED", upgradePaths: [] };
  }

  if (ctx.creditBalance >= actionDef.costCredits) {
    return { allowed: true, accessModel: "CREDIT_ACTION", upgradePaths: [] };
  }

  const paths: UpgradePathOption[] = [];

  if (actionDef.canSubstituteForAddon) {
    const addonDef = ADDON_DEFINITIONS[actionDef.canSubstituteForAddon];
    paths.push({
      type: "BUY_ADDON",
      label: `Get ${addonDef.label}`,
      description: `$${(addonDef.monthlyPriceCents / 100).toFixed(0)}/mo for unlimited access`,
      addonKey: actionDef.canSubstituteForAddon,
    });
  }

  paths.push({
    type: "SPEND_CREDITS",
    label: `Use ${actionDef.costCredits} credits`,
    description: ctx.creditBalance > 0
      ? `You have ${ctx.creditBalance} credits (need ${actionDef.costCredits})`
      : `Purchase credits to use this action`,
    creditCost: actionDef.costCredits,
    creditActionKey: actionKey,
  });

  return {
    allowed: false,
    accessModel: "CREDIT_ACTION",
    upgradePaths: paths,
  };
}

export interface ActionMatrixEntry {
  minTier: EntitlementTier;
  addonKey?: AddonKey;
  creditCost?: number;
  freeAllowed: boolean;
  label: string;
}

export const ACTION_MATRIX: Record<string, ActionMatrixEntry> = {
  post_community: { minTier: "VERIFIED", freeAllowed: false, label: "Community Post" },
  post_event: { minTier: "VERIFIED", addonKey: "EVENT_HOST", creditCost: 2, freeAllowed: false, label: "Event Posting" },
  post_job: { minTier: "VERIFIED", addonKey: "JOB_BOARD", creditCost: 3, freeAllowed: false, label: "Job Posting" },
  marketplace_listing: { minTier: "VERIFIED", addonKey: "MARKETPLACE_STOREFRONT", creditCost: 2, freeAllowed: false, label: "Marketplace Listing" },
  submit_story: { minTier: "VERIFIED", freeAllowed: false, label: "Submit Story" },
  submit_review: { minTier: "VERIFIED", freeAllowed: false, label: "Submit Review" },
  claim_listing: { minTier: "VERIFIED", freeAllowed: false, label: "Claim Listing" },
  view_directory: { minTier: "FREE", freeAllowed: true, label: "View Directory" },
  view_events: { minTier: "FREE", freeAllowed: true, label: "View Events" },
  view_pulse: { minTier: "FREE", freeAllowed: true, label: "View Pulse Feed" },
  create_microsite: { minTier: "ENHANCED", freeAllowed: false, label: "Create Microsite" },
  custom_domain: { minTier: "ENHANCED", freeAllowed: false, label: "Custom Domain" },
  gallery_upload: { minTier: "ENHANCED", freeAllowed: false, label: "Gallery Upload" },
  video_embed: { minTier: "ENHANCED", freeAllowed: false, label: "Video Embed" },
  listing_boost: { minTier: "VERIFIED", creditCost: 5, freeAllowed: false, label: "Listing Boost" },
  featured_rotation: { minTier: "ENHANCED", creditCost: 10, freeAllowed: false, label: "Featured Rotation" },
  crown_promotion: { minTier: "ENHANCED", creditCost: 8, freeAllowed: false, label: "Crown Promotion" },
  feature_to_pulse: { minTier: "VERIFIED", creditCost: 3, freeAllowed: false, label: "Feature to Pulse" },
  story_boost: { minTier: "VERIFIED", creditCost: 4, freeAllowed: false, label: "Story Boost" },
  spotlight_article: { minTier: "ENHANCED", creditCost: 5, freeAllowed: false, label: "AI Spotlight Article" },
  api_access: { minTier: "ENTERPRISE", freeAllowed: false, label: "API Access" },
  white_label: { minTier: "ENTERPRISE", freeAllowed: false, label: "White Label" },
  multi_location: { minTier: "ENTERPRISE", freeAllowed: false, label: "Multi-Location Management" },
  analytics_export: { minTier: "ENTERPRISE", freeAllowed: false, label: "Analytics Export" },
  creator_tools: { minTier: "ENHANCED", addonKey: "CREATOR_NETWORK", freeAllowed: false, label: "Creator Tools" },
  expert_qa_hosting: { minTier: "ENHANCED", addonKey: "EXPERT_PROFILE", creditCost: 2, freeAllowed: false, label: "Expert Q&A" },
};

const TIER_ORDER: EntitlementTier[] = ["FREE", "VERIFIED", "ENHANCED", "ENTERPRISE"];

export function resolveActionAccess(
  ctx: AccessContext,
  actionKey: string,
): AccessResolution {
  const entry = ACTION_MATRIX[actionKey];
  if (!entry) {
    return { allowed: false, accessModel: "ADMIN_ONLY", upgradePaths: [] };
  }

  if (ctx.isAdmin) {
    return { allowed: true, accessModel: "ADMIN_ONLY", upgradePaths: [] };
  }

  const currentIdx = TIER_ORDER.indexOf(ctx.currentTier);
  const requiredIdx = TIER_ORDER.indexOf(entry.minTier);

  if (currentIdx < requiredIdx) {
    return {
      allowed: false,
      accessModel: "TIER_INCLUDED",
      upgradePaths: [{
        type: "UPGRADE_TIER",
        label: `Requires ${TIER_INCLUSIONS[entry.minTier].label}`,
        description: `Upgrade to ${TIER_INCLUSIONS[entry.minTier].label} to use this feature`,
        tierRequired: entry.minTier,
      }],
    };
  }

  if (entry.addonKey && ctx.activeAddons.includes(entry.addonKey)) {
    return { allowed: true, accessModel: "ADDON_REQUIRED", upgradePaths: [] };
  }

  if (!entry.addonKey && !entry.creditCost) {
    return { allowed: true, accessModel: "TIER_INCLUDED", upgradePaths: [] };
  }

  if (entry.creditCost && ctx.creditBalance >= entry.creditCost) {
    return { allowed: true, accessModel: "CREDIT_ACTION", upgradePaths: [] };
  }

  const paths: UpgradePathOption[] = [];
  if (entry.addonKey) {
    const addonDef = ADDON_DEFINITIONS[entry.addonKey];
    paths.push({
      type: "BUY_ADDON",
      label: `Get ${addonDef.label}`,
      description: `$${(addonDef.monthlyPriceCents / 100).toFixed(0)}/mo add-on`,
      addonKey: entry.addonKey,
    });
  }
  if (entry.creditCost) {
    paths.push({
      type: "SPEND_CREDITS",
      label: `Use ${entry.creditCost} credits`,
      description: ctx.creditBalance > 0
        ? `You have ${ctx.creditBalance} credits (need ${entry.creditCost})`
        : `Purchase credits to use this action`,
      creditCost: entry.creditCost,
    });
  }
  return { allowed: false, accessModel: entry.addonKey ? "ADDON_REQUIRED" : "CREDIT_ACTION", upgradePaths: paths };
}

export interface DistributionRights {
  maxHubs: number;
  maxCategoriesPerHub: number;
  maxMicrosPerCategory: number;
  feedVisibility: boolean;
  featuredEligible: boolean;
  sponsoredEligible: boolean;
}

export const DISTRIBUTION_RIGHTS: Record<EntitlementTier, DistributionRights> = {
  FREE: {
    maxHubs: 0,
    maxCategoriesPerHub: 0,
    maxMicrosPerCategory: 0,
    feedVisibility: false,
    featuredEligible: false,
    sponsoredEligible: false,
  },
  VERIFIED: {
    maxHubs: 1,
    maxCategoriesPerHub: 1,
    maxMicrosPerCategory: 3,
    feedVisibility: false,
    featuredEligible: false,
    sponsoredEligible: false,
  },
  ENHANCED: {
    maxHubs: 2,
    maxCategoriesPerHub: 3,
    maxMicrosPerCategory: 5,
    feedVisibility: true,
    featuredEligible: true,
    sponsoredEligible: false,
  },
  ENTERPRISE: {
    maxHubs: -1,
    maxCategoriesPerHub: -1,
    maxMicrosPerCategory: -1,
    feedVisibility: true,
    featuredEligible: true,
    sponsoredEligible: true,
  },
};

export function getDistributionRights(tier: EntitlementTier): DistributionRights {
  return DISTRIBUTION_RIGHTS[tier];
}

export function getUpgradePath(
  ctx: AccessContext,
  target: { moduleKey?: string; actionKey?: CreditActionKey },
): UpgradePathOption[] {
  if (target.moduleKey) {
    const resolution = resolveAccessForModule(ctx, target.moduleKey);
    return resolution.upgradePaths;
  }

  if (target.actionKey) {
    const resolution = resolveAccessForAction(ctx, target.actionKey);
    return resolution.upgradePaths;
  }

  return [];
}

export function getAddonForCapability(capabilityType: CapabilityType): AddonDefinition | null {
  for (const addon of Object.values(ADDON_DEFINITIONS)) {
    if (addon.capabilities.includes(capabilityType)) {
      return addon;
    }
  }
  return null;
}
