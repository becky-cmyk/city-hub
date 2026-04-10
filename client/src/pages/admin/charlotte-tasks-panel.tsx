import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  ListChecks, Clock, CheckCircle, XCircle, Play, RefreshCw,
  AlertTriangle, Loader2, ChevronDown, ChevronUp, ThumbsUp,
  ThumbsDown, MessageSquare, RotateCcw, Trash2,
} from "lucide-react";

interface TaskStep {
  description: string;
  engine?: string;
}

interface CharlotteTask {
  id: string;
  type: string;
  title: string;
  status: string;
  payload: Record<string, unknown>;
  proposedPlan: { steps: TaskStep[] } | null;
  result: Record<string, unknown> | null;
  error: string | null;
  progress: number;
  operatorFeedback: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  retryCount: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  awaiting_approval: { label: "Awaiting Approval", color: "bg-amber-100 text-amber-800 border-amber-200", icon: Clock },
  pending: { label: "Pending", color: "bg-blue-100 text-blue-800 border-blue-200", icon: Play },
  running: { label: "Running", color: "bg-violet-100 text-violet-800 border-violet-200", icon: Loader2 },
  completed: { label: "Completed", color: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle },
  failed: { label: "Failed", color: "bg-red-100 text-red-800 border-red-200", icon: XCircle },
  cancelled: { label: "Rejected", color: "bg-gray-100 text-gray-600 border-gray-200", icon: ThumbsDown },
};

