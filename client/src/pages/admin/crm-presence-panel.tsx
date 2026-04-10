import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PresenceSpine } from "./presence-spine";
import { PresenceAudit } from "./presence-audit";
import {
  Building2, Filter, Loader2, Plus, CheckCircle, Clock, MessageSquare, ListTodo,
} from "lucide-react";
import { useState } from "react";

interface CrmPresenceRow {
  id: string;
  presenceId: string;
  stage: string;
  priority: string;
  ownerUserId: string | null;
  primaryRegionId: string | null;
  source: string | null;
  business: {
    id: string;
    name: string;
    slug: string;
    claimStatus: string;
    charlotteVerificationStatus: string;
    micrositeTier: string;
    listingTier: string;
    presenceType: string;
  };
  publicLabel: string;
  claimLabel: string;
}

interface CrmTask {
  id: string;
  presenceId: string;
  title: string;
  dueAt: string | null;
  status: string;
  assignedToUserId: string | null;
  createdByUserId: string | null;
  createdAt: string;
}

interface CrmActivityEntry {
  id: string;
  presenceId: string;
  activityType: string;
  notes: string | null;
  createdByUserId: string | null;
  createdAt: string;
}

const CRM_STAGES = [
  "intake", "assigned", "contacted", "engaged", "awaiting_info",
  "claimed_confirmed", "charlotte_verified", "offer_presented",
  "active", "renewal_due", "closed_lost",
];

const CRM_PRIORITIES = ["low", "med", "high"];

const ACTIVITY_TYPES = ["call", "email", "visit", "note"];

function stageVariant(stage: string): "default" | "secondary" | "outline" {
  if (["active", "charlotte_verified"].includes(stage)) return "default";
  if (["contacted", "engaged", "assigned", "offer_presented"].includes(stage)) return "secondary";
  return "outline";
}

function priorityVariant(p: string): "default" | "secondary" | "outline" | "destructive" {
  if (p === "high") return "destructive";
  if (p === "med") return "secondary";
  return "outline";
}

