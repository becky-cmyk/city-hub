import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Layers, Shield, CreditCard, Zap, Search, ArrowUpRight, History } from "lucide-react";

const TIER_COLORS: Record<string, string> = {
  FREE: "bg-zinc-600 text-zinc-100",
  VERIFIED: "bg-blue-600 text-blue-100",
  ENHANCED: "bg-purple-600 text-purple-100",
  ENTERPRISE: "bg-amber-600 text-amber-100",
};

function TierBadge({ tier }: { tier: string }) {
  return (
    <Badge className={`${TIER_COLORS[tier] || "bg-zinc-600 text-zinc-100"} border-0`} data-testid={`badge-tier-${tier}`}>
      {tier}
    </Badge>
  );
}

interface PackageMatrix {
  tiers: Record<string, {
    label: string;
    monthlyCredits: number;
    includedModules: string[];
    postingLimits: Record<string, number>;
    distributionEligible: boolean;
    micrositeEnabled: boolean;
    priorityBoost: number;
  }>;
  addons: Record<string, {
    key: string;
    label: string;
    description: string;
    monthlyPriceCents: number;
  }>;
  creditActions: Record<string, {
    key: string;
    label: string;
    costCredits: number;
  }>;
  actionMatrix: Record<string, {
    minTier: string;
    addonKey?: string;
    creditCost?: number;
    freeAllowed: boolean;
    label: string;
  }>;
  distributionRights: Record<string, {
    maxHubs: number;
    maxCategoriesPerHub: number;
    maxMicrosPerCategory: number;
    feedVisibility: boolean;
    featuredEligible: boolean;
    sponsoredEligible: boolean;
  }>;
}

interface PackageStatus {
  businessId: string;
  businessName: string;
  tier: string;
  tierConfig: PackageMatrix["tiers"][string];
  activeAddons: string[];
  creditBalance: { total: number };
  distributionRights: PackageMatrix["distributionRights"][string];
  activeEntitlements: number;
  listingTier: string;
}

