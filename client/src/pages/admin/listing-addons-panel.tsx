import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Building2, MapPin, Plus, Loader2, Search, Globe, TrendingUp, DollarSign,
  Trash2, Edit, Check, X, Users, BarChart3
} from "lucide-react";
import { useState } from "react";

interface AddonReporting {
  totalLocations: number;
  multiLocationBusinesses: number;
  metroWideBusinesses: number;
  hubVisibilityAddons: number;
  activeSubscriptions: number;
  pendingSubscriptions: number;
  activeRevenueCents: number;
  pendingRevenueCents: number;
  enterpriseInquiriesOpen: number;
  enterpriseInquiriesTotal: number;
}

function formatCents(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

function BusinessSearchSection({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);

  const { data: searchResults, isLoading: searching } = useQuery<any[]>({
    queryKey: ["/api/admin/businesses", cityId, searchQuery],
    queryFn: async () => {
      if (searchQuery.length < 2) return [];
      const p = new URLSearchParams();
      p.set("search", searchQuery);
      if (cityId) p.set("cityId", cityId);
      const resp = await fetch(`/api/admin/businesses?${p}`, { credentials: "include" });
      if (!resp.ok) return [];
      return resp.json();
    },
    enabled: searchQuery.length >= 2,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSelectedBusinessId(null); }}
            placeholder="Search businesses by name..."
            className="pl-9"
            data-testid="input-addon-business-search"
          />
        </div>
        {searching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {searchResults && searchResults.length > 0 && !selectedBusinessId && (
        <Card className="divide-y max-h-60 overflow-y-auto">
          {searchResults.slice(0, 10).map((biz: any) => (
            <button
              key={biz.id}
              className="w-full text-left px-3 py-2 text-sm hover-elevate flex items-center justify-between gap-2"
              onClick={() => setSelectedBusinessId(biz.id)}
              data-testid={`button-select-biz-${biz.id}`}
            >
              <div className="min-w-0">
                <span className="font-medium block truncate">{biz.name}</span>
                <span className="text-muted-foreground text-xs">{biz.address}, {biz.city} {biz.zip}</span>
              </div>
              <Badge variant="outline" className="shrink-0">{biz.listingTier}</Badge>
            </button>
          ))}
        </Card>
      )}

      {selectedBusinessId && (
        <BusinessAddonDetail
          businessId={selectedBusinessId}
          onClear={() => setSelectedBusinessId(null)}
        />
      )}
    </div>
  );
}

function BusinessAddonDetail({ businessId, onClear }: { businessId: string; onClear: () => void }) {
  const { toast } = useToast();
  const [addLocationOpen, setAddLocationOpen] = useState(false);
  const [addCoverageOpen, setAddCoverageOpen] = useState(false);
  const [addSubOpen, setAddSubOpen] = useState(false);

  const { data: business } = useQuery<any>({
    queryKey: ["/api/admin/businesses", businessId, "detail"],
    queryFn: async () => {
      const resp = await fetch(`/api/admin/businesses`);
      if (!resp.ok) return null;
      const all = await resp.json();
      return all.find((b: any) => b.id === businessId) || null;
    },
  });

  const { data: locations, isLoading: locsLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/businesses", businessId, "locations"],
  });

  const { data: coverage, isLoading: covLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/businesses", businessId, "coverage"],
  });

  const { data: subscriptions, isLoading: subsLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/businesses", businessId, "addon-subscriptions"],
  });

  const deleteLocationMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/business-locations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses", businessId, "locations"] });
      toast({ title: "Location deactivated" });
    },
  });

  const deleteCoverageMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/business-coverage/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses", businessId, "coverage"] });
      toast({ title: "Coverage removed" });
    },
  });

  const updateSubMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/admin/addon-subscriptions/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses", businessId, "addon-subscriptions"] });
      toast({ title: "Subscription updated" });
    },
  });

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="font-semibold text-sm" data-testid="text-selected-business">{business?.name || "Loading..."}</h3>
          <p className="text-xs text-muted-foreground">{business?.address}, {business?.city} {business?.zip}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClear} data-testid="button-clear-selection">
          <X className="h-4 w-4 mr-1" /> Clear
        </Button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h4 className="text-sm font-medium flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> Locations ({locations?.length || 0}/5)
          </h4>
          <Button size="sm" variant="outline" onClick={() => setAddLocationOpen(true)} data-testid="button-add-location">
            <Plus className="h-3 w-3 mr-1" /> Add Location
          </Button>
        </div>
        {locsLoading && <Skeleton className="h-12 w-full" />}
        {locations && locations.length > 0 && (
          <div className="space-y-1.5">
            {locations.map((loc: any) => (
              <div key={loc.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                <div className="min-w-0">
                  <span className="text-xs font-medium">{loc.label || "Location"}</span>
                  <span className="text-[11px] text-muted-foreground block">{loc.street}, {loc.city} {loc.zip}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {loc.isPrimary && <Badge variant="secondary">Primary</Badge>}
                  <Badge variant={loc.status === "ACTIVE" ? "default" : "secondary"}>{loc.status}</Badge>
                  {loc.status === "ACTIVE" && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteLocationMutation.mutate(loc.id)}
                      disabled={deleteLocationMutation.isPending}
                      data-testid={`button-deactivate-loc-${loc.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3 border-t pt-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h4 className="text-sm font-medium flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5" /> Coverage ({coverage?.length || 0})
          </h4>
          <Button size="sm" variant="outline" onClick={() => setAddCoverageOpen(true)} data-testid="button-add-coverage">
            <Plus className="h-3 w-3 mr-1" /> Add Coverage
          </Button>
        </div>
        {covLoading && <Skeleton className="h-12 w-full" />}
        {coverage && coverage.length > 0 && (
          <div className="space-y-1.5">
            {coverage.map((cov: any) => (
              <div key={cov.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                <div className="min-w-0">
                  <span className="text-xs font-medium">{cov.coverageType}</span>
                  <span className="text-[11px] text-muted-foreground block">Target: {cov.targetId}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {cov.isAddon && <Badge variant="secondary">Add-on</Badge>}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteCoverageMutation.mutate(cov.id)}
                    disabled={deleteCoverageMutation.isPending}
                    data-testid={`button-remove-cov-${cov.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3 border-t pt-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h4 className="text-sm font-medium flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5" /> Subscriptions ({subscriptions?.length || 0})
          </h4>
          <Button size="sm" variant="outline" onClick={() => setAddSubOpen(true)} data-testid="button-add-subscription">
            <Plus className="h-3 w-3 mr-1" /> Add Subscription
          </Button>
        </div>
        {subsLoading && <Skeleton className="h-12 w-full" />}
        {subscriptions && subscriptions.length > 0 && (
          <div className="space-y-1.5">
            {subscriptions.map((sub: any) => (
              <div key={sub.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                <div className="min-w-0">
                  <span className="text-xs font-medium">{sub.addonType}</span>
                  <span className="text-[11px] text-muted-foreground block">
                    {formatCents(sub.unitPriceCents)} x {sub.quantity} / {sub.term}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge variant={sub.status === "ACTIVE" ? "default" : sub.status === "PENDING_PAYMENT" ? "secondary" : "outline"}>
                    {sub.status}
                  </Badge>
                  {sub.status === "PENDING_PAYMENT" && (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => updateSubMutation.mutate({ id: sub.id, status: "ACTIVE" })}
                      disabled={updateSubMutation.isPending}
                      data-testid={`button-activate-sub-${sub.id}`}
                    >
                      <Check className="h-3 w-3 mr-1" /> Activate
                    </Button>
                  )}
                  {sub.status === "ACTIVE" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateSubMutation.mutate({ id: sub.id, status: "CANCELED" })}
                      disabled={updateSubMutation.isPending}
                      data-testid={`button-cancel-sub-${sub.id}`}
                    >
                      <X className="h-3 w-3 mr-1" /> Cancel
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AddLocationDialog
        businessId={businessId}
        open={addLocationOpen}
        onOpenChange={setAddLocationOpen}
      />
      <AddCoverageDialog
        businessId={businessId}
        open={addCoverageOpen}
        onOpenChange={setAddCoverageOpen}
      />
      <AddSubscriptionDialog
        businessId={businessId}
        open={addSubOpen}
        onOpenChange={setAddSubOpen}
      />
    </Card>
  );
}

function AddLocationDialog({ businessId, open, onOpenChange }: { businessId: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [label, setLabel] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");

  const addMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/admin/businesses/${businessId}/locations`, {
        label, street, city, state, zip, isPrimary: false, status: "ACTIVE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses", businessId, "locations"] });
      toast({ title: "Location added" });
      onOpenChange(false);
      setLabel(""); setStreet(""); setCity(""); setState(""); setZip("");
    },
    onError: (err: any) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Location</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. South End Branch" data-testid="input-loc-label" />
          </div>
          <div>
            <Label>Street</Label>
            <Input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="123 Main St" data-testid="input-loc-street" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>City</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} data-testid="input-loc-city" />
            </div>
            <div>
              <Label>State</Label>
              <Input value={state} onChange={(e) => setState(e.target.value)} data-testid="input-loc-state" />
            </div>
            <div>
              <Label>ZIP</Label>
              <Input value={zip} onChange={(e) => setZip(e.target.value)} data-testid="input-loc-zip" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-add-loc">Cancel</Button>
          <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending} data-testid="button-save-loc">
            {addMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
            Add Location
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddCoverageDialog({ businessId, open, onOpenChange }: { businessId: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [coverageType, setCoverageType] = useState("HUB");
  const [targetId, setTargetId] = useState("");

  const { data: hubs } = useQuery<any[]>({
    queryKey: ["/api/admin/regions"],
    queryFn: async () => {
      const resp = await fetch("/api/admin/regions");
      if (!resp.ok) return [];
      return resp.json();
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/admin/businesses/${businessId}/coverage`, { coverageType, targetId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses", businessId, "coverage"] });
      toast({ title: "Coverage added" });
      onOpenChange(false);
      setTargetId("");
    },
    onError: (err: any) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Coverage</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Coverage Type</Label>
            <Select value={coverageType} onValueChange={setCoverageType}>
              <SelectTrigger data-testid="select-coverage-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HUB">Hub Visibility</SelectItem>
                <SelectItem value="ZONE">Service Area Hub</SelectItem>
                <SelectItem value="REGION">Metro-Wide (Region)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Target Hub/Region</Label>
            {hubs && hubs.length > 0 ? (
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger data-testid="select-coverage-target">
                  <SelectValue placeholder="Select hub or region..." />
                </SelectTrigger>
                <SelectContent>
                  {hubs.map((h: any) => (
                    <SelectItem key={h.id} value={h.id}>{h.name} ({h.type})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input value={targetId} onChange={(e) => setTargetId(e.target.value)} placeholder="Region/Hub ID" data-testid="input-coverage-target" />
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-add-cov">Cancel</Button>
          <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending || !targetId} data-testid="button-save-cov">
            {addMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
            Add Coverage
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddSubscriptionDialog({ businessId, open, onOpenChange }: { businessId: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [addonType, setAddonType] = useState("PHYSICAL_LOCATION");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");

  const addMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/admin/businesses/${businessId}/addon-subscriptions`, {
        addonType, quantity: parseInt(quantity) || 1, notesInternal: notes || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses", businessId, "addon-subscriptions"] });
      toast({ title: "Subscription created (pending payment)" });
      onOpenChange(false);
      setNotes("");
    },
    onError: (err: any) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  const pricing: Record<string, number> = {
    PHYSICAL_LOCATION: 9900,
    EXTRA_HUB_VISIBILITY: 5000,
    SERVICE_AREA_HUB: 5000,
    METRO_WIDE: 250000,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Add-On Subscription</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Add-On Type</Label>
            <Select value={addonType} onValueChange={setAddonType}>
              <SelectTrigger data-testid="select-addon-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PHYSICAL_LOCATION">Physical Location ($99/yr)</SelectItem>
                <SelectItem value="EXTRA_HUB_VISIBILITY">Extra Hub Visibility ($50/yr)</SelectItem>
                <SelectItem value="SERVICE_AREA_HUB">Service Area Hub ($50/yr)</SelectItem>
                <SelectItem value="METRO_WIDE">Metro-Wide ($2,500/yr)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Quantity</Label>
            <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} data-testid="input-addon-quantity" />
          </div>
          <div className="rounded-md border bg-muted/30 px-3 py-2">
            <span className="text-xs text-muted-foreground">Total: </span>
            <span className="text-sm font-semibold" data-testid="text-addon-total">
              {formatCents((pricing[addonType] || 0) * (parseInt(quantity) || 1))}
            </span>
            <span className="text-xs text-muted-foreground"> / year</span>
          </div>
          <div>
            <Label>Internal Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional internal notes..." data-testid="input-addon-notes" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-add-sub">Cancel</Button>
          <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending} data-testid="button-save-sub">
            {addMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
            Create Subscription
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EnterpriseInquiriesSection({ cityId }: { cityId?: string }) {
  const { toast } = useToast();

  const { data: inquiries, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/enterprise-inquiries", cityId],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (cityId) p.set("cityId", cityId);
      const res = await fetch(`/api/admin/enterprise-inquiries?${p}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/admin/enterprise-inquiries/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/enterprise-inquiries"] });
      toast({ title: "Inquiry updated" });
    },
  });

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  return (
    <div className="space-y-3">
      {(!inquiries || inquiries.length === 0) && (
        <p className="text-sm text-muted-foreground text-center py-6" data-testid="text-no-inquiries">No enterprise inquiries yet.</p>
      )}
      {inquiries && inquiries.map((inq: any) => (
        <Card key={inq.id} className="p-3 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <Badge variant={inq.status === "NEW" ? "default" : "secondary"} data-testid={`badge-inquiry-status-${inq.id}`}>{inq.status}</Badge>
              <span className="text-xs ml-2">{inq.inquiryType}</span>
            </div>
            <span className="text-[11px] text-muted-foreground">{new Date(inq.createdAt).toLocaleDateString()}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {inq.locationsCount && <span>Locations: {inq.locationsCount}</span>}
            {inq.notes && <p className="mt-1">{inq.notes}</p>}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {inq.status === "NEW" && (
              <Button size="sm" variant="outline" onClick={() => updateMutation.mutate({ id: inq.id, status: "CONTACTED" })} disabled={updateMutation.isPending} data-testid={`button-contact-inquiry-${inq.id}`}>
                Mark Contacted
              </Button>
            )}
            {inq.status === "CONTACTED" && (
              <Button size="sm" variant="outline" onClick={() => updateMutation.mutate({ id: inq.id, status: "PROPOSAL_SENT" })} disabled={updateMutation.isPending} data-testid={`button-proposal-inquiry-${inq.id}`}>
                Proposal Sent
              </Button>
            )}
            {(inq.status === "PROPOSAL_SENT" || inq.status === "CONTACTED") && (
              <>
                <Button size="sm" variant="default" onClick={() => updateMutation.mutate({ id: inq.id, status: "WON" })} disabled={updateMutation.isPending} data-testid={`button-won-inquiry-${inq.id}`}>
                  Won
                </Button>
                <Button size="sm" variant="ghost" onClick={() => updateMutation.mutate({ id: inq.id, status: "LOST" })} disabled={updateMutation.isPending} data-testid={`button-lost-inquiry-${inq.id}`}>
                  Lost
                </Button>
              </>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

function BulkRegionalOverrideSection({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [selectedTier, setSelectedTier] = useState("ENHANCED");
  const [zoneId, setZoneId] = useState("");
  const [overrideCityId, setOverrideCityId] = useState(cityId || "");
  const [note, setNote] = useState("");

  const { data: zones } = useQuery<{ id: string; name: string; slug: string }[]>({
    queryKey: ["/api/admin/zones"],
  });

  const bulkMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, string> = { tier: selectedTier };
      if (zoneId && zoneId !== "__all__") body.zoneId = zoneId;
      if (overrideCityId) body.cityId = overrideCityId;
      if (note) body.note = note;
      const res = await apiRequest("POST", "/api/admin/businesses/bulk-override-tier", body);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Bulk Override Complete", description: `Updated ${data.updatedCount} businesses to ${data.newTier}` });
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/listing-addon-reporting"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const tiers = ["FREE", "VERIFIED", "PREMIUM", "CHARTER", "ENHANCED", "NONPROFIT", "ORGANIZATION", "HEALTHCARE_PROVIDER"];

  return (
    <Card className="p-4 space-y-4">
      <h3 className="font-semibold flex items-center gap-2" data-testid="heading-bulk-override">
        <Globe className="h-4 w-4" /> Regional Bulk Tier Override
      </h3>
      <p className="text-sm text-muted-foreground">
        Apply a tier override to all businesses in a zone or city. This updates both listing tier and entitlements.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label data-testid="label-tier">Target Tier</Label>
          <Select value={selectedTier} onValueChange={setSelectedTier}>
            <SelectTrigger data-testid="select-bulk-tier">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {tiers.map((t) => (
                <SelectItem key={t} value={t} data-testid={`option-tier-${t}`}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label data-testid="label-zone">Zone (optional)</Label>
          <Select value={zoneId} onValueChange={setZoneId}>
            <SelectTrigger data-testid="select-zone">
              <SelectValue placeholder="All zones" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__" data-testid="option-zone-all">All zones</SelectItem>
              {zones?.map((z) => (
                <SelectItem key={z.id} value={z.id} data-testid={`option-zone-${z.id}`}>{z.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label data-testid="label-note">Note</Label>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Reason for bulk override..."
          rows={2}
          data-testid="input-bulk-note"
        />
      </div>

      <Button
        onClick={() => bulkMutation.mutate()}
        disabled={bulkMutation.isPending || (!zoneId && !overrideCityId)}
        data-testid="button-apply-bulk-override"
      >
        {bulkMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Apply Bulk Override
      </Button>
    </Card>
  );
}

function ReportingSection({ cityId }: { cityId?: string }) {
  const { data: report, isLoading } = useQuery<AddonReporting>({
    queryKey: ["/api/admin/listing-addon-reporting", cityId],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (cityId) p.set("cityId", cityId);
      const res = await fetch(`/api/admin/listing-addon-reporting?${p}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (!report) return <p className="text-sm text-muted-foreground">No data available.</p>;

  const stats = [
    { label: "Total Locations", value: report.totalLocations, icon: MapPin },
    { label: "Multi-Location Businesses", value: report.multiLocationBusinesses, icon: Building2 },
    { label: "Metro-Wide Businesses", value: report.metroWideBusinesses, icon: Globe },
    { label: "Hub Visibility Add-ons", value: report.hubVisibilityAddons, icon: TrendingUp },
    { label: "Active Subscriptions", value: report.activeSubscriptions, icon: Check },
    { label: "Pending Subscriptions", value: report.pendingSubscriptions, icon: Loader2 },
    { label: "Active Revenue", value: formatCents(report.activeRevenueCents), icon: DollarSign },
    { label: "Pending Revenue", value: formatCents(report.pendingRevenueCents), icon: DollarSign },
    { label: "Open Enterprise Inquiries", value: `${report.enterpriseInquiriesOpen} / ${report.enterpriseInquiriesTotal}`, icon: Users },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {stats.map((stat) => (
        <Card key={stat.label} className="p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <stat.icon className="h-3.5 w-3.5" />
            <span className="text-xs">{stat.label}</span>
          </div>
          <p className="text-lg font-semibold" data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, "-")}`}>{stat.value}</p>
        </Card>
      ))}
    </div>
  );
}

export default function ListingAddonsPanel({ cityId }: { cityId?: string }) {
  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2" data-testid="heading-listing-addons">
          <BarChart3 className="h-5 w-5" /> Listing Add-Ons
        </h2>
        <p className="text-sm text-muted-foreground">Manage multi-location, hub visibility, service-area, and metro-wide add-ons.</p>
      </div>

      <Tabs defaultValue="manage" className="w-full">
        <TabsList data-testid="tabs-addons">
          <TabsTrigger value="manage" data-testid="tab-manage">Manage</TabsTrigger>
          <TabsTrigger value="bulk" data-testid="tab-bulk">Regional Bulk</TabsTrigger>
          <TabsTrigger value="inquiries" data-testid="tab-inquiries">Enterprise Inquiries</TabsTrigger>
          <TabsTrigger value="reporting" data-testid="tab-reporting">Reporting</TabsTrigger>
        </TabsList>

        <TabsContent value="manage" className="mt-4">
          <BusinessSearchSection cityId={cityId} />
        </TabsContent>

        <TabsContent value="bulk" className="mt-4">
          <BulkRegionalOverrideSection cityId={cityId} />
        </TabsContent>

        <TabsContent value="inquiries" className="mt-4">
          <EnterpriseInquiriesSection cityId={cityId} />
        </TabsContent>

        <TabsContent value="reporting" className="mt-4">
          <ReportingSection cityId={cityId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
