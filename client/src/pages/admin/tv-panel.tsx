import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { SlideRenderer } from "@/components/tv/slide-templates";
import {
  Plus, Pencil, Trash2, Copy, ExternalLink, Loader2, Monitor, Tv, Eye,
  DollarSign, Home, BarChart3, QrCode, Play, TrendingUp, Wifi, WifiOff, Activity,
  GripVertical, Clock, ListChecks, Repeat, Volume2, FileText, Upload, Pause,
  SkipBack, SkipForward, Subtitles, VolumeX, MapPin as MapPinIcon, Info, ChevronDown, ChevronRight
} from "lucide-react";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { TvScreen, TvItem, TvPlacement, TvLoop, TvLoopItem, TvSchedule, TvHostPhrase } from "@shared/schema";

function AdminHelpPanel({ items }: { items: { title: string; text: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-md" data-testid="admin-help-panel">
      <button
        type="button"
        className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm text-muted-foreground"
        onClick={() => setOpen(!open)}
        data-testid="button-toggle-help"
      >
        <Info className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="flex-1">Help & Guidance</span>
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-3 border-t pt-3">
          {items.map((item, idx) => (
            <div key={idx} className="space-y-0.5">
              <p className="text-xs font-medium">{item.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatCents(cents: number | null | undefined): string {
  if (cents == null) return "-";
  return `$${(cents / 100).toFixed(2)}`;
}

function heartbeatStatus(lastHeartbeatAt: string | Date | null | undefined): { color: string; label: string } {
  if (!lastHeartbeatAt) return { color: "bg-gray-400", label: "Never" };
  const diff = Date.now() - new Date(lastHeartbeatAt).getTime();
  const mins = diff / 60000;
  if (mins < 2) return { color: "bg-green-500", label: "Online" };
  if (mins < 10) return { color: "bg-yellow-500", label: `${Math.round(mins)}m ago` };
  return { color: "bg-red-500", label: `${Math.round(mins)}m ago` };
}

function isExpired(endAt: string | Date | null | undefined): boolean {
  if (!endAt) return false;
  return new Date(endAt).getTime() < Date.now();
}

const TEMPLATE_FIELDS: Record<string, { key: string; label: string; type: "input" | "textarea" }[]> = {
  hub_event: [
    { key: "title", label: "Title", type: "input" },
    { key: "titleEs", label: "Title (Spanish)", type: "input" },
    { key: "date", label: "Date", type: "input" },
    { key: "time", label: "Time", type: "input" },
    { key: "location", label: "Location", type: "input" },
    { key: "categoryBadge", label: "Category Badge", type: "input" },
    { key: "description", label: "Description", type: "textarea" },
    { key: "descriptionEs", label: "Description (Spanish)", type: "textarea" },
  ],
  pulse_headline: [
    { key: "headline", label: "Headline", type: "input" },
    { key: "headlineEs", label: "Headline (Spanish)", type: "input" },
    { key: "excerpt", label: "Excerpt", type: "textarea" },
    { key: "excerptEs", label: "Excerpt (Spanish)", type: "textarea" },
    { key: "authorName", label: "Author Name", type: "input" },
    { key: "imageUrl", label: "Image URL", type: "input" },
  ],
  hub_discovery: [
    { key: "hubName", label: "Hub Name", type: "input" },
    { key: "hubSlug", label: "Hub Slug", type: "input" },
    { key: "tagline", label: "Tagline", type: "input" },
    { key: "taglineEs", label: "Tagline (Spanish)", type: "input" },
  ],
  neighborhood_spotlight: [
    { key: "businessName", label: "Business Name", type: "input" },
    { key: "description", label: "Description", type: "textarea" },
    { key: "descriptionEs", label: "Description (Spanish)", type: "textarea" },
    { key: "rating", label: "Rating", type: "input" },
    { key: "categoryBadge", label: "Category Badge", type: "input" },
    { key: "imageUrl", label: "Image URL", type: "input" },
  ],
  venue_special: [
    { key: "venueName", label: "Venue Name", type: "input" },
    { key: "specialText", label: "Special Text", type: "textarea" },
    { key: "specialTextEs", label: "Special Text (Spanish)", type: "textarea" },
    { key: "logoUrl", label: "Logo URL", type: "input" },
    { key: "imageUrl", label: "Image URL", type: "input" },
  ],
  live_feed: [
    { key: "feedName", label: "Feed Name", type: "input" },
    { key: "feedNameEs", label: "Feed Name (Spanish)", type: "input" },
    { key: "thumbnailUrl", label: "Thumbnail URL", type: "input" },
    { key: "embedUrl", label: "Embed URL", type: "input" },
    { key: "sourceUrl", label: "Source URL", type: "input" },
  ],
  trivia_question: [
    { key: "question", label: "Question", type: "textarea" },
    { key: "questionEs", label: "Question (Spanish)", type: "textarea" },
    { key: "answer0", label: "Answer A", type: "input" },
    { key: "answer1", label: "Answer B", type: "input" },
    { key: "answer2", label: "Answer C", type: "input" },
    { key: "answer3", label: "Answer D", type: "input" },
    { key: "correctIndex", label: "Correct Answer Index (0-3)", type: "input" },
    { key: "funFact", label: "Fun Fact (shown after answering)", type: "textarea" },
    { key: "category", label: "Category (History, Food, Sports, Local Knowledge)", type: "input" },
  ],
  social_proof: [
    { key: "platform", label: "Platform (tiktok / instagram)", type: "input" },
    { key: "postUrl", label: "Post URL", type: "input" },
    { key: "username", label: "Username", type: "input" },
    { key: "caption", label: "Caption", type: "textarea" },
    { key: "imageUrl", label: "Image / Thumbnail URL", type: "input" },
    { key: "likes", label: "Likes Count", type: "input" },
    { key: "views", label: "Views Count", type: "input" },
  ],
  tonight_around_you: [
    { key: "headline", label: "Headline", type: "input" },
    { key: "subline", label: "Subline", type: "input" },
    { key: "events", label: "Events (JSON array)", type: "textarea" },
    { key: "qrUrl", label: "QR URL", type: "input" },
  ],
  this_weekend: [
    { key: "headline", label: "Headline", type: "input" },
    { key: "subline", label: "Subline", type: "input" },
    { key: "events", label: "Events (JSON array)", type: "textarea" },
    { key: "qrUrl", label: "QR URL", type: "input" },
  ],
  nonprofit_showcase: [
    { key: "name", label: "Organization Name", type: "input" },
    { key: "nameEs", label: "Organization Name (Spanish)", type: "input" },
    { key: "mission", label: "Mission Statement", type: "textarea" },
    { key: "missionEs", label: "Mission Statement (Spanish)", type: "textarea" },
    { key: "description", label: "Description", type: "textarea" },
    { key: "descriptionEs", label: "Description (Spanish)", type: "textarea" },
    { key: "impactStat", label: "Impact Stat (e.g. 5,000+)", type: "input" },
    { key: "impactLabel", label: "Impact Label (e.g. Families Served)", type: "input" },
    { key: "imageUrl", label: "Image URL", type: "input" },
  ],
  support_local_spotlight: [
    { key: "name", label: "Business Name", type: "input" },
    { key: "nameEs", label: "Business Name (Spanish)", type: "input" },
    { key: "category", label: "Category", type: "input" },
    { key: "description", label: "Description", type: "textarea" },
    { key: "descriptionEs", label: "Description (Spanish)", type: "textarea" },
    { key: "shopLocalMessage", label: "Shop Local Message", type: "input" },
    { key: "shopLocalMessageEs", label: "Shop Local Message (Spanish)", type: "input" },
    { key: "yearsInBusiness", label: "Years in Business", type: "input" },
    { key: "accentColor", label: "Accent Color (hex)", type: "input" },
    { key: "imageUrl", label: "Image URL", type: "input" },
  ],
  quiz_promo: [
    { key: "title", label: "Quiz Title", type: "input" },
    { key: "titleEs", label: "Quiz Title (Spanish)", type: "input" },
    { key: "description", label: "Description", type: "textarea" },
    { key: "descriptionEs", label: "Description (Spanish)", type: "textarea" },
    { key: "questionCount", label: "Number of Questions", type: "input" },
    { key: "timeLimit", label: "Time Limit (minutes)", type: "input" },
    { key: "prizeText", label: "Prize Text (optional)", type: "input" },
  ],
  giveaway_promo: [
    { key: "title", label: "Giveaway Title", type: "input" },
    { key: "titleEs", label: "Giveaway Title (Spanish)", type: "input" },
    { key: "prizeDescription", label: "Prize Description", type: "textarea" },
    { key: "prizeDescriptionEs", label: "Prize Description (Spanish)", type: "textarea" },
    { key: "sponsorName", label: "Sponsor Name", type: "input" },
    { key: "endsAt", label: "End Date", type: "input" },
    { key: "imageUrl", label: "Image URL", type: "input" },
  ],
  job_listing: [
    { key: "headline", label: "Headline", type: "input" },
    { key: "headlineEs", label: "Headline (Spanish)", type: "input" },
    { key: "hubName", label: "Hub/Area Name", type: "input" },
    { key: "totalJobs", label: "Total Jobs Count", type: "input" },
    { key: "jobs", label: "Jobs (JSON array: [{title, employer, type, pay}])", type: "textarea" },
  ],
};

function VisualSlideFields({
  templateKey,
  fieldValues,
  onChange,
}: {
  templateKey: string;
  fieldValues: Record<string, string>;
  onChange: (key: string, val: string) => void;
}) {
  const fields = TEMPLATE_FIELDS[templateKey];
  if (!fields) return <p className="text-sm text-muted-foreground">Select a template to see visual fields</p>;

  return (
    <div className="space-y-3">
      {fields.map((f) => (
        <div key={f.key} className="space-y-1">
          <Label className="text-xs">{f.label}</Label>
          {f.type === "textarea" ? (
            <Textarea
              value={fieldValues[f.key] || ""}
              onChange={(e) => onChange(f.key, e.target.value)}
              className="resize-none text-sm"
              rows={2}
              data-testid={`input-visual-${f.key}`}
            />
          ) : (
            <Input
              value={fieldValues[f.key] || ""}
              onChange={(e) => onChange(f.key, e.target.value)}
              className="text-sm"
              data-testid={`input-visual-${f.key}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function SlidePreview({
  templateKey,
  data,
  qrUrl,
  assetUrl,
}: {
  templateKey: string;
  data: Record<string, any>;
  qrUrl?: string;
  assetUrl?: string;
}) {
  if (!templateKey) return null;

  return (
    <div className="space-y-1">
      <Label className="text-xs">Preview</Label>
      <div
        className="border rounded-md bg-black overflow-hidden"
        style={{ width: 320, height: 180 }}
        data-testid="slide-preview-container"
      >
        <div
          style={{
            width: 1920,
            height: 1080,
            transform: "scale(0.1667)",
            transformOrigin: "top left",
          }}
        >
          <SlideRenderer
            templateKey={templateKey}
            data={data}
            qrUrl={qrUrl}
            assetUrl={assetUrl}
            languageMode="en"
          />
        </div>
      </div>
    </div>
  );
}

function ScreensTab({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TvScreen | null>(null);

  const [name, setName] = useState("");
  const [hubSlug, setHubSlug] = useState("");
  const [locationSlug, setLocationSlug] = useState("");
  const [status, setStatus] = useState<string>("active");
  const [languageMode, setLanguageMode] = useState<string>("en");
  const [daypartingEnabled, setDaypartingEnabled] = useState(false);
  const [competitorProtectionEnabled, setCompetitorProtectionEnabled] = useState(false);
  const [protectedCategoryIds, setProtectedCategoryIds] = useState("");
  const [notes, setNotes] = useState("");
  const [slideDurationDefaultSec, setSlideDurationDefaultSec] = useState("9");
  const [loopTargetMin, setLoopTargetMin] = useState("20");
  const [venuePromoFrequencyMin, setVenuePromoFrequencyMin] = useState("3");
  const [screenGroupId, setScreenGroupId] = useState("");
  const [screenGroupRole, setScreenGroupRole] = useState("");
  const [activeLoopIds, setActiveLoopIds] = useState<string[]>([]);
  const [activeScheduleId, setActiveScheduleId] = useState("");
  const [subtitleDefaultEnabled, setSubtitleDefaultEnabled] = useState(true);
  const [narrationDefaultEnabled, setNarrationDefaultEnabled] = useState(true);
  const [venueInsertFrequencyMinutes, setVenueInsertFrequencyMinutes] = useState("6");
  const [spokenSegmentMinGapMinutes, setSpokenSegmentMinGapMinutes] = useState("4");
  const [preferredVoiceProfile, setPreferredVoiceProfile] = useState("");
  const [allowMetroFallback, setAllowMetroFallback] = useState(true);
  const [allowHubFallback, setAllowHubFallback] = useState(true);

  const tvQueryFn = (endpoint: string) => async () => {
    const p = new URLSearchParams();
    if (cityId) p.set("cityId", cityId);
    const res = await fetch(`${endpoint}?${p}`, { credentials: "include" });
    if (!res.ok) return [];
    return res.json();
  };

  const { data: screens, isLoading } = useQuery<TvScreen[]>({
    queryKey: ["/api/admin/tv/screens", cityId],
    queryFn: tvQueryFn("/api/admin/tv/screens"),
  });

  const { data: loops } = useQuery<TvLoop[]>({
    queryKey: ["/api/admin/tv/loops", cityId],
    queryFn: tvQueryFn("/api/admin/tv/loops"),
  });

  const { data: schedules } = useQuery<TvSchedule[]>({
    queryKey: ["/api/admin/tv/schedules", cityId],
    queryFn: tvQueryFn("/api/admin/tv/schedules"),
  });

  const resetForm = (s?: TvScreen | null) => {
    setName(s?.name || "");
    setHubSlug(s?.hubSlug || "");
    setLocationSlug(s?.locationSlug || "");
    setStatus(s?.status || "active");
    setLanguageMode(s?.languageMode || "en");
    setDaypartingEnabled(s?.daypartingEnabled || false);
    setCompetitorProtectionEnabled(s?.competitorProtectionEnabled || false);
    setProtectedCategoryIds((s?.protectedCategoryIds || []).join(", "));
    setNotes(s?.notes || "");
    const ps = s?.playlistSettings as any;
    setSlideDurationDefaultSec(String(ps?.slideDurationDefaultSec ?? 9));
    setLoopTargetMin(String(ps?.loopTargetMin ?? 20));
    setVenuePromoFrequencyMin(String(ps?.venuePromoFrequencyMin ?? 3));
    setScreenGroupId(s?.screenGroupId || "");
    setScreenGroupRole(s?.screenGroupRole || "");
    setActiveLoopIds(s?.activeLoopIds || []);
    setActiveScheduleId(s?.activeScheduleId || "");
    setSubtitleDefaultEnabled(s?.subtitleDefaultEnabled ?? true);
    setNarrationDefaultEnabled(s?.narrationDefaultEnabled ?? true);
    setVenueInsertFrequencyMinutes(String(s?.venueInsertFrequencyMinutes ?? 6));
    setSpokenSegmentMinGapMinutes(String(s?.spokenSegmentMinGapMinutes ?? 4));
    setPreferredVoiceProfile(s?.preferredVoiceProfile || "");
    setAllowMetroFallback(s?.allowMetroFallback ?? true);
    setAllowHubFallback(s?.allowHubFallback ?? true);
  };

  const openCreate = () => { setEditing(null); resetForm(); setDialogOpen(true); };
  const openEdit = (s: TvScreen) => { setEditing(s); resetForm(s); setDialogOpen(true); };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        name,
        hubSlug: hubSlug || null,
        locationSlug: locationSlug || null,
        status,
        languageMode,
        daypartingEnabled,
        competitorProtectionEnabled,
        protectedCategoryIds: protectedCategoryIds ? protectedCategoryIds.split(",").map(s => s.trim()).filter(Boolean) : [],
        notes: notes || null,
        screenGroupId: screenGroupId || null,
        screenGroupRole: screenGroupRole || null,
        playlistSettings: {
          slideDurationDefaultSec: parseInt(slideDurationDefaultSec) || 9,
          loopTargetMin: parseInt(loopTargetMin) || 20,
          venuePromoFrequencyMin: parseInt(venuePromoFrequencyMin) || 3,
        },
        activeLoopIds,
        activeScheduleId: activeScheduleId && activeScheduleId !== "none" ? activeScheduleId : null,
        subtitleDefaultEnabled,
        narrationDefaultEnabled,
        venueInsertFrequencyMinutes: parseInt(venueInsertFrequencyMinutes) || 6,
        spokenSegmentMinGapMinutes: parseInt(spokenSegmentMinGapMinutes) || 4,
        preferredVoiceProfile: preferredVoiceProfile && preferredVoiceProfile !== "none" ? preferredVoiceProfile : null,
        allowMetroFallback,
        allowHubFallback,
      };
      if (editing) {
        return apiRequest("PATCH", `/api/admin/tv/screens/${editing.id}`, body);
      }
      return apiRequest("POST", "/api/admin/tv/screens", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tv/screens"] });
      toast({ title: editing ? "Screen updated" : "Screen created" });
      setDialogOpen(false);
    },
    onError: () => toast({ title: "Error saving screen", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/tv/screens/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tv/screens"] });
      toast({ title: "Screen deleted" });
    },
    onError: () => toast({ title: "Error deleting screen", variant: "destructive" }),
  });

  const getScreenUrl = (s: TvScreen) => {
    const base = `/tv/charlotte`;
    if (s.hubSlug && s.locationSlug) return `${base}/${s.hubSlug}/${s.locationSlug}?screenKey=${s.screenKey}`;
    if (s.hubSlug) return `${base}/${s.hubSlug}?screenKey=${s.screenKey}`;
    return `${base}?screenKey=${s.screenKey}`;
  };

  const copyUrl = (s: TvScreen) => {
    const url = `${window.location.origin}${getScreenUrl(s)}`;
    navigator.clipboard.writeText(url);
    toast({ title: "URL copied to clipboard" });
  };

  if (isLoading) return <div className="text-sm text-muted-foreground p-4">Loading screens...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold" data-testid="text-screens-title">TV Screens</h3>
        <Button onClick={openCreate} data-testid="button-create-screen">
          <Plus className="h-4 w-4 mr-1" /> New Screen
        </Button>
      </div>

      <div className="border rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Name</th>
              <th className="text-left p-3 font-medium">Hub</th>
              <th className="text-left p-3 font-medium">Location</th>
              <th className="text-center p-3 font-medium">Status</th>
              <th className="text-center p-3 font-medium">Language</th>
              <th className="text-center p-3 font-medium">Heartbeat</th>
              <th className="text-center p-3 font-medium">Group</th>
              <th className="text-center p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(screens || []).map((s) => {
              const hb = heartbeatStatus(s.lastHeartbeatAt);
              return (
                <tr key={s.id} className="border-b last:border-b-0" data-testid={`row-screen-${s.id}`}>
                  <td className="p-3 font-medium">{s.name}</td>
                  <td className="p-3 text-muted-foreground">{s.hubSlug || "-"}</td>
                  <td className="p-3 text-muted-foreground">{s.locationSlug || "-"}</td>
                  <td className="p-3 text-center">
                    <Badge variant={s.status === "active" ? "default" : "secondary"} data-testid={`badge-status-${s.id}`}>
                      {s.status}
                    </Badge>
                  </td>
                  <td className="p-3 text-center">
                    <Badge variant="outline">{s.languageMode}</Badge>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5" data-testid={`heartbeat-${s.id}`}>
                      <div className={`h-2.5 w-2.5 rounded-full ${hb.color}`} />
                      <span className="text-xs text-muted-foreground">{hb.label}</span>
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    {s.screenGroupId ? (
                      <div className="flex items-center justify-center gap-1">
                        <Badge variant="outline" className="text-[10px]">{s.screenGroupId}</Badge>
                        <span className="text-[10px] text-muted-foreground">{s.screenGroupRole || "—"}</span>
                      </div>
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => window.open(getScreenUrl(s), "_blank")} data-testid={`button-preview-${s.id}`}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => copyUrl(s)} data-testid={`button-copy-url-${s.id}`}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => openEdit(s)} data-testid={`button-edit-screen-${s.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(s.id)} data-testid={`button-delete-screen-${s.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {(screens || []).length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No screens configured</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Screen" : "Create Screen"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} data-testid="input-screen-name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hub Slug</Label>
                <Input value={hubSlug} onChange={(e) => setHubSlug(e.target.value)} placeholder="south-end" data-testid="input-screen-hub-slug" />
              </div>
              <div className="space-y-2">
                <Label>Location Slug</Label>
                <Input value={locationSlug} onChange={(e) => setLocationSlug(e.target.value)} placeholder="joes-bar" data-testid="input-screen-location-slug" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger data-testid="select-screen-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Language Mode</Label>
                <Select value={languageMode} onValueChange={setLanguageMode}>
                  <SelectTrigger data-testid="select-screen-language"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="bilingual">Bilingual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={daypartingEnabled} onCheckedChange={setDaypartingEnabled} data-testid="switch-dayparting" />
              <Label>Dayparting Enabled</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={competitorProtectionEnabled} onCheckedChange={setCompetitorProtectionEnabled} data-testid="switch-competitor-protection" />
              <Label>Competitor Protection</Label>
            </div>
            {competitorProtectionEnabled && (
              <div className="space-y-2">
                <Label>Protected Category IDs (comma-separated)</Label>
                <Input value={protectedCategoryIds} onChange={(e) => setProtectedCategoryIds(e.target.value)} data-testid="input-protected-categories" />
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Slide Duration (sec)</Label>
                <Input type="number" value={slideDurationDefaultSec} onChange={(e) => setSlideDurationDefaultSec(e.target.value)} data-testid="input-slide-duration" />
              </div>
              <div className="space-y-2">
                <Label>Loop Target (min)</Label>
                <Input type="number" value={loopTargetMin} onChange={(e) => setLoopTargetMin(e.target.value)} data-testid="input-loop-target" />
              </div>
              <div className="space-y-2">
                <Label>Promo Freq (min)</Label>
                <Input type="number" value={venuePromoFrequencyMin} onChange={(e) => setVenuePromoFrequencyMin(e.target.value)} data-testid="input-promo-freq" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Screen Group ID</Label>
                <Input value={screenGroupId} onChange={(e) => setScreenGroupId(e.target.value)} placeholder="venue-group-1" data-testid="input-screen-group-id" />
              </div>
              <div className="space-y-2">
                <Label>Group Role</Label>
                <Select value={screenGroupRole || "none"} onValueChange={(v) => setScreenGroupRole(v === "none" ? "" : v)}>
                  <SelectTrigger data-testid="select-screen-group-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="primary">Primary</SelectItem>
                    <SelectItem value="secondary">Secondary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="resize-none" rows={2} data-testid="input-screen-notes" />
            </div>

            <div className="border-t pt-4 mt-4">
              <h4 className="font-semibold text-sm mb-3">Channel Programming</h4>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Active Loops</Label>
                  <div className="flex flex-wrap gap-2">
                    {(loops || []).filter(l => l.enabled).map((loop) => (
                      <label key={loop.id} className="flex items-center gap-1.5 text-sm">
                        <Checkbox
                          checked={activeLoopIds.includes(loop.id)}
                          onCheckedChange={(checked) => {
                            setActiveLoopIds(prev =>
                              checked ? [...prev, loop.id] : prev.filter(id => id !== loop.id)
                            );
                          }}
                          data-testid={`checkbox-loop-${loop.id}`}
                        />
                        {loop.name}
                      </label>
                    ))}
                    {(loops || []).filter(l => l.enabled).length === 0 && (
                      <span className="text-xs text-muted-foreground">No loops available</span>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Active Schedule</Label>
                  <Select value={activeScheduleId || "none"} onValueChange={(v) => setActiveScheduleId(v === "none" ? "" : v)}>
                    <SelectTrigger data-testid="select-screen-schedule"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No schedule</SelectItem>
                      {(schedules || []).map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <Switch checked={subtitleDefaultEnabled} onCheckedChange={setSubtitleDefaultEnabled} data-testid="switch-subtitle-default" />
                    <Label>Subtitles Default On</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={narrationDefaultEnabled} onCheckedChange={setNarrationDefaultEnabled} data-testid="switch-narration-default" />
                    <Label>Narration Default On</Label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Venue Insert Freq (min)</Label>
                    <Input type="number" value={venueInsertFrequencyMinutes} onChange={(e) => setVenueInsertFrequencyMinutes(e.target.value)} data-testid="input-venue-insert-freq" />
                  </div>
                  <div className="space-y-2">
                    <Label>Spoken Segment Gap (min)</Label>
                    <Input type="number" value={spokenSegmentMinGapMinutes} onChange={(e) => setSpokenSegmentMinGapMinutes(e.target.value)} data-testid="input-spoken-gap" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Preferred Voice Profile</Label>
                  <Select value={preferredVoiceProfile || "none"} onValueChange={(v) => setPreferredVoiceProfile(v === "none" ? "" : v)}>
                    <SelectTrigger data-testid="select-voice-profile"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="warm_local_host">Warm Local Host</SelectItem>
                      <SelectItem value="upbeat_event_host">Upbeat Event Host</SelectItem>
                      <SelectItem value="calm_waiting_room">Calm Waiting Room</SelectItem>
                      <SelectItem value="nightlife_host">Nightlife Host</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <Switch checked={allowMetroFallback} onCheckedChange={setAllowMetroFallback} data-testid="switch-metro-fallback" />
                    <Label>Allow Metro Fallback</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={allowHubFallback} onCheckedChange={setAllowHubFallback} data-testid="switch-hub-fallback" />
                    <Label>Allow Hub Fallback</Label>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={() => saveMutation.mutate()} disabled={!name || saveMutation.isPending} data-testid="button-save-screen">
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                {editing ? "Update" : "Create"}
              </Button>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const TEMPLATE_OPTIONS = [
  { value: "hub_event", label: "Hub Event" },
  { value: "pulse_headline", label: "Pulse Headline" },
  { value: "hub_discovery", label: "Hub Discovery" },
  { value: "neighborhood_spotlight", label: "Neighborhood Spotlight" },
  { value: "venue_special", label: "Venue Special" },
  { value: "live_feed", label: "Live Feed" },
  { value: "weather_current", label: "Weather" },
  { value: "sports_scores", label: "Sports Scores" },
  { value: "traffic_update", label: "Traffic Update" },
  { value: "trivia_question", label: "Trivia Question" },
  { value: "social_proof", label: "Social Proof / UGC" },
  { value: "tonight_around_you", label: "Tonight Around You" },
  { value: "this_weekend", label: "This Weekend" },
  { value: "nonprofit_showcase", label: "Nonprofit Showcase" },
  { value: "support_local_spotlight", label: "Support Local Spotlight" },
];

const DAYPART_OPTIONS = ["morning", "afternoon", "evening", "latenight"];

function ContentTab({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TvItem | null>(null);
  const [scopeFilter, setScopeFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [enabledFilter, setEnabledFilter] = useState("ALL");

  const [title, setTitle] = useState("");
  const [type, setType] = useState<string>("slide");
  const [sourceScope, setSourceScope] = useState<string>("metro");
  const [itemHubSlug, setItemHubSlug] = useState("");
  const [itemLocationSlug, setItemLocationSlug] = useState("");
  const [templateKey, setTemplateKey] = useState("");
  const [dataJson, setDataJson] = useState("");
  const [assetUrl, setAssetUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [clickUrl, setClickUrl] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [durationSec, setDurationSec] = useState("");
  const [priority, setPriority] = useState("5");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [daypartSlots, setDaypartSlots] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [isPaid, setIsPaid] = useState(false);
  const [advertiserName, setAdvertiserName] = useState("");
  const [contentType, setContentType] = useState<string>("slide");
  const [contentFamily, setContentFamily] = useState("");
  const [targetVenueTypes, setTargetVenueTypes] = useState<string[]>([]);
  const [targetLoopThemes, setTargetLoopThemes] = useState<string[]>([]);
  const [hostPhraseId, setHostPhraseId] = useState("");

  const [narrationText, setNarrationText] = useState("");
  const [voiceProfile, setVoiceProfile] = useState("warm_local_host");
  const [narrationEnabled, setNarrationEnabled] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [captionUrl, setCaptionUrl] = useState("");
  const [subtitleText, setSubtitleText] = useState("");
  const [captionEnabled, setCaptionEnabled] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [codeMode, setCodeMode] = useState(false);
  const [visualFields, setVisualFields] = useState<Record<string, string>>({});

  const tvQueryFn = (endpoint: string) => async () => {
    const p = new URLSearchParams();
    if (cityId) p.set("cityId", cityId);
    const res = await fetch(`${endpoint}?${p}`, { credentials: "include" });
    if (!res.ok) return [];
    return res.json();
  };

  const { data: items, isLoading } = useQuery<TvItem[]>({
    queryKey: ["/api/admin/tv/items", cityId],
    queryFn: tvQueryFn("/api/admin/tv/items"),
  });

  const { data: hostPhrases } = useQuery<TvHostPhrase[]>({
    queryKey: ["/api/admin/tv/host-phrases", cityId],
    queryFn: tvQueryFn("/api/admin/tv/host-phrases"),
  });

  const sortedFilteredItems = useMemo(() => {
    const filtered = (items || []).filter((item) => {
      if (scopeFilter !== "ALL" && item.sourceScope !== scopeFilter) return false;
      if (typeFilter !== "ALL" && item.type !== typeFilter) return false;
      if (enabledFilter !== "ALL") {
        if (enabledFilter === "enabled" && !item.enabled) return false;
        if (enabledFilter === "disabled" && item.enabled) return false;
      }
      return true;
    });
    return filtered.sort((a, b) => {
      const aExpired = isExpired(a.endAt);
      const bExpired = isExpired(b.endAt);
      if (aExpired && !bExpired) return 1;
      if (!aExpired && bExpired) return -1;
      return 0;
    });
  }, [items, scopeFilter, typeFilter, enabledFilter]);

  const buildDataFromVisualFields = (): Record<string, any> => {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(visualFields)) {
      if (v) result[k] = v;
    }
    if (templateKey === "trivia_question") {
      const answers: string[] = [];
      for (let i = 0; i < 4; i++) {
        if (result[`answer${i}`]) answers.push(result[`answer${i}`]);
        delete result[`answer${i}`];
      }
      if (answers.length > 0) result.answers = answers;
      if (result.correctIndex != null) result.correctIndex = parseInt(result.correctIndex) || 0;
    }
    return result;
  };

  const populateVisualFieldsFromData = (data: Record<string, any> | null, tk: string) => {
    if (!data || !tk) { setVisualFields({}); return; }
    const fields = TEMPLATE_FIELDS[tk];
    if (!fields) { setVisualFields({}); return; }
    const vals: Record<string, string> = {};
    for (const f of fields) {
      vals[f.key] = data[f.key] != null ? String(data[f.key]) : "";
    }
    if (tk === "trivia_question" && Array.isArray(data.answers)) {
      data.answers.forEach((a: string, i: number) => {
        vals[`answer${i}`] = a || "";
      });
    }
    setVisualFields(vals);
  };

  const currentPreviewData = useMemo(() => {
    if (codeMode) {
      try { return JSON.parse(dataJson); } catch { return {}; }
    }
    return buildDataFromVisualFields();
  }, [codeMode, dataJson, visualFields]);

  const resetForm = (i?: TvItem | null) => {
    setTitle(i?.title || "");
    setType(i?.type || "slide");
    setSourceScope(i?.sourceScope || "metro");
    setItemHubSlug(i?.hubSlug || "");
    setItemLocationSlug(i?.locationSlug || "");
    setTemplateKey(i?.templateKey || "");
    setDataJson(i?.data ? JSON.stringify(i.data, null, 2) : "");
    setAssetUrl(i?.assetUrl || "");
    setVideoUrl(i?.videoUrl || "");
    setClickUrl(i?.clickUrl || "");
    setQrUrl(i?.qrUrl || "");
    setDurationSec(i?.durationSec != null ? String(i.durationSec) : "");
    setPriority(String(i?.priority ?? 5));
    setStartAt(i?.startAt ? new Date(i.startAt).toISOString().slice(0, 16) : "");
    setEndAt(i?.endAt ? new Date(i.endAt).toISOString().slice(0, 16) : "");
    setDaypartSlots(i?.daypartSlots || []);
    setEnabled(i?.enabled ?? true);
    setIsPaid(i?.isPaid ?? false);
    setAdvertiserName(i?.advertiserName || "");
    setContentType((i as any)?.contentType || "slide");
    setContentFamily((i as any)?.contentFamily || "");
    setTargetVenueTypes((i as any)?.targetVenueTypes || []);
    setTargetLoopThemes((i as any)?.targetLoopThemes || []);
    setHostPhraseId((i as any)?.hostPhraseId || "");
    setNarrationText((i as any)?.narrationText || "");
    setVoiceProfile((i as any)?.voiceProfile || "warm_local_host");
    setNarrationEnabled((i as any)?.narrationEnabled ?? false);
    setAudioUrl((i as any)?.audioUrl || "");
    setCaptionUrl((i as any)?.captionUrl || "");
    setSubtitleText((i as any)?.subtitleText || "");
    setCaptionEnabled(false);
    setIsAudioPlaying(false);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setCodeMode(false);
    populateVisualFieldsFromData(i?.data as Record<string, any> | null, i?.templateKey || "");
  };

  const openCreate = () => { setEditing(null); resetForm(); setDialogOpen(true); };
  const openEdit = (i: TvItem) => { setEditing(i); resetForm(i); setDialogOpen(true); };

  const handleTemplateKeyChange = (newKey: string) => {
    setTemplateKey(newKey);
    if (!codeMode) {
      try {
        const existingData = dataJson ? JSON.parse(dataJson) : {};
        populateVisualFieldsFromData(existingData, newKey);
      } catch {
        populateVisualFieldsFromData({}, newKey);
      }
    }
  };

  const handleVisualFieldChange = (key: string, val: string) => {
    setVisualFields(prev => ({ ...prev, [key]: val }));
  };

  const handleCodeModeToggle = (on: boolean) => {
    if (on) {
      const builtData = buildDataFromVisualFields();
      setDataJson(Object.keys(builtData).length > 0 ? JSON.stringify(builtData, null, 2) : dataJson);
    } else {
      try {
        const parsed = JSON.parse(dataJson);
        populateVisualFieldsFromData(parsed, templateKey);
      } catch {
        populateVisualFieldsFromData({}, templateKey);
      }
    }
    setCodeMode(on);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      let parsedData: unknown = null;
      if (codeMode) {
        if (dataJson) {
          try { parsedData = JSON.parse(dataJson); } catch { throw new Error("Invalid JSON in data field"); }
        }
      } else {
        const built = buildDataFromVisualFields();
        parsedData = Object.keys(built).length > 0 ? built : null;
      }
      const body: Record<string, unknown> = {
        title,
        type,
        sourceScope,
        hubSlug: itemHubSlug || null,
        locationSlug: itemLocationSlug || null,
        templateKey: templateKey || null,
        data: parsedData,
        assetUrl: assetUrl || null,
        videoUrl: videoUrl || null,
        clickUrl: clickUrl || null,
        qrUrl: qrUrl || null,
        durationSec: durationSec ? parseInt(durationSec) : null,
        priority: parseInt(priority) || 5,
        startAt: startAt ? new Date(startAt).toISOString() : null,
        endAt: endAt ? new Date(endAt).toISOString() : null,
        daypartSlots,
        enabled,
        isPaid,
        advertiserName: advertiserName || null,
        contentType,
        contentFamily: contentFamily || null,
        targetVenueTypes,
        targetLoopThemes,
        hostPhraseId: hostPhraseId || null,
        narrationText: narrationText || null,
        voiceProfile: voiceProfile || null,
        narrationEnabled,
        audioUrl: audioUrl || null,
        captionUrl: captionUrl || null,
        subtitleText: subtitleText || null,
      };
      if (editing) {
        return apiRequest("PATCH", `/api/admin/tv/items/${editing.id}`, body);
      }
      return apiRequest("POST", "/api/admin/tv/items", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tv/items"] });
      toast({ title: editing ? "Item updated" : "Item created" });
      setDialogOpen(false);
    },
    onError: (err: any) => toast({ title: err.message || "Error saving item", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/tv/items/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tv/items"] });
      toast({ title: "Item deleted" });
    },
    onError: () => toast({ title: "Error deleting item", variant: "destructive" }),
  });

  const toggleEnabledMutation = useMutation({
    mutationFn: async ({ id, val }: { id: string; val: boolean }) =>
      apiRequest("PATCH", `/api/admin/tv/items/${id}`, { enabled: val }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/tv/items"] }),
  });

  const generateNarrationMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        text: narrationText,
        voiceProfile,
      };
      if (editing) body.itemId = editing.id;
      const res = await apiRequest("POST", "/api/admin/tv/generate-narration", body);
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.audioUrl) {
        setAudioUrl(data.audioUrl);
        setNarrationEnabled(true);
        if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
        setIsAudioPlaying(false);
      }
      toast({ title: "Narration audio generated" });
      if (editing) queryClient.invalidateQueries({ queryKey: ["/api/admin/tv/items"] });
    },
    onError: (err: any) => toast({ title: err.message || "Failed to generate narration", variant: "destructive" }),
  });

  const generateCaptionsMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        narrationText,
      };
      if (editing) body.itemId = editing.id;
      if (durationSec) body.durationSec = parseInt(durationSec);
      const res = await apiRequest("POST", "/api/admin/tv/generate-captions", body);
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.captionUrl) {
        setCaptionUrl(data.captionUrl);
        setCaptionEnabled(true);
      }
      toast({ title: "Captions generated" });
      if (editing) queryClient.invalidateQueries({ queryKey: ["/api/admin/tv/items"] });
    },
    onError: (err: any) => toast({ title: err.message || "Failed to generate captions", variant: "destructive" }),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground p-4">Loading items...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold" data-testid="text-content-title">TV Content Items</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={scopeFilter} onValueChange={setScopeFilter}>
            <SelectTrigger className="w-[120px]" data-testid="select-scope-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Scopes</SelectItem>
              <SelectItem value="metro">Metro</SelectItem>
              <SelectItem value="hub">Hub</SelectItem>
              <SelectItem value="location">Location</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[120px]" data-testid="select-type-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Types</SelectItem>
              <SelectItem value="slide">Slide</SelectItem>
              <SelectItem value="video">Video</SelectItem>
            </SelectContent>
          </Select>
          <Select value={enabledFilter} onValueChange={setEnabledFilter}>
            <SelectTrigger className="w-[120px]" data-testid="select-enabled-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="enabled">Enabled</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={openCreate} data-testid="button-create-item">
            <Plus className="h-4 w-4 mr-1" /> New Item
          </Button>
        </div>
      </div>

      <div className="border rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Title</th>
              <th className="text-center p-3 font-medium">Type</th>
              <th className="text-center p-3 font-medium">Scope</th>
              <th className="text-left p-3 font-medium">Template</th>
              <th className="text-center p-3 font-medium">Status</th>
              <th className="text-center p-3 font-medium">Enabled</th>
              <th className="text-center p-3 font-medium">Priority</th>
              <th className="text-center p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedFilteredItems.map((item) => {
              const expired = isExpired(item.endAt);
              return (
                <tr key={item.id} className={`border-b last:border-b-0 ${expired ? "opacity-60" : ""}`} data-testid={`row-item-${item.id}`}>
                  <td className="p-3 font-medium max-w-[200px] truncate">{item.title}</td>
                  <td className="p-3 text-center">
                    <Badge variant={item.type === "slide" ? "default" : "secondary"}>{item.type === "slide" ? "Slide" : "Video"}</Badge>
                  </td>
                  <td className="p-3 text-center">
                    <Badge variant="outline">{item.sourceScope}</Badge>
                  </td>
                  <td className="p-3 text-muted-foreground">{item.templateKey || "-"}</td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1 flex-wrap">
                      {expired && (
                        <Badge variant="destructive" data-testid={`badge-expired-${item.id}`}>Expired</Badge>
                      )}
                      {item.isPaid && (
                        <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30 no-default-hover-elevate no-default-active-elevate" data-testid={`badge-paid-${item.id}`}>
                          <DollarSign className="h-3 w-3" />
                        </Badge>
                      )}
                      {item.templateKey === "venue_special" && (
                        <Badge variant="outline" data-testid={`badge-venue-${item.id}`}>
                          <Home className="h-3 w-3" />
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <Switch
                      checked={item.enabled}
                      onCheckedChange={(v) => toggleEnabledMutation.mutate({ id: item.id, val: v })}
                      data-testid={`switch-enabled-${item.id}`}
                    />
                  </td>
                  <td className="p-3 text-center text-muted-foreground">{item.priority}</td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(item)} data-testid={`button-edit-item-${item.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(item.id)} data-testid={`button-delete-item-${item.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {sortedFilteredItems.length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No content items</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Content Item" : "Create Content Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} data-testid="input-item-title" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger data-testid="select-item-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="slide">Slide</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Source Scope</Label>
                <Select value={sourceScope} onValueChange={setSourceScope}>
                  <SelectTrigger data-testid="select-item-scope"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="metro">Metro</SelectItem>
                    <SelectItem value="hub">Hub</SelectItem>
                    <SelectItem value="location">Location</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hub Slug</Label>
                <Input value={itemHubSlug} onChange={(e) => setItemHubSlug(e.target.value)} data-testid="input-item-hub-slug" />
              </div>
              <div className="space-y-2">
                <Label>Location Slug</Label>
                <Input value={itemLocationSlug} onChange={(e) => setItemLocationSlug(e.target.value)} data-testid="input-item-location-slug" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Template Key</Label>
              <Select value={templateKey} onValueChange={handleTemplateKeyChange}>
                <SelectTrigger data-testid="select-template-key"><SelectValue placeholder="Select template..." /></SelectTrigger>
                <SelectContent>
                  {TEMPLATE_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {templateKey && (
              <div className="flex items-center gap-3 pt-1">
                <Switch checked={codeMode} onCheckedChange={handleCodeModeToggle} data-testid="switch-code-mode" />
                <Label className="text-sm">Code Mode</Label>
              </div>
            )}

            {codeMode ? (
              <div className="space-y-2">
                <Label>Data (JSON)</Label>
                <Textarea value={dataJson} onChange={(e) => setDataJson(e.target.value)} className="resize-none font-mono text-xs" rows={6} data-testid="input-item-data" />
              </div>
            ) : templateKey ? (
              <VisualSlideFields
                templateKey={templateKey}
                fieldValues={visualFields}
                onChange={handleVisualFieldChange}
              />
            ) : (
              <div className="space-y-2">
                <Label>Data (JSON)</Label>
                <Textarea value={dataJson} onChange={(e) => setDataJson(e.target.value)} className="resize-none font-mono text-xs" rows={4} data-testid="input-item-data" />
              </div>
            )}

            {templateKey && (
              <SlidePreview
                templateKey={templateKey}
                data={currentPreviewData}
                qrUrl={qrUrl}
                assetUrl={assetUrl}
              />
            )}

            <div className="space-y-2">
              <Label>Content Type</Label>
              <Select value={contentType} onValueChange={setContentType}>
                <SelectTrigger data-testid="select-content-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="slide">Slide</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="narrated_segment">Narrated Segment</SelectItem>
                  <SelectItem value="live_data">Live Data</SelectItem>
                  <SelectItem value="venue_insert">Venue Insert</SelectItem>
                  <SelectItem value="support_local">Support Local</SelectItem>
                  <SelectItem value="nonprofit_feature">Nonprofit Feature</SelectItem>
                  <SelectItem value="promo">Promo</SelectItem>
                  <SelectItem value="social_clip">Social Clip</SelectItem>
                  <SelectItem value="informational">Informational</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Content Family</Label>
              <Select value={contentFamily || "none"} onValueChange={(v) => setContentFamily(v === "none" ? "" : v)}>
                <SelectTrigger data-testid="select-content-family"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="tonight_around_you">Tonight Around You</SelectItem>
                  <SelectItem value="weekend_happenings">Weekend Happenings</SelectItem>
                  <SelectItem value="support_local">Support Local</SelectItem>
                  <SelectItem value="local_commerce_spotlight">Local Commerce Spotlight</SelectItem>
                  <SelectItem value="nonprofit_showcase">Nonprofit Showcase</SelectItem>
                  <SelectItem value="community_partner">Community Partner</SelectItem>
                  <SelectItem value="neighborhood_favorite">Neighborhood Favorite</SelectItem>
                  <SelectItem value="venue_spotlight">Venue Spotlight</SelectItem>
                  <SelectItem value="local_pulse">Local Pulse</SelectItem>
                  <SelectItem value="info_now">Info Now</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Target Venue Types (comma-separated)</Label>
              <Input
                value={targetVenueTypes.join(", ")}
                onChange={(e) => setTargetVenueTypes(e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                placeholder="bar, restaurant, gym"
                data-testid="input-target-venue-types"
              />
            </div>
            <div className="space-y-2">
              <Label>Target Loop Themes (comma-separated)</Label>
              <Input
                value={targetLoopThemes.join(", ")}
                onChange={(e) => setTargetLoopThemes(e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                placeholder="local_pulse, community, nightlife"
                data-testid="input-target-loop-themes"
              />
            </div>
            <div className="space-y-2">
              <Label>Host Phrase</Label>
              <Select value={hostPhraseId || "none"} onValueChange={(v) => setHostPhraseId(v === "none" ? "" : v)}>
                <SelectTrigger data-testid="select-host-phrase"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="__random_intro">Random (Intro category)</SelectItem>
                  <SelectItem value="__random_event">Random (Event category)</SelectItem>
                  <SelectItem value="__random_business">Random (Business category)</SelectItem>
                  <SelectItem value="__random_nonprofit">Random (Nonprofit category)</SelectItem>
                  <SelectItem value="__random_neighborhood">Random (Neighborhood category)</SelectItem>
                  {(hostPhrases || []).map((hp) => (
                    <SelectItem key={hp.id} value={hp.id}>
                      {hp.phraseText.length > 50 ? hp.phraseText.slice(0, 50) + "..." : hp.phraseText} ({hp.category})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Asset URL</Label>
                <Input value={assetUrl} onChange={(e) => setAssetUrl(e.target.value)} data-testid="input-item-asset-url" />
              </div>
              <div className="space-y-2">
                <Label>Video URL</Label>
                <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} data-testid="input-item-video-url" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Click URL</Label>
                <Input value={clickUrl} onChange={(e) => setClickUrl(e.target.value)} data-testid="input-item-click-url" />
              </div>
              <div className="space-y-2">
                <Label>QR URL</Label>
                <Input value={qrUrl} onChange={(e) => setQrUrl(e.target.value)} data-testid="input-item-qr-url" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Duration (sec)</Label>
                <Input type="number" value={durationSec} onChange={(e) => setDurationSec(e.target.value)} data-testid="input-item-duration" />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Input type="number" value={priority} onChange={(e) => setPriority(e.target.value)} data-testid="input-item-priority" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start At</Label>
                <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} data-testid="input-item-start" />
              </div>
              <div className="space-y-2">
                <Label>End At</Label>
                <Input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} data-testid="input-item-end" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Daypart Slots</Label>
              <div className="flex flex-wrap gap-3">
                {DAYPART_OPTIONS.map((dp) => (
                  <label key={dp} className="flex items-center gap-1.5 text-sm">
                    <Checkbox
                      checked={daypartSlots.includes(dp)}
                      onCheckedChange={(checked) => {
                        setDaypartSlots(prev =>
                          checked ? [...prev, dp] : prev.filter(d => d !== dp)
                        );
                      }}
                      data-testid={`checkbox-daypart-${dp}`}
                    />
                    {dp.charAt(0).toUpperCase() + dp.slice(1)}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={enabled} onCheckedChange={setEnabled} data-testid="switch-item-enabled" />
                <Label>Enabled</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={isPaid} onCheckedChange={setIsPaid} data-testid="switch-item-paid" />
                <Label>Paid</Label>
              </div>
            </div>
            {isPaid && (
              <div className="space-y-2">
                <Label>Advertiser Name</Label>
                <Input value={advertiserName} onChange={(e) => setAdvertiserName(e.target.value)} data-testid="input-item-advertiser" />
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={() => saveMutation.mutate()} disabled={!title || saveMutation.isPending} data-testid="button-save-item">
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                {editing ? "Update" : "Create"}
              </Button>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PlacementsTab({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TvPlacement | null>(null);

  const [placementName, setPlacementName] = useState("");
  const [advertiserName, setAdvertiserName] = useState("");
  const [amountMonthlyCents, setAmountMonthlyCents] = useState("");
  const [screenId, setScreenId] = useState("");
  const [hubSlug, setHubSlug] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [tvItemId, setTvItemId] = useState("");
  const [placementEnabled, setPlacementEnabled] = useState(true);
  const [placementType, setPlacementType] = useState("sponsor_ad");
  const [quarterlyTerm, setQuarterlyTerm] = useState("");
  const [includesEnhancedPresenceBonus, setIncludesEnhancedPresenceBonus] = useState(false);
  const [valueDisplayText, setValueDisplayText] = useState("");
  const [placementNarrationEnabled, setPlacementNarrationEnabled] = useState(false);
  const [placementCaptionEnabled, setPlacementCaptionEnabled] = useState(false);
  const [competitorSensitive, setCompetitorSensitive] = useState(false);

  const tvQueryFn = (endpoint: string) => async () => {
    const p = new URLSearchParams();
    if (cityId) p.set("cityId", cityId);
    const res = await fetch(`${endpoint}?${p}`, { credentials: "include" });
    if (!res.ok) return [];
    return res.json();
  };

  const { data: placements, isLoading } = useQuery<TvPlacement[]>({
    queryKey: ["/api/admin/tv/placements", cityId],
    queryFn: tvQueryFn("/api/admin/tv/placements"),
  });

  const { data: screens } = useQuery<TvScreen[]>({
    queryKey: ["/api/admin/tv/screens", cityId],
    queryFn: tvQueryFn("/api/admin/tv/screens"),
  });

  const resetForm = (p?: TvPlacement | null) => {
    setPlacementName(p?.placementName || "");
    setAdvertiserName(p?.advertiserName || "");
    setAmountMonthlyCents(p?.amountMonthlyCents != null ? String(p.amountMonthlyCents) : "");
    setScreenId(p?.screenId || "");
    setHubSlug(p?.hubSlug || "");
    setStartAt(p?.startAt ? new Date(p.startAt).toISOString().slice(0, 16) : "");
    setEndAt(p?.endAt ? new Date(p.endAt).toISOString().slice(0, 16) : "");
    setTvItemId(p?.tvItemId || "");
    setPlacementEnabled(p?.enabled ?? true);
    setPlacementType(p?.placementType || "sponsor_ad");
    setQuarterlyTerm(p?.quarterlyTerm || "");
    setIncludesEnhancedPresenceBonus(p?.includesEnhancedPresenceBonus ?? false);
    setValueDisplayText(p?.valueDisplayText || "");
    setPlacementNarrationEnabled(p?.narrationEnabled ?? false);
    setPlacementCaptionEnabled(p?.captionEnabled ?? false);
    setCompetitorSensitive(p?.competitorSensitive ?? false);
  };

  const openCreate = () => { setEditing(null); resetForm(); setDialogOpen(true); };
  const openEdit = (p: TvPlacement) => { setEditing(p); resetForm(p); setDialogOpen(true); };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        placementName,
        advertiserName,
        amountMonthlyCents: parseInt(amountMonthlyCents) || 0,
        screenId: screenId && screenId !== "none" ? screenId : null,
        hubSlug: hubSlug || null,
        startAt: startAt ? new Date(startAt).toISOString() : new Date().toISOString(),
        endAt: endAt ? new Date(endAt).toISOString() : null,
        tvItemId: tvItemId || null,
        enabled: placementEnabled,
        placementType,
        quarterlyTerm: quarterlyTerm || null,
        includesEnhancedPresenceBonus,
        valueDisplayText: valueDisplayText || null,
        narrationEnabled: placementNarrationEnabled,
        captionEnabled: placementCaptionEnabled,
        competitorSensitive,
      };
      if (editing) {
        return apiRequest("PATCH", `/api/admin/tv/placements/${editing.id}`, body);
      }
      return apiRequest("POST", "/api/admin/tv/placements", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tv/placements"] });
      toast({ title: editing ? "Placement updated" : "Placement created" });
      setDialogOpen(false);
    },
    onError: () => toast({ title: "Error saving placement", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/tv/placements/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tv/placements"] });
      toast({ title: "Placement deleted" });
    },
    onError: () => toast({ title: "Error deleting placement", variant: "destructive" }),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground p-4">Loading placements...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold" data-testid="text-placements-title">Ad Placements</h3>
        <Button onClick={openCreate} data-testid="button-create-placement">
          <Plus className="h-4 w-4 mr-1" /> New Placement
        </Button>
      </div>

      <div className="border rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Placement</th>
              <th className="text-left p-3 font-medium">Advertiser</th>
              <th className="text-center p-3 font-medium">Type</th>
              <th className="text-right p-3 font-medium">Monthly</th>
              <th className="text-left p-3 font-medium">Dates</th>
              <th className="text-center p-3 font-medium">Enabled</th>
              <th className="text-center p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(placements || []).map((p) => (
              <tr key={p.id} className="border-b last:border-b-0" data-testid={`row-placement-${p.id}`}>
                <td className="p-3 font-medium">{p.placementName}</td>
                <td className="p-3 text-muted-foreground">{p.advertiserName}</td>
                <td className="p-3 text-center">
                  <Badge variant="outline" data-testid={`badge-type-${p.id}`}>{p.placementType?.replace(/_/g, ' ') || 'sponsor ad'}</Badge>
                </td>
                <td className="p-3 text-right">{formatCents(p.amountMonthlyCents)}</td>
                <td className="p-3 text-muted-foreground text-xs">
                  {p.startAt ? new Date(p.startAt).toLocaleDateString() : "-"}
                  {" - "}
                  {p.endAt ? new Date(p.endAt).toLocaleDateString() : "Ongoing"}
                </td>
                <td className="p-3 text-center">
                  <Badge variant={p.enabled ? "default" : "secondary"}>{p.enabled ? "Yes" : "No"}</Badge>
                </td>
                <td className="p-3">
                  <div className="flex items-center justify-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(p)} data-testid={`button-edit-placement-${p.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(p.id)} data-testid={`button-delete-placement-${p.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {(placements || []).length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No placements</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Placement" : "Create Placement"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Placement Name</Label>
              <Input value={placementName} onChange={(e) => setPlacementName(e.target.value)} data-testid="input-placement-name" />
            </div>
            <div className="space-y-2">
              <Label>Advertiser Name</Label>
              <Input value={advertiserName} onChange={(e) => setAdvertiserName(e.target.value)} data-testid="input-placement-advertiser" />
            </div>
            <div className="space-y-2">
              <Label>Amount Monthly (cents)</Label>
              <Input type="number" value={amountMonthlyCents} onChange={(e) => setAmountMonthlyCents(e.target.value)} data-testid="input-placement-amount" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Screen</Label>
                <Select value={screenId} onValueChange={setScreenId}>
                  <SelectTrigger data-testid="select-placement-screen"><SelectValue placeholder="Any screen..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No specific screen</SelectItem>
                    {(screens || []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Hub Slug</Label>
                <Input value={hubSlug} onChange={(e) => setHubSlug(e.target.value)} data-testid="input-placement-hub" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start At</Label>
                <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} data-testid="input-placement-start" />
              </div>
              <div className="space-y-2">
                <Label>End At</Label>
                <Input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} data-testid="input-placement-end" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>TV Item ID (optional)</Label>
              <Input value={tvItemId} onChange={(e) => setTvItemId(e.target.value)} data-testid="input-placement-item-id" />
            </div>
            <div className="space-y-2">
              <Label>Placement Type</Label>
              <Select value={placementType} onValueChange={setPlacementType}>
                <SelectTrigger data-testid="select-placement-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="support_local">Support Local</SelectItem>
                  <SelectItem value="local_commerce_spotlight">Local Commerce Spotlight</SelectItem>
                  <SelectItem value="community_partner">Community Partner</SelectItem>
                  <SelectItem value="neighborhood_favorite">Neighborhood Favorite</SelectItem>
                  <SelectItem value="nonprofit_showcase">Nonprofit Showcase</SelectItem>
                  <SelectItem value="sponsor_ad">Sponsor Ad</SelectItem>
                  <SelectItem value="venue_bonus">Venue Bonus</SelectItem>
                  <SelectItem value="enhanced_presence_bonus">Enhanced Presence Bonus</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quarterly Term</Label>
                <Input value={quarterlyTerm} onChange={(e) => setQuarterlyTerm(e.target.value)} placeholder="Q1 2026" data-testid="input-placement-quarterly-term" />
              </div>
              <div className="space-y-2">
                <Label>Value Display Text</Label>
                <Input value={valueDisplayText} onChange={(e) => setValueDisplayText(e.target.value)} placeholder="$299/month value" data-testid="input-placement-value-text" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={includesEnhancedPresenceBonus} onCheckedChange={setIncludesEnhancedPresenceBonus} data-testid="switch-placement-presence-bonus" />
              <Label>Includes Enhanced Presence Bonus</Label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <Switch checked={placementNarrationEnabled} onCheckedChange={setPlacementNarrationEnabled} data-testid="switch-placement-narration" />
                <Label>Narration Enabled</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={placementCaptionEnabled} onCheckedChange={setPlacementCaptionEnabled} data-testid="switch-placement-caption" />
                <Label>Caption Enabled</Label>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={competitorSensitive} onCheckedChange={setCompetitorSensitive} data-testid="switch-placement-competitor" />
              <Label>Competitor Sensitive</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={placementEnabled} onCheckedChange={setPlacementEnabled} data-testid="switch-placement-enabled" />
              <Label>Enabled</Label>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={() => saveMutation.mutate()} disabled={!placementName || !advertiserName || saveMutation.isPending} data-testid="button-save-placement">
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                {editing ? "Update" : "Create"}
              </Button>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const VENUE_TYPE_OPTIONS = [
  "bar", "restaurant", "brewery", "coffee_shop", "coworking", "gym",
  "salon", "hotel_lobby", "retail", "medical_office", "community_center",
];

const DAYTIME_TAG_OPTIONS = ["morning", "afternoon", "evening", "latenight", "weekend"];

const ORDER_STRATEGY_OPTIONS = [
  { value: "fixed", label: "Fixed Order" },
  { value: "weighted_shuffle", label: "Weighted Shuffle" },
  { value: "semi_random", label: "Semi-Random" },
];

const NARRATION_STYLE_OPTIONS = [
  { value: "warm_local", label: "Warm Local" },
  { value: "upbeat", label: "Upbeat" },
  { value: "calm", label: "Calm" },
  { value: "nightlife", label: "Nightlife" },
];

const SUBTITLE_MODE_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "always", label: "Always" },
  { value: "off", label: "Off" },
];

function LoopsTab({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [itemsDialogOpen, setItemsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TvLoop | null>(null);
  const [selectedLoop, setSelectedLoop] = useState<TvLoop | null>(null);

  const [loopName, setLoopName] = useState("");
  const [loopSlug, setLoopSlug] = useState("");
  const [loopDescription, setLoopDescription] = useState("");
  const [durationTargetMinutes, setDurationTargetMinutes] = useState("60");
  const [theme, setTheme] = useState("");
  const [audienceType, setAudienceType] = useState("");
  const [venueTypes, setVenueTypes] = useState<string[]>([]);
  const [orderStrategy, setOrderStrategy] = useState("semi_random");
  const [daytimeTags, setDaytimeTags] = useState<string[]>([]);
  const [narrationStyle, setNarrationStyle] = useState("");
  const [subtitleMode, setSubtitleMode] = useState("auto");
  const [loopEnabled, setLoopEnabled] = useState(true);

  const [newItemTvItemId, setNewItemTvItemId] = useState("");
  const [newItemSectionLabel, setNewItemSectionLabel] = useState("");
  const [newItemWeight, setNewItemWeight] = useState("1");
  const [newItemIsRequired, setNewItemIsRequired] = useState(false);

  const tvQueryFn = (endpoint: string) => async () => {
    const p = new URLSearchParams();
    if (cityId) p.set("cityId", cityId);
    const res = await fetch(`${endpoint}?${p}`, { credentials: "include" });
    if (!res.ok) return [];
    return res.json();
  };

  const { data: loops, isLoading } = useQuery<TvLoop[]>({
    queryKey: ["/api/admin/tv/loops", cityId],
    queryFn: tvQueryFn("/api/admin/tv/loops"),
  });

  const { data: loopItems, isLoading: loopItemsLoading } = useQuery<TvLoopItem[]>({
    queryKey: ["/api/admin/tv/loops", selectedLoop?.id, "items"],
    enabled: !!selectedLoop,
    queryFn: async () => {
      const res = await fetch(`/api/admin/tv/loops/${selectedLoop!.id}/items`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: allItems } = useQuery<TvItem[]>({
    queryKey: ["/api/admin/tv/items", cityId],
    queryFn: tvQueryFn("/api/admin/tv/items"),
  });

  const resetForm = (l?: TvLoop | null) => {
    setLoopName(l?.name || "");
    setLoopSlug(l?.slug || "");
    setLoopDescription(l?.description || "");
    setDurationTargetMinutes(String(l?.durationTargetMinutes ?? 60));
    setTheme(l?.theme || "");
    setAudienceType(l?.audienceType || "");
    setVenueTypes(l?.venueTypes || []);
    setOrderStrategy(l?.orderStrategy || "semi_random");
    setDaytimeTags(l?.daytimeTags || []);
    setNarrationStyle(l?.narrationStyle || "");
    setSubtitleMode(l?.subtitleMode || "auto");
    setLoopEnabled(l?.enabled ?? true);
  };

  const openCreate = () => { setEditing(null); resetForm(); setDialogOpen(true); };
  const openEdit = (l: TvLoop) => { setEditing(l); resetForm(l); setDialogOpen(true); };
  const openItems = (l: TvLoop) => { setSelectedLoop(l); setItemsDialogOpen(true); };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        name: loopName,
        slug: loopSlug,
        description: loopDescription || null,
        durationTargetMinutes: parseInt(durationTargetMinutes) || 60,
        theme: theme || null,
        audienceType: audienceType || null,
        venueTypes,
        orderStrategy,
        daytimeTags,
        narrationStyle: narrationStyle || null,
        subtitleMode,
        enabled: loopEnabled,
      };
      if (editing) {
        return apiRequest("PATCH", `/api/admin/tv/loops/${editing.id}`, body);
      }
      return apiRequest("POST", "/api/admin/tv/loops", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tv/loops"] });
      toast({ title: editing ? "Loop updated" : "Loop created" });
      setDialogOpen(false);
    },
    onError: () => toast({ title: "Error saving loop", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/tv/loops/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tv/loops"] });
      toast({ title: "Loop deleted" });
    },
    onError: () => toast({ title: "Error deleting loop", variant: "destructive" }),
  });

  const addItemMutation = useMutation({
    mutationFn: async () => {
      if (!selectedLoop) return;
      const currentCount = loopItems?.length ?? 0;
      return apiRequest("POST", `/api/admin/tv/loops/${selectedLoop.id}/items`, {
        loopId: selectedLoop.id,
        tvItemId: newItemTvItemId || null,
        position: currentCount,
        sectionLabel: newItemSectionLabel || null,
        weight: parseInt(newItemWeight) || 1,
        isRequired: newItemIsRequired,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tv/loops", selectedLoop?.id, "items"] });
      toast({ title: "Item added to loop" });
      setNewItemTvItemId("");
      setNewItemSectionLabel("");
      setNewItemWeight("1");
      setNewItemIsRequired(false);
    },
    onError: () => toast({ title: "Error adding item", variant: "destructive" }),
  });

  const removeItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      if (!selectedLoop) return;
      return apiRequest("DELETE", `/api/admin/tv/loops/${selectedLoop.id}/items/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tv/loops", selectedLoop?.id, "items"] });
      toast({ title: "Item removed" });
    },
    onError: () => toast({ title: "Error removing item", variant: "destructive" }),
  });

  const estimatedRuntime = useMemo(() => {
    if (!loopItems || !allItems) return 0;
    return loopItems.reduce((sum, li) => {
      if (li.durationOverrideSec) return sum + li.durationOverrideSec;
      const item = allItems.find(i => i.id === li.tvItemId);
      return sum + (item?.durationSec ?? 9);
    }, 0);
  }, [loopItems, allItems]);

  const getItemTitle = (tvItemId: string | null) => {
    if (!tvItemId || !allItems) return "Unknown item";
    const item = allItems.find(i => i.id === tvItemId);
    return item?.title || tvItemId.slice(0, 12) + "...";
  };

  if (isLoading) return <div className="text-sm text-muted-foreground p-4">Loading loops...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold" data-testid="text-loops-title">TV Loops</h3>
        <Button onClick={openCreate} data-testid="button-create-loop">
          <Plus className="h-4 w-4 mr-1" /> New Loop
        </Button>
      </div>

      <div className="border rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Name</th>
              <th className="text-left p-3 font-medium">Theme</th>
              <th className="text-center p-3 font-medium">Duration</th>
              <th className="text-center p-3 font-medium">Strategy</th>
              <th className="text-center p-3 font-medium">Enabled</th>
              <th className="text-center p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(loops || []).map((l) => (
              <tr key={l.id} className="border-b last:border-b-0" data-testid={`row-loop-${l.id}`}>
                <td className="p-3">
                  <div>
                    <span className="font-medium">{l.name}</span>
                    {l.slug && <span className="text-xs text-muted-foreground ml-2">/{l.slug}</span>}
                  </div>
                  {l.description && <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[250px]">{l.description}</p>}
                </td>
                <td className="p-3 text-muted-foreground">{l.theme || "-"}</td>
                <td className="p-3 text-center">
                  <Badge variant="outline" data-testid={`badge-duration-${l.id}`}>
                    <Clock className="h-3 w-3 mr-1" />{l.durationTargetMinutes}m
                  </Badge>
                </td>
                <td className="p-3 text-center">
                  <Badge variant="secondary">{l.orderStrategy}</Badge>
                </td>
                <td className="p-3 text-center">
                  <Badge variant={l.enabled ? "default" : "secondary"}>{l.enabled ? "Yes" : "No"}</Badge>
                </td>
                <td className="p-3">
                  <div className="flex items-center justify-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openItems(l)} data-testid={`button-loop-items-${l.id}`}>
                      <ListChecks className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(l)} data-testid={`button-edit-loop-${l.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(l.id)} data-testid={`button-delete-loop-${l.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {(loops || []).length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No loops configured</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Loop" : "Create Loop"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={loopName} onChange={(e) => setLoopName(e.target.value)} data-testid="input-loop-name" />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input value={loopSlug} onChange={(e) => setLoopSlug(e.target.value)} placeholder="local-pulse-hour" data-testid="input-loop-slug" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={loopDescription} onChange={(e) => setLoopDescription(e.target.value)} className="resize-none" rows={2} data-testid="input-loop-description" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Duration Target</Label>
                <Select value={durationTargetMinutes} onValueChange={setDurationTargetMinutes}>
                  <SelectTrigger data-testid="select-loop-duration"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="60">60 minutes</SelectItem>
                    <SelectItem value="90">90 minutes</SelectItem>
                    <SelectItem value="120">120 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Order Strategy</Label>
                <Select value={orderStrategy} onValueChange={setOrderStrategy}>
                  <SelectTrigger data-testid="select-loop-order-strategy"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ORDER_STRATEGY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Theme</Label>
                <Input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="community, nightlife, etc." data-testid="input-loop-theme" />
              </div>
              <div className="space-y-2">
                <Label>Audience Type</Label>
                <Input value={audienceType} onChange={(e) => setAudienceType(e.target.value)} placeholder="general, family, etc." data-testid="input-loop-audience" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Narration Style</Label>
                <Select value={narrationStyle || "none"} onValueChange={(v) => setNarrationStyle(v === "none" ? "" : v)}>
                  <SelectTrigger data-testid="select-loop-narration-style"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {NARRATION_STYLE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Subtitle Mode</Label>
                <Select value={subtitleMode} onValueChange={setSubtitleMode}>
                  <SelectTrigger data-testid="select-loop-subtitle-mode"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SUBTITLE_MODE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Venue Types</Label>
              <div className="flex flex-wrap gap-2">
                {VENUE_TYPE_OPTIONS.map((vt) => (
                  <label key={vt} className="flex items-center gap-1.5 text-sm">
                    <Checkbox
                      checked={venueTypes.includes(vt)}
                      onCheckedChange={(checked) => {
                        setVenueTypes(prev =>
                          checked ? [...prev, vt] : prev.filter(v => v !== vt)
                        );
                      }}
                      data-testid={`checkbox-venue-type-${vt}`}
                    />
                    {vt.replace(/_/g, " ")}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Daytime Tags</Label>
              <div className="flex flex-wrap gap-3">
                {DAYTIME_TAG_OPTIONS.map((dt) => (
                  <label key={dt} className="flex items-center gap-1.5 text-sm">
                    <Checkbox
                      checked={daytimeTags.includes(dt)}
                      onCheckedChange={(checked) => {
                        setDaytimeTags(prev =>
                          checked ? [...prev, dt] : prev.filter(d => d !== dt)
                        );
                      }}
                      data-testid={`checkbox-daytime-${dt}`}
                    />
                    {dt.charAt(0).toUpperCase() + dt.slice(1)}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={loopEnabled} onCheckedChange={setLoopEnabled} data-testid="switch-loop-enabled" />
              <Label>Enabled</Label>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={() => saveMutation.mutate()} disabled={!loopName || !loopSlug || saveMutation.isPending} data-testid="button-save-loop">
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                {editing ? "Update" : "Create"}
              </Button>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={itemsDialogOpen} onOpenChange={setItemsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Loop Items: {selectedLoop?.name}
              {selectedLoop && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  (Target: {selectedLoop.durationTargetMinutes}m)
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="outline" data-testid="badge-estimated-runtime">
                <Clock className="h-3 w-3 mr-1" />
                Estimated: {Math.floor(estimatedRuntime / 60)}m {estimatedRuntime % 60}s
              </Badge>
              {selectedLoop && (
                <Badge
                  variant={estimatedRuntime / 60 > selectedLoop.durationTargetMinutes ? "destructive" : estimatedRuntime / 60 < selectedLoop.durationTargetMinutes * 0.8 ? "secondary" : "default"}
                  data-testid="badge-runtime-status"
                >
                  {estimatedRuntime / 60 > selectedLoop.durationTargetMinutes
                    ? "Over target"
                    : estimatedRuntime / 60 < selectedLoop.durationTargetMinutes * 0.8
                      ? "Under target"
                      : "On target"}
                </Badge>
              )}
            </div>

            {loopItemsLoading ? (
              <div className="text-sm text-muted-foreground">Loading items...</div>
            ) : (
              <div className="border rounded-md">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-center p-2 font-medium w-12">#</th>
                      <th className="text-left p-2 font-medium">Content Item</th>
                      <th className="text-left p-2 font-medium">Section</th>
                      <th className="text-center p-2 font-medium">Weight</th>
                      <th className="text-center p-2 font-medium">Required</th>
                      <th className="text-center p-2 font-medium w-12">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(loopItems || []).sort((a, b) => a.position - b.position).map((li) => (
                      <tr key={li.id} className="border-b last:border-b-0" data-testid={`row-loop-item-${li.id}`}>
                        <td className="p-2 text-center text-muted-foreground">{li.position + 1}</td>
                        <td className="p-2">
                          <span className="font-medium">{getItemTitle(li.tvItemId)}</span>
                        </td>
                        <td className="p-2 text-muted-foreground">{li.sectionLabel || "-"}</td>
                        <td className="p-2 text-center">{li.weight}</td>
                        <td className="p-2 text-center">
                          {li.isRequired ? <Badge variant="default">Yes</Badge> : <span className="text-muted-foreground">No</span>}
                        </td>
                        <td className="p-2 text-center">
                          <Button size="icon" variant="ghost" onClick={() => removeItemMutation.mutate(li.id)} data-testid={`button-remove-loop-item-${li.id}`}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {(loopItems || []).length === 0 && (
                      <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No items in this loop</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <Card className="p-4">
              <h4 className="font-medium text-sm mb-3">Add Item to Loop</h4>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Content Item</Label>
                  <Select value={newItemTvItemId} onValueChange={setNewItemTvItemId}>
                    <SelectTrigger data-testid="select-loop-add-item"><SelectValue placeholder="Select content item..." /></SelectTrigger>
                    <SelectContent>
                      {(allItems || []).filter(i => i.enabled).map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.title} ({item.templateKey || item.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Section Label</Label>
                    <Input value={newItemSectionLabel} onChange={(e) => setNewItemSectionLabel(e.target.value)} placeholder="opener, main, etc." data-testid="input-loop-item-section" />
                  </div>
                  <div className="space-y-2">
                    <Label>Weight</Label>
                    <Input type="number" value={newItemWeight} onChange={(e) => setNewItemWeight(e.target.value)} data-testid="input-loop-item-weight" />
                  </div>
                  <div className="space-y-2 flex flex-col justify-end">
                    <div className="flex items-center gap-2">
                      <Checkbox checked={newItemIsRequired} onCheckedChange={(v) => setNewItemIsRequired(!!v)} data-testid="checkbox-loop-item-required" />
                      <Label className="text-sm">Required</Label>
                    </div>
                  </div>
                </div>
                <Button onClick={() => addItemMutation.mutate()} disabled={!newItemTvItemId || addItemMutation.isPending} data-testid="button-add-loop-item">
                  {addItemMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                  Add Item
                </Button>
              </div>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface TvAnalytics {
  totalQrScans: number;
  totalImpressions: number;
  engagementRate: number;
  activeScreenCount: number;
  totalScreenCount: number;
  dailyTimeSeries: { date: string; scans: number; impressions: number }[];
  scansByTemplate: { templateKey: string; count: number }[];
  impressionsByTemplate: { templateKey: string; count: number }[];
  hourlyDistribution: { hour: number; scans: number; impressions: number }[];
  topContentByScans: { count: number; templateKey: string; itemId: string }[];
  topContentByImpressions: { count: number; templateKey: string; itemId: string }[];
  byScreen: { screenId: string; venueName: string; hubSlug: string | null; impressions: number; scans: number; lastHeartbeat: string | null; status: string }[];
  recentPlays: {
    id: string;
    itemId: string;
    templateKey: string;
    playedAt: string;
    durationSec: number | null;
    hubSlug: string | null;
  }[];
}

interface LinkableItem {
  id: string;
  title: string;
  type: string;
  status?: string;
}

interface ContentLink {
  id: string;
  screenId: string | null;
  hubSlug: string | null;
  contentType: string;
  contentId: string;
  contentTitle: string;
  status: string;
  templateOverride: string | null;
  slideData: Record<string, any> | null;
  displayFrequency: number;
  priority: number;
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
}

function ContentLinksTab({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [editingLink, setEditingLink] = useState<ContentLink | null>(null);
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedContentType, setSelectedContentType] = useState("quiz");
  const [selectedContentId, setSelectedContentId] = useState("");
  const [selectedContentTitle, setSelectedContentTitle] = useState("");
  const [formScreenId, setFormScreenId] = useState("");
  const [formHubSlug, setFormHubSlug] = useState("");
  const [formStatus, setFormStatus] = useState("draft");
  const [formPriority, setFormPriority] = useState("5");
  const [formFrequency, setFormFrequency] = useState("1");
  const [formSlideData, setFormSlideData] = useState("{}");

  const { data: links = [], isLoading } = useQuery<ContentLink[]>({
    queryKey: ["/api/admin/tv/content-links", filterType, filterStatus],
    queryFn: async () => {
      const qp = new URLSearchParams();
      if (filterType !== "all") qp.set("contentType", filterType);
      if (filterStatus !== "all") qp.set("status", filterStatus);
      const r = await fetch(`/api/admin/tv/content-links?${qp.toString()}`);
      return r.json();
    },
  });

  const { data: linkableContent = [] } = useQuery<LinkableItem[]>({
    queryKey: ["/api/admin/tv/linkable-content", selectedContentType],
    queryFn: async () => {
      const r = await fetch(`/api/admin/tv/linkable-content?type=${selectedContentType}`);
      return r.json();
    },
  });

  const { data: screens = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/admin/tv/screens"],
  });

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, any>) => {
      const r = await apiRequest("POST", "/api/admin/tv/content-links", body);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tv/content-links"] });
      setShowCreate(false);
      resetForm();
      toast({ title: "Content link created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...body }: Record<string, any>) => {
      const r = await apiRequest("PATCH", `/api/admin/tv/content-links/${id}`, body);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tv/content-links"] });
      setEditingLink(null);
      resetForm();
      toast({ title: "Content link updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/tv/content-links/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tv/content-links"] });
      toast({ title: "Content link deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function resetForm() {
    setSelectedContentType("quiz");
    setSelectedContentId("");
    setSelectedContentTitle("");
    setFormScreenId("");
    setFormHubSlug("");
    setFormStatus("draft");
    setFormPriority("5");
    setFormFrequency("1");
    setFormSlideData("{}");
  }

  function openEdit(link: ContentLink) {
    setEditingLink(link);
    setSelectedContentType(link.contentType);
    setSelectedContentId(link.contentId);
    setSelectedContentTitle(link.contentTitle);
    setFormScreenId(link.screenId || "");
    setFormHubSlug(link.hubSlug || "");
    setFormStatus(link.status);
    setFormPriority(String(link.priority));
    setFormFrequency(String(link.displayFrequency));
    setFormSlideData(link.slideData ? JSON.stringify(link.slideData, null, 2) : "{}");
  }

  function handleSubmit() {
    let slideData = {};
    try { slideData = JSON.parse(formSlideData); } catch { slideData = {}; }

    const payload = {
      contentType: selectedContentType,
      contentId: selectedContentId,
      contentTitle: selectedContentTitle,
      screenId: formScreenId || null,
      hubSlug: formHubSlug || null,
      status: formStatus,
      priority: parseInt(formPriority) || 5,
      displayFrequency: parseInt(formFrequency) || 1,
      slideData,
    };

    if (editingLink) {
      updateMutation.mutate({ id: editingLink.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const statusColors: Record<string, string> = {
    draft: "bg-gray-500/10 text-gray-400 border-gray-500/20",
    published: "bg-green-500/10 text-green-400 border-green-500/20",
    paused: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    expired: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  const typeIcons: Record<string, string> = { quiz: "HelpCircle", giveaway: "Megaphone", job: "Briefcase", event: "Calendar", article: "FileText" };

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4" data-testid="content-links-tab">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[140px]" data-testid="select-filter-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="quiz">Quizzes</SelectItem>
              <SelectItem value="giveaway">Giveaways</SelectItem>
              <SelectItem value="job">Jobs</SelectItem>
              <SelectItem value="event">Events</SelectItem>
              <SelectItem value="article">Articles</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]" data-testid="select-filter-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => { resetForm(); setShowCreate(true); }} data-testid="button-create-content-link">
          <Plus className="h-4 w-4 mr-2" />
          Link Content
        </Button>
      </div>

      {links.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground mb-4">No content links yet. Attach quizzes, giveaways, or jobs to your TV screens.</p>
          <Button onClick={() => { resetForm(); setShowCreate(true); }} data-testid="button-create-content-link-empty">
            <Plus className="h-4 w-4 mr-2" />
            Create First Link
          </Button>
        </Card>
      )}

      <div className="grid gap-3">
        {links.map((link) => (
          <Card key={link.id} className="p-4" data-testid={`content-link-card-${link.id}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <Badge className={`${statusColors[link.status] || statusColors.draft} text-xs no-default-hover-elevate no-default-active-elevate`}>
                  {link.status}
                </Badge>
                <Badge variant="outline" className="text-xs no-default-hover-elevate no-default-active-elevate">
                  {link.contentType}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate" data-testid={`text-link-title-${link.id}`}>{link.contentTitle}</p>
                  <p className="text-xs text-muted-foreground">
                    {link.screenId ? `Screen: ${link.screenId.slice(0, 8)}...` : link.hubSlug ? `Hub: ${link.hubSlug}` : "All screens"} | Priority: {link.priority} | Freq: {link.displayFrequency}x
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 ml-3">
                {link.status === "draft" && (
                  <Button
                    size="sm"
                    onClick={() => updateMutation.mutate({ id: link.id, status: "published" })}
                    disabled={updateMutation.isPending}
                    data-testid={`button-publish-link-${link.id}`}
                  >
                    <Play className="h-3.5 w-3.5 mr-1" />
                    Publish
                  </Button>
                )}
                {link.status === "published" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateMutation.mutate({ id: link.id, status: "paused" })}
                    disabled={updateMutation.isPending}
                    data-testid={`button-pause-link-${link.id}`}
                  >
                    <Pause className="h-3.5 w-3.5 mr-1" />
                    Pause
                  </Button>
                )}
                {link.status === "paused" && (
                  <Button
                    size="sm"
                    onClick={() => updateMutation.mutate({ id: link.id, status: "published" })}
                    disabled={updateMutation.isPending}
                    data-testid={`button-resume-link-${link.id}`}
                  >
                    <Play className="h-3.5 w-3.5 mr-1" />
                    Resume
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openEdit(link)}
                  data-testid={`button-edit-link-${link.id}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => deleteMutation.mutate(link.id)}
                  disabled={deleteMutation.isPending}
                  data-testid={`button-delete-link-${link.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={showCreate || !!editingLink} onOpenChange={(open) => { if (!open) { setShowCreate(false); setEditingLink(null); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLink ? "Edit Content Link" : "Link Content to TV"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Content Type</Label>
              <Select value={selectedContentType} onValueChange={(v) => { setSelectedContentType(v); setSelectedContentId(""); setSelectedContentTitle(""); }}>
                <SelectTrigger data-testid="select-content-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="quiz">Quiz</SelectItem>
                  <SelectItem value="giveaway">Giveaway</SelectItem>
                  <SelectItem value="job">Job</SelectItem>
                  <SelectItem value="event">Event</SelectItem>
                  <SelectItem value="article">Article</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Select Content</Label>
              <Select value={selectedContentId} onValueChange={(v) => { setSelectedContentId(v); const found = linkableContent.find(c => c.id === v); if (found) setSelectedContentTitle(found.title); }}>
                <SelectTrigger data-testid="select-content-item">
                  <SelectValue placeholder="Choose content..." />
                </SelectTrigger>
                <SelectContent>
                  {linkableContent.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.title} {item.status ? `(${item.status})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Assign to Screen (optional)</Label>
              <Select value={formScreenId} onValueChange={setFormScreenId}>
                <SelectTrigger data-testid="select-screen">
                  <SelectValue placeholder="All screens" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">All screens</SelectItem>
                  {(screens as Array<{ id: string; name: string }>).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hub Slug (optional scope)</Label>
              <Input value={formHubSlug} onChange={(e) => setFormHubSlug(e.target.value)} placeholder="e.g. south-end" data-testid="input-hub-slug" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={formStatus} onValueChange={setFormStatus}>
                  <SelectTrigger data-testid="select-link-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Priority (1-10)</Label>
                <Input type="number" value={formPriority} onChange={(e) => setFormPriority(e.target.value)} min="1" max="10" data-testid="input-priority" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Frequency</Label>
                <Input type="number" value={formFrequency} onChange={(e) => setFormFrequency(e.target.value)} min="1" max="10" data-testid="input-frequency" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Slide Data Override (JSON)</Label>
              <Textarea
                value={formSlideData}
                onChange={(e) => setFormSlideData(e.target.value)}
                rows={4}
                className="font-mono text-xs resize-none"
                data-testid="input-slide-data"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setShowCreate(false); setEditingLink(null); }} data-testid="button-cancel-link">
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!selectedContentId || createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-link"
              >
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingLink ? "Save Changes" : "Create Link"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AnalyticsTab({ cityId }: { cityId?: string }) {
  const [days, setDays] = useState("30");

  const { data: analytics, isLoading } = useQuery<TvAnalytics>({
    queryKey: ["/api/admin/tv/analytics", cityId, days],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (cityId) p.set("cityId", cityId);
      p.set("days", days);
      const res = await fetch(`/api/admin/tv/analytics?${p}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
  });

  if (isLoading) return <div className="text-sm text-muted-foreground p-4">Loading analytics...</div>;

  const data = analytics || {
    totalQrScans: 0, totalImpressions: 0, engagementRate: 0, activeScreenCount: 0, totalScreenCount: 0,
    dailyTimeSeries: [], scansByTemplate: [], impressionsByTemplate: [], hourlyDistribution: [],
    topContentByScans: [], topContentByImpressions: [], byScreen: [], recentPlays: [],
  };

  const chartData = data.dailyTimeSeries.map(d => ({
    ...d,
    date: d.date.slice(5),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold" data-testid="text-analytics-title">TV Analytics Dashboard</h3>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-[140px]" data-testid="select-analytics-days"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Play className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-xs text-muted-foreground">Total Impressions</p>
              <p className="text-2xl font-bold" data-testid="text-total-impressions">{data.totalImpressions.toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <QrCode className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-xs text-muted-foreground">QR Scans</p>
              <p className="text-2xl font-bold" data-testid="text-total-qr-scans">{data.totalQrScans.toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-xs text-muted-foreground">Engagement Rate</p>
              <p className="text-2xl font-bold" data-testid="text-engagement-rate">{data.engagementRate}%</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-emerald-500" />
            <div>
              <p className="text-xs text-muted-foreground">Active Screens</p>
              <p className="text-2xl font-bold" data-testid="text-active-screens">
                {data.activeScreenCount}<span className="text-sm text-muted-foreground font-normal">/{data.totalScreenCount}</span>
              </p>
            </div>
          </div>
        </Card>
      </div>

      {chartData.length > 0 && (
        <Card className="p-4">
          <h4 className="font-medium text-sm mb-4">Impressions & Scans Over Time</h4>
          <div className="h-64" data-testid="chart-time-series">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="impressions" stroke="#3b82f6" strokeWidth={2} dot={false} name="Impressions" />
                <Line type="monotone" dataKey="scans" stroke="#22c55e" strokeWidth={2} dot={false} name="QR Scans" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {data.hourlyDistribution.some(h => h.impressions > 0 || h.scans > 0) && (
        <Card className="p-4">
          <h4 className="font-medium text-sm mb-4">Engagement by Hour of Day</h4>
          <div className="h-48" data-testid="chart-hourly">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.hourlyDistribution}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickFormatter={(h) => `${h}:00`} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} labelFormatter={(h) => `${h}:00`} />
                <Bar dataKey="impressions" fill="#3b82f6" radius={[2, 2, 0, 0]} name="Impressions" />
                <Bar dataKey="scans" fill="#22c55e" radius={[2, 2, 0, 0]} name="Scans" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h4 className="font-medium text-sm mb-3">Screen Performance</h4>
          {data.byScreen.length === 0 ? (
            <p className="text-sm text-muted-foreground">No screens registered</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {data.byScreen.map((s) => (
                <div key={s.screenId} className="flex items-center justify-between gap-2 text-sm border-b pb-2 last:border-b-0" data-testid={`screen-stats-${s.screenId}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    {s.status === "online" ? <Wifi className="h-3 w-3 text-emerald-500 flex-shrink-0" /> : s.status === "warning" ? <Wifi className="h-3 w-3 text-amber-500 flex-shrink-0" /> : <WifiOff className="h-3 w-3 text-red-500 flex-shrink-0" />}
                    <div className="min-w-0">
                      <span className="font-medium truncate block">{s.venueName}</span>
                      {s.hubSlug && <span className="text-xs text-muted-foreground">{s.hubSlug}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
                    <span>{s.impressions} imp</span>
                    <span>{s.scans} scans</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <h4 className="font-medium text-sm mb-3">Top Content by Scans</h4>
          {data.topContentByScans.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scan data</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {data.topContentByScans.map((c, idx) => (
                <div key={c.itemId} className="flex items-center justify-between gap-2 text-sm" data-testid={`top-content-${idx}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline" className="text-[10px] flex-shrink-0">{c.templateKey}</Badge>
                    <span className="text-muted-foreground truncate text-xs font-mono">{c.itemId.length > 30 ? c.itemId.slice(0, 30) + "…" : c.itemId}</span>
                  </div>
                  <span className="font-medium flex-shrink-0">{c.count}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h4 className="font-medium text-sm mb-3">Scans by Template</h4>
          {data.scansByTemplate.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scan data</p>
          ) : (
            <div className="space-y-2">
              {data.scansByTemplate.sort((a, b) => b.count - a.count).map((s) => (
                <div key={s.templateKey} className="flex items-center justify-between gap-2 text-sm" data-testid={`scan-template-${s.templateKey}`}>
                  <span className="text-muted-foreground">{s.templateKey}</span>
                  <span className="font-medium">{s.count}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card className="p-4">
          <h4 className="font-medium text-sm mb-3">Impressions by Template</h4>
          {data.impressionsByTemplate.length === 0 ? (
            <p className="text-sm text-muted-foreground">No impression data</p>
          ) : (
            <div className="space-y-2">
              {data.impressionsByTemplate.sort((a, b) => b.count - a.count).map((s) => (
                <div key={s.templateKey} className="flex items-center justify-between gap-2 text-sm" data-testid={`impression-template-${s.templateKey}`}>
                  <span className="text-muted-foreground">{s.templateKey}</span>
                  <span className="font-medium">{s.count}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <h4 className="font-medium text-sm mb-3">Recent Plays (Last 50)</h4>
        <div className="border rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Item ID</th>
                <th className="text-left p-3 font-medium">Template</th>
                <th className="text-left p-3 font-medium">Played At</th>
                <th className="text-right p-3 font-medium">Duration (s)</th>
                <th className="text-left p-3 font-medium">Hub</th>
              </tr>
            </thead>
            <tbody>
              {data.recentPlays.map((play, idx) => (
                <tr key={play.id || idx} className="border-b last:border-b-0" data-testid={`row-play-${play.id || idx}`}>
                  <td className="p-3 font-mono text-xs max-w-[140px] truncate">{play.itemId}</td>
                  <td className="p-3 text-muted-foreground">{play.templateKey || "-"}</td>
                  <td className="p-3 text-muted-foreground text-xs">
                    {play.playedAt ? new Date(play.playedAt).toLocaleString() : "-"}
                  </td>
                  <td className="p-3 text-right text-muted-foreground">{play.durationSec ?? "-"}</td>
                  <td className="p-3 text-muted-foreground">{play.hubSlug || "-"}</td>
                </tr>
              ))}
              {data.recentPlays.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No play data yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

const DAYS_OF_WEEK = [
  { value: "monday", label: "Mon" },
  { value: "tuesday", label: "Tue" },
  { value: "wednesday", label: "Wed" },
  { value: "thursday", label: "Thu" },
  { value: "friday", label: "Fri" },
  { value: "saturday", label: "Sat" },
  { value: "sunday", label: "Sun" },
];

const WEIGHTING_STRATEGY_OPTIONS = [
  { value: "sequential", label: "Sequential" },
  { value: "weighted_random", label: "Weighted Random" },
  { value: "alternating", label: "Alternating" },
];

const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => {
  const h = i % 12 || 12;
  const ampm = i < 12 ? "AM" : "PM";
  return `${h}${ampm}`;
});

const LOOP_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-purple-500",
  "bg-pink-500", "bg-cyan-500", "bg-orange-500", "bg-indigo-500",
];

function ScheduleTimeline({ schedule, loops }: { schedule: TvSchedule; loops: TvLoop[] }) {
  const startHour = parseInt(schedule.startTime?.split(":")[0] || "6");
  const endHour = parseInt(schedule.endTime?.split(":")[0] || "23") + 1;
  const totalHours = Math.max(endHour - startHour, 1);

  const loopMap = useMemo(() => {
    const m = new Map<string, TvLoop>();
    (loops || []).forEach(l => m.set(l.id, l));
    return m;
  }, [loops]);

  const segments = useMemo(() => {
    const ids = schedule.loopIds || [];
    if (ids.length === 0) return [];
    const result: { loopId: string; name: string; startMin: number; endMin: number; colorIdx: number }[] = [];
    let cursor = startHour * 60;
    const endMin = endHour * 60;
    let idx = 0;
    while (cursor < endMin && ids.length > 0) {
      const loopId = ids[idx % ids.length];
      const loop = loopMap.get(loopId);
      const dur = (loop?.durationTargetMinutes || 60);
      const segEnd = Math.min(cursor + dur, endMin);
      result.push({
        loopId,
        name: loop?.name || loopId.slice(0, 8),
        startMin: cursor,
        endMin: segEnd,
        colorIdx: idx % LOOP_COLORS.length,
      });
      cursor = segEnd;
      idx++;
    }
    return result;
  }, [schedule, loopMap, startHour, endHour]);

  return (
    <div className="space-y-2" data-testid="schedule-timeline">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        {Array.from({ length: totalHours }, (_, i) => (
          <div key={i} className="flex-1 text-center">{HOUR_LABELS[startHour + i]}</div>
        ))}
      </div>
      <div className="flex rounded-md overflow-hidden border" style={{ height: 32 }}>
        {segments.map((seg, i) => {
          const totalMin = totalHours * 60;
          const width = ((seg.endMin - seg.startMin) / totalMin) * 100;
          return (
            <div
              key={i}
              className={`${LOOP_COLORS[seg.colorIdx]} text-white text-[10px] flex items-center justify-center truncate px-1`}
              style={{ width: `${width}%`, minWidth: 2 }}
              title={`${seg.name} (${Math.round((seg.endMin - seg.startMin))}m)`}
              data-testid={`timeline-segment-${i}`}
            >
              {width > 8 ? seg.name : ""}
            </div>
          );
        })}
        {segments.length === 0 && (
          <div className="flex-1 bg-muted flex items-center justify-center text-xs text-muted-foreground">No loops assigned</div>
        )}
      </div>
    </div>
  );
}

function SchedulesTab({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TvSchedule | null>(null);

  const [scheduleName, setScheduleName] = useState("");
  const [screenId, setScreenId] = useState("");
  const [metroSlug, setMetroSlug] = useState("");
  const [hubSlug, setHubSlug] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState<string[]>([]);
  const [startTime, setStartTime] = useState("06:00");
  const [endTime, setEndTime] = useState("23:59");
  const [loopIds, setLoopIds] = useState<string[]>([]);
  const [weightingStrategy, setWeightingStrategy] = useState("weighted_random");
  const [fallbackLoopId, setFallbackLoopId] = useState("");
  const [noConsecutiveRepeat, setNoConsecutiveRepeat] = useState(true);
  const [scheduleEnabled, setScheduleEnabled] = useState(true);

  const tvQueryFn = (endpoint: string) => async () => {
    const p = new URLSearchParams();
    if (cityId) p.set("cityId", cityId);
    const res = await fetch(`${endpoint}?${p}`, { credentials: "include" });
    if (!res.ok) return [];
    return res.json();
  };

  const { data: schedules, isLoading } = useQuery<TvSchedule[]>({
    queryKey: ["/api/admin/tv/schedules", cityId],
    queryFn: tvQueryFn("/api/admin/tv/schedules"),
  });

  const { data: screens } = useQuery<TvScreen[]>({
    queryKey: ["/api/admin/tv/screens", cityId],
    queryFn: tvQueryFn("/api/admin/tv/screens"),
  });

  const { data: loops } = useQuery<TvLoop[]>({
    queryKey: ["/api/admin/tv/loops", cityId],
    queryFn: tvQueryFn("/api/admin/tv/loops"),
  });

  const resetForm = (s?: TvSchedule | null) => {
    setScheduleName(s?.name || "");
    setScreenId(s?.screenId || "");
    setMetroSlug(s?.metroSlug || "");
    setHubSlug(s?.hubSlug || "");
    setDayOfWeek(s?.dayOfWeek || []);
    setStartTime(s?.startTime || "06:00");
    setEndTime(s?.endTime || "23:59");
    setLoopIds(s?.loopIds || []);
    setWeightingStrategy(s?.weightingStrategy || "weighted_random");
    setFallbackLoopId(s?.fallbackLoopId || "");
    setNoConsecutiveRepeat(s?.noConsecutiveRepeat ?? true);
    setScheduleEnabled(s?.enabled ?? true);
  };

  const openCreate = () => { setEditing(null); resetForm(); setDialogOpen(true); };
  const openEdit = (s: TvSchedule) => { setEditing(s); resetForm(s); setDialogOpen(true); };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        name: scheduleName,
        screenId: screenId && screenId !== "none" ? screenId : null,
        metroSlug: metroSlug || null,
        hubSlug: hubSlug || null,
        dayOfWeek,
        startTime,
        endTime,
        loopIds,
        weightingStrategy,
        fallbackLoopId: fallbackLoopId && fallbackLoopId !== "none" ? fallbackLoopId : null,
        noConsecutiveRepeat,
        enabled: scheduleEnabled,
      };
      if (editing) {
        return apiRequest("PATCH", `/api/admin/tv/schedules/${editing.id}`, body);
      }
      return apiRequest("POST", "/api/admin/tv/schedules", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tv/schedules"] });
      toast({ title: editing ? "Schedule updated" : "Schedule created" });
      setDialogOpen(false);
    },
    onError: () => toast({ title: "Error saving schedule", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/tv/schedules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tv/schedules"] });
      toast({ title: "Schedule deleted" });
    },
    onError: () => toast({ title: "Error deleting schedule", variant: "destructive" }),
  });

  const assignToScreenMutation = useMutation({
    mutationFn: async ({ scheduleId, targetScreenId }: { scheduleId: string; targetScreenId: string }) => {
      return apiRequest("PATCH", `/api/admin/tv/screens/${targetScreenId}`, {
        activeScheduleId: scheduleId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tv/screens"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tv/schedules"] });
      toast({ title: "Schedule assigned to screen" });
    },
    onError: () => toast({ title: "Error assigning schedule", variant: "destructive" }),
  });

  const getScreenName = (sid: string | null) => {
    if (!sid || !screens) return "-";
    const s = screens.find(s => s.id === sid);
    return s?.name || sid.slice(0, 12);
  };

  const getLoopName = (lid: string) => {
    if (!loops) return lid.slice(0, 12);
    const l = loops.find(l => l.id === lid);
    return l?.name || lid.slice(0, 12);
  };

  const toggleLoopId = (lid: string) => {
    setLoopIds(prev =>
      prev.includes(lid) ? prev.filter(id => id !== lid) : [...prev, lid]
    );
  };

  const previewSchedule = useMemo<TvSchedule>(() => ({
    id: "",
    name: scheduleName,
    screenId: screenId || null,
    metroSlug: metroSlug || null,
    hubSlug: hubSlug || null,
    dayOfWeek,
    startTime,
    endTime,
    loopIds,
    weightingStrategy: weightingStrategy as any,
    fallbackLoopId: fallbackLoopId || null,
    noConsecutiveRepeat,
    enabled: scheduleEnabled,
    createdAt: new Date(),
    updatedAt: new Date(),
  }), [scheduleName, screenId, metroSlug, hubSlug, dayOfWeek, startTime, endTime, loopIds, weightingStrategy, fallbackLoopId, noConsecutiveRepeat, scheduleEnabled]);

  if (isLoading) return <div className="text-sm text-muted-foreground p-4">Loading schedules...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold" data-testid="text-schedules-title">TV Schedules</h3>
        <Button onClick={openCreate} data-testid="button-create-schedule">
          <Plus className="h-4 w-4 mr-1" /> New Schedule
        </Button>
      </div>

      <div className="space-y-4">
        {(schedules || []).map((s) => (
          <Card key={s.id} className="p-4 space-y-3" data-testid={`card-schedule-${s.id}`}>
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium" data-testid={`text-schedule-name-${s.id}`}>{s.name}</span>
                  <Badge variant={s.enabled ? "default" : "secondary"} data-testid={`badge-schedule-enabled-${s.id}`}>
                    {s.enabled ? "Active" : "Inactive"}
                  </Badge>
                  <Badge variant="outline">{s.weightingStrategy}</Badge>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                  {s.screenId && <span>Screen: {getScreenName(s.screenId)}</span>}
                  {s.hubSlug && <span>Hub: {s.hubSlug}</span>}
                  <span>{s.startTime} - {s.endTime}</span>
                  <span>{(s.dayOfWeek || []).map(d => d.slice(0, 3)).join(", ") || "All days"}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {(s.loopIds || []).map((lid, idx) => (
                    <Badge key={lid} variant="outline" className="text-[10px]" data-testid={`badge-loop-${s.id}-${idx}`}>
                      <Repeat className="h-2.5 w-2.5 mr-0.5" />{getLoopName(lid)}
                    </Badge>
                  ))}
                  {(s.loopIds || []).length === 0 && <span className="text-xs text-muted-foreground">No loops</span>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Select
                  value=""
                  onValueChange={(targetId) => {
                    if (targetId) assignToScreenMutation.mutate({ scheduleId: s.id, targetScreenId: targetId });
                  }}
                >
                  <SelectTrigger className="w-[140px]" data-testid={`select-assign-screen-${s.id}`}>
                    <SelectValue placeholder="Assign to screen" />
                  </SelectTrigger>
                  <SelectContent>
                    {(screens || []).map((scr) => (
                      <SelectItem key={scr.id} value={scr.id}>{scr.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="icon" variant="ghost" onClick={() => openEdit(s)} data-testid={`button-edit-schedule-${s.id}`}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(s.id)} data-testid={`button-delete-schedule-${s.id}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <ScheduleTimeline schedule={s} loops={loops || []} />
          </Card>
        ))}
        {(schedules || []).length === 0 && (
          <Card className="p-6">
            <p className="text-center text-muted-foreground" data-testid="text-no-schedules">No schedules configured</p>
          </Card>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Schedule" : "Create Schedule"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={scheduleName} onChange={(e) => setScheduleName(e.target.value)} placeholder="Weekday Daytime" data-testid="input-schedule-name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Target Screen</Label>
                <Select value={screenId || "none"} onValueChange={(v) => setScreenId(v === "none" ? "" : v)}>
                  <SelectTrigger data-testid="select-schedule-screen"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No specific screen</SelectItem>
                    {(screens || []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Hub Slug</Label>
                <Input value={hubSlug} onChange={(e) => setHubSlug(e.target.value)} placeholder="south-end" data-testid="input-schedule-hub-slug" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Metro Slug</Label>
              <Input value={metroSlug} onChange={(e) => setMetroSlug(e.target.value)} placeholder="charlotte" data-testid="input-schedule-metro-slug" />
            </div>
            <div className="space-y-2">
              <Label>Days of Week</Label>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((d) => (
                  <label key={d.value} className="flex items-center gap-1.5 text-sm">
                    <Checkbox
                      checked={dayOfWeek.includes(d.value)}
                      onCheckedChange={(checked) => {
                        setDayOfWeek(prev =>
                          checked ? [...prev, d.value] : prev.filter(v => v !== d.value)
                        );
                      }}
                      data-testid={`checkbox-day-${d.value}`}
                    />
                    {d.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} data-testid="input-schedule-start-time" />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} data-testid="input-schedule-end-time" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Loops</Label>
              <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
                {(loops || []).filter(l => l.enabled).map((l) => (
                  <label key={l.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={loopIds.includes(l.id)}
                      onCheckedChange={() => toggleLoopId(l.id)}
                      data-testid={`checkbox-schedule-loop-${l.id}`}
                    />
                    <span>{l.name}</span>
                    <Badge variant="outline" className="text-[10px] ml-auto">
                      <Clock className="h-2.5 w-2.5 mr-0.5" />{l.durationTargetMinutes}m
                    </Badge>
                  </label>
                ))}
                {(loops || []).filter(l => l.enabled).length === 0 && (
                  <p className="text-xs text-muted-foreground">No enabled loops available</p>
                )}
              </div>
              {loopIds.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap mt-1">
                  <span className="text-xs text-muted-foreground">Order:</span>
                  {loopIds.map((lid, idx) => (
                    <Badge key={lid} variant="secondary" className="text-[10px]">
                      {idx + 1}. {getLoopName(lid)}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Weighting Strategy</Label>
                <Select value={weightingStrategy} onValueChange={setWeightingStrategy}>
                  <SelectTrigger data-testid="select-schedule-weighting"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WEIGHTING_STRATEGY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fallback Loop</Label>
                <Select value={fallbackLoopId || "none"} onValueChange={(v) => setFallbackLoopId(v === "none" ? "" : v)}>
                  <SelectTrigger data-testid="select-schedule-fallback"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {(loops || []).filter(l => l.enabled).map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <Switch checked={noConsecutiveRepeat} onCheckedChange={setNoConsecutiveRepeat} data-testid="switch-no-consecutive-repeat" />
                <Label>No Consecutive Repeat</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={scheduleEnabled} onCheckedChange={setScheduleEnabled} data-testid="switch-schedule-enabled" />
                <Label>Enabled</Label>
              </div>
            </div>

            {loopIds.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs">Timeline Preview</Label>
                <ScheduleTimeline schedule={previewSchedule} loops={loops || []} />
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={() => saveMutation.mutate()} disabled={!scheduleName || saveMutation.isPending} data-testid="button-save-schedule">
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                {editing ? "Update" : "Create"}
              </Button>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const HOST_PHRASE_CATEGORIES = ["intro", "event", "business", "nonprofit", "neighborhood"];
const HOST_PHRASE_THEMES = ["warm", "upbeat", "calm", "professional", "community"];

function HostPhrasesTab({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TvHostPhrase | null>(null);

  const [phraseText, setPhraseText] = useState("");
  const [phraseTextEs, setPhraseTextEs] = useState("");
  const [category, setCategory] = useState("intro");
  const [theme, setTheme] = useState("");
  const [phraseEnabled, setPhraseEnabled] = useState(true);

  const { data: phrases, isLoading } = useQuery<TvHostPhrase[]>({
    queryKey: ["/api/admin/tv/host-phrases", cityId],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (cityId) p.set("cityId", cityId);
      const res = await fetch(`/api/admin/tv/host-phrases?${p}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const [categoryFilter, setCategoryFilter] = useState("ALL");

  const filteredPhrases = useMemo(() => {
    if (!phrases) return [];
    if (categoryFilter === "ALL") return phrases;
    return phrases.filter(p => p.category === categoryFilter);
  }, [phrases, categoryFilter]);

  const resetForm = (p?: TvHostPhrase | null) => {
    setPhraseText(p?.phraseText || "");
    setPhraseTextEs(p?.phraseTextEs || "");
    setCategory(p?.category || "intro");
    setTheme(p?.theme || "");
    setPhraseEnabled(p?.enabled ?? true);
  };

  const openCreate = () => { setEditing(null); resetForm(); setDialogOpen(true); };
  const openEdit = (p: TvHostPhrase) => { setEditing(p); resetForm(p); setDialogOpen(true); };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        phraseText,
        phraseTextEs: phraseTextEs || null,
        category,
        theme: theme || null,
        enabled: phraseEnabled,
      };
      if (editing) {
        return apiRequest("PATCH", `/api/admin/tv/host-phrases/${editing.id}`, body);
      }
      return apiRequest("POST", "/api/admin/tv/host-phrases", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tv/host-phrases"] });
      toast({ title: editing ? "Phrase updated" : "Phrase created" });
      setDialogOpen(false);
    },
    onError: () => toast({ title: "Error saving phrase", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/tv/host-phrases/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tv/host-phrases"] });
      toast({ title: "Phrase deleted" });
    },
    onError: () => toast({ title: "Error deleting phrase", variant: "destructive" }),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground p-4">Loading host phrases...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold" data-testid="text-host-phrases-title">Host Phrases</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[140px]" data-testid="select-phrase-category-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Categories</SelectItem>
              {HOST_PHRASE_CATEGORIES.map(c => (
                <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={openCreate} data-testid="button-create-phrase">
            <Plus className="h-4 w-4 mr-1" /> New Phrase
          </Button>
        </div>
      </div>

      <div className="border rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Phrase (EN)</th>
              <th className="text-left p-3 font-medium">Phrase (ES)</th>
              <th className="text-center p-3 font-medium">Category</th>
              <th className="text-center p-3 font-medium">Theme</th>
              <th className="text-center p-3 font-medium">Enabled</th>
              <th className="text-center p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPhrases.map((p) => (
              <tr key={p.id} className="border-b last:border-b-0" data-testid={`row-phrase-${p.id}`}>
                <td className="p-3 max-w-[300px] truncate">{p.phraseText}</td>
                <td className="p-3 text-muted-foreground max-w-[300px] truncate">{p.phraseTextEs || "-"}</td>
                <td className="p-3 text-center">
                  <Badge variant="outline">{p.category}</Badge>
                </td>
                <td className="p-3 text-center text-muted-foreground">{p.theme || "-"}</td>
                <td className="p-3 text-center">
                  <Badge variant={p.enabled ? "default" : "secondary"}>{p.enabled ? "Yes" : "No"}</Badge>
                </td>
                <td className="p-3">
                  <div className="flex items-center justify-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(p)} data-testid={`button-edit-phrase-${p.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(p.id)} data-testid={`button-delete-phrase-${p.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredPhrases.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No host phrases</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Host Phrase" : "Create Host Phrase"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Phrase Text (English)</Label>
              <Textarea
                value={phraseText}
                onChange={(e) => setPhraseText(e.target.value)}
                className="resize-none"
                rows={3}
                data-testid="input-phrase-text"
              />
            </div>
            <div className="space-y-2">
              <Label>Phrase Text (Spanish)</Label>
              <Textarea
                value={phraseTextEs}
                onChange={(e) => setPhraseTextEs(e.target.value)}
                className="resize-none"
                rows={3}
                data-testid="input-phrase-text-es"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger data-testid="select-phrase-category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {HOST_PHRASE_CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Theme</Label>
                <Select value={theme || "none"} onValueChange={(v) => setTheme(v === "none" ? "" : v)}>
                  <SelectTrigger data-testid="select-phrase-theme"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {HOST_PHRASE_THEMES.map(t => (
                      <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={phraseEnabled} onCheckedChange={setPhraseEnabled} data-testid="switch-phrase-enabled" />
              <Label>Enabled</Label>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={() => saveMutation.mutate()} disabled={!phraseText || saveMutation.isPending} data-testid="button-save-phrase">
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                {editing ? "Update" : "Create"}
              </Button>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MiniSlidePlayer({
  items,
  languageMode = "en",
}: {
  items: { templateKey?: string; data?: Record<string, any>; qrUrl?: string; assetUrl?: string; audioUrl?: string | null; captionUrl?: string | null; subtitleText?: string | null; narrationEnabled?: boolean; durationSec?: number; title?: string; loopName?: string }[];
  languageMode?: "en" | "es" | "bilingual";
}) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [audioMuted, setAudioMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const item = items[currentIdx] || null;
  const total = items.length;

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }, []);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
  }, []);

  const playCurrentSlide = useCallback(() => {
    if (!item) return;
    stopAudio();

    if (item.audioUrl && item.narrationEnabled && !audioMuted) {
      try {
        const audio = new Audio(item.audioUrl);
        audio.volume = 0.8;
        audio.play().catch(() => {});
        audioRef.current = audio;
      } catch {}
    }

    const dur = (item.durationSec || 9) * 1000;
    timerRef.current = setTimeout(() => {
      setCurrentIdx(prev => {
        const next = prev + 1;
        if (next >= total) {
          setPlaying(false);
          return 0;
        }
        return next;
      });
    }, dur);
  }, [item, audioMuted, total, stopAudio]);

  useEffect(() => {
    if (playing && item) {
      playCurrentSlide();
    }
    return () => { stopTimer(); };
  }, [playing, currentIdx, playCurrentSlide, stopTimer]);

  useEffect(() => {
    return () => { stopAudio(); stopTimer(); };
  }, [stopAudio, stopTimer]);

  const handlePlayPause = () => {
    if (playing) {
      setPlaying(false);
      stopTimer();
      stopAudio();
    } else {
      setPlaying(true);
    }
  };

  const handleSkipBack = () => {
    stopTimer();
    stopAudio();
    setCurrentIdx(prev => Math.max(0, prev - 1));
    if (playing) setPlaying(true);
  };

  const handleSkipForward = () => {
    stopTimer();
    stopAudio();
    setCurrentIdx(prev => {
      const next = prev + 1;
      if (next >= total) { setPlaying(false); return 0; }
      return next;
    });
    if (playing) setPlaying(true);
  };

  if (total === 0) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground text-center">No items to preview</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div
        className="relative border rounded-md bg-black overflow-hidden mx-auto"
        style={{ width: 640, height: 360 }}
        data-testid="preview-mini-player"
      >
        {item?.templateKey ? (
          <div
            style={{
              width: 1920,
              height: 1080,
              transform: "scale(0.3333)",
              transformOrigin: "top left",
            }}
          >
            <SlideRenderer
              templateKey={item.templateKey}
              data={item.data || {}}
              qrUrl={item.qrUrl}
              assetUrl={item.assetUrl}
              languageMode={languageMode}
            />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/40 text-sm">
            {item?.title || "No template"}
          </div>
        )}

        {captionsOn && item?.subtitleText && (
          <div
            className="absolute left-0 right-0 flex justify-center z-30 pointer-events-none"
            style={{ bottom: "3%" }}
          >
            <div
              className="px-4 py-2 rounded-md max-w-[80%] text-center"
              style={{ backgroundColor: "rgba(0, 0, 0, 0.75)" }}
            >
              <span className="text-white font-medium text-sm">{item.subtitleText}</span>
            </div>
          </div>
        )}

        {item?.loopName && (
          <div className="absolute top-2 left-2 z-20">
            <Badge variant="outline" className="bg-black/60 text-white/80 border-white/20 text-[10px] no-default-hover-elevate no-default-active-elevate">
              {item.loopName}
            </Badge>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-2">
        <Button size="icon" variant="ghost" onClick={handleSkipBack} disabled={currentIdx === 0} data-testid="button-preview-skip-back">
          <SkipBack className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="default" onClick={handlePlayPause} data-testid="button-preview-play-pause">
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button size="icon" variant="ghost" onClick={handleSkipForward} disabled={currentIdx >= total - 1} data-testid="button-preview-skip-forward">
          <SkipForward className="h-4 w-4" />
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setCaptionsOn(!captionsOn)}
          className={`toggle-elevate ${captionsOn ? "toggle-elevated" : ""}`}
          data-testid="button-preview-captions"
        >
          <Subtitles className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setAudioMuted(!audioMuted)}
          className={`toggle-elevate ${audioMuted ? "toggle-elevated" : ""}`}
          data-testid="button-preview-mute"
        >
          {audioMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        <span className="text-xs text-muted-foreground" data-testid="text-preview-position">
          {currentIdx + 1} / {total}
        </span>
      </div>

      {item && (
        <div className="text-center text-xs text-muted-foreground" data-testid="text-preview-item-title">
          {item.title || item.templateKey || "Untitled"}{item.durationSec ? ` (${item.durationSec}s)` : ""}
        </div>
      )}
    </div>
  );
}

function PreviewTab({ cityId }: { cityId?: string }) {
  const [previewMode, setPreviewMode] = useState<"item" | "loop" | "daily" | "venue">("item");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [selectedLoopId, setSelectedLoopId] = useState("");
  const [selectedScreenId, setSelectedScreenId] = useState("");

  const tvQueryFn = (endpoint: string) => async () => {
    const p = new URLSearchParams();
    if (cityId) p.set("cityId", cityId);
    const res = await fetch(`${endpoint}?${p}`, { credentials: "include" });
    if (!res.ok) return [];
    return res.json();
  };

  const { data: allItems } = useQuery<TvItem[]>({
    queryKey: ["/api/admin/tv/items", cityId],
    queryFn: tvQueryFn("/api/admin/tv/items"),
  });

  const { data: loops } = useQuery<TvLoop[]>({
    queryKey: ["/api/admin/tv/loops", cityId],
    queryFn: tvQueryFn("/api/admin/tv/loops"),
  });

  const { data: screens } = useQuery<TvScreen[]>({
    queryKey: ["/api/admin/tv/screens", cityId],
    queryFn: tvQueryFn("/api/admin/tv/screens"),
  });

  const { data: schedules } = useQuery<TvSchedule[]>({
    queryKey: ["/api/admin/tv/schedules", cityId],
    queryFn: tvQueryFn("/api/admin/tv/schedules"),
  });

  const { data: loopItemsRaw } = useQuery<TvLoopItem[]>({
    queryKey: ["/api/admin/tv/loops", selectedLoopId, "items"],
    enabled: !!selectedLoopId && (previewMode === "loop"),
  });

  const { data: venuePlaylist } = useQuery<any>({
    queryKey: ["/api/tv/playlist", selectedScreenId],
    queryFn: async () => {
      if (!selectedScreenId) return null;
      const screen = (screens || []).find(s => s.id === selectedScreenId);
      if (!screen) return null;
      const params = new URLSearchParams();
      if (screen.screenKey) params.set("screenKey", screen.screenKey);
      const res = await fetch(`/api/tv/playlist/charlotte${screen.hubSlug ? `/${screen.hubSlug}` : ""}?${params.toString()}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!selectedScreenId && previewMode === "venue",
  });

  const selectedItem = useMemo(() => {
    if (!selectedItemId || !allItems) return null;
    return allItems.find(i => i.id === selectedItemId) || null;
  }, [selectedItemId, allItems]);

  const singleItemPreviewList = useMemo(() => {
    if (!selectedItem) return [];
    const data = typeof selectedItem.data === "string" ? JSON.parse(selectedItem.data || "{}") : (selectedItem.data || {});
    return [{
      templateKey: selectedItem.templateKey || undefined,
      data,
      qrUrl: selectedItem.qrUrl || undefined,
      assetUrl: selectedItem.assetUrl || undefined,
      audioUrl: selectedItem.audioUrl,
      captionUrl: selectedItem.captionUrl,
      subtitleText: selectedItem.subtitleText,
      narrationEnabled: selectedItem.narrationEnabled || false,
      durationSec: selectedItem.durationSec || 9,
      title: selectedItem.title,
    }];
  }, [selectedItem]);

  const loopPreviewList = useMemo(() => {
    if (!loopItemsRaw || !allItems) return [];
    const itemMap = new Map<string, TvItem>();
    allItems.forEach(i => itemMap.set(i.id, i));
    const sorted = [...loopItemsRaw].sort((a, b) => (a.position || 0) - (b.position || 0));
    const selectedLoop = (loops || []).find(l => l.id === selectedLoopId);
    return sorted.map(li => {
      if (!li.tvItemId) return null;
      const tvItem = itemMap.get(li.tvItemId);
      if (!tvItem) return null;
      const data = typeof tvItem.data === "string" ? JSON.parse(tvItem.data || "{}") : (tvItem.data || {});
      return {
        templateKey: tvItem.templateKey || undefined,
        data,
        qrUrl: tvItem.qrUrl || undefined,
        assetUrl: tvItem.assetUrl || undefined,
        audioUrl: tvItem.audioUrl,
        captionUrl: tvItem.captionUrl,
        subtitleText: tvItem.subtitleText,
        narrationEnabled: tvItem.narrationEnabled || false,
        durationSec: tvItem.durationSec || 9,
        title: tvItem.title,
        loopName: selectedLoop?.name || undefined,
      };
    }).filter(Boolean) as any[];
  }, [loopItemsRaw, allItems, loops, selectedLoopId]);

  const venuePreviewList = useMemo(() => {
    if (!venuePlaylist?.items) return [];
    return venuePlaylist.items.map((pi: any) => ({
      templateKey: pi.templateKey || undefined,
      data: pi.data || {},
      qrUrl: pi.qrUrl || undefined,
      assetUrl: pi.assetUrl || undefined,
      audioUrl: pi.audioUrl,
      captionUrl: pi.captionUrl,
      subtitleText: pi.subtitleText,
      narrationEnabled: pi.narrationEnabled || false,
      durationSec: pi.durationSec || 9,
      title: pi.title,
      loopName: pi.loopName || undefined,
    }));
  }, [venuePlaylist]);

  const selectedScreen = useMemo(() => {
    if (!selectedScreenId || !screens) return null;
    return screens.find(s => s.id === selectedScreenId) || null;
  }, [selectedScreenId, screens]);

  const dailyProgramming = useMemo(() => {
    if (!selectedScreen || !schedules || !loops) return [];
    const relevantSchedules = schedules.filter(s => {
      if (!s.enabled) return false;
      if (s.screenId === selectedScreen.id) return true;
      if (s.hubSlug && s.hubSlug === selectedScreen.hubSlug) return true;
      if (!s.screenId && !s.hubSlug) return true;
      return false;
    });

    const loopMap = new Map<string, TvLoop>();
    loops.forEach(l => loopMap.set(l.id, l));

    const hourBlocks: { hour: number; label: string; scheduleName: string; loopName: string; loopId: string }[] = [];

    for (let h = 0; h < 24; h++) {
      const timeStr = `${String(h).padStart(2, "0")}:00`;
      const hLabel = h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`;

      let matchedSchedule: TvSchedule | null = null;
      for (const sched of relevantSchedules) {
        const start = sched.startTime || "00:00";
        const end = sched.endTime || "23:59";
        if (timeStr >= start && timeStr <= end) {
          matchedSchedule = sched;
          break;
        }
      }

      if (matchedSchedule && matchedSchedule.loopIds && matchedSchedule.loopIds.length > 0) {
        const startHour = parseInt(matchedSchedule.startTime?.split(":")[0] || "0");
        const elapsedMin = (h - startHour) * 60;
        let cursor = 0;
        let loopIdx = 0;
        const ids = matchedSchedule.loopIds;
        while (cursor < elapsedMin && ids.length > 0) {
          const loop = loopMap.get(ids[loopIdx % ids.length]);
          cursor += loop?.durationTargetMinutes || 60;
          loopIdx++;
        }
        const activeLoopId = ids[(loopIdx) % ids.length];
        const activeLoop = loopMap.get(activeLoopId);
        hourBlocks.push({
          hour: h,
          label: hLabel,
          scheduleName: matchedSchedule.name,
          loopName: activeLoop?.name || "Unknown",
          loopId: activeLoopId,
        });
      } else {
        hourBlocks.push({
          hour: h,
          label: hLabel,
          scheduleName: "-",
          loopName: "-",
          loopId: "",
        });
      }
    }
    return hourBlocks;
  }, [selectedScreen, schedules, loops]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold" data-testid="text-preview-title">Preview Studio</h3>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { value: "item", label: "Single Item", icon: Eye },
            { value: "loop", label: "Full Loop", icon: Repeat },
            { value: "daily", label: "Daily Programming", icon: Clock },
            { value: "venue", label: "Venue Preview", icon: Tv },
          ] as const
        ).map((mode) => (
          <Button
            key={mode.value}
            variant={previewMode === mode.value ? "default" : "outline"}
            onClick={() => setPreviewMode(mode.value)}
            data-testid={`button-preview-mode-${mode.value}`}
          >
            <mode.icon className="h-4 w-4 mr-1" />
            {mode.label}
          </Button>
        ))}
      </div>

      {previewMode === "item" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Select Content Item</Label>
            <Select value={selectedItemId} onValueChange={setSelectedItemId}>
              <SelectTrigger data-testid="select-preview-item"><SelectValue placeholder="Choose an item to preview..." /></SelectTrigger>
              <SelectContent>
                {(allItems || []).map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.title} ({item.templateKey || item.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedItem && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 items-center">
                {selectedItem.narrationEnabled && (
                  <Badge variant="outline"><Volume2 className="h-3 w-3 mr-1" /> Narration</Badge>
                )}
                {selectedItem.audioUrl && (
                  <Badge variant="outline"><Volume2 className="h-3 w-3 mr-1" /> Audio</Badge>
                )}
                {selectedItem.subtitleText && (
                  <Badge variant="outline"><Subtitles className="h-3 w-3 mr-1" /> Captions</Badge>
                )}
                <Badge variant="secondary">{selectedItem.durationSec || 9}s</Badge>
              </div>
              <MiniSlidePlayer items={singleItemPreviewList} />
            </div>
          )}

          {!selectedItemId && (
            <Card className="p-8">
              <p className="text-sm text-muted-foreground text-center">Select a content item above to preview it with narration and captions</p>
            </Card>
          )}
        </div>
      )}

      {previewMode === "loop" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Select Loop</Label>
            <Select value={selectedLoopId} onValueChange={setSelectedLoopId}>
              <SelectTrigger data-testid="select-preview-loop"><SelectValue placeholder="Choose a loop to preview..." /></SelectTrigger>
              <SelectContent>
                {(loops || []).map((loop) => (
                  <SelectItem key={loop.id} value={loop.id}>
                    {loop.name} ({loop.durationTargetMinutes || 60}m)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedLoopId && loopPreviewList.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  <ListChecks className="h-3 w-3 mr-1" /> {loopPreviewList.length} items
                </Badge>
                <Badge variant="secondary">
                  {loopPreviewList.reduce((sum, i) => sum + (i.durationSec || 9), 0)}s total
                </Badge>
              </div>
              <MiniSlidePlayer items={loopPreviewList} />
            </div>
          )}

          {selectedLoopId && loopPreviewList.length === 0 && (
            <Card className="p-8">
              <p className="text-sm text-muted-foreground text-center">This loop has no items assigned yet</p>
            </Card>
          )}

          {!selectedLoopId && (
            <Card className="p-8">
              <p className="text-sm text-muted-foreground text-center">Select a loop above to preview all items sequentially</p>
            </Card>
          )}
        </div>
      )}

      {previewMode === "daily" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Select Screen</Label>
            <Select value={selectedScreenId} onValueChange={setSelectedScreenId}>
              <SelectTrigger data-testid="select-preview-daily-screen"><SelectValue placeholder="Choose a screen..." /></SelectTrigger>
              <SelectContent>
                {(screens || []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}{s.hubSlug ? ` (${s.hubSlug})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedScreenId && dailyProgramming.length > 0 && (
            <Card className="p-4">
              <h4 className="font-medium text-sm mb-3" data-testid="text-daily-schedule-title">
                Daily Schedule for {selectedScreen?.name}
              </h4>
              <div className="border rounded-md overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-2 font-medium w-20">Time</th>
                      <th className="text-left p-2 font-medium">Schedule</th>
                      <th className="text-left p-2 font-medium">Active Loop</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyProgramming.map((block) => (
                      <tr key={block.hour} className="border-b last:border-b-0" data-testid={`row-daily-hour-${block.hour}`}>
                        <td className="p-2 font-mono text-xs">{block.label}</td>
                        <td className="p-2 text-muted-foreground">{block.scheduleName}</td>
                        <td className="p-2">
                          {block.loopId ? (
                            <Badge variant="outline">{block.loopName}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {!selectedScreenId && (
            <Card className="p-8">
              <p className="text-sm text-muted-foreground text-center">Select a screen to see what would play at each hour of the day</p>
            </Card>
          )}
        </div>
      )}

      {previewMode === "venue" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Select Screen (Venue)</Label>
            <Select value={selectedScreenId} onValueChange={setSelectedScreenId}>
              <SelectTrigger data-testid="select-preview-venue-screen"><SelectValue placeholder="Choose a screen..." /></SelectTrigger>
              <SelectContent>
                {(screens || []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}{s.locationSlug ? ` @ ${s.locationSlug}` : ""}{s.hubSlug ? ` (${s.hubSlug})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedScreenId && venuePreviewList.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">
                  <ListChecks className="h-3 w-3 mr-1" /> {venuePreviewList.length} items
                </Badge>
                <Badge variant="secondary">
                  {venuePreviewList.reduce((sum: number, i: any) => sum + (i.durationSec || 9), 0)}s total
                </Badge>
                {venuePlaylist?.loopName && (
                  <Badge variant="outline">
                    <Repeat className="h-3 w-3 mr-1" /> {venuePlaylist.loopName}
                  </Badge>
                )}
              </div>
              <MiniSlidePlayer
                items={venuePreviewList}
                languageMode={venuePlaylist?.languageMode || "en"}
              />
            </div>
          )}

          {selectedScreenId && venuePreviewList.length === 0 && (
            <Card className="p-8">
              <p className="text-sm text-muted-foreground text-center">No playlist items found for this screen</p>
            </Card>
          )}

          {!selectedScreenId && (
            <Card className="p-8">
              <p className="text-sm text-muted-foreground text-center">Select a screen to preview the assembled venue playlist</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

interface ExpertShowSlot {
  id: string;
  businessId: string | null;
  cityId: string;
  expertName: string;
  showTitle: string;
  showDescription: string | null;
  dayOfWeek: string[];
  startTime: string;
  durationMinutes: number;
  segmentType: string;
  status: string;
  pricePerEpisodeCents: number;
  stripeSubscriptionId: string | null;
  hubSlug: string | null;
  thumbnailUrl: string | null;
  createdAt: string;
  updatedAt: string;
  businessName?: string | null;
}

const SEGMENT_TYPES = [
  { value: "general", label: "General" },
  { value: "real_estate_update", label: "Real Estate Update" },
  { value: "health_tips", label: "Health Tips" },
  { value: "small_business_strategy", label: "Small Business Strategy" },
  { value: "restaurant_highlights", label: "Restaurant Highlights" },
];

function ExpertShowsTab({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ExpertShowSlot | null>(null);

  const [expertName, setExpertName] = useState("");
  const [showTitle, setShowTitle] = useState("");
  const [showDescription, setShowDescription] = useState("");
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [startTime, setStartTime] = useState("12:00");
  const [durationMinutes, setDurationMinutes] = useState("15");
  const [segmentType, setSegmentType] = useState("general");
  const [status, setStatus] = useState("pending");
  const [pricePerEpisodeCents, setPricePerEpisodeCents] = useState("0");
  const [hubSlug, setHubSlug] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");

  const { data: slots, isLoading } = useQuery<ExpertShowSlot[]>({
    queryKey: ["/api/admin/expert-shows", cityId],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (cityId) p.set("cityId", cityId);
      const res = await fetch(`/api/admin/expert-shows?${p}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const resetForm = (s?: ExpertShowSlot | null) => {
    setExpertName(s?.expertName || "");
    setShowTitle(s?.showTitle || "");
    setShowDescription(s?.showDescription || "");
    setSelectedDays(s?.dayOfWeek || []);
    setStartTime(s?.startTime || "12:00");
    setDurationMinutes(String(s?.durationMinutes || 15));
    setSegmentType(s?.segmentType || "general");
    setStatus(s?.status || "pending");
    setPricePerEpisodeCents(String(s?.pricePerEpisodeCents || 0));
    setHubSlug(s?.hubSlug || "");
    setThumbnailUrl(s?.thumbnailUrl || "");
  };

  const openCreate = () => { setEditing(null); resetForm(); setDialogOpen(true); };
  const openEdit = (s: ExpertShowSlot) => { setEditing(s); resetForm(s); setDialogOpen(true); };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        expertName,
        showTitle,
        showDescription: showDescription || null,
        dayOfWeek: selectedDays,
        startTime,
        durationMinutes: parseInt(durationMinutes) || 15,
        segmentType,
        status,
        pricePerEpisodeCents: parseInt(pricePerEpisodeCents) || 0,
        hubSlug: hubSlug || null,
        thumbnailUrl: thumbnailUrl || null,
        cityId: editing?.cityId || "",
      };
      if (editing) {
        return apiRequest("PATCH", `/api/admin/expert-shows/${editing.id}`, body);
      }
      const cities = await fetch("/api/cities").then(r => r.json());
      const cityId = cities?.[0]?.id || "";
      return apiRequest("POST", "/api/admin/expert-shows", { ...body, cityId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/expert-shows"] });
      toast({ title: editing ? "Expert show updated" : "Expert show created" });
      setDialogOpen(false);
    },
    onError: () => toast({ title: "Error saving expert show", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/expert-shows/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/expert-shows"] });
      toast({ title: "Expert show deleted" });
    },
    onError: () => toast({ title: "Error deleting", variant: "destructive" }),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      return apiRequest("PATCH", `/api/admin/expert-shows/${id}`, { status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/expert-shows"] });
      toast({ title: "Status updated" });
    },
    onError: () => toast({ title: "Error updating status", variant: "destructive" }),
  });

  const toggleDay = (day: string) => {
    setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  if (isLoading) return <div className="text-sm text-muted-foreground p-4">Loading expert shows...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold" data-testid="text-expert-shows-title">Expert Show Slots</h3>
        <Button onClick={openCreate} data-testid="button-create-expert-show">
          <Plus className="h-4 w-4 mr-1" /> New Expert Show
        </Button>
      </div>

      <div className="border rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Show Title</th>
              <th className="text-left p-3 font-medium">Expert</th>
              <th className="text-left p-3 font-medium">Business</th>
              <th className="text-left p-3 font-medium">Segment</th>
              <th className="text-center p-3 font-medium">Schedule</th>
              <th className="text-center p-3 font-medium">Status</th>
              <th className="text-center p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(slots || []).map((slot) => (
              <tr key={slot.id} className="border-b last:border-b-0" data-testid={`row-expert-show-${slot.id}`}>
                <td className="p-3 font-medium">{slot.showTitle}</td>
                <td className="p-3 text-muted-foreground">{slot.expertName}</td>
                <td className="p-3 text-muted-foreground">{slot.businessName || "-"}</td>
                <td className="p-3">
                  <Badge variant="outline">{slot.segmentType.replace(/_/g, " ")}</Badge>
                </td>
                <td className="p-3 text-center">
                  <div className="text-xs text-muted-foreground">
                    {slot.dayOfWeek?.length > 0 ? slot.dayOfWeek.map(d => d.slice(0, 3)).join(", ") : "All days"}
                    <br />
                    {slot.startTime} ({slot.durationMinutes}min)
                  </div>
                </td>
                <td className="p-3 text-center">
                  <Badge
                    variant={slot.status === "active" ? "default" : slot.status === "cancelled" ? "destructive" : "secondary"}
                    data-testid={`badge-expert-status-${slot.id}`}
                  >
                    {slot.status}
                  </Badge>
                </td>
                <td className="p-3">
                  <div className="flex items-center justify-center gap-1">
                    {slot.status === "pending" && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => toggleStatus.mutate({ id: slot.id, newStatus: "active" })}
                        data-testid={`button-approve-${slot.id}`}
                      >
                        <Play className="h-4 w-4 text-green-600" />
                      </Button>
                    )}
                    {slot.status === "active" && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => toggleStatus.mutate({ id: slot.id, newStatus: "cancelled" })}
                        data-testid={`button-cancel-${slot.id}`}
                      >
                        <Pause className="h-4 w-4 text-orange-500" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => openEdit(slot)} data-testid={`button-edit-expert-${slot.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(slot.id)} data-testid={`button-delete-expert-${slot.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {(slots || []).length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No expert shows configured</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Expert Show" : "Create Expert Show"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Show Title</Label>
              <Input value={showTitle} onChange={(e) => setShowTitle(e.target.value)} data-testid="input-expert-show-title" />
            </div>
            <div className="space-y-2">
              <Label>Expert Name</Label>
              <Input value={expertName} onChange={(e) => setExpertName(e.target.value)} data-testid="input-expert-name" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={showDescription} onChange={(e) => setShowDescription(e.target.value)} className="resize-none" rows={2} data-testid="input-expert-description" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Segment Type</Label>
                <Select value={segmentType} onValueChange={setSegmentType}>
                  <SelectTrigger data-testid="select-segment-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SEGMENT_TYPES.map(st => (
                      <SelectItem key={st.value} value={st.value}>{st.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger data-testid="select-expert-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Days of Week</Label>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map(day => (
                  <Button
                    key={day}
                    type="button"
                    size="sm"
                    variant={selectedDays.includes(day) ? "default" : "outline"}
                    onClick={() => toggleDay(day)}
                    data-testid={`button-day-${day}`}
                  >
                    {day.slice(0, 3).toUpperCase()}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} data-testid="input-expert-start-time" />
              </div>
              <div className="space-y-2">
                <Label>Duration (min)</Label>
                <Input type="number" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} data-testid="input-expert-duration" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hub Slug (optional)</Label>
                <Input value={hubSlug} onChange={(e) => setHubSlug(e.target.value)} placeholder="south-end" data-testid="input-expert-hub-slug" />
              </div>
              <div className="space-y-2">
                <Label>Price/Episode (cents)</Label>
                <Input type="number" value={pricePerEpisodeCents} onChange={(e) => setPricePerEpisodeCents(e.target.value)} data-testid="input-expert-price" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Thumbnail URL</Label>
              <Input value={thumbnailUrl} onChange={(e) => setThumbnailUrl(e.target.value)} data-testid="input-expert-thumbnail" />
            </div>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full" data-testid="button-save-expert-show">
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {editing ? "Update" : "Create"} Expert Show
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function TvPanel({ cityId }: { cityId?: string }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Monitor className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-xl font-bold" data-testid="text-tv-panel-title">Web TV / Hub Screens</h2>
          <p className="text-sm text-muted-foreground">Manage TV screens, content, and ad placements for venue displays</p>
        </div>
      </div>

      <Tabs defaultValue="screens">
        <TabsList data-testid="tabs-tv-panel">
          <TabsTrigger value="screens" data-testid="tab-screens">Screens</TabsTrigger>
          <TabsTrigger value="content" data-testid="tab-content">Content</TabsTrigger>
          <TabsTrigger value="loops" data-testid="tab-loops">Loops</TabsTrigger>
          <TabsTrigger value="schedules" data-testid="tab-schedules">Schedules</TabsTrigger>
          <TabsTrigger value="host-phrases" data-testid="tab-host-phrases">Host Phrases</TabsTrigger>
          <TabsTrigger value="expert-shows" data-testid="tab-expert-shows">Expert Shows</TabsTrigger>
          <TabsTrigger value="content-links" data-testid="tab-content-links">Content Links</TabsTrigger>
          <TabsTrigger value="placements" data-testid="tab-placements">Placements</TabsTrigger>
          <TabsTrigger value="preview" data-testid="tab-preview">Preview</TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
        </TabsList>
        <TabsContent value="screens" className="mt-4">
          <div className="space-y-4">
            <AdminHelpPanel items={[
              { title: "How often should venue inserts run?", text: "Venue inserts work best every 5-8 minutes. Too frequent and they feel like ads; too sparse and the venue loses value. The venueInsertFrequencyMinutes setting on each screen controls this." },
              { title: "How competitor protection works", text: "When enabled, the screen will filter out content from categories listed in the protected list. This prevents a bar from showing promotions for competing bars on their own screen." },
            ]} />
            <ScreensTab cityId={cityId} />
          </div>
        </TabsContent>
        <TabsContent value="content" className="mt-4">
          <div className="space-y-4">
            <AdminHelpPanel items={[
              { title: "When should narration be used?", text: "Narration adds a spoken voice-over to slides. Use it sparingly on key community and support-local segments to create warmth. Avoid narrating every slide — it creates fatigue in venue environments." },
              { title: "How support local placements should feel", text: "Support local content should feel editorial and community-driven, not like a hard sell. Frame it as 'Meet your neighbor' or 'Did you know?' rather than a traditional advertisement." },
            ]} />
            <ContentTab cityId={cityId} />
          </div>
        </TabsContent>
        <TabsContent value="loops" className="mt-4">
          <div className="space-y-4">
            <AdminHelpPanel items={[
              { title: "What is a full loop?", text: "A loop is a curated sequence of 15-25 content items that plays in order (or shuffled by weight). Each loop targets a specific mood, time of day, or venue type — like 'Tonight Around You' for evening bars or 'Community Spotlight' for daytime cafes." },
              { title: "How does loop mixing work?", text: "Schedules rotate through multiple loops throughout the day. The channel engine picks the next loop based on the weighting strategy (sequential, weighted random, or alternating) and avoids repeating the same loop consecutively." },
            ]} />
            <LoopsTab cityId={cityId} />
          </div>
        </TabsContent>
        <TabsContent value="schedules" className="mt-4">
          <div className="space-y-4">
            <AdminHelpPanel items={[
              { title: "How does loop mixing work?", text: "Schedules assign loops to time windows. The engine cycles through the loop list during the schedule's active hours, using each loop's duration to determine when to switch. Weighted random adds variety while sequential keeps a predictable rotation." },
              { title: "How to avoid staff fatigue / repetition", text: "Assign 3+ loops to each schedule and enable noConsecutiveRepeat. This ensures staff at venues don't hear the same loop back-to-back. Vary loop durations (45-90 min) so transitions feel natural throughout the day." },
            ]} />
            <SchedulesTab cityId={cityId} />
          </div>
        </TabsContent>
        <TabsContent value="host-phrases" className="mt-4">
          <div className="space-y-4">
            <AdminHelpPanel items={[
              { title: "Host phrase categories", text: "Phrases are grouped by category: local_intro for general welcome, event_intro for event segments, support_local_intro for shop-local moments, nonprofit_intro for community features, venue_intro for venue spotlights, and quick_update for brief transitions. Each should feel warm and conversational. Include bilingual (EN/ES) versions for all phrases." },
            ]} />
            <HostPhrasesTab cityId={cityId} />
          </div>
        </TabsContent>
        <TabsContent value="expert-shows" className="mt-4">
          <div className="space-y-4">
            <AdminHelpPanel items={[
              { title: "What are expert shows?", text: "Expert shows are recurring segments where local professionals (real estate agents, health experts, business coaches) share knowledge on Hub TV. Active shows automatically appear in the TV rotation during their scheduled time slots." },
              { title: "Revenue model", text: "Expert shows can be monetized per-episode or via subscription. Set the price per episode in cents. Business owners can request show slots from their dashboard, which appear here as pending for admin approval." },
            ]} />
            <ExpertShowsTab cityId={cityId} />
          </div>
        </TabsContent>
        <TabsContent value="content-links" className="mt-4">
          <div className="space-y-4">
            <AdminHelpPanel items={[
              { title: "What are content links?", text: "Content links attach quizzes, giveaways, jobs, events, or articles to TV screens or hubs. When published, they automatically appear as slides in the TV rotation — no manual content item creation needed." },
              { title: "Draft vs Published", text: "Links start as drafts. Only published links appear on TV screens. Use Pause to temporarily remove a link from rotation without deleting it." },
            ]} />
            <ContentLinksTab cityId={cityId} />
          </div>
        </TabsContent>
        <TabsContent value="placements" className="mt-4">
          <div className="space-y-4">
            <AdminHelpPanel items={[
              { title: "How support local placements should feel", text: "Placements should be community-framed and editorial in tone — not hard-sell advertising. Think 'Proudly supported by' or 'Your neighborhood partner' rather than flashy commercial spots. This builds trust with both venues and their customers." },
            ]} />
            <PlacementsTab cityId={cityId} />
          </div>
        </TabsContent>
        <TabsContent value="preview" className="mt-4">
          <div className="space-y-4">
            <AdminHelpPanel items={[
              { title: "Why captions matter in venues", text: "Most venue screens run with sound off or at low volume. Captions and subtitle text ensure your message reaches viewers even in noisy environments like bars and restaurants. Always add subtitleText to important slides." },
            ]} />
            <PreviewTab cityId={cityId} />
          </div>
        </TabsContent>
        <TabsContent value="analytics" className="mt-4">
          <AnalyticsTab cityId={cityId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
