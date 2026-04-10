import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Edit, Save, X, ChevronDown, ChevronRight, ExternalLink, Sparkles,
  Image, FileText, Clock, MapPin, Radio, Layers, History, Ban, CheckCircle,
  AlertTriangle, Undo2, Filter, Copy, ShieldAlert, Gauge, BarChart3,
} from "lucide-react";

const INTEGRITY_FLAG_FILTERS = [
  { value: "all", label: "All Flags", icon: Filter },
  { value: "duplicate_candidate", label: "Duplicate", icon: Copy },
  { value: "low_trust_source", label: "Low Trust", icon: ShieldAlert },
  { value: "throttled", label: "Throttled", icon: Gauge },
  { value: "OVERREPRESENTED_SOURCE", label: "Overrep. Source", icon: BarChart3 },
  { value: "OVERREPRESENTED_CATEGORY", label: "Overrep. Category", icon: BarChart3 },
  { value: "OVERREPRESENTED_GEO", label: "Overrep. Geo", icon: BarChart3 },
];

const CORE_CATEGORIES = [
  { slug: "news", label: "News" },
  { slug: "business", label: "Business & Economy" },
  { slug: "food-dining", label: "Food & Dining" },
  { slug: "entertainment", label: "Entertainment" },
  { slug: "arts-culture", label: "Arts & Culture" },
  { slug: "sports", label: "Sports" },
  { slug: "community", label: "Community" },
  { slug: "education", label: "Education" },
  { slug: "health-wellness", label: "Health & Wellness" },
  { slug: "real-estate", label: "Real Estate" },
  { slug: "government", label: "Government & Policy" },
  { slug: "weather", label: "Weather" },
  { slug: "technology", label: "Technology & Innovation" },
  { slug: "faith", label: "Faith & Religion" },
  { slug: "development", label: "Development & Growth" },
  { slug: "lifestyle", label: "Lifestyle" },
  { slug: "nightlife", label: "Nightlife" },
  { slug: "family", label: "Family & Kids" },
  { slug: "outdoors", label: "Outdoors & Nature" },
  { slug: "pets-animals", label: "Pets & Animals" },
  { slug: "shopping-retail", label: "Shopping & Retail" },
  { slug: "automotive", label: "Automotive & Transit" },
  { slug: "seniors", label: "Seniors & Aging" },
  { slug: "opinion", label: "Opinion & Editorial" },
  { slug: "events", label: "Events & Things To Do" },
  { slug: "travel", label: "Travel & Tourism" },
  { slug: "public-safety", label: "Public Safety" },
  { slug: "shopping", label: "Shopping" },
];

const CONTENT_TYPES = [
  { value: "story", label: "Story" },
  { value: "event", label: "Event" },
  { value: "job", label: "Job" },
  { value: "business-update", label: "Business Update" },
  { value: "community-update", label: "Community Update" },
  { value: "listing", label: "Listing" },
  { value: "deal", label: "Deal" },
  { value: "announcement", label: "Announcement" },
];

const PUBLISH_STATUSES = [
  { value: "DRAFT", label: "Draft" },
  { value: "REVIEW_NEEDED", label: "Review Needed" },
  { value: "PUBLISHED", label: "Published" },
  { value: "ARCHIVED", label: "Archived" },
  { value: "SUPPRESSED", label: "Suppressed" },
];

const POLICY_STATUSES = [
  { value: "ALLOW", label: "Allow" },
  { value: "REVIEW_NEEDED", label: "Review Needed" },
  { value: "SUPPRESS", label: "Suppress" },
];

function ConfidenceBadge({ value }: { value: number | undefined }) {
  if (value === undefined || value === null) return null;
  const pct = Math.round(value * 100);
  const variant = pct >= 70 ? "text-green-700 bg-green-50 border-green-200" :
    pct >= 40 ? "text-yellow-700 bg-yellow-50 border-yellow-200" :
    "text-red-700 bg-red-50 border-red-200";
  return <span className={`text-xs px-1.5 py-0.5 rounded border ${variant}`}>{pct}%</span>;
}

function AiVsFinal({ label, aiValue, finalValue, confidence }: { label: string; aiValue: string | null | undefined; finalValue: string | null | undefined; confidence?: number }) {
  const aiDisplay = aiValue || "--";
  const finalDisplay = finalValue || "--";
  const isDifferent = aiValue && finalValue && aiValue !== finalValue;
  return (
    <div className="flex items-start gap-3 text-sm py-1">
      <span className="w-28 text-muted-foreground shrink-0">{label}</span>
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-12">Final:</span>
          <span className={`font-medium truncate ${isDifferent ? "text-blue-700" : ""}`}>{finalDisplay}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-12 flex items-center gap-1"><Sparkles className="w-3 h-3" />AI:</span>
          <span className="text-muted-foreground truncate">{aiDisplay}</span>
          {confidence !== undefined && <ConfidenceBadge value={confidence} />}
        </div>
      </div>
    </div>
  );
}

