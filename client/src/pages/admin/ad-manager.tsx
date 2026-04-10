import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Plus, Trash2, Eye, MousePointerClick, ExternalLink, Image as ImageIcon,
  BarChart3, LayoutGrid, Rss, Monitor, PanelLeft, Rows3, Tag, Calendar,
  ShoppingBag, Upload, Link2, X, Loader2, MapPin, Hash, FileText, Info
} from "lucide-react";
import { useState, useRef } from "react";
import { useDefaultCityId } from "@/hooks/use-city";

interface Ad {
  id: string;
  cityId: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  ctaLabel: string | null;
  slot: string;
  isActive: boolean;
  impressions: number;
  clicks: number;
  position: number | null;
  startDate: string | null;
  endDate: string | null;
  tags: string[] | null;
  targetPages: string[] | null;
  contentBody: string | null;
  createdAt: string;
}

const SLOT_LABELS: Record<string, string> = {
  LEADERBOARD: "Leaderboard (top banner)",
  SIDEBAR: "Sidebar (desktop)",
  INLINE: "Inline (between sections)",
  CLASSIFIEDS_SPONSOR: "Classifieds Sponsor",
  DIRECTORY_TILE: "Directory Tile (grid card)",
  PULSE_NATIVE: "Pulse Native (feed card)",
  EVENT_SPONSOR: "Event Sponsor",
  MARKETPLACE_TILE: "Marketplace Tile (listing card)",
};

const SLOT_COLORS: Record<string, string> = {
  LEADERBOARD: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  SIDEBAR: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  INLINE: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  CLASSIFIEDS_SPONSOR: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  DIRECTORY_TILE: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  PULSE_NATIVE: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
  EVENT_SPONSOR: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  MARKETPLACE_TILE: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
};

const SLOT_ICONS: Record<string, typeof Monitor> = {
  LEADERBOARD: Monitor,
  SIDEBAR: PanelLeft,
  INLINE: Rows3,
  CLASSIFIEDS_SPONSOR: Tag,
  DIRECTORY_TILE: LayoutGrid,
  PULSE_NATIVE: Rss,
  EVENT_SPONSOR: Calendar,
  MARKETPLACE_TILE: ShoppingBag,
};

const SLOT_PLACEMENTS: Record<string, string> = {
  LEADERBOARD: "City Home, Neighborhood Hub",
  SIDEBAR: "Directory, Articles, Business Detail, Event Detail",
  INLINE: "Category Hub, Article Detail, Attractions, Jobs",
  CLASSIFIEDS_SPONSOR: "Classifieds / Marketplace pages",
  DIRECTORY_TILE: "Directory grid, every 6th position",
  PULSE_NATIVE: "Pulse Feed, every 8th item",
  EVENT_SPONSOR: "Events List, Event Detail pages",
  MARKETPLACE_TILE: "Marketplace grid, every 6th listing",
};

const SLOT_DIMENSIONS: Record<string, { w: number; h: number; label: string }> = {
  LEADERBOARD: { w: 728, h: 90, label: "728 × 90 px" },
  SIDEBAR: { w: 300, h: 250, label: "300 × 250 px" },
  INLINE: { w: 728, h: 90, label: "728 × 90 px" },
  CLASSIFIEDS_SPONSOR: { w: 300, h: 250, label: "300 × 250 px" },
  DIRECTORY_TILE: { w: 400, h: 300, label: "400 × 300 px" },
  PULSE_NATIVE: { w: 600, h: 450, label: "600 × 450 px (4:3)" },
  EVENT_SPONSOR: { w: 600, h: 200, label: "600 × 200 px" },
  MARKETPLACE_TILE: { w: 400, h: 300, label: "400 × 300 px" },
};

const VERTICAL_TAGS = ["food", "music", "commerce", "senior", "pets", "family"];

