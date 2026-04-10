import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Radio, Send, FileText, TrendingUp, Building2, Users, AlertTriangle, Eye, Check, X, Play, RefreshCw, Mail } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const SIGNAL_TYPE_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  UNCLAIMED_HIGH_DEMAND: { label: "Unclaimed High-Demand", color: "bg-red-500/10 text-red-400 border-red-500/20", icon: Building2 },
  UPGRADE_READY: { label: "Upgrade Ready", color: "bg-green-500/10 text-green-400 border-green-500/20", icon: TrendingUp },
  CONTRIBUTOR_CANDIDATE: { label: "Contributor Candidate", color: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: Users },
  NEIGHBORHOOD_EXPERT: { label: "Neighborhood Expert", color: "bg-purple-500/10 text-purple-400 border-purple-500/20", icon: Users },
  TRENDING_TOPIC: { label: "Trending Topic", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", icon: TrendingUp },
  CONTENT_GAP: { label: "Content Gap", color: "bg-orange-500/10 text-orange-400 border-orange-500/20", icon: AlertTriangle },
  DORMANT_CLAIMED: { label: "Dormant Claimed", color: "bg-gray-500/10 text-gray-400 border-gray-500/20", icon: AlertTriangle },
};

export function PulseIntelligencePanel({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [signalFilter, setSignalFilter] = useState<string>("new");

  const { data: signals, isLoading: signalsLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/charlotte/signals", cityId, signalFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      params.set("status", signalFilter);
      params.set("limit", "50");
      const res = await fetch(`/api/admin/charlotte/signals?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load signals");
      return res.json();
    },
  });

  const { data: signalSummary } = useQuery<any[]>({
    queryKey: ["/api/admin/charlotte/signals/summary", cityId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      const res = await fetch(`/api/admin/charlotte/signals/summary?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load signal summary");
      return res.json();
    },
  });

  const runScanMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/charlotte/run-all"),
    onSuccess: () => {
      toast({ title: "Charlotte scan complete", description: "Signals, content, and outreach updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/charlotte"] });
    },
    onError: () => toast({ title: "Scan failed", variant: "destructive" }),
  });

  const updateSignalMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/admin/charlotte/signals/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/charlotte/signals"] });
    },
  });

  const totalNew = signalSummary?.reduce((acc: number, s: any) => acc + Number(s.count), 0) || 0;

  return (
    <div className="space-y-4" data-testid="pulse-intelligence-panel">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold" data-testid="panel-title">Pulse Intelligence</h2>
          <p className="text-sm text-muted-foreground">Charlotte scans platform activity and surfaces opportunities.</p>
        </div>
        <Button
          onClick={() => runScanMutation.mutate()}
          disabled={runScanMutation.isPending}
          size="sm"
          data-testid="run-charlotte-scan"
        >
          {runScanMutation.isPending ? <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> : <Play className="w-4 h-4 mr-1.5" />}
          {runScanMutation.isPending ? "Running..." : "Run Charlotte Scan"}
        </Button>
      </div>

      {signalSummary && signalSummary.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {signalSummary.map((s: any) => {
            const config = SIGNAL_TYPE_CONFIG[s.signal_type];
            return (
              <Card key={s.signal_type} className="bg-card" data-testid={`signal-summary-${s.signal_type}`}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    {config && <config.icon className="w-4 h-4 text-muted-foreground" />}
                    <span className="text-xs text-muted-foreground">{config?.label || s.signal_type}</span>
                  </div>
                  <p className="text-xl font-bold mt-1">{s.count}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="flex gap-2">
        {["new", "reviewed", "actioned", "dismissed"].map((status) => (
          <Button
            key={status}
            variant={signalFilter === status ? "default" : "outline"}
            size="sm"
            onClick={() => setSignalFilter(status)}
            data-testid={`filter-${status}`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Button>
        ))}
      </div>

      {signalsLoading && <p className="text-sm text-muted-foreground">Loading signals...</p>}

      <div className="space-y-2">
        {(signals || []).map((signal: any) => {
          const config = SIGNAL_TYPE_CONFIG[signal.signalType] || SIGNAL_TYPE_CONFIG.UNCLAIMED_HIGH_DEMAND;
          const SignalIcon = config.icon;
          return (
            <Card key={signal.id} className="bg-card" data-testid={`signal-${signal.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={config.color}>
                        <SignalIcon className="w-3 h-3 mr-1" />
                        {config.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Score: {signal.score}
                      </span>
                    </div>
                    <p className="text-sm font-medium" data-testid={`signal-title-${signal.id}`}>{signal.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{signal.summary}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(signal.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  {signal.status === "new" && (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateSignalMutation.mutate({ id: signal.id, status: "actioned" })}
                        data-testid={`action-signal-${signal.id}`}
                      >
                        <Check className="w-3 h-3 mr-1" />
                        Action
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => updateSignalMutation.mutate({ id: signal.id, status: "dismissed" })}
                        data-testid={`dismiss-signal-${signal.id}`}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!signalsLoading && (signals || []).length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8" data-testid="no-signals">
            No {signalFilter} signals. Run a Charlotte scan to discover opportunities.
          </p>
        )}
      </div>
    </div>
  );
}

export function OutreachQueuePanel({ cityId }: { cityId?: string }) {
  const { toast } = useToast();

  const { data: drafts, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/charlotte/outreach", cityId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      params.set("status", "draft");
      params.set("limit", "50");
      const res = await fetch(`/api/admin/charlotte/outreach?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load outreach drafts");
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/admin/charlotte/outreach/${id}`, { status }),
    onSuccess: (_, { status }) => {
      toast({ title: status === "approved" ? "Outreach approved" : "Outreach updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/charlotte/outreach"] });
    },
  });

  const TEMPLATE_LABELS: Record<string, string> = {
    claim_invite: "Claim Invite",
    upgrade_pitch: "Upgrade Pitch",
    reengagement: "Re-engagement",
    review_request: "Review Request",
    welcome: "Welcome",
    capture_met_in_person: "Met in Person",
    capture_stopped_by: "Stopped By",
    capture_found_card: "Found Card",
    seeded_unclaimed: "Seeded Unclaimed",
  };

  return (
    <div className="space-y-4" data-testid="outreach-queue-panel">
      <div>
        <h2 className="text-lg font-semibold" data-testid="outreach-title">Outreach Queue</h2>
        <p className="text-sm text-muted-foreground">Charlotte-drafted emails ready for review and approval.</p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading drafts...</p>}

      <div className="space-y-3">
        {(drafts || []).map((draft: any) => (
          <Card key={draft.id} className="bg-card" data-testid={`outreach-${draft.id}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline">
                      <Mail className="w-3 h-3 mr-1" />
                      {TEMPLATE_LABELS[draft.templateType] || draft.templateType}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium" data-testid={`outreach-subject-${draft.id}`}>{draft.subject}</p>
                  <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line line-clamp-3">{draft.body}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(draft.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button
                    size="sm"
                    onClick={() => updateMutation.mutate({ id: draft.id, status: "approved" })}
                    data-testid={`approve-outreach-${draft.id}`}
                  >
                    <Check className="w-3 h-3 mr-1" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => updateMutation.mutate({ id: draft.id, status: "failed" })}
                    data-testid={`reject-outreach-${draft.id}`}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {!isLoading && (drafts || []).length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8" data-testid="no-outreach">
            No pending outreach drafts. Run a Charlotte scan to generate outreach.
          </p>
        )}
      </div>
    </div>
  );
}

export function ContentDraftsPanel({ cityId }: { cityId?: string }) {
  const { toast } = useToast();

  const { data: drafts, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/charlotte/content", cityId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      params.set("status", "draft");
      params.set("limit", "50");
      const res = await fetch(`/api/admin/charlotte/content?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load content drafts");
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/admin/charlotte/content/${id}`, { status }),
    onSuccess: (_, { status }) => {
      toast({ title: status === "approved" ? "Content approved for publish" : "Content updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/charlotte/content"] });
    },
  });

  const TYPE_LABELS: Record<string, string> = {
    spotlight_roundup: "Spotlight Roundup",
    trending_post: "Trending Post",
    new_in_zone: "New in Zone",
    weekend_picks: "Weekend Picks",
    digest: "Digest",
  };

  return (
    <div className="space-y-4" data-testid="content-drafts-panel">
      <div>
        <h2 className="text-lg font-semibold" data-testid="content-title">Content Drafts</h2>
        <p className="text-sm text-muted-foreground">Charlotte-generated articles and posts ready for review.</p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading drafts...</p>}

      <div className="space-y-3">
        {(drafts || []).map((draft: any) => (
          <Card key={draft.id} className="bg-card" data-testid={`content-draft-${draft.id}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline">
                      <FileText className="w-3 h-3 mr-1" />
                      {TYPE_LABELS[draft.contentType] || draft.contentType}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium" data-testid={`content-title-${draft.id}`}>{draft.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line line-clamp-4">{draft.body}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(draft.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button
                    size="sm"
                    onClick={() => updateMutation.mutate({ id: draft.id, status: "approved" })}
                    data-testid={`approve-content-${draft.id}`}
                  >
                    <Check className="w-3 h-3 mr-1" />
                    Publish
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => updateMutation.mutate({ id: draft.id, status: "rejected" })}
                    data-testid={`reject-content-${draft.id}`}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {!isLoading && (drafts || []).length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8" data-testid="no-content-drafts">
            No pending content drafts. Run a Charlotte scan to generate content.
          </p>
        )}
      </div>
    </div>
  );
}
