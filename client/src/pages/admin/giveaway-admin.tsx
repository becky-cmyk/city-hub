import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useDefaultCityId } from "@/hooks/use-city";
import type {
  Giveaway, GiveawayPrize, GiveawaySponsor, GiveawayEntry,
  GiveawayBonusAction, GiveawayDraw, GiveawayWinner,
} from "@shared/schema";
import {
  Gift, Plus, Loader2, Pencil, Trash2, Users, Trophy,
  Calendar, Eye, Award, ArrowLeft, BarChart3, Dices,
  CheckCircle, XCircle, Clock, AlertTriangle, Ban, Star,
  ExternalLink, Copy, Mail, Download, Search, Settings,
  FileText, TrendingUp, Activity, Play,
} from "lucide-react";
import { DrawWheel } from "@/components/draw-wheel";

interface GiveawayAdminProps {
  selectedCityId: string;
  initialTab?: string;
}

interface EnrichedGiveaway extends Giveaway {
  entryCount: number;
  prizeCount: number;
  sponsorCount: number;
  prizes: GiveawayPrize[];
  sponsors: GiveawaySponsor[];
}

interface GiveawaySummary {
  totalGiveaways: number;
  activeGiveaways: number;
  draftGiveaways: number;
  completedGiveaways: number;
  totalEntries: number;
  totalWinners: number;
  totalDraws: number;
  byStatus: Record<string, number>;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  paused: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  drawing: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  completed: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const WINNER_STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  notified: "bg-blue-100 text-blue-700",
  claimed: "bg-emerald-100 text-emerald-700",
  expired: "bg-zinc-100 text-zinc-700",
  disqualified: "bg-red-100 text-red-700",
};

