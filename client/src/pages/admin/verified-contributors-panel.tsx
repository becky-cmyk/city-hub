import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ShieldCheck, Users, DollarSign, Search, ShieldOff, ShieldPlus, Loader2, Clock, CheckCircle } from "lucide-react";
import { useState } from "react";

const TIER_COLORS: Record<string, string> = {
  standard: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  supporter: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  builder: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
  champion: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
};

interface Contributor {
  id: string;
  email: string;
  displayName: string;
  handle: string | null;
  isVerifiedContributor: boolean;
  contributorStatus: string;
  verificationTier: string | null;
  verificationAmountCents: number | null;
  verificationCompletedAt: string | null;
  moderationTrustScore: number;
  createdAt: string;
  submissionStats: {
    totalSubmissions: number;
    approvedSubmissions: number;
    rejectedSubmissions: number;
    pendingSubmissions: number;
  } | null;
}

interface FundSummary {
  totalRaisedCents: number;
  totalContributors: number;
  byTier: Record<string, { count: number; totalCents: number }>;
}

interface LedgerEntry {
  id: string;
  userId: string;
  sourceType: string;
  contributionTier: string | null;
  grossAmountCents: number;
  processingFeeCents: number | null;
  netAmountCents: number | null;
  paymentStatus: string;
  paymentId: string | null;
  recordedAt: string;
  notes: string | null;
}

