import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Megaphone, Zap, LayoutGrid, Plus, X, DollarSign, Loader2,
} from "lucide-react";
import { useState } from "react";

interface SponsoredItem {
  id: string;
  titleEn: string;
  contentType: string;
  status: string;
  isSponsored: boolean;
  sponsorId: string | null;
  sponsorshipType: string | null;
  cityId: string;
  publishedAt: string | null;
}

interface BoostItem {
  id: string;
  contentItemId: string;
  boostLevel: number;
  startsAt: string;
  endsAt: string;
  status: string;
  cityId: string;
  createdAt: string;
  contentTitle: string;
}

interface ContentCandidate {
  id: string;
  titleEn: string;
  contentType: string;
  status: string;
  cityId: string;
}

const SPONSORSHIP_TYPE_COLORS: Record<string, string> = {
  NATIVE: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  BRANDED: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  AFFILIATE: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  PROMOTED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

const BOOST_STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  EXPIRED: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  CANCELLED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

function SponsorshipsTab({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [assignDialog, setAssignDialog] = useState(false);
  const [selectedContentId, setSelectedContentId] = useState("");
  const [sponsorId, setSponsorId] = useState("");
  const [sponsorshipType, setSponsorshipType] = useState("NATIVE");

  const url = cityId ? `/api/admin/sponsorships?cityId=${cityId}` : "/api/admin/sponsorships";
  const candUrl = cityId ? `/api/admin/sponsorship-candidates?cityId=${cityId}` : "/api/admin/sponsorship-candidates";

  const { data: sponsored, isLoading } = useQuery<SponsoredItem[]>({
    queryKey: ["/api/admin/sponsorships", cityId],
    queryFn: async () => {
      const resp = await fetch(url, { credentials: "include" });
      if (!resp.ok) throw new Error("Failed");
      return resp.json();
    },
  });

  const { data: candidates } = useQuery<ContentCandidate[]>({
    queryKey: ["/api/admin/sponsorship-candidates", cityId],
    queryFn: async () => {
      const resp = await fetch(candUrl, { credentials: "include" });
      if (!resp.ok) throw new Error("Failed");
      return resp.json();
    },
  });

  const assignMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/admin/sponsorships/${id}`, {
      isSponsored: true,
      sponsorId: sponsorId || null,
      sponsorshipType,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sponsorships"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sponsorship-candidates"] });
      toast({ title: "Sponsorship assigned" });
      setAssignDialog(false);
    },
    onError: (err: Error) => toast({ title: "Failed to assign", description: err.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/admin/sponsorships/${id}`, { isSponsored: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sponsorships"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sponsorship-candidates"] });
      toast({ title: "Sponsorship removed" });
    },
    onError: (err: Error) => toast({ title: "Failed to remove", description: err.message, variant: "destructive" }),
  });

  const openAssign = () => {
    setSelectedContentId("");
    setSponsorId("");
    setSponsorshipType("NATIVE");
    setAssignDialog(true);
  };

  if (isLoading) return <div className="text-sm text-muted-foreground p-4" data-testid="text-sponsorships-loading">Loading sponsorships...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold" data-testid="text-sponsorships-title">Sponsored Content</h3>
        <Button onClick={openAssign} data-testid="button-assign-sponsorship">
          <Plus className="h-4 w-4 mr-1" /> Assign Sponsorship
        </Button>
      </div>

      <div className="grid gap-3">
        {(sponsored || []).length === 0 && (
          <Card className="p-6 text-center text-muted-foreground" data-testid="text-no-sponsorships">
            No sponsored content yet
          </Card>
        )}
        {(sponsored || []).map((item) => (
          <Card key={item.id} className="p-4" data-testid={`card-sponsored-${item.id}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium truncate">{item.titleEn}</div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge variant="secondary">{item.contentType}</Badge>
                  {item.sponsorshipType && (
                    <Badge className={SPONSORSHIP_TYPE_COLORS[item.sponsorshipType] || ""}>{item.sponsorshipType}</Badge>
                  )}
                  {item.sponsorId && (
                    <span className="text-xs text-muted-foreground">Sponsor: {item.sponsorId}</span>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => removeMutation.mutate(item.id)}
                disabled={removeMutation.isPending}
                data-testid={`button-remove-sponsor-${item.id}`}
              >
                <X className="h-4 w-4 mr-1" /> Remove
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={assignDialog} onOpenChange={setAssignDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Sponsorship</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Content Item</Label>
              <Select value={selectedContentId} onValueChange={setSelectedContentId}>
                <SelectTrigger data-testid="select-sponsor-content"><SelectValue placeholder="Select content..." /></SelectTrigger>
                <SelectContent>
                  {(candidates || []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.titleEn} ({c.contentType})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sponsorship Type</Label>
              <Select value={sponsorshipType} onValueChange={setSponsorshipType}>
                <SelectTrigger data-testid="select-sponsorship-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NATIVE">Native</SelectItem>
                  <SelectItem value="BRANDED">Branded</SelectItem>
                  <SelectItem value="AFFILIATE">Affiliate</SelectItem>
                  <SelectItem value="PROMOTED">Promoted</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sponsor ID (optional)</Label>
              <Input value={sponsorId} onChange={(e) => setSponsorId(e.target.value)} placeholder="Business or partner ID" data-testid="input-sponsor-id" />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => selectedContentId && assignMutation.mutate(selectedContentId)}
                disabled={!selectedContentId || assignMutation.isPending}
                data-testid="button-confirm-assign"
              >
                {assignMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Assign
              </Button>
              <Button variant="outline" onClick={() => setAssignDialog(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BoostsTab({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [createDialog, setCreateDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [contentItemId, setContentItemId] = useState("");
  const [boostLevel, setBoostLevel] = useState("3");
  const [durationDays, setDurationDays] = useState("7");

  const statusParam = statusFilter !== "ALL" ? `&status=${statusFilter}` : "";
  const boostUrl = cityId ? `/api/admin/boosts?cityId=${cityId}${statusParam}` : `/api/admin/boosts?${statusParam.slice(1)}`;
  const candUrl = cityId ? `/api/admin/sponsorship-candidates?cityId=${cityId}` : "/api/admin/sponsorship-candidates";

  const { data: boosts, isLoading } = useQuery<BoostItem[]>({
    queryKey: ["/api/admin/boosts", cityId, statusFilter],
    queryFn: async () => {
      const resp = await fetch(boostUrl, { credentials: "include" });
      if (!resp.ok) throw new Error("Failed");
      return resp.json();
    },
  });

  const { data: candidates } = useQuery<ContentCandidate[]>({
    queryKey: ["/api/admin/sponsorship-candidates", cityId],
    queryFn: async () => {
      const resp = await fetch(candUrl, { credentials: "include" });
      if (!resp.ok) throw new Error("Failed");
      return resp.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/boosts", {
      contentItemId,
      boostLevel: parseInt(boostLevel),
      durationDays: parseInt(durationDays),
      cityId: cityId || "",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/boosts"] });
      toast({ title: "Boost applied" });
      setCreateDialog(false);
    },
    onError: (err: Error) => toast({ title: "Failed to create boost", description: err.message, variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/boosts/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/boosts"] });
      toast({ title: "Boost cancelled" });
    },
    onError: (err: Error) => toast({ title: "Failed to cancel", description: err.message, variant: "destructive" }),
  });

  const openCreate = () => {
    setContentItemId("");
    setBoostLevel("3");
    setDurationDays("7");
    setCreateDialog(true);
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString();

  if (isLoading) return <div className="text-sm text-muted-foreground p-4" data-testid="text-boosts-loading">Loading boosts...</div>;

  const activeCount = (boosts || []).filter(b => b.status === "ACTIVE").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold" data-testid="text-boosts-title">Content Boosts</h3>
          <Badge variant="secondary" data-testid="text-active-boost-count">{activeCount} active</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px]" data-testid="select-boost-status-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="EXPIRED">Expired</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={openCreate} disabled={!cityId} data-testid="button-create-boost">
            <Plus className="h-4 w-4 mr-1" /> Apply Boost
          </Button>
        </div>
      </div>

      <div className="border rounded-md">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Content</th>
              <th className="text-center p-3 font-medium">Level</th>
              <th className="text-left p-3 font-medium">Period</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-center p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(boosts || []).map((b) => (
              <tr key={b.id} className="border-b last:border-b-0" data-testid={`row-boost-${b.id}`}>
                <td className="p-3">
                  <div className="font-medium truncate max-w-[250px]">{b.contentTitle}</div>
                </td>
                <td className="p-3 text-center">
                  <div className="flex items-center justify-center gap-0.5">
                    {Array.from({ length: b.boostLevel }).map((_, i) => (
                      <Zap key={i} className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                    ))}
                  </div>
                </td>
                <td className="p-3 text-muted-foreground text-xs">
                  {formatDate(b.startsAt)} - {formatDate(b.endsAt)}
                </td>
                <td className="p-3">
                  <Badge className={BOOST_STATUS_COLORS[b.status] || ""}>{b.status}</Badge>
                </td>
                <td className="p-3 text-center">
                  {b.status === "ACTIVE" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => cancelMutation.mutate(b.id)}
                      disabled={cancelMutation.isPending}
                      data-testid={`button-cancel-boost-${b.id}`}
                    >
                      Cancel
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {(boosts || []).length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No boosts found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Apply Content Boost</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Content Item</Label>
              <Select value={contentItemId} onValueChange={setContentItemId}>
                <SelectTrigger data-testid="select-boost-content"><SelectValue placeholder="Select content..." /></SelectTrigger>
                <SelectContent>
                  {(candidates || []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.titleEn} ({c.contentType})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Boost Level (1-5)</Label>
                <Select value={boostLevel} onValueChange={setBoostLevel}>
                  <SelectTrigger data-testid="select-boost-level"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 - Slight</SelectItem>
                    <SelectItem value="2">2 - Moderate</SelectItem>
                    <SelectItem value="3">3 - Strong</SelectItem>
                    <SelectItem value="4">4 - High</SelectItem>
                    <SelectItem value="5">5 - Maximum</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Duration (days)</Label>
                <Input type="number" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} min="1" max="365" data-testid="input-boost-duration" />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!contentItemId || createMutation.isPending}
                data-testid="button-confirm-boost"
              >
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Apply Boost
              </Button>
              <Button variant="outline" onClick={() => setCreateDialog(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface AdSlot {
  id: string;
  slotName: string;
  placementType: string;
  scopeType: string;
  metroId: string | null;
  hubId: string | null;
  maxActivePlacements: number;
  slotSize: string;
  pricePerUnit: number;
  rotationStrategy: string;
  status: string;
  createdAt: string;
}

function AdSlotsOverviewTab({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [editingSlot, setEditingSlot] = useState<AdSlot | null>(null);
  const [editName, setEditName] = useState("");
  const [editMaxPlacements, setEditMaxPlacements] = useState("1");
  const [editSlotSize, setEditSlotSize] = useState("MEDIUM");
  const [editPrice, setEditPrice] = useState("0");
  const [createDialog, setCreateDialog] = useState(false);
  const [newSlotName, setNewSlotName] = useState("");
  const [newPlacementType, setNewPlacementType] = useState("BANNER");
  const [newScopeType, setNewScopeType] = useState("METRO");
  const [newMaxPlacements, setNewMaxPlacements] = useState("1");
  const [newSlotSize, setNewSlotSize] = useState("MEDIUM");
  const [newPrice, setNewPrice] = useState("0");
  const [newRotation, setNewRotation] = useState("NONE");

  const { data: slots, isLoading } = useQuery<AdSlot[]>({
    queryKey: ["/api/admin/revenue/ad-slots"],
    queryFn: async () => {
      const resp = await fetch("/api/admin/revenue/ad-slots", { credentials: "include" });
      if (!resp.ok) throw new Error("Failed");
      return resp.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      apiRequest("PATCH", `/api/admin/revenue/ad-slots/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/revenue/ad-slots"] });
      toast({ title: "Ad slot updated" });
      setEditingSlot(null);
    },
    onError: (err: Error) => toast({ title: "Failed to update", description: err.message, variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/revenue/ad-slots", {
      slotName: newSlotName,
      placementType: newPlacementType,
      scopeType: newScopeType,
      maxActivePlacements: parseInt(newMaxPlacements),
      rotationStrategy: newRotation,
      slotSize: newSlotSize,
      pricePerUnit: parseInt(newPrice),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/revenue/ad-slots"] });
      toast({ title: "Ad slot created" });
      setCreateDialog(false);
    },
    onError: (err: Error) => toast({ title: "Failed to create", description: err.message, variant: "destructive" }),
  });

  const openCreateSlot = () => {
    setNewSlotName("");
    setNewPlacementType("BANNER");
    setNewScopeType("METRO_ONLY");
    setNewMaxPlacements("1");
    setNewSlotSize("MEDIUM");
    setNewPrice("0");
    setNewRotation("NONE");
    setCreateDialog(true);
  };

  const toggleStatus = (slot: AdSlot) => {
    const newStatus = slot.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    updateMutation.mutate({ id: slot.id, data: { status: newStatus } });
  };

  const openEdit = (slot: AdSlot) => {
    setEditingSlot(slot);
    setEditName(slot.slotName);
    setEditMaxPlacements(String(slot.maxActivePlacements));
    setEditSlotSize(slot.slotSize || "MEDIUM");
    setEditPrice(String(slot.pricePerUnit || 0));
  };

  if (isLoading) return <div className="text-sm text-muted-foreground p-4" data-testid="text-adslots-loading">Loading ad slots...</div>;

  const activeCount = (slots || []).filter(s => s.status === "ACTIVE").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold" data-testid="text-adslots-title">Ad Inventory Slots</h3>
          <Badge variant="secondary" data-testid="text-active-slots-count">{activeCount} active</Badge>
        </div>
        <Button onClick={openCreateSlot} data-testid="button-create-ad-slot">
          <Plus className="h-4 w-4 mr-1" /> Create Slot
        </Button>
      </div>

      <div className="border rounded-md">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Slot Name</th>
              <th className="text-left p-3 font-medium">Placement</th>
              <th className="text-left p-3 font-medium">Scope</th>
              <th className="text-center p-3 font-medium">Size</th>
              <th className="text-right p-3 font-medium">Price</th>
              <th className="text-center p-3 font-medium">Max</th>
              <th className="text-left p-3 font-medium">Rotation</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-center p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(slots || []).map((slot) => (
              <tr key={slot.id} className="border-b last:border-b-0" data-testid={`row-slot-${slot.id}`}>
                <td className="p-3 font-medium">{slot.slotName}</td>
                <td className="p-3">
                  <Badge variant="secondary">{slot.placementType}</Badge>
                </td>
                <td className="p-3 text-muted-foreground text-xs">{slot.scopeType}</td>
                <td className="p-3 text-center text-xs">{slot.slotSize || "MEDIUM"}</td>
                <td className="p-3 text-right">${((slot.pricePerUnit || 0) / 100).toFixed(2)}</td>
                <td className="p-3 text-center">{slot.maxActivePlacements}</td>
                <td className="p-3 text-xs text-muted-foreground">{slot.rotationStrategy}</td>
                <td className="p-3">
                  <Badge className={slot.status === "ACTIVE" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"}>
                    {slot.status}
                  </Badge>
                </td>
                <td className="p-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(slot)}
                      data-testid={`button-edit-slot-${slot.id}`}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleStatus(slot)}
                      disabled={updateMutation.isPending}
                      data-testid={`button-toggle-slot-${slot.id}`}
                    >
                      {slot.status === "ACTIVE" ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {(slots || []).length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No ad slots configured</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editingSlot} onOpenChange={(open) => !open && setEditingSlot(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Ad Slot</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Slot Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} data-testid="input-edit-slot-name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Size</Label>
                <Select value={editSlotSize} onValueChange={setEditSlotSize}>
                  <SelectTrigger data-testid="select-edit-slot-size"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SMALL">Small</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="LARGE">Large</SelectItem>
                    <SelectItem value="FULL_WIDTH">Full Width</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Price (cents)</Label>
                <Input type="number" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} min="0" data-testid="input-edit-price" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Max Active Placements</Label>
              <Input type="number" value={editMaxPlacements} onChange={(e) => setEditMaxPlacements(e.target.value)} min="1" max="100" data-testid="input-edit-max-placements" />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => editingSlot && updateMutation.mutate({
                  id: editingSlot.id,
                  data: {
                    slotName: editName,
                    maxActivePlacements: parseInt(editMaxPlacements),
                    slotSize: editSlotSize,
                    pricePerUnit: parseInt(editPrice),
                  },
                })}
                disabled={updateMutation.isPending}
                data-testid="button-save-slot"
              >
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Save
              </Button>
              <Button variant="outline" onClick={() => setEditingSlot(null)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Ad Slot</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Slot Name</Label>
              <Input value={newSlotName} onChange={(e) => setNewSlotName(e.target.value)} placeholder="e.g. Homepage Banner Top" data-testid="input-new-slot-name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Placement Type</Label>
                <Select value={newPlacementType} onValueChange={setNewPlacementType}>
                  <SelectTrigger data-testid="select-new-placement-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BANNER">Banner</SelectItem>
                    <SelectItem value="CARD">Card</SelectItem>
                    <SelectItem value="LIST_ITEM">List Item</SelectItem>
                    <SelectItem value="BADGE">Badge</SelectItem>
                    <SelectItem value="FEATURED_BLOCK">Featured Block</SelectItem>
                    <SelectItem value="CTA">CTA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Scope</Label>
                <Select value={newScopeType} onValueChange={setNewScopeType}>
                  <SelectTrigger data-testid="select-new-scope-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HUB_ONLY">Hub Only</SelectItem>
                    <SelectItem value="METRO_ONLY">Metro Only</SelectItem>
                    <SelectItem value="HUB_OR_METRO">Hub or Metro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Size</Label>
                <Select value={newSlotSize} onValueChange={setNewSlotSize}>
                  <SelectTrigger data-testid="select-new-slot-size"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SMALL">Small</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="LARGE">Large</SelectItem>
                    <SelectItem value="FULL_WIDTH">Full Width</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Price (cents)</Label>
                <Input type="number" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} min="0" placeholder="0" data-testid="input-new-price" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Max Placements</Label>
                <Input type="number" value={newMaxPlacements} onChange={(e) => setNewMaxPlacements(e.target.value)} min="1" max="100" data-testid="input-new-max-placements" />
              </div>
              <div className="space-y-2">
                <Label>Rotation</Label>
                <Select value={newRotation} onValueChange={setNewRotation}>
                  <SelectTrigger data-testid="select-new-rotation"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">None</SelectItem>
                    <SelectItem value="ROUND_ROBIN">Round Robin</SelectItem>
                    <SelectItem value="WEIGHTED">Weighted</SelectItem>
                    <SelectItem value="RANDOM">Random</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!newSlotName || createMutation.isPending}
                data-testid="button-confirm-create-slot"
              >
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Create Slot
              </Button>
              <Button variant="outline" onClick={() => setCreateDialog(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function RevenueControlsPanel({ cityId }: { cityId?: string }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <DollarSign className="h-5 w-5" />
        <h2 className="text-xl font-bold" data-testid="text-revenue-controls-title">Revenue Controls</h2>
      </div>

      <Tabs defaultValue="sponsorships" className="w-full">
        <TabsList className="w-full grid grid-cols-3" data-testid="tabs-revenue-controls">
          <TabsTrigger value="sponsorships" data-testid="tab-sponsorships">
            <Megaphone className="h-4 w-4 mr-1.5" />
            Sponsorships
          </TabsTrigger>
          <TabsTrigger value="boosts" data-testid="tab-boosts">
            <Zap className="h-4 w-4 mr-1.5" />
            Boosts
          </TabsTrigger>
          <TabsTrigger value="ad-slots" data-testid="tab-ad-slots">
            <LayoutGrid className="h-4 w-4 mr-1.5" />
            Ad Slots
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sponsorships" className="mt-4">
          <SponsorshipsTab cityId={cityId} />
        </TabsContent>

        <TabsContent value="boosts" className="mt-4">
          <BoostsTab cityId={cityId} />
        </TabsContent>

        <TabsContent value="ad-slots" className="mt-4">
          <AdSlotsOverviewTab cityId={cityId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
