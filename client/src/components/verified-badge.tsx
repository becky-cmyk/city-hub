import { ShieldCheck } from "lucide-react";

interface VerifiedBadgeProps {
  tier?: string | null;
  size?: "sm" | "md";
  showLabel?: boolean;
}

const TIER_LABELS: Record<string, string> = {
  standard: "Verified",
  supporter: "Supporter",
  builder: "Builder",
  champion: "Champion",
};

const TIER_COLORS: Record<string, string> = {
  standard: "text-green-600",
  supporter: "text-blue-600",
  builder: "text-violet-600",
  champion: "text-amber-600",
};

export function VerifiedBadge({ tier, size = "sm", showLabel = false }: VerifiedBadgeProps) {
  const label = TIER_LABELS[tier || "standard"] || "Verified";
  const colorClass = TIER_COLORS[tier || "standard"] || "text-green-600";
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <span
      className={`inline-flex items-center gap-1 ${colorClass}`}
      title={`${label} Contributor`}
      data-testid="badge-verified-contributor"
    >
      <ShieldCheck className={iconSize} />
      {showLabel && <span className="text-xs font-medium">{label}</span>}
    </span>
  );
}