const STATUS_STYLES: Record<string, { className: string; icon: typeof CheckCircle }> = {
  completed: { className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: CheckCircle },
  pending: { className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", icon: Clock },
};

export default function VerifiedContributorsPanel({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [grantDialog, setGrantDialog] = useState<{ open: boolean; userId?: string; displayName?: string }>({ open: false });
  const [grantTier, setGrantTier] = useState("standard");

  const { data: contributors, isLoading } = useQuery<Contributor[]>({
    queryKey: ["/api/admin/verified-contributors"],
  });

  const { data: fundSummary } = useQuery<FundSummary>({
    queryKey: ["/api/admin/community-fund/summary"],
  });

  const { data: ledgerEntries } = useQuery<LedgerEntry[]>({
    queryKey: ["/api/admin/community-fund/ledger"],
  });

  const grantMutation = useMutation({
    mutationFn: async ({ userId, tier }: { userId: string; tier: string }) => {
      await apiRequest("PATCH", `/api/admin/verified-contributors/${userId}`, { action: "grant", tier });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/verified-contributors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/community-fund/summary"] });
      setGrantDialog({ open: false });
      toast({ title: "Verification granted" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("PATCH", `/api/admin/verified-contributors/${userId}`, { action: "revoke" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/verified-contributors"] });
      toast({ title: "Verification revoked" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const filtered = (contributors || []).filter((c) => {
    if (search && !c.displayName.toLowerCase().includes(search.toLowerCase()) && !c.email.toLowerCase().includes(search.toLowerCase())) return false;
    if (tierFilter !== "all" && c.verificationTier !== tierFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6" data-testid="verified-contributors-panel">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2" data-testid="text-verified-panel-title">
          <ShieldCheck className="h-5 w-5" />
          Verified Contributors
        </h2>
        <p className="text-sm text-muted-foreground">Manage verified contributors and the community fund</p>
      </div>

      <Tabs defaultValue="contributors">
        <TabsList data-testid="tabs-verified-contributors">
          <TabsTrigger value="contributors">Contributors</TabsTrigger>
          <TabsTrigger value="fund">Community Fund</TabsTrigger>
        </TabsList>

        <TabsContent value="contributors" className="space-y-4 mt-4">
          <div className="flex gap-3 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email..."
                className="pl-9"
                data-testid="input-search-contributors"
              />
            </div>
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger className="w-40" data-testid="select-filter-tier">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="supporter">Supporter</SelectItem>
                <SelectItem value="builder">Builder</SelectItem>
                <SelectItem value="champion">Champion</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={() => setGrantDialog({ open: true })}
              data-testid="button-grant-verification"
            >
              <ShieldPlus className="h-4 w-4 mr-1" />
              Grant
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <Card className="p-8 text-center">
              <ShieldCheck className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No verified contributors yet</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {filtered.map((c) => (
                <Card key={c.id} className="p-4" data-testid={`contributor-row-${c.id}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{c.displayName}</span>
                        {c.verificationTier && (
                          <Badge className={TIER_COLORS[c.verificationTier] || ""} variant="secondary">
                            {c.verificationTier}
                          </Badge>
                        )}
                        {c.handle && (
                          <span className="text-xs text-muted-foreground">@{c.handle}</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                        <span>{c.email}</span>
                        {c.verificationAmountCents && (
                          <span>${(c.verificationAmountCents / 100).toFixed(2)}</span>
                        )}
                        {c.verificationCompletedAt && (
                          <span>Verified {new Date(c.verificationCompletedAt).toLocaleDateString()}</span>
                        )}
                        <span>Trust: {c.moderationTrustScore}</span>
                      </div>
                      {c.submissionStats && (
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                          <span>{c.submissionStats.totalSubmissions} submissions</span>
                          <span>{c.submissionStats.approvedSubmissions} approved</span>
                          <span>{c.submissionStats.pendingSubmissions} pending</span>
                          {c.submissionStats.rejectedSubmissions > 0 && (
                            <span className="text-red-500">{c.submissionStats.rejectedSubmissions} rejected</span>
                          )}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => revokeMutation.mutate(c.id)}
                      disabled={revokeMutation.isPending}
                      data-testid={`button-revoke-${c.id}`}
                    >
                      <ShieldOff className="h-4 w-4 mr-1" />
                      Revoke
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="fund" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="p-4" data-testid="card-fund-total">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <DollarSign className="h-4 w-4" />
                Total Raised
              </div>
              <p className="text-2xl font-bold">
                ${((fundSummary?.totalRaisedCents || 0) / 100).toFixed(2)}
              </p>
            </Card>
            <Card className="p-4" data-testid="card-fund-contributors">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Users className="h-4 w-4" />
                Contributors
              </div>
              <p className="text-2xl font-bold">{fundSummary?.totalContributors || 0}</p>
            </Card>
            <Card className="p-4" data-testid="card-fund-avg">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <ShieldCheck className="h-4 w-4" />
                Avg Contribution
              </div>
              <p className="text-2xl font-bold">
                ${fundSummary && fundSummary.totalContributors > 0
                  ? ((fundSummary.totalRaisedCents / fundSummary.totalContributors) / 100).toFixed(2)
                  : "0.00"}
              </p>
            </Card>
          </div>

          {fundSummary?.byTier && Object.keys(fundSummary.byTier).length > 0 && (
            <Card className="p-4">
              <h3 className="font-semibold text-sm mb-3">Breakdown by Tier</h3>
              <div className="space-y-2">
                {Object.entries(fundSummary.byTier).map(([tier, data]) => (
                  <div key={tier} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Badge className={TIER_COLORS[tier] || ""} variant="secondary">{tier}</Badge>
                      <span className="text-muted-foreground">{data.count} contributions</span>
                    </div>
                    <span className="font-medium">${(data.totalCents / 100).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {ledgerEntries && ledgerEntries.length > 0 && (
            <Card className="p-4">
              <h3 className="font-semibold text-sm mb-3">Recent Transactions</h3>
              <div className="space-y-2">
                {ledgerEntries.map((entry) => {
                  const statusStyle = STATUS_STYLES[entry.paymentStatus] || STATUS_STYLES.pending;
                  const StatusIcon = statusStyle.icon;
                  return (
                    <div key={entry.id} className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0" data-testid={`ledger-entry-${entry.id}`}>
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Badge className={statusStyle.className} variant="secondary" data-testid={`badge-status-${entry.id}`}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {entry.paymentStatus}
                        </Badge>
                        {entry.contributionTier && (
                          <Badge className={TIER_COLORS[entry.contributionTier] || ""} variant="secondary">
                            {entry.contributionTier}
                          </Badge>
                        )}
                        <span className="text-muted-foreground truncate">
                          {new Date(entry.recordedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-right">
                        <span className="font-medium">${(entry.grossAmountCents / 100).toFixed(2)}</span>
                        {entry.paymentStatus === "completed" && entry.netAmountCents != null && (
                          <span className="text-xs text-muted-foreground">net ${(entry.netAmountCents / 100).toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={grantDialog.open} onOpenChange={(open) => setGrantDialog({ open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant Verification</DialogTitle>
          </DialogHeader>
          {grantDialog.displayName ? (
            <p className="text-sm text-muted-foreground">
              Grant verified status to {grantDialog.displayName}.
            </p>
          ) : (
            <Input
              value={grantDialog.userId || ""}
              onChange={(e) => setGrantDialog({ ...grantDialog, userId: e.target.value })}
              placeholder="Enter user ID..."
              data-testid="input-grant-user-id"
            />
          )}
          <Select value={grantTier} onValueChange={setGrantTier}>
            <SelectTrigger data-testid="select-grant-tier">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">Standard</SelectItem>
              <SelectItem value="supporter">Supporter</SelectItem>
              <SelectItem value="builder">Builder</SelectItem>
              <SelectItem value="champion">Champion</SelectItem>
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setGrantDialog({ open: false })}>Cancel</Button>
            <Button
              onClick={() => grantDialog.userId && grantMutation.mutate({ userId: grantDialog.userId, tier: grantTier })}
              disabled={grantMutation.isPending || !grantDialog.userId}
              data-testid="button-confirm-grant"
            >
              {grantMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Grant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
