import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Users, Plus, Send, Loader2, MapPin, Building2, Mail, Bot,
  ChevronRight, Clock, UserCheck, AlertCircle, MoreHorizontal,
  Eye, Ban, RefreshCw, MessageSquare, ArrowRight,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Territory } from "@shared/schema";

const PIPELINE_STAGES = ["PROSPECT", "CONTACTED", "APPLICATION", "ONBOARDING", "ACTIVE", "SUSPENDED"] as const;

const stageConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  PROSPECT: { label: "Prospect", color: "text-blue-700 dark:text-blue-400", bgColor: "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800" },
  CONTACTED: { label: "Contacted", color: "text-amber-700 dark:text-amber-400", bgColor: "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800" },
  APPLICATION: { label: "Application", color: "text-purple-700 dark:text-purple-400", bgColor: "bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800" },
  ONBOARDING: { label: "Onboarding", color: "text-cyan-700 dark:text-cyan-400", bgColor: "bg-cyan-50 dark:bg-cyan-950 border-cyan-200 dark:border-cyan-800" },
  ACTIVE: { label: "Active", color: "text-green-700 dark:text-green-400", bgColor: "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800" },
  SUSPENDED: { label: "Suspended", color: "text-red-700 dark:text-red-400", bgColor: "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800" },
};

interface PipelineOperator {
  id: string;
  operatorType: string;
  displayName: string;
  email: string;
  status: string;
  pipelineStage: string;
  pipelineNotes: string | null;
  lastContactedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  territories: Array<{
    id: string;
    territoryId: string;
    exclusivity: string;
    territory: Territory | null;
    city: { id: string; name: string; aiGuideName: string | null; primaryColor: string | null; siteUrl: string | null; emailDomain: string | null } | null;
  }>;
}

