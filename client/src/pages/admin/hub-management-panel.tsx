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
  MapPin, Users, LayoutList, Globe, Eye, ArrowLeft,
  Hash, Map
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

interface CityHub {
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

export function HubManagementPanel({ selectedCityId, onNavigate }: { selectedCityId?: string; onNavigate?: (section: string) => void }) {
  const { toast } = useToast();
  const [expandedCities, setExpandedCities] = useState<Set<string>>(new Set());
  const [expandedMetros, setExpandedMetros] = useState<Set<string>>(new Set());

  const [showTerritoryDialog, setShowTerritoryDialog] = useState(false);
  const [editingTerritory, setEditingTerritory] = useState<Hub | null>(null);
  const [territoryForm, setTerritoryForm] = useState(defaultTerritoryForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<"territory" | "zone">("territory");

  const [showZoneDialog, setShowZoneDialog] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [zoneForm, setZoneForm] = useState(defaultZoneForm);
  const [zoneCityId, setZoneCityId] = useState<string>("");

  const [showBulkZipDialog, setShowBulkZipDialog] = useState(false);
  const [bulkZipCityId, setBulkZipCityId] = useState("");
  const [bulkZips, setBulkZips] = useState("");

  const [showCityDialog, setShowCityDialog] = useState(false);
  const [cityForm, setCityForm] = useState({
    name: "", slug: "", cityCode: "", brandName: "", primaryColor: "#2563eb",
    aiGuideName: "", siteUrl: "", emailDomain: "", initialZips: "",
    cityAdminEmail: "", cityAdminPassword: "",
    feedName: "", feedUrl: "", feedType: "RSS" as "RSS" | "ICAL",
  });
  const [contentFeedsList, setContentFeedsList] = useState<{ name: string; url: string; feedType: string }[]>([]);

  const [zoneViewCityId, setZoneViewCityId] = useState<string | null>(null);
  const [zoneTypeFilter, setZoneTypeFilter] = useState<string>("all");

  const { data, isLoading } = useQuery<{ cities: CityHub[]; totalMetros: number; totalMicros: number }>({
    queryKey: ["/api/admin/hub-management"],
    queryFn: () => fetch("/api/admin/hub-management", { credentials: "include" }).then(r => r.json()),
  });

  const { data: cityZones, isLoading: zonesLoading } = useQuery<Zone[]>({
    queryKey: ["/api/admin/hub-management", "zones", zoneViewCityId, zoneTypeFilter],
    queryFn: () => {
      const url = zoneTypeFilter !== "all"
        ? `/api/admin/hub-management/city/${zoneViewCityId}/zones?type=${zoneTypeFilter}`
        : `/api/admin/hub-management/city/${zoneViewCityId}/zones`;
      return fetch(url, { credentials: "include" }).then(r => r.json());
    },
    enabled: !!zoneViewCityId,
  });

  const createCityMutation = useMutation({
    mutationFn: (payload: any) => apiRequest("POST", "/api/admin/cities", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hub-management"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cities"] });
      setShowCityDialog(false);
      setCityForm({ name: "", slug: "", cityCode: "", brandName: "", primaryColor: "#2563eb", aiGuideName: "", siteUrl: "", emailDomain: "", initialZips: "", cityAdminEmail: "", cityAdminPassword: "", feedName: "", feedUrl: "", feedType: "RSS" });
      setContentFeedsList([]);
      toast({ title: "City launched successfully" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createTerritoryMutation = useMutation({
    mutationFn: (payload: any) => apiRequest("POST", "/api/admin/territories", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hub-management"] });
      setShowTerritoryDialog(false);
      setTerritoryForm(defaultTerritoryForm);
      toast({ title: "Territory created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateTerritoryMutation = useMutation({
    mutationFn: ({ id, ...payload }: any) => apiRequest("PATCH", `/api/admin/hub-management/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hub-management"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hub-management"] });
      setDeleteId(null);
      toast({ title: "Territory deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createZoneMutation = useMutation({
    mutationFn: ({ cityId, ...payload }: any) => apiRequest("POST", `/api/admin/hub-management/city/${cityId}/zones`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hub-management"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hub-management"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hub-management"] });
      setDeleteId(null);
      toast({ title: "Zone deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const bulkZipMutation = useMutation({
    mutationFn: ({ cityId, zips }: { cityId: string; zips: string }) =>
      apiRequest("POST", `/api/admin/hub-management/city/${cityId}/zones/bulk-zip`, { zips }),
    onSuccess: (_data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hub-management"] });
      setShowBulkZipDialog(false);
      setBulkZips("");
      toast({ title: "ZIP codes imported" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleCity = (id: string) => {
    setExpandedCities(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleMetro = (id: string) => {
    setExpandedMetros(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openCreateTerritory = (cityId: string) => {
    setEditingTerritory(null);
    setTerritoryForm({ ...defaultTerritoryForm, cityId });
    setShowTerritoryDialog(true);
  };

  const openEditTerritory = (hub: Hub) => {
    setEditingTerritory(hub);
    setTerritoryForm({
      name: hub.name, code: hub.code, type: hub.type,
      parentTerritoryId: hub.parentTerritoryId || "",
      cityId: hub.cityId || "", geoType: hub.geoType || "ZIP",
      geoCodes: Array.isArray(hub.geoCodes) ? hub.geoCodes.join(", ") : "",
      status: hub.status, siteUrl: hub.siteUrl || "", emailDomain: hub.emailDomain || "",
    });
    setShowTerritoryDialog(true);
  };

  const handleSaveTerritory = () => {
    const payload: any = {
      name: territoryForm.name, code: territoryForm.code, type: territoryForm.type,
      status: territoryForm.status, geoType: territoryForm.geoType,
      geoCodes: territoryForm.geoCodes.split(",").map(s => s.trim()).filter(Boolean),
      cityId: territoryForm.cityId || null,
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

  const openCreateZone = (cityId: string) => {
    setEditingZone(null);
    setZoneCityId(cityId);
    setZoneForm(defaultZoneForm);
    setShowZoneDialog(true);
  };

  const openEditZone = (zone: Zone) => {
    setEditingZone(zone);
    setZoneCityId(zone.cityId);
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
      createZoneMutation.mutate({ cityId: zoneCityId, ...payload });
    }
  };

  const allCityHubs = data?.cities || [];
  const allMetros = allCityHubs.flatMap(c => c.territories);

  if (zoneViewCityId) {
    const city = allCityHubs.find(c => c.id === zoneViewCityId);
    return (
      <ZoneListView
        cityId={zoneViewCityId}
        cityName={city?.name || ""}
        zones={cityZones || []}
        isLoading={zonesLoading}
        typeFilter={zoneTypeFilter}
        onTypeFilter={setZoneTypeFilter}
        onBack={() => { setZoneViewCityId(null); setZoneTypeFilter("all"); }}
        onCreateZone={() => openCreateZone(zoneViewCityId)}
        onEditZone={openEditZone}
        onDeleteZone={(id) => { setDeleteId(id); setDeleteType("zone"); }}
        onBulkZip={() => { setBulkZipCityId(zoneViewCityId); setShowBulkZipDialog(true); }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2" data-testid="text-hub-management-title">
            <Building2 className="h-6 w-6 text-purple-400" />
            Hub Management
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {data ? `${allCityHubs.length} ${allCityHubs.length === 1 ? "city" : "cities"} · ${data.totalMetros} metros · ${data.totalMicros} micros` : "Loading..."}
          </p>
        </div>
        <Button onClick={() => setShowCityDialog(true)} className="bg-purple-600 hover:bg-purple-700" data-testid="button-add-city">
          <Plus className="h-4 w-4 mr-1" /> Launch New City
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map(i => <Card key={i} className="animate-pulse"><CardContent className="h-24 p-6" /></Card>)}
        </div>
      ) : allCityHubs.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Globe className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Cities Yet</h3>
            <p className="text-muted-foreground mb-4">Create your first city hub to start building territories and zones.</p>
            <Button onClick={() => setShowCityDialog(true)} className="bg-purple-600 hover:bg-purple-700" data-testid="button-add-first-city">
              <Plus className="h-4 w-4 mr-1" /> Launch New City
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {allCityHubs.map(city => (
            <Card key={city.id} className="border-border/50 overflow-hidden" data-testid={`card-city-${city.id}`}>
              <div
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => toggleCity(city.id)}
                data-testid={`button-expand-city-${city.id}`}
              >
                <div className="shrink-0">
                  {expandedCities.has(city.id)
                    ? <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    : <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  }
                </div>
                <div className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
                  style={{ backgroundColor: city.primaryColor || "#2563eb" }}>
                  {city.cityCode || city.name.substring(0, 3).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-lg">{city.name}</span>
                    {city.cityCode && <Badge variant="outline" className="text-[10px] font-mono">{city.cityCode}</Badge>}
                    <Badge className={`text-[10px] border ${city.isActive ? statusColors.ACTIVE : statusColors.SUSPENDED}`}>
                      {city.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {city.metroCount} metro{city.metroCount !== 1 ? "s" : ""}, {city.microCount} micro{city.microCount !== 1 ? "s" : ""}
                    </span>
                    <span className="flex items-center gap-1">
                      <Map className="h-3 w-3" /> {city.totalZones} zones
                    </span>
                    {Object.entries(city.zoneSummary || {}).map(([type, cnt]) => (
                      <span key={type} className="text-muted-foreground/70">{cnt} {type.toLowerCase()}{Number(cnt) !== 1 ? "s" : ""}</span>
                    ))}
                  </div>
                </div>
              </div>

              {expandedCities.has(city.id) && (
                <div className="border-t border-border/50 bg-accent/10">
                  <div className="p-4 space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h4 className="text-sm font-semibold text-amber-400 flex items-center gap-1.5">
                        <Building2 className="h-4 w-4" /> Territories
                      </h4>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); openCreateTerritory(city.id); }} data-testid={`button-add-territory-${city.id}`}>
                        <Plus className="h-3 w-3 mr-1" /> Add Territory
                      </Button>
                    </div>

                    {city.territories.length === 0 && city.orphanMicros.length === 0 ? (
                      <p className="text-xs text-muted-foreground pl-2">No territories yet</p>
                    ) : (
                      <div className="space-y-2">
                        {city.territories.map(metro => (
                          <div key={metro.id} className="border border-border/40 rounded-lg overflow-hidden">
                            <div className="flex items-center gap-2 p-3 hover:bg-accent/30 cursor-pointer min-w-0"
                              onClick={() => toggleMetro(metro.id)} data-testid={`button-expand-metro-${metro.id}`}>
                              {metro.microHubs.length > 0 ? (
                                expandedMetros.has(metro.id)
                                  ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                                  : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                              ) : <div className="w-4 shrink-0" />}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-sm">{metro.name}</span>
                                  <Badge variant="outline" className="text-[10px] font-mono">{metro.code}</Badge>
                                  <Badge className={`text-[10px] border ${statusColors[metro.status]}`}>{metro.status}</Badge>
                                  <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-400 border-purple-500/30">METRO</Badge>
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{Array.isArray(metro.geoCodes) ? `${metro.geoCodes.length} ${metro.geoType}s` : "No coverage"}</span>
                                  <span className="flex items-center gap-1"><Users className="h-3 w-3" />{metro.operators.length > 0 ? metro.operators[0].operatorName : "No operator"}</span>
                                  <span className="flex items-center gap-1"><LayoutList className="h-3 w-3" />{metro.listingCount} listings</span>
                                  {metro.microHubs.length > 0 && <span className="text-amber-400">{metro.microHubs.length} micro{metro.microHubs.length !== 1 ? "s" : ""}</span>}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditTerritory(metro)} data-testid={`button-edit-territory-${metro.id}`}><Pencil className="h-3.5 w-3.5" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { setDeleteId(metro.id); setDeleteType("territory"); }} data-testid={`button-delete-territory-${metro.id}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                              </div>
                            </div>
                            {expandedMetros.has(metro.id) && metro.microHubs.length > 0 && (
                              <div className="border-t border-border/30">
                                {metro.microHubs.map(micro => (
                                  <div key={micro.id} className="flex items-center gap-2 pl-10 pr-3 py-2 hover:bg-accent/20 border-b border-border/20 last:border-b-0 min-w-0">
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
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between flex-wrap gap-2 mt-4">
                      <h4 className="text-sm font-semibold text-amber-400 flex items-center gap-1.5">
                        <Map className="h-4 w-4" /> Zones
                      </h4>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setBulkZipCityId(city.id); setShowBulkZipDialog(true); }} data-testid={`button-bulk-zip-${city.id}`}>
                          <Hash className="h-3 w-3 mr-1" /> Import ZIPs
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openCreateZone(city.id)} data-testid={`button-add-zone-${city.id}`}>
                          <Plus className="h-3 w-3 mr-1" /> Add Zone
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setZoneViewCityId(city.id)} data-testid={`button-view-zones-${city.id}`}>
                          <Eye className="h-3 w-3 mr-1" /> View All
                        </Button>
                      </div>
                    </div>

                    {city.totalZones === 0 ? (
                      <p className="text-xs text-muted-foreground pl-2">No zones yet — import ZIP codes or add zones manually</p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {Object.entries(city.zoneSummary || {}).map(([type, cnt]) => (
                          <div key={type}
                            className="border border-border/40 rounded-lg p-3 text-center cursor-pointer hover:bg-accent/30 transition-colors"
                            onClick={() => { setZoneViewCityId(city.id); setZoneTypeFilter(type); }}
                            data-testid={`button-zone-type-${city.id}-${type}`}
                          >
                            <div className="text-xl font-bold">{cnt}</div>
                            <div className="text-[11px] text-muted-foreground">{zoneTypeLabels[type] || type}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCityDialog} onOpenChange={setShowCityDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Launch New City</DialogTitle>
            <DialogDescription>Create a new metro city with territory, zones, content feeds, and an optional city admin.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>City Name</Label>
                <Input value={cityForm.name} onChange={e => setCityForm(f => ({
                  ...f, name: e.target.value,
                  slug: e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
                  aiGuideName: e.target.value,
                }))} placeholder="e.g. Indianapolis" data-testid="input-city-name" />
              </div>
              <div>
                <Label>City Code</Label>
                <Input value={cityForm.cityCode} onChange={e => setCityForm(f => ({ ...f, cityCode: e.target.value.toUpperCase() }))}
                  placeholder="e.g. IND" maxLength={5} data-testid="input-city-code" />
                <p className="text-[10px] text-muted-foreground mt-0.5">3-5 letter identifier (airport code)</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>URL Slug</Label>
                <Input value={cityForm.slug} onChange={e => setCityForm(f => ({ ...f, slug: e.target.value }))} placeholder="e.g. indianapolis" data-testid="input-city-slug" />
              </div>
              <div>
                <Label>Brand Name</Label>
                <Input value={cityForm.brandName} onChange={e => setCityForm(f => ({ ...f, brandName: e.target.value }))} placeholder="e.g. Indy City Hub" data-testid="input-city-brand" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Primary Color</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={cityForm.primaryColor} onChange={e => setCityForm(f => ({ ...f, primaryColor: e.target.value }))} className="h-8 w-12 rounded cursor-pointer" data-testid="input-city-color" />
                  <Input value={cityForm.primaryColor} onChange={e => setCityForm(f => ({ ...f, primaryColor: e.target.value }))} className="w-24" />
                </div>
              </div>
              <div>
                <Label>AI Guide Name</Label>
                <Input value={cityForm.aiGuideName} onChange={e => setCityForm(f => ({ ...f, aiGuideName: e.target.value }))} placeholder="e.g. Indie" data-testid="input-city-ai" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Site URL</Label>
                <Input value={cityForm.siteUrl} onChange={e => setCityForm(f => ({ ...f, siteUrl: e.target.value }))} placeholder="https://..." data-testid="input-city-siteurl" />
              </div>
              <div>
                <Label>Email Domain</Label>
                <Input value={cityForm.emailDomain} onChange={e => setCityForm(f => ({ ...f, emailDomain: e.target.value }))} placeholder="indy.citymetrohub.com" data-testid="input-city-emaildomain" />
              </div>
            </div>
            <div>
              <Label>Initial ZIP Codes</Label>
              <Textarea value={cityForm.initialZips} onChange={e => setCityForm(f => ({ ...f, initialZips: e.target.value }))}
                placeholder="46201, 46202, 46203, 46204..." className="h-20" data-testid="input-city-zips" />
              <p className="text-[10px] text-muted-foreground mt-0.5">Comma-separated ZIPs — zones will be created for each</p>
            </div>

            <div className="border-t pt-4">
              <Label className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                <Users className="h-4 w-4" /> City Admin (optional)
              </Label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Admin Email</Label>
                  <Input value={cityForm.cityAdminEmail} onChange={e => setCityForm(f => ({ ...f, cityAdminEmail: e.target.value }))}
                    placeholder="admin@city.com" type="email" data-testid="input-city-admin-email" />
                </div>
                <div>
                  <Label>Admin Password</Label>
                  <Input value={cityForm.cityAdminPassword} onChange={e => setCityForm(f => ({ ...f, cityAdminPassword: e.target.value }))}
                    placeholder="Password for new user" type="password" data-testid="input-city-admin-password" />
                  <p className="text-[10px] text-muted-foreground mt-0.5">Leave blank if user already exists</p>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <Label className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                <Globe className="h-4 w-4" /> Content Feeds (optional)
              </Label>
              <div className="grid grid-cols-3 gap-2">
                <Input value={cityForm.feedName} onChange={e => setCityForm(f => ({ ...f, feedName: e.target.value }))}
                  placeholder="Feed name" data-testid="input-feed-name" />
                <Input value={cityForm.feedUrl} onChange={e => setCityForm(f => ({ ...f, feedUrl: e.target.value }))}
                  placeholder="Feed URL" data-testid="input-feed-url" />
                <div className="flex gap-1">
                  <Select value={cityForm.feedType} onValueChange={(v: "RSS" | "ICAL") => setCityForm(f => ({ ...f, feedType: v }))}>
                    <SelectTrigger data-testid="select-feed-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RSS">RSS</SelectItem>
                      <SelectItem value="ICAL">iCal</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="button" size="sm" variant="outline" className="shrink-0" data-testid="button-add-feed" onClick={() => {
                    if (cityForm.feedName && cityForm.feedUrl) {
                      setContentFeedsList(prev => [...prev, { name: cityForm.feedName, url: cityForm.feedUrl, feedType: cityForm.feedType }]);
                      setCityForm(f => ({ ...f, feedName: "", feedUrl: "", feedType: "RSS" }));
                    }
                  }}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              {contentFeedsList.length > 0 && (
                <div className="mt-2 space-y-1">
                  {contentFeedsList.map((feed, i) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-accent/30 rounded px-2 py-1" data-testid={`feed-item-${i}`}>
                      <span>{feed.name} ({feed.feedType})</span>
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setContentFeedsList(prev => prev.filter((_, j) => j !== i))}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCityDialog(false)}>Cancel</Button>
            <Button onClick={() => createCityMutation.mutate({
              ...cityForm,
              contentFeeds: contentFeedsList.length > 0 ? contentFeedsList : undefined,
            })}
              disabled={!cityForm.name || !cityForm.slug || createCityMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700" data-testid="button-create-city">
              {createCityMutation.isPending ? "Launching..." : "Launch City"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      <Dialog open={showBulkZipDialog} onOpenChange={setShowBulkZipDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import ZIP Codes</DialogTitle>
            <DialogDescription>Paste comma-separated ZIP codes. A zone will be created for each.</DialogDescription>
          </DialogHeader>
          <Textarea value={bulkZips} onChange={e => setBulkZips(e.target.value)}
            placeholder="46201, 46202, 46203, 46204, 46205..." className="h-32" data-testid="input-bulk-zips" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkZipDialog(false)}>Cancel</Button>
            <Button onClick={() => bulkZipMutation.mutate({ cityId: bulkZipCityId, zips: bulkZips })}
              disabled={!bulkZips.trim() || bulkZipMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700" data-testid="button-import-zips">
              {bulkZipMutation.isPending ? "Importing..." : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </div>
  );
}

function ZoneListView({ cityId, cityName, zones, isLoading, typeFilter, onTypeFilter, onBack, onCreateZone, onEditZone, onDeleteZone, onBulkZip }: {
  cityId: string;
  cityName: string;
  zones: Zone[];
  isLoading: boolean;
  typeFilter: string;
  onTypeFilter: (t: string) => void;
  onBack: () => void;
  onCreateZone: () => void;
  onEditZone: (z: Zone) => void;
  onDeleteZone: (id: string) => void;
  onBulkZip: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" onClick={onBack} className="gap-1" data-testid="button-zones-back">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <h2 className="text-xl font-bold">{cityName} — Zones</h2>
          <Badge variant="outline">{zones.length} zones</Badge>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={typeFilter} onValueChange={onTypeFilter}>
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
          <Button size="sm" variant="outline" onClick={onBulkZip} data-testid="button-bulk-zip-view">
            <Hash className="h-3.5 w-3.5 mr-1" /> Import ZIPs
          </Button>
          <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={onCreateZone} data-testid="button-add-zone-view">
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Zone
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Card key={i} className="animate-pulse"><CardContent className="h-12 p-4" /></Card>)}
        </div>
      ) : zones.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No zones match the filter</CardContent></Card>
      ) : (
        <div className="border border-border/50 rounded-lg overflow-x-auto">
          <div className="min-w-[600px]">
            <div className="grid grid-cols-[1fr_90px_110px_60px_140px_70px] gap-2 px-4 py-2 bg-accent/30 text-xs font-medium text-muted-foreground border-b border-border/50">
              <span>Name</span><span>Type</span><span>County</span><span>State</span><span>ZIP Codes</span><span></span>
            </div>
            {zones.map(zone => (
              <div key={zone.id} className="grid grid-cols-[1fr_90px_110px_60px_140px_70px] gap-2 px-4 py-2.5 border-b border-border/30 last:border-b-0 hover:bg-accent/20 items-center" data-testid={`row-zone-${zone.id}`}>
                <span className="text-sm font-medium truncate">{zone.name}</span>
                <Badge variant="outline" className="text-[10px] w-fit">{zone.type}</Badge>
                <span className="text-xs text-muted-foreground truncate">{zone.county || "—"}</span>
                <span className="text-xs text-muted-foreground">{zone.stateCode || "—"}</span>
                <span className="text-xs text-muted-foreground truncate">{(zone.zipCodes || []).join(", ") || "—"}</span>
                <div className="flex items-center gap-0.5">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEditZone(zone)} data-testid={`button-edit-zone-${zone.id}`}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDeleteZone(zone.id)} data-testid={`button-delete-zone-${zone.id}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
