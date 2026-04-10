import { useQuery } from "@tanstack/react-query";

export type EntitlementTier = "FREE" | "VERIFIED" | "ENHANCED" | "ENTERPRISE";

export interface BusinessCapabilities {
  tier: EntitlementTier;
  capabilities: {
    canUseGallery: boolean;
    canUseMediaBlocks: boolean;
    canShowBadges: boolean;
    canPriorityRank: boolean;
  };
  visibleModules?: string[];
}

export interface UpgradePathOption {
  type: "UPGRADE_TIER" | "BUY_ADDON" | "SPEND_CREDITS" | "ADMIN_ONLY";
  label: string;
  description: string;
  tierRequired?: EntitlementTier;
  addonKey?: string;
  creditCost?: number;
  creditActionKey?: string;
}

export interface AccessResolution {
  allowed: boolean;
  accessModel: string;
  upgradePaths: UpgradePathOption[];
}

export interface AccessCheckResponse {
  tier: EntitlementTier;
  creditBalance: number;
  modules: Record<string, AccessResolution>;
  actions: Record<string, AccessResolution>;
}

const TIER_ORDER: EntitlementTier[] = ["FREE", "VERIFIED", "ENHANCED", "ENTERPRISE"];

export function tierAtLeast(current: EntitlementTier, minimum: EntitlementTier): boolean {
  return TIER_ORDER.indexOf(current) >= TIER_ORDER.indexOf(minimum);
}

export function useBusinessAccess(citySlug: string, slug: string, enabled = true) {
  const { data, isLoading } = useQuery<AccessCheckResponse>({
    queryKey: ["/api/cities", citySlug, "owner", slug, "access-check"],
    enabled,
  });

  return {
    access: data,
    isLoading,
    tier: data?.tier ?? "FREE" as EntitlementTier,
    creditBalance: data?.creditBalance ?? 0,
    checkModule: (moduleKey: string): AccessResolution => {
      if (!data?.modules[moduleKey]) {
        return { allowed: false, accessModel: "TIER_INCLUDED", upgradePaths: [] };
      }
      return data.modules[moduleKey];
    },
    checkAction: (actionKey: string): AccessResolution => {
      if (!data?.actions[actionKey]) {
        return { allowed: false, accessModel: "TIER_INCLUDED", upgradePaths: [] };
      }
      return data.actions[actionKey];
    },
  };
}
