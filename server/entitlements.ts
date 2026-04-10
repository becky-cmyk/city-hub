import type { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import type { Entitlement, CapabilityType } from "@shared/schema";
import { MICROSITE_TIER_CONFIG } from "@shared/schema";
import type { AddonKey, AccessContext, CreditActionKey, ProfileType } from "./access-config";
import { ADDON_DEFINITIONS, PROFILE_TYPES, resolveAccessForModule, resolveAccessForAction } from "./access-config";

export type EntitlementTier = "FREE" | "VERIFIED" | "ENHANCED" | "ENTERPRISE";

export function normalizeTier(tier: string): EntitlementTier {
  if (tier === "CHARTER") return "ENHANCED";
  if (tier === "CHAMBER") return "VERIFIED";
  if (tier === "ENHANCED") return "ENHANCED";
  if (tier === "ENTERPRISE") return "ENTERPRISE";
  if (tier === "FREE") return "FREE";
  return "VERIFIED";
}

export interface BusinessCapabilities {
  tier: EntitlementTier;
  capabilities: {
    canUseGallery: boolean;
    canUseMediaBlocks: boolean;
    canShowBadges: boolean;
    canPriorityRank: boolean;
  };
}

const PRODUCT_TYPE_TO_TIER: Record<string, EntitlementTier> = {
  LISTING_TIER: "ENHANCED",
  FEATURED_PLACEMENT: "ENHANCED",
  SPONSORSHIP: "ENHANCED",
  SPOTLIGHT: "ENHANCED",
  CONTRIBUTOR_PACKAGE: "ENHANCED",
  ENTERPRISE_LICENSE: "ENTERPRISE",
};

const TIER_PRECEDENCE: Record<EntitlementTier, number> = {
  FREE: 0,
  VERIFIED: 1,
  ENHANCED: 2,
  ENTERPRISE: 3,
};

export async function getActiveEntitlements(cityId: string, businessId: string): Promise<Entitlement[]> {
  return storage.getActiveEntitlements(cityId, "BUSINESS", businessId);
}

export function deriveTier(activeEntitlements: Entitlement[]): EntitlementTier {
  if (activeEntitlements.length === 0) return "FREE";

  let highest: EntitlementTier = "VERIFIED";
  for (const ent of activeEntitlements) {
    const mapped = PRODUCT_TYPE_TO_TIER[ent.productType] || "VERIFIED";
    if (TIER_PRECEDENCE[mapped] > TIER_PRECEDENCE[highest]) {
      highest = mapped;
    }
    const meta = ent.metadata as Record<string, any> | null;
    if (meta?.tier) {
      const metaTier = normalizeTier(meta.tier);
      if (TIER_PRECEDENCE[metaTier] > TIER_PRECEDENCE[highest]) {
        highest = metaTier;
      }
    }
  }
  return highest;
}

export function hasEntitlement(activeEntitlements: Entitlement[], productType: string): boolean {
  return activeEntitlements.some(e => e.productType === productType);
}

export function resolveCapabilities(tier: EntitlementTier): BusinessCapabilities {
  const p = TIER_PRECEDENCE[tier];
  return {
    tier,
    capabilities: {
      canUseGallery: p >= TIER_PRECEDENCE.ENHANCED,
      canUseMediaBlocks: p >= TIER_PRECEDENCE.ENHANCED,
      canShowBadges: p >= TIER_PRECEDENCE.VERIFIED,
      canPriorityRank: p >= TIER_PRECEDENCE.ENHANCED,
    },
  };
}

export async function resolveBusinessCapabilities(cityId: string, businessId: string): Promise<BusinessCapabilities> {
  const active = await getActiveEntitlements(cityId, businessId);
  const tier = deriveTier(active);
  return resolveCapabilities(tier);
}

// ===== RANKING ENGINE =====

const TIER_BOOST: Record<EntitlementTier, number> = {
  FREE: 0,
  VERIFIED: 10,
  ENHANCED: 50,
  ENTERPRISE: 100,
};

export interface BusinessRanking {
  tier: EntitlementTier;
  priorityScore: number;
  badges: {
    chamber: boolean;
    premium: boolean;
  };
}

export function computeRanking(
  tier: EntitlementTier,
  basePriorityRank: number = 0,
  isFeatured: boolean = false,
): BusinessRanking {
  let score = basePriorityRank + TIER_BOOST[tier];
  if (isFeatured) score += 5;

  return {
    tier,
    priorityScore: score,
    badges: {
      chamber: false,
      premium: tier === "ENHANCED",
    },
  };
}

export interface RankedBusiness {
  tier: EntitlementTier;
  priorityScore: number;
  badges: { chamber: boolean; premium: boolean };
  [key: string]: any;
}

export async function enrichAndRankBusinesses(
  cityId: string,
  bizList: any[],
): Promise<RankedBusiness[]> {
  const enriched = await Promise.all(
    bizList.map(async (biz) => {
      const active = await getActiveEntitlements(cityId, biz.id);
      const tier = deriveTier(active);
      const ranking = computeRanking(tier, biz.priorityRank || 0, biz.isFeatured || false);
      return { ...biz, ...ranking };
    }),
  );
  enriched.sort((a, b) => b.priorityScore - a.priorityScore);
  return enriched;
}

export async function enrichSingleBusiness(
  cityId: string,
  biz: any,
): Promise<RankedBusiness> {
  const active = await getActiveEntitlements(cityId, biz.id);
  const tier = deriveTier(active);
  const ranking = computeRanking(tier, biz.priorityRank || 0, biz.isFeatured || false);
  return { ...biz, ...ranking };
}

// ===== COMMERCE HUB ROTATION ENGINE =====

const LISTING_TIER_TO_ENTITLEMENT: Record<string, EntitlementTier> = {
  FREE: "FREE",
  VERIFIED: "VERIFIED",
  ENHANCED: "ENHANCED",
  ENTERPRISE: "ENTERPRISE",
};

export function computeRotationWeight(
  listingTier: string,
  lastActivityDate?: Date | null,
): number {
  const entTier = LISTING_TIER_TO_ENTITLEMENT[listingTier] || "VERIFIED";
  const tierKey = (listingTier as keyof typeof MICROSITE_TIER_CONFIG) || "VERIFIED";
  const config = MICROSITE_TIER_CONFIG[tierKey] || MICROSITE_TIER_CONFIG.VERIFIED;
  let weight = config.rotationWeight;

  if (lastActivityDate) {
    const daysSince = (Date.now() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince <= 14) {
      weight += 1;
    }
  }

  return weight;
}

export function weightedShuffle<T extends { rotationWeight?: number }>(items: T[]): T[] {
  const weighted: { item: T; sortKey: number }[] = items.map(item => ({
    item,
    sortKey: Math.random() * (item.rotationWeight || 1),
  }));
  weighted.sort((a, b) => b.sortKey - a.sortKey);
  return weighted.map(w => w.item);
}

export interface RequireEntitlementOptions {
  productType?: string;
  hubScope?: boolean;
  categoryScope?: boolean;
  microScope?: boolean;
  capabilityType?: CapabilityType;
  moduleKey?: string;
  creditAction?: string;
}

export function requireEntitlement(productTypeOrOptions: string | RequireEntitlementOptions) {
  const opts: RequireEntitlementOptions = typeof productTypeOrOptions === "string"
    ? { productType: productTypeOrOptions }
    : productTypeOrOptions;

  return async (req: Request, res: Response, next: NextFunction) => {
    const cityId = (req as any)._cityId;
    const businessId = (req as any)._businessId;

    if (opts.hubScope || opts.categoryScope || opts.microScope || opts.capabilityType) {
      const hubEngine = await import("./hub-entitlements");
      const presenceId = businessId || req.params.businessId;
      const hubId = (req as any)._hubId || req.body?.hubId || req.params.hubId;

      if (!presenceId) {
        return res.status(400).json({ error: "MISSING_CONTEXT", message: "presenceId required" });
      }

      if (opts.capabilityType) {
        if (!hubId) {
          return res.status(400).json({ error: "MISSING_CONTEXT", message: "hubId required for capability check" });
        }
        const { allowed } = await hubEngine.checkCapabilityAccess(presenceId, hubId, opts.capabilityType);
        if (!allowed) {
          return res.status(403).json({
            error: "CAPABILITY_REQUIRED",
            message: `Active ${opts.capabilityType} capability required`,
            requiredCapability: opts.capabilityType,
            presenceId, hubId,
          });
        }
      }

      if (opts.microScope) {
        const categoryId = (req as any)._categoryId || req.body?.categoryId || req.params.categoryId;
        const microId = (req as any)._microId || req.body?.microId || req.params.microId;
        if (!hubId || !categoryId || !microId) {
          return res.status(400).json({ error: "MISSING_CONTEXT", message: "hubId, categoryId, and microId required for micro scope" });
        }
        const { allowed } = await hubEngine.checkMicroAccess(presenceId, hubId, categoryId, microId);
        if (!allowed) {
          return res.status(403).json({ error: "MICRO_ENTITLEMENT_REQUIRED", presenceId, hubId, categoryId, microId });
        }
      } else if (opts.categoryScope) {
        const categoryId = (req as any)._categoryId || req.body?.categoryId || req.params.categoryId;
        if (!hubId || !categoryId) {
          return res.status(400).json({ error: "MISSING_CONTEXT", message: "hubId and categoryId required for category scope" });
        }
        const { allowed } = await hubEngine.checkCategoryAccess(presenceId, hubId, categoryId);
        if (!allowed) {
          return res.status(403).json({ error: "CATEGORY_ENTITLEMENT_REQUIRED", presenceId, hubId, categoryId });
        }
      } else if (opts.hubScope) {
        if (!hubId) {
          return res.status(400).json({ error: "MISSING_CONTEXT", message: "hubId required for hub scope" });
        }
        const { allowed } = await hubEngine.checkHubAccess(presenceId, hubId);
        if (!allowed) {
          return res.status(403).json({ error: "HUB_ENTITLEMENT_REQUIRED", presenceId, hubId });
        }
      }

      return next();
    }

    if (!cityId || !businessId) {
      return res.status(400).json({ error: "MISSING_CONTEXT", message: "cityId and businessId required" });
    }

    if (opts.moduleKey || opts.creditAction) {
      const isAdmin = !!(req.session as any)?.admin;
      let profileTypes: ProfileType[] | undefined;
      const publicUserId = (req.session as any)?.publicUserId;
      let activeProfileType: ProfileType | undefined;
      if (publicUserId) {
        const user = await storage.getPublicUserById(publicUserId);
        if (user) {
          profileTypes = ((user as any).profileTypes || ["resident"]) as ProfileType[];
          activeProfileType = ((user as any).activeProfileType || profileTypes[0] || "resident") as ProfileType;
        }
      }
      const ctx = await buildAccessContext(cityId, businessId, { isAdmin, profileTypes, activeProfileType });

      if (opts.moduleKey) {
        const resolution = resolveAccessForModule(ctx, opts.moduleKey);
        if (!resolution.allowed) {
          return res.status(403).json({
            error: "MODULE_ACCESS_DENIED",
            moduleKey: opts.moduleKey,
            accessModel: resolution.accessModel,
            upgradePaths: resolution.upgradePaths,
            tier: ctx.currentTier,
            businessId,
            cityId,
          });
        }
      }

      if (opts.creditAction) {
        const resolution = resolveAccessForAction(
          ctx,
          opts.creditAction as CreditActionKey,
        );
        if (!resolution.allowed) {
          return res.status(403).json({
            error: "ACTION_ACCESS_DENIED",
            creditAction: opts.creditAction,
            accessModel: resolution.accessModel,
            upgradePaths: resolution.upgradePaths,
            tier: ctx.currentTier,
            creditBalance: ctx.creditBalance,
            businessId,
            cityId,
          });
        }
      }

      return next();
    }

    if (opts.productType) {
      const active = await getActiveEntitlements(cityId, businessId);
      if (!hasEntitlement(active, opts.productType)) {
        const tier = deriveTier(active);
        return res.status(403).json({
          error: "ENTITLEMENT_REQUIRED",
          requiredProductType: opts.productType,
          tier,
          businessId,
          cityId,
        });
      }
    }
    next();
  };
}

const TIER_ORDER_LIST: EntitlementTier[] = ["FREE", "VERIFIED", "ENHANCED", "ENTERPRISE"];

export function requireTier(minTier: EntitlementTier) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const cityId = (req as any)._cityId;
    const businessId = (req as any)._businessId;

    if (!cityId || !businessId) {
      return res.status(400).json({ error: "MISSING_CONTEXT", message: "cityId and businessId required" });
    }

    const isAdmin = !!(req.session as any)?.admin;
    if (isAdmin) return next();

    const active = await getActiveEntitlements(cityId, businessId);
    const tier = deriveTier(active);
    const currentIdx = TIER_ORDER_LIST.indexOf(tier);
    const requiredIdx = TIER_ORDER_LIST.indexOf(minTier);

    if (currentIdx < requiredIdx) {
      return res.status(403).json({
        error: "TIER_REQUIRED",
        currentTier: tier,
        requiredTier: minTier,
        message: `This feature requires ${minTier} tier or above`,
      });
    }

    next();
  };
}

