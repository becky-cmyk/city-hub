import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  LayoutDashboard, Target, AlertTriangle, ListChecks, Plus,
  CheckCircle, XCircle, Archive, Eye, Clock, RefreshCw,
  TrendingUp, Shield, Zap, ChevronRight, Camera,
} from "lucide-react";

const HAT_COLORS: Record<string, string> = {
  admin: "bg-zinc-700 text-white",
  cmo: "bg-amber-600 text-white",
  cfo: "bg-emerald-700 text-white",
  cto: "bg-blue-700 text-white",
  builder: "bg-violet-700 text-white",
  operator: "bg-cyan-700 text-white",
  editor: "bg-pink-700 text-white",
};

const SEVERITY_COLORS: Record<string, string> = {
  low: "bg-slate-500",
  medium: "bg-amber-500",
  high: "bg-orange-600",
  critical: "bg-red-600",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-slate-500",
  medium: "bg-blue-500",
  high: "bg-amber-500",
  critical: "bg-red-600",
};

const URGENCY_LABELS: Record<string, { label: string; color: string }> = {
  today: { label: "Today", color: "bg-red-600" },
  this_week: { label: "This Week", color: "bg-amber-500" },
  later: { label: "Later", color: "bg-slate-500" },
};

function ReadinessFlag({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div data-testid={`readiness-${label.toLowerCase().replace(/\s/g, "-")}`} className="flex items-center gap-1.5 text-xs">
      {ready ? (
        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
      ) : (
        <XCircle className="w-3.5 h-3.5 text-zinc-500" />
      )}
      <span className={ready ? "text-emerald-300" : "text-zinc-500"}>{label}</span>
    </div>
  );
}

