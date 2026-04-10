import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MapPin, Search, Pencil, Plus, Loader2, Check, X } from "lucide-react";
import { useState } from "react";
import { useDefaultCityId } from "@/hooks/use-city";

interface ZoneData {
  id: string;
  cityId: string;
  name: string;
  slug: string;
  type: string;
  parentZoneId: string | null;
  county: string | null;
  stateCode: string | null;
  zipCodes: string[] | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

function ZoneEditDialog({ zone, allZones, onClose }: { zone: ZoneData; allZones: ZoneData[]; onClose: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState(zone.name);
  const [slug, setSlug] = useState(zone.slug);
  const [type, setType] = useState(zone.type);
  const [parentZoneId, setParentZoneId] = useState(zone.parentZoneId || "");
  const [county, setCounty] = useState(zone.county || "");
  const [stateCode, setStateCode] = useState(zone.stateCode || "");
  const [zipCodesStr, setZipCodesStr] = useState((zone.zipCodes || []).join(", "));
  const [isActive, setIsActive] = useState(zone.isActive);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("PATCH", `/api/admin/zones/${zone.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/zones"] });
      toast({ title: "Zone updated" });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Failed to update zone", description: err.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    const zipCodes = zipCodesStr.split(",").map(z => z.trim()).filter(Boolean);
    updateMutation.mutate({
      name,
      slug,
      type,
      parentZoneId: parentZoneId || null,
      county: county || null,
      stateCode: stateCode || null,
      zipCodes,
      isActive,
    });
  };

  const parentOptions = allZones.filter(z => z.id !== zone.id);

  return (
    <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Edit Zone</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} data-testid="input-zone-name" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Slug</Label>
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} data-testid="input-zone-slug" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger data-testid="select-zone-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ZIP">ZIP</SelectItem>
              <SelectItem value="NEIGHBORHOOD">Neighborhood</SelectItem>
              <SelectItem value="DISTRICT">District</SelectItem>
              <SelectItem value="MICRO_HUB">Micro Hub</SelectItem>
              <SelectItem value="COUNTY">County</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Parent Zone</Label>
          <Select value={parentZoneId || "__none__"} onValueChange={(v) => setParentZoneId(v === "__none__" ? "" : v)}>
            <SelectTrigger data-testid="select-zone-parent">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {parentOptions.map(z => (
                <SelectItem key={z.id} value={z.id}>{z.name} ({z.type})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">County</Label>
            <Input value={county} onChange={(e) => setCounty(e.target.value)} data-testid="input-zone-county" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">State Code</Label>
            <Input value={stateCode} onChange={(e) => setStateCode(e.target.value)} placeholder="NC" data-testid="input-zone-state" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">ZIP Codes (comma-separated)</Label>
          <Input value={zipCodesStr} onChange={(e) => setZipCodesStr(e.target.value)} placeholder="28201, 28202, 28203" data-testid="input-zone-zipcodes" />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs text-muted-foreground">Active</Label>
          <Button
            size="sm"
            variant={isActive ? "default" : "outline"}
            className="toggle-elevate"
            onClick={() => setIsActive(!isActive)}
            data-testid="button-zone-active-toggle"
          >
            {isActive ? <><Check className="h-3 w-3 mr-1" /> Active</> : <><X className="h-3 w-3 mr-1" /> Inactive</>}
          </Button>
        </div>
      </div>
      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onClose} data-testid="button-zone-cancel">Cancel</Button>
        <Button onClick={handleSave} disabled={updateMutation.isPending || !name.trim() || !slug.trim()} data-testid="button-zone-save">
          {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
          Save
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function AddZoneDialog({ cityId, allZones, onClose }: { cityId: string; allZones: ZoneData[]; onClose: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [type, setType] = useState("NEIGHBORHOOD");
  const [parentZoneId, setParentZoneId] = useState("");
  const [county, setCounty] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [zipCodesStr, setZipCodesStr] = useState("");

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/admin/zones", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/zones"] });
      toast({ title: "Zone created" });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Failed to create zone", description: err.message, variant: "destructive" });
    },
  });

  const handleCreate = () => {
    const zipCodes = zipCodesStr.split(",").map(z => z.trim()).filter(Boolean);
    createMutation.mutate({
      name,
      slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, ""),
      type,
      cityId,
      parentZoneId: parentZoneId || null,
      county: county || null,
      stateCode: stateCode || null,
      zipCodes,
    });
  };

  return (
    <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Add Zone</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Name *</Label>
          <Input value={name} onChange={(e) => { setName(e.target.value); if (!slug) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "")); }} data-testid="input-new-zone-name" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Slug *</Label>
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} data-testid="input-new-zone-slug" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger data-testid="select-new-zone-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ZIP">ZIP</SelectItem>
              <SelectItem value="NEIGHBORHOOD">Neighborhood</SelectItem>
              <SelectItem value="DISTRICT">District</SelectItem>
              <SelectItem value="MICRO_HUB">Micro Hub</SelectItem>
              <SelectItem value="COUNTY">County</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Parent Zone</Label>
          <Select value={parentZoneId || "__none__"} onValueChange={(v) => setParentZoneId(v === "__none__" ? "" : v)}>
            <SelectTrigger data-testid="select-new-zone-parent">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {allZones.map(z => (
                <SelectItem key={z.id} value={z.id}>{z.name} ({z.type})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">County</Label>
            <Input value={county} onChange={(e) => setCounty(e.target.value)} data-testid="input-new-zone-county" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">State Code</Label>
            <Input value={stateCode} onChange={(e) => setStateCode(e.target.value)} placeholder="NC" data-testid="input-new-zone-state" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">ZIP Codes (comma-separated)</Label>
          <Input value={zipCodesStr} onChange={(e) => setZipCodesStr(e.target.value)} placeholder="28201, 28202, 28203" data-testid="input-new-zone-zipcodes" />
        </div>
      </div>
      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onClose} data-testid="button-new-zone-cancel">Cancel</Button>
        <Button onClick={handleCreate} disabled={createMutation.isPending || !name.trim()} data-testid="button-new-zone-save">
          {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
          Create Zone
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function typeLabel(type: string): string {
  switch (type) {
    case "ZIP": return "ZIP";
    case "NEIGHBORHOOD": return "Neighborhood";
    case "DISTRICT": return "District";
    case "MICRO_HUB": return "Micro Hub";
    case "COUNTY": return "County";
    default: return type;
  }
}

function typeVariant(type: string): "default" | "secondary" | "outline" {
  switch (type) {
    case "COUNTY": return "default";
    case "DISTRICT": return "default";
    case "NEIGHBORHOOD": return "secondary";
    default: return "outline";
  }
}

export default function ZoneEditPanel({ cityId: propCityId }: { cityId?: string }) {
  const defaultCityId = useDefaultCityId();
  const cityId = propCityId || defaultCityId;
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [editZone, setEditZone] = useState<ZoneData | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const { data: allZones, isLoading } = useQuery<ZoneData[]>({
    queryKey: ["/api/admin/zones", cityId],
    queryFn: async () => {
      const params = cityId ? `?cityId=${cityId}` : "";
      const res = await fetch(`/api/admin/zones${params}`);
      if (!res.ok) throw new Error("Failed to load zones");
      return res.json();
    },
  });

  const zones = allZones || [];
  const filteredZones = zones.filter(z => {
    if (search) {
      const q = search.toLowerCase();
      if (!z.name.toLowerCase().includes(q) && !z.slug.toLowerCase().includes(q) && !(z.county || "").toLowerCase().includes(q)) return false;
    }
    if (typeFilter !== "all" && z.type !== typeFilter) return false;
    return true;
  });

  const typeCounts = zones.reduce((acc, z) => {
    acc[z.type] = (acc[z.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-semibold text-lg" data-testid="text-zone-editor-title">Zone Editor</h2>
        <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-zone">
          <Plus className="h-4 w-4 mr-1" /> Add Zone
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" data-testid="text-zone-total">{zones.length} zones</Badge>
        {Object.entries(typeCounts).map(([t, c]) => (
          <Badge key={t} variant="secondary" data-testid={`text-zone-type-count-${t}`}>
            {typeLabel(t)}: {c}
          </Badge>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search zones..."
            className="pl-8"
            data-testid="input-zone-search"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-zone-type-filter">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="NEIGHBORHOOD">Neighborhood</SelectItem>
            <SelectItem value="DISTRICT">District</SelectItem>
            <SelectItem value="ZIP">ZIP</SelectItem>
            <SelectItem value="MICRO_HUB">Micro Hub</SelectItem>
            <SelectItem value="COUNTY">County</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <div className="divide-y">
          {filteredZones.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground" data-testid="text-zone-empty">
              {search || typeFilter !== "all" ? "No zones match your filters" : "No zones found"}
            </div>
          )}
          {filteredZones.map((zone) => {
            const parentZone = zone.parentZoneId ? zones.find(z => z.id === zone.parentZoneId) : null;
            return (
              <div
                key={zone.id}
                className="flex items-center gap-3 px-4 py-3 hover-elevate cursor-pointer"
                onClick={() => setEditZone(zone)}
                data-testid={`row-zone-${zone.id}`}
              >
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm" data-testid={`text-zone-name-${zone.id}`}>{zone.name}</span>
                    <Badge variant={typeVariant(zone.type)} className="text-[10px]">{typeLabel(zone.type)}</Badge>
                    {!zone.isActive && <Badge variant="outline" className="text-[10px] text-muted-foreground">Inactive</Badge>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                    <span className="font-mono">{zone.slug}</span>
                    {zone.county && <span>{zone.county}</span>}
                    {parentZone && <span>Parent: {parentZone.name}</span>}
                    {zone.zipCodes && zone.zipCodes.length > 0 && (
                      <span>{zone.zipCodes.length} ZIP{zone.zipCodes.length !== 1 ? "s" : ""}</span>
                    )}
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); setEditZone(zone); }} data-testid={`button-edit-zone-${zone.id}`}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      </Card>

      <Dialog open={!!editZone} onOpenChange={(v) => { if (!v) setEditZone(null); }}>
        {editZone && <ZoneEditDialog zone={editZone} allZones={zones} onClose={() => setEditZone(null)} />}
      </Dialog>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        {showAddDialog && cityId && <AddZoneDialog cityId={cityId} allZones={zones} onClose={() => setShowAddDialog(false)} />}
      </Dialog>
    </div>
  );
}