function formatDate(d: string | null) {
  if (!d) return "N/A";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function TasksTab({ presenceId }: { presenceId: string }) {
  const { toast } = useToast();
  const [newTitle, setNewTitle] = useState("");
  const [newDue, setNewDue] = useState("");

  const { data: tasks, isLoading } = useQuery<CrmTask[]>({
    queryKey: ["/api/admin/crm-tasks", presenceId],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, any> = { presenceId, title: newTitle };
      if (newDue) body.dueAt = new Date(newDue).toISOString();
      await apiRequest("POST", "/api/admin/crm-tasks", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crm-tasks", presenceId] });
      toast({ title: "Task created" });
      setNewTitle("");
      setNewDue("");
    },
    onError: () => toast({ title: "Failed to create task", variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const newStatus = status === "OPEN" ? "DONE" : "OPEN";
      await apiRequest("PATCH", `/api/admin/crm-tasks/${id}`, { status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crm-tasks", presenceId] });
    },
  });

  if (isLoading) return <Skeleton className="h-20 w-full" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          placeholder="Task title"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          className="flex-1 min-w-[180px]"
          data-testid="input-new-task-title"
        />
        <Input
          type="date"
          value={newDue}
          onChange={(e) => setNewDue(e.target.value)}
          className="w-36"
          data-testid="input-new-task-due"
        />
        <Button
          size="sm"
          onClick={() => createMutation.mutate()}
          disabled={!newTitle || createMutation.isPending}
          data-testid="button-create-task"
        >
          {createMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
          Add
        </Button>
      </div>

      {tasks && tasks.length > 0 ? (
        <div className="space-y-1.5">
          {tasks.map(task => (
            <div
              key={task.id}
              className="flex items-center justify-between gap-2 text-sm p-2 rounded-md border flex-wrap"
              data-testid={`row-task-${task.id}`}
            >
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => toggleMutation.mutate({ id: task.id, status: task.status })}
                  data-testid={`button-toggle-task-${task.id}`}
                >
                  <CheckCircle className={`h-4 w-4 ${task.status === "DONE" ? "text-green-600" : "text-muted-foreground"}`} />
                </Button>
                <span className={task.status === "DONE" ? "line-through text-muted-foreground" : ""}>
                  {task.title}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {task.dueAt && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                    <Clock className="h-2.5 w-2.5" />
                    {formatDate(task.dueAt)}
                  </span>
                )}
                <Badge variant="outline" className="text-[10px]">{task.status}</Badge>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-4">No tasks yet</p>
      )}
    </div>
  );
}

function ActivityTab({ presenceId }: { presenceId: string }) {
  const { toast } = useToast();
  const [newType, setNewType] = useState("note");
  const [newNotes, setNewNotes] = useState("");

  const { data: activities, isLoading } = useQuery<CrmActivityEntry[]>({
    queryKey: ["/api/admin/crm-activity", presenceId],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/crm-activity", {
        presenceId,
        activityType: newType,
        notes: newNotes || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crm-activity", presenceId] });
      toast({ title: "Activity logged" });
      setNewNotes("");
    },
    onError: () => toast({ title: "Failed to log activity", variant: "destructive" }),
  });

  if (isLoading) return <Skeleton className="h-20 w-full" />;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={newType} onValueChange={setNewType}>
            <SelectTrigger className="w-32" data-testid="select-activity-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTIVITY_TYPES.map(t => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            data-testid="button-log-activity"
          >
            {createMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
            Log
          </Button>
        </div>
        <Textarea
          placeholder="Notes (optional)"
          value={newNotes}
          onChange={(e) => setNewNotes(e.target.value)}
          className="resize-none text-sm"
          rows={2}
          data-testid="input-activity-notes"
        />
      </div>

      {activities && activities.length > 0 ? (
        <div className="space-y-1.5">
          {activities.map(a => (
            <div
              key={a.id}
              className="flex items-start justify-between gap-2 text-sm p-2 rounded-md border"
              data-testid={`row-activity-${a.id}`}
            >
              <div className="flex items-start gap-2 min-w-0">
                <Badge variant="outline" className="text-[10px] shrink-0">{a.activityType}</Badge>
                <span className="text-xs break-words">{a.notes || "(no notes)"}</span>
              </div>
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                {formatDate(a.createdAt)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-4">No activity logged</p>
      )}
    </div>
  );
}

export default function CrmPresencePanel({ cityId }: { cityId?: string }) {
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [selectedPresenceId, setSelectedPresenceId] = useState<string | null>(null);

  const { data: rows, isLoading } = useQuery<CrmPresenceRow[]>({
    queryKey: ["/api/admin/crm-presences"],
  });

  const filtered = (rows || []).filter(r => {
    if (stageFilter !== "all" && r.stage !== stageFilter) return false;
    if (priorityFilter !== "all" && r.priority !== priorityFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Building2 className="h-5 w-5" /> CRM Presences
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-36" data-testid="select-stage-filter">
                <SelectValue placeholder="All stages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stages</SelectItem>
                {CRM_STAGES.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-28" data-testid="select-priority-filter">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {CRM_PRIORITIES.map(p => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-1.5">
          {filtered.map(row => (
            <Card
              key={row.id}
              className="p-3 hover-elevate cursor-pointer"
              onClick={() => setSelectedPresenceId(row.presenceId)}
              data-testid={`card-crm-presence-${row.presenceId}`}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-sm truncate" data-testid={`text-biz-name-${row.presenceId}`}>
                    {row.business.name}
                  </span>
                  <Badge variant={stageVariant(row.stage)} className="text-[10px]">{row.stage}</Badge>
                  <Badge variant={priorityVariant(row.priority)} className="text-[10px]">{row.priority}</Badge>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[10px]">{row.business.micrositeTier}</Badge>
                  <Badge variant="secondary" className="text-[10px]">{row.publicLabel}</Badge>
                  <Badge variant="outline" className="text-[10px]">{row.claimLabel}</Badge>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <Building2 className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No CRM presences found</p>
        </Card>
      )}

      <Sheet open={!!selectedPresenceId} onOpenChange={(open) => { if (!open) setSelectedPresenceId(null); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto" side="right">
          <SheetHeader>
            <SheetTitle>Presence Detail</SheetTitle>
          </SheetHeader>
          {selectedPresenceId && (
            <Tabs defaultValue="spine" className="mt-4">
              <TabsList className="w-full">
                <TabsTrigger value="spine" className="flex-1" data-testid="tab-spine">
                  Spine
                </TabsTrigger>
                <TabsTrigger value="history" className="flex-1" data-testid="tab-history">
                  History
                </TabsTrigger>
                <TabsTrigger value="tasks" className="flex-1" data-testid="tab-tasks">
                  <ListTodo className="h-3.5 w-3.5 mr-1" /> Tasks
                </TabsTrigger>
                <TabsTrigger value="activity" className="flex-1" data-testid="tab-activity">
                  <MessageSquare className="h-3.5 w-3.5 mr-1" /> Activity
                </TabsTrigger>
              </TabsList>

              <TabsContent value="spine" className="mt-4">
                <PresenceSpine
                  presenceId={selectedPresenceId}
                  onClose={() => setSelectedPresenceId(null)}
                />
              </TabsContent>

              <TabsContent value="history" className="mt-4">
                <PresenceAudit presenceId={selectedPresenceId} />
              </TabsContent>

              <TabsContent value="tasks" className="mt-4">
                <TasksTab presenceId={selectedPresenceId} />
              </TabsContent>

              <TabsContent value="activity" className="mt-4">
                <ActivityTab presenceId={selectedPresenceId} />
              </TabsContent>
            </Tabs>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
