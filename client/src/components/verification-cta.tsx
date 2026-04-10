import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { VerifiedBadge } from "./verified-badge";
import { useI18n } from "@/lib/i18n";

const TIER_KEYS = [
  { id: "standard", labelKey: "verification.standard" as const, amount: "$1", descKey: "verification.standardDesc" as const },
  { id: "supporter", labelKey: "verification.supporter" as const, amount: "$5", descKey: "verification.supporterDesc" as const },
  { id: "builder", labelKey: "verification.builder" as const, amount: "$10", descKey: "verification.builderDesc" as const },
  { id: "champion", labelKey: "verification.champion" as const, amount: "$15", descKey: "verification.championDesc" as const },
] as const;

interface VerificationCTAProps {
  compact?: boolean;
}

export function VerificationCTA({ compact = false }: VerificationCTAProps) {
  const { toast } = useToast();
  const { t } = useI18n();
  const [selectedTier, setSelectedTier] = useState<string>("standard");

  const { data: status, isLoading } = useQuery<{
    isVerifiedContributor: boolean;
    contributorStatus: string;
    verificationTier: string | null;
  }>({
    queryKey: ["/api/contributor/status"],
  });

  const checkoutMutation = useMutation({
    mutationFn: async (tier: string) => {
      const res = await apiRequest("POST", "/api/contributor/verify-checkout", { tier });
      return res.json();
    },
    onSuccess: (data: { url: string }) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (err: Error) => {
      toast({ title: t("verification.unableToStart"), description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) return null;

  if (status?.isVerifiedContributor) {
    return (
      <div className="flex items-center gap-2 text-sm" data-testid="verification-status-verified">
        <VerifiedBadge tier={status.verificationTier} size="md" showLabel />
        <span className="text-muted-foreground">{t("verification.priorityReview")}</span>
      </div>
    );
  }

  if (compact) {
    return (
      <Card className="p-4 border-dashed" data-testid="verification-cta-compact">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{t("verification.getVerified")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("verification.verifiedDesc")}
            </p>
            <Button
              size="sm"
              className="mt-2"
              onClick={() => checkoutMutation.mutate("standard")}
              disabled={checkoutMutation.isPending}
              data-testid="button-verify-compact"
            >
              {checkoutMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              {t("verification.verifyFor")}
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6" data-testid="verification-cta-full">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck className="h-5 w-5 text-green-600" />
        <h3 className="font-semibold">{t("verification.becomeVerified")}</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        {t("verification.contributionDesc")}
      </p>

      <div className="grid grid-cols-2 gap-2 mb-4">
        {TIER_KEYS.map((tier) => (
          <button
            key={tier.id}
            onClick={() => setSelectedTier(tier.id)}
            className={`p-3 rounded-lg border text-left transition-colors ${
              selectedTier === tier.id
                ? "border-green-600 bg-green-50 dark:bg-green-950/30"
                : "border-border"
            }`}
            data-testid={`tier-option-${tier.id}`}
          >
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">{t(tier.labelKey)}</span>
              <Badge variant="secondary" className="text-xs">{tier.amount}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t(tier.descKey)}</p>
          </button>
        ))}
      </div>

      <Button
        className="w-full"
        onClick={() => checkoutMutation.mutate(selectedTier)}
        disabled={checkoutMutation.isPending}
        data-testid="button-verify-checkout"
      >
        {checkoutMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {t("verification.verifyContribute", { amount: TIER_KEYS.find(tk => tk.id === selectedTier)?.amount || "$1" })}
      </Button>

      <p className="text-xs text-center text-muted-foreground mt-3">
        {t("verification.freeSubmissions")}
      </p>
    </Card>
  );
}