function formatDate(d: string | Date | null | undefined) {
  if (!d) return "\u2014";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const csvContent = [headers.join(","), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function QueryError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card data-testid="card-query-error">
      <CardContent className="py-8 text-center space-y-3">
        <AlertTriangle className="h-8 w-8 mx-auto text-red-500" />
        <p className="text-sm text-red-600 dark:text-red-400">{message}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} data-testid="button-retry">
            Retry
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function DashboardView({ cityId }: { cityId: string }) {
  const summaryQuery = useQuery<GiveawaySummary>({
    queryKey: ["/api/admin/giveaways/summary", cityId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/giveaways/summary?cityId=${cityId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load summary");
      return res.json();
    },
    enabled: !!cityId,
  });

  const giveawaysQuery = useQuery<EnrichedGiveaway[]>({
    queryKey: ["/api/admin/giveaways", cityId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/giveaways?cityId=${cityId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load giveaways");
      return res.json();
    },
    enabled: !!cityId,
  });

  if (summaryQuery.isLoading) {
    return (
      <div className="space-y-4" data-testid="giveaway-dashboard-loading">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  if (summaryQuery.isError) {
    return <QueryError message="Failed to load dashboard data" onRetry={() => summaryQuery.refetch()} />;
  }

  const s = summaryQuery.data;

  const metrics = [
    { label: "Total Giveaways", value: s?.totalGiveaways ?? 0, icon: Gift },
    { label: "Active", value: s?.activeGiveaways ?? 0, icon: Activity },
    { label: "Draft", value: s?.draftGiveaways ?? 0, icon: FileText },
    { label: "Completed", value: s?.completedGiveaways ?? 0, icon: CheckCircle },
    { label: "Total Entries", value: s?.totalEntries ?? 0, icon: Users },
    { label: "Total Winners", value: s?.totalWinners ?? 0, icon: Trophy },
    { label: "Draws Run", value: s?.totalDraws ?? 0, icon: Dices },
    { label: "Conversion", value: s && s.totalEntries > 0 ? `${Math.round((s.totalWinners / s.totalEntries) * 100)}%` : "0%", icon: TrendingUp },
  ];

  const activeGws = (giveawaysQuery.data || []).filter(g => g.status === "active");

  return (
    <div className="space-y-6" data-testid="giveaway-dashboard">
      <div>
        <h2 className="text-xl font-bold" data-testid="text-dashboard-title">Enter to Win Dashboard</h2>
        <p className="text-sm text-muted-foreground">Overview of all giveaway activity</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map(m => (
          <Card key={m.label} data-testid={`card-metric-${m.label.toLowerCase().replace(/\s+/g, "-")}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <m.icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{m.label}</span>
              </div>
              <p className="text-2xl font-bold">{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {activeGws.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-sm">Active Giveaways</h3>
          {activeGws.map(gw => (
            <Card key={gw.id} data-testid={`card-active-gw-${gw.id}`}>
              <CardContent className="py-4 flex items-center justify-between">
                <div>
                  <div className="font-medium">{gw.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {gw.entryCount ?? 0} entries
                    {gw.endsAt && <> &middot; Ends {formatDate(gw.endsAt)}</>}
                  </div>
                </div>
                <Badge className={STATUS_COLORS["active"]}>Active</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {s && Object.keys(s.byStatus).length > 0 && (
        <Card data-testid="card-status-breakdown">
          <CardHeader><CardTitle className="text-base">Status Breakdown</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {Object.entries(s.byStatus).map(([status, count]) => (
                <div key={status} className="flex items-center gap-2">
                  <Badge className={STATUS_COLORS[status] || ""}>{status}</Badge>
                  <span className="text-sm font-medium">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function GiveawayListView({ cityId, onSelectGiveaway }: { cityId: string; onSelectGiveaway: (gw: EnrichedGiveaway) => void }) {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    title: "", slug: "", description: "", heroImageUrl: "", rulesText: "",
    drawMethod: "random" as string, maxEntries: "", maxEntriesPerUser: "1",
    requiresVerifiedEmail: false, requiresZipcode: false, allowedZipcodes: "",
    startsAt: "", endsAt: "", drawAt: "", isPublic: true, isFeatured: false,
  });

  const giveawaysQuery = useQuery<EnrichedGiveaway[]>({
    queryKey: ["/api/admin/giveaways", cityId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/giveaways?cityId=${cityId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load giveaways");
      return res.json();
    },
    enabled: !!cityId,
  });

  const createGiveaway = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/admin/giveaways", data);
      return res.json();
    },
    onSuccess: (gw: EnrichedGiveaway) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/giveaways"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/giveaways/summary"] });
      setShowCreateDialog(false);
      onSelectGiveaway(gw);
      toast({ title: "Giveaway created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  function handleCreate() {
    const payload: Record<string, unknown> = {
      cityId,
      title: formData.title,
      slug: formData.slug || slugify(formData.title),
      description: formData.description || null,
      heroImageUrl: formData.heroImageUrl || null,
      rulesText: formData.rulesText || null,
      drawMethod: formData.drawMethod,
      maxEntries: formData.maxEntries ? parseInt(formData.maxEntries) : null,
      maxEntriesPerUser: parseInt(formData.maxEntriesPerUser) || 1,
      requiresVerifiedEmail: formData.requiresVerifiedEmail,
      requiresZipcode: formData.requiresZipcode,
      allowedZipcodes: formData.allowedZipcodes ? formData.allowedZipcodes.split(",").map((z: string) => z.trim()).filter(Boolean) : null,
      startsAt: formData.startsAt ? new Date(formData.startsAt).toISOString() : null,
      endsAt: formData.endsAt ? new Date(formData.endsAt).toISOString() : null,
      drawAt: formData.drawAt ? new Date(formData.drawAt).toISOString() : null,
      isPublic: formData.isPublic,
      isFeatured: formData.isFeatured,
    };
    createGiveaway.mutate(payload);
  }

  const filtered = (giveawaysQuery.data || []).filter(gw => {
    if (statusFilter && gw.status !== statusFilter) return false;
    if (searchTerm && !gw.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  if (giveawaysQuery.isError) {
    return <QueryError message="Failed to load giveaways" onRetry={() => giveawaysQuery.refetch()} />;
  }

  return (
    <div className="space-y-4" data-testid="giveaway-list-view">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Giveaways</h2>
        <Button onClick={() => {
          setFormData({
            title: "", slug: "", description: "", heroImageUrl: "", rulesText: "",
            drawMethod: "random", maxEntries: "", maxEntriesPerUser: "1",
            requiresVerifiedEmail: false, requiresZipcode: false, allowedZipcodes: "",
            startsAt: "", endsAt: "", drawAt: "", isPublic: true, isFeatured: false,
          });
          setShowCreateDialog(true);
        }} data-testid="button-create-giveaway">
          <Plus className="w-4 h-4 mr-1" /> New Giveaway
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search giveaways..."
            className="pl-9"
            data-testid="input-search-giveaways"
          />
        </div>
        <Select value={statusFilter || "_all"} onValueChange={v => setStatusFilter(v === "_all" ? "" : v)}>
          <SelectTrigger className="w-40" data-testid="select-status-filter">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {giveawaysQuery.isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Gift className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">No giveaways found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(gw => (
            <Card key={gw.id} className="cursor-pointer hover:ring-1 hover:ring-ring transition-shadow" onClick={() => onSelectGiveaway(gw)} data-testid={`card-giveaway-${gw.id}`}>
              <CardContent className="py-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{gw.title}</span>
                    <Badge className={STATUS_COLORS[gw.status] || ""} data-testid={`badge-status-${gw.id}`}>{gw.status}</Badge>
                    {gw.isFeatured && <Badge variant="outline" className="text-xs">Featured</Badge>}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {gw.entryCount ?? 0} entries &middot; {gw.prizeCount ?? 0} prizes &middot; {gw.sponsorCount ?? 0} sponsors
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Created {formatDate(gw.createdAt)}
                    {gw.endsAt && <> &middot; Ends {formatDate(gw.endsAt)}</>}
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0 ml-3" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Giveaway</DialogTitle>
            <DialogDescription>Set up a new Enter to Win giveaway</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input value={formData.title} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} data-testid="input-create-title" />
              </div>
              <div>
                <Label>Slug</Label>
                <Input value={formData.slug} onChange={e => setFormData(p => ({ ...p, slug: e.target.value }))} placeholder={slugify(formData.title)} data-testid="input-create-slug" />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} rows={3} data-testid="input-create-description" />
              </div>
              <div>
                <Label>Hero Image URL</Label>
                <Input value={formData.heroImageUrl} onChange={e => setFormData(p => ({ ...p, heroImageUrl: e.target.value }))} data-testid="input-create-hero" />
              </div>
              <div>
                <Label>Rules Text</Label>
                <Textarea value={formData.rulesText} onChange={e => setFormData(p => ({ ...p, rulesText: e.target.value }))} rows={3} data-testid="input-create-rules" />
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <Label>Draw Method</Label>
                <Select value={formData.drawMethod} onValueChange={v => setFormData(p => ({ ...p, drawMethod: v }))}>
                  <SelectTrigger data-testid="select-create-draw-method"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="random">Random</SelectItem>
                    <SelectItem value="weighted">Weighted (by bonus entries)</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Max Entries</Label>
                  <Input type="number" value={formData.maxEntries} onChange={e => setFormData(p => ({ ...p, maxEntries: e.target.value }))} placeholder="Unlimited" data-testid="input-create-max-entries" />
                </div>
                <div>
                  <Label>Max Per User</Label>
                  <Input type="number" value={formData.maxEntriesPerUser} onChange={e => setFormData(p => ({ ...p, maxEntriesPerUser: e.target.value }))} data-testid="input-create-max-per-user" />
                </div>
              </div>
              <div>
                <Label>Starts At</Label>
                <Input type="datetime-local" value={formData.startsAt} onChange={e => setFormData(p => ({ ...p, startsAt: e.target.value }))} data-testid="input-create-starts" />
              </div>
              <div>
                <Label>Ends At</Label>
                <Input type="datetime-local" value={formData.endsAt} onChange={e => setFormData(p => ({ ...p, endsAt: e.target.value }))} data-testid="input-create-ends" />
              </div>
              <div>
                <Label>Draw At</Label>
                <Input type="datetime-local" value={formData.drawAt} onChange={e => setFormData(p => ({ ...p, drawAt: e.target.value }))} data-testid="input-create-draw-at" />
              </div>
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3">
                  <Switch checked={formData.requiresVerifiedEmail} onCheckedChange={v => setFormData(p => ({ ...p, requiresVerifiedEmail: v }))} data-testid="switch-create-verified" />
                  <Label>Require Verified Email</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={formData.isPublic} onCheckedChange={v => setFormData(p => ({ ...p, isPublic: v }))} data-testid="switch-create-public" />
                  <Label>Public</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={formData.isFeatured} onCheckedChange={v => setFormData(p => ({ ...p, isFeatured: v }))} data-testid="switch-create-featured" />
                  <Label>Featured</Label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} data-testid="button-cancel-create">Cancel</Button>
            <Button onClick={handleCreate} disabled={!formData.title || createGiveaway.isPending} data-testid="button-submit-create">
              {createGiveaway.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GiveawayDetailView({ giveawayId, cityId, onBack }: { giveawayId: string; cityId: string; onBack: () => void }) {
  const { toast } = useToast();
  const [showPrizeDialog, setShowPrizeDialog] = useState(false);
  const [showSponsorDialog, setShowSponsorDialog] = useState(false);
  const [showBonusDialog, setShowBonusDialog] = useState(false);
  const [showDrawDialog, setShowDrawDialog] = useState(false);
  const [editingPrize, setEditingPrize] = useState<GiveawayPrize | null>(null);
  const [editingSponsor, setEditingSponsor] = useState<GiveawaySponsor | null>(null);
  const [editingBonus, setEditingBonus] = useState<GiveawayBonusAction | null>(null);
  const [detailTab, setDetailTab] = useState("settings");

  const [formData, setFormData] = useState({
    title: "", slug: "", description: "", heroImageUrl: "", rulesText: "",
    drawMethod: "random" as string, maxEntries: "", maxEntriesPerUser: "1",
    requiresVerifiedEmail: false, requiresZipcode: false, allowedZipcodes: "",
    startsAt: "", endsAt: "", drawAt: "", isPublic: true, isFeatured: false,
  });

  const [prizeForm, setPrizeForm] = useState({ name: "", description: "", imageUrl: "", value: "", quantity: "1", sortOrder: "0", sponsorId: "" });
  const [sponsorForm, setSponsorForm] = useState({ name: "", logoUrl: "", websiteUrl: "", tier: "standard", sortOrder: "0", businessId: "" });
  const [bonusForm, setBonusForm] = useState({ bonusType: "share_social" as string, label: "", description: "", bonusAmount: "1", actionUrl: "", isActive: true, sortOrder: "0" });
  const [drawForm, setDrawForm] = useState({ winnerCount: "1", prizeId: "" });
  const [formLoaded, setFormLoaded] = useState(false);

  const detailQuery = useQuery<Giveaway>({
    queryKey: ["/api/admin/giveaways", giveawayId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/giveaways/${giveawayId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load giveaway");
      return res.json();
    },
    enabled: !!giveawayId,
  });

  const gw = detailQuery.data;

  if (gw && !formLoaded) {
    setFormData({
      title: gw.title,
      slug: gw.slug,
      description: gw.description || "",
      heroImageUrl: gw.heroImageUrl || "",
      rulesText: gw.rulesText || "",
      drawMethod: gw.drawMethod,
      maxEntries: gw.maxEntries?.toString() || "",
      maxEntriesPerUser: gw.maxEntriesPerUser.toString(),
      requiresVerifiedEmail: gw.requiresVerifiedEmail,
      requiresZipcode: gw.requiresZipcode,
      allowedZipcodes: gw.allowedZipcodes?.join(", ") || "",
      startsAt: gw.startsAt ? new Date(gw.startsAt).toISOString().slice(0, 16) : "",
      endsAt: gw.endsAt ? new Date(gw.endsAt).toISOString().slice(0, 16) : "",
      drawAt: gw.drawAt ? new Date(gw.drawAt).toISOString().slice(0, 16) : "",
      isPublic: gw.isPublic,
      isFeatured: gw.isFeatured,
    });
    setFormLoaded(true);
  }

  const prizesQuery = useQuery<GiveawayPrize[]>({
    queryKey: ["/api/admin/giveaways", giveawayId, "prizes"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/giveaways/${giveawayId}/prizes`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load prizes");
      return res.json();
    },
    enabled: !!giveawayId,
  });

  const sponsorsQuery = useQuery<GiveawaySponsor[]>({
    queryKey: ["/api/admin/giveaways", giveawayId, "sponsors"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/giveaways/${giveawayId}/sponsors`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load sponsors");
      return res.json();
    },
    enabled: !!giveawayId,
  });

  const bonusActionsQuery = useQuery<GiveawayBonusAction[]>({
    queryKey: ["/api/admin/giveaways", giveawayId, "bonus-actions"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/giveaways/${giveawayId}/bonus-actions`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load bonus actions");
      return res.json();
    },
    enabled: !!giveawayId,
  });

  const entriesQuery = useQuery<{ data: GiveawayEntry[]; total: number; page: number; totalPages: number }>({
    queryKey: ["/api/admin/giveaways", giveawayId, "entries"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/giveaways/${giveawayId}/entries?limit=200`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load entries");
      return res.json();
    },
    enabled: !!giveawayId && (detailTab === "entries" || detailTab === "settings"),
  });

  const drawsQuery = useQuery<GiveawayDraw[]>({
    queryKey: ["/api/admin/giveaways", giveawayId, "draws"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/giveaways/${giveawayId}/draws`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load draws");
      return res.json();
    },
    enabled: !!giveawayId && (detailTab === "draws" || detailTab === "settings"),
  });

  const winnersQuery = useQuery<(GiveawayWinner & { entry?: GiveawayEntry; prize?: GiveawayPrize | null })[]>({
    queryKey: ["/api/admin/giveaways", giveawayId, "winners"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/giveaways/${giveawayId}/winners`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load winners");
      return res.json();
    },
    enabled: !!giveawayId && (detailTab === "draws" || detailTab === "settings"),
  });

  const updateGiveaway = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("PATCH", `/api/admin/giveaways/${giveawayId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/giveaways"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/giveaways/summary"] });
      toast({ title: "Giveaway updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteGiveaway = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/admin/giveaways/${giveawayId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/giveaways"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/giveaways/summary"] });
      onBack();
      toast({ title: "Giveaway deleted" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createPrize = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", `/api/admin/giveaways/${giveawayId}/prizes`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/giveaways", giveawayId, "prizes"] });
      setShowPrizeDialog(false);
      setEditingPrize(null);
      toast({ title: "Prize added" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updatePrize = useMutation({
    mutationFn: async ({ prizeId, data }: { prizeId: string; data: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/admin/giveaways/${giveawayId}/prizes/${prizeId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/giveaways", giveawayId, "prizes"] });
      setShowPrizeDialog(false);
      setEditingPrize(null);
      toast({ title: "Prize updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deletePrize = useMutation({
    mutationFn: async (prizeId: string) => {
      await apiRequest("DELETE", `/api/admin/giveaways/${giveawayId}/prizes/${prizeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/giveaways", giveawayId, "prizes"] });
      toast({ title: "Prize removed" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createSponsor = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", `/api/admin/giveaways/${giveawayId}/sponsors`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/giveaways", giveawayId, "sponsors"] });
      setShowSponsorDialog(false);
      setEditingSponsor(null);
      toast({ title: "Sponsor added" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateSponsor = useMutation({
    mutationFn: async ({ sponsorId, data }: { sponsorId: string; data: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/admin/giveaways/${giveawayId}/sponsors/${sponsorId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/giveaways", giveawayId, "sponsors"] });
      setShowSponsorDialog(false);
      setEditingSponsor(null);
      toast({ title: "Sponsor updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteSponsor = useMutation({
    mutationFn: async (sponsorId: string) => {
      await apiRequest("DELETE", `/api/admin/giveaways/${giveawayId}/sponsors/${sponsorId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/giveaways", giveawayId, "sponsors"] });
      toast({ title: "Sponsor removed" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createBonusAction = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", `/api/admin/giveaways/${giveawayId}/bonus-actions`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/giveaways", giveawayId, "bonus-actions"] });
      setShowBonusDialog(false);
      setEditingBonus(null);
      toast({ title: "Bonus action added" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateBonusAction = useMutation({
    mutationFn: async ({ actionId, data }: { actionId: string; data: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/admin/giveaways/${giveawayId}/bonus-actions/${actionId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/giveaways", giveawayId, "bonus-actions"] });
      setShowBonusDialog(false);
      setEditingBonus(null);
      toast({ title: "Bonus action updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteBonusAction = useMutation({
    mutationFn: async (actionId: string) => {
      await apiRequest("DELETE", `/api/admin/giveaways/${giveawayId}/bonus-actions/${actionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/giveaways", giveawayId, "bonus-actions"] });
      toast({ title: "Bonus action removed" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const disqualifyEntry = useMutation({
    mutationFn: async (entryId: string) => {
      await apiRequest("PATCH", `/api/admin/giveaways/${giveawayId}/entries/${entryId}/disqualify`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/giveaways", giveawayId, "entries"] });
      toast({ title: "Entry disqualified" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const reinstateEntry = useMutation({
    mutationFn: async (entryId: string) => {
      await apiRequest("PATCH", `/api/admin/giveaways/${giveawayId}/entries/${entryId}/reinstate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/giveaways", giveawayId, "entries"] });
      toast({ title: "Entry reinstated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const executeDraw = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", `/api/admin/giveaways/${giveawayId}/draw`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/giveaways", giveawayId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/giveaways/summary"] });
      setShowDrawDialog(false);
      toast({ title: "Draw executed successfully" });
    },
    onError: (err: Error) => toast({ title: "Draw failed", description: err.message, variant: "destructive" }),
  });

  const updateWinnerStatus = useMutation({
    mutationFn: async ({ winnerId, status }: { winnerId: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/giveaways/${giveawayId}/winners/${winnerId}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/giveaways", giveawayId, "winners"] });
      toast({ title: "Winner status updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const notifyWinners = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/giveaways/${giveawayId}/notify-winners`);
      return res.json();
    },
    onSuccess: (data: { notified: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/giveaways", giveawayId, "winners"] });
      toast({ title: `${data.notified} winner(s) notified` });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  function handleSaveGiveaway() {
    const payload: Record<string, unknown> = {
      cityId,
      title: formData.title,
      slug: formData.slug || slugify(formData.title),
      description: formData.description || null,
      heroImageUrl: formData.heroImageUrl || null,
      rulesText: formData.rulesText || null,
      drawMethod: formData.drawMethod,
      maxEntries: formData.maxEntries ? parseInt(formData.maxEntries) : null,
      maxEntriesPerUser: parseInt(formData.maxEntriesPerUser) || 1,
      requiresVerifiedEmail: formData.requiresVerifiedEmail,
      requiresZipcode: formData.requiresZipcode,
      allowedZipcodes: formData.allowedZipcodes ? formData.allowedZipcodes.split(",").map((z: string) => z.trim()).filter(Boolean) : null,
      startsAt: formData.startsAt ? new Date(formData.startsAt).toISOString() : null,
      endsAt: formData.endsAt ? new Date(formData.endsAt).toISOString() : null,
      drawAt: formData.drawAt ? new Date(formData.drawAt).toISOString() : null,
      isPublic: formData.isPublic,
      isFeatured: formData.isFeatured,
    };
    updateGiveaway.mutate(payload);
  }

  function handleSavePrize() {
    const payload = {
      giveawayId,
      name: prizeForm.name,
      description: prizeForm.description || null,
      imageUrl: prizeForm.imageUrl || null,
      value: prizeForm.value || null,
      quantity: parseInt(prizeForm.quantity) || 1,
      sortOrder: parseInt(prizeForm.sortOrder) || 0,
      sponsorId: prizeForm.sponsorId || null,
    };
    if (editingPrize) {
      updatePrize.mutate({ prizeId: editingPrize.id, data: payload });
    } else {
      createPrize.mutate(payload);
    }
  }

  function handleSaveSponsor() {
    const payload = {
      giveawayId,
      name: sponsorForm.name,
      logoUrl: sponsorForm.logoUrl || null,
      websiteUrl: sponsorForm.websiteUrl || null,
      tier: sponsorForm.tier,
      sortOrder: parseInt(sponsorForm.sortOrder) || 0,
      businessId: sponsorForm.businessId || null,
    };
    if (editingSponsor) {
      updateSponsor.mutate({ sponsorId: editingSponsor.id, data: payload });
    } else {
      createSponsor.mutate(payload);
    }
  }

  function handleSaveBonusAction() {
    const payload = {
      giveawayId,
      bonusType: bonusForm.bonusType,
      label: bonusForm.label,
      description: bonusForm.description || null,
      bonusAmount: parseInt(bonusForm.bonusAmount) || 1,
      actionUrl: bonusForm.actionUrl || null,
      isActive: bonusForm.isActive,
      sortOrder: parseInt(bonusForm.sortOrder) || 0,
    };
    if (editingBonus) {
      updateBonusAction.mutate({ actionId: editingBonus.id, data: payload });
    } else {
      createBonusAction.mutate(payload);
    }
  }

  if (detailQuery.isError) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-to-list">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <QueryError message="Failed to load giveaway details" onRetry={() => detailQuery.refetch()} />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="giveaway-detail-view">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-to-list">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <h2 className="text-xl font-bold">{gw?.title || "Loading..."}</h2>
        {gw && <Badge className={STATUS_COLORS[gw.status]} data-testid="badge-giveaway-status">{gw.status}</Badge>}
      </div>

      <Tabs value={detailTab} onValueChange={setDetailTab}>
        <TabsList data-testid="giveaway-detail-tabs">
          <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
          <TabsTrigger value="prizes" data-testid="tab-prizes">Prizes</TabsTrigger>
          <TabsTrigger value="sponsors" data-testid="tab-sponsors">Sponsors</TabsTrigger>
          <TabsTrigger value="bonus" data-testid="tab-bonus">Bonus Actions</TabsTrigger>
          <TabsTrigger value="entries" data-testid="tab-entries">Entries ({entriesQuery.data?.total ?? "..."})</TabsTrigger>
          <TabsTrigger value="draws" data-testid="tab-draws">Draws & Winners</TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          {detailQuery.isLoading ? <Skeleton className="h-64 w-full" /> : gw ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-base">General</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Title</Label>
                    <Input value={formData.title} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} data-testid="input-giveaway-title" />
                  </div>
                  <div>
                    <Label>Slug</Label>
                    <Input value={formData.slug} onChange={e => setFormData(p => ({ ...p, slug: e.target.value }))} placeholder={slugify(formData.title)} data-testid="input-giveaway-slug" />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} rows={3} data-testid="input-giveaway-description" />
                  </div>
                  <div>
                    <Label>Hero Image URL</Label>
                    <Input value={formData.heroImageUrl} onChange={e => setFormData(p => ({ ...p, heroImageUrl: e.target.value }))} data-testid="input-giveaway-hero" />
                  </div>
                  <div>
                    <Label>Rules Text</Label>
                    <Textarea value={formData.rulesText} onChange={e => setFormData(p => ({ ...p, rulesText: e.target.value }))} rows={4} data-testid="input-giveaway-rules" />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={gw.status} onValueChange={(v) => updateGiveaway.mutate({ status: v })}>
                      <SelectTrigger data-testid="select-giveaway-status"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="paused">Paused</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Configuration</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Draw Method</Label>
                    <Select value={formData.drawMethod} onValueChange={v => setFormData(p => ({ ...p, drawMethod: v }))}>
                      <SelectTrigger data-testid="select-draw-method"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="random">Random</SelectItem>
                        <SelectItem value="weighted">Weighted (by bonus entries)</SelectItem>
                        <SelectItem value="manual">Manual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Max Total Entries</Label>
                      <Input type="number" value={formData.maxEntries} onChange={e => setFormData(p => ({ ...p, maxEntries: e.target.value }))} placeholder="Unlimited" data-testid="input-max-entries" />
                    </div>
                    <div>
                      <Label>Max Per User</Label>
                      <Input type="number" value={formData.maxEntriesPerUser} onChange={e => setFormData(p => ({ ...p, maxEntriesPerUser: e.target.value }))} data-testid="input-max-per-user" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={formData.requiresVerifiedEmail} onCheckedChange={v => setFormData(p => ({ ...p, requiresVerifiedEmail: v }))} data-testid="switch-verified-email" />
                    <Label>Require Verified Email</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={formData.requiresZipcode} onCheckedChange={v => setFormData(p => ({ ...p, requiresZipcode: v }))} data-testid="switch-require-zip" />
                    <Label>Require ZIP Code</Label>
                  </div>
                  {formData.requiresZipcode && (
                    <div>
                      <Label>Allowed ZIP Codes (comma separated)</Label>
                      <Input value={formData.allowedZipcodes} onChange={e => setFormData(p => ({ ...p, allowedZipcodes: e.target.value }))} placeholder="28202, 28203, 28204" data-testid="input-allowed-zips" />
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <Switch checked={formData.isPublic} onCheckedChange={v => setFormData(p => ({ ...p, isPublic: v }))} data-testid="switch-is-public" />
                    <Label>Public</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={formData.isFeatured} onCheckedChange={v => setFormData(p => ({ ...p, isFeatured: v }))} data-testid="switch-is-featured" />
                    <Label>Featured</Label>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Schedule</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Starts At</Label>
                    <Input type="datetime-local" value={formData.startsAt} onChange={e => setFormData(p => ({ ...p, startsAt: e.target.value }))} data-testid="input-starts-at" />
                  </div>
                  <div>
                    <Label>Ends At</Label>
                    <Input type="datetime-local" value={formData.endsAt} onChange={e => setFormData(p => ({ ...p, endsAt: e.target.value }))} data-testid="input-ends-at" />
                  </div>
                  <div>
                    <Label>Draw At</Label>
                    <Input type="datetime-local" value={formData.drawAt} onChange={e => setFormData(p => ({ ...p, drawAt: e.target.value }))} data-testid="input-draw-at" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Quick Stats</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                      <div className="text-2xl font-bold" data-testid="text-entry-count">{entriesQuery.data?.total ?? "\u2014"}</div>
                      <div className="text-sm text-zinc-500">Entries</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                      <div className="text-2xl font-bold" data-testid="text-winner-count">{winnersQuery.data?.length ?? "\u2014"}</div>
                      <div className="text-sm text-zinc-500">Winners</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                      <div className="text-2xl font-bold" data-testid="text-prize-count">{prizesQuery.data?.length ?? "\u2014"}</div>
                      <div className="text-sm text-zinc-500">Prizes</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                      <div className="text-2xl font-bold" data-testid="text-draw-count">{drawsQuery.data?.length ?? "\u2014"}</div>
                      <div className="text-sm text-zinc-500">Draws</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="lg:col-span-2 flex gap-3">
                <Button onClick={handleSaveGiveaway} disabled={updateGiveaway.isPending} data-testid="button-save-giveaway">
                  {updateGiveaway.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  Save Changes
                </Button>
                <Button variant="destructive" onClick={() => { if (confirm("Delete this giveaway? This cannot be undone.")) deleteGiveaway.mutate(); }} data-testid="button-delete-giveaway">
                  <Trash2 className="w-4 h-4 mr-1" /> Delete
                </Button>
              </div>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="prizes">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Prizes</h3>
              <Button size="sm" onClick={() => {
                setPrizeForm({ name: "", description: "", imageUrl: "", value: "", quantity: "1", sortOrder: "0", sponsorId: "" });
                setEditingPrize(null);
                setShowPrizeDialog(true);
              }} data-testid="button-add-prize">
                <Plus className="w-4 h-4 mr-1" /> Add Prize
              </Button>
            </div>
            {prizesQuery.isLoading ? <Skeleton className="h-32 w-full" /> : (
              <div className="space-y-3">
                {(prizesQuery.data || []).length === 0 && (
                  <Card><CardContent className="py-8 text-center text-zinc-500">No prizes added yet</CardContent></Card>
                )}
                {(prizesQuery.data || []).map(prize => (
                  <Card key={prize.id} data-testid={`card-prize-${prize.id}`}>
                    <CardContent className="py-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {prize.imageUrl ? (
                          <img src={prize.imageUrl} alt={prize.name} className="w-12 h-12 rounded object-cover" />
                        ) : (
                          <div className="w-12 h-12 rounded bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                            <Gift className="w-5 h-5 text-zinc-400" />
                          </div>
                        )}
                        <div>
                          <div className="font-medium">{prize.name}</div>
                          <div className="text-sm text-zinc-500">
                            Qty: {prize.quantity}{prize.value ? ` | Value: $${prize.value}` : ""}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => {
                          setEditingPrize(prize);
                          setPrizeForm({
                            name: prize.name,
                            description: prize.description || "",
                            imageUrl: prize.imageUrl || "",
                            value: prize.value?.toString() || "",
                            quantity: prize.quantity.toString(),
                            sortOrder: prize.sortOrder.toString(),
                            sponsorId: prize.sponsorId || "",
                          });
                          setShowPrizeDialog(true);
                        }} data-testid={`button-edit-prize-${prize.id}`}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deletePrize.mutate(prize.id)} data-testid={`button-delete-prize-${prize.id}`}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="sponsors">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Sponsors</h3>
              <Button size="sm" onClick={() => {
                setSponsorForm({ name: "", logoUrl: "", websiteUrl: "", tier: "standard", sortOrder: "0", businessId: "" });
                setEditingSponsor(null);
                setShowSponsorDialog(true);
              }} data-testid="button-add-sponsor">
                <Plus className="w-4 h-4 mr-1" /> Add Sponsor
              </Button>
            </div>
            {sponsorsQuery.isLoading ? <Skeleton className="h-32 w-full" /> : (
              <div className="space-y-3">
                {(sponsorsQuery.data || []).length === 0 && (
                  <Card><CardContent className="py-8 text-center text-zinc-500">No sponsors added yet</CardContent></Card>
                )}
                {(sponsorsQuery.data || []).map(sponsor => (
                  <Card key={sponsor.id} data-testid={`card-sponsor-${sponsor.id}`}>
                    <CardContent className="py-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {sponsor.logoUrl ? (
                          <img src={sponsor.logoUrl} alt={sponsor.name} className="w-10 h-10 rounded object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                            <Star className="w-4 h-4 text-zinc-400" />
                          </div>
                        )}
                        <div>
                          <div className="font-medium">{sponsor.name}</div>
                          <Badge variant="outline" className="text-xs">{sponsor.tier}</Badge>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {sponsor.websiteUrl && (
                          <a href={sponsor.websiteUrl} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="sm"><ExternalLink className="w-4 h-4" /></Button>
                          </a>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => {
                          setEditingSponsor(sponsor);
                          setSponsorForm({
                            name: sponsor.name,
                            logoUrl: sponsor.logoUrl || "",
                            websiteUrl: sponsor.websiteUrl || "",
                            tier: sponsor.tier,
                            sortOrder: sponsor.sortOrder.toString(),
                            businessId: sponsor.businessId || "",
                          });
                          setShowSponsorDialog(true);
                        }} data-testid={`button-edit-sponsor-${sponsor.id}`}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteSponsor.mutate(sponsor.id)} data-testid={`button-delete-sponsor-${sponsor.id}`}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="bonus">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Bonus Actions</h3>
              <Button size="sm" onClick={() => {
                setBonusForm({ bonusType: "share_social", label: "", description: "", bonusAmount: "1", actionUrl: "", isActive: true, sortOrder: "0" });
                setEditingBonus(null);
                setShowBonusDialog(true);
              }} data-testid="button-add-bonus">
                <Plus className="w-4 h-4 mr-1" /> Add Bonus Action
              </Button>
            </div>
            {bonusActionsQuery.isLoading ? <Skeleton className="h-32 w-full" /> : (
              <div className="space-y-3">
                {(bonusActionsQuery.data || []).length === 0 && (
                  <Card><CardContent className="py-8 text-center text-zinc-500">No bonus actions configured</CardContent></Card>
                )}
                {(bonusActionsQuery.data || []).map(action => (
                  <Card key={action.id} data-testid={`card-bonus-${action.id}`}>
                    <CardContent className="py-4 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{action.label}</span>
                          <Badge variant="outline" className="text-xs">{action.bonusType.replace(/_/g, " ")}</Badge>
                          <Badge className={action.isActive ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"}>
                            {action.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <div className="text-sm text-zinc-500 mt-1">+{action.bonusAmount} bonus {action.bonusAmount === 1 ? "entry" : "entries"}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => {
                          setEditingBonus(action);
                          setBonusForm({
                            bonusType: action.bonusType,
                            label: action.label,
                            description: action.description || "",
                            bonusAmount: action.bonusAmount.toString(),
                            actionUrl: action.actionUrl || "",
                            isActive: action.isActive,
                            sortOrder: action.sortOrder.toString(),
                          });
                          setShowBonusDialog(true);
                        }} data-testid={`button-edit-bonus-${action.id}`}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteBonusAction.mutate(action.id)} data-testid={`button-delete-bonus-${action.id}`}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="entries">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Entries ({entriesQuery.data?.total ?? 0})</h3>
              {(entriesQuery.data?.data || []).length > 0 && (
                <Button variant="outline" size="sm" onClick={() => {
                  const entries = entriesQuery.data?.data || [];
                  downloadCsv(`entries-${gw?.slug || "export"}.csv`,
                    ["Name", "Email", "Method", "Total Entries", "Verified", "Disqualified", "Date"],
                    entries.map(e => [e.name, e.email, e.entryMethod, String(e.totalEntries), e.isVerified ? "Yes" : "No", e.isDisqualified ? "Yes" : "No", formatDate(e.createdAt as string)])
                  );
                }} data-testid="button-export-entries">
                  <Download className="w-4 h-4 mr-1" /> Export
                </Button>
              )}
            </div>
            {entriesQuery.isLoading ? <Skeleton className="h-32 w-full" /> : (
              <div className="space-y-2">
                {(entriesQuery.data?.data || []).length === 0 && (
                  <Card><CardContent className="py-8 text-center text-zinc-500">No entries yet</CardContent></Card>
                )}
                {(entriesQuery.data?.data || []).map(entry => (
                  <Card key={entry.id} data-testid={`card-entry-${entry.id}`} className={entry.isDisqualified ? "border-red-200 dark:border-red-900" : ""}>
                    <CardContent className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {entry.name}
                            {entry.isVerified && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
                            {entry.isDisqualified && <Ban className="w-3.5 h-3.5 text-red-500" />}
                          </div>
                          <div className="text-sm text-zinc-500">{entry.email}</div>
                          <div className="text-xs text-zinc-400 mt-0.5">
                            {entry.entryMethod} | {entry.totalEntries} total entries | {formatDate(entry.createdAt as string)}
                            {entry.referredBy && " | Referred"}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {entry.isDisqualified ? (
                          <Button variant="outline" size="sm" onClick={() => reinstateEntry.mutate(entry.id)} data-testid={`button-reinstate-${entry.id}`}>
                            Reinstate
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => disqualifyEntry.mutate(entry.id)} data-testid={`button-disqualify-${entry.id}`}>
                            Disqualify
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="draws">
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Draws & Winners</h3>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => {
                  setDrawForm({ winnerCount: "1", prizeId: "" });
                  setShowDrawDialog(true);
                }} data-testid="button-run-draw">
                  <Dices className="w-4 h-4 mr-1" /> Run Draw
                </Button>
                {(winnersQuery.data || []).some(w => w.status === "pending") && (
                  <Button size="sm" variant="outline" onClick={() => notifyWinners.mutate()} disabled={notifyWinners.isPending} data-testid="button-notify-winners">
                    <Mail className="w-4 h-4 mr-1" /> Notify Winners
                  </Button>
                )}
              </div>
            </div>

            {drawsQuery.isLoading ? <Skeleton className="h-24 w-full" /> : (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-zinc-500">Draw History</h4>
                {(drawsQuery.data || []).length === 0 && (
                  <Card><CardContent className="py-6 text-center text-zinc-500">No draws executed yet</CardContent></Card>
                )}
                {(drawsQuery.data || []).map(draw => (
                  <Card key={draw.id} data-testid={`card-draw-${draw.id}`}>
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">Draw #{draw.drawNumber}</div>
                          <div className="text-sm text-zinc-500">
                            {draw.drawMethod} | {draw.totalEligible} eligible | {draw.winnersSelected} selected | {formatDate(draw.createdAt as string)}
                          </div>
                          {draw.seed && <div className="text-xs text-zinc-400 font-mono mt-1">Seed: {draw.seed}</div>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {winnersQuery.isLoading ? <Skeleton className="h-24 w-full" /> : (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-zinc-500">Winners ({(winnersQuery.data || []).length})</h4>
                {(winnersQuery.data || []).length === 0 && (
                  <Card><CardContent className="py-6 text-center text-zinc-500">No winners yet</CardContent></Card>
                )}
                {(winnersQuery.data || []).map(winner => (
                  <Card key={winner.id} data-testid={`card-winner-${winner.id}`}>
                    <CardContent className="py-3 flex items-center justify-between">
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          <Trophy className="w-4 h-4 text-amber-500" />
                          {winner.entry?.name || "Unknown"}
                        </div>
                        <div className="text-sm text-zinc-500">{winner.entry?.email}</div>
                        {winner.prize?.name && <div className="text-xs text-zinc-400 mt-0.5">Prize: {winner.prize.name}</div>}
                        <div className="text-xs text-zinc-400">{formatDate(winner.createdAt as string)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={WINNER_STATUS_COLORS[winner.status] || ""} data-testid={`badge-winner-status-${winner.id}`}>{winner.status}</Badge>
                        <Select value={winner.status} onValueChange={v => updateWinnerStatus.mutate({ winnerId: winner.id, status: v })}>
                          <SelectTrigger className="w-28" data-testid={`select-winner-status-${winner.id}`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="notified">Notified</SelectItem>
                            <SelectItem value="claimed">Claimed</SelectItem>
                            <SelectItem value="expired">Expired</SelectItem>
                            <SelectItem value="disqualified">Disqualified</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showPrizeDialog} onOpenChange={setShowPrizeDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingPrize ? "Edit Prize" : "Add Prize"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={prizeForm.name} onChange={e => setPrizeForm(p => ({ ...p, name: e.target.value }))} data-testid="input-prize-name" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={prizeForm.description} onChange={e => setPrizeForm(p => ({ ...p, description: e.target.value }))} data-testid="input-prize-description" />
            </div>
            <div>
              <Label>Image URL</Label>
              <Input value={prizeForm.imageUrl} onChange={e => setPrizeForm(p => ({ ...p, imageUrl: e.target.value }))} data-testid="input-prize-image" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Value ($)</Label>
                <Input type="number" value={prizeForm.value} onChange={e => setPrizeForm(p => ({ ...p, value: e.target.value }))} data-testid="input-prize-value" />
              </div>
              <div>
                <Label>Quantity</Label>
                <Input type="number" value={prizeForm.quantity} onChange={e => setPrizeForm(p => ({ ...p, quantity: e.target.value }))} data-testid="input-prize-quantity" />
              </div>
            </div>
            <div>
              <Label>Sort Order</Label>
              <Input type="number" value={prizeForm.sortOrder} onChange={e => setPrizeForm(p => ({ ...p, sortOrder: e.target.value }))} data-testid="input-prize-sort" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPrizeDialog(false)}>Cancel</Button>
            <Button onClick={handleSavePrize} disabled={!prizeForm.name || createPrize.isPending || updatePrize.isPending} data-testid="button-save-prize">
              {(createPrize.isPending || updatePrize.isPending) ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {editingPrize ? "Update" : "Add"} Prize
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSponsorDialog} onOpenChange={setShowSponsorDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingSponsor ? "Edit Sponsor" : "Add Sponsor"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={sponsorForm.name} onChange={e => setSponsorForm(p => ({ ...p, name: e.target.value }))} data-testid="input-sponsor-name" />
            </div>
            <div>
              <Label>Logo URL</Label>
              <Input value={sponsorForm.logoUrl} onChange={e => setSponsorForm(p => ({ ...p, logoUrl: e.target.value }))} data-testid="input-sponsor-logo" />
            </div>
            <div>
              <Label>Website URL</Label>
              <Input value={sponsorForm.websiteUrl} onChange={e => setSponsorForm(p => ({ ...p, websiteUrl: e.target.value }))} data-testid="input-sponsor-website" />
            </div>
            <div>
              <Label>Tier</Label>
              <Select value={sponsorForm.tier} onValueChange={v => setSponsorForm(p => ({ ...p, tier: v }))}>
                <SelectTrigger data-testid="select-sponsor-tier"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="title">Title</SelectItem>
                  <SelectItem value="presenting">Presenting</SelectItem>
                  <SelectItem value="gold">Gold</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="community">Community</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sort Order</Label>
              <Input type="number" value={sponsorForm.sortOrder} onChange={e => setSponsorForm(p => ({ ...p, sortOrder: e.target.value }))} data-testid="input-sponsor-sort" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSponsorDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveSponsor} disabled={!sponsorForm.name || createSponsor.isPending || updateSponsor.isPending} data-testid="button-save-sponsor">
              {(createSponsor.isPending || updateSponsor.isPending) ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {editingSponsor ? "Update" : "Add"} Sponsor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showBonusDialog} onOpenChange={setShowBonusDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingBonus ? "Edit Bonus Action" : "Add Bonus Action"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Type</Label>
              <Select value={bonusForm.bonusType} onValueChange={v => setBonusForm(p => ({ ...p, bonusType: v }))}>
                <SelectTrigger data-testid="select-bonus-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="share_social">Share on Social</SelectItem>
                  <SelectItem value="refer_friend">Refer a Friend</SelectItem>
                  <SelectItem value="visit_page">Visit Page</SelectItem>
                  <SelectItem value="watch_video">Watch Video</SelectItem>
                  <SelectItem value="follow_social">Follow Social</SelectItem>
                  <SelectItem value="newsletter_signup">Newsletter Signup</SelectItem>
                  <SelectItem value="download_app">Download App</SelectItem>
                  <SelectItem value="visit_sponsor">Visit Sponsor</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Label</Label>
              <Input value={bonusForm.label} onChange={e => setBonusForm(p => ({ ...p, label: e.target.value }))} data-testid="input-bonus-label" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={bonusForm.description} onChange={e => setBonusForm(p => ({ ...p, description: e.target.value }))} data-testid="input-bonus-description" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Bonus Entries</Label>
                <Input type="number" value={bonusForm.bonusAmount} onChange={e => setBonusForm(p => ({ ...p, bonusAmount: e.target.value }))} data-testid="input-bonus-amount" />
              </div>
              <div>
                <Label>Sort Order</Label>
                <Input type="number" value={bonusForm.sortOrder} onChange={e => setBonusForm(p => ({ ...p, sortOrder: e.target.value }))} data-testid="input-bonus-sort" />
              </div>
            </div>
            <div>
              <Label>Action URL</Label>
              <Input value={bonusForm.actionUrl} onChange={e => setBonusForm(p => ({ ...p, actionUrl: e.target.value }))} placeholder="https://..." data-testid="input-bonus-url" />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={bonusForm.isActive} onCheckedChange={v => setBonusForm(p => ({ ...p, isActive: v }))} data-testid="switch-bonus-active" />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBonusDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveBonusAction} disabled={!bonusForm.label || createBonusAction.isPending || updateBonusAction.isPending} data-testid="button-save-bonus">
              {(createBonusAction.isPending || updateBonusAction.isPending) ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {editingBonus ? "Update" : "Add"} Bonus Action
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDrawDialog} onOpenChange={setShowDrawDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run Draw</DialogTitle>
            <DialogDescription>Select winners from eligible entries</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Number of Winners</Label>
              <Input type="number" value={drawForm.winnerCount} onChange={e => setDrawForm(p => ({ ...p, winnerCount: e.target.value }))} min="1" data-testid="input-draw-winner-count" />
            </div>
            <div>
              <Label>Prize (optional)</Label>
              <Select value={drawForm.prizeId || "_none"} onValueChange={v => setDrawForm(p => ({ ...p, prizeId: v === "_none" ? "" : v }))}>
                <SelectTrigger data-testid="select-draw-prize"><SelectValue placeholder="No specific prize" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">No specific prize</SelectItem>
                  {(prizesQuery.data || []).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDrawDialog(false)}>Cancel</Button>
            <Button onClick={() => executeDraw.mutate({
              winnerCount: parseInt(drawForm.winnerCount) || 1,
              prizeId: drawForm.prizeId || undefined,
            })} disabled={executeDraw.isPending} data-testid="button-execute-draw">
              {executeDraw.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Dices className="w-4 h-4 mr-1" />}
              Execute Draw
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CrossGiveawayEntriesView({ cityId }: { cityId: string }) {
  const [selectedGw, setSelectedGw] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const giveawaysQuery = useQuery<EnrichedGiveaway[]>({
    queryKey: ["/api/admin/giveaways", cityId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/giveaways?cityId=${cityId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!cityId,
  });

  const entriesQuery = useQuery<{ data: GiveawayEntry[]; total: number }>({
    queryKey: ["/api/admin/giveaways", selectedGw, "entries"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/giveaways/${selectedGw}/entries?limit=500`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!selectedGw,
  });

  const entries = (entriesQuery.data?.data || []).filter(e => {
    if (!searchTerm) return true;
    const lc = searchTerm.toLowerCase();
    return e.name.toLowerCase().includes(lc) || e.email.toLowerCase().includes(lc);
  });

  if (giveawaysQuery.isError) {
    return <QueryError message="Failed to load giveaways" onRetry={() => giveawaysQuery.refetch()} />;
  }

  return (
    <div className="space-y-4" data-testid="cross-entries-view">
      <div>
        <h2 className="text-xl font-bold">All Entries</h2>
        <p className="text-sm text-muted-foreground">View entries across all giveaways</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={selectedGw || "_select"} onValueChange={v => setSelectedGw(v === "_select" ? "" : v)}>
          <SelectTrigger className="w-64" data-testid="select-entries-giveaway">
            <SelectValue placeholder="Select a giveaway" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_select">Select a giveaway</SelectItem>
            {(giveawaysQuery.data || []).map(gw => (
              <SelectItem key={gw.id} value={gw.id}>{gw.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedGw && (
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by name or email..."
              className="pl-9"
              data-testid="input-search-entries"
            />
          </div>
        )}
        {selectedGw && entries.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => {
            downloadCsv("entries-export.csv",
              ["Name", "Email", "Method", "Total Entries", "Verified", "Disqualified", "Date"],
              entries.map(e => [e.name, e.email, e.entryMethod, String(e.totalEntries), e.isVerified ? "Yes" : "No", e.isDisqualified ? "Yes" : "No", formatDate(e.createdAt as string)])
            );
          }} data-testid="button-export-all-entries">
            <Download className="w-4 h-4 mr-1" /> Export CSV
          </Button>
        )}
      </div>

      {!selectedGw ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">Select a giveaway to view entries</p>
          </CardContent>
        </Card>
      ) : entriesQuery.isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : entries.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-zinc-500">No entries found</CardContent></Card>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{entries.length} entries</p>
          {entries.map(entry => (
            <Card key={entry.id} data-testid={`card-cross-entry-${entry.id}`} className={entry.isDisqualified ? "border-red-200 dark:border-red-900" : ""}>
              <CardContent className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {entry.name}
                    {entry.isVerified && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
                    {entry.isDisqualified && <Ban className="w-3.5 h-3.5 text-red-500" />}
                  </div>
                  <div className="text-sm text-zinc-500">{entry.email}</div>
                  <div className="text-xs text-zinc-400 mt-0.5">
                    {entry.entryMethod} | {entry.totalEntries} total entries | {formatDate(entry.createdAt as string)}
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">{entry.entryMethod}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function DrawCenterView({ cityId }: { cityId: string }) {
  const { toast } = useToast();
  const [selectedGw, setSelectedGw] = useState("");
  const [showDrawDialog, setShowDrawDialog] = useState(false);
  const [drawForm, setDrawForm] = useState({ winnerCount: "1", prizeId: "" });
  const [wheelMode, setWheelMode] = useState(false);
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [wheelWinnerId, setWheelWinnerId] = useState<string | null>(null);
  const [wheelEntries, setWheelEntries] = useState<Array<{ id: string; label: string }>>([]);
  const pendingWinnersRef = useRef<Array<{ entry: { id: string; name: string } }>>([]);
  const [spinIndex, setSpinIndex] = useState(0);
  const [spinTotal, setSpinTotal] = useState(0);

  const giveawaysQuery = useQuery<EnrichedGiveaway[]>({
    queryKey: ["/api/admin/giveaways", cityId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/giveaways?cityId=${cityId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!cityId,
  });

  const drawsQuery = useQuery<GiveawayDraw[]>({
    queryKey: ["/api/admin/giveaways", selectedGw, "draws"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/giveaways/${selectedGw}/draws`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!selectedGw,
  });

  const prizesQuery = useQuery<GiveawayPrize[]>({
    queryKey: ["/api/admin/giveaways", selectedGw, "prizes"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/giveaways/${selectedGw}/prizes`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!selectedGw,
  });

  const winnersQuery = useQuery<(GiveawayWinner & { entry?: GiveawayEntry; prize?: GiveawayPrize | null })[]>({
    queryKey: ["/api/admin/giveaways", selectedGw, "winners"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/giveaways/${selectedGw}/winners`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!selectedGw,
  });

  const executeDraw = useMutation({
    mutationFn: async (data: Record<string, unknown> & { _wheelEntries?: Array<{ id: string; label: string }> }) => {
      const { _wheelEntries, ...drawData } = data;
      const res = await apiRequest("POST", `/api/admin/giveaways/${selectedGw}/draw`, drawData);
      const result = await res.json();
      return { ...result, _wheelEntries };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/giveaways", selectedGw] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/giveaways/summary"] });

      if (wheelMode && result.winners && result.winners.length > 0) {
        const prebuiltEntries: Array<{ id: string; label: string }> = result._wheelEntries || [];
        const allWinners = result.winners.filter((w: { entry?: { id: string; name: string } }) => w.entry);
        if (allWinners.length > 0 && prebuiltEntries.length > 0) {
          for (const w of allWinners) {
            if (!prebuiltEntries.find((e: { id: string }) => e.id === w.entry.id)) {
              prebuiltEntries.push({ id: w.entry.id, label: w.entry.name });
            }
          }
          pendingWinnersRef.current = allWinners.slice(1);
          setSpinIndex(1);
          setSpinTotal(allWinners.length);
          setWheelEntries(prebuiltEntries);
          setWheelWinnerId(allWinners[0].entry.id);
          setWheelSpinning(true);
        } else {
          toast({ title: "Draw executed successfully" });
        }
      } else {
        setShowDrawDialog(false);
        toast({ title: "Draw executed successfully" });
      }
    },
    onError: (err: Error) => toast({ title: "Draw failed", description: err.message, variant: "destructive" }),
  });

  const handleWheelComplete = useCallback((entry: { id: string; label: string }) => {
    setWheelSpinning(false);
    toast({ title: `Winner ${spinIndex} of ${spinTotal}: ${entry.label}!` });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/giveaways", selectedGw, "winners"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/giveaways", selectedGw, "draws"] });

    if (pendingWinnersRef.current.length > 0) {
      const next = pendingWinnersRef.current[0];
      pendingWinnersRef.current = pendingWinnersRef.current.slice(1);
      setSpinIndex(prev => prev + 1);
      setWheelEntries(prev => prev.filter(e => e.id !== entry.id));
      setTimeout(() => {
        setWheelWinnerId(next.entry.id);
        setWheelSpinning(true);
      }, 2000);
    }
  }, [selectedGw, toast, spinIndex, spinTotal]);

  const activeGws = (giveawaysQuery.data || []).filter(g => g.status === "active" || g.status === "drawing");

  if (giveawaysQuery.isError) {
    return <QueryError message="Failed to load giveaways" onRetry={() => giveawaysQuery.refetch()} />;
  }

  return (
    <div className="space-y-4" data-testid="draw-center-view">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Draw Center</h2>
          <p className="text-sm text-muted-foreground">Execute draws and manage winner selection</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Select value={selectedGw || "_select"} onValueChange={v => setSelectedGw(v === "_select" ? "" : v)}>
          <SelectTrigger className="w-64" data-testid="select-draw-giveaway">
            <SelectValue placeholder="Select a giveaway" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_select">Select a giveaway</SelectItem>
            {(giveawaysQuery.data || []).map(gw => (
              <SelectItem key={gw.id} value={gw.id}>{gw.title} ({gw.status})</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedGw && (
          <Button onClick={() => {
            setDrawForm({ winnerCount: "1", prizeId: "" });
            setShowDrawDialog(true);
          }} data-testid="button-new-draw">
            <Dices className="w-4 h-4 mr-1" /> Run Draw
          </Button>
        )}
      </div>

      {activeGws.length > 0 && !selectedGw && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Ready for Drawing</h3>
          {activeGws.map(gw => (
            <Card key={gw.id} className="cursor-pointer hover:ring-1 hover:ring-ring transition-shadow" onClick={() => setSelectedGw(gw.id)} data-testid={`card-ready-gw-${gw.id}`}>
              <CardContent className="py-4 flex items-center justify-between">
                <div>
                  <div className="font-medium">{gw.title}</div>
                  <div className="text-sm text-muted-foreground">{gw.entryCount ?? 0} entries</div>
                </div>
                <Badge className={STATUS_COLORS[gw.status] || ""}>{gw.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedGw && (
        <>
          {drawsQuery.isLoading ? <Skeleton className="h-24" /> : (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Draw History</h3>
              {(drawsQuery.data || []).length === 0 ? (
                <Card><CardContent className="py-6 text-center text-zinc-500">No draws executed yet</CardContent></Card>
              ) : (drawsQuery.data || []).map(draw => (
                <Card key={draw.id} data-testid={`card-dc-draw-${draw.id}`}>
                  <CardContent className="py-3">
                    <div className="font-medium">Draw #{draw.drawNumber}</div>
                    <div className="text-sm text-zinc-500">
                      {draw.drawMethod} | {draw.totalEligible} eligible | {draw.winnersSelected} selected | {formatDate(draw.createdAt as string)}
                    </div>
                    {draw.seed && <div className="text-xs text-zinc-400 font-mono mt-1">Seed: {draw.seed}</div>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {winnersQuery.isLoading ? <Skeleton className="h-24" /> : (winnersQuery.data || []).length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Winners from this giveaway ({(winnersQuery.data || []).length})</h3>
              {(winnersQuery.data || []).map(winner => (
                <Card key={winner.id} data-testid={`card-dc-winner-${winner.id}`}>
                  <CardContent className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-amber-500" />
                      <div>
                        <div className="font-medium">{winner.entry?.name || "Unknown"}</div>
                        <div className="text-sm text-zinc-500">{winner.entry?.email}</div>
                        {winner.prize?.name && <div className="text-xs text-zinc-400">Prize: {winner.prize.name}</div>}
                      </div>
                    </div>
                    <Badge className={WINNER_STATUS_COLORS[winner.status] || ""}>{winner.status}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {wheelMode && wheelEntries.length > 0 && (
        <Card className="overflow-hidden" data-testid="card-draw-wheel">
          <CardContent className="py-6 flex flex-col items-center gap-4">
            {spinTotal > 1 && (
              <p className="text-sm text-zinc-400 font-medium">
                Spin {spinIndex} of {spinTotal}
              </p>
            )}
            <DrawWheel
              entries={wheelEntries}
              winnerId={wheelWinnerId}
              spinning={wheelSpinning}
              onSpinComplete={handleWheelComplete}
              size={360}
            />
            {!wheelSpinning && wheelWinnerId && pendingWinnersRef.current.length === 0 && (
              <Button variant="outline" onClick={() => {
                setWheelWinnerId(null);
                setWheelEntries([]);
                setWheelMode(false);
                setShowDrawDialog(false);
                setSpinIndex(0);
                setSpinTotal(0);
              }} data-testid="button-close-wheel">
                Close Wheel
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={showDrawDialog} onOpenChange={v => { if (!wheelSpinning) setShowDrawDialog(v); }}>
        <DialogContent className={wheelMode ? "max-w-2xl" : ""}>
          <DialogHeader>
            <DialogTitle>Run Draw</DialogTitle>
            <DialogDescription>Select winners from eligible entries</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Switch checked={wheelMode} onCheckedChange={setWheelMode} data-testid="switch-wheel-mode" />
              <Label>Visual Wheel Mode</Label>
            </div>
            <div>
              <Label>Number of Winners</Label>
              <Input type="number" value={drawForm.winnerCount} onChange={e => setDrawForm(p => ({ ...p, winnerCount: e.target.value }))} min="1" max={wheelMode ? "10" : undefined} data-testid="input-dc-winner-count" />
              {wheelMode && parseInt(drawForm.winnerCount) > 1 && (
                <p className="text-xs text-zinc-500 mt-1">Wheel will spin {drawForm.winnerCount} times, removing each winner after selection</p>
              )}
            </div>
            <div>
              <Label>Prize (optional)</Label>
              <Select value={drawForm.prizeId || "_none"} onValueChange={v => setDrawForm(p => ({ ...p, prizeId: v === "_none" ? "" : v }))}>
                <SelectTrigger data-testid="select-dc-prize"><SelectValue placeholder="No specific prize" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">No specific prize</SelectItem>
                  {(prizesQuery.data || []).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDrawDialog(false)}>Cancel</Button>
            {wheelMode && (
              <Button variant="outline" onClick={async () => {
                setShowDrawDialog(false);
                try {
                  const res = await fetch(`/api/admin/giveaways/${selectedGw}/entries?limit=20`, { credentials: "include" });
                  if (!res.ok) return;
                  const json = await res.json();
                  const eligible = (json.data || []).filter((e: GiveawayEntry) => !e.isDisqualified);
                  if (eligible.length < 2) return;
                  const testEntries = eligible.slice(0, 20).map((e: GiveawayEntry) => ({ id: e.id, label: e.name }));
                  const randomIdx = Math.floor(Math.random() * testEntries.length);
                  setWheelEntries(testEntries);
                  setWheelWinnerId(testEntries[randomIdx].id);
                  setWheelSpinning(true);
                } catch {}
              }} data-testid="button-dc-test-spin">
                Test Spin
              </Button>
            )}
            <Button onClick={async () => {
              setShowDrawDialog(false);
              const mutData: Record<string, unknown> = {
                winnerCount: parseInt(drawForm.winnerCount) || 1,
                prizeId: drawForm.prizeId || undefined,
              };
              if (wheelMode) {
                try {
                  const res = await fetch(`/api/admin/giveaways/${selectedGw}/entries?limit=200`, { credentials: "include" });
                  if (res.ok) {
                    const json = await res.json();
                    const eligible = (json.data || []).filter((e: GiveawayEntry) => !e.isDisqualified);
                    mutData._wheelEntries = eligible.slice(0, 20).map((e: GiveawayEntry) => ({ id: e.id, label: e.name }));
                  }
                } catch {}
              }
              executeDraw.mutate(mutData);
            }} disabled={executeDraw.isPending} data-testid="button-dc-execute-draw">
              {executeDraw.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : wheelMode ? <Play className="w-4 h-4 mr-1" /> : <Dices className="w-4 h-4 mr-1" />}
              {wheelMode ? "Spin the Wheel" : "Execute Draw"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CrossGiveawayWinnersView({ cityId }: { cityId: string }) {
  const { toast } = useToast();
  const [selectedGw, setSelectedGw] = useState("");

  const giveawaysQuery = useQuery<EnrichedGiveaway[]>({
    queryKey: ["/api/admin/giveaways", cityId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/giveaways?cityId=${cityId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!cityId,
  });

  const winnersQuery = useQuery<(GiveawayWinner & { entry?: GiveawayEntry; prize?: GiveawayPrize | null })[]>({
    queryKey: ["/api/admin/giveaways", selectedGw, "winners"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/giveaways/${selectedGw}/winners`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!selectedGw,
  });

  const updateWinnerStatus = useMutation({
    mutationFn: async ({ winnerId, status }: { winnerId: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/giveaways/${selectedGw}/winners/${winnerId}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/giveaways", selectedGw, "winners"] });
      toast({ title: "Winner status updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const notifyWinners = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/giveaways/${selectedGw}/notify-winners`);
      return res.json();
    },
    onSuccess: (data: { notified: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/giveaways", selectedGw, "winners"] });
      toast({ title: `${data.notified} winner(s) notified` });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const winners = winnersQuery.data || [];

  if (giveawaysQuery.isError) {
    return <QueryError message="Failed to load giveaways" onRetry={() => giveawaysQuery.refetch()} />;
  }

  return (
    <div className="space-y-4" data-testid="cross-winners-view">
      <div>
        <h2 className="text-xl font-bold">Winners</h2>
        <p className="text-sm text-muted-foreground">View and manage winners across giveaways</p>
      </div>

      <div className="flex items-center gap-3">
        <Select value={selectedGw || "_select"} onValueChange={v => setSelectedGw(v === "_select" ? "" : v)}>
          <SelectTrigger className="w-64" data-testid="select-winners-giveaway">
            <SelectValue placeholder="Select a giveaway" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_select">Select a giveaway</SelectItem>
            {(giveawaysQuery.data || []).map(gw => (
              <SelectItem key={gw.id} value={gw.id}>{gw.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedGw && winners.some(w => w.status === "pending") && (
          <Button variant="outline" size="sm" onClick={() => notifyWinners.mutate()} disabled={notifyWinners.isPending} data-testid="button-notify-all-winners">
            <Mail className="w-4 h-4 mr-1" /> Notify Pending Winners
          </Button>
        )}
        {selectedGw && winners.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => {
            downloadCsv("winners-export.csv",
              ["Name", "Email", "Prize", "Status", "Date"],
              winners.map(w => [w.entry?.name || "", w.entry?.email || "", w.prize?.name || "N/A", w.status, formatDate(w.createdAt)])
            );
          }} data-testid="button-export-winners">
            <Download className="w-4 h-4 mr-1" /> Export
          </Button>
        )}
      </div>

      {!selectedGw ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Trophy className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">Select a giveaway to view winners</p>
          </CardContent>
        </Card>
      ) : winnersQuery.isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : winners.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-zinc-500">No winners yet for this giveaway</CardContent></Card>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-3 text-sm text-muted-foreground">
            <span>{winners.length} total</span>
            <span>{winners.filter(w => w.status === "claimed").length} claimed</span>
            <span>{winners.filter(w => w.status === "pending").length} pending</span>
            <span>{winners.filter(w => w.status === "notified").length} notified</span>
          </div>
          {winners.map(winner => (
            <Card key={winner.id} data-testid={`card-cross-winner-${winner.id}`}>
              <CardContent className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                  <div>
                    <div className="font-medium">{winner.entry?.name || "Unknown"}</div>
                    <div className="text-sm text-zinc-500">{winner.entry?.email}</div>
                    {winner.prize?.name && <div className="text-xs text-zinc-400 mt-0.5">Prize: {winner.prize.name}</div>}
                    <div className="text-xs text-zinc-400">{formatDate(winner.createdAt as string)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={WINNER_STATUS_COLORS[winner.status] || ""}>{winner.status}</Badge>
                  <Select value={winner.status} onValueChange={v => updateWinnerStatus.mutate({ winnerId: winner.id, status: v })}>
                    <SelectTrigger className="w-28" data-testid={`select-cw-status-${winner.id}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="notified">Notified</SelectItem>
                      <SelectItem value="claimed">Claimed</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                      <SelectItem value="disqualified">Disqualified</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ReportsView({ cityId }: { cityId: string }) {
  const summaryQuery = useQuery<GiveawaySummary>({
    queryKey: ["/api/admin/giveaways/summary", cityId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/giveaways/summary?cityId=${cityId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load summary");
      return res.json();
    },
    enabled: !!cityId,
  });

  const giveawaysQuery = useQuery<EnrichedGiveaway[]>({
    queryKey: ["/api/admin/giveaways", cityId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/giveaways?cityId=${cityId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!cityId,
  });

  const s = summaryQuery.data;

  if (summaryQuery.isError) {
    return <QueryError message="Failed to load report data" onRetry={() => summaryQuery.refetch()} />;
  }

  return (
    <div className="space-y-6" data-testid="reports-view">
      <div>
        <h2 className="text-xl font-bold">Reports</h2>
        <p className="text-sm text-muted-foreground">Giveaway performance and export tools</p>
      </div>

      {summaryQuery.isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : s && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card data-testid="card-report-giveaways">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground mb-1">Total Giveaways</div>
                <div className="text-2xl font-bold">{s.totalGiveaways}</div>
              </CardContent>
            </Card>
            <Card data-testid="card-report-entries">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground mb-1">Total Entries</div>
                <div className="text-2xl font-bold">{s.totalEntries}</div>
              </CardContent>
            </Card>
            <Card data-testid="card-report-winners">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground mb-1">Total Winners</div>
                <div className="text-2xl font-bold">{s.totalWinners}</div>
              </CardContent>
            </Card>
            <Card data-testid="card-report-draws">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground mb-1">Draws Executed</div>
                <div className="text-2xl font-bold">{s.totalDraws}</div>
              </CardContent>
            </Card>
          </div>

          <Card data-testid="card-giveaway-table">
            <CardHeader><CardTitle className="text-base">Giveaway Performance</CardTitle></CardHeader>
            <CardContent>
              {(giveawaysQuery.data || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No giveaways to report on</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-2 font-medium">Name</th>
                        <th className="pb-2 font-medium">Status</th>
                        <th className="pb-2 font-medium text-right">Entries</th>
                        <th className="pb-2 font-medium text-right">Prizes</th>
                        <th className="pb-2 font-medium text-right">Sponsors</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(giveawaysQuery.data || []).map(gw => (
                        <tr key={gw.id} className="border-b last:border-0" data-testid={`row-report-${gw.id}`}>
                          <td className="py-2">{gw.title}</td>
                          <td className="py-2"><Badge className={`${STATUS_COLORS[gw.status] || ""} text-xs`}>{gw.status}</Badge></td>
                          <td className="py-2 text-right">{gw.entryCount ?? 0}</td>
                          <td className="py-2 text-right">{gw.prizeCount ?? 0}</td>
                          <td className="py-2 text-right">{gw.sponsorCount ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {(giveawaysQuery.data || []).length > 0 && (
            <Button variant="outline" onClick={() => {
              const gws = giveawaysQuery.data || [];
              downloadCsv("giveaways-report.csv",
                ["Title", "Status", "Entries", "Prizes", "Sponsors", "Created", "Starts", "Ends"],
                gws.map(gw => [
                  gw.title, gw.status,
                  String(gw.entryCount ?? 0),
                  String(gw.prizeCount ?? 0),
                  String(gw.sponsorCount ?? 0),
                  formatDate(gw.createdAt),
                  formatDate(gw.startsAt),
                  formatDate(gw.endsAt),
                ])
              );
            }} data-testid="button-export-report">
              <Download className="w-4 h-4 mr-1" /> Export Full Report
            </Button>
          )}
        </>
      )}
    </div>
  );
}

function SettingsView() {
  return (
    <div className="space-y-6" data-testid="settings-view">
      <div>
        <h2 className="text-xl font-bold">Giveaway Settings</h2>
        <p className="text-sm text-muted-foreground">Global defaults and configuration for all giveaways</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card data-testid="card-default-settings">
          <CardHeader><CardTitle className="text-base">Default Entry Settings</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Switch defaultChecked data-testid="switch-default-verified" />
              <Label>Require Verified Email by Default</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch data-testid="switch-default-zipcode" />
              <Label>Require ZIP Code by Default</Label>
            </div>
            <div>
              <Label>Default Max Entries Per User</Label>
              <Input type="number" defaultValue="1" className="mt-1" data-testid="input-default-max-per-user" />
            </div>
            <div>
              <Label>Default Draw Method</Label>
              <Select defaultValue="random">
                <SelectTrigger data-testid="select-default-draw-method"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="random">Random</SelectItem>
                  <SelectItem value="weighted">Weighted</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-notification-settings">
          <CardHeader><CardTitle className="text-base">Notification Settings</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Switch defaultChecked data-testid="switch-auto-notify" />
              <Label>Auto-notify winners after draw</Label>
            </div>
            <div>
              <Label>Winner Claim Window (days)</Label>
              <Input type="number" defaultValue="7" className="mt-1" data-testid="input-claim-window" />
            </div>
            <div className="flex items-center gap-3">
              <Switch defaultChecked data-testid="switch-confirmation-email" />
              <Label>Send entry confirmation emails</Label>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-display-settings">
          <CardHeader><CardTitle className="text-base">Public Display</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Switch defaultChecked data-testid="switch-show-entry-count" />
              <Label>Show entry count on public page</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch defaultChecked data-testid="switch-show-countdown" />
              <Label>Show countdown timer</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch data-testid="switch-show-winners-public" />
              <Label>Show winner names publicly</Label>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-compliance-settings">
          <CardHeader><CardTitle className="text-base">Compliance</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Switch defaultChecked data-testid="switch-require-rules" />
              <Label>Require rules acceptance</Label>
            </div>
            <div>
              <Label>Minimum Age</Label>
              <Input type="number" defaultValue="18" className="mt-1" data-testid="input-min-age" />
            </div>
            <div>
              <Label>Default Rules Template</Label>
              <Textarea rows={3} placeholder="Enter default rules text..." className="mt-1" data-testid="input-default-rules" />
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">Settings are applied as defaults when creating new giveaways. Changes do not affect existing giveaways.</p>
    </div>
  );
}

export default function GiveawayAdmin({ selectedCityId, initialTab = "dashboard" }: GiveawayAdminProps) {
  const cityId = useDefaultCityId() || selectedCityId;
  const [activeView, setActiveView] = useState(initialTab);
  const [selectedGiveawayId, setSelectedGiveawayId] = useState<string | null>(null);

  function handleSelectGiveaway(gw: EnrichedGiveaway) {
    setSelectedGiveawayId(gw.id);
    setActiveView("detail");
  }

  if (activeView === "detail" && selectedGiveawayId) {
    return (
      <GiveawayDetailView
        giveawayId={selectedGiveawayId}
        cityId={cityId}
        onBack={() => {
          setSelectedGiveawayId(null);
          setActiveView("list");
        }}
      />
    );
  }

  switch (activeView) {
    case "dashboard":
      return <DashboardView cityId={cityId} />;
    case "list":
      return <GiveawayListView cityId={cityId} onSelectGiveaway={handleSelectGiveaway} />;
    case "entries":
      return <CrossGiveawayEntriesView cityId={cityId} />;
    case "draws":
      return <DrawCenterView cityId={cityId} />;
    case "winners":
      return <CrossGiveawayWinnersView cityId={cityId} />;
    case "reports":
      return <ReportsView cityId={cityId} />;
    case "settings":
      return <SettingsView />;
    default:
      return <DashboardView cityId={cityId} />;
  }
}