const TYPE_LABELS: Record<string, string> = {
  capture_processing: "Capture Processing",
  followup_generation: "Follow-up Generation",
  proposal_generation: "Proposal Generation",
  story_generation: "Story Generation",
  outreach_drafting: "Outreach Drafting",
  general: "General",
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || { label: status, color: "bg-gray-100 text-gray-700 border-gray-200", icon: AlertTriangle };
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={`${config.color} border gap-1`} data-testid={`badge-status-${status}`}>
      <Icon className={`h-3 w-3 ${status === "running" ? "animate-spin" : ""}`} />
      {config.label}
    </Badge>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden" data-testid="progress-bar">
      <div
        className="h-full rounded-full bg-violet-500 transition-all duration-300"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

function TaskCard({ task, onRefresh }: { task: CharlotteTask; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const { toast } = useToast();

  const approveMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/admin/charlotte/tasks/${task.id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/charlotte/tasks"] });
      toast({ title: "Task approved", description: "Charlotte will start working on it shortly." });
      onRefresh();
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/admin/charlotte/tasks/${task.id}/reject`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/charlotte/tasks"] });
      toast({ title: "Task rejected" });
      onRefresh();
    },
  });

  const retryMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/admin/charlotte/tasks/${task.id}/retry`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/charlotte/tasks"] });
      toast({ title: "Task queued for retry" });
      onRefresh();
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: (feedback: string) =>
      apiRequest("POST", `/api/admin/charlotte/tasks/${task.id}/feedback`, { feedback }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/charlotte/tasks"] });
      toast({ title: "Feedback recorded" });
      setFeedbackText("");
      setShowFeedback(false);
      onRefresh();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/admin/charlotte/tasks/${task.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/charlotte/tasks"] });
      toast({ title: "Task removed" });
      onRefresh();
    },
  });

  const plan = task.proposedPlan;
  const timeAgo = formatTimeAgo(task.createdAt);

  return (
    <Card className="border" data-testid={`card-task-${task.id}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm truncate" data-testid={`text-task-title-${task.id}`}>{task.title}</span>
              <StatusBadge status={task.status} />
              <Badge variant="outline" className="text-xs">{TYPE_LABELS[task.type] || task.type}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1" data-testid={`text-task-time-${task.id}`}>{timeAgo}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setExpanded(!expanded)}
            data-testid={`button-expand-${task.id}`}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        {(task.status === "running" || task.progress > 0) && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>{task.progress}%</span>
            </div>
            <ProgressBar value={task.progress} />
          </div>
        )}

        {task.status === "awaiting_approval" && (
          <div className="flex gap-2">
            <Button
              size="sm"
              className="h-8"
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
              data-testid={`button-approve-${task.id}`}
            >
              <ThumbsUp className="h-3.5 w-3.5 mr-1.5" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => rejectMutation.mutate()}
              disabled={rejectMutation.isPending}
              data-testid={`button-reject-${task.id}`}
            >
              <ThumbsDown className="h-3.5 w-3.5 mr-1.5" />
              Reject
            </Button>
          </div>
        )}

        {expanded && (
          <div className="space-y-3 pt-2 border-t">
            {plan && plan.steps && plan.steps.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1.5">Plan</p>
                <ol className="space-y-1">
                  {plan.steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <span className="text-muted-foreground w-4 text-right shrink-0">{i + 1}.</span>
                      <span>{step.description}</span>
                      {step.engine && (
                        <Badge variant="outline" className="text-[10px] ml-auto shrink-0">{step.engine}</Badge>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {task.result && (
              <div>
                <p className="text-xs font-medium mb-1">Result</p>
                <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-32" data-testid={`text-result-${task.id}`}>
                  {JSON.stringify(task.result, null, 2)}
                </pre>
              </div>
            )}

            {task.error && (
              <div>
                <p className="text-xs font-medium text-red-600 mb-1">Error</p>
                <p className="text-xs text-red-600 bg-red-50 p-2 rounded" data-testid={`text-error-${task.id}`}>{task.error}</p>
              </div>
            )}

            {task.operatorFeedback && (
              <div>
                <p className="text-xs font-medium mb-1">Feedback</p>
                <p className="text-xs bg-blue-50 p-2 rounded">{task.operatorFeedback}</p>
              </div>
            )}

            <div className="flex gap-2 flex-wrap">
              {task.status === "failed" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => retryMutation.mutate()}
                  disabled={retryMutation.isPending}
                  data-testid={`button-retry-${task.id}`}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Retry
                </Button>
              )}
              {(task.status === "completed" || task.status === "failed") && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8"
                  onClick={() => setShowFeedback(!showFeedback)}
                  data-testid={`button-feedback-toggle-${task.id}`}
                >
                  <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                  Feedback
                </Button>
              )}
              {(task.status === "completed" || task.status === "failed" || task.status === "cancelled") && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-red-600 hover:text-red-700"
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  data-testid={`button-delete-${task.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Remove
                </Button>
              )}
            </div>

            {showFeedback && (
              <div className="flex gap-2">
                <Textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Tell Charlotte what to adjust next time..."
                  className="text-xs min-h-[60px]"
                  data-testid={`input-feedback-${task.id}`}
                />
                <Button
                  size="sm"
                  className="h-8 self-end"
                  disabled={!feedbackText.trim() || feedbackMutation.isPending}
                  onClick={() => feedbackMutation.mutate(feedbackText.trim())}
                  data-testid={`button-submit-feedback-${task.id}`}
                >
                  Send
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatTimeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

type FilterStatus = "all" | "awaiting_approval" | "pending" | "running" | "completed" | "failed" | "cancelled";

const FILTER_OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: "all", label: "All Tasks" },
  { value: "awaiting_approval", label: "Awaiting Approval" },
  { value: "running", label: "Running" },
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Rejected" },
];

export default function CharlotteTasksPanel() {
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");

  const tasksQuery = useQuery<CharlotteTask[]>({
    queryKey: ["/api/admin/charlotte/tasks", statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/admin/charlotte/tasks?${params}`);
      if (!res.ok) throw new Error("Failed to load tasks");
      return res.json();
    },
    refetchInterval: 10000,
  });

  const tasks = tasksQuery.data || [];
  const awaitingCount = tasks.filter(t => t.status === "awaiting_approval").length;
  const runningCount = tasks.filter(t => t.status === "running").length;

  return (
    <div className="space-y-4" data-testid="charlotte-tasks-panel">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListChecks className="h-5 w-5" />
          <h2 className="text-lg font-semibold" data-testid="text-panel-title">Charlotte Tasks</h2>
          {awaitingCount > 0 && (
            <Badge className="bg-amber-100 text-amber-800 border border-amber-200">{awaitingCount} pending approval</Badge>
          )}
          {runningCount > 0 && (
            <Badge className="bg-violet-100 text-violet-800 border border-violet-200">{runningCount} running</Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => tasksQuery.refetch()}
          disabled={tasksQuery.isFetching}
          data-testid="button-refresh-tasks"
        >
          <RefreshCw className={`h-4 w-4 ${tasksQuery.isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {FILTER_OPTIONS.map(opt => (
          <Button
            key={opt.value}
            variant={statusFilter === opt.value ? "default" : "outline"}
            size="sm"
            className="h-8 text-xs"
            onClick={() => setStatusFilter(opt.value)}
            data-testid={`button-filter-${opt.value}`}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {tasksQuery.isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <ListChecks className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground" data-testid="text-empty-state">
              {statusFilter === "all"
                ? "No tasks yet. Charlotte will create tasks when you ask her to run background work."
                : `No ${FILTER_OPTIONS.find(o => o.value === statusFilter)?.label?.toLowerCase()} tasks.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} onRefresh={() => tasksQuery.refetch()} />
          ))}
        </div>
      )}
    </div>
  );
}
