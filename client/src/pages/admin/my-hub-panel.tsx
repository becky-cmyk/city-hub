import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Building2, ChevronDown, ChevronRight, Plus, Pencil, Trash2,
  MapPin, Users, LayoutList, Eye, ArrowLeft, Hash, Map
} from "lucide-react";

interface HubOperator {
  operatorId: string;
  operatorName: string;
  operatorEmail: string;
  operatorType: string;
  operatorStatus: string;
  pipelineStage: string;
  exclusivity: string;
}

interface Hub {
  id: string;
  type: "METRO" | "MICRO";
  parentTerritoryId: string | null;
  cityId: string | null;
  code: string;
  name: string;
  status: "ACTIVE" | "SUSPENDED" | "REVOKED";
  geoType: string;
  geoCodes: string[];
  siteUrl: string | null;
  emailDomain: string | null;
  operators: HubOperator[];
  listingCount: number;
  microHubs?: Hub[];
}

interface MyHubData {
  id: string;
  name: string;
  slug: string;
  cityCode: string | null;
  isActive: boolean;
  brandName: string | null;
  primaryColor: string | null;
  siteUrl: string | null;
  emailDomain: string | null;
  territories: (Hub & { microHubs: Hub[] })[];
  orphanMicros: Hub[];
  zoneSummary: Record<string, number>;
  totalZones: number;
  metroCount: number;
  microCount: number;
}

interface Zone {
  id: string;
  cityId: string;
  name: string;
  slug: string;
  type: string;
  county: string | null;
  stateCode: string | null;
  zipCodes: string[];
  parentZoneId: string | null;
}

const statusColors: Record<string, string> = {
  ACTIVE: "bg-green-500/20 text-green-400 border-green-500/30",
  SUSPENDED: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  REVOKED: "bg-red-500/20 text-red-400 border-red-500/30",
};

const zoneTypeLabels: Record<string, string> = {
  DISTRICT: "Districts",
  NEIGHBORHOOD: "Neighborhoods",
  ZIP: "ZIP Codes",
  COUNTY: "Counties",
  MICRO_HUB: "Micro Hubs",
};

const defaultTerritoryForm = {
  name: "", code: "", type: "METRO" as "METRO" | "MICRO",
  parentTerritoryId: "", cityId: "", geoType: "ZIP",
  geoCodes: "", status: "ACTIVE", siteUrl: "", emailDomain: "",
};

const defaultZoneForm = {
  name: "", slug: "", type: "DISTRICT", county: "", stateCode: "", zipCodes: "",
};

