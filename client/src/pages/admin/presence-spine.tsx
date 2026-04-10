import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { derivePublicLabel, CLAIM_STATUS_MAPPING, PLAN_PRICING } from "@shared/schema";
import {
  Shield, Crown, MapPin, User, CheckCircle, Gift,
  Loader2, X, Calendar, CreditCard
} from "lucide-react";
import { useState } from "react";

interface SpineData {
  presenceId: string;
  name: string;
  claimStatus: string;
  claimLabel: string;
  charlotteVerificationStatus: string;
  charlotteVerifiedAt: string | null;
  micrositeTier: string;
  listingTier: string;
  publicLabel: string;
  presenceType: string;
  crm: { stage: string; priority: string; ownerUserId: string | null; primaryRegionId: string | null } | null;
  region: { primaryRegionId: string; regionName: string | null } | null;
  owner: { ownerUserId: string; ownerName: string | null } | null;
  subscription: {
    plan: string;
    priceTier: string;
    amountCents: number;
    status: string;
    startAt: string;
    endAt: string;
    graceEndAt: string | null;
    founderLocked: boolean;
  } | null;
  supporters: { total: number; active: number; required: number } | null;
  supporterGraceStartedAt: string | null;
  supporterGraceEndAt: string | null;
}

interface RegionOption {
  id: string;
  name: string;
  regionType: string;
}

interface UserOption {
  id: string;
  name: string | null;
  email: string;
}

