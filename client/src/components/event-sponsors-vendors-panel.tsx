import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Edit, Trash2, Star, Store, Search, Building2, CheckCircle, XCircle, Eye, EyeOff, Link as LinkIcon } from "lucide-react";
import { useState, useMemo } from "react";
import type { EventSponsor, EventVendorManaged } from "@shared/schema";

const SPONSOR_TIERS = ["title", "presenting", "gold", "silver", "bronze", "community", "in_kind", "media"] as const;
const SPONSOR_STATUSES = ["prospect", "contacted", "confirmed", "declined", "withdrawn"] as const;
const VENDOR_STATUSES = ["applied", "under_review", "approved", "rejected", "waitlisted", "confirmed", "withdrawn"] as const;

const tierColors: Record<string, string> = {
  title: "bg-amber-500 text-white",
  presenting: "bg-purple-600 text-white",
  gold: "bg-yellow-500 text-black",
  silver: "bg-gray-400 text-black",
  bronze: "bg-orange-700 text-white",
  community: "bg-teal-600 text-white",
  in_kind: "bg-blue-500 text-white",
  media: "bg-pink-600 text-white",
};

const statusColors: Record<string, string> = {
  prospect: "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  contacted: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  confirmed: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  declined: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  withdrawn: "bg-gray-100 text-gray-500",
  applied: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  under_review: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  approved: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  waitlisted: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
};

interface SponsorVendorPanelProps {
  eventId: string;
  apiPrefix: string;
}

function PresenceSearch({ onSelect, apiPrefix }: { onSelect: (biz: { id: string; name: string; slug: string }) => void; apiPrefix: string }) {
  const [search, setSearch] = useState("");
  const { data: results } = useQuery<{ id: string; name: string; slug: string; imageUrl?: string }[]>({
    queryKey: [apiPrefix, "businesses", "search-presence", search],
    queryFn: async () => {
      const resp = await fetch(`${apiPrefix}/businesses/search-presence?q=${encodeURIComponent(search)}`);
      if (!resp.ok) return [];
      return resp.json();
    },
    enabled: search.length >= 2,
  });

  return (
    <div className="relative">
      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search Presences by name..." data-testid="input-presence-search" />
      {results && results.length > 0 && (
        <Card className="absolute z-50 w-full mt-1 divide-y max-h-48 overflow-y-auto">
          {results.map((b) => (
            <button key={b.id} className="w-full text-left px-3 py-2 text-sm hover:bg-muted" onClick={() => { onSelect(b); setSearch(""); }} data-testid={`button-select-presence-${b.id}`}>
              <span className="font-medium">{b.name}</span>
              <span className="text-xs text-muted-foreground ml-2">/{b.slug}</span>
            </button>
          ))}
        </Card>
      )}
    </div>
  );
}

