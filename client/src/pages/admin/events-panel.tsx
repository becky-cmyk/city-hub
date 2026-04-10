import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Edit, Trash2, Star, Calendar, MapPin, Search, Building2, Store,
  ChevronDown, ChevronUp, Languages, Send, Shield, Loader2, Wand2,
  BarChart3, ListFilter, CalendarDays, Eye, Ticket, FileText,
  Users, AlertTriangle, Image, CheckCircle2, XCircle, Archive,
  ExternalLink, Ban, Newspaper, Clock, Share2, CalendarIcon, Link2, Repeat, Globe,
  Download, Mail, RotateCcw, Info, Trophy, Gift, Code, MessageCircle, Zap
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import type { Event, Zone, Business } from "@shared/schema";
import { useDefaultCityId, useAdminCitySelection } from "@/hooks/use-city";
import { EventSponsorsTab, EventVendorsTab } from "@/components/event-sponsors-vendors-panel";
import { EventCaptureSection } from "./field-captures-panel";
import { format } from "date-fns";

interface AdminEvent extends Event {
  lifecycleStatus?: string;
  lifecycle_status?: string;
  eventClaimStatus?: string;
  event_claim_status?: string;
  viewCount?: number;
  view_count?: number;
  rsvpCount?: number;
  rsvp_count?: number;
  outboundTicketClicks?: number;
  outbound_ticket_clicks?: number;
  visibility?: string;
  latitude?: string | number | null;
  longitude?: string | number | null;
  aiGapFlags?: string[];
  ai_gap_flags?: string[];
  eventSeriesId?: string | null;
  event_series_id?: string | null;
  citySlug?: string | null;
  city_slug?: string | null;
}

interface AdminTicketType {
  id: string;
  eventId: string;
  name: string;
  priceDisplay?: string | null;
  price_display?: string | null;
  quantity?: number | null;
  externalCheckoutUrl?: string | null;
  external_checkout_url?: string | null;
  quantitySold?: number | null;
  quantity_sold?: number | null;
  saleStartAt?: string | null;
  sale_start_at?: string | null;
  saleEndAt?: string | null;
  sale_end_at?: string | null;
  isActive?: boolean;
  is_active?: boolean;
  sortOrder?: number;
  sort_order?: number;
}

interface AdminMention {
  id: string;
  eventId: string;
  title: string;
  url: string;
  sourceName?: string | null;
  source_name?: string | null;
  publishedAt?: string | null;
  published_at?: string | null;
}

interface AdminRssSuppression {
  id: string;
  sourceName?: string | null;
  source_name?: string | null;
  sourcePattern?: string | null;
  source_pattern?: string | null;
  titlePattern?: string | null;
  title_pattern?: string | null;
  reason?: string | null;
  cityId?: string | null;
  city_id?: string | null;
  createdAt?: string;
  created_at?: string;
}

interface AdminRsvp {
  id: string;
  name?: string | null;
  email?: string | null;
  response: string;
  created_at?: string;
  createdAt?: string;
}