function formatDate(d: string | null) {
  if (!d) return "N/A";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function publicLabelVariant(label: string): "default" | "secondary" | "outline" {
  if (label === "Premium") return "default";
  if (label === "Verified") return "secondary";
  return "outline";
}

export function PresenceSpine({ presenceId, onClose }: { presenceId: string; onClose: () => void }) {
  const { toast } = useToast();
  const [selectedRegionId, setSelectedRegionId] = useState<string>("");
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>("");
  const [editMsiteTier, setEditMsiteTier] = useState<string>("");
  const [editClaimStatus, setEditClaimStatus] = useState<string>("");

  const { data: spine, isLoading } = useQuery<SpineData>({
    queryKey: ["/api/admin/presence-spine", presenceId],
  });

  const { data: regionsData } = useQuery<RegionOption[]>({
    queryKey: ["/api/admin/regions"],
  });

  const { data: usersData } = useQuery<UserOption[]>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/admin/presence/${presenceId}/charlotte-verify`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/presence-spine", presenceId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crm-presences"] });
      toast({ title: "Charlotte verification applied" });
    },
    onError: () => toast({ title: "Verification failed", variant: "destructive" }),
  });

  const giftEnhancedMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/admin/presence/${presenceId}/gift-charter`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/presence-spine", presenceId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crm-presences"] });
      toast({ title: "Enhanced gifted successfully" });
    },
    onError: (err: any) => toast({ title: "Gift Enhanced failed", description: err.message, variant: "destructive" }),
  });

  const assignRegionMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/admin/presence/${presenceId}/assign-region`, { regionId: selectedRegionId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/presence-spine", presenceId] });
      toast({ title: "Region assigned" });
      setSelectedRegionId("");
    },
    onError: () => toast({ title: "Failed to assign region", variant: "destructive" }),
  });

  const assignOwnerMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/admin/presence/${presenceId}/assign-owner`, { userId: selectedOwnerId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/presence-spine", presenceId] });
      toast({ title: "Owner assigned" });
      setSelectedOwnerId("");
    },
    onError: () => toast({ title: "Failed to assign owner", variant: "destructive" }),
  });

  const updateSpineMutation = useMutation({
    mutationFn: async (body: Record<string, string>) => {
      await apiRequest("PATCH", `/api/admin/presence-spine/${presenceId}`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/presence-spine", presenceId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crm-presences"] });
      toast({ title: "Spine updated" });
    },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });

  if (isLoading || !spine) {
    return (
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-6 w-48" />
          <Button size="icon" variant="ghost" onClick={onClose} data-testid="button-close-spine">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="font-semibold text-lg" data-testid="text-spine-name">{spine.name}</h2>
        <Button size="icon" variant="ghost" onClick={onClose} data-testid="button-close-spine">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Card className="p-4 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Shield className="h-4 w-4" /> Spine
        </h3>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <span className="text-muted-foreground text-xs">Claim Status</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Badge variant="outline" data-testid="badge-claim-status">{spine.claimLabel}</Badge>
            </div>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Charlotte Verification</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Badge
                variant={spine.charlotteVerificationStatus === "verified_by_charlotte" ? "default" : "outline"}
                data-testid="badge-charlotte-status"
              >
                {spine.charlotteVerificationStatus === "verified_by_charlotte" ? "Verified" : "Not Verified"}
              </Badge>
              {spine.charlotteVerifiedAt && (
                <span className="text-[10px] text-muted-foreground">{formatDate(spine.charlotteVerifiedAt)}</span>
              )}
            </div>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Microsite Tier</span>
            <div className="mt-0.5">
              <Badge variant="secondary" data-testid="badge-microsite-tier">{spine.micrositeTier}</Badge>
            </div>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Public Label</span>
            <div className="mt-0.5">
              <Badge variant={publicLabelVariant(spine.publicLabel)} data-testid="badge-public-label">
                {spine.publicLabel}
              </Badge>
            </div>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Primary Region</span>
            <p className="mt-0.5 flex items-center gap-1" data-testid="text-region">
              <MapPin className="h-3 w-3 text-muted-foreground" />
              {spine.region?.regionName || "Unassigned"}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Owner Rep</span>
            <p className="mt-0.5 flex items-center gap-1" data-testid="text-owner-rep">
              <User className="h-3 w-3 text-muted-foreground" />
              {spine.owner?.ownerName || "Unassigned"}
            </p>
          </div>
        </div>

        {spine.subscription && (
          <>
            <Separator />
            <div className="space-y-1">
              <h4 className="text-xs font-semibold flex items-center gap-1">
                <CreditCard className="h-3 w-3" /> Current Subscription
              </h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div>
                  <span className="text-muted-foreground">Plan:</span>{" "}
                  <span className="font-medium" data-testid="text-sub-plan">{spine.subscription.plan}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Price Tier:</span>{" "}
                  <span className="font-medium" data-testid="text-sub-price-tier">
                    {spine.subscription.priceTier}
                    {spine.subscription.founderLocked && " (Locked)"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">End:</span>{" "}
                  <span data-testid="text-sub-end">{formatDate(spine.subscription.endAt)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Grace End:</span>{" "}
                  <span data-testid="text-sub-grace-end">{formatDate(spine.subscription.graceEndAt)}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </Card>

      <Card className="p-4 space-y-3">
        <h3 className="text-sm font-semibold">Actions</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={() => verifyMutation.mutate()}
            disabled={verifyMutation.isPending || spine.charlotteVerificationStatus === "verified_by_charlotte"}
            data-testid="button-charlotte-verify"
          >
            {verifyMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5 mr-1" />}
            Verify by Charlotte
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => giftEnhancedMutation.mutate()}
            disabled={giftEnhancedMutation.isPending || spine.claimStatus !== "CLAIMED" || spine.micrositeTier === "enhanced" || spine.micrositeTier === "charter"}
            data-testid="button-gift-enhanced"
          >
            {giftEnhancedMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Gift className="h-3.5 w-3.5 mr-1" />}
            Gift Enhanced
          </Button>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <h3 className="text-sm font-semibold">Assign Region</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selectedRegionId} onValueChange={setSelectedRegionId}>
            <SelectTrigger className="w-48" data-testid="select-assign-region">
              <SelectValue placeholder="Select region" />
            </SelectTrigger>
            <SelectContent>
              {regionsData?.map(r => (
                <SelectItem key={r.id} value={r.id}>{r.name} ({r.regionType})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            onClick={() => assignRegionMutation.mutate()}
            disabled={!selectedRegionId || assignRegionMutation.isPending}
            data-testid="button-assign-region"
          >
            {assignRegionMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Assign"}
          </Button>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <h3 className="text-sm font-semibold">Assign Owner</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selectedOwnerId} onValueChange={setSelectedOwnerId}>
            <SelectTrigger className="w-48" data-testid="select-assign-owner">
              <SelectValue placeholder="Select owner" />
            </SelectTrigger>
            <SelectContent>
              {usersData?.map(u => (
                <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            onClick={() => assignOwnerMutation.mutate()}
            disabled={!selectedOwnerId || assignOwnerMutation.isPending}
            data-testid="button-assign-owner"
          >
            {assignOwnerMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Assign"}
          </Button>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <h3 className="text-sm font-semibold">Update Spine Fields</h3>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Microsite Tier</Label>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={editMsiteTier} onValueChange={setEditMsiteTier}>
                <SelectTrigger className="w-40" data-testid="select-edit-microsite-tier">
                  <SelectValue placeholder={spine.micrositeTier} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">none</SelectItem>
                  <SelectItem value="enhanced">enhanced</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (editMsiteTier) updateSpineMutation.mutate({ micrositeTier: editMsiteTier });
                }}
                disabled={!editMsiteTier || updateSpineMutation.isPending}
                data-testid="button-save-microsite-tier"
              >
                Save
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Claim Status</Label>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={editClaimStatus} onValueChange={setEditClaimStatus}>
                <SelectTrigger className="w-40" data-testid="select-edit-claim-status">
                  <SelectValue placeholder={spine.claimStatus} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNCLAIMED">UNCLAIMED</SelectItem>
                  <SelectItem value="CLAIM_SENT">CLAIM_SENT</SelectItem>
                  <SelectItem value="CLAIMED">CLAIMED</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (editClaimStatus) updateSpineMutation.mutate({ claimStatus: editClaimStatus });
                }}
                disabled={!editClaimStatus || updateSpineMutation.isPending}
                data-testid="button-save-claim-status"
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
