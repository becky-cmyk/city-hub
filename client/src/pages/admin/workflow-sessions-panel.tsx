import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ChevronDown, ChevronUp, Activity, Clock, CheckCircle, AlertCircle, Pause } from "lucide-react";

interface WorkflowSession {
  id: string;
  cityId: string;
  source: string;
  currentStep: string;
  status: string;
  entityId: string | null;
  entityType: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactName: string | null;
  businessName: string | null;
  matchedBusinessId: string | null;
  identityRole: string | null;
  presenceType: string | null;
  sessionData: Record<string, unknown>;
  chatSessionId: string | null;
  flowSessionId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface WorkflowEvent {
  id: string;
  sessionId: string;
  fromStep: string | null;
  toStep: string | null;
  eventType: string;
  eventData: Record<string, unknown> | null;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  paused: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  abandoned: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
  error: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const STATUS_ICONS: Record<string, typeof Activity> = {
  active: Activity,
  paused: Pause,
  completed: CheckCircle,
  abandoned: AlertCircle,
  error: AlertCircle,
};

const SOURCES = ["activate", "claim", "story", "crown", "qr", "cta", "event", "job", "publication"];
const STATUSES = ["active", "paused", "completed", "abandoned", "error"];
const PRESENCE_TYPES = ["commerce", "organization"];

function EventTimeline({ sessionId }: { sessionId: string }) {
  const { data, isLoading } = useQuery<{ events: WorkflowEvent[] }>({
    queryKey: ["/api/admin/workflow-sessions", sessionId, "events"],
    queryFn: async () => {
      const resp = await fetch(`/api/admin/workflow-sessions/${sessionId}/events`, { credentials: "include" });
      if (!resp.ok) throw new Error("Failed to fetch events");
      return resp.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  const events = data?.events || [];

  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground py-2">No events recorded</p>;
  }

  return (
    <div className="space-y-2 pl-4 border-l-2 border-muted" data-testid="event-timeline">
      {events.map((evt) => (
        <div key={evt.id} className="relative pl-4" data-testid={`event-${evt.id}`}>
          <div className="absolute -left-[9px] top-1.5 w-3 h-3 rounded-full bg-[#5B1D8F]" />
          <div className="text-sm">
            <span className="font-medium">{evt.eventType.replace(/_/g, " ")}</span>
            {evt.fromStep && evt.toStep && evt.fromStep !== evt.toStep && (
              <span className="text-muted-foreground ml-1">
                {evt.fromStep} → {evt.toStep}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {new Date(evt.createdAt).toLocaleString()}
          </div>
          {evt.eventData && Object.keys(evt.eventData).length > 0 && (
            <div className="text-xs text-muted-foreground mt-0.5 bg-muted/30 rounded px-2 py-1">
              {Object.entries(evt.eventData).map(([k, v]) => (
                <span key={k} className="mr-3">{k}: {String(v)}</span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SessionRow({ session }: { session: WorkflowSession }) {
  const [expanded, setExpanded] = useState(false);
  const StatusIcon = STATUS_ICONS[session.status] || Activity;

  return (
    <div className="border rounded-lg overflow-hidden" data-testid={`session-row-${session.id}`}>
      <button
        type="button"
        className="w-full text-left p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
        data-testid={`button-expand-${session.id}`}
      >
        <StatusIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-4 gap-1 sm:gap-3">
          <div>
            <div className="font-medium text-sm truncate" data-testid={`text-session-name-${session.id}`}>
              {session.businessName || session.contactName || session.contactEmail || "Unknown"}
            </div>
            <div className="text-xs text-muted-foreground">{session.source}</div>
          </div>
          <div>
            <Badge variant="outline" className="text-xs" data-testid={`badge-step-${session.id}`}>
              {session.currentStep.replace(/_/g, " ")}
            </Badge>
          </div>
          <div>
            <Badge className={`text-xs ${STATUS_COLORS[session.status] || ""}`} data-testid={`badge-status-${session.id}`}>
              {session.status}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground" data-testid={`text-date-${session.id}`}>
            {new Date(session.createdAt).toLocaleDateString()}
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t p-4 space-y-3 bg-muted/10" data-testid={`session-details-${session.id}`}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            {session.contactEmail && (
              <div>
                <span className="text-muted-foreground text-xs block">Email</span>
                <span data-testid={`text-email-${session.id}`}>{session.contactEmail}</span>
              </div>
            )}
            {session.contactPhone && (
              <div>
                <span className="text-muted-foreground text-xs block">Phone</span>
                <span data-testid={`text-phone-${session.id}`}>{session.contactPhone}</span>
              </div>
            )}
            {session.identityRole && (
              <div>
                <span className="text-muted-foreground text-xs block">Role</span>
                <span data-testid={`text-role-${session.id}`}>{session.identityRole}</span>
              </div>
            )}
            {session.presenceType && (
              <div>
                <span className="text-muted-foreground text-xs block">Presence Type</span>
                <span data-testid={`text-presence-${session.id}`}>{session.presenceType}</span>
              </div>
            )}
            {session.matchedBusinessId && (
              <div>
                <span className="text-muted-foreground text-xs block">Matched Business</span>
                <span className="font-mono text-xs" data-testid={`text-matched-${session.id}`}>{session.matchedBusinessId.slice(0, 8)}...</span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground text-xs block">Session ID</span>
              <span className="font-mono text-xs" data-testid={`text-id-${session.id}`}>{session.id.slice(0, 8)}...</span>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-2">Event Timeline</h4>
            <EventTimeline sessionId={session.id} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function WorkflowSessionsPanel({ cityId }: { cityId: string }) {
  const [sourceFilter, setSourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [presenceFilter, setPresenceFilter] = useState("all");
  const [page, setPage] = useState(0);
  const limit = 25;

  const queryParams = new URLSearchParams({ cityId });
  if (sourceFilter !== "all") queryParams.set("source", sourceFilter);
  if (statusFilter !== "all") queryParams.set("status", statusFilter);
  if (presenceFilter !== "all") queryParams.set("presenceType", presenceFilter);
  queryParams.set("limit", String(limit));
  queryParams.set("offset", String(page * limit));

  const { data, isLoading } = useQuery<{ sessions: WorkflowSession[]; total: number }>({
    queryKey: ["/api/admin/workflow-sessions", cityId, sourceFilter, statusFilter, presenceFilter, page],
    queryFn: async () => {
      const resp = await fetch(`/api/admin/workflow-sessions?${queryParams.toString()}`, { credentials: "include" });
      if (!resp.ok) throw new Error("Failed to fetch");
      return resp.json();
    },
  });

  const sessions = data?.sessions || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4" data-testid="workflow-sessions-panel">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" data-testid="text-workflow-title">Workflow Sessions</h2>
          <p className="text-sm text-muted-foreground">Track every onboarding and activation flow</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" data-testid="badge-total">{total} total</Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[140px]" data-testid="select-source-filter">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {SOURCES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={presenceFilter} onValueChange={(v) => { setPresenceFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[160px]" data-testid="select-presence-filter">
            <SelectValue placeholder="Participation" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {PRESENCE_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{t === "commerce" ? "Business / Commerce" : "Organization / Nonprofit"}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Clock className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground" data-testid="text-no-sessions">No workflow sessions found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => (
            <SessionRow key={s.id} session={s} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2" data-testid="pagination">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
            data-testid="button-prev-page"
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground" data-testid="text-page-info">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(page + 1)}
            data-testid="button-next-page"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