export async function buildAccessContext(
  cityId: string,
  businessId: string,
  opts?: { isAdmin?: boolean; profileTypes?: ProfileType[]; activeProfileType?: ProfileType },
): Promise<AccessContext> {
  const hubEngine = await import("./hub-entitlements");
  const active = await getActiveEntitlements(cityId, businessId);
  const tier = deriveTier(active);
  const creditBalance = await hubEngine.getCreditBalance(businessId);
  const capabilities = await hubEngine.getActiveCapabilities(businessId);

  const activeAddons: AddonKey[] = [];
  const capTypes = new Set(capabilities.map(c => c.capabilityType));

  for (const [key, def] of Object.entries(ADDON_DEFINITIONS)) {
    if (def.capabilities.length > 0 && def.capabilities.some((cap: string) => capTypes.has(cap))) {
      activeAddons.push(key as AddonKey);
    }
  }

  const addonEntitlements = active.filter(e =>
    e.status === "ACTIVE" && e.metadata && typeof e.metadata === "object" && "addonKey" in e.metadata
  );
  for (const ent of addonEntitlements) {
    const addonKey = (ent.metadata as Record<string, string>).addonKey as AddonKey;
    if (addonKey && ADDON_DEFINITIONS[addonKey] && !activeAddons.includes(addonKey)) {
      activeAddons.push(addonKey);
    }
  }

  const rawProfileTypes = opts?.profileTypes ?? ["resident"];
  const validProfileTypes = rawProfileTypes.filter(
    (pt): pt is ProfileType => (PROFILE_TYPES as readonly string[]).includes(pt)
  );

  const finalProfileTypes = validProfileTypes.length > 0 ? validProfileTypes : (["resident"] as ProfileType[]);
  const activeProfileType = opts?.activeProfileType && finalProfileTypes.includes(opts.activeProfileType)
    ? opts.activeProfileType
    : finalProfileTypes[0];

  let moduleOverrides: Record<string, boolean> | undefined;
  const biz = await storage.getBusinessById(businessId);
  if (biz && (biz as any).moduleOverrides && typeof (biz as any).moduleOverrides === "object") {
    moduleOverrides = (biz as any).moduleOverrides as Record<string, boolean>;
  }

  return {
    currentTier: tier,
    activeAddons,
    creditBalance: creditBalance.total,
    isAdmin: opts?.isAdmin ?? false,
    profileTypes: finalProfileTypes,
    activeProfileType,
    moduleOverrides,
  };
}
