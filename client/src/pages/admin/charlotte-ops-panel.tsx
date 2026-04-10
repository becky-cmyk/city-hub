import { useState, useMemo, type ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Zap, Eye, Clock, RefreshCw, TrendingUp,
  CheckCircle, XCircle, Play, ExternalLink,
  AlertTriangle, Target, Inbox, Activity,
  Filter, Star, Send,
} from "lucide-react";

interface OpsQueueItem {
  id: string;
  type: string;
  title: string;
  summary: string;
  priority: "high" | "medium" | "low";
  source: string;
  entityId?: string | null;
  entityName?: string | null;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

interface OpsOverview {
  actionQueue: OpsQueueItem[];
  reviewQueue: OpsQueueItem[];
  followUps: OpsQueueItem[];
  opportunities: OpsQueueItem[];
  recentActivity: OpsQueueItem[];
  generatedAt: string;
}

interface ActionResult {
  success: boolean;
  message: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25",
  medium: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25",
  low: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/25",
};

const SOURCE_LABELS: Record<string, string> = {
  proposal_engine: "Proposals",
  workflow_engine: "Workflows",
  admin_inbox: "Inbox",
  orchestrator: "Orchestrator",
  lifecycle_hooks: "Lifecycle",
  entity_scoring: "Scoring",
  crown_readiness: "Crown",
  upsell_signal: "Upsell",
  batch_processor: "Batch",
};

const TYPE_ICONS: Record<string, typeof Activity> = {
  proposal: Zap,
  workflow_step: Play,
  inbox_item: Inbox,
  low_confidence_decision: AlertTriangle,
  incomplete_flow: Clock,
  pending_story_approval: Eye,
  paused_workflow: Clock,
  overdue_inbox: AlertTriangle,
  high_score_entity: TrendingUp,
  crown_candidate: Star,
  tv_venue_candidate: Target,
  orchestrator_decision: Activity,
  batch_session: RefreshCw,
  proposal_execution: CheckCircle,
  onboarding_completion: Star,
};

const ITEM_TYPE_NAV: Record<string, string> = {
  proposal: "charlotte-proposals",
  workflow_step: "workflows",
  inbox_item: "inbox",
  low_confidence_decision: "inbox",
  incomplete_flow: "workflows",
  pending_story_approval: "workflows",
  paused_workflow: "workflows",
  overdue_inbox: "inbox",
  high_score_entity: "businesses",
  crown_candidate: "businesses",
  tv_venue_candidate: "businesses",
  orchestrator_decision: "charlotte-ops",
  batch_session: "charlotte-ops",
  proposal_execution: "charlotte-proposals",
  onboarding_completion: "businesses",
};

interface ItemCapabilities {
  canApprove: boolean;
  canReject: boolean;
  canRunNow: boolean;
  canSendToInbox: boolean;
}

const APPROVE_PREFIXES = new Set(["proposal", "inbox", "overdue-inbox", "decision", "workflow"]);
const REJECT_PREFIXES = new Set(["proposal", "inbox", "overdue-inbox", "decision", "flow", "story-approval", "paused-workflow", "opportunity", "crown-candidate", "tv-venue"]);
const RUN_PREFIXES = new Set(["proposal", "workflow", "paused-workflow", "flow", "story-approval", "inbox", "overdue-inbox"]);

function getCapabilities(item: OpsQueueItem): ItemCapabilities {
  const prefix = item.id.split(":")[0];
  return {
    canApprove: APPROVE_PREFIXES.has(prefix),
    canReject: REJECT_PREFIXES.has(prefix),
    canRunNow: RUN_PREFIXES.has(prefix),
    canSendToInbox: true,
  };
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

async function postAction(endpoint: string, body: Record<string, unknown>): Promise<ActionResult> {
  const res = await apiRequest("POST", endpoint, body);
  const json = await res.json();
  return json as ActionResult;
}

function MetadataDetails({ item }: { item: OpsQueueItem }) {
  const meta = item.metadata || {};
  const details: string[] = [];

  if (meta.confidence !== undefined && meta.confidence !== null) {
    details.push(`Confidence: ${(Number(meta.confidence) * 100).toFixed(0)}%`);
  }
  if (meta.prospectFit !== undefined) {
    details.push(`Prospect fit: ${meta.prospectFit}`);
  }
  if (meta.contactReady !== undefined) {
    details.push(`Contact ready: ${meta.contactReady}`);
  }
  if (meta.trustLevel) {
    details.push(`Trust: ${meta.trustLevel}`);
  }
  if (meta.step) {
    details.push(`Step: ${meta.step}`);
  }
  if (meta.stage) {
    details.push(`Stage: ${meta.stage}`);
  }
  if (meta.flowType) {
    details.push(`Flow: ${meta.flowType}`);
  }
  if (meta.status && meta.status !== item.priority) {
    details.push(`Status: ${meta.status}`);
  }
  if (meta.bucket) {
    details.push(`Bucket: ${meta.bucket}`);
  }
  if (meta.mode) {
    details.push(`Mode: ${meta.mode}`);
  }
  if (meta.listingTier) {
    details.push(`Tier: ${meta.listingTier}`);
  }
  if (meta.dueAt) {
    details.push(`Due: ${new Date(meta.dueAt as string).toLocaleDateString()}`);
  }
  if (meta.totalItems !== undefined) {
    details.push(`Items: ${meta.processedItems ?? 0}/${meta.totalItems}`);
  }

  if (details.length === 0) return null;

  return (
    <div className="flex items-center gap-2 mt-1 flex-wrap">
      {details.map((d, i) => (
        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
          {d}
        </span>
      ))}
    </div>
  );
}

export default function CharlotteOpsPanel({ onNavigate }: { onNavigate?: (section: string) => void }) {
  const { toast } = useToast();
  const [priorityFilter, setPriorityFilter] = useState<"all" | "high">("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const { data, isLoading, isError, refetch } = useQuery<OpsOverview>({
    queryKey: ["/api/admin/charlotte/ops-center"],
    refetchInterval: 60_000,
  });

  function handleResult(result: ActionResult) {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/charlotte/ops-center"] });
    if (result.success) {
      toast({ title: result.message || "Action completed" });
    } else {
      toast({ title: result.message || "Action was not successful", variant: "destructive" });
    }
  }

  const approveMutation = useMutation({
    mutationFn: (actionId: string) =>
      postAction("/api/admin/charlotte/ops-center/approve", { actionId }),
    onSuccess: handleResult,
    onError: () => toast({ title: "Approve failed", variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: (actionId: string) =>
      postAction("/api/admin/charlotte/ops-center/reject", { actionId }),
    onSuccess: handleResult,
    onError: () => toast({ title: "Reject failed", variant: "destructive" }),
  });

  const runNowMutation = useMutation({
    mutationFn: (actionId: string) =>
      postAction("/api/admin/charlotte/ops-center/run-now", { actionId }),
    onSuccess: handleResult,
    onError: () => toast({ title: "Run failed", variant: "destructive" }),
  });

  const sendToInboxMutation = useMutation({
    mutationFn: (params: { itemId: string; title?: string }) =>
      postAction("/api/admin/charlotte/ops-center/send-to-inbox", params),
    onSuccess: handleResult,
    onError: () => toast({ title: "Send to inbox failed", variant: "destructive" }),
  });

  const anyPending = approveMutation.isPending || rejectMutation.isPending || runNowMutation.isPending || sendToInboxMutation.isPending;

  const allSources = useMemo(() => {
    if (!data) return [];
    const sources = new Set<string>();
    [data.actionQueue, data.reviewQueue, data.followUps, data.opportunities].forEach(q =>
      q.forEach(i => sources.add(i.source))
    );
    return Array.from(sources);
  }, [data]);

  const applyFilters = (items: OpsQueueItem[]): OpsQueueItem[] => {
    let result = items;
    if (priorityFilter === "high") result = result.filter(i => i.priority === "high");
    if (sourceFilter !== "all") result = result.filter(i => i.source === sourceFilter);
    return result;
  };

  const filteredActions = useMemo(() => applyFilters(data?.actionQueue ?? []), [data, priorityFilter, sourceFilter]);
  const filteredReview = useMemo(() => applyFilters(data?.reviewQueue ?? []), [data, priorityFilter, sourceFilter]);
  const filteredFollowUps = useMemo(() => applyFilters(data?.followUps ?? []), [data, priorityFilter, sourceFilter]);
  const filteredOpportunities = useMemo(() => applyFilters(data?.opportunities ?? []), [data, priorityFilter, sourceFilter]);

  const handleNavigate = (item: OpsQueueItem) => {
    const section = ITEM_TYPE_NAV[item.type] || "businesses";
    onNavigate?.(section);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-1" data-testid="charlotte-ops-loading">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-8 text-center" data-testid="charlotte-ops-error">
        <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-red-400 opacity-60" />
        <p className="text-sm text-muted-foreground mb-3">Failed to load ops data.</p>
        <Button size="sm" variant="outline" onClick={() => refetch()} data-testid="button-retry-ops">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-muted-foreground" data-testid="charlotte-ops-empty">
        <Zap className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">No ops data available. Run a Charlotte scan to populate queues.</p>
      </div>
    );
  }

  const summary = {
    actionReady: data.actionQueue.length,
    reviewNeeded: data.reviewQueue.length,
    followUps: data.followUps.length,
    opportunities: data.opportunities.length,
  };

  return (
    <div className="space-y-6 p-1" data-testid="charlotte-ops-panel">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold" data-testid="text-ops-title">Charlotte Ops Center</h2>
          <p className="text-xs text-muted-foreground">Daily operations workspace</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()} data-testid="button-refresh-ops">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="ops-summary-strip">
        {[
          { label: "Action Ready", value: summary.actionReady, icon: Zap, color: "text-amber-500" },
          { label: "Review Needed", value: summary.reviewNeeded, icon: Eye, color: "text-blue-500" },
          { label: "Follow-Ups", value: summary.followUps, icon: Clock, color: "text-purple-500" },
          { label: "Opportunities", value: summary.opportunities, icon: Target, color: "text-emerald-500" },
        ].map((stat) => (
          <Card key={stat.label} data-testid={`stat-${stat.label.toLowerCase().replace(/\s/g, "-")}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold" data-testid={`text-count-${stat.label.toLowerCase().replace(/\s/g, "-")}`}>
                {stat.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap" data-testid="ops-filters">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Button
          size="sm"
          variant={priorityFilter === "all" ? "default" : "outline"}
          onClick={() => setPriorityFilter("all")}
          className="h-7 text-xs"
          data-testid="filter-all"
        >
          All
        </Button>
        <Button
          size="sm"
          variant={priorityFilter === "high" ? "default" : "outline"}
          onClick={() => setPriorityFilter("high")}
          className="h-7 text-xs"
          data-testid="filter-high-priority"
        >
          <Star className="w-3 h-3 mr-1" /> High Priority
        </Button>
        {allSources.length > 0 && (
          <>
            <span className="text-muted-foreground text-xs">|</span>
            <Button
              size="sm"
              variant={sourceFilter === "all" ? "secondary" : "ghost"}
              onClick={() => setSourceFilter("all")}
              className="h-7 text-xs"
              data-testid="filter-source-all"
            >
              All Sources
            </Button>
            {allSources.map((src) => (
              <Button
                key={src}
                size="sm"
                variant={sourceFilter === src ? "secondary" : "ghost"}
                onClick={() => setSourceFilter(src)}
                className="h-7 text-xs"
                data-testid={`filter-source-${src}`}
              >
                {SOURCE_LABELS[src] || src}
              </Button>
            ))}
          </>
        )}
      </div>

      {/* ACTION QUEUE */}
      <QueueSection
        title="Action Queue"
        icon={<Zap className="w-4 h-4 text-amber-500" />}
        items={filteredActions}
        emptyMessage="No action items right now."
        emptyIcon={<Zap className="w-6 h-6 mx-auto mb-2 opacity-30" />}
        testIdPrefix="action"
        renderActions={(item) => {
          const caps = getCapabilities(item);
          return (
            <>
              {caps.canRunNow && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                  onClick={() => runNowMutation.mutate(item.id)}
                  disabled={anyPending}
                  data-testid={`button-run-${item.id}`}
                >
                  <Play className="w-3 h-3 mr-1" /> Run Now
                </Button>
              )}
              {caps.canApprove && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
                  onClick={() => approveMutation.mutate(item.id)}
                  disabled={anyPending}
                  data-testid={`button-approve-action-${item.id}`}
                >
                  <CheckCircle className="w-3 h-3 mr-1" /> Approve
                </Button>
              )}
              {caps.canReject && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-500/10"
                  onClick={() => rejectMutation.mutate(item.id)}
                  disabled={anyPending}
                  data-testid={`button-reject-action-${item.id}`}
                >
                  <XCircle className="w-3 h-3 mr-1" /> Reject
                </Button>
              )}
              {caps.canSendToInbox && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs hover:bg-muted"
                  onClick={() => sendToInboxMutation.mutate({ itemId: item.id, title: item.title })}
                  disabled={anyPending}
                  data-testid={`button-inbox-action-${item.id}`}
                >
                  <Inbox className="w-3 h-3 mr-1" /> Send to Inbox
                </Button>
              )}
              {(item.entityId || item.entityName) && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs hover:bg-muted"
                  onClick={() => handleNavigate(item)}
                  data-testid={`button-open-action-${item.id}`}
                >
                  <ExternalLink className="w-3 h-3 mr-1" /> Open Record
                </Button>
              )}
            </>
          );
        }}
      />

      {/* REVIEW QUEUE */}
      <QueueSection
        title="Review Queue"
        icon={<Eye className="w-4 h-4 text-blue-500" />}
        items={filteredReview}
        emptyMessage="No items need review."
        emptyIcon={<Eye className="w-6 h-6 mx-auto mb-2 opacity-30" />}
        testIdPrefix="review"
        renderActions={(item) => {
          const caps = getCapabilities(item);
          return (
            <>
              {caps.canApprove && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                  onClick={() => approveMutation.mutate(item.id)}
                  disabled={anyPending}
                  data-testid={`button-approve-review-${item.id}`}
                >
                  <CheckCircle className="w-3 h-3 mr-1" /> Approve
                </Button>
              )}
              {caps.canReject && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-500/10"
                  onClick={() => rejectMutation.mutate(item.id)}
                  disabled={anyPending}
                  data-testid={`button-reject-review-${item.id}`}
                >
                  <XCircle className="w-3 h-3 mr-1" /> Reject
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs hover:bg-muted"
                onClick={() => sendToInboxMutation.mutate({ itemId: item.id, title: item.title })}
                disabled={anyPending}
                data-testid={`button-inbox-review-${item.id}`}
              >
                <Inbox className="w-3 h-3 mr-1" /> Send to Inbox
              </Button>
              {(item.entityId || item.entityName) && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs hover:bg-muted"
                  onClick={() => handleNavigate(item)}
                  data-testid={`button-open-review-${item.id}`}
                >
                  <ExternalLink className="w-3 h-3 mr-1" /> Open Record
                </Button>
              )}
            </>
          );
        }}
      />

      {/* FOLLOW-UPS */}
      <QueueSection
        title="Follow-Ups"
        icon={<Clock className="w-4 h-4 text-purple-500" />}
        items={filteredFollowUps}
        emptyMessage="No follow-ups pending."
        emptyIcon={<Clock className="w-6 h-6 mx-auto mb-2 opacity-30" />}
        testIdPrefix="followup"
        renderActions={(item) => {
          const caps = getCapabilities(item);
          return (
            <>
              {caps.canRunNow && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                  onClick={() => runNowMutation.mutate(item.id)}
                  disabled={anyPending}
                  data-testid={`button-run-followup-${item.id}`}
                >
                  <Play className="w-3 h-3 mr-1" /> Run Follow-Up
                </Button>
              )}
              {caps.canReject && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-500/10"
                  onClick={() => rejectMutation.mutate(item.id)}
                  disabled={anyPending}
                  data-testid={`button-dismiss-followup-${item.id}`}
                >
                  <XCircle className="w-3 h-3 mr-1" /> Dismiss
                </Button>
              )}
              {(item.entityId || item.entityName) && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs hover:bg-muted"
                  onClick={() => handleNavigate(item)}
                  data-testid={`button-open-followup-${item.id}`}
                >
                  <ExternalLink className="w-3 h-3 mr-1" /> Open Record
                </Button>
              )}
            </>
          );
        }}
      />

      {/* OPPORTUNITIES */}
      <QueueSection
        title="Opportunities"
        icon={<Target className="w-4 h-4 text-emerald-500" />}
        items={filteredOpportunities}
        emptyMessage="No opportunities surfaced."
        emptyIcon={<Target className="w-6 h-6 mx-auto mb-2 opacity-30" />}
        testIdPrefix="opportunity"
        renderActions={(item) => {
          const caps = getCapabilities(item);
          return (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                onClick={() => sendToInboxMutation.mutate({ itemId: item.id, title: `Create proposal: ${item.title}` })}
                disabled={anyPending}
                data-testid={`button-create-proposal-${item.id}`}
              >
                <Send className="w-3 h-3 mr-1" /> Send Proposal Request
              </Button>
              {caps.canReject && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-500/10"
                  onClick={() => rejectMutation.mutate(item.id)}
                  disabled={anyPending}
                  data-testid={`button-dismiss-opportunity-${item.id}`}
                >
                  <XCircle className="w-3 h-3 mr-1" /> Dismiss
                </Button>
              )}
              {(item.entityId || item.entityName) && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs hover:bg-muted"
                  onClick={() => handleNavigate(item)}
                  data-testid={`button-open-opportunity-${item.id}`}
                >
                  <ExternalLink className="w-3 h-3 mr-1" /> Open Record
                </Button>
              )}
            </>
          );
        }}
      />

      {/* RECENT ACTIVITY */}
      <div data-testid="section-recent-activity">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-semibold">Recent Activity</h3>
          <Badge variant="outline" className="text-xs" data-testid="badge-activity-count">{data.recentActivity.length}</Badge>
        </div>
        {data.recentActivity.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground text-sm" data-testid="empty-recent-activity">
              <Activity className="w-6 h-6 mx-auto mb-2 opacity-30" />
              No recent activity recorded.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-1.5">
            {data.recentActivity.map((item) => {
              const Icon = TYPE_ICONS[item.type] || Activity;
              return (
                <div key={item.id} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/50 text-sm" data-testid={`activity-item-${item.id}`}>
                  <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate">{item.title}</span>
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${PRIORITY_COLORS[item.priority] || ""}`}>
                    {item.priority}
                  </Badge>
                  <span className="text-xs text-muted-foreground shrink-0 max-w-[200px] truncate">{item.summary}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(item.createdAt)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function QueueSection({
  title,
  icon,
  items,
  emptyMessage,
  emptyIcon,
  testIdPrefix,
  renderActions,
}: {
  title: string;
  icon: ReactNode;
  items: OpsQueueItem[];
  emptyMessage: string;
  emptyIcon: ReactNode;
  testIdPrefix: string;
  renderActions: (item: OpsQueueItem) => ReactNode;
}) {
  return (
    <div data-testid={`section-${testIdPrefix}-queue`}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-sm font-semibold">{title}</h3>
        <Badge variant="outline" className="text-xs" data-testid={`badge-${testIdPrefix}-count`}>{items.length}</Badge>
      </div>
      {items.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground text-sm" data-testid={`empty-${testIdPrefix}-queue`}>
            {emptyIcon}
            {emptyMessage}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const Icon = TYPE_ICONS[item.type] || Activity;
            return (
              <Card key={item.id} data-testid={`${testIdPrefix}-item-${item.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium text-sm">{item.title}</span>
                        <Badge variant="outline" className={`text-[10px] ${PRIORITY_COLORS[item.priority] || PRIORITY_COLORS.low}`}>
                          {item.priority}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {SOURCE_LABELS[item.source] || item.source}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">{item.summary}</p>
                      <MetadataDetails item={item} />
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1">
                        {item.entityName && <span className="font-medium">{item.entityName}</span>}
                        <span>{timeAgo(item.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0 flex-wrap">
                      {renderActions(item)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
