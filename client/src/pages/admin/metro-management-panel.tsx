import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Globe, Plus, CheckCircle2, Circle, AlertTriangle, ArrowRight, Loader2 } from "lucide-react";

interface MetroTemplate {
  id: string;
  name: string;
  description: string | null;
  status: string;
}

interface ChecklistItem {
  id: string;
  metroId: string;
  itemKey: string;
  itemName: string;
  status: "pending" | "complete" | "blocked";
  notes: string | null;
}

interface ChecklistProgress {
  total: number;
  complete: number;
  blocked: number;
  pending: number;
  percent: number;
}

interface MetroItem {
  id: string;
  name: string;
  slug: string;
  cityId: string | null;
  templateId: string | null;
  status: string;
  mode: "coming_soon" | "live";
  cityName: string | null;
  checklistProgress: ChecklistProgress;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  idea: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  planned: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  coming_soon: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  building: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300",
  soft_open: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  paused: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const STATUS_LABELS: Record<string, string> = {
  idea: "Idea",
  planned: "Planned",
  coming_soon: "Coming Soon",
  building: "Building",
  soft_open: "Soft Open",
  active: "Live",
  paused: "Paused",
};

export default function MetroManagementPanel({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [checklistMetro, setChecklistMetro] = useState<MetroItem | null>(null);
  const [goLiveMetro, setGoLiveMetro] = useState<MetroItem | null>(null);
  const [newMetroName, setNewMetroName] = useState("");
  const [newMetroSlug, setNewMetroSlug] = useState("");
  const [newMetroRegion, setNewMetroRegion] = useState("");
  const [newMetroState, setNewMetroState] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  const { data: metros, isLoading: metrosLoading } = useQuery<MetroItem[]>({
    queryKey: ["/api/admin/metros"],
  });

  const { data: templates } = useQuery<MetroTemplate[]>({
    queryKey: ["/api/admin/metro-templates"],
  });

  const { data: checklistData, isLoading: checklistLoading } = useQuery<{
    items: ChecklistItem[];
    progress: ChecklistProgress;
  }>({
    queryKey: ["/api/admin/metros", checklistMetro?.id, "checklist"],
    enabled: !!checklistMetro,
  });

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, string>) => {
      const res = await apiRequest("POST", "/api/admin/metros/create-from-template", body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/metros"] });
      setCreateOpen(false);
      setNewMetroName("");
      setNewMetroSlug("");
      setNewMetroRegion("");
      setNewMetroState("");
      setSelectedTemplateId("");
      toast({ title: "Metro created", description: "New metro is in Coming Soon mode." });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create metro", description: err.message, variant: "destructive" });
    },
  });

  const updateChecklistMutation = useMutation({
    mutationFn: async ({ metroId, itemId, status }: { metroId: string; itemId: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/metros/${metroId}/checklist/${itemId}`, { status });
      return res.json();
    },
    onSuccess: () => {
      if (checklistMetro) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/metros", checklistMetro.id, "checklist"] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/metros"] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ metroId, status, confirmLive }: { metroId: string; status: string; confirmLive?: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/metros/${metroId}/status`, { status, confirmLive });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/metros"] });
      setGoLiveMetro(null);
      toast({ title: "Status updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update status", description: err.message, variant: "destructive" });
    },
  });

  function handleCreate() {
    if (!newMetroName || !selectedTemplateId) return;
    const body: Record<string, string> = {
      templateId: selectedTemplateId,
      newMetroName,
    };
    if (newMetroSlug) body.slug = newMetroSlug;
    if (newMetroRegion) body.region = newMetroRegion;
    if (newMetroState) body.state = newMetroState;
    createMutation.mutate(body);
  }

  function cycleChecklistStatus(item: ChecklistItem) {
    if (!checklistMetro) return;
    const next = item.status === "pending" ? "complete" : item.status === "complete" ? "blocked" : "pending";
    updateChecklistMutation.mutate({ metroId: checklistMetro.id, itemId: item.id, status: next });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold" data-testid="text-metro-management-title">Metro Management</h2>
          <p className="text-sm text-muted-foreground">Create, manage, and launch metro hubs</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} data-testid="button-create-metro">
          <Plus className="h-4 w-4 mr-2" />
          New Metro
        </Button>
      </div>

