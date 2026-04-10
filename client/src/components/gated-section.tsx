import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, TrendingUp, Loader2, Zap, ShoppingCart } from "lucide-react";
import type { AccessResolution, UpgradePathOption, EntitlementTier } from "@/hooks/use-business-access";
import { useI18n } from "@/lib/i18n";

interface GatedSectionProps {
  resolution: AccessResolution;
  featureLabel: string;
  onUpgrade?: (tier: string) => void;
  onBuyAddon?: (addonKey: string) => void;
  onSpendCredits?: (actionKey: string, cost: number) => void;
  isPending?: boolean;
  children: React.ReactNode;
}

export function GatedSection({
  resolution,
  featureLabel,
  onUpgrade,
  onBuyAddon,
  onSpendCredits,
  isPending,
  children,
}: GatedSectionProps) {
  const { t } = useI18n();
  if (resolution.allowed) {
    return <>{children}</>;
  }

  return (
    <Card className="relative overflow-hidden" data-testid={`gate-${featureLabel.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
            <Lock className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-sm" data-testid="text-gate-title">{featureLabel}</h3>
            <p className="text-xs text-muted-foreground" data-testid="text-gate-model">
              {resolution.accessModel === "TIER_INCLUDED" && t("gate.requiresHigherTier")}
              {resolution.accessModel === "ADDON_REQUIRED" && t("gate.availableAsAddon")}
              {resolution.accessModel === "CREDIT_ACTION" && t("gate.availableWithCredits")}
            </p>
          </div>
        </div>

        {resolution.upgradePaths.length > 0 && (
          <div className="space-y-2">
            {resolution.upgradePaths.map((path, i) => (
              <UpgradePathButton
                key={i}
                path={path}
                onUpgrade={onUpgrade}
                onBuyAddon={onBuyAddon}
                onSpendCredits={onSpendCredits}
                isPending={isPending}
              />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function UpgradePathButton({
  path,
  onUpgrade,
  onBuyAddon,
  onSpendCredits,
  isPending,
}: {
  path: UpgradePathOption;
  onUpgrade?: (tier: string) => void;
  onBuyAddon?: (addonKey: string) => void;
  onSpendCredits?: (actionKey: string, cost: number) => void;
  isPending?: boolean;
}) {
  const handleClick = () => {
    if (path.type === "UPGRADE_TIER" && path.tierRequired && onUpgrade) {
      onUpgrade(path.tierRequired);
    } else if (path.type === "BUY_ADDON" && path.addonKey && onBuyAddon) {
      onBuyAddon(path.addonKey);
    } else if (path.type === "SPEND_CREDITS" && path.creditActionKey && path.creditCost && onSpendCredits) {
      onSpendCredits(path.creditActionKey, path.creditCost);
    }
  };

  const icon = path.type === "UPGRADE_TIER"
    ? TrendingUp
    : path.type === "BUY_ADDON"
      ? ShoppingCart
      : Zap;

  const Icon = icon;

  return (
    <div className="flex items-center justify-between rounded-lg border p-3" data-testid={`upgrade-path-${path.type.toLowerCase()}`}>
      <div className="flex-1 min-w-0 mr-3">
        <p className="text-sm font-medium">{path.label}</p>
        <p className="text-xs text-muted-foreground">{path.description}</p>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={handleClick}
        disabled={isPending || (!onUpgrade && !onBuyAddon && !onSpendCredits)}
        data-testid={`button-path-${path.type.toLowerCase()}`}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Icon className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}

interface GatedButtonProps {
  resolution: AccessResolution;
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
  className?: string;
  "data-testid"?: string;
}

export function GatedButton({
  resolution,
  onClick,
  label,
  icon,
  disabled,
  variant = "default",
  className,
  ...props
}: GatedButtonProps) {
  if (!resolution.allowed) {
    const firstPath = resolution.upgradePaths[0];
    return (
      <div className="space-y-1">
        <Button disabled className={`gap-2 ${className || ""}`} data-testid={props["data-testid"]}>
          <Lock className="h-4 w-4" /> {label}
        </Button>
        {firstPath && (
          <p className="text-xs text-muted-foreground">{firstPath.description}</p>
        )}
      </div>
    );
  }

  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      variant={variant}
      className={`gap-2 ${className || ""}`}
      data-testid={props["data-testid"]}
    >
      {icon} {label}
    </Button>
  );
}

export function TierBadge({ tier }: { tier: EntitlementTier }) {
  const colors: Record<EntitlementTier, "default" | "secondary" | "outline" | "destructive"> = {
    FREE: "secondary",
    VERIFIED: "outline",
    ENHANCED: "default",
    ENTERPRISE: "destructive",
  };

  return (
    <Badge variant={colors[tier]} data-testid={`badge-tier-${tier.toLowerCase()}`}>
      {tier}
    </Badge>
  );
}