const TARGET_PAGES: { value: string; label: string }[] = [
  { value: "city-home", label: "Main Page" },
  { value: "directory", label: "Directory" },
  { value: "events", label: "Events" },
  { value: "articles", label: "Articles" },
  { value: "pulse", label: "Pulse Feed" },
  { value: "marketplace", label: "Marketplace" },
  { value: "attractions", label: "Attractions" },
  { value: "jobs", label: "Jobs" },
  { value: "neighborhoods", label: "Neighborhoods" },
  { value: "business-detail", label: "Business Detail" },
  { value: "event-detail", label: "Event Detail" },
  { value: "article-detail", label: "Article Detail" },
  { value: "food", label: "Food Hub" },
  { value: "music", label: "Music Hub" },
  { value: "commerce", label: "Commerce Hub" },
  { value: "senior", label: "Senior Hub" },
  { value: "pets", label: "Pets Hub" },
  { value: "family", label: "Family Hub" },
];

function ImageUploader({ imageUrl, onImageChange }: { imageUrl: string; onImageChange: (url: string) => void }) {
  const [mode, setMode] = useState<"upload" | "url">(imageUrl ? "url" : "upload");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await fetch("/api/admin/upload-photo", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      onImageChange(data.url);
    } catch {
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label>Ad Creative</Label>
        <div className="flex gap-1 ml-auto">
          <Button
            type="button"
            variant={mode === "upload" ? "default" : "ghost"}
            size="sm"
            className="h-6 text-[10px] px-2"
            onClick={() => setMode("upload")}
          >
            <Upload className="h-3 w-3 mr-1" /> Upload
          </Button>
          <Button
            type="button"
            variant={mode === "url" ? "default" : "ghost"}
            size="sm"
            className="h-6 text-[10px] px-2"
            onClick={() => setMode("url")}
          >
            <Link2 className="h-3 w-3 mr-1" /> URL
          </Button>
        </div>
      </div>

      {mode === "upload" ? (
        <div
          className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
          data-testid="dropzone-ad-image"
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          {uploading ? (
            <div className="flex items-center justify-center gap-2 py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Uploading...</span>
            </div>
          ) : (
            <div className="py-2">
              <Upload className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-xs text-muted-foreground">Drop an image or click to browse</p>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">JPG, PNG, WebP, GIF — max 10MB</p>
            </div>
          )}
        </div>
      ) : (
        <Input
          value={imageUrl}
          onChange={(e) => onImageChange(e.target.value)}
          placeholder="https://example.com/ad-image.jpg"
          data-testid="input-ad-image-url"
        />
      )}

      {imageUrl && (
        <div className="relative group inline-block">
          <img src={imageUrl} alt="Preview" className="h-20 rounded border object-cover" />
          <button
            type="button"
            onClick={() => onImageChange("")}
            className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

function MultiSelect({ label, icon: Icon, options, selected, onChange, testId }: {
  label: string;
  icon: typeof Tag;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
  testId: string;
}) {
  const toggle = (val: string) => {
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);
  };
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" /> {label}
      </Label>
      <div className="flex flex-wrap gap-1.5" data-testid={testId}>
        {options.map(({ value, label: lbl }) => (
          <button
            key={value}
            type="button"
            onClick={() => toggle(value)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              selected.includes(value)
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/50 text-muted-foreground border-border hover:border-primary/40"
            }`}
          >
            {lbl}
          </button>
        ))}
      </div>
    </div>
  );
}

function AdForm({ ad, onClose }: { ad?: Ad; onClose: () => void }) {
  const CITY_ID = useDefaultCityId();
  const { toast } = useToast();
  const [title, setTitle] = useState(ad?.title || "");
  const [description, setDescription] = useState(ad?.description || "");
  const [imageUrl, setImageUrl] = useState(ad?.imageUrl || "");
  const [linkUrl, setLinkUrl] = useState(ad?.linkUrl || "");
  const [ctaLabel, setCtaLabel] = useState(ad?.ctaLabel || "");
  const [slot, setSlot] = useState(ad?.slot || "LEADERBOARD");
  const [isActive, setIsActive] = useState(ad?.isActive ?? true);
  const [contentBody, setContentBody] = useState(ad?.contentBody || "");
  const [tags, setTags] = useState<string[]>(ad?.tags || []);
  const [targetPages, setTargetPages] = useState<string[]>(ad?.targetPages || []);

  const dims = SLOT_DIMENSIONS[slot];

  const mutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        title,
        imageUrl: imageUrl || null,
        linkUrl: linkUrl || null,
        slot,
        isActive,
        cityId: CITY_ID as string,
        description: description || null,
        ctaLabel: ctaLabel || null,
        contentBody: contentBody || null,
        tags: tags.length > 0 ? tags : null,
        targetPages: targetPages.length > 0 ? targetPages : null,
      };
      if (ad) {
        return apiRequest("PATCH", `/api/admin/ads/${ad.id}`, body);
      }
      return apiRequest("POST", "/api/admin/ads", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ads"] });
      toast({ title: ad ? "Ad updated" : "Ad created" });
      onClose();
    },
    onError: () => toast({ title: "Error saving ad", variant: "destructive" }),
  });

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-2">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ad campaign name" data-testid="input-ad-title" />
        </div>

        <div className="space-y-2">
          <Label>Slot Type</Label>
          <Select value={slot} onValueChange={setSlot}>
            <SelectTrigger data-testid="select-ad-slot">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SLOT_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {dims && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/50 px-2.5 py-1.5 rounded">
              <Info className="h-3 w-3 shrink-0" />
              <span>Recommended size: <strong>{dims.label}</strong></span>
              <span className="ml-auto text-muted-foreground/70">{SLOT_PLACEMENTS[slot]}</span>
            </div>
          )}
        </div>

        <ImageUploader imageUrl={imageUrl} onImageChange={setImageUrl} />

        <div className="space-y-2">
          <Label>Destination URL</Label>
          <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://advertiser.com/landing-page" data-testid="input-ad-link" />
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Content / Context
          </Label>
          <Textarea
            value={contentBody}
            onChange={(e) => setContentBody(e.target.value)}
            placeholder="Write your ad copy here, like composing a social post..."
            className="resize-none"
            rows={3}
            data-testid="input-ad-content-body"
          />
        </div>

        <div className="space-y-2">
          <Label>Short Description</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief tagline or subtitle for the ad card"
            data-testid="input-ad-description"
          />
        </div>

        <div className="space-y-2">
          <Label>CTA Button Label</Label>
          <Input
            value={ctaLabel}
            onChange={(e) => setCtaLabel(e.target.value)}
            placeholder='e.g. "Learn More", "Visit Site", "Get Offer"'
            data-testid="input-ad-cta-label"
          />
        </div>

        <MultiSelect
          label="Vertical Tags"
          icon={Hash}
          options={VERTICAL_TAGS.map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))}
          selected={tags}
          onChange={setTags}
          testId="multi-select-tags"
        />

        <MultiSelect
          label="Page Targeting"
          icon={MapPin}
          options={TARGET_PAGES}
          selected={targetPages}
          onChange={setTargetPages}
          testId="multi-select-pages"
        />

        <div className="flex items-center gap-2">
          <Switch checked={isActive} onCheckedChange={setIsActive} data-testid="switch-ad-active" />
          <Label>Active</Label>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 pt-2 sticky bottom-0 bg-background pb-1">
        <Button onClick={() => mutation.mutate()} disabled={!title || mutation.isPending} data-testid="button-save-ad">
          {mutation.isPending ? "Saving..." : ad ? "Update" : "Create"}
        </Button>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}

function AdInventorySummary({ ads }: { ads: Ad[] }) {
  const activeAds = ads.filter((a) => a.isActive);
  const totalImpressions = ads.reduce((sum, a) => sum + a.impressions, 0);
  const totalClicks = ads.reduce((sum, a) => sum + a.clicks, 0);
  const overallCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) : "0.0";

  const slotCounts = Object.keys(SLOT_LABELS).map((slot) => {
    const slotAds = ads.filter((a) => a.slot === slot);
    const active = slotAds.filter((a) => a.isActive).length;
    return { slot, total: slotAds.length, active };
  });

  return (
    <Card className="p-4" data-testid="card-ad-inventory">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-semibold text-sm">Ad Inventory Overview</h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="text-center" data-testid="stat-total-ads">
          <div className="text-2xl font-bold">{ads.length}</div>
          <div className="text-xs text-muted-foreground">Total Ads</div>
        </div>
        <div className="text-center" data-testid="stat-active-ads">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{activeAds.length}</div>
          <div className="text-xs text-muted-foreground">Active</div>
        </div>
        <div className="text-center" data-testid="stat-total-impressions">
          <div className="text-2xl font-bold">{totalImpressions.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">Impressions</div>
        </div>
        <div className="text-center" data-testid="stat-total-clicks">
          <div className="text-2xl font-bold">{totalClicks.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">Clicks <span className="text-muted-foreground/70">({overallCtr}% CTR)</span></div>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Slots & Placements</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {slotCounts.map(({ slot, total, active }) => {
            const SlotIcon = SLOT_ICONS[slot] || Monitor;
            const dims = SLOT_DIMENSIONS[slot];
            return (
              <div key={slot} className="flex items-center gap-2 text-xs border rounded-md px-2 py-1.5" data-testid={`inventory-slot-${slot.toLowerCase()}`}>
                <SlotIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{SLOT_LABELS[slot]?.split(" (")[0]}</div>
                  {dims && <div className="text-[10px] text-muted-foreground">{dims.label}</div>}
                </div>
                <Badge variant="secondary" className="text-[10px] shrink-0">
                  {active}/{total}
                </Badge>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

export default function AdManager({ cityId }: { cityId?: string }) {
  const CITY_ID = useDefaultCityId();
  const { toast } = useToast();
  const [editingAd, setEditingAd] = useState<Ad | undefined>();
  const [showForm, setShowForm] = useState(false);

  const { data: ads, isLoading } = useQuery<Ad[]>({
    queryKey: ["/api/admin/ads", { cityId: CITY_ID }],
    queryFn: async () => {
      const resp = await fetch(`/api/admin/ads?cityId=${CITY_ID}`, { credentials: "include" });
      if (!resp.ok) throw new Error("Failed to fetch ads");
      return resp.json();
    },
    enabled: !!CITY_ID,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/ads/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ads"] });
      toast({ title: "Ad deleted" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest("PATCH", `/api/admin/ads/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/ads"] }),
  });

  const slotGroups = Object.keys(SLOT_LABELS).map((slot) => ({
    slot,
    label: SLOT_LABELS[slot],
    ads: (ads || []).filter((a) => a.slot === slot),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-xl font-bold" data-testid="text-ad-manager-title">Ad Manager</h2>
          <p className="text-sm text-muted-foreground">Manage ad placements across the site</p>
        </div>
        <Dialog open={showForm && !editingAd} onOpenChange={(open) => { setShowForm(open); if (!open) setEditingAd(undefined); }}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingAd(undefined); setShowForm(true); }} data-testid="button-create-ad">
              <Plus className="h-4 w-4 mr-1" /> New Ad
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Ad</DialogTitle>
            </DialogHeader>
            <AdForm onClose={() => setShowForm(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading ads...</div>
      ) : (
        <>
          <AdInventorySummary ads={ads || []} />

          {slotGroups.map(({ slot, label, ads: slotAds }) => (
            <div key={slot} className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-sm">{label}</h3>
                <Badge variant="secondary" className="text-xs">{slotAds.length} ad{slotAds.length !== 1 ? "s" : ""}</Badge>
              </div>

              {slotAds.length === 0 ? (
                <Card className="p-4 border-dashed">
                  <p className="text-sm text-muted-foreground text-center">No ads in this slot. Click "New Ad" to create one.</p>
                </Card>
              ) : (
                <div className="space-y-2">
                  {slotAds.map((ad) => {
                    const dims = SLOT_DIMENSIONS[ad.slot];
                    const ctr = ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(1) : null;
                    return (
                      <Card key={ad.id} className="p-3" data-testid={`card-ad-${ad.id}`}>
                        <div className="flex flex-col sm:flex-row gap-3">
                          {ad.imageUrl ? (
                            <div className="w-24 h-16 rounded overflow-hidden bg-muted shrink-0">
                              <img src={ad.imageUrl} alt="" className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-24 h-16 rounded bg-muted flex items-center justify-center shrink-0">
                              <ImageIcon className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-medium text-sm truncate">{ad.title}</span>
                              <Badge className={`text-[10px] ${SLOT_COLORS[ad.slot] || ""}`}>{ad.slot.replace(/_/g, " ")}</Badge>
                              {ad.isActive ? (
                                <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-[10px]">Live</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px]">Paused</Badge>
                              )}
                              {dims && (
                                <span className="text-[10px] text-muted-foreground">{dims.label}</span>
                              )}
                            </div>

                            {ad.contentBody && (
                              <p className="text-xs text-muted-foreground line-clamp-2 mb-1">{ad.contentBody}</p>
                            )}
                            {!ad.contentBody && ad.description && (
                              <p className="text-xs text-muted-foreground truncate mb-1">{ad.description}</p>
                            )}

                            {(ad.tags && ad.tags.length > 0) && (
                              <div className="flex flex-wrap gap-1 mb-1">
                                {ad.tags.map(t => (
                                  <Badge key={t} variant="outline" className="text-[9px] px-1.5 py-0">
                                    <Hash className="h-2 w-2 mr-0.5" />{t}
                                  </Badge>
                                ))}
                              </div>
                            )}

                            {(ad.targetPages && ad.targetPages.length > 0) && (
                              <div className="flex flex-wrap gap-1 mb-1">
                                {ad.targetPages.map(p => (
                                  <Badge key={p} variant="outline" className="text-[9px] px-1.5 py-0 border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400">
                                    <MapPin className="h-2 w-2 mr-0.5" />{TARGET_PAGES.find(tp => tp.value === p)?.label || p}
                                  </Badge>
                                ))}
                              </div>
                            )}

                            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {ad.impressions.toLocaleString()}</span>
                              <span className="flex items-center gap-1"><MousePointerClick className="h-3 w-3" /> {ad.clicks.toLocaleString()}</span>
                              {ctr && <span>CTR: {ctr}%</span>}
                              {ad.ctaLabel && <span className="text-muted-foreground/70">CTA: {ad.ctaLabel}</span>}
                              {ad.linkUrl && (
                                <a href={ad.linkUrl} target="_blank" rel="noopener" className="flex items-center gap-0.5 hover:text-foreground">
                                  <ExternalLink className="h-3 w-3" /> Link
                                </a>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Switch
                              checked={ad.isActive}
                              onCheckedChange={(checked) => toggleMutation.mutate({ id: ad.id, isActive: checked })}
                              data-testid={`switch-toggle-${ad.id}`}
                            />
                            <Dialog open={editingAd?.id === ad.id} onOpenChange={(open) => { if (!open) setEditingAd(undefined); }}>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" onClick={() => setEditingAd(ad)} data-testid={`button-edit-${ad.id}`}>
                                  Edit
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-lg">
                                <DialogHeader>
                                  <DialogTitle>Edit Ad</DialogTitle>
                                </DialogHeader>
                                <AdForm ad={ad} onClose={() => setEditingAd(undefined)} />
                              </DialogContent>
                            </Dialog>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => deleteMutation.mutate(ad.id)}
                              data-testid={`button-delete-${ad.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