export function MyHubPanel({ selectedCityId }: { selectedCityId?: string }) {
  const { toast } = useToast();
  const [expandedMetros, setExpandedMetros] = useState<Set<string>>(new Set());

  const [showTerritoryDialog, setShowTerritoryDialog] = useState(false);
  const [editingTerritory, setEditingTerritory] = useState<Hub | null>(null);
  const [territoryForm, setTerritoryForm] = useState(defaultTerritoryForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<"territory" | "zone">("territory");

  const [showZoneDialog, setShowZoneDialog] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [zoneForm, setZoneForm] = useState(defaultZoneForm);

  const [showBulkZipDialog, setShowBulkZipDialog] = useState(false);
  const [bulkZips, setBulkZips] = useState("");

  const [zoneViewActive, setZoneViewActive] = useState(false);
  const [zoneTypeFilter, setZoneTypeFilter] = useState<string>("all");

  const queryUrl = selectedCityId
    ? `/api/admin/my-hub?cityId=${selectedCityId}`
    : "/api/admin/my-hub";

  const { data: hub, isLoading } = useQuery<MyHubData | null>({
    queryKey: ["/api/admin/my-hub", selectedCityId],
    queryFn: () => fetch(queryUrl, { credentials: "include" }).then(r => r.json()),
  });

  const { data: cityZones, isLoading: zonesLoading } = useQuery<Zone[]>({
    queryKey: ["/api/admin/hub-management", "zones", hub?.id, zoneTypeFilter],
    queryFn: () => {
      const url = zoneTypeFilter !== "all"
        ? `/api/admin/hub-management/city/${hub!.id}/zones?type=${zoneTypeFilter}`
        : `/api/admin/hub-management/city/${hub!.id}/zones`;
      return fetch(url, { credentials: "include" }).then(r => r.json());
    },
    enabled: !!hub?.id && zoneViewActive,
  });

  const createTerritoryMutation = useMutation({
    mutationFn: (payload: any) => apiRequest("POST", "/api/admin/territories", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/my-hub"] });
      setShowTerritoryDialog(false);
      setTerritoryForm(defaultTerritoryForm);
      toast({ title: "Territory created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateTerritoryMutation = useMutation({
    mutationFn: ({ id, ...payload }: any) => apiRequest("PATCH", `/api/admin/hub-management/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/my-hub"] });
      setShowTerritoryDialog(false);
      setEditingTerritory(null);
      setTerritoryForm(defaultTerritoryForm);
      toast({ title: "Territory updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteTerritoryMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/hub-management/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/my-hub"] });
      setDeleteId(null);
      toast({ title: "Territory deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createZoneMutation = useMutation({
    mutationFn: (payload: any) => apiRequest("POST", `/api/admin/hub-management/city/${hub!.id}/zones`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/my-hub"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hub-management", "zones"] });
      setShowZoneDialog(false);
      setEditingZone(null);
      setZoneForm(defaultZoneForm);
      toast({ title: "Zone created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateZoneMutation = useMutation({
    mutationFn: ({ id, ...payload }: any) => apiRequest("PATCH", `/api/admin/hub-management/zones/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/my-hub"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hub-management", "zones"] });
      setShowZoneDialog(false);
      setEditingZone(null);
      setZoneForm(defaultZoneForm);
      toast({ title: "Zone updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteZoneMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/hub-management/zones/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/my-hub"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hub-management", "zones"] });
      setDeleteId(null);
      toast({ title: "Zone deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const bulkZipMutation = useMutation({
    mutationFn: (zips: string) => apiRequest("POST", `/api/admin/hub-management/city/${hub!.id}/zones/bulk-zip`, { zips }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/my-hub"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hub-management", "zones"] });
      setShowBulkZipDialog(false);
      setBulkZips("");
      toast({ title: "ZIP codes imported" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleMetro = (id: string) => {
    setExpandedMetros(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openCreateTerritory = () => {
    setEditingTerritory(null);
    setTerritoryForm({ ...defaultTerritoryForm, cityId: hub?.id || "" });
    setShowTerritoryDialog(true);
  };

  const openEditTerritory = (t: Hub) => {
    setEditingTerritory(t);
    setTerritoryForm({
      name: t.name, code: t.code, type: t.type,
      parentTerritoryId: t.parentTerritoryId || "",
      cityId: t.cityId || "", geoType: t.geoType || "ZIP",
      geoCodes: Array.isArray(t.geoCodes) ? t.geoCodes.join(", ") : "",
      status: t.status, siteUrl: t.siteUrl || "", emailDomain: t.emailDomain || "",
    });
    setShowTerritoryDialog(true);
  };

  const handleSaveTerritory = () => {
    const payload: any = {
      name: territoryForm.name, code: territoryForm.code, type: territoryForm.type,
      status: territoryForm.status, geoType: territoryForm.geoType,
      geoCodes: territoryForm.geoCodes.split(",").map(s => s.trim()).filter(Boolean),
      cityId: territoryForm.cityId || hub?.id || null,
      siteUrl: territoryForm.siteUrl || null, emailDomain: territoryForm.emailDomain || null,
    };
    if (territoryForm.type === "MICRO" && territoryForm.parentTerritoryId) {
      payload.parentTerritoryId = territoryForm.parentTerritoryId;
    }
    if (editingTerritory) {
      updateTerritoryMutation.mutate({ id: editingTerritory.id, ...payload });
    } else {
      createTerritoryMutation.mutate(payload);
    }
  };

  const openCreateZone = () => {
    setEditingZone(null);
    setZoneForm(defaultZoneForm);
    setShowZoneDialog(true);
  };

  const openEditZone = (zone: Zone) => {
    setEditingZone(zone);
    setZoneForm({
      name: zone.name, slug: zone.slug, type: zone.type,
      county: zone.county || "", stateCode: zone.stateCode || "",
      zipCodes: (zone.zipCodes || []).join(", "),
    });
    setShowZoneDialog(true);
  };

  const handleSaveZone = () => {
    const payload: any = {
      name: zoneForm.name,
      slug: zoneForm.slug || zoneForm.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
      type: zoneForm.type,
      county: zoneForm.county || null,
      stateCode: zoneForm.stateCode || null,
      zipCodes: zoneForm.zipCodes.split(",").map(s => s.trim()).filter(Boolean),
    };
    if (editingZone) {
      updateZoneMutation.mutate({ id: editingZone.id, ...payload });
    } else {
      createZoneMutation.mutate(payload);
    }
  };

  const allMetros = hub?.territories || [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card className="animate-pulse"><CardContent className="h-20 p-6" /></Card>
        <Card className="animate-pulse"><CardContent className="h-40 p-6" /></Card>
      </div>
    );
  }

  if (!hub) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Hub Assigned</h3>
          <p className="text-muted-foreground">You haven't been assigned to a city hub yet. Contact your administrator.</p>
        </CardContent>
      </Card>
    );
  }

  if (zoneViewActive) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => { setZoneViewActive(false); setZoneTypeFilter("all"); }} className="gap-1" data-testid="button-zones-back">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <h2 className="text-xl font-bold">{hub.name} — Zones</h2>
            <Badge variant="outline">{(cityZones || []).length} zones</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Select value={zoneTypeFilter} onValueChange={setZoneTypeFilter}>
              <SelectTrigger className="w-[150px] h-8" data-testid="select-zone-filter">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="DISTRICT">Districts</SelectItem>
                <SelectItem value="NEIGHBORHOOD">Neighborhoods</SelectItem>
                <SelectItem value="ZIP">ZIP Codes</SelectItem>
                <SelectItem value="COUNTY">Counties</SelectItem>
                <SelectItem value="MICRO_HUB">Micro Hubs</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => setShowBulkZipDialog(true)} data-testid="button-bulk-zip-my-hub">
              <Hash className="h-3.5 w-3.5 mr-1" /> Import ZIPs
            </Button>
            <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={openCreateZone} data-testid="button-add-zone-my-hub">
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Zone
            </Button>
          </div>
        </div>

        {zonesLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Card key={i} className="animate-pulse"><CardContent className="h-12 p-4" /></Card>)}
          </div>
        ) : (cityZones || []).length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">No zones match the filter</CardContent></Card>
        ) : (
          <div className="border border-border/50 rounded-lg overflow-x-auto">
            <div className="min-w-[600px]">
              <div className="grid grid-cols-[1fr_90px_110px_60px_140px_70px] gap-2 px-4 py-2 bg-accent/30 text-xs font-medium text-muted-foreground border-b border-border/50">
                <span>Name</span><span>Type</span><span>County</span><span>State</span><span>ZIP Codes</span><span></span>
              </div>
              {(cityZones || []).map(zone => (
                <div key={zone.id} className="grid grid-cols-[1fr_90px_110px_60px_140px_70px] gap-2 px-4 py-2.5 border-b border-border/30 last:border-b-0 hover:bg-accent/20 items-center" data-testid={`row-zone-${zone.id}`}>
                  <span className="text-sm font-medium truncate">{zone.name}</span>
                  <Badge variant="outline" className="text-[10px] w-fit">{zone.type}</Badge>
                  <span className="text-xs text-muted-foreground truncate">{zone.county || "—"}</span>
                  <span className="text-xs text-muted-foreground">{zone.stateCode || "—"}</span>
                  <span className="text-xs text-muted-foreground truncate">{(zone.zipCodes || []).join(", ") || "—"}</span>
                  <div className="flex items-center gap-0.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditZone(zone)} data-testid={`button-edit-zone-${zone.id}`}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { setDeleteId(zone.id); setDeleteType("zone"); }} data-testid={`button-delete-zone-${zone.id}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {renderZoneDialog()}
        {renderBulkZipDialog()}
        {renderDeleteDialog()}
      </div>
    );
  }

  function renderZoneDialog() {
    return (
      <Dialog open={showZoneDialog} onOpenChange={setShowZoneDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingZone ? "Edit Zone" : "Add Zone"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Name</Label><Input value={zoneForm.name} onChange={e => setZoneForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Uptown" data-testid="input-zone-name" /></div>
              <div><Label>Slug</Label><Input value={zoneForm.slug} onChange={e => setZoneForm(f => ({ ...f, slug: e.target.value }))} placeholder="Auto from name" data-testid="input-zone-slug" /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Type</Label>
                <Select value={zoneForm.type} onValueChange={v => setZoneForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger data-testid="select-zone-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DISTRICT">District</SelectItem>
                    <SelectItem value="NEIGHBORHOOD">Neighborhood</SelectItem>
                    <SelectItem value="ZIP">ZIP Code</SelectItem>
                    <SelectItem value="COUNTY">County</SelectItem>
                    <SelectItem value="MICRO_HUB">Micro Hub</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>County</Label><Input value={zoneForm.county} onChange={e => setZoneForm(f => ({ ...f, county: e.target.value }))} placeholder="Mecklenburg" data-testid="input-zone-county" /></div>
              <div><Label>State</Label><Input value={zoneForm.stateCode} onChange={e => setZoneForm(f => ({ ...f, stateCode: e.target.value }))} placeholder="NC" maxLength={2} data-testid="input-zone-state" /></div>
            </div>
            <div>
              <Label>ZIP Codes</Label>
              <Input value={zoneForm.zipCodes} onChange={e => setZoneForm(f => ({ ...f, zipCodes: e.target.value }))} placeholder="28202, 28203" data-testid="input-zone-zipcodes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowZoneDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveZone} disabled={!zoneForm.name || createZoneMutation.isPending || updateZoneMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700" data-testid="button-save-zone">
              {createZoneMutation.isPending || updateZoneMutation.isPending ? "Saving..." : editingZone ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  function renderBulkZipDialog() {
    return (
      <Dialog open={showBulkZipDialog} onOpenChange={setShowBulkZipDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import ZIP Codes</DialogTitle>
            <DialogDescription>Paste comma-separated ZIP codes. A zone will be created for each.</DialogDescription>
          </DialogHeader>
          <Textarea value={bulkZips} onChange={e => setBulkZips(e.target.value)}
            placeholder="28201, 28202, 28203, 28204..." className="h-32" data-testid="input-bulk-zips" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkZipDialog(false)}>Cancel</Button>
            <Button onClick={() => bulkZipMutation.mutate(bulkZips)}
              disabled={!bulkZips.trim() || bulkZipMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700" data-testid="button-import-zips">
              {bulkZipMutation.isPending ? "Importing..." : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  function renderDeleteDialog() {
    return (
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete {deleteType === "territory" ? "Territory" : "Zone"}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => {
              if (!deleteId) return;
              if (deleteType === "territory") deleteTerritoryMutation.mutate(deleteId);
              else deleteZoneMutation.mutate(deleteId);
            }} disabled={deleteTerritoryMutation.isPending || deleteZoneMutation.isPending}
              data-testid="button-confirm-delete">
              {deleteTerritoryMutation.isPending || deleteZoneMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0"
          style={{ backgroundColor: hub.primaryColor || "#2563eb" }}>
          {hub.cityCode || (hub.name || "HUB").substring(0, 3).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-2xl font-bold" data-testid="text-my-hub-title">My {hub.cityCode || (hub.name || "HUB").substring(0, 3).toUpperCase()} Hub</h2>
            <Badge className={`text-xs border ${hub.isActive ? statusColors.ACTIVE : statusColors.SUSPENDED}`}>
              {hub.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {hub.brandName || hub.name} · {hub.metroCount} metro{hub.metroCount !== 1 ? "s" : ""}, {hub.microCount} micro{hub.microCount !== 1 ? "s" : ""} · {hub.totalZones} zones
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2" data-testid="text-territories-heading">
            <Building2 className="h-5 w-5 text-amber-400" /> Territories
          </h3>
          <Button size="sm" variant="outline" onClick={openCreateTerritory} data-testid="button-add-territory">
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Territory
          </Button>
        </div>

        {(!hub.territories || hub.territories.length === 0) ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No territories yet. Click "Add Territory" to create your first metro hub.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {hub.territories.map(metro => (
              <Card key={metro.id} className="border-border/50 overflow-hidden" data-testid={`card-territory-${metro.id}`}>
                <div className="flex items-center gap-2 p-3 hover:bg-accent/30 cursor-pointer"
                  onClick={() => toggleMetro(metro.id)} data-testid={`button-expand-metro-${metro.id}`}>
                  {metro.microHubs && metro.microHubs.length > 0 ? (
                    expandedMetros.has(metro.id)
                      ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : <div className="w-4 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{metro.name}</span>
                      <Badge variant="outline" className="text-[10px] font-mono">{metro.code}</Badge>
                      <Badge className={`text-[10px] border ${statusColors[metro.status]}`}>{metro.status}</Badge>
                      <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-400 border-purple-500/30">METRO</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{Array.isArray(metro.geoCodes) ? `${metro.geoCodes.length} ${metro.geoType}s` : "No coverage"}</span>
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{metro.operators.length > 0 ? metro.operators[0].operatorName : "No operator"}</span>
                      <span className="flex items-center gap-1"><LayoutList className="h-3 w-3" />{metro.listingCount} listings</span>
                      {metro.microHubs && metro.microHubs.length > 0 && <span className="text-amber-400">{metro.microHubs.length} micro{metro.microHubs.length !== 1 ? "s" : ""}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditTerritory(metro)} data-testid={`button-edit-territory-${metro.id}`}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { setDeleteId(metro.id); setDeleteType("territory"); }} data-testid={`button-delete-territory-${metro.id}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                {expandedMetros.has(metro.id) && metro.microHubs && metro.microHubs.length > 0 && (
                  <div className="border-t border-border/30">
                    {metro.microHubs.map(micro => (
                      <div key={micro.id} className="flex items-center gap-2 pl-10 pr-3 py-2 hover:bg-accent/20 border-b border-border/20 last:border-b-0">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm">{micro.name}</span>
                            <Badge variant="outline" className="text-[9px] font-mono">{micro.code}</Badge>
                            <Badge className={`text-[9px] border ${statusColors[micro.status]}`}>{micro.status}</Badge>
                            <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-400 border-amber-500/30">MICRO</Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditTerritory(micro)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { setDeleteId(micro.id); setDeleteType("territory"); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2" data-testid="text-zones-heading">
            <Map className="h-5 w-5 text-amber-400" /> Zones
          </h3>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowBulkZipDialog(true)} data-testid="button-bulk-zip">
              <Hash className="h-3.5 w-3.5 mr-1" /> Import ZIPs
            </Button>
            <Button size="sm" variant="outline" onClick={openCreateZone} data-testid="button-add-zone">
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Zone
            </Button>
            <Button size="sm" variant="outline" onClick={() => setZoneViewActive(true)} data-testid="button-view-all-zones">
              <Eye className="h-3.5 w-3.5 mr-1" /> View All
            </Button>
          </div>
        </div>

        {hub.totalZones === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No zones yet — import ZIP codes or add zones manually.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(hub.zoneSummary || {}).map(([type, cnt]) => (
              <Card key={type}
                className="cursor-pointer hover:bg-accent/30 transition-colors border-border/50"
                onClick={() => { setZoneViewActive(true); setZoneTypeFilter(type); }}
                data-testid={`button-zone-type-${type}`}
              >
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold">{cnt}</div>
                  <div className="text-xs text-muted-foreground">{zoneTypeLabels[type] || type}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showTerritoryDialog} onOpenChange={setShowTerritoryDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTerritory ? "Edit Territory" : "Create Territory"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Name</Label><Input value={territoryForm.name} onChange={e => setTerritoryForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Charlotte Metro" data-testid="input-territory-name" /></div>
              <div><Label>Code</Label><Input value={territoryForm.code} onChange={e => setTerritoryForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. CLT-METRO" data-testid="input-territory-code" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type</Label>
                <Select value={territoryForm.type} onValueChange={(v: "METRO" | "MICRO") => setTerritoryForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger data-testid="select-territory-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="METRO">Metro</SelectItem>
                    <SelectItem value="MICRO">Micro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={territoryForm.status} onValueChange={v => setTerritoryForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger data-testid="select-territory-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="SUSPENDED">Suspended</SelectItem>
                    <SelectItem value="REVOKED">Revoked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {territoryForm.type === "MICRO" && (
              <div>
                <Label>Parent Metro</Label>
                <Select value={territoryForm.parentTerritoryId} onValueChange={v => setTerritoryForm(f => ({ ...f, parentTerritoryId: v }))}>
                  <SelectTrigger data-testid="select-territory-parent"><SelectValue placeholder="Select parent..." /></SelectTrigger>
                  <SelectContent>
                    {allMetros.map(m => <SelectItem key={m.id} value={m.id}>{m.name} ({m.code})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Geo Type</Label>
                <Select value={territoryForm.geoType} onValueChange={v => setTerritoryForm(f => ({ ...f, geoType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ZIP">ZIP Code</SelectItem>
                    <SelectItem value="NEIGHBORHOOD">Neighborhood</SelectItem>
                    <SelectItem value="TOWN">Town</SelectItem>
                    <SelectItem value="CUSTOM">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Geo Codes</Label>
                <Input value={territoryForm.geoCodes} onChange={e => setTerritoryForm(f => ({ ...f, geoCodes: e.target.value }))} placeholder="28202, 28203" data-testid="input-territory-geocodes" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Site URL</Label><Input value={territoryForm.siteUrl} onChange={e => setTerritoryForm(f => ({ ...f, siteUrl: e.target.value }))} placeholder="https://..." /></div>
              <div><Label>Email Domain</Label><Input value={territoryForm.emailDomain} onChange={e => setTerritoryForm(f => ({ ...f, emailDomain: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTerritoryDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveTerritory} disabled={!territoryForm.name || !territoryForm.code || createTerritoryMutation.isPending || updateTerritoryMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700" data-testid="button-save-territory">
              {createTerritoryMutation.isPending || updateTerritoryMutation.isPending ? "Saving..." : editingTerritory ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {renderZoneDialog()}
      {renderBulkZipDialog()}
      {renderDeleteDialog()}
    </div>
  );
}