interface EditFormState {
  title: string;
  rewrittenSummary: string;
  localArticleBody: string;
  contentType: string;
  categoryCoreSlug: string;
  categorySubSlug: string;
  geoPrimarySlug: string;
  geoSecondarySlug: string;
  hubSlug: string;
  countySlug: string;
  venueName: string;
  venueSlug: string;
  venueAddress: string;
  publishStatus: string;
  policyStatus: string;
  pulseEligible: boolean;
  imageUrl: string;
  imageCredit: string;
  sourceAttribution: string;
  activeUntil: string;
  isEvergreen: boolean;
  suppressionReason: string;
}

function RoutingPanel({ itemId }: { itemId: string }) {
  const { data, isLoading } = useQuery<Record<string, unknown>>({
    queryKey: ["/api/admin/intelligence/rss-items", itemId, "routing"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/intelligence/rss-items/${itemId}/routing`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load routing");
      return res.json();
    },
  });

  if (isLoading) return <div className="text-xs text-muted-foreground py-2">Loading routing...</div>;
  if (!data) return null;

  const surfaces = data.surfaces as Record<string, Record<string, unknown>>;
  const lifecycle = data.lifecycle as Record<string, unknown>;

  const SurfaceRow = ({ name, icon, eligible, detail, reasons }: { name: string; icon: React.ReactNode; eligible: boolean; detail: string; reasons?: string[] }) => (
    <div className="flex items-center gap-2 py-1.5 border-b last:border-0">
      <div className="w-5 h-5 flex items-center justify-center shrink-0">{icon}</div>
      <span className="text-sm flex-1">{name}</span>
      {eligible ? (
        <div className="flex items-center gap-1">
          <CheckCircle className="w-3.5 h-3.5 text-green-600" />
          <span className="text-xs text-green-700">{detail}</span>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <X className="w-3.5 h-3.5 text-red-400" />
          <span className="text-xs text-muted-foreground">{reasons && reasons.length > 0 ? reasons.join(", ") : detail}</span>
        </div>
      )}
    </div>
  );

  const pulse = surfaces?.pulse || {};
  const hub = surfaces?.hub || {};
  const category = surfaces?.category || {};
  const map = surfaces?.map || {};
  const article = surfaces?.article || {};
  const search = surfaces?.search || {};

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">Surface Routing</div>
      <div className="border rounded-lg p-3">
        <SurfaceRow
          name="Pulse Feed"
          icon={<Radio className="w-4 h-4 text-purple-600" />}
          eligible={pulse.eligible as boolean}
          detail={pulse.eligible ? "Live on Pulse" : "Not eligible"}
          reasons={pulse.reasons as string[]}
        />
        <SurfaceRow
          name="Hub Page"
          icon={<Layers className="w-4 h-4 text-blue-600" />}
          eligible={hub.eligible as boolean}
          detail={hub.eligible ? `Zone: ${hub.zone || hub.hub}` : "No geo routing"}
          reasons={hub.reasons as string[]}
        />
        <SurfaceRow
          name="Category Page"
          icon={<FileText className="w-4 h-4 text-amber-600" />}
          eligible={category.eligible as boolean}
          detail={category.eligible ? `${category.core}${category.sub ? ` / ${category.sub}` : ""}` : "No category"}
          reasons={category.reasons as string[]}
        />
        <SurfaceRow
          name="Map View"
          icon={<MapPin className="w-4 h-4 text-red-600" />}
          eligible={map.eligible as boolean}
          detail={map.eligible ? String(map.venue) : "No venue data"}
          reasons={map.reasons as string[]}
        />
        <SurfaceRow
          name="Article Page"
          icon={<FileText className="w-4 h-4 text-teal-600" />}
          eligible={article.eligible as boolean}
          detail={article.eligible ? String(article.slug) : "No article body"}
          reasons={article.reasons as string[]}
        />
        <SurfaceRow
          name="Search"
          icon={<Search className="w-4 h-4 text-indigo-600" />}
          eligible={search.eligible as boolean}
          detail={search.eligible ? "Searchable" : "Not searchable"}
          reasons={search.reasons as string[]}
        />
      </div>

      {lifecycle && (
        <div className="border rounded-lg p-3 space-y-1">
          <div className="text-sm font-medium mb-1">Lifecycle</div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground w-24">Evergreen:</span>
            <span>{lifecycle.isEvergreen ? "Yes" : "No"}</span>
          </div>
          {lifecycle.activeUntil && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground w-24">Active Until:</span>
              <span className={lifecycle.isExpired ? "text-red-600 font-medium" : ""}>{new Date(lifecycle.activeUntil as string).toLocaleDateString()}</span>
              {lifecycle.isExpired && <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200">Expired</Badge>}
            </div>
          )}
          {lifecycle.publishedAt && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground w-24">Published:</span>
              <span>{new Date(lifecycle.publishedAt as string).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function VersionHistory({ itemId }: { itemId: string }) {
  const { data, isLoading } = useQuery<Record<string, unknown>>({
    queryKey: ["/api/admin/intelligence/rss-items", itemId, "versions"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/intelligence/rss-items/${itemId}/versions`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load versions");
      return res.json();
    },
  });

  if (isLoading) return <div className="text-xs text-muted-foreground py-2">Loading version history...</div>;
  if (!data) return null;

  const current = data.current as Record<string, string | null>;
  const original = data.original as Record<string, string | null>;
  const aiGenerated = data.aiGenerated as Record<string, string | null>;
  const editHistory = (data.timeline || []) as Array<{ type?: string; fieldsChanged: string[]; editorId: string; editedAt: string; previousValues: Record<string, unknown> | null; newValues: Record<string, unknown> | null; detail?: string }>;
  const suppression = data.suppression as Record<string, unknown> | null;

  const titleChanged = current?.title !== original?.title;
  const summaryChanged = current?.summary !== original?.summary;

  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm font-medium mb-2">Content Versions</div>
        <div className="border rounded-lg divide-y">
          <div className="p-3">
            <div className="text-xs font-medium text-muted-foreground mb-1">Current Title</div>
            <div className="text-sm">{current?.title || "--"}</div>
            {titleChanged && (
              <>
                <div className="text-xs font-medium text-muted-foreground mt-2 mb-1">Original Title</div>
                <div className="text-sm text-muted-foreground">{original?.title || "--"}</div>
              </>
            )}
            {aiGenerated?.title && (
              <>
                <div className="text-xs font-medium text-muted-foreground mt-2 mb-1 flex items-center gap-1"><Sparkles className="w-3 h-3" /> AI Title</div>
                <div className="text-sm text-muted-foreground">{aiGenerated.title}</div>
              </>
            )}
          </div>
          <div className="p-3">
            <div className="text-xs font-medium text-muted-foreground mb-1">Current Summary</div>
            <div className="text-sm line-clamp-3">{current?.summary || "--"}</div>
            {summaryChanged && (
              <>
                <div className="text-xs font-medium text-muted-foreground mt-2 mb-1">Original Summary</div>
                <div className="text-sm text-muted-foreground line-clamp-3">{original?.summary || "--"}</div>
              </>
            )}
            {aiGenerated?.summary && (
              <>
                <div className="text-xs font-medium text-muted-foreground mt-2 mb-1 flex items-center gap-1"><Sparkles className="w-3 h-3" /> AI Summary</div>
                <div className="text-sm text-muted-foreground line-clamp-3">{aiGenerated.summary}</div>
              </>
            )}
          </div>
        </div>
      </div>

      {suppression && (
        <div className="border rounded-lg p-3 bg-red-50/50">
          <div className="text-sm font-medium text-red-700 mb-1 flex items-center gap-1"><Ban className="w-4 h-4" /> Suppression Details</div>
          <div className="text-xs space-y-1">
            <div><span className="text-muted-foreground">Reason:</span> {(suppression.reason as string) || "No reason provided"}</div>
            <div><span className="text-muted-foreground">By:</span> {(suppression.by as string) || "Unknown"}</div>
            {suppression.at && <div><span className="text-muted-foreground">At:</span> {new Date(suppression.at as string).toLocaleString()}</div>}
          </div>
        </div>
      )}

      <div>
        <div className="text-sm font-medium mb-2">Edit Timeline</div>
        {editHistory.length === 0 ? (
          <div className="text-xs text-muted-foreground">No edit history</div>
        ) : (
          <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
            {[...editHistory].reverse().map((entry, i) => {
              const isSystem = entry.type && entry.type !== "edit";
              const eventLabels: Record<string, string> = {
                ingested: "Content Ingested",
                ai_classified: "AI Classification Applied",
                published: "Published",
                suppressed: "Suppressed",
              };
              const dotColor = isSystem ? "bg-gray-400" : "bg-blue-500";
              return (
                <div key={i} className="p-2 flex items-start gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${dotColor} mt-1.5 shrink-0`} />
                  <div className="flex-1 min-w-0">
                    {isSystem ? (
                      <>
                        <div className="text-xs font-medium">{eventLabels[entry.type || ""] || entry.type}</div>
                        {entry.detail && <div className="text-xs text-muted-foreground">{entry.detail}</div>}
                      </>
                    ) : (
                      <>
                        <div className="text-xs">{(entry.fieldsChanged || []).join(", ")}</div>
                        {entry.previousValues && entry.newValues && (
                          <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                            {Object.keys(entry.previousValues).map((field) => (
                              <div key={field}>
                                <span className="font-medium">{field}:</span>{" "}
                                <span className="line-through">{String(entry.previousValues?.[field] ?? "")}</span>
                                {" → "}
                                <span>{String(entry.newValues?.[field] ?? "")}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {entry.editorId} - {new Date(entry.editedAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function EditDialog({ item, zones, open, onClose }: { item: Record<string, unknown>; zones: { slug: string; name: string }[]; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [dialogTab, setDialogTab] = useState("content");
  const [form, setForm] = useState<EditFormState>({
    title: (item.title as string) || "",
    rewrittenSummary: (item.rewrittenSummary as string) || "",
    localArticleBody: (item.localArticleBody as string) || "",
    contentType: (item.contentType as string) || "story",
    categoryCoreSlug: (item.categoryCoreSlug as string) || "",
    categorySubSlug: (item.categorySubSlug as string) || "",
    geoPrimarySlug: (item.geoPrimarySlug as string) || "",
    geoSecondarySlug: (item.geoSecondarySlug as string) || "",
    hubSlug: (item.hubSlug as string) || "",
    countySlug: (item.countySlug as string) || "",
    venueName: (item.venueName as string) || "",
    venueSlug: (item.venueSlug as string) || "",
    venueAddress: (item.venueAddress as string) || "",
    publishStatus: (item.publishStatus as string) || "DRAFT",
    policyStatus: (item.policyStatus as string) || "ALLOW",
    pulseEligible: item.pulseEligible !== false,
    imageUrl: (item.imageUrl as string) || "",
    imageCredit: (item.imageCredit as string) || "",
    sourceAttribution: (item.sourceAttribution as string) || "",
    activeUntil: item.activeUntil ? new Date(item.activeUntil as string).toISOString().split("T")[0] : "",
    isEvergreen: item.isEvergreen === true,
    suppressionReason: (item.suppressionReason as string) || "",
  });

  const editMutation = useMutation({
    mutationFn: async (data: Partial<EditFormState>) => {
      const res = await apiRequest("PATCH", `/api/admin/intelligence/rss-items/${item.id}/edit`, data);
      return res.json();
    },
    onSuccess: (data: Record<string, unknown>) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/intelligence/rss-items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/intelligence/review-queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/intelligence/editorial-queue"] });
      toast({ title: `Updated ${(data.changedFields as string[])?.length || 0} field(s)` });
      onClose();
    },
    onError: (err: Error) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  const sendBackMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/intelligence/rss-items/${item.id}/quick-action`, { action: "send-back-to-review" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/intelligence/rss-items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/intelligence/review-queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/intelligence/editorial-queue"] });
      toast({ title: "Sent back to review" });
      onClose();
    },
    onError: (err: Error) => toast({ title: "Action failed", description: err.message, variant: "destructive" }),
  });

  const handleSave = () => {
    const payload: Record<string, unknown> = {};
    if (form.title !== ((item.title as string) || "")) payload.title = form.title;
    if (form.rewrittenSummary !== ((item.rewrittenSummary as string) || "")) payload.rewrittenSummary = form.rewrittenSummary;
    if (form.localArticleBody !== ((item.localArticleBody as string) || "")) payload.localArticleBody = form.localArticleBody;
    if (form.contentType !== ((item.contentType as string) || "story")) payload.contentType = form.contentType;
    if (form.categoryCoreSlug !== ((item.categoryCoreSlug as string) || "")) payload.categoryCoreSlug = form.categoryCoreSlug || null;
    if (form.categorySubSlug !== ((item.categorySubSlug as string) || "")) payload.categorySubSlug = form.categorySubSlug || null;
    if (form.geoPrimarySlug !== ((item.geoPrimarySlug as string) || "")) payload.geoPrimarySlug = form.geoPrimarySlug || null;
    if (form.geoSecondarySlug !== ((item.geoSecondarySlug as string) || "")) payload.geoSecondarySlug = form.geoSecondarySlug || null;
    if (form.hubSlug !== ((item.hubSlug as string) || "")) payload.hubSlug = form.hubSlug || null;
    if (form.countySlug !== ((item.countySlug as string) || "")) payload.countySlug = form.countySlug || null;
    if (form.venueName !== ((item.venueName as string) || "")) payload.venueName = form.venueName || null;
    if (form.venueSlug !== ((item.venueSlug as string) || "")) payload.venueSlug = form.venueSlug || null;
    if (form.venueAddress !== ((item.venueAddress as string) || "")) payload.venueAddress = form.venueAddress || null;
    if (form.publishStatus !== ((item.publishStatus as string) || "DRAFT")) payload.publishStatus = form.publishStatus;
    if (form.policyStatus !== ((item.policyStatus as string) || "ALLOW")) payload.policyStatus = form.policyStatus;
    if (form.pulseEligible !== (item.pulseEligible !== false)) payload.pulseEligible = form.pulseEligible;
    if (form.imageUrl !== ((item.imageUrl as string) || "")) payload.imageUrl = form.imageUrl || null;
    if (form.imageCredit !== ((item.imageCredit as string) || "")) payload.imageCredit = form.imageCredit || null;
    if (form.sourceAttribution !== ((item.sourceAttribution as string) || "")) payload.sourceAttribution = form.sourceAttribution || null;
    if (form.isEvergreen !== (item.isEvergreen === true)) payload.isEvergreen = form.isEvergreen;
    if (form.suppressionReason !== ((item.suppressionReason as string) || "")) payload.suppressionReason = form.suppressionReason || null;

    const origActiveUntil = item.activeUntil ? new Date(item.activeUntil as string).toISOString().split("T")[0] : "";
    if (form.activeUntil !== origActiveUntil) payload.activeUntil = form.activeUntil || null;

    if (Object.keys(payload).length === 0) {
      toast({ title: "No changes to save" });
      return;
    }
    editMutation.mutate(payload as Partial<EditFormState>);
  };

  const updateField = (field: keyof EditFormState, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const confidence = (item.aiConfidence || {}) as Record<string, number>;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">Edit Content</DialogTitle>
        </DialogHeader>

        <Tabs value={dialogTab} onValueChange={setDialogTab}>
          <TabsList data-testid="tabs-edit-dialog">
            <TabsTrigger value="content" data-testid="tab-edit-content">
              <FileText className="w-3.5 h-3.5 mr-1" /> Content
            </TabsTrigger>
            <TabsTrigger value="routing" data-testid="tab-edit-routing">
              <Layers className="w-3.5 h-3.5 mr-1" /> Routing
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-edit-history">
              <History className="w-3.5 h-3.5 mr-1" /> History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="content">
            <div className="space-y-6">
              <div>
                <div className="text-sm font-medium mb-2">Content</div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Title</label>
                    <Input data-testid="input-edit-title" value={form.title} onChange={e => updateField("title", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Summary</label>
                    <Textarea data-testid="input-edit-summary" value={form.rewrittenSummary} onChange={e => updateField("rewrittenSummary", e.target.value)} rows={3} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Article Body</label>
                    <Textarea data-testid="input-edit-body" value={form.localArticleBody} onChange={e => updateField("localArticleBody", e.target.value)} rows={5} />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Source: {item.sourceName as string} | <a href={item.url as string} target="_blank" rel="noopener noreferrer" className="underline">Original <ExternalLink className="w-3 h-3 inline" /></a>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="text-sm font-medium mb-2 flex items-center gap-1"><Image className="w-4 h-4" /> Image & Attribution</div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Image URL</label>
                      <div className="flex gap-2">
                        <Input data-testid="input-edit-image-url" value={form.imageUrl} onChange={e => updateField("imageUrl", e.target.value)} placeholder="https://..." className="flex-1" />
                        {form.imageUrl && (
                          <Button variant="outline" size="sm" className="text-red-600 border-red-200 shrink-0" onClick={() => updateField("imageUrl", "")} data-testid="button-remove-image">
                            <X className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {(form.imageUrl || (item.originalImageUrl as string)) && (
                      <div className="grid grid-cols-2 gap-2">
                        {(item.originalImageUrl as string) && (item.originalImageUrl as string) !== form.imageUrl && (
                          <div>
                            <span className="text-xs text-muted-foreground block mb-1">Original</span>
                            <img src={item.originalImageUrl as string} alt="" className="w-full h-24 object-cover rounded border opacity-60" data-testid="img-original-preview" />
                          </div>
                        )}
                        {form.imageUrl && (
                          <div>
                            <span className="text-xs text-muted-foreground block mb-1">Current</span>
                            <img src={form.imageUrl} alt="" className="w-full h-24 object-cover rounded border" data-testid="img-edit-preview" />
                          </div>
                        )}
                      </div>
                    )}
                    <div>
                      <label className="text-xs text-muted-foreground">Image Credit</label>
                      <Input data-testid="input-edit-image-credit" value={form.imageCredit} onChange={e => updateField("imageCredit", e.target.value)} placeholder="Photo by..." />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Source Attribution</label>
                      <Input data-testid="input-edit-source-attribution" value={form.sourceAttribution} onChange={e => updateField("sourceAttribution", e.target.value)} placeholder="Source credit..." />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium mb-2 flex items-center gap-1"><Clock className="w-4 h-4" /> Lifecycle</div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2">
                      <label className="text-xs text-muted-foreground">Evergreen Content</label>
                      <Switch data-testid="switch-evergreen" checked={form.isEvergreen} onCheckedChange={v => updateField("isEvergreen", v)} />
                    </div>
                    {!form.isEvergreen && (
                      <div>
                        <label className="text-xs text-muted-foreground">Active Until</label>
                        <Input data-testid="input-edit-active-until" type="date" value={form.activeUntil} onChange={e => updateField("activeUntil", e.target.value)} />
                      </div>
                    )}
                    <div>
                      <label className="text-xs text-muted-foreground">Suppression Reason</label>
                      <Textarea data-testid="input-edit-suppression-reason" value={form.suppressionReason} onChange={e => updateField("suppressionReason", e.target.value)} rows={2} placeholder="Reason for suppression (if applicable)..." />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="text-sm font-medium mb-2">Category Routing</div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Content Type</label>
                      <Select value={form.contentType} onValueChange={v => updateField("contentType", v)}>
                        <SelectTrigger data-testid="select-content-type"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CONTENT_TYPES.map(ct => <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Core Category</label>
                      <Select value={form.categoryCoreSlug || "_none"} onValueChange={v => updateField("categoryCoreSlug", v === "_none" ? "" : v)}>
                        <SelectTrigger data-testid="select-core-category"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">-- None --</SelectItem>
                          {CORE_CATEGORIES.map(c => <SelectItem key={c.slug} value={c.slug}>{c.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Sub Category</label>
                      <Input data-testid="input-sub-category" value={form.categorySubSlug} onChange={e => updateField("categorySubSlug", e.target.value)} placeholder="Sub-category slug" />
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                    <div className="text-xs font-medium mb-1 flex items-center gap-1"><Sparkles className="w-3 h-3" /> AI Suggestions</div>
                    <AiVsFinal label="Core" aiValue={item.aiSuggestedCategoryCoreSlug as string} finalValue={form.categoryCoreSlug} confidence={confidence.category} />
                    <AiVsFinal label="Sub" aiValue={item.aiSuggestedCategorySubSlug as string} finalValue={form.categorySubSlug} confidence={confidence.category} />
                    <AiVsFinal label="Type" aiValue={item.aiSuggestedContentType as string} finalValue={form.contentType} confidence={confidence.contentType} />
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium mb-2">Geo Routing</div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Primary Zone</label>
                      <Select value={form.geoPrimarySlug || "_none"} onValueChange={v => updateField("geoPrimarySlug", v === "_none" ? "" : v)}>
                        <SelectTrigger data-testid="select-geo-primary"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">-- None --</SelectItem>
                          {zones.map(z => <SelectItem key={z.slug} value={z.slug}>{z.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Secondary Zone</label>
                      <Select value={form.geoSecondarySlug || "_none"} onValueChange={v => updateField("geoSecondarySlug", v === "_none" ? "" : v)}>
                        <SelectTrigger data-testid="select-geo-secondary"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">-- None --</SelectItem>
                          {zones.map(z => <SelectItem key={z.slug} value={z.slug}>{z.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Hub Slug</label>
                      <Input data-testid="input-hub-slug" value={form.hubSlug} onChange={e => updateField("hubSlug", e.target.value)} placeholder="Hub slug" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">County Slug</label>
                      <Input data-testid="input-county-slug" value={form.countySlug} onChange={e => updateField("countySlug", e.target.value)} placeholder="County slug" />
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                    <div className="text-xs font-medium mb-1 flex items-center gap-1"><Sparkles className="w-3 h-3" /> AI Suggestions</div>
                    <AiVsFinal label="Primary" aiValue={item.aiSuggestedGeoPrimarySlug as string} finalValue={form.geoPrimarySlug} confidence={confidence.geo} />
                    <AiVsFinal label="Secondary" aiValue={item.aiSuggestedGeoSecondarySlug as string} finalValue={form.geoSecondarySlug} confidence={confidence.geo} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="text-sm font-medium mb-2">Venue / Entity</div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Venue Name</label>
                      <Input data-testid="input-venue-name" value={form.venueName} onChange={e => updateField("venueName", e.target.value)} placeholder="Venue name" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Venue Slug</label>
                      <Input data-testid="input-venue-slug" value={form.venueSlug} onChange={e => updateField("venueSlug", e.target.value)} placeholder="Venue slug" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Venue Address</label>
                      <Input data-testid="input-venue-address" value={form.venueAddress} onChange={e => updateField("venueAddress", e.target.value)} placeholder="Venue address" />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium mb-2">Status & Visibility</div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Publish Status</label>
                      <Select value={form.publishStatus} onValueChange={v => updateField("publishStatus", v)}>
                        <SelectTrigger data-testid="select-publish-status"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PUBLISH_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Policy Status</label>
                      <Select value={form.policyStatus} onValueChange={v => updateField("policyStatus", v)}>
                        <SelectTrigger data-testid="select-policy-status"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {POLICY_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <label className="text-xs text-muted-foreground">Include in Pulse</label>
                      <Switch data-testid="switch-pulse-eligible" checked={form.pulseEligible} onCheckedChange={v => updateField("pulseEligible", v)} />
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                    <div className="text-xs font-medium mb-1 flex items-center gap-1"><Sparkles className="w-3 h-3" /> AI Policy</div>
                    <AiVsFinal label="Policy" aiValue={item.aiSuggestedPolicyStatus as string} finalValue={form.policyStatus} confidence={confidence.policy} />
                  </div>
                </div>
              </div>

              {item.lastEditedBy && (
                <div className="text-xs text-muted-foreground border-t pt-2">
                  Last edited by {item.lastEditedBy as string} at {item.lastEditedAt ? new Date(item.lastEditedAt as string).toLocaleString() : "unknown"}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="routing">
            <RoutingPanel itemId={item.id as string} />
          </TabsContent>

          <TabsContent value="history">
            <VersionHistory itemId={item.id as string} />
          </TabsContent>
        </Tabs>

        <div className="flex justify-between pt-2 border-t">
          <div>
            {(item.publishStatus === "PUBLISHED" || item.queueStatus === "READY_TO_PUBLISH" || item.queueStatus === "PULSE_SUPPRESSED") && (
              <Button
                variant="outline"
                className="text-orange-700 border-orange-200"
                onClick={() => sendBackMutation.mutate()}
                disabled={sendBackMutation.isPending}
                data-testid="button-send-back-to-review"
              >
                <Undo2 className="w-4 h-4 mr-1" /> Send Back to Review
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} data-testid="button-cancel-edit"><X className="w-4 h-4 mr-1" /> Cancel</Button>
            <Button onClick={handleSave} disabled={editMutation.isPending} data-testid="button-save-edit">
              <Save className="w-4 h-4 mr-1" /> {editMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatusBadge({ status, type }: { status: string | null | undefined; type: "publish" | "policy" }) {
  if (!status) return <Badge variant="outline" className="text-xs">--</Badge>;
  const colors: Record<string, string> = {
    PUBLISHED: "bg-green-50 text-green-700 border-green-200",
    DRAFT: "bg-gray-50 text-gray-700 border-gray-200",
    REVIEW_NEEDED: "bg-yellow-50 text-yellow-700 border-yellow-200",
    ARCHIVED: "bg-gray-100 text-gray-500 border-gray-200",
    SUPPRESSED: "bg-red-50 text-red-700 border-red-200",
    ALLOW: "bg-green-50 text-green-700 border-green-200",
    SUPPRESS: "bg-red-50 text-red-700 border-red-200",
  };
  return <Badge variant="outline" className={`text-xs ${colors[status] || ""}`}>{status}</Badge>;
}

export default function EditorialControlTab({ cityId }: { cityId?: string }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [integrityFlagFilter, setIntegrityFlagFilter] = useState("all");
  const [editingItem, setEditingItem] = useState<Record<string, unknown> | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: zonesData } = useQuery<{ slug: string; name: string }[]>({
    queryKey: ["/api/admin/intelligence/zones"],
    queryFn: async () => {
      const res = await fetch("/api/admin/intelligence/zones", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });
  const zones = zonesData || [];

  const { data, isLoading } = useQuery<Record<string, unknown>>({
    queryKey: ["/api/admin/intelligence/rss-items", cityId, statusFilter, integrityFlagFilter, search, "editorial"],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      if (statusFilter !== "all") params.set("reviewStatus", statusFilter);
      if (integrityFlagFilter !== "all") params.set("integrityFlag", integrityFlagFilter);
      if (search) params.set("search", search);
      params.set("limit", "50");
      const res = await fetch(`/api/admin/intelligence/rss-items?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const items: Record<string, unknown>[] = (data?.rows || []) as Record<string, unknown>[];

  return (
    <div className="space-y-4" data-testid="editorial-control-tab">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input data-testid="input-editorial-search" className="pl-9" placeholder="Search by title..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40" data-testid="select-editorial-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="SKIPPED">Skipped</SelectItem>
            <SelectItem value="FLAGGED">Flagged</SelectItem>
          </SelectContent>
        </Select>
        <Select value={integrityFlagFilter} onValueChange={setIntegrityFlagFilter}>
          <SelectTrigger className="w-48" data-testid="select-integrity-flag-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            {INTEGRITY_FLAG_FILTERS.map(f => (
              <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {integrityFlagFilter !== "all" && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs gap-1" data-testid="badge-active-flag-filter">
            <Filter className="w-3 h-3" />
            Filtering: {INTEGRITY_FLAG_FILTERS.find(f => f.value === integrityFlagFilter)?.label}
            <button onClick={() => setIntegrityFlagFilter("all")} className="ml-1 hover:text-red-600" data-testid="button-clear-flag-filter">
              <X className="w-3 h-3" />
            </button>
          </Badge>
        </div>
      )}

      {isLoading && <div className="text-center py-8 text-muted-foreground">Loading...</div>}

      <div className="space-y-2">
        {items.map((item) => {
          const isExpanded = expandedId === item.id;
          const confidence = (item.aiConfidence || {}) as Record<string, number>;
          return (
            <Card key={item.id as string} className="overflow-hidden" data-testid={`card-editorial-${item.id}`}>
              <div
                className="flex items-center gap-3 p-3 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : item.id as string)}
                data-testid={`row-editorial-${item.id}`}
              >
                {isExpanded ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{item.title as string}</div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                    <span>{item.sourceName as string}</span>
                    {item.categoryCoreSlug && <Badge variant="outline" className="text-xs">{item.categoryCoreSlug as string}</Badge>}
                    {item.geoPrimarySlug && <Badge variant="outline" className="text-xs">{item.geoPrimarySlug as string}</Badge>}
                    {item.contentType && <Badge variant="outline" className="text-xs">{item.contentType as string}</Badge>}
                    {((item.integrityFlags || []) as string[]).filter(f =>
                      ["duplicate_candidate", "low_trust_source", "throttled", "OVERREPRESENTED_SOURCE", "OVERREPRESENTED_CATEGORY", "OVERREPRESENTED_GEO"].includes(f)
                    ).map(flag => (
                      <Badge key={flag} variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200" data-testid={`badge-flag-${flag}-${item.id}`}>
                        {flag.replace(/_/g, " ").replace("OVERREPRESENTED ", "Overrep. ")}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={item.publishStatus as string} type="publish" />
                  <StatusBadge status={item.policyStatus as string} type="policy" />
                  {item.pulseEligible === false && <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">No Pulse</Badge>}
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setEditingItem(item); }} data-testid={`button-edit-${item.id}`}>
                    <Edit className="w-3 h-3 mr-1" /> Edit
                  </Button>
                </div>
              </div>
              {isExpanded && (
                <CardContent className="border-t pt-3 pb-3">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-xs font-medium mb-1">Category</div>
                      <AiVsFinal label="Core" aiValue={item.aiSuggestedCategoryCoreSlug as string} finalValue={item.categoryCoreSlug as string} confidence={confidence.category} />
                      <AiVsFinal label="Sub" aiValue={item.aiSuggestedCategorySubSlug as string} finalValue={item.categorySubSlug as string} confidence={confidence.category} />
                      <AiVsFinal label="Type" aiValue={item.aiSuggestedContentType as string} finalValue={item.contentType as string} confidence={confidence.contentType} />
                    </div>
                    <div>
                      <div className="text-xs font-medium mb-1">Geography</div>
                      <AiVsFinal label="Primary" aiValue={item.aiSuggestedGeoPrimarySlug as string} finalValue={item.geoPrimarySlug as string} confidence={confidence.geo} />
                      <AiVsFinal label="Secondary" aiValue={item.aiSuggestedGeoSecondarySlug as string} finalValue={item.geoSecondarySlug as string} confidence={confidence.geo} />
                      <div className="flex items-start gap-3 text-sm py-1">
                        <span className="w-28 text-muted-foreground shrink-0">Hub</span>
                        <span className="truncate">{(item.hubSlug as string) || "--"}</span>
                      </div>
                      <div className="flex items-start gap-3 text-sm py-1">
                        <span className="w-28 text-muted-foreground shrink-0">County</span>
                        <span className="truncate">{(item.countySlug as string) || "--"}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium mb-1">Status & Venue</div>
                      <AiVsFinal label="Policy" aiValue={item.aiSuggestedPolicyStatus as string} finalValue={item.policyStatus as string} confidence={confidence.policy} />
                      <div className="flex items-start gap-3 text-sm py-1">
                        <span className="w-28 text-muted-foreground shrink-0">Venue</span>
                        <span className="truncate">{(item.venueName as string) || "--"}</span>
                      </div>
                      <div className="flex items-start gap-3 text-sm py-1">
                        <span className="w-28 text-muted-foreground shrink-0">Pulse</span>
                        <span>{item.pulseEligible !== false ? "Included" : "Excluded"}</span>
                      </div>
                      {item.lastEditedBy && (
                        <div className="text-xs text-muted-foreground mt-2">
                          Edited by {item.lastEditedBy as string}
                          {item.lastEditedAt && ` at ${new Date(item.lastEditedAt as string).toLocaleString()}`}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {items.length === 0 && !isLoading && (
        <div className="text-center py-8 text-muted-foreground">No items found</div>
      )}

      {editingItem && (
        <EditDialog item={editingItem} zones={zones} open={!!editingItem} onClose={() => setEditingItem(null)} />
      )}
    </div>
  );
}