function TierOverview({ matrix }: { matrix: PackageMatrix }) {
  const tiers = ["FREE", "VERIFIED", "ENHANCED", "ENTERPRISE"];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4" data-testid="section-tier-overview">
      {tiers.map((tierKey) => {
        const tier = matrix.tiers[tierKey];
        if (!tier) return null;
        const dist = matrix.distributionRights[tierKey];
        return (
          <Card key={tierKey} className="bg-white/5 border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base text-white">
                <TierBadge tier={tierKey} />
                {tier.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-xs text-white/60 space-y-1">
                <p>{tier.monthlyCredits} credits/month</p>
                <p>{tier.includedModules.length} modules included</p>
                <p>Priority boost: +{tier.priorityBoost}</p>
                <p>Microsite: {tier.micrositeEnabled ? "Yes" : "No"}</p>
                <p>Distribution: {tier.distributionEligible ? "Yes" : "No"}</p>
              </div>
              {dist && (
                <div className="border-t border-white/10 pt-2 text-xs text-white/40 space-y-1">
                  <p>Hubs: {dist.maxHubs === -1 ? "Unlimited" : dist.maxHubs}</p>
                  <p>Categories/Hub: {dist.maxCategoriesPerHub === -1 ? "Unlimited" : dist.maxCategoriesPerHub}</p>
                  <p>Micros/Category: {dist.maxMicrosPerCategory === -1 ? "Unlimited" : dist.maxMicrosPerCategory}</p>
                  <p>Feed: {dist.feedVisibility ? "Yes" : "No"}</p>
                  <p>Featured: {dist.featuredEligible ? "Yes" : "No"}</p>
                  <p>Sponsored: {dist.sponsoredEligible ? "Yes" : "No"}</p>
                </div>
              )}
              <div className="border-t border-white/10 pt-2">
                <p className="text-xs text-white/40 mb-1">Modules:</p>
                <div className="flex flex-wrap gap-1">
                  {tier.includedModules.map((mod) => (
                    <Badge key={mod} variant="outline" className="text-[10px] border-white/20 text-white/60">
                      {mod.replace(/_/g, " ")}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function ActionMatrixTable({ matrix }: { matrix: PackageMatrix }) {
  const entries = Object.entries(matrix.actionMatrix);
  return (
    <Card className="bg-white/5 border-white/10" data-testid="section-action-matrix">
      <CardHeader>
        <CardTitle className="text-sm text-white flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-400" />
          Action Matrix
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10 text-white/40">
                <th className="text-left py-2 pr-4">Action</th>
                <th className="text-left py-2 pr-4">Min Tier</th>
                <th className="text-left py-2 pr-4">Add-on</th>
                <th className="text-left py-2 pr-4">Credits</th>
                <th className="text-left py-2">Free</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(([key, entry]) => (
                <tr key={key} className="border-b border-white/5 text-white/70">
                  <td className="py-2 pr-4">{entry.label}</td>
                  <td className="py-2 pr-4"><TierBadge tier={entry.minTier} /></td>
                  <td className="py-2 pr-4">{entry.addonKey ? <Badge variant="outline" className="text-[10px] border-white/20 text-white/60">{entry.addonKey}</Badge> : "—"}</td>
                  <td className="py-2 pr-4">{entry.creditCost ?? "—"}</td>
                  <td className="py-2">{entry.freeAllowed ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function AddonsTable({ matrix }: { matrix: PackageMatrix }) {
  return (
    <Card className="bg-white/5 border-white/10" data-testid="section-addons">
      <CardHeader>
        <CardTitle className="text-sm text-white flex items-center gap-2">
          <Layers className="h-4 w-4 text-purple-400" />
          Add-ons
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(matrix.addons).map(([key, addon]) => (
            <div key={key} className="rounded-md border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-white">{addon.label}</span>
                <span className="text-xs text-amber-400">${(addon.monthlyPriceCents / 100).toFixed(0)}/mo</span>
              </div>
              <p className="text-[10px] text-white/40">{addon.description}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function BusinessLookup() {
  const { toast } = useToast();
  const [searchId, setSearchId] = useState("");
  const [activeId, setActiveId] = useState("");
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideTier, setOverrideTier] = useState("VERIFIED");
  const [overrideNote, setOverrideNote] = useState("");

  const statusQuery = useQuery<PackageStatus>({
    queryKey: ["/api/admin/businesses", activeId, "package-status"],
    queryFn: () => fetch(`/api/admin/businesses/${activeId}/package-status`, { credentials: "include" }).then(r => r.json()),
    enabled: !!activeId,
  });

  const historyQuery = useQuery({
    queryKey: ["/api/admin/tier-change-log", activeId],
    queryFn: () => fetch(`/api/admin/tier-change-log/${activeId}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!activeId,
  });

  const overrideMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/admin/businesses/${activeId}/override-tier`, {
        tier: overrideTier,
        note: overrideNote,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses", activeId, "package-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tier-change-log", activeId] });
      setOverrideOpen(false);
      setOverrideNote("");
      toast({ title: "Tier override applied" });
    },
    onError: () => {
      toast({ title: "Failed to apply override", variant: "destructive" });
    },
  });

  const creditMutation = useMutation({
    mutationFn: async (amount: number) => {
      await apiRequest("POST", `/api/admin/businesses/${activeId}/grant-credits`, {
        amount,
        note: "Admin grant via Package Matrix",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses", activeId, "package-status"] });
      toast({ title: "Credits granted" });
    },
    onError: () => {
      toast({ title: "Failed to grant credits", variant: "destructive" });
    },
  });

  const status = statusQuery.data;
  const history = (historyQuery.data || []) as Array<{
    id: string;
    old_tier: string;
    new_tier: string;
    changed_by: string;
    note: string;
    created_at: string;
  }>;

  return (
    <Card className="bg-white/5 border-white/10" data-testid="section-business-lookup">
      <CardHeader>
        <CardTitle className="text-sm text-white flex items-center gap-2">
          <Search className="h-4 w-4 text-blue-400" />
          Business Package Lookup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Enter business ID"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            className="bg-white/5 border-white/10 text-white text-xs"
            data-testid="input-business-search"
          />
          <Button
            variant="outline"
            className="border-white/20 text-white text-xs"
            onClick={() => setActiveId(searchId.trim())}
            data-testid="button-lookup-business"
          >
            Lookup
          </Button>
        </div>

        {statusQuery.isLoading && <p className="text-xs text-white/40">Loading...</p>}

        {status && (
          <div className="space-y-4">
            <div className="rounded-md border border-white/10 bg-white/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white" data-testid="text-business-name">{status.businessName}</p>
                  <p className="text-[10px] text-white/40">{status.businessId}</p>
                </div>
                <TierBadge tier={status.tier} />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <p className="text-[10px] text-white/40">Credits</p>
                  <p className="text-sm text-white" data-testid="text-credit-balance">{status.creditBalance?.total ?? 0}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-white/40">Active Entitlements</p>
                  <p className="text-sm text-white">{status.activeEntitlements}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-white/40">Listing Tier</p>
                  <p className="text-sm text-white">{status.listingTier}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-white/40">Active Add-ons</p>
                  <p className="text-sm text-white">{status.activeAddons.length > 0 ? status.activeAddons.join(", ") : "None"}</p>
                </div>
              </div>

              {status.distributionRights && (
                <div className="border-t border-white/10 pt-2">
                  <p className="text-[10px] text-white/40 mb-1">Distribution Rights</p>
                  <div className="flex gap-3 text-xs text-white/60">
                    <span>Hubs: {status.distributionRights.maxHubs === -1 ? "Unlimited" : status.distributionRights.maxHubs}</span>
                    <span>Feed: {status.distributionRights.feedVisibility ? "Yes" : "No"}</span>
                    <span>Featured: {status.distributionRights.featuredEligible ? "Yes" : "No"}</span>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2 border-t border-white/10">
                <Dialog open={overrideOpen} onOpenChange={setOverrideOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="border-white/20 text-white text-xs" data-testid="button-override-tier">
                      <ArrowUpRight className="h-3 w-3 mr-1" />
                      Override Tier
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-zinc-900 border-white/10">
                    <DialogHeader>
                      <DialogTitle className="text-white text-sm">Override Tier for {status.businessName}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-white/40 mb-1">Current: <TierBadge tier={status.tier} /></p>
                      </div>
                      <Select value={overrideTier} onValueChange={setOverrideTier}>
                        <SelectTrigger className="bg-white/5 border-white/10 text-white text-xs" data-testid="select-override-tier">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="FREE">Free</SelectItem>
                          <SelectItem value="VERIFIED">Verified</SelectItem>
                          <SelectItem value="ENHANCED">Enhanced</SelectItem>
                          <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                        </SelectContent>
                      </Select>
                      <Textarea
                        placeholder="Note (optional)"
                        value={overrideNote}
                        onChange={(e) => setOverrideNote(e.target.value)}
                        className="bg-white/5 border-white/10 text-white text-xs"
                        data-testid="input-override-note"
                      />
                      <Button
                        className="w-full text-xs"
                        onClick={() => overrideMutation.mutate()}
                        disabled={overrideMutation.isPending}
                        data-testid="button-confirm-override"
                      >
                        {overrideMutation.isPending ? "Applying..." : "Apply Override"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <Button
                  variant="outline"
                  className="border-white/20 text-white text-xs"
                  onClick={() => creditMutation.mutate(5)}
                  disabled={creditMutation.isPending}
                  data-testid="button-grant-5-credits"
                >
                  <CreditCard className="h-3 w-3 mr-1" />
                  +5 Credits
                </Button>
                <Button
                  variant="outline"
                  className="border-white/20 text-white text-xs"
                  onClick={() => creditMutation.mutate(10)}
                  disabled={creditMutation.isPending}
                  data-testid="button-grant-10-credits"
                >
                  <CreditCard className="h-3 w-3 mr-1" />
                  +10 Credits
                </Button>
              </div>
            </div>

            {history.length > 0 && (
              <div className="rounded-md border border-white/10 bg-white/5 p-3">
                <p className="text-xs font-medium text-white flex items-center gap-1 mb-2">
                  <History className="h-3 w-3 text-white/40" />
                  Tier Change History
                </p>
                <div className="space-y-2">
                  {history.map((entry) => (
                    <div key={entry.id} className="flex items-center gap-2 text-[10px] text-white/60">
                      <TierBadge tier={entry.old_tier} />
                      <span>→</span>
                      <TierBadge tier={entry.new_tier} />
                      <span className="text-white/30">{entry.changed_by}</span>
                      {entry.note && <span className="text-white/20 truncate max-w-[200px]">{entry.note}</span>}
                      <span className="text-white/20 ml-auto">{new Date(entry.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function PackageManagementPanel({ cityId }: { cityId?: string }) {
  const matrixQuery = useQuery<PackageMatrix>({
    queryKey: ["/api/admin/package-matrix"],
  });

  if (matrixQuery.isLoading) {
    return <div className="p-6 text-white/40 text-sm">Loading package matrix...</div>;
  }

  const matrix = matrixQuery.data;
  if (!matrix) {
    return <div className="p-6 text-white/40 text-sm">Failed to load package matrix</div>;
  }

  return (
    <div className="space-y-6 p-1" data-testid="section-package-management">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-purple-400" />
        <h2 className="text-lg font-semibold text-white">Package Matrix</h2>
      </div>

      <TierOverview matrix={matrix} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AddonsTable matrix={matrix} />
        <ActionMatrixTable matrix={matrix} />
      </div>
      <BusinessLookup />
    </div>
  );
}
