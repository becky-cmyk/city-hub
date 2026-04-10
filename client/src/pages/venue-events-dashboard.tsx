import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Calendar, Plus, ArrowLeft, Repeat, Clock, MapPin, Check, X,
  ChevronDown, ChevronUp, Copy, QrCode, Loader2, Eye, Pause,
  Archive, Play, Users, Send, FileText, Store, Edit, Bell, BellOff,
} from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { format } from "date-fns";
import { DarkPageShell } from "@/components/dark-page-shell";

interface EventSeriesItem {
  id: string;
  title: string;
  slug: string;
  status: string;
  recurrence_type: string;
  occurrence_count: number;
  next_occurrence?: string;
}

interface SubmissionItem {
  id: string;
  title: string;
  submitter_name?: string;
  submitter_email?: string;
  description?: string;
  proposed_start_date_time?: string;
  is_recurring: boolean;
  status: string;
  created_at: string;
}

export default function VenueEventsDashboard({ citySlug, slug }: { citySlug: string; slug: string }) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"series" | "submissions" | "create">("series");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedSeries, setExpandedSeries] = useState<string | null>(null);

  const { data: seriesList, isLoading: seriesLoading } = useQuery<EventSeriesItem[]>({
    queryKey: ["/api/owner/event-series"],
  });

  const { data: submissions, isLoading: subsLoading } = useQuery<SubmissionItem[]>({
    queryKey: ["/api/owner/venue-submissions"],
  });

  const tabs = [
    { key: "series" as const, label: "Event Series", icon: Repeat, count: seriesList?.length },
    { key: "submissions" as const, label: "Submissions", icon: FileText, count: submissions?.filter(s => s.status === "pending").length },
    { key: "create" as const, label: "Create Series", icon: Plus },
  ];

  return (
    <DarkPageShell>
      <div className="space-y-6">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/${citySlug}/owner/${slug}`}>
            <Button variant="ghost" size="sm" className="text-white/60" data-testid="link-back-dashboard">
              <ArrowLeft className="h-4 w-4 mr-1" /> Dashboard
            </Button>
          </Link>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2" data-testid="text-venue-events-title">
            <Calendar className="h-6 w-6 text-purple-400" />
            Event Management
          </h1>
          <p className="text-white/50 text-sm mt-1">
            Manage event series, review submissions, and generate occurrences
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {tabs.map((tab) => (
            <Button
              key={tab.key}
              variant={activeTab === tab.key ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab(tab.key)}
              className={activeTab !== tab.key ? "border-white/10 text-white/60" : ""}
              data-testid={`tab-${tab.key}`}
            >
              <tab.icon className="h-4 w-4 mr-1" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] text-[10px] bg-purple-500/30 text-purple-200">
                  {tab.count}
                </Badge>
              )}
            </Button>
          ))}
        </div>

        {activeTab === "series" && (
          <SeriesTab
            series={seriesList || []}
            isLoading={seriesLoading}
            citySlug={citySlug}
            expandedSeries={expandedSeries}
            setExpandedSeries={setExpandedSeries}
          />
        )}

        {activeTab === "submissions" && (
          <SubmissionsTab
            submissions={submissions || []}
            isLoading={subsLoading}
            citySlug={citySlug}
          />
        )}

        {activeTab === "create" && (
          <CreateSeriesTab citySlug={citySlug} slug={slug} />
        )}
      </div>
    </DarkPageShell>
  );
}

function SeriesTab({
  series,
  isLoading,
  citySlug,
  expandedSeries,
  setExpandedSeries,
}: {
  series: EventSeriesItem[];
  isLoading: boolean;
  citySlug: string;
  expandedSeries: string | null;
  setExpandedSeries: (id: string | null) => void;
}) {
  const { toast } = useToast();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full bg-white/10 rounded-md" />
        ))}
      </div>
    );
  }

  if (series.length === 0) {
    return (
      <Card className="p-12 text-center bg-white/5 border-white/10">
        <Repeat className="h-12 w-12 text-white/20 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white mb-1" data-testid="text-no-series">No Event Series Yet</h3>
        <p className="text-white/50 text-sm">Create your first recurring event series to get started</p>
      </Card>
    );
  }

  const STATUS_COLORS: Record<string, string> = {
    active: "bg-green-500/20 text-green-300 border-green-500/30",
    draft: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    paused: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    archived: "bg-gray-500/20 text-gray-300 border-gray-500/30",
  };

  return (
    <div className="space-y-3">
      {series.map((s) => (
        <Card key={s.id} className="bg-white/5 border-white/10" data-testid={`card-series-${s.id}`}>
          <div
            className="p-4 flex items-center justify-between cursor-pointer"
            onClick={() => setExpandedSeries(expandedSeries === s.id ? null : s.id)}
          >
            <div className="space-y-1">
              <h3 className="font-semibold text-white">{s.title}</h3>
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <Badge variant="outline" className={STATUS_COLORS[s.status] || ""}>{s.status}</Badge>
                <span className="text-white/40 flex items-center gap-1">
                  <Repeat className="h-3 w-3" /> {s.recurrence_type}
                </span>
                <span className="text-white/40">{s.occurrence_count} occurrences</span>
                {s.next_occurrence && (
                  <span className="text-purple-300 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Next: {format(new Date(s.next_occurrence), "MMM d")}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-white/40"
                onClick={(e) => {
                  e.stopPropagation();
                  const url = `${window.location.origin}/${citySlug}/events/series/${s.slug}`;
                  navigator.clipboard.writeText(url);
                  toast({ title: "Link copied" });
                }}
                data-testid={`button-copy-link-${s.id}`}
              >
                <Copy className="h-4 w-4" />
              </Button>
              {expandedSeries === s.id ? (
                <ChevronUp className="h-4 w-4 text-white/40" />
              ) : (
                <ChevronDown className="h-4 w-4 text-white/40" />
              )}
            </div>
          </div>

          {expandedSeries === s.id && (
            <SeriesExpandedView seriesId={s.id} seriesSlug={s.slug} citySlug={citySlug} seriesStatus={s.status} />
          )}
        </Card>
      ))}
    </div>
  );
}

function SeriesExpandedView({ seriesId, seriesSlug, citySlug, seriesStatus }: { seriesId: string; seriesSlug: string; citySlug: string; seriesStatus: string }) {
  const { toast } = useToast();

  const { data: occurrences, isLoading } = useQuery<any[]>({
    queryKey: ["/api/owner/event-series", seriesId, "occurrences"],
    queryFn: async () => {
      const resp = await fetch(`/api/owner/event-series/${seriesId}/occurrences`);
      if (!resp.ok) return [];
      return resp.json();
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", `/api/owner/event-series/${seriesId}/generate-occurrences`, { count: 8 });
      return resp.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/event-series", seriesId, "occurrences"] });
      queryClient.invalidateQueries({ queryKey: ["/api/owner/event-series"] });
      toast({ title: `Generated ${data.generated} occurrence(s)` });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ newStatus }: { newStatus: string }) => {
      const resp = await apiRequest("PATCH", `/api/owner/event-series/${seriesId}`, { status: newStatus });
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/event-series"] });
      toast({ title: "Series status updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const occStatusMutation = useMutation({
    mutationFn: async ({ eventId, occurrenceStatus }: { eventId: string; occurrenceStatus: string }) => {
      const resp = await apiRequest("PATCH", `/api/owner/event-series/${seriesId}/occurrences/${eventId}`, { occurrenceStatus });
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/event-series", seriesId, "occurrences"] });
      toast({ title: "Occurrence updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const occDetailMutation = useMutation({
    mutationFn: async ({ eventId, details }: { eventId: string; details: Record<string, any> }) => {
      const resp = await apiRequest("PATCH", `/api/owner/event-series/${seriesId}/occurrences/${eventId}/details`, details);
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/event-series", seriesId, "occurrences"] });
      toast({ title: "Occurrence details updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const pulseMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", `/api/owner/event-series/${seriesId}/pulse-announce`, {});
      return resp.json();
    },
    onSuccess: () => {
      toast({ title: "Pulse announcement posted!" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const [editingOcc, setEditingOcc] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<Record<string, string>>({});

  if (isLoading) {
    return (
      <div className="px-4 pb-4">
        <Skeleton className="h-16 w-full bg-white/10 rounded-md" />
      </div>
    );
  }

  const now = new Date();
  const upcoming = (occurrences || []).filter((o: any) => new Date(o.start_date_time) >= now);
  const past = (occurrences || []).filter((o: any) => new Date(o.start_date_time) < now);

  function startEditing(occ: any) {
    setEditingOcc(occ.id);
    setEditFields({
      title: occ.title || "",
      locationName: occ.location_name || "",
      costText: occ.cost_text || "",
    });
  }

  function saveEdit(eventId: string) {
    const details: Record<string, string> = {};
    if (editFields.title) details.title = editFields.title;
    if (editFields.locationName) details.locationName = editFields.locationName;
    if (editFields.costText !== undefined) details.costText = editFields.costText;
    occDetailMutation.mutate({ eventId, details });
    setEditingOcc(null);
  }

  return (
    <div className="px-4 pb-4 space-y-3 border-t border-white/10 pt-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          data-testid={`button-generate-occs-${seriesId}`}
        >
          {generateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
          Generate Dates
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-white/10 text-white/60"
          onClick={() => pulseMutation.mutate()}
          disabled={pulseMutation.isPending}
          data-testid={`button-pulse-announce-${seriesId}`}
        >
          <Send className="h-3 w-3 mr-1" /> Pulse Announce
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-white/40"
          onClick={() => {
            const url = `${window.location.origin}/${citySlug}/events/series/${seriesSlug}`;
            navigator.clipboard.writeText(url);
            toast({ title: "QR/Link copied" });
          }}
          data-testid={`button-qr-link-${seriesId}`}
        >
          <QrCode className="h-3 w-3 mr-1" /> Share Link
        </Button>
        {seriesStatus === "active" && (
          <Button
            size="sm"
            variant="ghost"
            className="text-orange-300"
            onClick={() => statusMutation.mutate({ newStatus: "paused" })}
            disabled={statusMutation.isPending}
            data-testid={`button-pause-${seriesId}`}
          >
            <Pause className="h-3 w-3 mr-1" /> Pause
          </Button>
        )}
        {seriesStatus === "paused" && (
          <Button
            size="sm"
            variant="ghost"
            className="text-green-300"
            onClick={() => statusMutation.mutate({ newStatus: "active" })}
            disabled={statusMutation.isPending}
            data-testid={`button-resume-${seriesId}`}
          >
            <Play className="h-3 w-3 mr-1" /> Resume
          </Button>
        )}
        {(seriesStatus === "active" || seriesStatus === "paused") && (
          <Button
            size="sm"
            variant="ghost"
            className="text-gray-400"
            onClick={() => statusMutation.mutate({ newStatus: "archived" })}
            disabled={statusMutation.isPending}
            data-testid={`button-archive-${seriesId}`}
          >
            <Archive className="h-3 w-3 mr-1" /> Archive
          </Button>
        )}
      </div>

      <h4 className="text-sm font-medium text-white/60">Upcoming ({upcoming.length})</h4>
      {upcoming.length === 0 ? (
        <p className="text-xs text-white/30">No upcoming occurrences — generate dates above</p>
      ) : (
        <div className="space-y-2">
          {upcoming.slice(0, 10).map((occ: any) => (
            <div key={occ.id} className="bg-white/5 rounded-md px-3 py-2 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-purple-400" />
                  <span className="text-white/70">
                    {format(new Date(occ.start_date_time), "MMM d, yyyy h:mm a")}
                  </span>
                  {occ.occurrence_status === "skipped" && (
                    <Badge variant="outline" className="text-[9px] text-yellow-300 border-yellow-500/30">Skipped</Badge>
                  )}
                  {occ.occurrence_status === "cancelled" && (
                    <Badge variant="destructive" className="text-[9px]">Cancelled</Badge>
                  )}
                  {occ.attending_count > 0 && (
                    <span className="text-[10px] text-white/30 flex items-center gap-1">
                      <Users className="h-3 w-3" /> {occ.attending_count}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-6 w-6 p-0 ${occ.pulse_reminder_enabled === false ? "text-white/20" : "text-blue-300"}`}
                    onClick={() => occDetailMutation.mutate({
                      eventId: occ.id,
                      details: { pulseReminderEnabled: !occ.pulse_reminder_enabled }
                    })}
                    disabled={occDetailMutation.isPending}
                    title={occ.pulse_reminder_enabled === false ? "Enable Pulse reminder" : "Disable Pulse reminder"}
                    data-testid={`button-pulse-toggle-${occ.id}`}
                  >
                    {occ.pulse_reminder_enabled === false ? <BellOff className="h-3 w-3" /> : <Bell className="h-3 w-3" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-white/40"
                    onClick={() => editingOcc === occ.id ? setEditingOcc(null) : startEditing(occ)}
                    data-testid={`button-edit-occ-${occ.id}`}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  {occ.occurrence_status === "scheduled" && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] text-yellow-300"
                        onClick={() => occStatusMutation.mutate({ eventId: occ.id, occurrenceStatus: "skipped" })}
                        disabled={occStatusMutation.isPending}
                        data-testid={`button-skip-occ-${occ.id}`}
                      >
                        Skip
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] text-red-300"
                        onClick={() => occStatusMutation.mutate({ eventId: occ.id, occurrenceStatus: "cancelled" })}
                        disabled={occStatusMutation.isPending}
                        data-testid={`button-cancel-occ-${occ.id}`}
                      >
                        Cancel
                      </Button>
                    </>
                  )}
                  {(occ.occurrence_status === "skipped" || occ.occurrence_status === "cancelled") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] text-green-300"
                      onClick={() => occStatusMutation.mutate({ eventId: occ.id, occurrenceStatus: "scheduled" })}
                      disabled={occStatusMutation.isPending}
                      data-testid={`button-restore-occ-${occ.id}`}
                    >
                      Restore
                    </Button>
                  )}
                  <Link href={`/${citySlug}/events/${occ.slug}`}>
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] text-white/40" data-testid={`link-view-occ-${occ.id}`}>
                      <Eye className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              </div>
              {editingOcc === occ.id && (
                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/5">
                  <Input
                    className="h-7 text-xs bg-white/5 border-white/10"
                    placeholder="Title override"
                    value={editFields.title}
                    onChange={(e) => setEditFields({ ...editFields, title: e.target.value })}
                    data-testid={`input-edit-title-${occ.id}`}
                  />
                  <Input
                    className="h-7 text-xs bg-white/5 border-white/10"
                    placeholder="Location override"
                    value={editFields.locationName}
                    onChange={(e) => setEditFields({ ...editFields, locationName: e.target.value })}
                    data-testid={`input-edit-location-${occ.id}`}
                  />
                  <div className="flex items-center gap-1">
                    <Input
                      className="h-7 text-xs bg-white/5 border-white/10 flex-1"
                      placeholder="Cost override"
                      value={editFields.costText}
                      onChange={(e) => setEditFields({ ...editFields, costText: e.target.value })}
                      data-testid={`input-edit-cost-${occ.id}`}
                    />
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => saveEdit(occ.id)}
                      disabled={occDetailMutation.isPending}
                      data-testid={`button-save-edit-${occ.id}`}
                    >
                      {occDetailMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {past.length > 0 && (
        <p className="text-xs text-white/30">{past.length} past occurrence(s) archived</p>
      )}
    </div>
  );
}