export function EventSponsorsTab({ eventId, apiPrefix }: SponsorVendorPanelProps) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<EventSponsor | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");

  const [form, setForm] = useState({
    name: "", logoUrl: "", websiteUrl: "", tier: "community" as string,
    status: "prospect" as string, displayPublicly: false,
    contactName: "", contactEmail: "", contactPhone: "", notes: "",
    presenceId: null as string | null, sortOrder: 0,
  });

  const { data: sponsors, isLoading } = useQuery<EventSponsor[]>({
    queryKey: [apiPrefix, "events", eventId, "sponsors"],
    queryFn: async () => {
      const resp = await fetch(`${apiPrefix}/events/${eventId}/sponsors`);
      if (!resp.ok) throw new Error("Failed");
      return resp.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editItem) {
        await apiRequest("PATCH", `${apiPrefix}/event-sponsors/${editItem.id}`, form);
      } else {
        await apiRequest("POST", `${apiPrefix}/events/${eventId}/sponsors`, form);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiPrefix, "events", eventId, "sponsors"] });
      toast({ title: editItem ? "Sponsor updated" : "Sponsor added" });
      setShowForm(false);
      setEditItem(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `${apiPrefix}/event-sponsors/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiPrefix, "events", eventId, "sponsors"] });
      toast({ title: "Sponsor removed" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openForm = (item?: EventSponsor) => {
    if (item) {
      setEditItem(item);
      setForm({
        name: item.name, logoUrl: item.logoUrl || "", websiteUrl: item.websiteUrl || "",
        tier: item.tier, status: item.status, displayPublicly: item.displayPublicly,
        contactName: item.contactName || "", contactEmail: item.contactEmail || "",
        contactPhone: item.contactPhone || "", notes: item.notes || "",
        presenceId: item.presenceId, sortOrder: item.sortOrder,
      });
    } else {
      setEditItem(null);
      setForm({ name: "", logoUrl: "", websiteUrl: "", tier: "community", status: "prospect", displayPublicly: false, contactName: "", contactEmail: "", contactPhone: "", notes: "", presenceId: null, sortOrder: 0 });
    }
    setShowForm(true);
  };

  const filtered = useMemo(() => {
    let list = sponsors || [];
    if (statusFilter !== "all") list = list.filter((s) => s.status === statusFilter);
    if (tierFilter !== "all") list = list.filter((s) => s.tier === tierFilter);
    return list;
  }, [sponsors, statusFilter, tierFilter]);

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-sm flex items-center gap-1" data-testid="text-sponsors-title">
          <Star className="h-4 w-4 text-amber-500" /> Sponsors ({sponsors?.length || 0})
        </h3>
        <Button size="sm" onClick={() => openForm()} data-testid="button-add-sponsor">
          <Plus className="h-3 w-3 mr-1" /> Add Sponsor
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="select-sponsor-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {SPONSOR_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={tierFilter} onValueChange={setTierFilter}>
          <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="select-sponsor-tier-filter">
            <SelectValue placeholder="Tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tiers</SelectItem>
            {SPONSOR_TIERS.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 && (
        <Card className="p-6 text-center">
          <Star className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground" data-testid="text-no-sponsors">No sponsors yet</p>
        </Card>
      )}

      {filtered.map((s) => (
        <Card key={s.id} className="p-3" data-testid={`card-sponsor-${s.id}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-medium text-sm" data-testid={`text-sponsor-name-${s.id}`}>{s.name}</span>
                <Badge className={`text-[10px] ${tierColors[s.tier] || ""}`}>{s.tier.replace(/_/g, " ")}</Badge>
                <Badge className={`text-[10px] ${statusColors[s.status] || ""}`}>{s.status}</Badge>
                {s.displayPublicly && <Badge variant="outline" className="text-[10px]"><Eye className="h-3 w-3 mr-0.5" />Public</Badge>}
                {s.presenceId && <Badge variant="outline" className="text-[10px]"><LinkIcon className="h-3 w-3 mr-0.5" />Linked</Badge>}
              </div>
              {(s.contactName || s.contactEmail) && (
                <p className="text-xs text-muted-foreground">{[s.contactName, s.contactEmail].filter(Boolean).join(" · ")}</p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button size="icon" variant="ghost" onClick={() => openForm(s)} data-testid={`button-edit-sponsor-${s.id}`}>
                <Edit className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(s.id)} data-testid={`button-delete-sponsor-${s.id}`}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </Card>
      ))}

      <Dialog open={showForm} onOpenChange={(o) => { if (!o) { setShowForm(false); setEditItem(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle data-testid="text-sponsor-dialog-title">{editItem ? "Edit Sponsor" : "Add Sponsor"}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} data-testid="input-sponsor-name" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Link to Presence</Label>
              {form.presenceId && (
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="secondary"><Building2 className="h-3 w-3 mr-1" />Linked</Badge>
                  <Button size="sm" variant="ghost" onClick={() => setForm((f) => ({ ...f, presenceId: null }))} data-testid="button-clear-presence">Clear</Button>
                </div>
              )}
              <PresenceSearch apiPrefix={apiPrefix} onSelect={(biz) => setForm((f) => ({ ...f, presenceId: biz.id, name: f.name || biz.name }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tier</Label>
                <Select value={form.tier} onValueChange={(v) => setForm((f) => ({ ...f, tier: v }))}>
                  <SelectTrigger data-testid="select-sponsor-tier"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SPONSOR_TIERS.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger data-testid="select-sponsor-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SPONSOR_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Logo URL</Label>
              <Input value={form.logoUrl} onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))} data-testid="input-sponsor-logo" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Website URL</Label>
              <Input value={form.websiteUrl} onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))} data-testid="input-sponsor-website" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Contact Name</Label>
                <Input value={form.contactName} onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))} data-testid="input-sponsor-contact-name" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Contact Email</Label>
                <Input value={form.contactEmail} onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))} data-testid="input-sponsor-contact-email" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Contact Phone</Label>
                <Input value={form.contactPhone} onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))} data-testid="input-sponsor-contact-phone" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Sort Order</Label>
                <Input type="number" value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))} data-testid="input-sponsor-sort" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} data-testid="input-sponsor-notes" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.displayPublicly} onCheckedChange={(v) => setForm((f) => ({ ...f, displayPublicly: v }))} id="sponsor-public" data-testid="switch-sponsor-public" />
              <Label htmlFor="sponsor-public" className="text-sm">Display publicly on event page</Label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setShowForm(false); setEditItem(null); }} data-testid="button-sponsor-cancel">Cancel</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending} data-testid="button-sponsor-save">
                {saveMutation.isPending ? "Saving..." : editItem ? "Update" : "Add Sponsor"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function EventVendorsTab({ eventId, apiPrefix }: SponsorVendorPanelProps) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<EventVendorManaged | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");

  const [form, setForm] = useState({
    name: "", logoUrl: "", websiteUrl: "", category: "",
    boothLabel: "", status: "applied" as string, displayPublicly: false,
    contactName: "", contactEmail: "", contactPhone: "",
    description: "", notes: "",
    presenceId: null as string | null, sortOrder: 0,
  });

  const { data: vendors, isLoading } = useQuery<EventVendorManaged[]>({
    queryKey: [apiPrefix, "events", eventId, "vendors-managed"],
    queryFn: async () => {
      const resp = await fetch(`${apiPrefix}/events/${eventId}/vendors-managed`);
      if (!resp.ok) throw new Error("Failed");
      return resp.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editItem) {
        await apiRequest("PATCH", `${apiPrefix}/event-vendors-managed/${editItem.id}`, form);
      } else {
        await apiRequest("POST", `${apiPrefix}/events/${eventId}/vendors-managed`, form);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiPrefix, "events", eventId, "vendors-managed"] });
      toast({ title: editItem ? "Vendor updated" : "Vendor added" });
      setShowForm(false);
      setEditItem(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `${apiPrefix}/event-vendors-managed/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiPrefix, "events", eventId, "vendors-managed"] });
      toast({ title: "Vendor removed" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `${apiPrefix}/event-vendors-managed/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiPrefix, "events", eventId, "vendors-managed"] });
      toast({ title: "Status updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openForm = (item?: EventVendorManaged) => {
    if (item) {
      setEditItem(item);
      setForm({
        name: item.name, logoUrl: item.logoUrl || "", websiteUrl: item.websiteUrl || "",
        category: item.category || "", boothLabel: item.boothLabel || "",
        status: item.status, displayPublicly: item.displayPublicly,
        contactName: item.contactName || "", contactEmail: item.contactEmail || "",
        contactPhone: item.contactPhone || "", description: item.description || "",
        notes: item.notes || "", presenceId: item.presenceId, sortOrder: item.sortOrder,
      });
    } else {
      setEditItem(null);
      setForm({ name: "", logoUrl: "", websiteUrl: "", category: "", boothLabel: "", status: "applied", displayPublicly: false, contactName: "", contactEmail: "", contactPhone: "", description: "", notes: "", presenceId: null, sortOrder: 0 });
    }
    setShowForm(true);
  };

  const filtered = useMemo(() => {
    let list = vendors || [];
    if (statusFilter !== "all") list = list.filter((v) => v.status === statusFilter);
    return list;
  }, [vendors, statusFilter]);

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-sm flex items-center gap-1" data-testid="text-vendors-title">
          <Store className="h-4 w-4 text-blue-500" /> Vendors ({vendors?.length || 0})
        </h3>
        <Button size="sm" onClick={() => openForm()} data-testid="button-add-vendor">
          <Plus className="h-3 w-3 mr-1" /> Add Vendor
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="select-vendor-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {VENDOR_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 && (
        <Card className="p-6 text-center">
          <Store className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground" data-testid="text-no-vendors">No vendors yet</p>
        </Card>
      )}

      {filtered.map((v) => (
        <Card key={v.id} className="p-3" data-testid={`card-vendor-${v.id}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-medium text-sm" data-testid={`text-vendor-name-${v.id}`}>{v.name}</span>
                <Badge className={`text-[10px] ${statusColors[v.status] || ""}`}>{v.status.replace(/_/g, " ")}</Badge>
                {v.category && <Badge variant="outline" className="text-[10px]">{v.category}</Badge>}
                {v.boothLabel && <Badge variant="outline" className="text-[10px]">Booth: {v.boothLabel}</Badge>}
                {v.displayPublicly && <Badge variant="outline" className="text-[10px]"><Eye className="h-3 w-3 mr-0.5" />Public</Badge>}
                {v.presenceId && <Badge variant="outline" className="text-[10px]"><LinkIcon className="h-3 w-3 mr-0.5" />Linked</Badge>}
              </div>
              {(v.contactName || v.contactEmail) && (
                <p className="text-xs text-muted-foreground">{[v.contactName, v.contactEmail].filter(Boolean).join(" · ")}</p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {v.status === "applied" && (
                <>
                  <Button size="sm" variant="ghost" className="h-7 text-green-600" onClick={() => statusMutation.mutate({ id: v.id, status: "approved" })} data-testid={`button-approve-vendor-${v.id}`}>
                    <CheckCircle className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-red-600" onClick={() => statusMutation.mutate({ id: v.id, status: "rejected" })} data-testid={`button-reject-vendor-${v.id}`}>
                    <XCircle className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
              <Button size="icon" variant="ghost" onClick={() => openForm(v)} data-testid={`button-edit-vendor-${v.id}`}>
                <Edit className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(v.id)} data-testid={`button-delete-vendor-${v.id}`}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </Card>
      ))}

      <Dialog open={showForm} onOpenChange={(o) => { if (!o) { setShowForm(false); setEditItem(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle data-testid="text-vendor-dialog-title">{editItem ? "Edit Vendor" : "Add Vendor"}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} data-testid="input-vendor-name" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Link to Presence</Label>
              {form.presenceId && (
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="secondary"><Building2 className="h-3 w-3 mr-1" />Linked</Badge>
                  <Button size="sm" variant="ghost" onClick={() => setForm((f) => ({ ...f, presenceId: null }))} data-testid="button-clear-vendor-presence">Clear</Button>
                </div>
              )}
              <PresenceSearch apiPrefix={apiPrefix} onSelect={(biz) => setForm((f) => ({ ...f, presenceId: biz.id, name: f.name || biz.name }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Food, Crafts, etc." data-testid="input-vendor-category" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Booth / Location</Label>
                <Input value={form.boothLabel} onChange={(e) => setForm((f) => ({ ...f, boothLabel: e.target.value }))} placeholder="A-12, Main Hall" data-testid="input-vendor-booth" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger data-testid="select-vendor-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VENDOR_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Logo URL</Label>
              <Input value={form.logoUrl} onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))} data-testid="input-vendor-logo" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Website URL</Label>
              <Input value={form.websiteUrl} onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))} data-testid="input-vendor-website" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Contact Name</Label>
                <Input value={form.contactName} onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))} data-testid="input-vendor-contact-name" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Contact Email</Label>
                <Input value={form.contactEmail} onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))} data-testid="input-vendor-contact-email" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Contact Phone</Label>
                <Input value={form.contactPhone} onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))} data-testid="input-vendor-contact-phone" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Sort Order</Label>
                <Input type="number" value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))} data-testid="input-vendor-sort" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} data-testid="input-vendor-description" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes (internal)</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} data-testid="input-vendor-notes" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.displayPublicly} onCheckedChange={(v) => setForm((f) => ({ ...f, displayPublicly: v }))} id="vendor-public" data-testid="switch-vendor-public" />
              <Label htmlFor="vendor-public" className="text-sm">Display publicly on event page</Label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setShowForm(false); setEditItem(null); }} data-testid="button-vendor-cancel">Cancel</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending} data-testid="button-vendor-save">
                {saveMutation.isPending ? "Saving..." : editItem ? "Update" : "Add Vendor"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