      {metrosLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !metros || metros.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <Globe className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">No metro projects yet</p>
            <Button variant="outline" onClick={() => setCreateOpen(true)} data-testid="button-create-metro-empty">
              <Plus className="h-4 w-4 mr-2" />
              Create First Metro
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {metros.map((metro) => (
            <Card key={metro.id} data-testid={`card-metro-${metro.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-base truncate">{metro.name}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">/{metro.slug}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge className={STATUS_COLORS[metro.status] || "bg-gray-100"} data-testid={`badge-metro-status-${metro.id}`}>
                      {STATUS_LABELS[metro.status] || metro.status}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {metro.mode === "live" ? "Live Mode" : "Coming Soon Mode"}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Launch Readiness</span>
                    <span className="font-medium">{metro.checklistProgress.percent}%</span>
                  </div>
                  <Progress value={metro.checklistProgress.percent} className="h-2" />
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground flex-wrap">
                    <span>{metro.checklistProgress.complete} done</span>
                    <span>{metro.checklistProgress.pending} pending</span>
                    {metro.checklistProgress.blocked > 0 && (
                      <span className="text-red-500">{metro.checklistProgress.blocked} blocked</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setChecklistMetro(metro)}
                    data-testid={`button-metro-checklist-${metro.id}`}
                  >
                    Checklist
                  </Button>
                  {metro.status !== "active" && metro.status !== "paused" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setGoLiveMetro(metro)}
                      data-testid={`button-metro-go-live-${metro.id}`}
                    >
                      <ArrowRight className="h-3.5 w-3.5 mr-1" />
                      Advance
                    </Button>
                  )}
                  {metro.status === "paused" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => statusMutation.mutate({ metroId: metro.id, status: "coming_soon" })}
                      data-testid={`button-metro-resume-${metro.id}`}
                    >
                      Resume
                    </Button>
                  )}
                  {metro.status !== "paused" && metro.status !== "idea" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => statusMutation.mutate({ metroId: metro.id, status: "paused" })}
                      data-testid={`button-metro-pause-${metro.id}`}
                    >
                      Pause
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Metro</DialogTitle>
            <DialogDescription>Create a new metro hub from an existing template. The metro will start in Coming Soon mode.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Template</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger data-testid="select-metro-template">
                  <SelectValue placeholder="Select template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates?.map((t) => (
                    <SelectItem key={t.id} value={t.id} data-testid={`option-template-${t.id}`}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Metro Name</Label>
              <Input
                value={newMetroName}
                onChange={(e) => setNewMetroName(e.target.value)}
                placeholder="e.g. Indianapolis"
                data-testid="input-metro-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Slug (optional)</Label>
              <Input
                value={newMetroSlug}
                onChange={(e) => setNewMetroSlug(e.target.value)}
                placeholder="e.g. indianapolis (auto-generated if blank)"
                data-testid="input-metro-slug"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Region</Label>
                <Input
                  value={newMetroRegion}
                  onChange={(e) => setNewMetroRegion(e.target.value)}
                  placeholder="e.g. Marion County"
                  data-testid="input-metro-region"
                />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input
                  value={newMetroState}
                  onChange={(e) => setNewMetroState(e.target.value)}
                  placeholder="e.g. IN"
                  data-testid="input-metro-state"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} data-testid="button-cancel-create-metro">
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newMetroName || !selectedTemplateId || createMutation.isPending}
              data-testid="button-confirm-create-metro"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Metro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!checklistMetro} onOpenChange={(open) => !open && setChecklistMetro(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{checklistMetro?.name} — Launch Checklist</DialogTitle>
            <DialogDescription>
              Track launch readiness items. Click an item to cycle its status.
            </DialogDescription>
          </DialogHeader>
          {checklistLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-2 py-2">
              {checklistData?.items.map((item) => (
                <button
                  key={item.id}
                  className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-md border transition-colors hover:bg-muted/50"
                  onClick={() => cycleChecklistStatus(item)}
                  data-testid={`checklist-item-${item.itemKey}`}
                >
                  {item.status === "complete" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  ) : item.status === "blocked" ? (
                    <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <span className={`text-sm ${item.status === "complete" ? "line-through text-muted-foreground" : ""}`}>
                    {item.itemName}
                  </span>
                  <Badge
                    variant="outline"
                    className={`ml-auto text-[10px] shrink-0 ${
                      item.status === "complete"
                        ? "border-emerald-200 text-emerald-600"
                        : item.status === "blocked"
                        ? "border-red-200 text-red-600"
                        : ""
                    }`}
                  >
                    {item.status}
                  </Badge>
                </button>
              ))}
              {checklistData && (
                <div className="pt-3 border-t mt-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{checklistData.progress.percent}%</span>
                  </div>
                  <Progress value={checklistData.progress.percent} className="h-2 mt-1" />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!goLiveMetro} onOpenChange={(open) => !open && setGoLiveMetro(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Advance {goLiveMetro?.name}</DialogTitle>
            <DialogDescription>
              Choose the next status for this metro. Going to Soft Open or Live requires confirmation.
            </DialogDescription>
          </DialogHeader>
          {goLiveMetro && (
            <div className="space-y-3 py-2">
              <p className="text-sm">
                Current status: <Badge className={STATUS_COLORS[goLiveMetro.status]}>{STATUS_LABELS[goLiveMetro.status]}</Badge>
              </p>
              <p className="text-sm">
                Readiness: {goLiveMetro.checklistProgress.percent}% ({goLiveMetro.checklistProgress.complete}/{goLiveMetro.checklistProgress.total} items)
              </p>
              {goLiveMetro.checklistProgress.percent < 100 && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Not all checklist items are complete. Consider finishing them before advancing.
                  </p>
                </div>
              )}
              <div className="flex items-center gap-2 flex-wrap pt-2">
                {goLiveMetro.status === "coming_soon" && (
                  <Button
                    onClick={() => statusMutation.mutate({ metroId: goLiveMetro.id, status: "building" })}
                    disabled={statusMutation.isPending}
                    data-testid="button-advance-building"
                  >
                    Move to Building
                  </Button>
                )}
                {goLiveMetro.status === "building" && (
                  <>
                    <Button
                      onClick={() => statusMutation.mutate({ metroId: goLiveMetro.id, status: "soft_open", confirmLive: true })}
                      disabled={statusMutation.isPending}
                      data-testid="button-advance-soft-open"
                    >
                      Soft Open
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => statusMutation.mutate({ metroId: goLiveMetro.id, status: "coming_soon" })}
                      disabled={statusMutation.isPending}
                      data-testid="button-revert-coming-soon"
                    >
                      Back to Coming Soon
                    </Button>
                  </>
                )}
                {goLiveMetro.status === "soft_open" && (
                  <Button
                    onClick={() => statusMutation.mutate({ metroId: goLiveMetro.id, status: "active", confirmLive: true })}
                    disabled={statusMutation.isPending}
                    data-testid="button-advance-live"
                  >
                    Go Live
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