function SubmissionsTab({
  submissions,
  isLoading,
  citySlug,
}: {
  submissions: SubmissionItem[];
  isLoading: boolean;
  citySlug: string;
}) {
  const { toast } = useToast();

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, reviewNote }: { id: string; status: string; reviewNote?: string }) => {
      const resp = await apiRequest("PATCH", `/api/owner/venue-submissions/${id}`, { status, review_note: reviewNote });
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/venue-submissions"] });
      toast({ title: "Submission updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const convertMutation = useMutation({
    mutationFn: async ({ id, convertToSeries }: { id: string; convertToSeries: boolean }) => {
      const resp = await apiRequest("POST", `/api/owner/venue-submissions/${id}/convert`, { convertToSeries });
      return resp.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/venue-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/owner/event-series"] });
      toast({ title: `Converted to ${data.type}!` });
    },
    onError: (err: Error) => {
      toast({ title: "Error converting", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full bg-white/10 rounded-md" />
        ))}
      </div>
    );
  }

  const pending = submissions.filter((s) => s.status === "pending");
  const reviewed = submissions.filter((s) => s.status !== "pending");

  if (submissions.length === 0) {
    return (
      <Card className="p-12 text-center bg-white/5 border-white/10">
        <Send className="h-12 w-12 text-white/20 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white mb-1" data-testid="text-no-submissions">No Submissions</h3>
        <p className="text-white/50 text-sm">Outside organizers can submit event requests to your venue</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-white/60">Pending Review ({pending.length})</h3>
          {pending.map((sub) => (
            <Card key={sub.id} className="p-4 bg-white/5 border-white/10 space-y-3" data-testid={`card-submission-${sub.id}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-semibold text-white">{sub.title}</h4>
                  <p className="text-xs text-white/40 mt-1">
                    {sub.submitter_name && `From: ${sub.submitter_name}`}
                    {sub.submitter_email && ` (${sub.submitter_email})`}
                    {" · "}
                    {format(new Date(sub.created_at), "MMM d, yyyy")}
                  </p>
                </div>
                <Badge variant="outline" className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30">
                  Pending
                </Badge>
              </div>
              {sub.description && (
                <p className="text-sm text-white/60">{sub.description.substring(0, 200)}</p>
              )}
              {sub.proposed_start_date_time && (
                <p className="text-xs text-white/40 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Proposed: {format(new Date(sub.proposed_start_date_time), "MMM d, yyyy h:mm a")}
                </p>
              )}
              {sub.is_recurring && (
                <Badge variant="secondary" className="text-[10px] bg-purple-500/20 text-purple-200">
                  <Repeat className="h-3 w-3 mr-1" /> Recurring
                </Badge>
              )}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => reviewMutation.mutate({ id: sub.id, status: "approved" })}
                  disabled={reviewMutation.isPending}
                  data-testid={`button-approve-${sub.id}`}
                >
                  <Check className="h-3 w-3 mr-1" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => reviewMutation.mutate({ id: sub.id, status: "rejected" })}
                  disabled={reviewMutation.isPending}
                  className="border-white/10 text-white/60"
                  data-testid={`button-reject-${sub.id}`}
                >
                  <X className="h-3 w-3 mr-1" /> Reject
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {reviewed.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-white/60">Reviewed ({reviewed.length})</h3>
          {reviewed.map((sub) => (
            <Card key={sub.id} className="p-3 bg-white/5 border-white/10" data-testid={`card-reviewed-${sub.id}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white/70">{sub.title}</span>
                  <Badge variant="outline" className={sub.status === "approved" ? "text-green-300 border-green-500/30" : "text-red-300 border-red-500/30"}>
                    {sub.status}
                  </Badge>
                </div>
                {sub.status === "approved" && (
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-white/10 text-white/60"
                      onClick={() => convertMutation.mutate({ id: sub.id, convertToSeries: false })}
                      disabled={convertMutation.isPending}
                      data-testid={`button-convert-event-${sub.id}`}
                    >
                      → Event
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-purple-500/30 text-purple-300"
                      onClick={() => convertMutation.mutate({ id: sub.id, convertToSeries: true })}
                      disabled={convertMutation.isPending}
                      data-testid={`button-convert-series-${sub.id}`}
                    >
                      → Series
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateSeriesTab({ citySlug, slug }: { citySlug: string; slug: string }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    title: "",
    description: "",
    recurrenceType: "weekly",
    dayOfWeek: "4",
    startTime: "19:00",
    durationMinutes: "120",
    locationName: "",
    address: "",
    costText: "",
    rsvpEnabled: false,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const ruleJson = JSON.stringify({
        dayOfWeek: parseInt(form.dayOfWeek),
        startTime: form.startTime,
      });

      const resp = await apiRequest("POST", "/api/owner/event-series", {
        title: form.title,
        description: form.description || null,
        citySlug: citySlug,
        recurrenceType: form.recurrenceType,
        recurrenceRuleJson: ruleJson,
        defaultStartTime: form.startTime,
        defaultDurationMinutes: parseInt(form.durationMinutes) || 120,
        defaultLocationName: form.locationName || null,
        defaultAddress: form.address || null,
        defaultCostText: form.costText || null,
        defaultRsvpEnabled: form.rsvpEnabled,
        status: "active",
      });
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/event-series"] });
      toast({ title: "Series created!" });
      setForm({
        title: "", description: "", recurrenceType: "weekly", dayOfWeek: "4",
        startTime: "19:00", durationMinutes: "120", locationName: "", address: "",
        costText: "", rsvpEnabled: false,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Error creating series", description: err.message, variant: "destructive" });
    },
  });

  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  return (
    <Card className="p-6 bg-white/5 border-white/10 space-y-4">
      <h3 className="text-lg font-semibold text-white" data-testid="text-create-series-heading">
        Create Event Series
      </h3>

      <div className="space-y-4">
        <div>
          <Label className="text-white/60 text-sm">Title *</Label>
          <Input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g., Friday Night Live Music"
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
            data-testid="input-series-title"
          />
        </div>

        <div>
          <Label className="text-white/60 text-sm">Description</Label>
          <Textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Describe this recurring event..."
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
            data-testid="input-series-description"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-white/60 text-sm">Recurrence</Label>
            <Select value={form.recurrenceType} onValueChange={(v) => setForm({ ...form, recurrenceType: v })}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="select-recurrence">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
                <SelectItem value="none">One-time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.recurrenceType === "weekly" && (
            <div>
              <Label className="text-white/60 text-sm">Day of Week</Label>
              <Select value={form.dayOfWeek} onValueChange={(v) => setForm({ ...form, dayOfWeek: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="select-day-of-week">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_NAMES.map((day, i) => (
                    <SelectItem key={i} value={String(i)}>{day}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <Label className="text-white/60 text-sm">Start Time</Label>
            <Input
              type="time"
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              className="bg-white/5 border-white/10 text-white"
              data-testid="input-start-time"
            />
          </div>
          <div>
            <Label className="text-white/60 text-sm">Duration (min)</Label>
            <Input
              type="number"
              value={form.durationMinutes}
              onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
              className="bg-white/5 border-white/10 text-white"
              data-testid="input-duration"
            />
          </div>
          <div>
            <Label className="text-white/60 text-sm">Cost</Label>
            <Input
              value={form.costText}
              onChange={(e) => setForm({ ...form, costText: e.target.value })}
              placeholder="Free, $10, etc."
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              data-testid="input-cost"
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-white/60 text-sm">Location Name</Label>
            <Input
              value={form.locationName}
              onChange={(e) => setForm({ ...form, locationName: e.target.value })}
              placeholder="Venue name"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              data-testid="input-location-name"
            />
          </div>
          <div>
            <Label className="text-white/60 text-sm">Address</Label>
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Street address"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              data-testid="input-address"
            />
          </div>
        </div>

        <Button
          onClick={() => createMutation.mutate()}
          disabled={!form.title || createMutation.isPending}
          data-testid="button-create-series"
        >
          {createMutation.isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Creating...</>
          ) : (
            <><Plus className="h-4 w-4 mr-1" /> Create Series</>
          )}
        </Button>
      </div>
    </Card>
  );
}
