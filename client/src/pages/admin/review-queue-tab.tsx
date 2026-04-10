import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle, Check, EyeOff, Archive, Edit, Sparkles, ExternalLink,
  Search, Clock, Send, Ban, RefreshCw, RotateCcw, FileText, Undo2,
  ChevronDown, ChevronRight, MapPin, Globe, Tag, Newspaper, Filter, X,
  CheckCircle2, XCircle,
} from "lucide-react";
import { EditDialog } from "./editorial-control-tab";

const QUEUE_TABS = [
  { value: "ALL", label: "All" },
  { value: "REVIEW_REQUIRED", label: "Review" },
  { value: "READY_TO_PUBLISH", label: "Ready" },
  { value: "PUBLISHED", label: "Published" },
  { value: "PULSE_SUPPRESSED", label: "No Pulse" },
  { value: "SUPPRESSED", label: "Suppressed" },
  { value: "UNPUBLISHED", label: "Unpublished" },
  { value: "ARCHIVED", label: "Archived" },
];

const CONTENT_TYPES = [
  { value: "all", label: "All Types" },
  { value: "rss_item", label: "RSS Item" },
  { value: "article", label: "Article" },
  { value: "event", label: "Event" },
  { value: "business", label: "Business" },
  { value: "post", label: "Post" },
  { value: "marketplace_listing", label: "Marketplace" },
  { value: "reel", label: "Reel" },
  { value: "shop_item", label: "Shop Item" },
  { value: "shop_drop", label: "Shop Drop" },
];

const PUBLISH_STATUSES = [
  { value: "all", label: "All Publish States" },
  { value: "PUBLISHED", label: "Published" },
  { value: "DRAFT", label: "Draft" },
  { value: "REVIEW_NEEDED", label: "Review Needed" },
  { value: "SUPPRESSED", label: "Suppressed" },
  { value: "ARCHIVED", label: "Archived" },
];

const POLICY_STATUSES = [
  { value: "all", label: "All Policy States" },
  { value: "ALLOW", label: "Allow" },
  { value: "REVIEW_NEEDED", label: "Review Needed" },
  { value: "SUPPRESS", label: "Suppress" },
];

const CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "news", label: "News" },
  { value: "business", label: "Business" },
  { value: "food-dining", label: "Food & Dining" },
  { value: "entertainment", label: "Entertainment" },
  { value: "community", label: "Community" },
  { value: "sports", label: "Sports" },
  { value: "events", label: "Events" },
  { value: "health-wellness", label: "Health" },
  { value: "real-estate", label: "Real Estate" },
  { value: "development", label: "Development" },
];

function QueueStatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <Badge variant="outline" className="text-xs">Unknown</Badge>;
  const styles: Record<string, string> = {
    REVIEW_REQUIRED: "bg-yellow-50 text-yellow-700 border-yellow-200",
    READY_TO_PUBLISH: "bg-blue-50 text-blue-700 border-blue-200",
    PUBLISHED: "bg-green-50 text-green-700 border-green-200",
    PULSE_SUPPRESSED: "bg-orange-50 text-orange-700 border-orange-200",
    SUPPRESSED: "bg-red-50 text-red-700 border-red-200",
    UNPUBLISHED: "bg-gray-50 text-gray-600 border-gray-200",
    ARCHIVED: "bg-gray-100 text-gray-500 border-gray-200",
  };
  const labels: Record<string, string> = {
    REVIEW_REQUIRED: "Review Required",
    READY_TO_PUBLISH: "Ready to Publish",
    PUBLISHED: "Published",
    PULSE_SUPPRESSED: "No Pulse",
    SUPPRESSED: "Suppressed",
    UNPUBLISHED: "Unpublished",
    ARCHIVED: "Archived",
  };
  return <Badge variant="outline" className={`text-xs ${styles[status] || ""}`}>{labels[status] || status}</Badge>;
}

function ConfidenceBadge({ value, label }: { value: number | undefined; label: string }) {
  if (value === undefined || value === null) return null;
  const pct = Math.round(value * 100);
  const variant = pct >= 70 ? "text-green-700 bg-green-50 border-green-200" :
    pct >= 40 ? "text-yellow-700 bg-yellow-50 border-yellow-200" :
    "text-red-700 bg-red-50 border-red-200";
  return <span className={`text-xs px-1.5 py-0.5 rounded border ${variant}`}>{label}: {pct}%</span>;
}

