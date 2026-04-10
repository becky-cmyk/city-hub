import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";
import {
  Plus, Scissors, CheckCircle, Edit, Trash2, Calendar,
  Users, Loader2, BarChart3, Phone, MapPin, ArrowLeft,
  Zap, Clock, DollarSign, Building2,
} from "lucide-react";
import type { Provider, ProviderService, ProviderOpening, SuiteLocation, BookingPlatformConfig } from "@shared/schema";
import { PROVIDER_CATEGORIES, SUITE_LOCATION_TYPES } from "@shared/schema";

function ProviderForm({
  initial,
  cityId,
  onSave,
  onCancel,
}: {
  initial?: Partial<Provider>;
  cityId: string;
  onSave: (data: Partial<Provider> & { cityId: string }) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    displayName: initial?.displayName || "",
    slug: initial?.slug || "",
    category: initial?.category || "OTHER",
    subcategory: initial?.subcategory || "",
    bio: initial?.bio || "",
    specialties: (initial?.specialties || []).join(", "),
    phone: initial?.phone || "",
    smsNumber: initial?.smsNumber || "",
    email: initial?.email || "",
    instagramUrl: initial?.instagramUrl || "",
    websiteUrl: initial?.websiteUrl || "",
    bookingUrl: initial?.bookingUrl || "",
    bookingPlatform: initial?.bookingPlatform || "",
    bookingModuleType: initial?.bookingModuleType || "deep_link",
    bookingEmbedCode: initial?.bookingEmbedCode || "",
    bookingWidgetUrl: initial?.bookingWidgetUrl || "",
    isVerified: initial?.isVerified || false,
    acceptsWalkIns: initial?.acceptsWalkIns || false,
    supportsLiveOpenings: initial?.supportsLiveOpenings || false,
    suiteLocationId: initial?.suiteLocationId || "",
    suiteNumber: initial?.suiteNumber || "",
    heroImageUrl: initial?.heroImageUrl || "",
    profileImageUrl: initial?.profileImageUrl || "",
    zoneId: initial?.zoneId || "",
  });

  const { data: suiteLocations } = useQuery<SuiteLocation[]>({
    queryKey: ["/api/admin/suite-locations", { cityId }],
    queryFn: async () => {
      const res = await fetch(`/api/admin/suite-locations?cityId=${cityId}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: platforms } = useQuery<BookingPlatformConfig[]>({
    queryKey: ["/api/booking-platforms"],
  });

  const handleSubmit = () => {
    const data = {
      ...form,
      specialties: form.specialties.split(",").map(s => s.trim()).filter(Boolean),
      suiteLocationId: form.suiteLocationId || null,
      zoneId: form.zoneId || null,
      cityId,
    };
    onSave(data);
  };

  const autoSlug = () => {
    const s = form.displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    setForm(f => ({ ...f, slug: s }));
  };

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Display Name</Label>
          <Input value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} onBlur={() => !form.slug && autoSlug()} data-testid="input-provider-name" />
        </div>
        <div>
          <Label>Slug</Label>
          <Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} data-testid="input-provider-slug" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Category</Label>
          <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
            <SelectTrigger data-testid="select-provider-category"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PROVIDER_CATEGORIES.map(c => (
                <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Subcategory</Label>
          <Input value={form.subcategory} onChange={e => setForm(f => ({ ...f, subcategory: e.target.value }))} data-testid="input-provider-subcategory" />
        </div>
      </div>

      <div>
        <Label>Bio</Label>
        <Textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} rows={3} data-testid="input-provider-bio" />
      </div>

      <div>
        <Label>Specialties (comma-separated)</Label>
        <Input value={form.specialties} onChange={e => setForm(f => ({ ...f, specialties: e.target.value }))} placeholder="Balayage, Color Correction, Extensions" data-testid="input-provider-specialties" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Phone</Label>
          <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} data-testid="input-provider-phone" />
        </div>
        <div>
          <Label>SMS Number</Label>
          <Input value={form.smsNumber} onChange={e => setForm(f => ({ ...f, smsNumber: e.target.value }))} data-testid="input-provider-sms" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Email</Label>
          <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} data-testid="input-provider-email" />
        </div>
        <div>
          <Label>Instagram URL</Label>
          <Input value={form.instagramUrl} onChange={e => setForm(f => ({ ...f, instagramUrl: e.target.value }))} data-testid="input-provider-instagram" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Website</Label>
          <Input value={form.websiteUrl} onChange={e => setForm(f => ({ ...f, websiteUrl: e.target.value }))} data-testid="input-provider-website" />
        </div>
        <div>
          <Label>Profile Image URL</Label>
          <Input value={form.profileImageUrl} onChange={e => setForm(f => ({ ...f, profileImageUrl: e.target.value }))} data-testid="input-provider-profile-image" />
        </div>
      </div>

      <div>
        <Label>Hero Image URL</Label>
        <Input value={form.heroImageUrl} onChange={e => setForm(f => ({ ...f, heroImageUrl: e.target.value }))} data-testid="input-provider-hero-image" />
      </div>

      <div className="border-t pt-3 space-y-3">
        <p className="text-sm font-semibold">Booking Configuration</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Booking Platform</Label>
            <Select value={form.bookingPlatform} onValueChange={v => setForm(f => ({ ...f, bookingPlatform: v }))}>
              <SelectTrigger data-testid="select-booking-platform"><SelectValue placeholder="Select platform..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {platforms?.map(p => (
                  <SelectItem key={p.platformKey} value={p.platformKey}>{p.displayName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Booking Module Type</Label>
            <Select value={form.bookingModuleType} onValueChange={v => setForm(f => ({ ...f, bookingModuleType: v }))}>
              <SelectTrigger data-testid="select-booking-module-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="embed_widget">Embed Widget</SelectItem>
                <SelectItem value="popup_widget">Popup Widget</SelectItem>
                <SelectItem value="deep_link">Deep Link</SelectItem>
                <SelectItem value="call_text_fallback">Call/Text Fallback</SelectItem>
                <SelectItem value="manual_live_opening">Manual Live Openings</SelectItem>
                <SelectItem value="api_connected">API Connected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Booking URL</Label>
          <Input value={form.bookingUrl} onChange={e => setForm(f => ({ ...f, bookingUrl: e.target.value }))} placeholder="https://..." data-testid="input-booking-url" />
        </div>

        {(form.bookingModuleType === "embed_widget" || form.bookingModuleType === "popup_widget") && (
          <>
            <div>
              <Label>Booking Widget URL (for iframe)</Label>
              <Input value={form.bookingWidgetUrl} onChange={e => setForm(f => ({ ...f, bookingWidgetUrl: e.target.value }))} data-testid="input-booking-widget-url" />
            </div>
            <div>
              <Label>Booking Embed Code (HTML)</Label>
              <Textarea value={form.bookingEmbedCode} onChange={e => setForm(f => ({ ...f, bookingEmbedCode: e.target.value }))} rows={3} data-testid="input-booking-embed-code" />
            </div>
          </>
        )}
      </div>

      <div className="border-t pt-3 space-y-3">
        <p className="text-sm font-semibold">Location</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Suite Location</Label>
            <Select value={form.suiteLocationId} onValueChange={v => setForm(f => ({ ...f, suiteLocationId: v === "_none" ? "" : v }))}>
              <SelectTrigger data-testid="select-suite-location"><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">None</SelectItem>
                {suiteLocations?.map(sl => (
                  <SelectItem key={sl.id} value={sl.id}>{sl.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Suite Number</Label>
            <Input value={form.suiteNumber} onChange={e => setForm(f => ({ ...f, suiteNumber: e.target.value }))} placeholder="e.g. 205" data-testid="input-suite-number" />
          </div>
        </div>
      </div>

      <div className="border-t pt-3 space-y-3">
        <p className="text-sm font-semibold">Flags</p>
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <Switch checked={form.isVerified} onCheckedChange={v => setForm(f => ({ ...f, isVerified: v }))} data-testid="switch-verified" />
            <Label>Verified</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.acceptsWalkIns} onCheckedChange={v => setForm(f => ({ ...f, acceptsWalkIns: v }))} data-testid="switch-walkins" />
            <Label>Walk-Ins</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.supportsLiveOpenings} onCheckedChange={v => setForm(f => ({ ...f, supportsLiveOpenings: v }))} data-testid="switch-live-openings" />
            <Label>Live Openings</Label>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t">
        <Button variant="outline" onClick={onCancel} data-testid="button-cancel-provider">Cancel</Button>
        <Button onClick={handleSubmit} data-testid="button-save-provider">Save Provider</Button>
      </div>
    </div>
  );
}

function ServiceManager({ providerId }: { providerId: string }) {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDuration, setNewDuration] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newFeatured, setNewFeatured] = useState(false);

  const { data: services, isLoading } = useQuery<ProviderService[]>({
    queryKey: ["/api/admin/providers", providerId, "services"],
  });

  const createMut = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/admin/providers/${providerId}/services`, {
        name: newName,
        description: newDesc || null,
        durationMinutes: newDuration ? parseInt(newDuration) : null,
        priceDisplay: newPrice || null,
        isFeatured: newFeatured,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/providers", providerId, "services"] });
      setShowAdd(false);
      setNewName(""); setNewDesc(""); setNewDuration(""); setNewPrice(""); setNewFeatured(false);
      toast({ title: "Service added" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/provider-services/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/providers", providerId, "services"] });
      toast({ title: "Service removed" });
    },
  });

  return (
    <Card className="p-4 space-y-3" data-testid="section-service-manager">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold flex items-center gap-1.5"><DollarSign className="h-4 w-4" /> Services</p>
        <Button size="sm" variant="outline" onClick={() => setShowAdd(true)} data-testid="button-add-service">
          <Plus className="h-3 w-3 mr-1" /> Add
        </Button>
      </div>
      {isLoading && <Skeleton className="h-16 w-full" />}
      {services?.map(svc => (
        <div key={svc.id} className="flex items-center justify-between py-1.5 border-b last:border-0" data-testid={`service-row-${svc.id}`}>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{svc.name}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {svc.priceDisplay && <span>{svc.priceDisplay}</span>}
              {svc.durationMinutes && <span>{svc.durationMinutes} min</span>}
              {svc.isFeatured && <Badge className="text-[8px]">Featured</Badge>}
            </div>
          </div>
          <Button size="icon" variant="ghost" onClick={() => deleteMut.mutate(svc.id)} data-testid={`button-delete-service-${svc.id}`}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      {showAdd && (
        <div className="border rounded-md p-3 space-y-2">
          <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Service name" data-testid="input-new-service-name" />
          <Input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description (optional)" data-testid="input-new-service-desc" />
          <div className="grid grid-cols-2 gap-2">
            <Input value={newDuration} onChange={e => setNewDuration(e.target.value)} placeholder="Duration (min)" data-testid="input-new-service-duration" />
            <Input value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="Price display (e.g. $45)" data-testid="input-new-service-price" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={newFeatured} onCheckedChange={setNewFeatured} data-testid="switch-new-service-featured" />
            <Label>Featured</Label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => createMut.mutate()} disabled={!newName || createMut.isPending} data-testid="button-save-new-service">
              {createMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function OpeningManager({ providerId }: { providerId: string }) {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState(new Date().toISOString().split("T")[0]);
  const [newTimeLabel, setNewTimeLabel] = useState("");
  const [newUrgency, setNewUrgency] = useState("available_today");
  const [newNotes, setNewNotes] = useState("");

  const { data: openings, isLoading } = useQuery<ProviderOpening[]>({
    queryKey: ["/api/admin/providers", providerId, "openings"],
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const expiresAt = new Date(newDate);
      expiresAt.setHours(23, 59, 59);
      await apiRequest("POST", `/api/admin/providers/${providerId}/openings`, {
        title: newTitle,
        openingDate: newDate,
        openingTimeLabel: newTimeLabel || null,
        urgencyLabel: newUrgency,
        notes: newNotes || null,
        expiresAt: expiresAt.toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/providers", providerId, "openings"] });
      setShowAdd(false);
      setNewTitle(""); setNewTimeLabel(""); setNewNotes("");
      toast({ title: "Opening added" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/provider-openings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/providers", providerId, "openings"] });
      toast({ title: "Opening removed" });
    },
  });

  const urgencyOptions = [
    { value: "available_today", label: "Available Today" },
    { value: "available_tomorrow", label: "Available Tomorrow" },
    { value: "last_minute", label: "Last-Minute Opening" },
    { value: "this_afternoon", label: "This Afternoon" },
    { value: "this_evening", label: "This Evening" },
  ];

  return (
    <Card className="p-4 space-y-3" data-testid="section-opening-manager">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold flex items-center gap-1.5"><Zap className="h-4 w-4" /> Live Openings</p>
        <Button size="sm" variant="outline" onClick={() => setShowAdd(true)} data-testid="button-add-opening">
          <Plus className="h-3 w-3 mr-1" /> Quick Add
        </Button>
      </div>
      {isLoading && <Skeleton className="h-16 w-full" />}
      {openings?.map(op => (
        <div key={op.id} className="flex items-center justify-between py-1.5 border-b last:border-0" data-testid={`opening-row-${op.id}`}>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{op.title}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-[9px]">{op.urgencyLabel.replace(/_/g, " ")}</Badge>
              <span>{op.openingDate}</span>
              {op.openingTimeLabel && <span>{op.openingTimeLabel}</span>}
              <Badge variant={op.status === "active" ? "default" : "secondary"} className="text-[9px]">{op.status}</Badge>
            </div>
          </div>
          <Button size="icon" variant="ghost" onClick={() => deleteMut.mutate(op.id)} data-testid={`button-delete-opening-${op.id}`}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      {showAdd && (
        <div className="border rounded-md p-3 space-y-2">
          <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Opening title (e.g. Haircut + Style)" data-testid="input-new-opening-title" />
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} data-testid="input-new-opening-date" />
            <Input value={newTimeLabel} onChange={e => setNewTimeLabel(e.target.value)} placeholder="Time (e.g. 2:00 PM)" data-testid="input-new-opening-time" />
          </div>
          <Select value={newUrgency} onValueChange={setNewUrgency}>
            <SelectTrigger data-testid="select-new-opening-urgency"><SelectValue /></SelectTrigger>
            <SelectContent>
              {urgencyOptions.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="Notes (optional)" data-testid="input-new-opening-notes" />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => createMut.mutate()} disabled={!newTitle || createMut.isPending} data-testid="button-save-new-opening">
              {createMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function ProviderManagement({ cityId }: { cityId: string }) {
  const { toast } = useToast();
  const [view, setView] = useState<"list" | "create" | "edit" | "detail">("list");
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [tab, setTab] = useState<"providers" | "suites" | "reporting">("providers");
  const [showSuiteDialog, setShowSuiteDialog] = useState(false);
  const [suiteName, setSuiteName] = useState("");
  const [suiteSlug, setSuiteSlug] = useState("");
  const [suiteAddress, setSuiteAddress] = useState("");
  const [suiteType, setSuiteType] = useState("SALON_SUITE");

  const { data: allProviders, isLoading } = useQuery<Provider[]>({
    queryKey: ["/api/admin/providers", { cityId }],
    queryFn: async () => {
      const res = await fetch(`/api/admin/providers?cityId=${cityId}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: suiteLocations } = useQuery<SuiteLocation[]>({
    queryKey: ["/api/admin/suite-locations", { cityId }],
    queryFn: async () => {
      const res = await fetch(`/api/admin/suite-locations?cityId=${cityId}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: reporting } = useQuery<{
    topProviders: { providerId: string; providerName: string; totalActions: number }[];
    topOpenings: { openingId: string; title: string; providerName: string; clicks: number }[];
    actionsByType: { actionType: string; count: number }[];
    statsByZone: { zoneId: string | null; zoneName: string | null; providerCount: number; actionCount: number }[];
  }>({
    queryKey: ["/api/admin/provider-reporting", { cityId }],
    queryFn: async () => {
      const res = await fetch(`/api/admin/provider-reporting?cityId=${cityId}`);
      if (!res.ok) return { topProviders: [], topOpenings: [], actionsByType: [], statsByZone: [] };
      return res.json();
    },
    enabled: tab === "reporting",
  });

  const createMut = useMutation({
    mutationFn: async (data: Partial<Provider> & { cityId: string }) => {
      return apiRequest("POST", "/api/admin/providers", data).then(r => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/providers"] });
      setView("list");
      toast({ title: "Provider created" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMut = useMutation({
    mutationFn: async (data: Partial<Provider> & { cityId: string }) => {
      return apiRequest("PATCH", `/api/admin/providers/${selectedProvider!.id}`, data).then(r => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/providers"] });
      setView("list");
      toast({ title: "Provider updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/providers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/providers"] });
      setView("list");
      toast({ title: "Provider deleted" });
    },
  });

  const createSuiteMut = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/suite-locations", {
        name: suiteName,
        slug: suiteSlug || suiteName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        address: suiteAddress || null,
        suiteType,
        cityId,
      }).then(r => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/suite-locations"] });
      setShowSuiteDialog(false);
      setSuiteName(""); setSuiteSlug(""); setSuiteAddress("");
      toast({ title: "Suite location created" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const filtered = allProviders?.filter(p =>
    !searchQ || p.displayName.toLowerCase().includes(searchQ.toLowerCase())
  ) || [];

  if (view === "create") {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setView("list")} data-testid="button-back-list">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h2 className="text-lg font-bold">Add Provider</h2>
        <ProviderForm
          cityId={cityId}
          onSave={(data) => createMut.mutate(data)}
          onCancel={() => setView("list")}
        />
      </div>
    );
  }

  if (view === "edit" && selectedProvider) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setView("detail")} data-testid="button-back-detail">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h2 className="text-lg font-bold">Edit: {selectedProvider.displayName}</h2>
        <ProviderForm
          initial={selectedProvider}
          cityId={cityId}
          onSave={(data) => updateMut.mutate(data)}
          onCancel={() => setView("detail")}
        />
      </div>
    );
  }

  if (view === "detail" && selectedProvider) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => { setView("list"); setSelectedProvider(null); }} data-testid="button-back-list">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setView("edit")} data-testid="button-edit-provider">
              <Edit className="h-3 w-3 mr-1" /> Edit
            </Button>
            <Button size="sm" variant="destructive" onClick={() => { if (confirm("Delete this provider?")) deleteMut.mutate(selectedProvider.id); }} data-testid="button-delete-provider">
              <Trash2 className="h-3 w-3 mr-1" /> Delete
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {selectedProvider.profileImageUrl && (
            <img src={selectedProvider.profileImageUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
          )}
          <div>
            <h2 className="text-lg font-bold">{selectedProvider.displayName}</h2>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{PROVIDER_CATEGORIES.find(c => c.key === selectedProvider.category)?.label}</Badge>
              {selectedProvider.isVerified && <Badge variant="secondary"><CheckCircle className="h-3 w-3 mr-0.5" />Verified</Badge>}
              {selectedProvider.acceptsWalkIns && <Badge variant="outline" className="text-green-600">Walk-Ins</Badge>}
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <ServiceManager providerId={selectedProvider.id} />
          <OpeningManager providerId={selectedProvider.id} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Scissors className="h-5 w-5" />
          Provider Management
        </h2>
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant={tab === "providers" ? "default" : "outline"} onClick={() => setTab("providers")} data-testid="tab-providers">
          Providers ({allProviders?.length || 0})
        </Button>
        <Button size="sm" variant={tab === "suites" ? "default" : "outline"} onClick={() => setTab("suites")} data-testid="tab-suites">
          <Building2 className="h-3 w-3 mr-1" /> Suite Locations ({suiteLocations?.length || 0})
        </Button>
        <Button size="sm" variant={tab === "reporting" ? "default" : "outline"} onClick={() => setTab("reporting")} data-testid="tab-reporting">
          <BarChart3 className="h-3 w-3 mr-1" /> Reporting
        </Button>
      </div>

      {tab === "providers" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search providers..." className="max-w-xs" data-testid="input-admin-search-providers" />
            <Button onClick={() => setView("create")} data-testid="button-new-provider">
              <Plus className="h-4 w-4 mr-1" /> Add Provider
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16" />)}</div>
          ) : filtered.length === 0 ? (
            <Card className="p-8 text-center">
              <Scissors className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No providers yet. Click Add Provider to get started.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {filtered.map(p => {
                const catLabel = PROVIDER_CATEGORIES.find(c => c.key === p.category)?.label || p.category;
                return (
                  <Card
                    key={p.id}
                    className="p-3 cursor-pointer hover:shadow-sm transition-shadow"
                    onClick={() => { setSelectedProvider(p); setView("detail"); }}
                    data-testid={`card-admin-provider-${p.id}`}
                  >
                    <div className="flex items-center gap-3">
                      {p.profileImageUrl ? (
                        <img src={p.profileImageUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                          <Scissors className="h-5 w-5 text-muted-foreground/40" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{p.displayName}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[9px]">{catLabel}</Badge>
                          {p.isVerified && <CheckCircle className="h-3 w-3 text-primary" />}
                          {p.bookingPlatform && <Badge variant="secondary" className="text-[9px]">{p.bookingPlatform}</Badge>}
                          {!p.isActive && <Badge variant="destructive" className="text-[9px]">Inactive</Badge>}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "suites" && (
        <div className="space-y-3">
          <Button onClick={() => setShowSuiteDialog(true)} data-testid="button-new-suite">
            <Plus className="h-4 w-4 mr-1" /> Add Suite Location
          </Button>
          {suiteLocations?.length === 0 ? (
            <Card className="p-8 text-center">
              <Building2 className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No suite locations yet.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {suiteLocations?.map(sl => (
                <Card key={sl.id} className="p-3" data-testid={`card-admin-suite-${sl.id}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{sl.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-[9px]">{SUITE_LOCATION_TYPES.find(t => t.key === sl.suiteType)?.label}</Badge>
                        {sl.address && <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" /> {sl.address}</span>}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          <Dialog open={showSuiteDialog} onOpenChange={setShowSuiteDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Suite Location</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Name</Label>
                  <Input value={suiteName} onChange={e => { setSuiteName(e.target.value); setSuiteSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-")); }} data-testid="input-suite-name" />
                </div>
                <div>
                  <Label>Address</Label>
                  <Input value={suiteAddress} onChange={e => setSuiteAddress(e.target.value)} data-testid="input-suite-address" />
                </div>
                <div>
                  <Label>Type</Label>
                  <Select value={suiteType} onValueChange={setSuiteType}>
                    <SelectTrigger data-testid="select-suite-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SUITE_LOCATION_TYPES.map(t => (
                        <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowSuiteDialog(false)}>Cancel</Button>
                <Button onClick={() => createSuiteMut.mutate()} disabled={!suiteName || createSuiteMut.isPending} data-testid="button-save-suite">
                  {createSuiteMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {tab === "reporting" && (
        <div className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Top Providers by Contact Actions (Last 30 Days)</h3>
            {reporting?.topProviders && reporting.topProviders.length > 0 ? (
              <div className="space-y-2">
                {reporting.topProviders.map((tp, i) => (
                  <Card key={tp.providerId} className="p-3" data-testid={`card-top-provider-${i}`}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">{tp.providerName}</p>
                      <Badge variant="secondary">{tp.totalActions} actions</Badge>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-8 text-center">
                <BarChart3 className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No contact action data yet.</p>
              </Card>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Top Openings by Clicks</h3>
            {reporting?.topOpenings && reporting.topOpenings.length > 0 ? (
              <div className="space-y-2">
                {reporting.topOpenings.map((to, i) => (
                  <Card key={to.openingId || i} className="p-3" data-testid={`card-top-opening-${i}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">{to.title || "Untitled"}</p>
                        <p className="text-xs text-muted-foreground">{to.providerName}</p>
                      </div>
                      <Badge variant="secondary">{to.clicks} clicks</Badge>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No opening click data yet.</p>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Actions by Type</h3>
            {reporting?.actionsByType && reporting.actionsByType.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {reporting.actionsByType.map((at) => (
                  <Card key={at.actionType} className="p-3 text-center" data-testid={`card-action-type-${at.actionType}`}>
                    <p className="text-lg font-bold">{at.count}</p>
                    <p className="text-xs text-muted-foreground">{at.actionType.replace(/_/g, " ")}</p>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No action data yet.</p>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Performance by Hub/Neighborhood</h3>
            {reporting?.statsByZone && reporting.statsByZone.length > 0 ? (
              <div className="space-y-2">
                {reporting.statsByZone.map((sz, i) => (
                  <Card key={sz.zoneId || i} className="p-3" data-testid={`card-zone-stats-${i}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">{sz.zoneName || "No Hub Assigned"}</p>
                        <p className="text-xs text-muted-foreground">{sz.providerCount} providers</p>
                      </div>
                      <Badge variant="secondary">{sz.actionCount} actions</Badge>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No zone data yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
