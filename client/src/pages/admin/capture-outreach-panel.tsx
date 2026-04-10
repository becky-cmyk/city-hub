import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen, Mail, Calendar, CheckCircle, Clock,
  AlertCircle, Filter, RefreshCw, Send,
} from "lucide-react";
import type { CrmContact } from "@shared/schema";

interface CaptureOutreachResponse {
  captures: CrmContact[];
  statusCounts: Record<string, number>;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  NEW: { label: "New", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  STORY_CREATED: { label: "Story Created", color: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300" },
  STORY_SENT: { label: "Story Sent", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300" },
  APPROVED: { label: "Approved", color: "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300" },
  CORRECTIONS_REQUESTED: { label: "Corrections Requested", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" },
  INVITE_SENT: { label: "Invite Sent", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  OPENED: { label: "Opened", color: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
  BOOKED: { label: "Booked", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  NO_RESPONSE: { label: "No Response", color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
  FOLLOWUP_SENT: { label: "Follow-up Sent", color: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" },
  COMPLETED: { label: "Completed", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.NEW;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`} data-testid={`badge-status-${status}`}>
      {config.label}
    </span>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Clock }) {
  return (
    <Card data-testid={`stat-card-${label.toLowerCase().replace(/\s/g, "-")}`}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
          <Icon className="h-4 w-4 text-slate-600 dark:text-slate-400" />
        </div>
        <div>
          <p className="text-2xl font-bold" data-testid={`stat-value-${label.toLowerCase().replace(/\s/g, "-")}`}>{value}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function CaptureRow({ capture, onAction }: { capture: CrmContact; onAction: (action: string, id: string) => void }) {
  const status = capture.outreachStatus || "NEW";
  const hasEmail = !!capture.email;
  const hasStory = !!capture.linkedArticleId;

  return (
    <div className="flex items-center gap-4 p-4 border-b border-slate-200 dark:border-slate-700 last:border-0" data-testid={`capture-row-${capture.id}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm truncate" data-testid={`capture-name-${capture.id}`}>{capture.name}</p>
          <StatusBadge status={status} />
        </div>
        <div className="flex items-center gap-3 mt-1">
          {capture.company && (
            <span className="text-xs text-slate-500 dark:text-slate-400" data-testid={`capture-company-${capture.id}`}>{capture.company}</span>
          )}
          {capture.email && (
            <span className="text-xs text-slate-500 dark:text-slate-400" data-testid={`capture-email-${capture.id}`}>{capture.email}</span>
          )}
          {capture.connectionSource && (
            <span className="text-xs text-slate-400 dark:text-slate-500">{capture.connectionSource.replace(/_/g, " ")}</span>
          )}
        </div>
        {capture.outreachEmailSentAt && (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            Intro sent {new Date(capture.outreachEmailSentAt).toLocaleDateString()}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {status !== "COMPLETED" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAction("generate-story", capture.id)}
            data-testid={`button-generate-story-${capture.id}`}
          >
            <BookOpen className="h-4 w-4 mr-1" />
            {hasStory ? "Regen Story" : "Story"}
          </Button>
        )}

        {(status === "NEW" || status === "STORY_CREATED") && hasEmail && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAction("send-intro", capture.id)}
            data-testid={`button-send-intro-${capture.id}`}
          >
            <Mail className="h-4 w-4 mr-1" />
            Send Intro
          </Button>
        )}

        {(status === "INVITE_SENT" || status === "FOLLOWUP_SENT" || status === "NO_RESPONSE") && hasEmail && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAction("resend-invite", capture.id)}
            data-testid={`button-resend-intro-${capture.id}`}
          >
            <Send className="h-4 w-4 mr-1" />
            Resend
          </Button>
        )}

        {(status === "INVITE_SENT" || status === "FOLLOWUP_SENT" || status === "OPENED") && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAction("mark-booked", capture.id)}
            data-testid={`button-mark-booked-${capture.id}`}
          >
            <Calendar className="h-4 w-4 mr-1" />
            Booked
          </Button>
        )}

        {status !== "COMPLETED" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAction("mark-completed", capture.id)}
            data-testid={`button-mark-completed-${capture.id}`}
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            Done
          </Button>
        )}
      </div>
    </div>
  );
}

export default function CaptureOutreachPanel({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const queryUrl = cityId ? `/api/outreach/captures?cityId=${cityId}` : "/api/outreach/captures";

  const { data, isLoading } = useQuery<CaptureOutreachResponse>({
    queryKey: [queryUrl],
  });

  const storyMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/outreach/captures/${id}/generate-story`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryUrl] });
      toast({ title: "Story draft created" });
    },
    onError: (err: Error) => toast({ title: "Story generation failed", description: err.message, variant: "destructive" }),
  });

  const introMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/outreach/captures/${id}/send-intro`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryUrl] });
      toast({ title: "Intro email sent" });
    },
    onError: (err: Error) => toast({ title: "Failed to send intro", description: err.message, variant: "destructive" }),
  });

  const resendMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/outreach/captures/${id}/resend-invite`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryUrl] });
      toast({ title: "Invite resent" });
    },
    onError: (err: Error) => toast({ title: "Failed to resend invite", description: err.message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/outreach/captures/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryUrl] });
      toast({ title: "Status updated" });
    },
    onError: (err: Error) => toast({ title: "Status update failed", description: err.message, variant: "destructive" }),
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/outreach/captures/${id}/mark-complete`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryUrl] });
      toast({ title: "Marked as completed" });
    },
    onError: (err: Error) => toast({ title: "Failed to mark complete", description: err.message, variant: "destructive" }),
  });

  function handleAction(action: string, captureId: string) {
    switch (action) {
      case "generate-story":
        storyMutation.mutate(captureId);
        break;
      case "send-intro":
        introMutation.mutate(captureId);
        break;
      case "resend-invite":
        resendMutation.mutate(captureId);
        break;
      case "mark-booked":
        statusMutation.mutate({ id: captureId, status: "BOOKED" });
        break;
      case "mark-completed":
        completeMutation.mutate(captureId);
        break;
    }
  }

  const captures = data?.captures || [];
  const counts = data?.statusCounts || {};
  const isMutating = storyMutation.isPending || introMutation.isPending || resendMutation.isPending || statusMutation.isPending || completeMutation.isPending;

  const filtered = captures.filter(c => {
    if (filterStatus !== "all" && (c.outreachStatus || "NEW") !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const nameMatch = c.name?.toLowerCase().includes(q);
      const companyMatch = c.company?.toLowerCase().includes(q);
      const emailMatch = c.email?.toLowerCase().includes(q);
      if (!nameMatch && !companyMatch && !emailMatch) return false;
    }
    return true;
  });

  const totalNew = counts["NEW"] || 0;
  const totalInvited = (counts["INVITE_SENT"] || 0) + (counts["FOLLOWUP_SENT"] || 0);
  const totalBooked = counts["BOOKED"] || 0;
  const totalCompleted = counts["COMPLETED"] || 0;

  return (
    <div className="space-y-6" data-testid="capture-outreach-panel">
      <div>
        <h2 className="text-lg font-semibold" data-testid="text-outreach-title">Capture Outreach</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Manage outreach lifecycle for field captures -- story generation, Becky intros, and Charlotte follow-ups.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="New Captures" value={totalNew} icon={AlertCircle} />
        <StatCard label="Invited" value={totalInvited} icon={Send} />
        <StatCard label="Booked" value={totalBooked} icon={Calendar} />
        <StatCard label="Completed" value={totalCompleted} icon={CheckCircle} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Outreach Pipeline</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => queryClient.invalidateQueries({ queryKey: [queryUrl] })}
              data-testid="button-refresh-outreach"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <div className="relative flex-1">
              <Input
                placeholder="Search by name, company, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9"
                data-testid="input-search-outreach"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-44 h-9" data-testid="select-filter-status">
                <Filter className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-slate-400" data-testid="text-loading">Loading captures...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400" data-testid="text-empty">
              {searchQuery || filterStatus !== "all" ? "No captures match your filters." : "No captures yet."}
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {filtered.map(capture => (
                <CaptureRow key={capture.id} capture={capture} onAction={handleAction} />
              ))}
            </div>
          )}
          {isMutating && (
            <div className="p-3 bg-slate-50 dark:bg-slate-900 text-center text-sm text-slate-500" data-testid="text-processing">
              Processing...
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
