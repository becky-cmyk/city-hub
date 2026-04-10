import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Shield, RefreshCw, AlertTriangle, CheckCircle, Clock, Star, FileText, Calendar, MessageSquare, Loader2 } from "lucide-react";
import { useState } from "react";

interface SignalSnapshot {
  isVerified: boolean;
  claimStatus: string;
  reviewCount: number;
  averageRating: number;
  badgeCount: number;
  activeBadges: string[];
  isCrownParticipant: boolean;
  isCrownWinner: boolean;
  storyDepthScore: number;
  lastActivityAt: string | null;
  daysSinceLastActivity: number | null;
  storyTrustFields?: {
    serviceClarity: number;
    localRelevance: number;
    communityInvolvement: number;
  };
}

interface TrustProfile {
  id: string;
  businessId: string;
  trustLevel: string;
  operationalStatus: string;
  signalSnapshot: SignalSnapshot | null;
  contextLabels: string[] | null;
  isEligibleForNetwork: boolean;
  isQualified: boolean;
  lastComputedAt: string | null;
}

interface TrustStatusHistoryEntry {
  id: string;
  previousStatus: string | null;
  newStatus: string;
  previousLevel: string | null;
  newLevel: string | null;
  reason: string;
  changedBy: string | null;
  createdAt: string;
}

interface TrustData {
  profile: TrustProfile | null;
  badges: Array<{ id: string; badgeType: string; enabled: boolean }>;
  history: TrustStatusHistoryEntry[];
}

