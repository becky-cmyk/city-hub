import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Plus, Pencil, DollarSign, Layers, BarChart3, Calendar,
  AlertTriangle, CheckCircle, PauseCircle, XCircle, Clock, Loader2
} from "lucide-react";
import { useState } from "react";
import type { RevenueProgram, AdInventorySlot, AdPlacement } from "@shared/schema";

const PROGRAM_TYPE_COLORS: Record<string, string> = {
  AD: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  SPONSORSHIP: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  PROMOTION: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  AUTHORITY: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  GUIDE: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  WELCOME: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  MARKETPLACE: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  JOBS: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
  SOCIAL_SELLING: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
};

const SCOPE_COLORS: Record<string, string> = {
  HUB_ONLY: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  METRO_ONLY: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  HUB_OR_METRO: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  PENDING_PAYMENT: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  PAUSED: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  EXPIRED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  CANCELED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

function formatCents(cents: number | null | undefined): string {
  if (cents == null) return "-";
  return `$${(cents / 100).toFixed(2)}`;
}

function ProgramsTab() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RevenueProgram | null>(null);

  const [name, setName] = useState("");
  const [programType, setProgramType] = useState("AD");
  const [description, setDescription] = useState("");
  const [billingCycle, setBillingCycle] = useState("MONTHLY");
  const [priceMode, setPriceMode] = useState("FIXED_PRICE");
  const [basePriceCents, setBasePriceCents] = useState("");
  const [minPriceCents, setMinPriceCents] = useState("");
  const [maxPriceCents, setMaxPriceCents] = useState("");
  const [requiresExpandedListing, setRequiresExpandedListing] = useState(true);
  const [comingSoon, setComingSoon] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const { data: programs, isLoading } = useQuery<RevenueProgram[]>({
    queryKey: ["/api/admin/ad-programs"],
  });

  const resetForm = (p?: RevenueProgram | null) => {
    setName(p?.name || "");
    setProgramType(p?.programType || "AD");
    setDescription(p?.description || "");
    setBillingCycle(p?.billingCycle || "MONTHLY");
    setPriceMode(p?.priceMode || "FIXED_PRICE");
    setBasePriceCents(p?.basePriceCents != null ? String(p.basePriceCents) : "");
    setMinPriceCents(p?.minPriceCents != null ? String(p.minPriceCents) : "");
    setMaxPriceCents(p?.maxPriceCents != null ? String(p.maxPriceCents) : "");
    setRequiresExpandedListing(p?.requiresExpandedListing ?? true);
    setComingSoon(p?.comingSoon ?? false);
    setIsActive(p?.isActive ?? true);
  };

  const openCreate = () => { setEditing(null); resetForm(); setDialogOpen(true); };
  const openEdit = (p: RevenueProgram) => { setEditing(p); resetForm(p); setDialogOpen(true); };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        name, programType, description: description || null,
        billingCycle, priceMode,
        basePriceCents: basePriceCents ? parseInt(basePriceCents) : null,
        minPriceCents: minPriceCents ? parseInt(minPriceCents) : null,
        maxPriceCents: maxPriceCents ? parseInt(maxPriceCents) : null,
        requiresExpandedListing, comingSoon, isActive,
      };
      if (editing) {
        return apiRequest("PATCH", `/api/admin/ad-programs/${editing.id}`, body);
      }
      return apiRequest("POST", "/api/admin/ad-programs", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ad-programs"] });
      toast({ title: editing ? "Program updated" : "Program created" });
      setDialogOpen(false);
    },
    onError: () => toast({ title: "Error saving program", variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, field, value }: { id: string; field: string; value: boolean }) =>
      apiRequest("PATCH", `/api/admin/ad-programs/${id}`, { [field]: value }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/ad-programs"] }),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground p-4">Loading programs...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold" data-testid="text-programs-title">Revenue Programs</h3>
        <Button onClick={openCreate} data-testid="button-create-program">
          <Plus className="h-4 w-4 mr-1" /> New Program
        </Button>
      </div>

      <div className="border rounded-md">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Name</th>
              <th className="text-left p-3 font-medium">Type</th>
              <th className="text-left p-3 font-medium">Billing</th>
              <th className="text-left p-3 font-medium">Price</th>
              <th className="text-center p-3 font-medium">Coming Soon</th>
              <th className="text-center p-3 font-medium">Active</th>
              <th className="text-center p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(programs || []).map((p) => (
              <tr key={p.id} className="border-b last:border-b-0" data-testid={`row-program-${p.id}`}>
                <td className="p-3">
                  <div className="font-medium">{p.name}</div>
                  {p.description && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{p.description}</div>}
                </td>
                <td className="p-3">
                  <Badge className={PROGRAM_TYPE_COLORS[p.programType] || ""}>{p.programType.replace(/_/g, " ")}</Badge>
                </td>
                <td className="p-3 text-muted-foreground">{p.billingCycle.replace(/_/g, " ")}</td>
                <td className="p-3">
                  {p.priceMode === "FIXED_PRICE" && <span>{formatCents(p.basePriceCents)}</span>}
                  {p.priceMode === "RANGE_PRICE" && <span>{formatCents(p.minPriceCents)} - {formatCents(p.maxPriceCents)}</span>}
                  {p.priceMode === "CUSTOM_QUOTE" && <span className="text-muted-foreground italic">Custom</span>}
                </td>
                <td className="p-3 text-center">
                  <Switch
                    checked={p.comingSoon}
                    onCheckedChange={(v) => toggleMutation.mutate({ id: p.id, field: "comingSoon", value: v })}
                    data-testid={`switch-coming-soon-${p.id}`}
                  />
                </td>
                <td className="p-3 text-center">
                  <Switch
                    checked={p.isActive}
                    onCheckedChange={(v) => toggleMutation.mutate({ id: p.id, field: "isActive", value: v })}
                    data-testid={`switch-active-${p.id}`}
                  />
                </td>
                <td className="p-3 text-center">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(p)} data-testid={`button-edit-program-${p.id}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
            {(programs || []).length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No programs yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Program" : "Create Program"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} data-testid="input-program-name" />
            </div>
            <div className="space-y-2">
              <Label>Program Type</Label>
              <Select value={programType} onValueChange={setProgramType}>
                <SelectTrigger data-testid="select-program-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["AD", "SPONSORSHIP", "PROMOTION", "AUTHORITY", "GUIDE", "WELCOME", "MARKETPLACE", "JOBS", "SOCIAL_SELLING"].map((t) => (
                    <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="resize-none" rows={2} data-testid="input-program-description" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Billing Cycle</Label>
                <Select value={billingCycle} onValueChange={setBillingCycle}>
                  <SelectTrigger data-testid="select-billing-cycle"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["ONE_TIME", "MONTHLY", "QUARTERLY", "ANNUAL"].map((c) => (
                      <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Price Mode</Label>
                <Select value={priceMode} onValueChange={setPriceMode}>
                  <SelectTrigger data-testid="select-price-mode"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["FIXED_PRICE", "RANGE_PRICE", "CUSTOM_QUOTE"].map((m) => (
                      <SelectItem key={m} value={m}>{m.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {priceMode === "FIXED_PRICE" && (
              <div className="space-y-2">
                <Label>Base Price (cents)</Label>
                <Input type="number" value={basePriceCents} onChange={(e) => setBasePriceCents(e.target.value)} data-testid="input-base-price" />
              </div>
            )}
            {priceMode === "RANGE_PRICE" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Min (cents)</Label>
                  <Input type="number" value={minPriceCents} onChange={(e) => setMinPriceCents(e.target.value)} data-testid="input-min-price" />
                </div>
                <div className="space-y-2">
                  <Label>Max (cents)</Label>
                  <Input type="number" value={maxPriceCents} onChange={(e) => setMaxPriceCents(e.target.value)} data-testid="input-max-price" />
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Switch checked={requiresExpandedListing} onCheckedChange={setRequiresExpandedListing} data-testid="switch-requires-expanded" />
              <Label>Requires Expanded Listing</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={comingSoon} onCheckedChange={setComingSoon} data-testid="switch-form-coming-soon" />
              <Label>Coming Soon</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={isActive} onCheckedChange={setIsActive} data-testid="switch-form-active" />
              <Label>Active</Label>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={() => saveMutation.mutate()} disabled={!name || saveMutation.isPending} data-testid="button-save-program">
                {saveMutation.isPending ? "Saving..." : editing ? "Update" : "Create"}
              </Button>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InventoryTab() {
  const { toast } = useToast();
  const [scopeFilter, setScopeFilter] = useState<string>("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdInventorySlot | null>(null);

  const [slotName, setSlotName] = useState("");
  const [placementType, setPlacementType] = useState("BANNER");
  const [scopeType, setScopeType] = useState("METRO_ONLY");
  const [maxActivePlacements, setMaxActivePlacements] = useState("1");
  const [rotationStrategy, setRotationStrategy] = useState("NONE");
  const [status, setStatus] = useState("ACTIVE");
  const [hubId, setHubId] = useState("");
  const [metroId, setMetroId] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const queryParams = scopeFilter !== "ALL" ? `?scopeType=${scopeFilter}` : "";
  const { data: slots, isLoading } = useQuery<AdInventorySlot[]>({
    queryKey: ["/api/admin/ad-inventory", scopeFilter],
    queryFn: async () => {
      const resp = await fetch(`/api/admin/ad-inventory${queryParams}`, { credentials: "include" });
      if (!resp.ok) throw new Error("Failed");
      return resp.json();
    },
  });

  const resetForm = (s?: AdInventorySlot | null) => {
    setSlotName(s?.slotName || "");
    setPlacementType(s?.placementType || "BANNER");
    setScopeType(s?.scopeType || "METRO_ONLY");
    setMaxActivePlacements(String(s?.maxActivePlacements ?? 1));
    setRotationStrategy(s?.rotationStrategy || "NONE");
    setStatus(s?.status || "ACTIVE");
    setHubId(s?.hubId || "");
    setMetroId(s?.metroId || "");
    setCategoryId(s?.categoryId || "");
  };

  const openCreate = () => { setEditing(null); resetForm(); setDialogOpen(true); };
  const openEdit = (s: AdInventorySlot) => { setEditing(s); resetForm(s); setDialogOpen(true); };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        slotName, placementType, scopeType,
        maxActivePlacements: parseInt(maxActivePlacements) || 1,
        rotationStrategy, status,
        hubId: hubId || null,
        metroId: metroId || null,
        categoryId: categoryId || null,
      };
      if (editing) {
        return apiRequest("PATCH", `/api/admin/ad-inventory/${editing.id}`, body);
      }
      return apiRequest("POST", "/api/admin/ad-inventory", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ad-inventory"] });
      toast({ title: editing ? "Slot updated" : "Slot created" });
      setDialogOpen(false);
    },
    onError: () => toast({ title: "Error saving slot", variant: "destructive" }),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground p-4">Loading inventory...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold" data-testid="text-inventory-title">Inventory Slots</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={scopeFilter} onValueChange={setScopeFilter}>
            <SelectTrigger className="w-[160px]" data-testid="select-scope-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Scopes</SelectItem>
              <SelectItem value="HUB_ONLY">Hub Only</SelectItem>
              <SelectItem value="METRO_ONLY">Metro Only</SelectItem>
              <SelectItem value="HUB_OR_METRO">Hub or Metro</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={openCreate} data-testid="button-create-slot">
            <Plus className="h-4 w-4 mr-1" /> New Slot
          </Button>
        </div>
      </div>

      <div className="border rounded-md">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Name</th>
              <th className="text-left p-3 font-medium">Type</th>
              <th className="text-left p-3 font-medium">Scope</th>
              <th className="text-center p-3 font-medium">Max</th>
              <th className="text-left p-3 font-medium">Rotation</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-center p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(slots || []).map((s) => (
              <tr key={s.id} className="border-b last:border-b-0" data-testid={`row-slot-${s.id}`}>
                <td className="p-3 font-medium">{s.slotName}</td>
                <td className="p-3">
                  <Badge variant="secondary">{s.placementType.replace(/_/g, " ")}</Badge>
                </td>
                <td className="p-3">
                  <Badge className={SCOPE_COLORS[s.scopeType] || ""}>{s.scopeType.replace(/_/g, " ")}</Badge>
                </td>
                <td className="p-3 text-center">{s.maxActivePlacements}</td>
                <td className="p-3 text-muted-foreground">{s.rotationStrategy.replace(/_/g, " ")}</td>
                <td className="p-3">
                  <Badge variant={s.status === "ACTIVE" ? "default" : "secondary"}>
                    {s.status}
                  </Badge>
                </td>
                <td className="p-3 text-center">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(s)} data-testid={`button-edit-slot-${s.id}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
            {(slots || []).length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No inventory slots</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Slot" : "Create Slot"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Slot Name</Label>
              <Input value={slotName} onChange={(e) => setSlotName(e.target.value)} data-testid="input-slot-name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Placement Type</Label>
                <Select value={placementType} onValueChange={setPlacementType}>
                  <SelectTrigger data-testid="select-placement-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["BANNER", "CARD", "LIST_ITEM", "BADGE", "FEATURED_BLOCK", "CTA"].map((t) => (
                      <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Scope Type</Label>
                <Select value={scopeType} onValueChange={setScopeType}>
                  <SelectTrigger data-testid="select-scope-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["HUB_ONLY", "METRO_ONLY", "HUB_OR_METRO"].map((t) => (
                      <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Max Active Placements</Label>
                <Input type="number" value={maxActivePlacements} onChange={(e) => setMaxActivePlacements(e.target.value)} min="1" data-testid="input-max-placements" />
              </div>
              <div className="space-y-2">
                <Label>Rotation Strategy</Label>
                <Select value={rotationStrategy} onValueChange={setRotationStrategy}>
                  <SelectTrigger data-testid="select-rotation"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["NONE", "ROUND_ROBIN", "WEIGHTED", "RANDOM"].map((r) => (
                      <SelectItem key={r} value={r}>{r.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Hub ID (optional)</Label>
              <Input value={hubId} onChange={(e) => setHubId(e.target.value)} placeholder="Leave empty for all hubs" data-testid="input-hub-id" />
            </div>
            <div className="space-y-2">
              <Label>Metro ID (optional)</Label>
              <Input value={metroId} onChange={(e) => setMetroId(e.target.value)} placeholder="Leave empty for all metros" data-testid="input-metro-id" />
            </div>
            <div className="space-y-2">
              <Label>Category ID (optional)</Label>
              <Input value={categoryId} onChange={(e) => setCategoryId(e.target.value)} placeholder="Leave empty for all categories" data-testid="input-category-id" />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger data-testid="select-slot-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="PAUSED">Paused</SelectItem>
                  <SelectItem value="RETIRED">Retired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={() => saveMutation.mutate()} disabled={!slotName || saveMutation.isPending} data-testid="button-save-slot">
                {saveMutation.isPending ? "Saving..." : editing ? "Update" : "Create"}
              </Button>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PlacementsTab() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);

  const [businessId, setBusinessId] = useState("");
  const [programId, setProgramId] = useState("");
  const [slotId, setSlotId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [ctaText, setCtaText] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [creativeType, setCreativeType] = useState("IMAGE");
  const [notesInternal, setNotesInternal] = useState("");

  const placementsUrl = statusFilter !== "ALL"
    ? `/api/admin/ad-placements?status=${statusFilter}`
    : "/api/admin/ad-placements";
  const { data: placements, isLoading } = useQuery<AdPlacement[]>({
    queryKey: ["/api/admin/ad-placements", statusFilter],
    queryFn: async () => {
      const resp = await fetch(placementsUrl, { credentials: "include" });
      if (!resp.ok) throw new Error("Failed to load placements");
      return resp.json();
    },
  });

  const { data: programs } = useQuery<RevenueProgram[]>({ queryKey: ["/api/admin/ad-programs"] });
  const { data: slots } = useQuery<AdInventorySlot[]>({
    queryKey: ["/api/admin/ad-inventory"],
  });

  const resetWizard = () => {
    setWizardStep(0);
    setBusinessId(""); setProgramId(""); setSlotId("");
    setStartDate(""); setEndDate("");
    setHeadline(""); setBody(""); setCtaText(""); setCtaUrl("");
    setImageUrl(""); setCreativeType("IMAGE"); setNotesInternal("");
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const placement: Record<string, unknown> = {
        businessId, programId, slotId,
        status: "DRAFT",
        startDate: startDate ? new Date(startDate).toISOString() : null,
        endDate: endDate ? new Date(endDate).toISOString() : null,
        headline: headline || null,
        body: body || null,
        ctaText: ctaText || null,
        ctaUrl: ctaUrl || null,
        imageUrl: imageUrl || null,
        creativeType: creativeType || null,
        notesInternal: notesInternal || null,
      };
      return apiRequest("POST", "/api/admin/ad-placements", placement);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ad-placements"] });
      toast({ title: "Placement created" });
      setWizardOpen(false);
      resetWizard();
    },
    onError: (err: Error) => toast({ title: err.message || "Error creating placement", variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/admin/ad-placements/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ad-placements"] });
      toast({ title: "Status updated" });
    },
    onError: (err: Error) => toast({ title: err.message || "Error updating status", variant: "destructive" }),
  });

  const programMap = new Map((programs || []).map((p) => [p.id, p.name]));
  const slotMap = new Map((slots || []).map((s) => [s.id, s.slotName]));

  const wizardSteps = [
    { label: "Business", valid: !!businessId },
    { label: "Program & Slot", valid: !!programId && !!slotId },
    { label: "Dates", valid: true },
    { label: "Creative", valid: true },
  ];

  if (isLoading) return <div className="text-sm text-muted-foreground p-4">Loading placements...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold" data-testid="text-placements-title">Placements</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]" data-testid="select-status-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              {["DRAFT", "PENDING_PAYMENT", "ACTIVE", "PAUSED", "EXPIRED", "CANCELED"].map((s) => (
                <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => { resetWizard(); setWizardOpen(true); }} data-testid="button-create-placement">
            <Plus className="h-4 w-4 mr-1" /> New Placement
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {(placements || []).map((p) => (
          <Card key={p.id} className="p-4" data-testid={`card-placement-${p.id}`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-medium text-sm">{p.headline || `Placement ${p.id.slice(0, 8)}`}</span>
                  <Badge className={STATUS_COLORS[p.status] || ""}>{p.status.replace(/_/g, " ")}</Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  <span>Program: {programMap.get(p.programId) || p.programId.slice(0, 8)}</span>
                  <span>Slot: {slotMap.get(p.slotId) || p.slotId.slice(0, 8)}</span>
                  <span>Biz: {p.businessId.slice(0, 8)}</span>
                  {p.startDate && <span>Start: {new Date(p.startDate).toLocaleDateString()}</span>}
                  {p.endDate && <span>End: {new Date(p.endDate).toLocaleDateString()}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {p.status === "DRAFT" && (
                  <Button size="sm" variant="outline" onClick={() => statusMutation.mutate({ id: p.id, status: "ACTIVE" })} data-testid={`button-activate-${p.id}`}>
                    <CheckCircle className="h-3.5 w-3.5 mr-1" /> Activate
                  </Button>
                )}
                {p.status === "ACTIVE" && (
                  <Button size="sm" variant="outline" onClick={() => statusMutation.mutate({ id: p.id, status: "PAUSED" })} data-testid={`button-pause-${p.id}`}>
                    <PauseCircle className="h-3.5 w-3.5 mr-1" /> Pause
                  </Button>
                )}
                {p.status === "PAUSED" && (
                  <Button size="sm" variant="outline" onClick={() => statusMutation.mutate({ id: p.id, status: "ACTIVE" })} data-testid={`button-resume-${p.id}`}>
                    <CheckCircle className="h-3.5 w-3.5 mr-1" /> Resume
                  </Button>
                )}
                {(p.status === "DRAFT" || p.status === "ACTIVE" || p.status === "PAUSED") && (
                  <Button size="sm" variant="outline" onClick={() => statusMutation.mutate({ id: p.id, status: "CANCELED" })} data-testid={`button-cancel-${p.id}`}>
                    <XCircle className="h-3.5 w-3.5 mr-1" /> Cancel
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
        {(placements || []).length === 0 && (
          <Card className="p-6 border-dashed">
            <p className="text-sm text-muted-foreground text-center">No placements found</p>
          </Card>
        )}
      </div>

      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Placement</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-1 mb-4">
            {wizardSteps.map((step, i) => (
              <div key={i} className="flex items-center gap-1 flex-1">
                <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                  i === wizardStep ? "bg-primary text-primary-foreground" :
                  i < wizardStep ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" :
                  "bg-muted text-muted-foreground"
                }`} data-testid={`wizard-step-${i}`}>
                  {i + 1}
                </div>
                <span className="text-xs text-muted-foreground hidden sm:inline">{step.label}</span>
                {i < wizardSteps.length - 1 && <div className="flex-1 h-px bg-border" />}
              </div>
            ))}
          </div>

          <div className="space-y-4 min-h-[200px]">
            {wizardStep === 0 && (
              <div className="space-y-2">
                <Label>Business ID</Label>
                <Input value={businessId} onChange={(e) => setBusinessId(e.target.value)} placeholder="Enter or paste business ID" data-testid="input-placement-business" />
              </div>
            )}

            {wizardStep === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Program</Label>
                  <Select value={programId} onValueChange={setProgramId}>
                    <SelectTrigger data-testid="select-placement-program"><SelectValue placeholder="Select program" /></SelectTrigger>
                    <SelectContent>
                      {(programs || []).filter((p) => p.isActive).map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Slot</Label>
                  <Select value={slotId} onValueChange={setSlotId}>
                    <SelectTrigger data-testid="select-placement-slot"><SelectValue placeholder="Select slot" /></SelectTrigger>
                    <SelectContent>
                      {(slots || []).filter((s) => s.status === "ACTIVE").map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.slotName} ({s.scopeType.replace(/_/g, " ")})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {wizardStep === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} data-testid="input-start-date" />
                </div>
                <div className="space-y-2">
                  <Label>End Date (optional)</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} data-testid="input-end-date" />
                </div>
              </div>
            )}

            {wizardStep === 3 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Creative Type</Label>
                  <Select value={creativeType} onValueChange={setCreativeType}>
                    <SelectTrigger data-testid="select-creative-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["IMAGE", "HTML", "TEXT", "LINK_ONLY"].map((t) => (
                        <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Headline</Label>
                  <Input value={headline} onChange={(e) => setHeadline(e.target.value)} data-testid="input-placement-headline" />
                </div>
                <div className="space-y-2">
                  <Label>Body</Label>
                  <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="resize-none" rows={2} data-testid="input-placement-body" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>CTA Text</Label>
                    <Input value={ctaText} onChange={(e) => setCtaText(e.target.value)} data-testid="input-cta-text" />
                  </div>
                  <div className="space-y-2">
                    <Label>CTA URL</Label>
                    <Input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} data-testid="input-cta-url" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Image URL</Label>
                  <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} data-testid="input-placement-image" />
                </div>
                <div className="space-y-2">
                  <Label>Internal Notes</Label>
                  <Textarea value={notesInternal} onChange={(e) => setNotesInternal(e.target.value)} className="resize-none" rows={2} data-testid="input-internal-notes" />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 pt-2">
            <Button variant="outline" onClick={() => setWizardStep(Math.max(0, wizardStep - 1))} disabled={wizardStep === 0} data-testid="button-wizard-back">
              Back
            </Button>
            {wizardStep < 3 ? (
              <Button onClick={() => setWizardStep(wizardStep + 1)} disabled={!wizardSteps[wizardStep].valid} data-testid="button-wizard-next">
                Next
              </Button>
            ) : (
              <Button onClick={() => createMutation.mutate()} disabled={!businessId || !programId || !slotId || createMutation.isPending} data-testid="button-wizard-create">
                {createMutation.isPending ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Creating...</> : "Create Placement"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface ReportingData {
  totalActive: number;
  totalPlacements: number;
  expiringSoonCount: number;
  expiringSoon: { id: string; businessId: string; endDate: string }[];
  totalPrograms: number;
  totalSlots: number;
  availableSlots: number;
  comingSoonPrograms: { id: string; name: string }[];
  placementsBySlot: Record<string, number>;
  placementsByProgram: Record<string, number>;
  revenueNote: string;
}

function ReportingTab() {
  const { data: report, isLoading } = useQuery<ReportingData>({
    queryKey: ["/api/admin/ad-reporting"],
  });

  if (isLoading) return <div className="text-sm text-muted-foreground p-4">Loading report...</div>;
  if (!report) return <div className="text-sm text-muted-foreground p-4">No data</div>;

  return (
    <div className="space-y-6">
      <h3 className="font-semibold" data-testid="text-reporting-title">Ad Reporting</h3>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4" data-testid="card-total-active">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-xs text-muted-foreground">Active Placements</span>
          </div>
          <div className="text-2xl font-bold">{report.totalActive}</div>
          <div className="text-xs text-muted-foreground">of {report.totalPlacements} total</div>
        </Card>

        <Card className="p-4" data-testid="card-expiring-soon">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="text-xs text-muted-foreground">Expiring Soon</span>
          </div>
          <div className="text-2xl font-bold">{report.expiringSoonCount}</div>
          <div className="text-xs text-muted-foreground">within 30 days</div>
        </Card>

        <Card className="p-4" data-testid="card-programs-count">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-xs text-muted-foreground">Programs</span>
          </div>
          <div className="text-2xl font-bold">{report.totalPrograms}</div>
        </Card>

        <Card className="p-4" data-testid="card-slots-count">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <span className="text-xs text-muted-foreground">Inventory Slots</span>
          </div>
          <div className="text-2xl font-bold">{report.totalSlots}</div>
          <div className="text-xs text-muted-foreground">{report.availableSlots} active</div>
        </Card>
      </div>

      {report.expiringSoon.length > 0 && (
        <Card className="p-4" data-testid="card-expiring-list">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <h4 className="font-semibold text-sm">Expiring Soon</h4>
          </div>
          <div className="space-y-2">
            {report.expiringSoon.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 text-sm border rounded-md px-3 py-2" data-testid={`expiring-${p.id}`}>
                <span className="text-muted-foreground">Business: {p.businessId.slice(0, 12)}...</span>
                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                  <Calendar className="h-3 w-3 mr-1" />
                  {new Date(p.endDate).toLocaleDateString()}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {report.comingSoonPrograms.length > 0 && (
        <Card className="p-4" data-testid="card-coming-soon-list">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h4 className="font-semibold text-sm">Coming Soon Programs</h4>
          </div>
          <div className="space-y-2">
            {report.comingSoonPrograms.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-sm border rounded-md px-3 py-2" data-testid={`coming-soon-${p.id}`}>
                <Badge variant="secondary">{p.name}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-4" data-testid="card-revenue-note">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BarChart3 className="h-4 w-4" />
          <span>{report.revenueNote}</span>
        </div>
      </Card>
    </div>
  );
}

export default function AdManagementPanel({ cityId }: { cityId?: string }) {
  return (
    <div className="space-y-6" data-testid="ad-management-panel">
      <div>
        <h2 className="text-xl font-bold" data-testid="text-ad-management-title">Ad Management</h2>
        <p className="text-sm text-muted-foreground">Revenue programs, inventory slots, placements & reporting</p>
      </div>

      <Tabs defaultValue="programs">
        <TabsList data-testid="tabs-ad-management">
          <TabsTrigger value="programs" data-testid="tab-programs">Programs</TabsTrigger>
          <TabsTrigger value="inventory" data-testid="tab-inventory">Inventory</TabsTrigger>
          <TabsTrigger value="placements" data-testid="tab-placements">Placements</TabsTrigger>
          <TabsTrigger value="reporting" data-testid="tab-reporting">Reporting</TabsTrigger>
        </TabsList>

        <TabsContent value="programs" className="mt-4">
          <ProgramsTab />
        </TabsContent>
        <TabsContent value="inventory" className="mt-4">
          <InventoryTab />
        </TabsContent>
        <TabsContent value="placements" className="mt-4">
          <PlacementsTab />
        </TabsContent>
        <TabsContent value="reporting" className="mt-4">
          <ReportingTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