function getReviewReasons(item: Record<string, unknown>): string[] {
  const reasons: string[] = [];
  if (item.policyStatus === "REVIEW_NEEDED") reasons.push("Policy: Review Needed");
  if (item.publishStatus === "REVIEW_NEEDED") reasons.push("Publish: Review Needed");
  if (!item.categoryCoreSlug) reasons.push("Missing category");
  if (!item.geoPrimarySlug) reasons.push("Missing geo");
  const confidence = (item.aiConfidence || {}) as Record<string, number>;
  if (confidence.category !== undefined && confidence.category < 0.7) reasons.push("Low category confidence");
  if (confidence.geo !== undefined && confidence.geo < 0.7) reasons.push("Low geo confidence");
  if (confidence.policy !== undefined && confidence.policy < 0.7) reasons.push("Low policy confidence");
  return reasons;
}

function RoutingSurfaceRow({ label, icon, surface }: {
  label: string;
  icon: React.ReactNode;
  surface: { eligible: boolean; reasons?: string[]; logicSummary?: string; [k: string]: unknown };
}) {
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-border last:border-b-0">
      <div className="flex items-center gap-1.5 w-24 shrink-0">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {surface.eligible ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
          ) : (
            <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
          )}
          <span className={`text-xs ${surface.eligible ? "text-green-700" : "text-red-600"}`}>
            {surface.eligible ? "Eligible" : "Not Eligible"}
          </span>
        </div>
        {surface.logicSummary && (
          <div className="text-xs text-muted-foreground mt-0.5">{surface.logicSummary}</div>
        )}
        {!surface.eligible && (surface.reasons as string[])?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {(surface.reasons as string[]).map((r, i) => (
              <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-200">{r}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InlineRoutingPanel({ itemId }: { itemId: string }) {
  const { data, isLoading } = useQuery<Record<string, unknown>>({
    queryKey: ["/api/admin/intelligence/rss-items", itemId, "routing"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/intelligence/rss-items/${itemId}/routing`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch routing");
      return res.json();
    },
  });

  if (isLoading) return <div className="text-xs text-muted-foreground py-2 px-3">Loading routing...</div>;
  if (!data) return null;

  const surfaces = data.surfaces as Record<string, Record<string, unknown>>;
  const lifecycle = data.lifecycle as Record<string, unknown> | undefined;
  if (!surfaces) return null;

  return (
    <div className="mt-2 p-3 rounded border border-border bg-muted/30">
      <div className="text-xs font-medium mb-2">Routing Confirmation</div>
      <RoutingSurfaceRow label="Pulse" icon={<Sparkles className="w-3.5 h-3.5 text-purple-500" />} surface={surfaces.pulse as { eligible: boolean; reasons?: string[]; logicSummary?: string }} />
      <RoutingSurfaceRow label="Hub" icon={<Globe className="w-3.5 h-3.5 text-blue-500" />} surface={surfaces.hub as { eligible: boolean; reasons?: string[]; logicSummary?: string }} />
      <RoutingSurfaceRow label="Category" icon={<Tag className="w-3.5 h-3.5 text-teal-500" />} surface={surfaces.category as { eligible: boolean; reasons?: string[]; logicSummary?: string }} />
      <RoutingSurfaceRow label="Map" icon={<MapPin className="w-3.5 h-3.5 text-red-500" />} surface={surfaces.map as { eligible: boolean; reasons?: string[]; logicSummary?: string }} />
      <RoutingSurfaceRow label="Article" icon={<Newspaper className="w-3.5 h-3.5 text-orange-500" />} surface={surfaces.article as { eligible: boolean; reasons?: string[]; logicSummary?: string }} />
      <RoutingSurfaceRow label="Search" icon={<Search className="w-3.5 h-3.5 text-gray-500" />} surface={surfaces.search as { eligible: boolean; reasons?: string[]; logicSummary?: string }} />
      {lifecycle && (
        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border text-xs text-muted-foreground">
          {lifecycle.isEvergreen && <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">Evergreen</Badge>}
          {lifecycle.isExpired && <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200">Expired</Badge>}
          {lifecycle.activeUntil && <span>Active until {new Date(lifecycle.activeUntil as string).toLocaleDateString()}</span>}
        </div>
      )}
    </div>
  );
}

export default function ReviewQueueTab({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [editingItem, setEditingItem] = useState<Record<string, unknown> | null>(null);
  const [activeTab, setActiveTabRaw] = useState("REVIEW_REQUIRED");
  const setActiveTab = (v: string) => { setActiveTabRaw(v); setCurrentPage(0); };
  const [searchText, setSearchText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [contentTypeFilter, setContentTypeFilter] = useState("all");
  const [geoFilter, setGeoFilter] = useState("all");
  const [geoSecondaryFilter, setGeoSecondaryFilter] = useState("all");
  const [publishStatusFilter, setPublishStatusFilter] = useState("all");
  const [policyStatusFilter, setPolicyStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("");
  const [editorFilter, setEditorFilter] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [suppressTarget, setSuppressTarget] = useState<string | null>(null);
  const [suppressReason, setSuppressReason] = useState("");
  const [routingIssuesOnly, setRoutingIssuesOnly] = useState(false);
  const [lowConfidenceOnly, setLowConfidenceOnly] = useState(false);
  const [lowGeoPrecisionOnly, setLowGeoPrecisionOnly] = useState(false);
  const [integrityFlagFilter, setIntegrityFlagFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [expandedRouting, setExpandedRouting] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [updatedFrom, setUpdatedFrom] = useState("");
  const [updatedTo, setUpdatedTo] = useState("");
  const [subcategoryFilter, setSubcategoryFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const PAGE_SIZE = 50;

  const filterDeps = [searchText, categoryFilter, contentTypeFilter, geoFilter, geoSecondaryFilter, publishStatusFilter, policyStatusFilter, sourceFilter, editorFilter, subcategoryFilter, sortBy, routingIssuesOnly, lowConfidenceOnly, lowGeoPrecisionOnly, integrityFlagFilter, dateFrom, dateTo, updatedFrom, updatedTo];
  useEffect(() => { setCurrentPage(0); }, filterDeps);

  const { data: zonesData } = useQuery<Record<string, unknown>>({
    queryKey: ["/api/zones", cityId],
    queryFn: async () => {
      const res = await fetch(`/api/zones?cityId=${cityId || ""}`, { credentials: "include" });
      if (!res.ok) return { zones: [] };
      return res.json();
    },
    enabled: !!cityId,
  });

  const zones: { slug: string; name: string }[] = ((zonesData?.zones || []) as Record<string, string>[]).map((z) => ({ slug: z.slug, name: z.name }));

  const activeFilterCount = [
    categoryFilter !== "all",
    contentTypeFilter !== "all",
    geoFilter !== "all",
    geoSecondaryFilter !== "all",
    publishStatusFilter !== "all",
    policyStatusFilter !== "all",
    !!sourceFilter,
    !!editorFilter,
    !!subcategoryFilter,
    routingIssuesOnly,
    lowConfidenceOnly,
    lowGeoPrecisionOnly,
    integrityFlagFilter !== "" && integrityFlagFilter !== "all",
    !!dateFrom,
    !!dateTo,
    !!updatedFrom,
    !!updatedTo,
  ].filter(Boolean).length;

  const { data, isLoading, refetch } = useQuery<Record<string, unknown>>({
    queryKey: ["/api/admin/intelligence/editorial-queue", cityId, activeTab, searchText, categoryFilter, contentTypeFilter, geoFilter, geoSecondaryFilter, publishStatusFilter, policyStatusFilter, sourceFilter, editorFilter, subcategoryFilter, sortBy, routingIssuesOnly, lowConfidenceOnly, lowGeoPrecisionOnly, integrityFlagFilter, dateFrom, dateTo, updatedFrom, updatedTo, currentPage],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      if (activeTab !== "ALL") params.set("queueStatus", activeTab);
      if (searchText) params.set("search", searchText);
      if (categoryFilter !== "all") params.set("categoryCoreSlug", categoryFilter);
      if (contentTypeFilter !== "all") params.set("contentType", contentTypeFilter);
      if (geoFilter !== "all") params.set("geoPrimarySlug", geoFilter);
      if (geoSecondaryFilter !== "all") params.set("geoSecondarySlug", geoSecondaryFilter);
      if (publishStatusFilter !== "all") params.set("publishStatus", publishStatusFilter);
      if (policyStatusFilter !== "all") params.set("policyStatus", policyStatusFilter);
      if (sourceFilter) params.set("sourceName", sourceFilter);
      if (editorFilter) params.set("lastEditedBy", editorFilter);
      if (subcategoryFilter) params.set("categorySubSlug", subcategoryFilter);
      if (routingIssuesOnly) params.set("hasRoutingIssues", "true");
      if (lowConfidenceOnly) params.set("lowConfidence", "true");
      if (lowGeoPrecisionOnly) params.set("lowGeoPrecision", "true");
      if (integrityFlagFilter && integrityFlagFilter !== "all") params.set("integrityFlag", integrityFlagFilter);
      if (dateFrom) params.set("createdAfter", dateFrom);
      if (dateTo) params.set("createdBefore", dateTo);
      if (updatedFrom) params.set("updatedAfter", updatedFrom);
      if (updatedTo) params.set("updatedBefore", updatedTo);
      params.set("sortBy", sortBy);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(currentPage * PAGE_SIZE));
      const res = await fetch(`/api/admin/intelligence/editorial-queue?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch editorial queue");
      return res.json();
    },
  });

  const items: Record<string, unknown>[] = (data?.items || []) as Record<string, unknown>[];
  const total = (data?.total || 0) as number;
  const statusCounts = (data?.statusCounts || {}) as Record<string, number>;

  const quickActionMutation = useMutation({
    mutationFn: async ({ id, action, reason }: { id: string; action: string; reason?: string }) => {
      const res = await apiRequest("POST", `/api/admin/intelligence/rss-items/${id}/quick-action`, { action, reason });
      return res.json();
    },
    onSuccess: (data: Record<string, unknown>) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/intelligence/editorial-queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/intelligence/review-queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/intelligence/rss-items"] });
      const warnings = data.integrityWarnings as string[] | undefined;
      if (warnings && warnings.length > 0) {
        toast({
          title: `Action applied: ${data.action}`,
          description: `Integrity: ${warnings.join(", ")}`,
          variant: "destructive",
        });
      } else {
        toast({ title: `Action applied: ${data.action}` });
      }
    },
    onError: (err: Error) => toast({ title: "Action failed", description: err.message, variant: "destructive" }),
  });

  const getTabCount = (status: string) => {
    if (status === "ALL") {
      return Object.values(statusCounts).reduce((s, c) => s + c, 0);
    }
    return statusCounts[status] || 0;
  };

  const clearFilters = () => {
    setCategoryFilter("all");
    setContentTypeFilter("all");
    setGeoFilter("all");
    setGeoSecondaryFilter("all");
    setPublishStatusFilter("all");
    setPolicyStatusFilter("all");
    setSourceFilter("");
    setEditorFilter("");
    setSubcategoryFilter("");
    setRoutingIssuesOnly(false);
    setLowConfidenceOnly(false);
    setLowGeoPrecisionOnly(false);
    setIntegrityFlagFilter("");
    setDateFrom("");
    setDateTo("");
    setUpdatedFrom("");
    setUpdatedTo("");
    setCurrentPage(0);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (currentPage > 0 && currentPage >= totalPages) {
      setCurrentPage(Math.max(0, totalPages - 1));
    }
  }, [totalPages, currentPage]);

  return (
    <div className="space-y-4" data-testid="review-queue-tab">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            data-testid="input-queue-search"
            className="pl-9"
            placeholder="Search content..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
          />
        </div>
        <Button
          variant={showFilters ? "secondary" : "outline"}
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          data-testid="button-toggle-filters"
        >
          <Filter className="w-4 h-4 mr-1" />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-1 text-xs bg-blue-100 text-blue-700 rounded-full px-1.5">{activeFilterCount}</span>
          )}
        </Button>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[160px]" data-testid="select-queue-sort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt">Newest First</SelectItem>
            <SelectItem value="publishedAt">Published Date</SelectItem>
            <SelectItem value="updatedAt">Last Updated</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh-queue">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {showFilters && (
        <div className="p-3 rounded border border-border bg-muted/30 space-y-3" data-testid="filter-panel">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Advanced Filters</span>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
                <X className="w-3 h-3 mr-1" /> Clear all
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger data-testid="select-queue-category">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={contentTypeFilter} onValueChange={setContentTypeFilter}>
              <SelectTrigger data-testid="select-queue-content-type">
                <SelectValue placeholder="Content Type" />
              </SelectTrigger>
              <SelectContent>
                {CONTENT_TYPES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={geoFilter} onValueChange={setGeoFilter}>
              <SelectTrigger data-testid="select-queue-geo">
                <SelectValue placeholder="Primary Zone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Zones</SelectItem>
                {zones.map(z => (
                  <SelectItem key={z.slug} value={z.slug}>{z.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={geoSecondaryFilter} onValueChange={setGeoSecondaryFilter}>
              <SelectTrigger data-testid="select-queue-geo-secondary">
                <SelectValue placeholder="Secondary Zone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Secondary Zones</SelectItem>
                {zones.map(z => (
                  <SelectItem key={z.slug} value={z.slug}>{z.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Select value={publishStatusFilter} onValueChange={setPublishStatusFilter}>
              <SelectTrigger data-testid="select-queue-publish-status">
                <SelectValue placeholder="Publish Status" />
              </SelectTrigger>
              <SelectContent>
                {PUBLISH_STATUSES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={policyStatusFilter} onValueChange={setPolicyStatusFilter}>
              <SelectTrigger data-testid="select-queue-policy-status">
                <SelectValue placeholder="Policy Status" />
              </SelectTrigger>
              <SelectContent>
                {POLICY_STATUSES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value)}
              placeholder="Source name..."
              data-testid="input-source-filter"
            />
            <Input
              value={editorFilter}
              onChange={e => setEditorFilter(e.target.value)}
              placeholder="Last edited by..."
              data-testid="input-editor-filter"
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Input
              value={subcategoryFilter}
              onChange={e => setSubcategoryFilter(e.target.value)}
              placeholder="Subcategory slug..."
              data-testid="input-subcategory-filter"
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Created from</span>
              <Input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                data-testid="input-date-from"
              />
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Created to</span>
              <Input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                data-testid="input-date-to"
              />
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Updated from</span>
              <Input
                type="date"
                value={updatedFrom}
                onChange={e => setUpdatedFrom(e.target.value)}
                data-testid="input-updated-from"
              />
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Updated to</span>
              <Input
                type="date"
                value={updatedTo}
                onChange={e => setUpdatedTo(e.target.value)}
                data-testid="input-updated-to"
              />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Switch
                checked={routingIssuesOnly}
                onCheckedChange={setRoutingIssuesOnly}
                data-testid="switch-routing-issues"
              />
              Routing issues only
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Switch
                checked={lowConfidenceOnly}
                onCheckedChange={setLowConfidenceOnly}
                data-testid="switch-low-confidence"
              />
              Low confidence only
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Switch
                checked={lowGeoPrecisionOnly}
                onCheckedChange={setLowGeoPrecisionOnly}
                data-testid="switch-low-geo-precision"
              />
              Low geo precision
            </label>
            <Select value={integrityFlagFilter} onValueChange={setIntegrityFlagFilter}>
              <SelectTrigger className="w-[180px] h-9" data-testid="select-integrity-flag">
                <SelectValue placeholder="Integrity flag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All flags</SelectItem>
                <SelectItem value="MISSING_CATEGORY">Missing category</SelectItem>
                <SelectItem value="MISSING_GEO">Missing geo</SelectItem>
                <SelectItem value="LOW_CATEGORY_CONFIDENCE">Low category confidence</SelectItem>
                <SelectItem value="LOW_GEO_CONFIDENCE">Low geo confidence</SelectItem>
                <SelectItem value="LOW_GEO_PRECISION">Low geo precision</SelectItem>
                <SelectItem value="LOW_POLICY_CONFIDENCE">Low policy confidence</SelectItem>
                <SelectItem value="ROUTING_ISSUE">Routing issue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap" data-testid="tabs-queue-status">
          {QUEUE_TABS.map(tab => (
            <TabsTrigger key={tab.value} value={tab.value} data-testid={`tab-${tab.value.toLowerCase()}`}>
              {tab.label}
              {getTabCount(tab.value) > 0 && (
                <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5">{getTabCount(tab.value)}</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {QUEUE_TABS.map(tab => (
          <TabsContent key={tab.value} value={tab.value}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">{total} item{total !== 1 ? "s" : ""}</span>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {isLoading && <div className="text-center py-8 text-muted-foreground">Loading editorial queue...</div>}

      <div className="space-y-2">
        {items.map((item) => {
          const reasons = getReviewReasons(item);
          const confidence = (item.aiConfidence || {}) as Record<string, number>;
          const id = item.id as string;
          const qs = item.queueStatus as string;
          const isRoutingExpanded = expandedRouting === id;
          return (
            <Card key={id} data-testid={`card-queue-${id}`}>
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  {(item.imageUrl as string) && (
                    <img
                      src={item.imageUrl as string}
                      alt=""
                      className="w-16 h-16 rounded object-cover shrink-0"
                      data-testid={`img-queue-${id}`}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{item.title as string}</span>
                      <QueueStatusBadge status={qs} />
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>{item.sourceName as string}</span>
                      {item.publishedAt && <span>{new Date(item.publishedAt as string).toLocaleDateString()}</span>}
                      {item.categoryCoreSlug && <Badge variant="outline" className="text-xs">{item.categoryCoreSlug as string}</Badge>}
                      {item.geoPrimarySlug && <Badge variant="outline" className="text-xs">{item.geoPrimarySlug as string}</Badge>}
                      {item.contentType && <Badge variant="outline" className="text-xs">{item.contentType as string}</Badge>}
                      <a href={item.url as string} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 underline">
                        Source <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    {reasons.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {reasons.map((r, i) => (
                          <Badge key={i} variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                            {r}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {(item.aiSuggestedCategoryCoreSlug || item.aiSuggestedGeoPrimarySlug) && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        <div className="flex items-center gap-1 text-xs">
                          <Sparkles className="w-3 h-3 text-muted-foreground" />
                          <span className="text-muted-foreground">AI:</span>
                          {item.aiSuggestedCategoryCoreSlug && <Badge variant="outline" className="text-xs">{item.aiSuggestedCategoryCoreSlug as string}</Badge>}
                          {item.aiSuggestedGeoPrimarySlug && <Badge variant="outline" className="text-xs">{item.aiSuggestedGeoPrimarySlug as string}</Badge>}
                        </div>
                        <div className="flex gap-1">
                          <ConfidenceBadge value={confidence.category} label="Cat" />
                          <ConfidenceBadge value={confidence.geo} label="Geo" />
                          <ConfidenceBadge value={confidence.policy} label="Pol" />
                        </div>
                      </div>
                    )}

                    {item.suppressionReason && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-red-600">
                        <Ban className="w-3 h-3" />
                        <span>Suppressed: {item.suppressionReason as string}</span>
                        {item.suppressedBy && <span className="text-muted-foreground">by {item.suppressedBy as string}</span>}
                        {item.suppressedAt && <span className="text-muted-foreground">on {new Date(item.suppressedAt as string).toLocaleDateString()}</span>}
                      </div>
                    )}

                    {item.isEvergreen && (
                      <Badge variant="outline" className="text-xs mt-1 bg-emerald-50 text-emerald-700 border-emerald-200">Evergreen</Badge>
                    )}
                    {item.activeUntil && (
                      <span className="text-xs text-muted-foreground ml-2">
                        <Clock className="w-3 h-3 inline mr-0.5" />
                        Active until {new Date(item.activeUntil as string).toLocaleDateString()}
                      </span>
                    )}
                    {item.lastEditedBy && (
                      <span className="text-xs text-muted-foreground ml-2">
                        Last edited by {item.lastEditedBy as string}
                        {item.lastEditedAt && <> on {new Date(item.lastEditedAt as string).toLocaleDateString()}</>}
                      </span>
                    )}

                    <div className="mt-2">
                      <button
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setExpandedRouting(isRoutingExpanded ? null : id)}
                        data-testid={`button-routing-toggle-${id}`}
                      >
                        {isRoutingExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        Routing
                      </button>
                      {isRoutingExpanded && <InlineRoutingPanel itemId={id} />}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 shrink-0">
                    {(qs === "REVIEW_REQUIRED" || qs === "READY_TO_PUBLISH") && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-700 border-green-200"
                        onClick={() => quickActionMutation.mutate({ id, action: "approve-publish" })}
                        disabled={quickActionMutation.isPending}
                        data-testid={`button-approve-publish-${id}`}
                      >
                        <Check className="w-3 h-3 mr-1" /> Publish
                      </Button>
                    )}
                    {(qs === "REVIEW_REQUIRED" || qs === "READY_TO_PUBLISH") && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => quickActionMutation.mutate({ id, action: "approve-no-pulse" })}
                        disabled={quickActionMutation.isPending}
                        data-testid={`button-approve-nopulse-${id}`}
                      >
                        <EyeOff className="w-3 h-3 mr-1" /> No Pulse
                      </Button>
                    )}
                    {qs === "REVIEW_REQUIRED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-blue-700 border-blue-200"
                        onClick={() => quickActionMutation.mutate({ id, action: "ready-to-publish" })}
                        disabled={quickActionMutation.isPending}
                        data-testid={`button-ready-${id}`}
                      >
                        <Send className="w-3 h-3 mr-1" /> Ready
                      </Button>
                    )}
                    {qs === "PUBLISHED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => quickActionMutation.mutate({ id, action: "unpublish" })}
                        disabled={quickActionMutation.isPending}
                        data-testid={`button-unpublish-${id}`}
                      >
                        <RotateCcw className="w-3 h-3 mr-1" /> Unpublish
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingItem(item)}
                      data-testid={`button-edit-review-${id}`}
                    >
                      <Edit className="w-3 h-3 mr-1" /> Edit
                    </Button>
                    {(qs === "PUBLISHED" || qs === "PULSE_SUPPRESSED" || qs === "READY_TO_PUBLISH") && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-orange-700 border-orange-200"
                        onClick={() => quickActionMutation.mutate({ id, action: "send-back-to-review" })}
                        disabled={quickActionMutation.isPending}
                        data-testid={`button-send-back-review-${id}`}
                      >
                        <Undo2 className="w-3 h-3 mr-1" /> Back to Review
                      </Button>
                    )}
                    {qs !== "SUPPRESSED" && qs !== "ARCHIVED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-700 border-red-200"
                        onClick={() => { setSuppressTarget(id); setSuppressReason(""); }}
                        disabled={quickActionMutation.isPending}
                        data-testid={`button-suppress-${id}`}
                      >
                        <Ban className="w-3 h-3 mr-1" /> Suppress
                      </Button>
                    )}
                    {qs !== "ARCHIVED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-gray-500 border-gray-200"
                        onClick={() => quickActionMutation.mutate({ id, action: "archive" })}
                        disabled={quickActionMutation.isPending}
                        data-testid={`button-archive-${id}`}
                      >
                        <Archive className="w-3 h-3 mr-1" /> Archive
                      </Button>
                    )}
                    {(qs === "SUPPRESSED" || qs === "ARCHIVED" || qs === "UNPUBLISHED") && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-blue-700 border-blue-200"
                        onClick={() => quickActionMutation.mutate({ id, action: "approve-publish" })}
                        disabled={quickActionMutation.isPending}
                        data-testid={`button-republish-${id}`}
                      >
                        <RefreshCw className="w-3 h-3 mr-1" /> Republish
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between py-3" data-testid="pagination-controls">
          <span className="text-sm text-muted-foreground">
            Page {currentPage + 1} of {totalPages} ({total} total)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 0}
              onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
              data-testid="button-page-prev"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages - 1}
              onClick={() => setCurrentPage(p => p + 1)}
              data-testid="button-page-next"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {items.length === 0 && !isLoading && (
        <div className="text-center py-12 text-muted-foreground">
          {activeTab === "ALL" ? (
            <>
              <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <div className="font-medium">No content in queue</div>
            </>
          ) : activeTab === "REVIEW_REQUIRED" ? (
            <>
              <Check className="w-8 h-8 mx-auto mb-2 text-green-500" />
              <div className="font-medium">Review queue is clear</div>
              <div className="text-sm mt-1">All content has been reviewed</div>
            </>
          ) : (
            <>
              <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <div className="font-medium">No items with this status</div>
            </>
          )}
        </div>
      )}

      {editingItem && (
        <EditDialog
          item={editingItem}
          zones={zones}
          open={!!editingItem}
          onClose={() => {
            setEditingItem(null);
            queryClient.invalidateQueries({ queryKey: ["/api/admin/intelligence/editorial-queue"] });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/intelligence/review-queue"] });
          }}
        />
      )}

      <Dialog open={!!suppressTarget} onOpenChange={(open) => { if (!open) setSuppressTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suppress Content</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label className="text-sm font-medium">Reason for suppression</label>
            <Textarea
              value={suppressReason}
              onChange={(e) => setSuppressReason(e.target.value)}
              placeholder="Enter the reason for suppressing this content..."
              data-testid="input-suppress-reason"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuppressTarget(null)} data-testid="button-suppress-cancel">
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!suppressReason.trim() || quickActionMutation.isPending}
              onClick={() => {
                if (suppressTarget && suppressReason.trim()) {
                  quickActionMutation.mutate(
                    { id: suppressTarget, action: "suppress", reason: suppressReason.trim() },
                    { onSuccess: () => setSuppressTarget(null) }
                  );
                }
              }}
              data-testid="button-suppress-confirm"
            >
              Suppress
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