const TRUST_LEVEL_LABELS: Record<string, string> = {
  T0: "T0 - Unverified",
  T1: "T1 - Verified",
  T2: "T2 - Verified + Reviews",
  T3: "T3 - Active",
  T4: "T4 - Authority",
  T5: "T5 - Recognized",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  eligible: { label: "Eligible", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  qualified: { label: "Qualified", color: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20" },
  active: { label: "Active", color: "bg-green-500/10 text-green-500 border-green-500/20" },
  needs_attention: { label: "Needs Attention", color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  at_risk: { label: "At Risk", color: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
  paused: { label: "Paused", color: "bg-red-500/10 text-red-500 border-red-500/20" },
  removed: { label: "Removed", color: "bg-red-700/10 text-red-700 border-red-700/20" },
};

function isRecommendationEligible(profile: TrustProfile): boolean {
  if (["paused", "removed", "at_risk"].includes(profile.operationalStatus)) return false;
  if (profile.trustLevel === "T0") return false;
  return true;
}

export function TrustSection({ businessId }: { businessId: string }) {
  const { toast } = useToast();
  const [statusAction, setStatusAction] = useState<string>("");
  const [statusReason, setStatusReason] = useState("");
  const [showStatusForm, setShowStatusForm] = useState(false);

  const { data, isLoading, isError } = useQuery<TrustData>({
    queryKey: ["/api/admin/businesses", businessId, "trust"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/businesses/${businessId}/trust`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load trust data");
      return res.json();
    },
  });

  const recomputeMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/admin/businesses/${businessId}/trust/recompute`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses", businessId, "trust"] });
      toast({ title: "Trust profile recomputed" });
    },
    onError: (err: any) => {
      toast({ title: "Recompute failed", description: err.message, variant: "destructive" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ status, reason }: { status: string; reason: string }) => {
      await apiRequest("POST", `/api/admin/businesses/${businessId}/trust/status`, { status, reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses", businessId, "trust"] });
      toast({ title: "Operational status updated" });
      setShowStatusForm(false);
      setStatusAction("");
      setStatusReason("");
    },
    onError: (err: any) => {
      toast({ title: "Status update failed", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="border-t pt-3 space-y-2">
        <h4 className="text-sm font-semibold flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5" /> Trust Profile
        </h4>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading trust data...
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="border-t pt-3 space-y-2">
        <h4 className="text-sm font-semibold flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5" /> Trust Profile
        </h4>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <AlertTriangle className="h-3 w-3 text-amber-500" /> Could not load trust data
        </div>
      </div>
    );
  }

  const profile = data?.profile;
  const badges = data?.badges || [];
  const history = data?.history || [];
  const snapshot = profile?.signalSnapshot;

  const trustLevelLabel = TRUST_LEVEL_LABELS[profile?.trustLevel || "T0"] || profile?.trustLevel;
  const statusInfo = STATUS_LABELS[profile?.operationalStatus || "eligible"] || STATUS_LABELS.eligible;
  const eligible = profile ? isRecommendationEligible(profile) : false;

  return (
    <div className="border-t pt-3 space-y-3" data-testid="section-trust-profile">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5" /> Trust Profile
        </h4>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-[11px] px-2 gap-1"
          onClick={() => recomputeMutation.mutate()}
          disabled={recomputeMutation.isPending}
          data-testid="button-recompute-trust"
        >
          {recomputeMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Recompute
        </Button>
      </div>

      {profile && (
        <Card className="p-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-[10px]" data-testid="badge-trust-level">
              {trustLevelLabel}
            </Badge>
            <Badge variant="outline" className={`text-[10px] ${statusInfo.color}`} data-testid="badge-operational-status">
              {statusInfo.label}
            </Badge>
            {eligible ? (
              <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-500 border-green-500/20" data-testid="badge-recommendation-eligible">
                <CheckCircle className="h-2.5 w-2.5 mr-0.5" /> Recommendation Eligible
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-500 border-red-500/20" data-testid="badge-recommendation-ineligible">
                <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> Not Eligible
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Star className="h-3 w-3" />
              <span data-testid="text-review-summary">
                {snapshot && snapshot.reviewCount > 0
                  ? `${snapshot.averageRating.toFixed(1)} avg (${snapshot.reviewCount} reviews)`
                  : "No reviews yet"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <MessageSquare className="h-3 w-3" />
              <span data-testid="text-activity-badges">{snapshot?.badgeCount || 0} badges</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span data-testid="text-activity-status">
                {snapshot?.daysSinceLastActivity != null
                  ? `${snapshot.daysSinceLastActivity} days since activity`
                  : "No activity recorded"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <FileText className="h-3 w-3" />
              <span data-testid="text-story-status">
                Story depth: {snapshot?.storyDepthScore || 0}%
              </span>
            </div>
          </div>

          {profile.lastComputedAt && (
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              Last computed: {new Date(profile.lastComputedAt).toLocaleString()}
            </p>
          )}
        </Card>
      )}

      {badges.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground">Active Badges</p>
          <div className="flex flex-wrap gap-1">
            {badges.map((b) => (
              <Badge key={b.id} variant="secondary" className="text-[10px]" data-testid={`badge-trust-${b.badgeType}`}>
                {b.badgeType.replace(/_/g, " ")}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-[11px] font-medium text-muted-foreground">Admin Actions</p>
        <div className="flex flex-wrap gap-1.5">
          {["paused", "removed", "eligible"].map((action) => (
            <Button
              key={action}
              size="sm"
              variant={profile?.operationalStatus === action ? "default" : "outline"}
              className="h-7 text-[11px] px-2"
              onClick={() => {
                setStatusAction(action);
                setShowStatusForm(true);
              }}
              disabled={profile?.operationalStatus === action}
              data-testid={`button-trust-action-${action}`}
            >
              {action === "paused" && "Pause"}
              {action === "removed" && "Remove"}
              {action === "eligible" && "Restore"}
            </Button>
          ))}
        </div>

        {showStatusForm && (
          <div className="space-y-2 bg-muted/50 rounded-md p-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium">
                Change to: <Badge variant="outline" className="text-[10px] ml-1">{statusAction}</Badge>
              </span>
            </div>
            <Textarea
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              placeholder="Reason for status change (required)..."
              className="text-xs min-h-[60px]"
              data-testid="input-trust-reason"
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="h-7 text-[11px]"
                onClick={() => statusMutation.mutate({ status: statusAction, reason: statusReason })}
                disabled={!statusReason.trim() || statusMutation.isPending}
                data-testid="button-trust-confirm-status"
              >
                {statusMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                Confirm
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px]"
                onClick={() => { setShowStatusForm(false); setStatusAction(""); setStatusReason(""); }}
                data-testid="button-trust-cancel-status"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground">Status History</p>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {history.map((h) => (
              <div key={h.id} className="text-[10px] text-muted-foreground flex items-start gap-1.5 bg-muted/30 rounded px-2 py-1" data-testid={`trust-history-${h.id}`}>
                <Clock className="h-2.5 w-2.5 mt-0.5 shrink-0" />
                <div>
                  <span className="font-medium">
                    {h.previousStatus && `${h.previousStatus} → `}{h.newStatus}
                  </span>
                  {h.reason && <span className="ml-1">— {h.reason}</span>}
                  <span className="block text-muted-foreground/60">
                    {new Date(h.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