function DashboardTab() {
  const { toast } = useToast();

  const readinessQuery = useQuery<any[]>({ queryKey: ["/api/cora/operator/readiness"] });

  const snapshotMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/cora/operator/snapshots", { scope: "platform" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cora/operator/snapshots"] });
      toast({ title: "Snapshot generated" });
    },
  });

  const snapshotsQuery = useQuery<any[]>({ queryKey: ["/api/cora/operator/snapshots"] });
  const latestSnapshot = snapshotsQuery.data?.[0];
  const summary = latestSnapshot?.summaryJson;

  return (
    <div className="space-y-6" data-testid="operator-dashboard-tab">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Platform Overview</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => snapshotMutation.mutate()}
          disabled={snapshotMutation.isPending}
          data-testid="button-generate-snapshot"
          className="border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10"
        >
          <Camera className="w-3.5 h-3.5 mr-1.5" />
          {snapshotMutation.isPending ? "Generating..." : "Take Snapshot"}
        </Button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Metros", value: summary.totalMetros, icon: LayoutDashboard },
            { label: "Active Metros", value: summary.activeMetros, icon: CheckCircle },
            { label: "Coming Soon", value: summary.comingSoonMetros, icon: Clock },
            { label: "Total Plans", value: summary.totalPlans, icon: ListChecks },
            { label: "Approved Plans", value: summary.approvedPlans, icon: CheckCircle },
            { label: "Outreach Sent", value: `${summary.sentOutreach}/${summary.totalOutreach}`, icon: TrendingUp },
            { label: "Open Blockers", value: summary.openBlockers, icon: AlertTriangle },
            { label: "Pending Actions", value: summary.pendingActions, icon: Zap },
          ].map((stat) => (
            <Card key={stat.label} className="bg-zinc-800/50 border-zinc-700/50" data-testid={`stat-${stat.label.toLowerCase().replace(/\s/g, "-")}`}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <stat.icon className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wide">{stat.label}</span>
                </div>
                <span className="text-xl font-bold text-white">{stat.value}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!summary && !snapshotsQuery.isLoading && (
        <Card className="bg-zinc-800/50 border-zinc-700/50">
          <CardContent className="p-6 text-center text-zinc-400">
            No snapshots yet. Take a snapshot to see platform summary.
          </CardContent>
        </Card>
      )}

      <div>
        <h3 className="text-lg font-semibold text-white mb-3">Metro Readiness</h3>
        {readinessQuery.isLoading && <p className="text-zinc-400 text-sm">Loading readiness data...</p>}
        {readinessQuery.data && readinessQuery.data.length === 0 && (
          <p className="text-zinc-400 text-sm">No metros found.</p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {readinessQuery.data?.map((metro: any) => (
            <Card key={metro.metroId} className="bg-zinc-800/50 border-zinc-700/50" data-testid={`card-metro-readiness-${metro.metroId}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm text-white">{metro.metroName}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{metro.metroStatus}</Badge>
                    <span className="text-xs font-bold text-cyan-400">{metro.readinessPercent}%</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-1">
                  <ReadinessFlag label="Content" ready={metro.contentReady} />
                  <ReadinessFlag label="Pricing" ready={metro.pricingReady} />
                  <ReadinessFlag label="Outreach" ready={metro.outreachReady} />
                  <ReadinessFlag label="Operator" ready={metro.operatorReady} />
                  <ReadinessFlag label="Coming Soon" ready={metro.comingSoonReady} />
                </div>
                {metro.topBlockers?.length > 0 && (
                  <div className="pt-1 border-t border-zinc-700/50">
                    <span className="text-[10px] text-red-400 uppercase tracking-wide">Blockers</span>
                    {metro.topBlockers.map((b: any) => (
                      <div key={b.id} className="flex items-center gap-1.5 text-xs text-zinc-300 mt-0.5">
                        <AlertTriangle className="w-3 h-3 text-red-400" />
                        {b.title}
                      </div>
                    ))}
                  </div>
                )}
                {metro.topOpportunities?.length > 0 && (
                  <div className="pt-1 border-t border-zinc-700/50">
                    <span className="text-[10px] text-emerald-400 uppercase tracking-wide">Opportunities</span>
                    {metro.topOpportunities.map((o: any) => (
                      <div key={o.id} className="flex items-center gap-1.5 text-xs text-zinc-300 mt-0.5">
                        <Target className="w-3 h-3 text-emerald-400" />
                        {o.title}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function OpportunitiesTab() {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [newOpp, setNewOpp] = useState({ title: "", description: "", priority: "medium", estimatedValue: "", scope: "metro" });

  const oppsQuery = useQuery<any[]>({
    queryKey: ["/api/cora/operator/opportunities", filterStatus],
    queryFn: async () => {
      const params = filterStatus !== "all" ? `?status=${filterStatus}` : "";
      const res = await fetch(`/api/cora/operator/opportunities${params}`, { credentials: "include" });
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/cora/operator/opportunities", newOpp),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cora/operator/opportunities"] });
      setShowCreate(false);
      setNewOpp({ title: "", description: "", priority: "medium", estimatedValue: "", scope: "metro" });
      toast({ title: "Opportunity created" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/cora/operator/opportunities/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cora/operator/opportunities"] });
      toast({ title: "Opportunity approved" });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/cora/operator/opportunities/${id}/archive`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cora/operator/opportunities"] });
      toast({ title: "Opportunity archived" });
    },
  });

  return (
    <div className="space-y-4" data-testid="operator-opportunities-tab">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-white">Opportunities</h3>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px] h-8 text-xs bg-zinc-800 border-zinc-700" data-testid="select-opp-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="identified">Identified</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)} data-testid="button-create-opportunity" className="bg-cyan-600 hover:bg-cyan-700">
          <Plus className="w-3.5 h-3.5 mr-1" /> New Opportunity
        </Button>
      </div>

      {oppsQuery.isLoading && <p className="text-zinc-400 text-sm">Loading...</p>}
      <div className="space-y-3">
        {oppsQuery.data?.map((opp: any) => (
          <Card key={opp.id} className="bg-zinc-800/50 border-zinc-700/50" data-testid={`card-opportunity-${opp.id}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-white text-sm">{opp.title}</span>
                    <Badge className={`${PRIORITY_COLORS[opp.priority] || "bg-slate-500"} text-white text-[10px]`}>{opp.priority}</Badge>
                    <Badge variant="outline" className="text-[10px]">{opp.status}</Badge>
                    {opp.hat && <Badge className={`${HAT_COLORS[opp.hat] || "bg-zinc-600 text-white"} text-[10px]`}>{opp.hat}</Badge>}
                  </div>
                  {opp.description && <p className="text-zinc-400 text-xs mt-1">{opp.description}</p>}
                  {opp.estimatedValue && <p className="text-emerald-400 text-xs mt-1">Est. Value: {opp.estimatedValue}</p>}
                  {opp.recommendedNextSteps?.length > 0 && (
                    <div className="mt-2">
                      <span className="text-[10px] text-zinc-500 uppercase">Next Steps</span>
                      <ul className="text-xs text-zinc-300 mt-0.5 space-y-0.5">
                        {(opp.recommendedNextSteps as string[]).map((step: string, i: number) => (
                          <li key={i} className="flex items-center gap-1">
                            <ChevronRight className="w-3 h-3 text-cyan-400" />
                            {step}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {opp.status !== "approved" && opp.status !== "archived" && (
                    <Button size="sm" variant="ghost" onClick={() => approveMutation.mutate(opp.id)} data-testid={`button-approve-opp-${opp.id}`} className="text-emerald-400 hover:bg-emerald-500/10 h-7 px-2 text-xs">
                      <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
                    </Button>
                  )}
                  {opp.status !== "archived" && (
                    <Button size="sm" variant="ghost" onClick={() => archiveMutation.mutate(opp.id)} data-testid={`button-archive-opp-${opp.id}`} className="text-zinc-400 hover:bg-zinc-500/10 h-7 px-2 text-xs">
                      <Archive className="w-3.5 h-3.5 mr-1" /> Archive
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {oppsQuery.data?.length === 0 && <p className="text-zinc-500 text-sm text-center py-8">No opportunities found.</p>}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-zinc-900 border-zinc-700" data-testid="dialog-create-opportunity">
          <DialogHeader>
            <DialogTitle className="text-white">New Opportunity</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Title" value={newOpp.title} onChange={e => setNewOpp({ ...newOpp, title: e.target.value })} className="bg-zinc-800 border-zinc-700" data-testid="input-opp-title" />
            <Textarea placeholder="Description" value={newOpp.description} onChange={e => setNewOpp({ ...newOpp, description: e.target.value })} className="bg-zinc-800 border-zinc-700" data-testid="input-opp-description" />
            <div className="grid grid-cols-2 gap-3">
              <Select value={newOpp.priority} onValueChange={v => setNewOpp({ ...newOpp, priority: v })}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700" data-testid="select-opp-priority">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Estimated value" value={newOpp.estimatedValue} onChange={e => setNewOpp({ ...newOpp, estimatedValue: e.target.value })} className="bg-zinc-800 border-zinc-700" data-testid="input-opp-value" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)} data-testid="button-cancel-opp">Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!newOpp.title || createMutation.isPending} data-testid="button-submit-opp" className="bg-cyan-600 hover:bg-cyan-700">
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BlockersTab() {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState("open");
  const [newBlocker, setNewBlocker] = useState({ title: "", description: "", severity: "medium", scope: "metro" });

  const blockersQuery = useQuery<any[]>({
    queryKey: ["/api/cora/operator/blockers", filterStatus],
    queryFn: async () => {
      const params = filterStatus !== "all" ? `?status=${filterStatus}` : "";
      const res = await fetch(`/api/cora/operator/blockers${params}`, { credentials: "include" });
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/cora/operator/blockers", newBlocker),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cora/operator/blockers"] });
      setShowCreate(false);
      setNewBlocker({ title: "", description: "", severity: "medium", scope: "metro" });
      toast({ title: "Blocker created" });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/cora/operator/blockers/${id}/resolve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cora/operator/blockers"] });
      toast({ title: "Blocker resolved" });
    },
  });

  const ignoreMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/cora/operator/blockers/${id}/ignore`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cora/operator/blockers"] });
      toast({ title: "Blocker ignored" });
    },
  });

  return (
    <div className="space-y-4" data-testid="operator-blockers-tab">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-white">Blockers</h3>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[120px] h-8 text-xs bg-zinc-800 border-zinc-700" data-testid="select-blocker-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="ignored">Ignored</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)} data-testid="button-create-blocker" className="bg-red-600 hover:bg-red-700">
          <Plus className="w-3.5 h-3.5 mr-1" /> New Blocker
        </Button>
      </div>

      {blockersQuery.isLoading && <p className="text-zinc-400 text-sm">Loading...</p>}
      <div className="space-y-3">
        {blockersQuery.data?.map((blocker: any) => (
          <Card key={blocker.id} className="bg-zinc-800/50 border-zinc-700/50" data-testid={`card-blocker-${blocker.id}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className={`w-4 h-4 ${blocker.severity === "critical" ? "text-red-400" : blocker.severity === "high" ? "text-orange-400" : "text-amber-400"}`} />
                    <span className="font-medium text-white text-sm">{blocker.title}</span>
                    <Badge className={`${SEVERITY_COLORS[blocker.severity] || "bg-slate-500"} text-white text-[10px]`}>{blocker.severity}</Badge>
                    <Badge variant="outline" className="text-[10px]">{blocker.status}</Badge>
                  </div>
                  {blocker.description && <p className="text-zinc-400 text-xs mt-1 ml-6">{blocker.description}</p>}
                  {blocker.linkedPlanId && <p className="text-cyan-400 text-[10px] mt-1 ml-6">Linked Plan: {blocker.linkedPlanId.slice(0, 8)}...</p>}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {blocker.status === "open" && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => resolveMutation.mutate(blocker.id)} data-testid={`button-resolve-blocker-${blocker.id}`} className="text-emerald-400 hover:bg-emerald-500/10 h-7 px-2 text-xs">
                        <CheckCircle className="w-3.5 h-3.5 mr-1" /> Resolve
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => ignoreMutation.mutate(blocker.id)} data-testid={`button-ignore-blocker-${blocker.id}`} className="text-zinc-400 hover:bg-zinc-500/10 h-7 px-2 text-xs">
                        <XCircle className="w-3.5 h-3.5 mr-1" /> Ignore
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {blockersQuery.data?.length === 0 && <p className="text-zinc-500 text-sm text-center py-8">No blockers found.</p>}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-zinc-900 border-zinc-700" data-testid="dialog-create-blocker">
          <DialogHeader>
            <DialogTitle className="text-white">New Blocker</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Title" value={newBlocker.title} onChange={e => setNewBlocker({ ...newBlocker, title: e.target.value })} className="bg-zinc-800 border-zinc-700" data-testid="input-blocker-title" />
            <Textarea placeholder="Description" value={newBlocker.description} onChange={e => setNewBlocker({ ...newBlocker, description: e.target.value })} className="bg-zinc-800 border-zinc-700" data-testid="input-blocker-description" />
            <Select value={newBlocker.severity} onValueChange={v => setNewBlocker({ ...newBlocker, severity: v })}>
              <SelectTrigger className="bg-zinc-800 border-zinc-700" data-testid="select-blocker-severity">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)} data-testid="button-cancel-blocker">Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!newBlocker.title || createMutation.isPending} data-testid="button-submit-blocker" className="bg-red-600 hover:bg-red-700">
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NextActionsTab() {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [filterUrgency, setFilterUrgency] = useState("all");
  const [newAction, setNewAction] = useState({ title: "", description: "", urgency: "this_week", hat: "operator", scope: "metro" });

  const actionsQuery = useQuery<any[]>({
    queryKey: ["/api/cora/operator/next-actions", filterUrgency],
    queryFn: async () => {
      const params = new URLSearchParams({ status: "pending" });
      if (filterUrgency !== "all") params.set("urgency", filterUrgency);
      const res = await fetch(`/api/cora/operator/next-actions?${params}`, { credentials: "include" });
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/cora/operator/next-actions", newAction),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cora/operator/next-actions"] });
      setShowCreate(false);
      setNewAction({ title: "", description: "", urgency: "this_week", hat: "operator", scope: "metro" });
      toast({ title: "Action created" });
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/cora/operator/next-actions/${id}/complete`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cora/operator/next-actions"] });
      toast({ title: "Action completed" });
    },
  });

  const skipMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/cora/operator/next-actions/${id}/skip`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cora/operator/next-actions"] });
      toast({ title: "Action skipped" });
    },
  });

  const groupedActions = {
    today: (actionsQuery.data || []).filter((a: any) => a.urgency === "today"),
    this_week: (actionsQuery.data || []).filter((a: any) => a.urgency === "this_week"),
    later: (actionsQuery.data || []).filter((a: any) => a.urgency === "later"),
  };

  const renderGroup = (urgency: string, items: any[]) => {
    const config = URGENCY_LABELS[urgency] || { label: urgency, color: "bg-slate-500" };
    if (filterUrgency !== "all" && filterUrgency !== urgency) return null;
    return (
      <div key={urgency} className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge className={`${config.color} text-white text-[10px]`}>{config.label}</Badge>
          <span className="text-[10px] text-zinc-500">{items.length} action{items.length !== 1 ? "s" : ""}</span>
        </div>
        {items.length === 0 && <p className="text-zinc-600 text-xs ml-4">None</p>}
        {items.map((action: any) => (
          <Card key={action.id} className="bg-zinc-800/50 border-zinc-700/50 ml-4" data-testid={`card-action-${action.id}`}>
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white text-sm">{action.title}</span>
                    {action.hat && <Badge className={`${HAT_COLORS[action.hat] || "bg-zinc-600 text-white"} text-[10px]`}>{action.hat}</Badge>}
                  </div>
                  {action.description && <p className="text-zinc-400 text-xs mt-1">{action.description}</p>}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => completeMutation.mutate(action.id)} data-testid={`button-complete-action-${action.id}`} className="text-emerald-400 hover:bg-emerald-500/10 h-7 px-2 text-xs">
                    <CheckCircle className="w-3.5 h-3.5 mr-1" /> Done
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => skipMutation.mutate(action.id)} data-testid={`button-skip-action-${action.id}`} className="text-zinc-400 hover:bg-zinc-500/10 h-7 px-2 text-xs">
                    <XCircle className="w-3.5 h-3.5 mr-1" /> Skip
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4" data-testid="operator-next-actions-tab">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-white">Next Actions</h3>
          <Select value={filterUrgency} onValueChange={setFilterUrgency}>
            <SelectTrigger className="w-[130px] h-8 text-xs bg-zinc-800 border-zinc-700" data-testid="select-action-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="later">Later</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)} data-testid="button-create-action" className="bg-cyan-600 hover:bg-cyan-700">
          <Plus className="w-3.5 h-3.5 mr-1" /> New Action
        </Button>
      </div>

      {actionsQuery.isLoading && <p className="text-zinc-400 text-sm">Loading...</p>}
      <div className="space-y-4">
        {renderGroup("today", groupedActions.today)}
        {renderGroup("this_week", groupedActions.this_week)}
        {renderGroup("later", groupedActions.later)}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-zinc-900 border-zinc-700" data-testid="dialog-create-action">
          <DialogHeader>
            <DialogTitle className="text-white">New Action</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Title" value={newAction.title} onChange={e => setNewAction({ ...newAction, title: e.target.value })} className="bg-zinc-800 border-zinc-700" data-testid="input-action-title" />
            <Textarea placeholder="Description" value={newAction.description} onChange={e => setNewAction({ ...newAction, description: e.target.value })} className="bg-zinc-800 border-zinc-700" data-testid="input-action-description" />
            <div className="grid grid-cols-2 gap-3">
              <Select value={newAction.urgency} onValueChange={v => setNewAction({ ...newAction, urgency: v })}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700" data-testid="select-action-urgency">
                  <SelectValue placeholder="Urgency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="this_week">This Week</SelectItem>
                  <SelectItem value="later">Later</SelectItem>
                </SelectContent>
              </Select>
              <Select value={newAction.hat} onValueChange={v => setNewAction({ ...newAction, hat: v })}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700" data-testid="select-action-hat">
                  <SelectValue placeholder="Hat" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operator">Operator</SelectItem>
                  <SelectItem value="cmo">CMO</SelectItem>
                  <SelectItem value="cfo">CFO</SelectItem>
                  <SelectItem value="cto">CTO</SelectItem>
                  <SelectItem value="builder">Builder</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)} data-testid="button-cancel-action">Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!newAction.title || createMutation.isPending} data-testid="button-submit-action" className="bg-cyan-600 hover:bg-cyan-700">
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function OperatorHqPanel({ cityId }: { cityId?: string }) {
  return (
    <div className="p-6 bg-zinc-900 min-h-full" data-testid="operator-hq-panel">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-600">
          <Shield className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white" data-testid="text-operator-hq-title">Operator HQ</h2>
          <p className="text-xs text-zinc-400">Multi-metro operations command center</p>
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="bg-zinc-800/50 border border-zinc-700/50">
          <TabsTrigger value="dashboard" data-testid="tab-operator-dashboard" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white">
            <LayoutDashboard className="w-3.5 h-3.5 mr-1.5" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="opportunities" data-testid="tab-operator-opportunities" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white">
            <Target className="w-3.5 h-3.5 mr-1.5" /> Opportunities
          </TabsTrigger>
          <TabsTrigger value="blockers" data-testid="tab-operator-blockers" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white">
            <AlertTriangle className="w-3.5 h-3.5 mr-1.5" /> Blockers
          </TabsTrigger>
          <TabsTrigger value="next-actions" data-testid="tab-operator-next-actions" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white">
            <ListChecks className="w-3.5 h-3.5 mr-1.5" /> Next Actions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <DashboardTab />
        </TabsContent>
        <TabsContent value="opportunities">
          <OpportunitiesTab />
        </TabsContent>
        <TabsContent value="blockers">
          <BlockersTab />
        </TabsContent>
        <TabsContent value="next-actions">
          <NextActionsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