function StageBadge({ stage }: { stage: string }) {
  const config = stageConfig[stage] || stageConfig.PROSPECT;
  return (
    <Badge variant="outline" className={`${config.color} border-current`} data-testid={`badge-stage-${stage.toLowerCase()}`}>
      {config.label}
    </Badge>
  );
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatTimeAgo(d: string | null) {
  if (!d) return "Never";
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return formatDate(d);
}

export default function LicenseCrmPanel({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [view, setView] = useState<"pipeline" | "list">("pipeline");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedOperator, setSelectedOperator] = useState<PipelineOperator | null>(null);
  const [noteText, setNoteText] = useState("");
  const [createForm, setCreateForm] = useState({
    displayName: "", email: "", operatorType: "METRO" as string, territoryId: "", pipelineStage: "PROSPECT",
  });

  const { data: operators = [], isLoading } = useQuery<PipelineOperator[]>({
    queryKey: ["/api/admin/license-pipeline"],
  });

  const { data: allTerritories = [] } = useQuery<Territory[]>({
    queryKey: ["/api/admin/territories"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/operators", {
        displayName: data.displayName,
        email: data.email,
        operatorType: data.operatorType,
        status: "ACTIVE",
        pipelineStage: data.pipelineStage,
      });
      const op = await res.json();
      if (data.territoryId) {
        await apiRequest("POST", "/api/admin/operator-territories", {
          operatorId: op.id,
          territoryId: data.territoryId,
          exclusivity: "NONE",
        });
      }
      return op;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/license-pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/operators"] });
      setShowCreate(false);
      setCreateForm({ displayName: "", email: "", operatorType: "METRO", territoryId: "", pipelineStage: "PROSPECT" });
      toast({ title: "Operator created" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updatePipelineMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/admin/operators/${id}/pipeline`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/license-pipeline"] });
      toast({ title: "Pipeline updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const inviteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/operators/${id}/invite`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/license-pipeline"] });
      toast({ title: "Invite sent", description: data.message });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  function moveToStage(op: PipelineOperator, stage: string) {
    updatePipelineMutation.mutate({ id: op.id, data: { pipelineStage: stage } });
  }

  function addNote(op: PipelineOperator) {
    if (!noteText.trim()) return;
    const existingNotes = op.pipelineNotes || "";
    const timestamp = new Date().toLocaleString();
    const updated = `[${timestamp}] ${noteText.trim()}\n${existingNotes}`.trim();
    updatePipelineMutation.mutate({ id: op.id, data: { pipelineNotes: updated, lastContactedAt: new Date().toISOString() } });
    setNoteText("");
  }

  const stageCounts = PIPELINE_STAGES.reduce((acc, stage) => {
    acc[stage] = operators.filter(o => o.pipelineStage === stage).length;
    return acc;
  }, {} as Record<string, number>);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-muted rounded animate-pulse w-48" />
        <div className="grid grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-64 bg-muted rounded animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-license-crm-title">License CRM</h2>
          <p className="text-muted-foreground text-sm">Manage operator prospects and active operators</p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as any)}>
            <TabsList>
              <TabsTrigger value="pipeline" data-testid="tab-pipeline-view">Pipeline</TabsTrigger>
              <TabsTrigger value="list" data-testid="tab-list-view">List</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={() => setShowCreate(true)} data-testid="button-create-operator">
            <Plus className="h-4 w-4 mr-1" /> Add Operator
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {PIPELINE_STAGES.map((stage) => {
          const config = stageConfig[stage];
          return (
            <Card key={stage} className={`${config.bgColor} border`}>
              <CardContent className="p-3 text-center">
                <p className={`text-2xl font-bold ${config.color}`} data-testid={`count-stage-${stage.toLowerCase()}`}>{stageCounts[stage]}</p>
                <p className="text-xs text-muted-foreground">{config.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {view === "pipeline" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 overflow-x-auto">
          {PIPELINE_STAGES.map((stage) => {
            const stageOps = operators.filter(o => o.pipelineStage === stage);
            const config = stageConfig[stage];
            return (
              <div key={stage} className="min-w-[240px]">
                <div className={`px-3 py-2 rounded-t-lg border ${config.bgColor}`}>
                  <p className={`font-semibold text-sm ${config.color}`}>{config.label}</p>
                  <p className="text-xs text-muted-foreground">{stageOps.length} operators</p>
                </div>
                <div className="border border-t-0 rounded-b-lg bg-card p-2 space-y-2 min-h-[200px]">
                  {stageOps.map((op) => (
                    <Card
                      key={op.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => setSelectedOperator(op)}
                      data-testid={`card-operator-${op.id}`}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between mb-1">
                          <p className="font-medium text-sm truncate">{op.displayName}</p>
                          <Badge variant="outline" className="text-[10px] shrink-0 ml-1">{op.operatorType}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{op.email}</p>
                        {op.territories.length > 0 && (
                          <div className="mt-2 space-y-0.5">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              <span className="truncate">{op.territories.map(t => t.territory?.code || "?").join(", ")}</span>
                            </div>
                            {op.territories[0]?.city?.aiGuideName && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Bot className="h-3 w-3" />
                                <span className="truncate">AI: {op.territories[0].city.aiGuideName}</span>
                              </div>
                            )}
                          </div>
                        )}
                        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{formatTimeAgo(op.lastContactedAt || op.updatedAt)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {stageOps.length === 0 && (
                    <div className="text-center py-6 text-xs text-muted-foreground">
                      No operators
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Name</th>
                    <th className="text-left p-3 font-medium">Email</th>
                    <th className="text-left p-3 font-medium">Type</th>
                    <th className="text-left p-3 font-medium">Stage</th>
                    <th className="text-left p-3 font-medium">Territory</th>
                    <th className="text-left p-3 font-medium">AI Guide</th>
                    <th className="text-left p-3 font-medium">Last Contact</th>
                    <th className="text-left p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {operators.map((op) => (
                    <tr key={op.id} className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => setSelectedOperator(op)}>
                      <td className="p-3 font-medium">{op.displayName}</td>
                      <td className="p-3 text-muted-foreground">{op.email}</td>
                      <td className="p-3"><Badge variant="outline">{op.operatorType}</Badge></td>
                      <td className="p-3"><StageBadge stage={op.pipelineStage} /></td>
                      <td className="p-3 text-muted-foreground">
                        {op.territories.map(t => t.territory?.code || "?").join(", ") || "—"}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {op.territories.find(t => t.city?.aiGuideName)?.city?.aiGuideName || "—"}
                      </td>
                      <td className="p-3 text-muted-foreground">{formatTimeAgo(op.lastContactedAt)}</td>
                      <td className="p-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-actions-${op.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedOperator(op); }}>
                              <Eye className="h-4 w-4 mr-2" /> View Details
                            </DropdownMenuItem>
                            {op.pipelineStage !== "ACTIVE" && (
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); inviteMutation.mutate(op.id); }}>
                                <Send className="h-4 w-4 mr-2" /> Send Invite
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {op.status !== "SUSPENDED" && (
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); moveToStage(op, "SUSPENDED"); }} className="text-destructive">
                                <Ban className="h-4 w-4 mr-2" /> Suspend
                              </DropdownMenuItem>
                            )}
                            {op.pipelineStage === "SUSPENDED" && (
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); moveToStage(op, "PROSPECT"); }}>
                                <RefreshCw className="h-4 w-4 mr-2" /> Reactivate
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                  {operators.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        No operators yet. Click "Add Operator" to create your first one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Operator</DialogTitle>
            <DialogDescription>Create a new operator prospect for the licensing pipeline.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input
                value={createForm.displayName}
                onChange={(e) => setCreateForm(f => ({ ...f, displayName: e.target.value }))}
                placeholder="John Smith"
                data-testid="input-create-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm(f => ({ ...f, email: e.target.value }))}
                placeholder="john@example.com"
                data-testid="input-create-email"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Operator Type</Label>
                <Select value={createForm.operatorType} onValueChange={(v) => setCreateForm(f => ({ ...f, operatorType: v }))}>
                  <SelectTrigger data-testid="select-create-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="METRO">Metro</SelectItem>
                    <SelectItem value="MICRO">Micro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Initial Stage</Label>
                <Select value={createForm.pipelineStage} onValueChange={(v) => setCreateForm(f => ({ ...f, pipelineStage: v }))}>
                  <SelectTrigger data-testid="select-create-stage">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PIPELINE_STAGES.filter(s => s !== "ACTIVE" && s !== "SUSPENDED").map(s => (
                      <SelectItem key={s} value={s}>{stageConfig[s].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Assign Territory (optional)</Label>
              <Select value={createForm.territoryId} onValueChange={(v) => setCreateForm(f => ({ ...f, territoryId: v }))}>
                <SelectTrigger data-testid="select-create-territory">
                  <SelectValue placeholder="Select territory..." />
                </SelectTrigger>
                <SelectContent>
                  {allTerritories
                    .filter(t => t.type === createForm.operatorType)
                    .map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name} ({t.code})</SelectItem>
                    ))}
                  {allTerritories.filter(t => t.type === createForm.operatorType).length === 0 && (
                    <SelectItem value="_none" disabled>No {createForm.operatorType.toLowerCase()} territories</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate(createForm)}
              disabled={!createForm.displayName || !createForm.email || createMutation.isPending}
              data-testid="button-submit-create-operator"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Create Operator
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedOperator} onOpenChange={() => setSelectedOperator(null)}>
        <DialogContent className="max-w-lg">
          {selectedOperator && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedOperator.displayName}
                  <StageBadge stage={selectedOperator.pipelineStage} />
                </DialogTitle>
                <DialogDescription>{selectedOperator.email}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Type</span>
                    <p className="font-medium">{selectedOperator.operatorType}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status</span>
                    <p className="font-medium">{selectedOperator.status}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Created</span>
                    <p className="font-medium">{formatDate(selectedOperator.createdAt)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last Login</span>
                    <p className="font-medium">{formatTimeAgo(selectedOperator.lastLoginAt)}</p>
                  </div>
                </div>

                {selectedOperator.territories.length > 0 && (
                  <div>
                    <Label className="text-muted-foreground text-xs">Territories & City</Label>
                    <div className="mt-1 space-y-2">
                      {selectedOperator.territories.map(t => (
                        <div key={t.id} className="p-2 bg-muted rounded-lg space-y-1">
                          <div className="flex items-center gap-2 text-sm">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium">{t.territory?.name || t.territoryId}</span>
                            <Badge variant="outline" className="text-[10px]">{t.territory?.type}</Badge>
                            <Badge variant="outline" className="text-[10px]">{t.exclusivity}</Badge>
                          </div>
                          {t.city && (
                            <div className="flex flex-col gap-0.5 text-xs text-muted-foreground pl-5">
                              <div className="flex items-center gap-3">
                                <span className="flex items-center gap-1">
                                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: t.city.primaryColor || "#2563eb" }} />
                                  {t.city.name}
                                </span>
                                {t.city.aiGuideName && (
                                  <span className="flex items-center gap-1">
                                    <Bot className="h-3 w-3" />
                                    AI: <strong>{t.city.aiGuideName}</strong>
                                  </span>
                                )}
                              </div>
                              {(t.city.siteUrl || t.city.emailDomain) && (
                                <div className="flex items-center gap-3">
                                  {t.city.siteUrl && <span>{t.city.siteUrl}</span>}
                                  {t.city.emailDomain && <span>Email: {t.city.emailDomain}</span>}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <Label className="text-muted-foreground text-xs">Move to Stage</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {PIPELINE_STAGES.map(stage => (
                      <Button
                        key={stage}
                        variant={selectedOperator.pipelineStage === stage ? "default" : "outline"}
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => moveToStage(selectedOperator, stage)}
                        disabled={selectedOperator.pipelineStage === stage}
                        data-testid={`button-move-to-${stage.toLowerCase()}`}
                      >
                        {stageConfig[stage].label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  {selectedOperator.pipelineStage !== "ACTIVE" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => inviteMutation.mutate(selectedOperator.id)}
                      disabled={inviteMutation.isPending}
                      data-testid="button-send-invite"
                    >
                      {inviteMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                      Send Invite
                    </Button>
                  )}
                </div>

                <div>
                  <Label className="text-muted-foreground text-xs">Activity Notes</Label>
                  <div className="mt-1 flex gap-2">
                    <Input
                      placeholder="Add a note..."
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") addNote(selectedOperator); }}
                      data-testid="input-pipeline-note"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => addNote(selectedOperator)}
                      disabled={!noteText.trim()}
                      data-testid="button-add-note"
                    >
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                  </div>
                  {selectedOperator.pipelineNotes && (
                    <div className="mt-2 p-3 bg-muted rounded-lg max-h-32 overflow-y-auto">
                      <pre className="text-xs whitespace-pre-wrap font-mono">{selectedOperator.pipelineNotes}</pre>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