function formatDateTime(dt: string | Date | null | undefined): string {
  if (!dt) return "";
  const d = new Date(dt);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function toInputDateTime(dt: string | Date | null | undefined): string {
  if (!dt) return "";
  const d = new Date(dt);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const LIFECYCLE_STATUSES = [
  { value: "draft", label: "Draft", color: "text-gray-500 border-gray-300 bg-gray-50 dark:bg-gray-900" },
  { value: "under_review", label: "Under Review", color: "text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-900/20" },
  { value: "published", label: "Published", color: "text-blue-600 border-blue-300 bg-blue-50 dark:bg-blue-900/20" },
  { value: "live", label: "Live", color: "text-green-600 border-green-300 bg-green-50 dark:bg-green-900/20" },
  { value: "completed", label: "Completed", color: "text-purple-600 border-purple-300 bg-purple-50 dark:bg-purple-900/20" },
  { value: "canceled", label: "Canceled", color: "text-red-600 border-red-300 bg-red-50 dark:bg-red-900/20" },
  { value: "archived", label: "Archived", color: "text-gray-400 border-gray-200 bg-gray-50 dark:bg-gray-900" },
];

const CLAIM_STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; className: string }> = {
  UNCLAIMED: { label: "Unclaimed", variant: "outline", className: "text-gray-600 border-gray-300" },
  CLAIM_SENT: { label: "Invite Sent", variant: "outline", className: "text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/20" },
  CLAIMED: { label: "Claimed", variant: "outline", className: "text-green-600 border-green-300 bg-green-50 dark:bg-green-950/20" },
};

function EventForm({ event, zones, onClose }: { event?: Event; zones: Zone[]; onClose: () => void }) {
  const CITY_ID = useDefaultCityId();
  const { toast } = useToast();
  const [title, setTitle] = useState(event?.title || "");
  const [description, setDescription] = useState(event?.description || "");
  const [startDateTime, setStartDateTime] = useState(toInputDateTime(event?.startDateTime));
  const [endDateTime, setEndDateTime] = useState(toInputDateTime(event?.endDateTime));
  const [locationName, setLocationName] = useState(event?.locationName || "");
  const [address, setAddress] = useState(event?.address || "");
  const [zoneId, setZoneId] = useState(event?.zoneId || "");
  const [imageUrl, setImageUrl] = useState(event?.imageUrl || "");
  const [costText, setCostText] = useState(event?.costText || "");
  const [isFeatured, setIsFeatured] = useState(event?.isFeatured || false);
  const [hostBusinessId, setHostBusinessId] = useState(event?.hostBusinessId || "");
  const [visibility, setVisibility] = useState((event as Record<string, unknown>)?.visibility as string || "public");
  const [rsvpEnabled, setRsvpEnabled] = useState((event as Record<string, unknown>)?.rsvpEnabled as boolean || false);
  const [maxCapacity, setMaxCapacity] = useState((event as Record<string, unknown>)?.maxCapacity as string || "");
  const [lifecycleStatus, setLifecycleStatus] = useState((event as Record<string, unknown>)?.lifecycleStatus as string || "published");
  const [businessSearch, setBusinessSearch] = useState("");

  const { data: businesses } = useQuery<Business[]>({
    queryKey: ["/api/admin/businesses", { q: businessSearch }],
    enabled: businessSearch.length >= 2,
  });

  const { data: allBusinesses } = useQuery<Business[]>({
    queryKey: ["/api/admin/businesses"],
  });

  const selectedBusiness = useMemo(() => {
    if (!hostBusinessId) return null;
    return allBusinesses?.find((b) => b.id === hostBusinessId) || null;
  }, [hostBusinessId, allBusinesses]);

  const searchResults = useMemo(() => {
    if (!businessSearch || businessSearch.length < 2) return [];
    return (businesses || []).slice(0, 8);
  }, [businesses, businessSearch]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        title, description: description || null,
        startDateTime: startDateTime ? new Date(startDateTime).toISOString() : null,
        endDateTime: endDateTime ? new Date(endDateTime).toISOString() : null,
        locationName: locationName || null, address: address || null,
        imageUrl: imageUrl || null, costText: costText || null,
        isFeatured, cityId: CITY_ID, zoneId: zoneId || zones[0]?.id || CITY_ID,
        hostBusinessId: hostBusinessId || null, visibility, rsvpEnabled,
        maxCapacity: maxCapacity ? parseInt(String(maxCapacity)) : null,
        lifecycleStatus,
      };
      if (event) {
        await apiRequest("PATCH", `/api/admin/events/${event.id}`, payload);
      } else {
        await apiRequest("POST", `/api/admin/events`, payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events/command-center/overview"] });
      toast({ title: event ? "Event updated" : "Event created" });
      onClose();
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} data-testid="input-event-title" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Description</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} data-testid="input-event-description" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Start Date/Time</Label>
          <Input type="datetime-local" value={startDateTime} onChange={(e) => setStartDateTime(e.target.value)} data-testid="input-event-start" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">End Date/Time</Label>
          <Input type="datetime-local" value={endDateTime} onChange={(e) => setEndDateTime(e.target.value)} data-testid="input-event-end" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Location Name</Label>
          <Input value={locationName} onChange={(e) => setLocationName(e.target.value)} data-testid="input-event-location" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Address</Label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} data-testid="input-event-address" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Zone / Neighborhood</Label>
          <Select value={zoneId} onValueChange={setZoneId}>
            <SelectTrigger data-testid="select-event-zone"><SelectValue placeholder="Select zone..." /></SelectTrigger>
            <SelectContent>
              {zones.map((z) => (<SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Cost</Label>
          <Input value={costText} onChange={(e) => setCostText(e.target.value)} placeholder="Free, $10, etc." data-testid="input-event-cost" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Lifecycle Status</Label>
          <Select value={lifecycleStatus} onValueChange={setLifecycleStatus}>
            <SelectTrigger data-testid="select-event-lifecycle"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LIFECYCLE_STATUSES.map(s => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Image URL</Label>
        <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} data-testid="input-event-image" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Host Business / Organization</Label>
        {selectedBusiness && (
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary" className="gap-1"><Building2 className="h-3 w-3" />{selectedBusiness.name}</Badge>
            <Button size="sm" variant="ghost" onClick={() => setHostBusinessId("")} data-testid="button-clear-host">Clear</Button>
          </div>
        )}
        <div className="relative">
          <Input value={businessSearch} onChange={(e) => setBusinessSearch(e.target.value)} placeholder="Search businesses by name..." data-testid="input-event-host-search" />
          {searchResults.length > 0 && (
            <Card className="absolute z-50 w-full mt-1 divide-y max-h-48 overflow-y-auto">
              {searchResults.map((b) => (
                <button key={b.id} className="w-full text-left px-3 py-2 text-sm hover:bg-muted" onClick={() => { setHostBusinessId(b.id); setBusinessSearch(""); }} data-testid={`button-select-host-${b.id}`}>
                  <span className="font-medium">{b.name}</span>
                </button>
              ))}
            </Card>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Visibility</Label>
          <Select value={visibility} onValueChange={setVisibility}>
            <SelectTrigger data-testid="select-event-visibility"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="public">Public</SelectItem>
              <SelectItem value="unlisted">Unlisted</SelectItem>
              <SelectItem value="private">Private (Invite Only)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Max Capacity</Label>
          <Input type="number" value={maxCapacity} onChange={(e) => setMaxCapacity(e.target.value)} placeholder="Unlimited" data-testid="input-event-capacity" />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Switch checked={rsvpEnabled} onCheckedChange={setRsvpEnabled} id="event-rsvp" data-testid="switch-event-rsvp" />
          <Label htmlFor="event-rsvp" className="text-sm">Enable RSVP</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={isFeatured} onCheckedChange={setIsFeatured} id="event-featured" data-testid="switch-event-featured" />
          <Label htmlFor="event-featured" className="text-sm">Featured Event</Label>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose} data-testid="button-event-cancel">Cancel</Button>
        <Button onClick={() => saveMutation.mutate()} disabled={!title || !startDateTime || saveMutation.isPending} data-testid="button-event-save">
          {saveMutation.isPending ? "Saving..." : event ? "Update Event" : "Create Event"}
        </Button>
      </div>
    </div>
  );
}

function OverviewTab({ cityId }: { cityId: string }) {
  const { data: overview, isLoading } = useQuery<{
    kpis: { upcomingCount: number; unclaimedCount: number; draftCount: number; rsvpsThisWeek: number; capacityAlerts: number };
    actionItems: { missingImages: number; noTicketInfo: number };
    statusBreakdown: Record<string, number>;
  }>({
    queryKey: ["/api/admin/events/command-center/overview", cityId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      const resp = await fetch(`/api/admin/events/command-center/overview?${params}`, { credentials: "include" });
      if (!resp.ok) throw new Error("Failed to load");
      return resp.json();
    },
  });

  if (isLoading) return <div className="grid grid-cols-2 md:grid-cols-5 gap-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>;
  if (!overview) return null;

  const kpiCards = [
    { label: "Upcoming", value: overview.kpis.upcomingCount, icon: Calendar, color: "text-blue-600" },
    { label: "Unclaimed", value: overview.kpis.unclaimedCount, icon: Shield, color: "text-amber-600" },
    { label: "Drafts", value: overview.kpis.draftCount, icon: Edit, color: "text-gray-500" },
    { label: "RSVPs This Week", value: overview.kpis.rsvpsThisWeek, icon: Users, color: "text-green-600" },
    { label: "Capacity Alerts", value: overview.kpis.capacityAlerts, icon: AlertTriangle, color: "text-red-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {kpiCards.map((kpi) => (
          <Card key={kpi.label} className="p-4" data-testid={`kpi-${kpi.label.toLowerCase().replace(/\s+/g, "-")}`}>
            <div className="flex items-center gap-2 mb-2">
              <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              <span className="text-xs text-muted-foreground">{kpi.label}</span>
            </div>
            <p className="text-2xl font-bold">{kpi.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" data-testid="text-action-items-title">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Action Items
          </h3>
          <div className="space-y-2">
            {overview.actionItems.missingImages > 0 && (
              <div className="flex items-center justify-between text-sm p-2 rounded bg-amber-50 dark:bg-amber-950/20" data-testid="action-missing-images">
                <span className="flex items-center gap-2"><Image className="h-3.5 w-3.5 text-amber-500" /> Events missing images</span>
                <Badge variant="outline" className="text-amber-600">{overview.actionItems.missingImages}</Badge>
              </div>
            )}
            {overview.actionItems.noTicketInfo > 0 && (
              <div className="flex items-center justify-between text-sm p-2 rounded bg-amber-50 dark:bg-amber-950/20" data-testid="action-no-ticket">
                <span className="flex items-center gap-2"><Ticket className="h-3.5 w-3.5 text-amber-500" /> Events without ticket info</span>
                <Badge variant="outline" className="text-amber-600">{overview.actionItems.noTicketInfo}</Badge>
              </div>
            )}
            {overview.actionItems.missingImages === 0 && overview.actionItems.noTicketInfo === 0 && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" /> No action items
              </p>
            )}
          </div>
        </Card>
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" data-testid="text-status-breakdown">
            <BarChart3 className="h-4 w-4 text-purple-500" /> Status Breakdown
          </h3>
          <div className="space-y-1.5">
            {LIFECYCLE_STATUSES.map(s => {
              const count = overview.statusBreakdown[s.value] || 0;
              if (count === 0) return null;
              return (
                <div key={s.value} className="flex items-center justify-between text-sm" data-testid={`status-count-${s.value}`}>
                  <Badge variant="outline" className={`text-[10px] ${s.color}`}>{s.label}</Badge>
                  <span className="font-medium">{count}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

function PipelineTab({ cityId, zones, onEditEvent }: { cityId: string; zones: Zone[]; onEditEvent: (evt: Event) => void }) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterZone, setFilterZone] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: allEvents, isLoading } = useQuery<AdminEvent[]>({
    queryKey: ["/api/admin/events", cityId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      const resp = await fetch(`/api/admin/events?${params}`, { credentials: "include" });
      if (!resp.ok) throw new Error("Failed to load");
      return resp.json();
    },
  });

  const { data: allBusinesses } = useQuery<Business[]>({
    queryKey: ["/api/admin/businesses", cityId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      const resp = await fetch(`/api/admin/businesses?${params}`, { credentials: "include" });
      if (!resp.ok) throw new Error("Failed to load");
      return resp.json();
    },
  });

  const businessMap = useMemo(() => {
    const m = new Map<string, string>();
    allBusinesses?.forEach((b) => m.set(b.id, b.name));
    return m;
  }, [allBusinesses]);

  const zoneMap = useMemo(() => {
    const m = new Map<string, string>();
    zones?.forEach((z) => m.set(z.id, z.name));
    return m;
  }, [zones]);

  const filteredEvents = useMemo(() => {
    let list = allEvents || [];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((e) => e.title.toLowerCase().includes(q));
    }
    if (filterStatus !== "all") {
      list = list.filter((e) => (e.lifecycleStatus || e.lifecycle_status) === filterStatus);
    }
    if (filterZone !== "all") {
      list = list.filter((e) => e.zoneId === filterZone);
    }
    return list;
  }, [allEvents, search, filterStatus, filterZone]);

  const lifecycleMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/admin/events/${id}/lifecycle`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events/command-center/overview"] });
      toast({ title: "Status updated" });
    },
  });

  const bulkMutation = useMutation({
    mutationFn: async ({ action }: { action: string }) => {
      await apiRequest("POST", `/api/admin/events/bulk-action`, {
        eventIds: Array.from(selectedIds),
        action,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events/command-center/overview"] });
      setSelectedIds(new Set());
      toast({ title: "Bulk action completed" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/events/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events/command-center/overview"] });
      toast({ title: "Event deleted" });
    },
  });

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredEvents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEvents.map(e => e.id)));
    }
  };

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search events..." className="pl-9" data-testid="input-pipeline-search" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]" data-testid="select-pipeline-status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {LIFECYCLE_STATUSES.map(s => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={filterZone} onValueChange={setFilterZone}>
          <SelectTrigger className="w-[160px]" data-testid="select-pipeline-zone">
            <SelectValue placeholder="All zones" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Zones</SelectItem>
            {zones?.map((z) => (<SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 p-2 bg-muted rounded-lg" data-testid="bulk-actions-bar">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <Button size="sm" variant="outline" onClick={() => bulkMutation.mutate({ action: "publish" })} data-testid="button-bulk-publish">
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Publish
          </Button>
          <Button size="sm" variant="outline" onClick={() => bulkMutation.mutate({ action: "archive" })} data-testid="button-bulk-archive">
            <Archive className="h-3.5 w-3.5 mr-1" /> Archive
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} data-testid="button-bulk-clear">Clear</Button>
        </div>
      )}

      <div className="text-sm text-muted-foreground" data-testid="text-pipeline-count">{filteredEvents.length} event{filteredEvents.length !== 1 ? "s" : ""}</div>

      <div className="border rounded-lg overflow-hidden">
        <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-x-3 items-center px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
          <input type="checkbox" checked={selectedIds.size === filteredEvents.length && filteredEvents.length > 0} onChange={toggleSelectAll} className="h-3.5 w-3.5" data-testid="checkbox-select-all" />
          <span>Event</span>
          <span>Date</span>
          <span>Status</span>
          <span>Zone</span>
          <span>Actions</span>
        </div>
        <div className="divide-y max-h-[600px] overflow-y-auto">
          {filteredEvents.map((evt) => {
            const status = evt.lifecycleStatus || evt.lifecycle_status || "published";
            const statusConfig = LIFECYCLE_STATUSES.find(s => s.value === status);
            const claimStatus = (evt.eventClaimStatus || evt.event_claim_status || "") as string;
            return (
              <div key={evt.id} className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-x-3 items-center px-3 py-2.5 hover:bg-muted/30 text-sm" data-testid={`pipeline-row-${evt.id}`}>
                <input type="checkbox" checked={selectedIds.has(evt.id)} onChange={() => toggleSelect(evt.id)} className="h-3.5 w-3.5" data-testid={`checkbox-event-${evt.id}`} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{evt.title}</span>
                    {claimStatus && CLAIM_STATUS_CONFIG[claimStatus] && (
                      <Badge variant={CLAIM_STATUS_CONFIG[claimStatus].variant} className={`text-[9px] ${CLAIM_STATUS_CONFIG[claimStatus].className}`}>
                        <Shield className="h-2 w-2 mr-0.5" />{CLAIM_STATUS_CONFIG[claimStatus].label}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                    {evt.hostBusinessId && businessMap.get(evt.hostBusinessId) && (
                      <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{businessMap.get(evt.hostBusinessId)}</span>
                    )}
                    {evt.locationName && <span className="truncate max-w-[150px]">{evt.locationName}</span>}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(evt.startDateTime)}</span>
                <Select value={status} onValueChange={(val) => lifecycleMutation.mutate({ id: evt.id, status: val })}>
                  <SelectTrigger className="h-7 w-[120px] text-xs" data-testid={`select-lifecycle-${evt.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LIFECYCLE_STATUSES.map(s => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
                  </SelectContent>
                </Select>
                <Badge variant="outline" className="text-[10px] whitespace-nowrap">{zoneMap.get(evt.zoneId) || "—"}</Badge>
                <div className="flex items-center gap-0.5">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEditEvent(evt)} data-testid={`button-edit-${evt.id}`}>
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteMutation.mutate(evt.id)} data-testid={`button-delete-${evt.id}`}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
          {filteredEvents.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground" data-testid="text-no-pipeline-events">No events found</div>
          )}
        </div>
      </div>
    </div>
  );
}

function CalendarTab({ cityId, zones }: { cityId: string; zones: Zone[] }) {
  const [viewMonth, setViewMonth] = useState(new Date());

  const start = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const end = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0, 23, 59, 59);

  const { data: calendarEvents, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/events/calendar", cityId, start.toISOString(), end.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      params.set("start", start.toISOString());
      params.set("end", end.toISOString());
      const resp = await fetch(`/api/admin/events/calendar?${params}`, { credentials: "include" });
      if (!resp.ok) throw new Error("Failed to load");
      return resp.json();
    },
  });

  const eventsByDate = useMemo(() => {
    const map = new Map<string, any[]>();
    (calendarEvents || []).forEach(evt => {
      const dateKey = format(new Date(evt.start_date_time), "yyyy-MM-dd");
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(evt);
    });
    return map;
  }, [calendarEvents]);

  const daysInMonth = end.getDate();
  const startDay = start.getDay();
  const days = [];
  for (let i = 0; i < startDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  const prevMonth = () => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1));
  const nextMonth = () => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1));

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={prevMonth} data-testid="button-prev-month">&lt; Prev</Button>
        <h3 className="text-sm font-semibold" data-testid="text-calendar-month">{format(viewMonth, "MMMM yyyy")}</h3>
        <Button variant="ghost" size="sm" onClick={nextMonth} data-testid="button-next-month">Next &gt;</Button>
      </div>
      <div className="grid grid-cols-7 gap-px bg-muted rounded-lg overflow-hidden">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2 bg-background">{d}</div>
        ))}
        {days.map((day, i) => {
          if (day === null) return <div key={`blank-${i}`} className="min-h-[80px] bg-background" />;
          const dateKey = format(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day), "yyyy-MM-dd");
          const dayEvents = eventsByDate.get(dateKey) || [];
          const isToday = dateKey === format(new Date(), "yyyy-MM-dd");
          return (
            <div key={day} className={`min-h-[80px] bg-background p-1 ${isToday ? "ring-2 ring-primary ring-inset" : ""}`} data-testid={`calendar-day-${dateKey}`}>
              <span className={`text-xs font-medium ${isToday ? "text-primary" : "text-muted-foreground"}`}>{day}</span>
              <div className="space-y-0.5 mt-0.5">
                {dayEvents.slice(0, 3).map((evt: Record<string, string>) => {
                  const statusColor = evt.lifecycle_status === "draft" ? "bg-gray-300" : evt.lifecycle_status === "live" ? "bg-green-400" : "bg-blue-400";
                  return (
                    <div key={evt.id} className="flex items-center gap-1 text-[10px] leading-tight truncate" title={evt.title} data-testid={`calendar-event-${evt.id}`}>
                      <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${statusColor}`} />
                      <span className="truncate">{evt.title}</span>
                    </div>
                  );
                })}
                {dayEvents.length > 3 && (
                  <span className="text-[10px] text-muted-foreground">+{dayEvents.length - 3} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventDetailWorkspace({ event, onClose }: { event: AdminEvent; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState("basics");

  const { data: ticketTypes } = useQuery<AdminTicketType[]>({
    queryKey: ["/api/admin/events", event.id, "ticket-types"],
    queryFn: async () => {
      const resp = await fetch(`/api/admin/events/${event.id}/ticket-types`, { credentials: "include" });
      if (!resp.ok) return [];
      return resp.json();
    },
  });

  const { data: mentions } = useQuery<AdminMention[]>({
    queryKey: ["/api/admin/events", event.id, "mentions"],
    queryFn: async () => {
      const resp = await fetch(`/api/admin/events/${event.id}/mentions`, { credentials: "include" });
      if (!resp.ok) return [];
      return resp.json();
    },
  });

  const { data: rsvps } = useQuery<AdminRsvp[]>({
    queryKey: ["/api/admin/events", event.id, "rsvps"],
    queryFn: async () => {
      const resp = await fetch(`/api/admin/events/${event.id}/rsvps`, { credentials: "include" });
      if (!resp.ok) return [];
      return resp.json();
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold" data-testid="text-workspace-title">{event.title}</h3>
          <p className="text-xs text-muted-foreground">{formatDateTime(event.startDateTime)}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} data-testid="button-close-workspace">Close</Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="basics" className="text-xs" data-testid="tab-basics"><Edit className="h-3 w-3 mr-1" /> Basics</TabsTrigger>
          <TabsTrigger value="tickets" className="text-xs" data-testid="tab-tickets"><Ticket className="h-3 w-3 mr-1" /> Tickets</TabsTrigger>
          <TabsTrigger value="attendees" className="text-xs" data-testid="tab-attendees"><Users className="h-3 w-3 mr-1" /> Attendees</TabsTrigger>
          <TabsTrigger value="sponsors" className="text-xs" data-testid="tab-sponsors"><Star className="h-3 w-3 mr-1" /> Sponsors</TabsTrigger>
          <TabsTrigger value="vendors" className="text-xs" data-testid="tab-vendors"><Store className="h-3 w-3 mr-1" /> Vendors</TabsTrigger>
          <TabsTrigger value="mentions" className="text-xs" data-testid="tab-mentions"><Newspaper className="h-3 w-3 mr-1" /> Mentions</TabsTrigger>
          <TabsTrigger value="schedule" className="text-xs" data-testid="tab-schedule"><CalendarIcon className="h-3 w-3 mr-1" /> Schedule & Series</TabsTrigger>
          <TabsTrigger value="distribution" className="text-xs" data-testid="tab-distribution"><Share2 className="h-3 w-3 mr-1" /> Distribution</TabsTrigger>
          <TabsTrigger value="toolkit" className="text-xs" data-testid="tab-toolkit"><Zap className="h-3 w-3 mr-1" /> Toolkit</TabsTrigger>
          <TabsTrigger value="syndication" className="text-xs" data-testid="tab-syndication"><Globe className="h-3 w-3 mr-1" /> Syndication</TabsTrigger>
          <TabsTrigger value="drips" className="text-xs" data-testid="tab-drips"><Mail className="h-3 w-3 mr-1" /> Drip Campaigns</TabsTrigger>
          <TabsTrigger value="embed" className="text-xs" data-testid="tab-embed"><Code className="h-3 w-3 mr-1" /> Embed</TabsTrigger>
        </TabsList>

        <TabsContent value="basics" className="mt-4">
          <Card className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Status</p>
                <Badge variant="outline" className="text-xs">{event.lifecycleStatus || event.lifecycle_status || "published"}</Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Visibility</p>
                <span>{event.visibility || "public"}</span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Location</p>
                <span>{event.locationName || "—"}</span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Address</p>
                <span>{event.address || "—"}</span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Coordinates</p>
                <span>{event.latitude && event.longitude ? `${event.latitude}, ${event.longitude}` : "—"}</span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Cost</p>
                <span>{event.costText || "—"}</span>
              </div>
            </div>
            {event.description && <div><p className="text-xs text-muted-foreground mb-0.5">Description</p><p className="text-sm">{event.description}</p></div>}
            {event.imageUrl && <div><p className="text-xs text-muted-foreground mb-1">Image</p><img src={event.imageUrl} alt="" className="h-32 rounded-lg object-cover" /></div>}
            <div className="grid grid-cols-3 gap-3 pt-2 border-t">
              <div><p className="text-xs text-muted-foreground">Views</p><p className="text-lg font-bold">{event.viewCount || event.view_count || 0}</p></div>
              <div><p className="text-xs text-muted-foreground">RSVPs</p><p className="text-lg font-bold">{event.rsvpCount || event.rsvp_count || 0}</p></div>
              <div><p className="text-xs text-muted-foreground">Ticket Clicks</p><p className="text-lg font-bold">{event.outboundTicketClicks || event.outbound_ticket_clicks || 0}</p></div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="tickets" className="mt-4">
          <TicketTypesSection eventId={event.id} ticketTypes={ticketTypes || []} />
        </TabsContent>

        <TabsContent value="attendees" className="mt-4">
          <AttendeesTabContent eventId={event.id} rsvps={rsvps} />
        </TabsContent>

        <TabsContent value="sponsors" className="mt-4">
          <EventSponsorsTab eventId={event.id} apiPrefix="/api/admin" />
        </TabsContent>

        <TabsContent value="vendors" className="mt-4">
          <EventVendorsTab eventId={event.id} apiPrefix="/api/admin" />
        </TabsContent>

        <TabsContent value="mentions" className="mt-4">
          <MentionsSection eventId={event.id} mentions={mentions || []} />
        </TabsContent>

        <TabsContent value="schedule" className="mt-4">
          <ScheduleSeriesSection event={event} />
        </TabsContent>

        <TabsContent value="distribution" className="mt-4">
          <DistributionSection event={event} />
        </TabsContent>

        <TabsContent value="toolkit" className="mt-4">
          <OrganizerToolkitSection eventId={event.id} />
        </TabsContent>

        <TabsContent value="syndication" className="mt-4">
          <SyndicationSection eventId={event.id} />
        </TabsContent>

        <TabsContent value="drips" className="mt-4">
          <DripCampaignSection eventId={event.id} />
        </TabsContent>

        <TabsContent value="embed" className="mt-4">
          <EmbedWidgetSection eventId={event.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AttendeesTabContent({ eventId, rsvps }: { eventId: string; rsvps: AdminRsvp[] | undefined }) {
  const { toast } = useToast();

  const { data: attendees, isLoading: attendeesLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/events", eventId, "attendees"],
    queryFn: async () => {
      const resp = await fetch(`/api/admin/events/${eventId}/attendees`);
      if (!resp.ok) return [];
      return resp.json();
    },
    enabled: !!eventId,
  });

  const { data: waitlist } = useQuery<any[]>({
    queryKey: ["/api/admin/events", eventId, "waitlist"],
    queryFn: async () => {
      const resp = await fetch(`/api/admin/events/${eventId}/waitlist`);
      if (!resp.ok) return [];
      return resp.json();
    },
    enabled: !!eventId,
  });

  const { data: revenue } = useQuery<any>({
    queryKey: ["/api/admin/events", eventId, "revenue"],
    queryFn: async () => {
      const resp = await fetch(`/api/admin/events/${eventId}/revenue`);
      if (!resp.ok) return null;
      return resp.json();
    },
    enabled: !!eventId,
  });

  const [expandedAttendee, setExpandedAttendee] = useState<string | null>(null);

  const checkinMutation = useMutation({
    mutationFn: async (purchaseId: string) => {
      await apiRequest("POST", `/api/admin/events/${eventId}/attendees/${purchaseId}/checkin`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events", eventId, "attendees"] });
      toast({ title: "Checked in" });
    },
  });

  const refundMutation = useMutation({
    mutationFn: async (purchaseId: string) => {
      await apiRequest("POST", `/api/admin/events/${eventId}/attendees/${purchaseId}/refund`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events", eventId, "attendees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events", eventId, "revenue"] });
      toast({ title: "Refund processed" });
    },
    onError: (e: Error) => toast({ title: "Refund failed", description: e.message, variant: "destructive" }),
  });

  const notifyWaitlistMutation = useMutation({
    mutationFn: async (entryId: string) => {
      await apiRequest("POST", `/api/admin/events/${eventId}/waitlist/${entryId}/notify`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events", eventId, "waitlist"] });
      toast({ title: "Notification sent" });
    },
  });

  const handleExportCsv = () => {
    window.open(`/api/admin/events/${eventId}/attendees/csv`, "_blank");
  };

  const totalTickets = attendees?.length || 0;
  const checkedIn = attendees?.filter((a: any) => a.checkin_status === "checked_in").length || 0;

  return (
    <div className="space-y-4">
      {revenue && (
        <Card className="p-4" data-testid="card-event-revenue">
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-1"><BarChart3 className="h-3 w-3" /> Revenue</h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Total Tickets</p>
              <p className="font-semibold" data-testid="text-total-tickets">{revenue.totalTickets}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Checked In</p>
              <p className="font-semibold" data-testid="text-checked-in">{revenue.checkedInCount || checkedIn}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Gross Revenue</p>
              <p className="font-semibold" data-testid="text-gross-revenue">${((revenue.grossRevenue || 0) / 100).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Platform (40%)</p>
              <p className="font-semibold text-purple-400">${((revenue.platformShare || 0) / 100).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Operator (30%)</p>
              <p className="font-semibold">${((revenue.operatorShare || 0) / 100).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Organizer (30%)</p>
              <p className="font-semibold text-green-400">${((revenue.organizerShare || 0) / 100).toFixed(2)}</p>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold" data-testid="text-attendees-title">
            Ticket Purchases ({totalTickets}) · {checkedIn} checked in
          </h4>
          <Button variant="outline" size="sm" onClick={handleExportCsv} data-testid="button-export-csv">
            <Download className="h-3 w-3 mr-1" /> CSV
          </Button>
        </div>
        {attendeesLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : (!attendees || attendees.length === 0) ? (
          <p className="text-sm text-muted-foreground">No ticket purchases yet</p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {attendees.map((a: any) => {
              const customFields = a.custom_field_responses && typeof a.custom_field_responses === "object" ? a.custom_field_responses : null;
              const isExpanded = expandedAttendee === a.id;
              return (
                <div key={a.id} className="text-sm border rounded" data-testid={`attendee-${a.id}`}>
                  <div className="flex items-center justify-between p-2">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{a.buyer_name}</span>
                      <span className="text-xs text-muted-foreground ml-2">{a.buyer_email}</span>
                      {a.ticket_type_name && (
                        <Badge variant="secondary" className="text-[10px] ml-2">{a.ticket_type_name}</Badge>
                      )}
                      {a.total_paid > 0 && (
                        <span className="text-[10px] text-muted-foreground ml-2">${(a.total_paid / 100).toFixed(2)}</span>
                      )}
                      {customFields && (
                        <button
                          className="ml-2 text-muted-foreground hover:text-foreground inline-flex items-center"
                          onClick={() => setExpandedAttendee(isExpanded ? null : a.id)}
                          data-testid={`button-expand-fields-${a.id}`}
                        >
                          <Info className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {a.checkin_status === "checked_in" ? (
                        <Badge variant="outline" className="text-green-400 border-green-500/30 text-[10px]">
                          <CheckCircle2 className="h-3 w-3 mr-0.5" /> In
                        </Badge>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => checkinMutation.mutate(a.id)}
                          disabled={checkinMutation.isPending}
                          data-testid={`button-checkin-${a.id}`}
                        >
                          Check In
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-red-400 hover:text-red-300"
                        onClick={() => { if (confirm(`Refund ${a.buyer_name}?`)) refundMutation.mutate(a.id); }}
                        disabled={refundMutation.isPending}
                        data-testid={`button-refund-${a.id}`}
                      >
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  {isExpanded && customFields && (
                    <div className="px-2 pb-2 border-t pt-1.5 space-y-0.5" data-testid={`custom-fields-${a.id}`}>
                      {Object.entries(customFields).map(([key, val]) => (
                        <div key={key} className="text-xs">
                          <span className="text-muted-foreground">{key}:</span>{" "}
                          <span>{String(val)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h4 className="text-sm font-semibold mb-3" data-testid="text-rsvps-title">RSVPs ({rsvps?.length || 0})</h4>
        {(!rsvps || rsvps.length === 0) ? (
          <p className="text-sm text-muted-foreground">No RSVPs yet</p>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {rsvps.map((r: AdminRsvp) => (
              <div key={r.id} className="flex items-center justify-between text-sm p-2 border rounded" data-testid={`rsvp-${r.id}`}>
                <div>
                  <span className="font-medium">{r.name || r.email || "Anonymous"}</span>
                  {r.email && <span className="text-xs text-muted-foreground ml-2">{r.email}</span>}
                </div>
                <Badge variant={r.response === "attending" ? "default" : "secondary"} className="text-xs">{r.response}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      {waitlist && waitlist.length > 0 && (
        <Card className="p-4">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-1" data-testid="text-waitlist-title">
            <Clock className="h-3 w-3" /> Waitlist ({waitlist.length})
          </h4>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {waitlist.map((w: any) => (
              <div key={w.id} className="flex items-center justify-between text-sm p-2 border rounded" data-testid={`waitlist-${w.id}`}>
                <div>
                  <span className="font-medium">{w.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">{w.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  {w.notified_at ? (
                    <Badge variant="outline" className="text-amber-400 border-amber-500/30 text-[10px]">Notified</Badge>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => notifyWaitlistMutation.mutate(w.id)}
                      disabled={notifyWaitlistMutation.isPending}
                      data-testid={`button-notify-${w.id}`}
                    >
                      <Mail className="h-3 w-3 mr-1" /> Notify
                    </Button>
                  )}
                  {w.converted_at && (
                    <Badge variant="outline" className="text-green-400 border-green-500/30 text-[10px]">Converted</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function TicketTypesSection({ eventId, ticketTypes }: { eventId: string; ticketTypes: AdminTicketType[] }) {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priceDisplay, setPriceDisplay] = useState("");
  const [quantity, setQuantity] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [saleStart, setSaleStart] = useState("");
  const [saleEnd, setSaleEnd] = useState("");

  const addMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/admin/events/${eventId}/ticket-types`, {
        name, description: description || null, priceDisplay: priceDisplay || null,
        quantity: quantity ? parseInt(quantity) : null,
        externalCheckoutUrl: externalUrl || null,
        saleStartAt: saleStart ? new Date(saleStart).toISOString() : null,
        saleEndAt: saleEnd ? new Date(saleEnd).toISOString() : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events", eventId, "ticket-types"] });
      toast({ title: "Ticket type added" });
      setShowAdd(false);
      setName(""); setDescription(""); setPriceDisplay(""); setQuantity(""); setExternalUrl(""); setSaleStart(""); setSaleEnd("");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/ticket-types/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events", eventId, "ticket-types"] });
      toast({ title: "Ticket type removed" });
    },
  });

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold" data-testid="text-tickets-title">Ticket Types ({ticketTypes.length})</h4>
        <Button size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)} data-testid="button-add-ticket-type">
          <Plus className="h-3 w-3 mr-1" /> Add Type
        </Button>
      </div>

      {showAdd && (
        <div className="space-y-3 p-3 border rounded-lg mb-3 bg-muted/30">
          <div className="grid grid-cols-2 gap-3">
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Name (e.g., General Admission)" data-testid="input-ticket-name" />
            <Input value={priceDisplay} onChange={e => setPriceDisplay(e.target.value)} placeholder="Price (e.g., $25)" data-testid="input-ticket-price" />
          </div>
          <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optional)" data-testid="input-ticket-desc" />
          <div className="grid grid-cols-2 gap-3">
            <Input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="Quantity cap (unlimited)" data-testid="input-ticket-qty" />
            <Input value={externalUrl} onChange={e => setExternalUrl(e.target.value)} placeholder="External checkout URL" data-testid="input-ticket-url" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Sale Start</Label>
              <Input type="datetime-local" value={saleStart} onChange={e => setSaleStart(e.target.value)} data-testid="input-ticket-sale-start" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Sale End</Label>
              <Input type="datetime-local" value={saleEnd} onChange={e => setSaleEnd(e.target.value)} data-testid="input-ticket-sale-end" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)} data-testid="button-ticket-cancel">Cancel</Button>
            <Button size="sm" disabled={!name || addMutation.isPending} onClick={() => addMutation.mutate()} data-testid="button-ticket-save">
              {addMutation.isPending ? "Adding..." : "Add Ticket Type"}
            </Button>
          </div>
        </div>
      )}

      {ticketTypes.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="text-no-tickets">No ticket types configured. Free/RSVP event.</p>
      ) : (
        <div className="space-y-2">
          {ticketTypes.map((tt: AdminTicketType) => (
            <div key={tt.id} className="flex items-center justify-between p-2 border rounded" data-testid={`ticket-type-${tt.id}`}>
              <div>
                <span className="text-sm font-medium">{tt.name}</span>
                {(tt.priceDisplay || tt.price_display) && <Badge variant="secondary" className="text-xs ml-2">{tt.priceDisplay || tt.price_display}</Badge>}
                {tt.quantity && <span className="text-xs text-muted-foreground ml-2">({tt.quantitySold || tt.quantity_sold || 0}/{tt.quantity})</span>}
                {(tt.saleStartAt || tt.sale_start_at || tt.saleEndAt || tt.sale_end_at) && (
                  <span className="text-xs text-muted-foreground ml-2">
                    Sale: {(tt.saleStartAt || tt.sale_start_at) ? new Date(String(tt.saleStartAt || tt.sale_start_at)).toLocaleDateString() : "—"} – {(tt.saleEndAt || tt.sale_end_at) ? new Date(String(tt.saleEndAt || tt.sale_end_at)).toLocaleDateString() : "—"}
                  </span>
                )}
                {(tt.externalCheckoutUrl || tt.external_checkout_url) && (
                  <a href={tt.externalCheckoutUrl || tt.external_checkout_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 ml-2 inline-flex items-center gap-0.5">
                    <ExternalLink className="h-3 w-3" /> Buy
                  </a>
                )}
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteMutation.mutate(tt.id)} data-testid={`button-delete-ticket-${tt.id}`}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function MentionsSection({ eventId, mentions }: { eventId: string; mentions: AdminMention[] }) {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [sourceName, setSourceName] = useState("");

  const addMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/admin/events/${eventId}/mentions`, {
        title: title || null, url: url || null, sourceName: sourceName || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events", eventId, "mentions"] });
      toast({ title: "Mention added" });
      setShowAdd(false);
      setTitle(""); setUrl(""); setSourceName("");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/mentions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events", eventId, "mentions"] });
      toast({ title: "Mention removed" });
    },
  });

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold" data-testid="text-mentions-title">Press & Mentions ({mentions.length})</h4>
        <Button size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)} data-testid="button-add-mention">
          <Plus className="h-3 w-3 mr-1" /> Add Mention
        </Button>
      </div>

      {showAdd && (
        <div className="space-y-3 p-3 border rounded-lg mb-3 bg-muted/30">
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Article title" data-testid="input-mention-title" />
          <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="Article URL" data-testid="input-mention-url" />
          <Input value={sourceName} onChange={e => setSourceName(e.target.value)} placeholder="Source (e.g., Charlotte Observer)" data-testid="input-mention-source" />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)} data-testid="button-mention-cancel">Cancel</Button>
            <Button size="sm" disabled={addMutation.isPending} onClick={() => addMutation.mutate()} data-testid="button-mention-save">
              {addMutation.isPending ? "Adding..." : "Add Mention"}
            </Button>
          </div>
        </div>
      )}

      {mentions.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="text-no-mentions">No press mentions linked</p>
      ) : (
        <div className="space-y-2">
          {mentions.map((m: AdminMention) => (
            <div key={m.id} className="flex items-center justify-between p-2 border rounded" data-testid={`mention-${m.id}`}>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <span className="text-sm font-medium">{m.title || "Untitled"}</span>
                  {(m.sourceName || m.source_name) && <span className="text-xs text-muted-foreground ml-2">{m.sourceName || m.source_name}</span>}
                  {m.url && (
                    <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 ml-2 inline-flex items-center gap-0.5">
                      <ExternalLink className="h-3 w-3" /> View
                    </a>
                  )}
                </div>
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteMutation.mutate(m.id)} data-testid={`button-delete-mention-${m.id}`}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function ScheduleSeriesSection({ event }: { event: AdminEvent }) {
  const { toast } = useToast();
  const seriesId = event.eventSeriesId || event.event_series_id;

  const seriesQuery = useQuery({
    queryKey: ["/api/admin/event-series", seriesId],
    queryFn: async () => {
      if (!seriesId) return null;
      const res = await fetch(`/api/admin/event-series/${seriesId}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!seriesId,
  });

  const series = seriesQuery.data as { id: string; title: string; recurrence_type: string; status: string; archived_at: string | null } | null;

  const archiveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/admin/event-series/${seriesId}/archive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/event-series", seriesId] });
      toast({ title: "Series archived" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const unarchiveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/admin/event-series/${seriesId}/unarchive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/event-series", seriesId] });
      toast({ title: "Series unarchived" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Card className="p-4 space-y-4">
      <h4 className="text-sm font-semibold flex items-center gap-2" data-testid="text-schedule-title">
        <CalendarIcon className="h-4 w-4" /> Schedule & Series
      </h4>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Start</p>
          <span>{event.startDateTime || event.start_date_time ? new Date(String(event.startDateTime || event.start_date_time)).toLocaleString() : "—"}</span>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">End</p>
          <span>{event.endDateTime || event.end_date_time ? new Date(String(event.endDateTime || event.end_date_time)).toLocaleString() : "—"}</span>
        </div>
      </div>

      <div className="border-t pt-3">
        <h5 className="text-xs font-semibold mb-2 flex items-center gap-1">
          <Repeat className="h-3.5 w-3.5" /> Event Series
        </h5>
        {seriesId ? (
          <div className="space-y-2">
            {seriesQuery.isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : series ? (
              <div className="p-3 border rounded-lg bg-muted/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{series.title}</span>
                  <Badge variant={series.archived_at ? "secondary" : "default"} className="text-xs">
                    {series.archived_at ? "Archived" : series.status}
                  </Badge>
                </div>
                {series.recurrence_type && (
                  <p className="text-xs text-muted-foreground">Recurrence: {series.recurrence_type}</p>
                )}
                <div className="flex gap-2">
                  {series.archived_at ? (
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => unarchiveMutation.mutate()} disabled={unarchiveMutation.isPending} data-testid="button-unarchive-series">
                      Unarchive
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => archiveMutation.mutate()} disabled={archiveMutation.isPending} data-testid="button-archive-series">
                      <Archive className="h-3 w-3 mr-1" /> Archive Series
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Series data not available</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground" data-testid="text-no-series">This is a standalone event (not part of a series)</p>
        )}
      </div>
    </Card>
  );
}

function DistributionSection({ event }: { event: AdminEvent }) {
  const eventSlug = event.slug;
  const citySlug = event.citySlug || event.city_slug;
  const publicUrl = citySlug && eventSlug ? `/${citySlug}/events/${eventSlug}` : eventSlug ? `/events/${eventSlug}` : null;

  return (
    <Card className="p-4 space-y-4">
      <h4 className="text-sm font-semibold flex items-center gap-2" data-testid="text-distribution-title">
        <Share2 className="h-4 w-4" /> Distribution & Sharing
      </h4>

      <div className="space-y-3">
        <div className="p-3 border rounded-lg space-y-2">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Public Event Page</span>
          </div>
          {publicUrl ? (
            <div className="flex items-center gap-2">
              <code className="text-xs bg-muted px-2 py-1 rounded flex-1 overflow-hidden text-ellipsis">{publicUrl}</code>
              <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => window.open(publicUrl, "_blank")} data-testid="button-view-public">
                <ExternalLink className="h-3 w-3 mr-1" /> View
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">URL not available — event may be missing slug or city</p>
          )}
        </div>

        <div className="p-3 border rounded-lg space-y-2">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">SEO & Discovery</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground">Visibility</p>
              <Badge variant="outline" className="text-xs mt-0.5">{event.visibility || "public"}</Badge>
            </div>
            <div>
              <p className="text-muted-foreground">Lifecycle</p>
              <Badge variant="outline" className="text-xs mt-0.5">{event.lifecycleStatus || event.lifecycle_status || "published"}</Badge>
            </div>
            <div>
              <p className="text-muted-foreground">Page Views</p>
              <span className="font-medium">{event.viewCount || event.view_count || 0}</span>
            </div>
            <div>
              <p className="text-muted-foreground">Ticket Clicks</p>
              <span className="font-medium">{event.outboundTicketClicks || event.outbound_ticket_clicks || 0}</span>
            </div>
          </div>
        </div>

        <div className="p-3 border rounded-lg space-y-2">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Calendar Export</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Visitors can add this event to their calendar from the public event page.
            {event.startDateTime || event.start_date_time ? ` Event starts ${new Date(String(event.startDateTime || event.start_date_time)).toLocaleDateString()}.` : ""}
          </p>
        </div>
      </div>
    </Card>
  );
}

function CaptureAndClaimsTab({ cityId }: { cityId: string }) {
  const [subTab, setSubTab] = useState("capture");

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button size="sm" variant={subTab === "capture" ? "default" : "outline"} onClick={() => setSubTab("capture")} data-testid="button-tab-capture">
          <Wand2 className="h-3.5 w-3.5 mr-1" /> AI Capture
        </Button>
        <Button size="sm" variant={subTab === "rss" ? "default" : "outline"} onClick={() => setSubTab("rss")} data-testid="button-tab-rss">
          <Newspaper className="h-3.5 w-3.5 mr-1" /> RSS Events
        </Button>
        <Button size="sm" variant={subTab === "suppressions" ? "default" : "outline"} onClick={() => setSubTab("suppressions")} data-testid="button-tab-suppressions">
          <Ban className="h-3.5 w-3.5 mr-1" /> Suppressions
        </Button>
      </div>

      {subTab === "capture" && (
        <>
          <EventCaptureSection cityId={cityId} />
          <CapturedEventsQueue />
        </>
      )}

      {subTab === "rss" && <RssSourcedEvents cityId={cityId} />}
      {subTab === "suppressions" && <SuppressionsList cityId={cityId} />}
    </div>
  );
}

function RssSourcedEvents({ cityId }: { cityId: string }) {
  const { data: rssEvents, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/events/rss-sourced", cityId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      const resp = await fetch(`/api/admin/events/rss-sourced?${params}`, { credentials: "include" });
      if (!resp.ok) return [];
      return resp.json();
    },
  });

  if (isLoading) return <Skeleton className="h-32" />;

  return (
    <Card className="p-4">
      <h4 className="text-sm font-semibold mb-3" data-testid="text-rss-events-title">RSS-Sourced Events ({rssEvents?.length || 0})</h4>
      {(!rssEvents || rssEvents.length === 0) ? (
        <p className="text-sm text-muted-foreground">No RSS-sourced events found</p>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {rssEvents.map((evt: Record<string, string>) => (
            <div key={evt.id} className="flex items-start gap-3 p-2.5 border rounded" data-testid={`rss-event-${evt.id}`}>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium">{evt.title}</span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  {evt.source_url && <span className="truncate max-w-[200px]">{evt.source_url}</span>}
                  {evt.seed_source_type && <Badge variant="outline" className="text-[10px]">{evt.seed_source_type}</Badge>}
                  <span>{formatDateTime(evt.start_date_time)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function SuppressionsList({ cityId }: { cityId: string }) {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [sourceName, setSourceName] = useState("");
  const [sourcePattern, setSourcePattern] = useState("");
  const [titlePattern, setTitlePattern] = useState("");
  const [reason, setReason] = useState("");

  const { data: suppressions, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/event-rss-suppressions", cityId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      const resp = await fetch(`/api/admin/event-rss-suppressions?${params}`, { credentials: "include" });
      if (!resp.ok) return [];
      return resp.json();
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/admin/event-rss-suppressions`, {
        cityId, sourceName: sourceName || null, sourcePattern: sourcePattern || null,
        titlePattern: titlePattern || null, reason: reason || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/event-rss-suppressions"] });
      toast({ title: "Suppression rule added" });
      setShowAdd(false);
      setSourceName(""); setSourcePattern(""); setTitlePattern(""); setReason("");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/event-rss-suppressions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/event-rss-suppressions"] });
      toast({ title: "Suppression removed" });
    },
  });

  if (isLoading) return <Skeleton className="h-32" />;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold" data-testid="text-suppressions-title">RSS Suppressions ({suppressions?.length || 0})</h4>
        <Button size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)} data-testid="button-add-suppression">
          <Plus className="h-3 w-3 mr-1" /> Add Rule
        </Button>
      </div>

      {showAdd && (
        <div className="space-y-3 p-3 border rounded-lg mb-3 bg-muted/30">
          <div className="grid grid-cols-2 gap-3">
            <Input value={sourceName} onChange={e => setSourceName(e.target.value)} placeholder="Source name to block" data-testid="input-suppress-source" />
            <Input value={sourcePattern} onChange={e => setSourcePattern(e.target.value)} placeholder="URL pattern to block" data-testid="input-suppress-pattern" />
          </div>
          <Input value={titlePattern} onChange={e => setTitlePattern(e.target.value)} placeholder="Title pattern to block (optional)" data-testid="input-suppress-title" />
          <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (optional)" data-testid="input-suppress-reason" />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button size="sm" disabled={(!sourceName && !sourcePattern && !titlePattern) || addMutation.isPending} onClick={() => addMutation.mutate()} data-testid="button-suppress-save">
              {addMutation.isPending ? "Adding..." : "Add Suppression"}
            </Button>
          </div>
        </div>
      )}

      {(!suppressions || suppressions.length === 0) ? (
        <p className="text-sm text-muted-foreground">No suppression rules configured</p>
      ) : (
        <div className="space-y-2">
          {suppressions.map((s: AdminRssSuppression) => (
            <div key={s.id} className="flex items-center justify-between p-2 border rounded" data-testid={`suppression-${s.id}`}>
              <div>
                {s.source_name && <span className="text-sm font-medium">{s.source_name}</span>}
                {s.source_pattern && <Badge variant="outline" className="text-xs ml-2">{s.source_pattern}</Badge>}
                {s.title_pattern && <span className="text-xs text-muted-foreground ml-2">Title: {s.title_pattern}</span>}
                {s.reason && <span className="text-xs text-muted-foreground ml-2">— {s.reason}</span>}
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteMutation.mutate(s.id)} data-testid={`button-delete-suppression-${s.id}`}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function OrganizerToolkitSection({ eventId }: { eventId: string }) {
  const { toast } = useToast();

  const { data: nominations } = useQuery<any[]>({
    queryKey: ["/api/admin/events", eventId, "nominations"],
    queryFn: async () => { const r = await fetch(`/api/events/${eventId}/nominations`); return r.ok ? r.json() : []; },
  });

  const { data: giveaways } = useQuery<any[]>({
    queryKey: ["/api/admin/events", eventId, "giveaways"],
    queryFn: async () => { const r = await fetch(`/api/events/${eventId}/giveaways`); return r.ok ? r.json() : []; },
  });

  const [nomCategory, setNomCategory] = useState("");
  const [nomDesc, setNomDesc] = useState("");
  const [gTitle, setGTitle] = useState("");
  const [gDesc, setGDesc] = useState("");
  const [gPrize, setGPrize] = useState("");

  const addNomMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/admin/events/${eventId}/nominations`, { categoryName: nomCategory, description: nomDesc || null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events", eventId, "nominations"] });
      toast({ title: "Nomination category added" });
      setNomCategory(""); setNomDesc("");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addGiveawayMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/admin/events/${eventId}/giveaways`, { title: gTitle, description: gDesc || null, prizeDescription: gPrize || null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events", eventId, "giveaways"] });
      toast({ title: "Giveaway created" });
      setGTitle(""); setGDesc(""); setGPrize("");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const drawMutation = useMutation({
    mutationFn: async (giveawayId: string) => {
      await apiRequest("POST", `/api/admin/giveaways/${giveawayId}/draw`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events", eventId, "giveaways"] });
      toast({ title: "Winner drawn!" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleExportCSV = () => {
    window.open(`/api/admin/events/${eventId}/attendees/export`, "_blank");
  };

  const [followUpMsg, setFollowUpMsg] = useState("");
  const followUpMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/admin/events/${eventId}/follow-up`, { message: followUpMsg });
    },
    onSuccess: () => {
      toast({ title: "Follow-up message sent!" });
      setFollowUpMsg("");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold flex items-center gap-2" data-testid="text-toolkit-title">
            <Users className="h-4 w-4" /> Attendee Management
          </h4>
          <Button size="sm" variant="outline" onClick={handleExportCSV} data-testid="button-export-csv">
            <Download className="h-3 w-3 mr-1" /> Export CSV
          </Button>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Follow-up Message to Attendees</Label>
          <Textarea value={followUpMsg} onChange={e => setFollowUpMsg(e.target.value)} placeholder="Write a message to all attendees..." rows={3} data-testid="input-followup-message" />
          <Button size="sm" disabled={!followUpMsg.trim() || followUpMutation.isPending} onClick={() => followUpMutation.mutate()} data-testid="button-send-followup">
            <Send className="h-3 w-3 mr-1" /> {followUpMutation.isPending ? "Sending..." : "Send Follow-up"}
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" data-testid="text-nominations-title">
          <Trophy className="h-4 w-4" /> Nominations ({nominations?.length || 0})
        </h4>
        <div className="space-y-2 mb-3">
          <Input value={nomCategory} onChange={e => setNomCategory(e.target.value)} placeholder="Category name (e.g., Best Performance)" data-testid="input-nom-category" />
          <Input value={nomDesc} onChange={e => setNomDesc(e.target.value)} placeholder="Description (optional)" data-testid="input-nom-desc" />
          <Button size="sm" disabled={!nomCategory || addNomMutation.isPending} onClick={() => addNomMutation.mutate()} data-testid="button-add-nomination">
            <Plus className="h-3 w-3 mr-1" /> Add Category
          </Button>
        </div>
        {nominations && nominations.length > 0 && (
          <div className="space-y-2">
            {nominations.map((n: any) => (
              <div key={n.id} className="p-2 border rounded flex items-center justify-between" data-testid={`admin-nom-${n.id}`}>
                <div>
                  <span className="text-sm font-medium">{n.category_name}</span>
                  {n.description && <span className="text-xs text-muted-foreground ml-2">{n.description}</span>}
                </div>
                <Badge variant={n.is_active ? "default" : "secondary"} className="text-xs">
                  {n.is_active ? "Active" : "Closed"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" data-testid="text-giveaways-title">
          <Gift className="h-4 w-4" /> Giveaways ({giveaways?.length || 0})
        </h4>
        <div className="space-y-2 mb-3">
          <Input value={gTitle} onChange={e => setGTitle(e.target.value)} placeholder="Giveaway title" data-testid="input-giveaway-title" />
          <Input value={gDesc} onChange={e => setGDesc(e.target.value)} placeholder="Description (optional)" data-testid="input-giveaway-desc" />
          <Input value={gPrize} onChange={e => setGPrize(e.target.value)} placeholder="Prize description (optional)" data-testid="input-giveaway-prize" />
          <Button size="sm" disabled={!gTitle || addGiveawayMutation.isPending} onClick={() => addGiveawayMutation.mutate()} data-testid="button-add-giveaway">
            <Plus className="h-3 w-3 mr-1" /> Create Giveaway
          </Button>
        </div>
        {giveaways && giveaways.length > 0 && (
          <div className="space-y-2">
            {giveaways.map((g: any) => (
              <div key={g.id} className="p-2 border rounded flex items-center justify-between" data-testid={`admin-giveaway-${g.id}`}>
                <div>
                  <span className="text-sm font-medium">{g.title}</span>
                  {g.prize_description && <span className="text-xs text-muted-foreground ml-2">Prize: {g.prize_description}</span>}
                </div>
                <div className="flex items-center gap-2">
                  {g.winner_id ? (
                    <Badge className="bg-green-100 text-green-800 text-xs">Winner Drawn</Badge>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => drawMutation.mutate(g.id)} disabled={drawMutation.isPending} data-testid={`button-draw-${g.id}`}>
                      <Gift className="h-3 w-3 mr-1" /> Draw Winner
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function SyndicationSection({ eventId }: { eventId: string }) {
  const { toast } = useToast();
  const [platform, setPlatform] = useState("facebook");

  const { data: syndications } = useQuery<any[]>({
    queryKey: ["/api/admin/events", eventId, "syndications"],
    queryFn: async () => { const r = await fetch(`/api/admin/events/${eventId}/syndications`); return r.ok ? r.json() : []; },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/admin/events/${eventId}/syndications`, { platform });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events", eventId, "syndications"] });
      toast({ title: `Syndication to ${platform} queued` });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const PLATFORMS = [
    { value: "facebook", label: "Facebook" },
    { value: "eventbrite", label: "Eventbrite" },
    { value: "meetup", label: "Meetup" },
  ];

  return (
    <Card className="p-4">
      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" data-testid="text-syndication-title">
        <Globe className="h-4 w-4" /> Cross-Platform Syndication
      </h4>
      <div className="flex gap-2 mb-4">
        <Select value={platform} onValueChange={setPlatform}>
          <SelectTrigger className="w-40" data-testid="select-syndication-platform">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PLATFORMS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => addMutation.mutate()} disabled={addMutation.isPending} data-testid="button-add-syndication">
          <Plus className="h-3 w-3 mr-1" /> Syndicate
        </Button>
      </div>
      {syndications && syndications.length > 0 ? (
        <div className="space-y-2">
          {syndications.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between p-2 border rounded" data-testid={`syndication-${s.id}`}>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs capitalize">{s.platform}</Badge>
                <span className="text-sm">{s.external_url || "Pending..."}</span>
              </div>
              <Badge variant={s.status === "published" ? "default" : s.status === "failed" ? "destructive" : "secondary"} className="text-xs">
                {s.status}
              </Badge>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No syndication targets configured</p>
      )}
    </Card>
  );
}

function DripCampaignSection({ eventId }: { eventId: string }) {
  const { toast } = useToast();
  const [showNew, setShowNew] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [stepTiming, setStepTiming] = useState("1_day_before");
  const [stepChannel, setStepChannel] = useState("email");
  const [stepSubject, setStepSubject] = useState("");
  const [stepBody, setStepBody] = useState("");
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);

  const { data: campaigns } = useQuery<any[]>({
    queryKey: ["/api/admin/events", eventId, "drip-campaigns"],
    queryFn: async () => { const r = await fetch(`/api/admin/events/${eventId}/drip-campaigns`); return r.ok ? r.json() : []; },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/admin/events/${eventId}/drip-campaigns`, { name: campaignName });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events", eventId, "drip-campaigns"] });
      toast({ title: "Campaign created" });
      setCampaignName(""); setShowNew(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await apiRequest("PATCH", `/api/admin/drip-campaigns/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events", eventId, "drip-campaigns"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addStepMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      await apiRequest("POST", `/api/admin/events/${eventId}/drip-campaigns/${campaignId}/steps`, {
        timing: stepTiming, channel: stepChannel, subject: stepSubject || null, body: stepBody,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events", eventId, "drip-campaigns"] });
      toast({ title: "Step added" });
      setStepSubject(""); setStepBody(""); setEditingCampaignId(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const TIMINGS = [
    { value: "1_week_before", label: "1 Week Before" },
    { value: "1_day_before", label: "1 Day Before" },
    { value: "2_hours_before", label: "2 Hours Before" },
    { value: "post_event", label: "Post-Event" },
    { value: "custom", label: "Custom" },
  ];

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold flex items-center gap-2" data-testid="text-drips-title">
          <Mail className="h-4 w-4" /> Drip Campaigns ({campaigns?.length || 0})
        </h4>
        <Button size="sm" variant="outline" onClick={() => setShowNew(!showNew)} data-testid="button-new-drip">
          <Plus className="h-3 w-3 mr-1" /> New Campaign
        </Button>
      </div>

      {showNew && (
        <div className="space-y-2 p-3 border rounded-lg mb-3 bg-muted/30">
          <Input value={campaignName} onChange={e => setCampaignName(e.target.value)} placeholder="Campaign name" data-testid="input-drip-name" />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button size="sm" disabled={!campaignName || createMutation.isPending} onClick={() => createMutation.mutate()} data-testid="button-create-drip">
              Create
            </Button>
          </div>
        </div>
      )}

      {campaigns && campaigns.length > 0 ? (
        <div className="space-y-3">
          {campaigns.map((c: any) => (
            <div key={c.id} className="border rounded-lg p-3" data-testid={`drip-campaign-${c.id}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{c.name}</span>
                <div className="flex items-center gap-2">
                  <Badge variant={c.is_active ? "default" : "secondary"} className="text-xs">
                    {c.is_active ? "Active" : "Inactive"}
                  </Badge>
                  <Switch
                    checked={c.is_active}
                    onCheckedChange={(checked) => toggleMutation.mutate({ id: c.id, isActive: checked })}
                    data-testid={`switch-drip-active-${c.id}`}
                  />
                </div>
              </div>
              {c.requires_credits && (
                <p className="text-[10px] text-amber-600 mb-2">Requires {c.credits_per_send} credit(s) per send</p>
              )}
              {c.steps && c.steps.length > 0 && (
                <div className="space-y-1 mb-2">
                  {c.steps.map((s: any, i: number) => (
                    <div key={s.id || i} className="flex items-center gap-2 text-xs p-1.5 bg-muted/30 rounded">
                      <Badge variant="outline" className="text-[10px]">{s.timing?.replace(/_/g, " ")}</Badge>
                      <Badge variant="outline" className="text-[10px]">{s.channel}</Badge>
                      <span className="truncate">{s.subject || s.body?.substring(0, 50)}</span>
                    </div>
                  ))}
                </div>
              )}
              {editingCampaignId === c.id ? (
                <div className="space-y-2 p-2 border rounded bg-muted/20">
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={stepTiming} onValueChange={setStepTiming}>
                      <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIMINGS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={stepChannel} onValueChange={setStepChannel}>
                      <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {stepChannel === "email" && (
                    <Input value={stepSubject} onChange={e => setStepSubject(e.target.value)} placeholder="Subject line" className="text-sm" data-testid="input-step-subject" />
                  )}
                  <Textarea value={stepBody} onChange={e => setStepBody(e.target.value)} placeholder="Message body" rows={3} className="text-sm" data-testid="input-step-body" />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setEditingCampaignId(null)}>Cancel</Button>
                    <Button size="sm" disabled={!stepBody || addStepMutation.isPending} onClick={() => addStepMutation.mutate(c.id)} data-testid="button-add-step">
                      Add Step
                    </Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" variant="outline" className="text-xs" onClick={() => setEditingCampaignId(c.id)} data-testid={`button-add-step-${c.id}`}>
                  <Plus className="h-3 w-3 mr-1" /> Add Step
                </Button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No drip campaigns configured</p>
      )}
    </Card>
  );
}

function EmbedWidgetSection({ eventId }: { eventId: string }) {
  const { toast } = useToast();
  const [theme, setTheme] = useState("dark");
  const [showButton, setShowButton] = useState(true);
  const [buttonText, setButtonText] = useState("Get Tickets on CLT Hub");
  const [copied, setCopied] = useState(false);

  const { data: config } = useQuery<any>({
    queryKey: ["/api/events", eventId, "embed-config"],
    queryFn: async () => { const r = await fetch(`/api/events/${eventId}/embed-config`); return r.ok ? r.json() : null; },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/admin/events/${eventId}/embed-config`, { theme, showTicketButton: showButton, buttonText });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "embed-config"] });
      toast({ title: "Embed config saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  useEffect(() => {
    if (config) {
      setTheme(config.theme || "dark");
      setShowButton(config.show_ticket_button !== false);
      setButtonText(config.button_text || "Get Tickets on CLT Hub");
    }
  }, [config]);

  const embedCode = `<iframe src="${window.location.origin}/api/embed/event/${eventId}" width="100%" height="400" frameborder="0" style="border-radius:12px;overflow:hidden;"></iframe>`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(embedCode);
    setCopied(true);
    toast({ title: "Embed code copied!" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="p-4">
      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" data-testid="text-embed-title">
        <Code className="h-4 w-4" /> Embeddable Widget
      </h4>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Theme</Label>
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger data-testid="select-embed-theme"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="light">Light</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Button Text</Label>
            <Input value={buttonText} onChange={e => setButtonText(e.target.value)} data-testid="input-embed-button-text" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={showButton} onCheckedChange={setShowButton} data-testid="switch-embed-button" />
          <Label className="text-xs">Show ticket button</Label>
        </div>
        <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-embed-config">
          {saveMutation.isPending ? "Saving..." : "Save Config"}
        </Button>
        <div className="pt-3 border-t">
          <Label className="text-xs mb-1 block">Embed Code</Label>
          <div className="bg-muted/50 p-3 rounded-lg font-mono text-xs break-all">{embedCode}</div>
          <Button size="sm" variant="outline" className="mt-2" onClick={handleCopy} data-testid="button-copy-embed">
            {copied ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <Code className="h-3 w-3 mr-1" />}
            {copied ? "Copied!" : "Copy Embed Code"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function CapturedEventsQueue() {
  const { data: captured, isLoading } = useQuery<Event[]>({ queryKey: ["/api/admin/events/captured"] });
  if (isLoading) return <Card className="p-4 mt-4"><Skeleton className="h-6 w-48 mb-3" /><Skeleton className="h-16 w-full" /></Card>;
  if (!captured?.length) return null;

  return (
    <Card className="p-4 mt-4">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" data-testid="text-captured-queue-title">
        <Wand2 className="h-4 w-4" /> Captured Events Queue ({captured.length})
      </h3>
      <div className="space-y-2">
        {captured.map((evt: AdminEvent) => {
          const gaps = evt.aiGapFlags || evt.ai_gap_flags;
          const hasGaps = gaps && Array.isArray(gaps) && gaps.length > 0;
          const claimSt = evt.eventClaimStatus || evt.event_claim_status;
          return (
            <div key={evt.id} className="flex items-start gap-3 p-2.5 border rounded-lg bg-muted/20" data-testid={`card-captured-event-${evt.id}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium truncate">{evt.title}</span>
                  {claimSt && (
                    <Badge variant="outline" className={`text-[10px] ${claimSt === "CLAIMED" ? "text-green-600 border-green-300" : "text-gray-500 border-gray-300"}`}>
                      {claimSt}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {evt.startDateTime && <span className="flex items-center gap-0.5"><Calendar className="h-3 w-3" />{formatDateTime(evt.startDateTime)}</span>}
                  {evt.locationName && <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" />{evt.locationName}</span>}
                </div>
                {hasGaps && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {gaps!.map((gap: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-[10px] text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-950/20">{gap}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function EventsPanel({ cityId, autoOpenEntityId, onAutoOpenConsumed }: { cityId?: string; autoOpenEntityId?: string | null; onAutoOpenConsumed?: () => void }) {
  const defaultCityId = useDefaultCityId();
  const CITY_ID = cityId || defaultCityId;
  const { selectedCitySlug } = useAdminCitySelection();
  const CITY_SLUG = selectedCitySlug;
  const { toast } = useToast();
  const [activeView, setActiveView] = useState("overview");
  const [showForm, setShowForm] = useState(false);
  const [editEvent, setEditEvent] = useState<Event | null>(null);
  const [workspaceEvent, setWorkspaceEvent] = useState<Event | null>(null);

  const { data: zones } = useQuery<Zone[]>({ queryKey: ["/api/cities", CITY_SLUG, "zones"] });

  const { data: autoOpenEvent, isError: autoOpenError } = useQuery<Event>({
    queryKey: ["/api/admin/events", autoOpenEntityId],
    queryFn: async () => {
      const resp = await fetch(`/api/admin/events/${autoOpenEntityId}`);
      if (!resp.ok) throw new Error("Not found");
      return resp.json();
    },
    enabled: !!autoOpenEntityId,
    retry: false,
  });

  useEffect(() => {
    if (!autoOpenEntityId) return;
    if (autoOpenEvent) {
      setWorkspaceEvent(autoOpenEvent);
      onAutoOpenConsumed?.();
    } else if (autoOpenError) {
      onAutoOpenConsumed?.();
    }
  }, [autoOpenEvent, autoOpenError, autoOpenEntityId]);

  const handleEditEvent = (evt: Event) => {
    setEditEvent(evt);
    setShowForm(true);
  };

  if (workspaceEvent) {
    return (
      <div className="p-4">
        <EventDetailWorkspace event={workspaceEvent} onClose={() => setWorkspaceEvent(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold" data-testid="text-events-title">Events Command Center</h2>
        <Button onClick={() => { setEditEvent(null); setShowForm(true); }} data-testid="button-add-event">
          <Plus className="h-4 w-4 mr-1" /> Add Event
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[
          { key: "overview", label: "Overview", icon: BarChart3 },
          { key: "pipeline", label: "Pipeline", icon: ListFilter },
          { key: "calendar", label: "Calendar", icon: CalendarDays },
          { key: "capture", label: "Capture & Claims", icon: Wand2 },
        ].map(v => (
          <Button
            key={v.key}
            size="sm"
            variant={activeView === v.key ? "default" : "outline"}
            onClick={() => setActiveView(v.key)}
            data-testid={`button-view-${v.key}`}
          >
            <v.icon className="h-3.5 w-3.5 mr-1" /> {v.label}
          </Button>
        ))}
      </div>

      {activeView === "overview" && <OverviewTab cityId={CITY_ID} />}
      {activeView === "pipeline" && <PipelineTab cityId={CITY_ID} zones={zones || []} onEditEvent={(evt) => setWorkspaceEvent(evt)} />}
      {activeView === "calendar" && <CalendarTab cityId={CITY_ID} zones={zones || []} />}
      {activeView === "capture" && <CaptureAndClaimsTab cityId={CITY_ID} />}

      <Dialog open={showForm} onOpenChange={(o) => { if (!o) { setShowForm(false); setEditEvent(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle data-testid="text-event-dialog-title">{editEvent ? "Edit Event" : "Add Event"}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-1">
            <EventForm event={editEvent || undefined} zones={zones || []} onClose={() => { setShowForm(false); setEditEvent(null); }} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
