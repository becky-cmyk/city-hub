import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Plus, Pencil, Trash2, Loader2, Radio, Video, Play, Square,
  Calendar, Clock, Eye, ExternalLink, Link2, Users
} from "lucide-react";
import { useState } from "react";
import type { LiveBroadcast } from "@shared/schema";

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "live": return "destructive";
    case "scheduled": return "default";
    case "ended": return "secondary";
    case "cancelled": return "outline";
    default: return "secondary";
  }
}

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleString();
}

function elapsedTime(start: string | Date | null | undefined): string {
  if (!start) return "-";
  const diff = Date.now() - new Date(start).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  if (hrs > 0) return `${hrs}h ${remainMins}m`;
  return `${mins}m`;
}

function BroadcastFormDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: LiveBroadcast | null;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState(editing?.title || "");
  const [description, setDescription] = useState(editing?.description || "");
  const [hostName, setHostName] = useState(editing?.hostName || "");
  const [streamUrl, setStreamUrl] = useState(editing?.streamUrl || "");
  const [broadcastType, setBroadcastType] = useState<string>(editing?.broadcastType || "interview");
  const [thumbnailUrl, setThumbnailUrl] = useState(editing?.thumbnailUrl || "");
  const [scheduledStartAt, setScheduledStartAt] = useState(
    editing?.scheduledStartAt ? new Date(editing.scheduledStartAt).toISOString().slice(0, 16) : ""
  );
  const [hubSlug, setHubSlug] = useState(editing?.hubSlug || "");

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        title,
        description: description || null,
        hostName: hostName || null,
        streamUrl: streamUrl || null,
        broadcastType,
        thumbnailUrl: thumbnailUrl || null,
        scheduledStartAt: scheduledStartAt || null,
        hubSlug: hubSlug || null,
        status: editing ? undefined : "scheduled",
      };
      if (editing) {
        return apiRequest("PATCH", `/api/admin/broadcasts/${editing.id}`, body);
      }
      return apiRequest("POST", "/api/admin/broadcasts", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/broadcasts"] });
      toast({ title: editing ? "Broadcast updated" : "Broadcast scheduled" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Error saving broadcast", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Broadcast" : "Schedule Broadcast"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} data-testid="input-broadcast-title" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="resize-none" rows={3} data-testid="input-broadcast-description" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Host Name</Label>
              <Input value={hostName} onChange={(e) => setHostName(e.target.value)} data-testid="input-broadcast-host" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={broadcastType} onValueChange={setBroadcastType}>
                <SelectTrigger data-testid="select-broadcast-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="interview">Interview</SelectItem>
                  <SelectItem value="event">Event</SelectItem>
                  <SelectItem value="show">Show</SelectItem>
                  <SelectItem value="breaking">Breaking</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Stream URL</Label>
            <Input value={streamUrl} onChange={(e) => setStreamUrl(e.target.value)} placeholder="https://..." data-testid="input-broadcast-stream-url" />
          </div>
          <div className="space-y-2">
            <Label>Thumbnail URL</Label>
            <Input value={thumbnailUrl} onChange={(e) => setThumbnailUrl(e.target.value)} placeholder="https://..." data-testid="input-broadcast-thumbnail" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Scheduled Start</Label>
              <Input type="datetime-local" value={scheduledStartAt} onChange={(e) => setScheduledStartAt(e.target.value)} data-testid="input-broadcast-scheduled" />
            </div>
            <div className="space-y-2">
              <Label>Hub Slug</Label>
              <Input value={hubSlug} onChange={(e) => setHubSlug(e.target.value)} placeholder="south-end" data-testid="input-broadcast-hub" />
            </div>
          </div>
          <Button onClick={() => saveMutation.mutate()} disabled={!title || saveMutation.isPending} className="w-full" data-testid="button-save-broadcast">
            {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {editing ? "Update Broadcast" : "Schedule Broadcast"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BroadcastsTab() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LiveBroadcast | null>(null);

  const { data: broadcasts, isLoading } = useQuery<LiveBroadcast[]>({
    queryKey: ["/api/admin/broadcasts"],
  });

  const goLiveMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("PATCH", `/api/admin/broadcasts/${id}/go-live`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/broadcasts"] });
      toast({ title: "Broadcast is now live" });
    },
    onError: () => toast({ title: "Error going live", variant: "destructive" }),
  });

  const endMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("PATCH", `/api/admin/broadcasts/${id}/end`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/broadcasts"] });
      toast({ title: "Broadcast ended" });
    },
    onError: () => toast({ title: "Error ending broadcast", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/broadcasts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/broadcasts"] });
      toast({ title: "Broadcast deleted" });
    },
    onError: () => toast({ title: "Error deleting broadcast", variant: "destructive" }),
  });

  const openCreate = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (b: LiveBroadcast) => { setEditing(b); setDialogOpen(true); };

  if (isLoading) return <div className="text-sm text-muted-foreground p-4">Loading broadcasts...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold" data-testid="text-broadcasts-title">All Broadcasts</h3>
        <Button onClick={openCreate} data-testid="button-schedule-broadcast">
          <Plus className="h-4 w-4 mr-1" /> Schedule Broadcast
        </Button>
      </div>

      <div className="border rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Title</th>
              <th className="text-left p-3 font-medium">Host</th>
              <th className="text-left p-3 font-medium">Type</th>
              <th className="text-center p-3 font-medium">Status</th>
              <th className="text-left p-3 font-medium">Scheduled</th>
              <th className="text-center p-3 font-medium">Viewers</th>
              <th className="text-center p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(broadcasts || []).map((b) => (
              <tr key={b.id} className="border-b last:border-b-0" data-testid={`row-broadcast-${b.id}`}>
                <td className="p-3 font-medium">{b.title}</td>
                <td className="p-3 text-muted-foreground">{b.hostName || "-"}</td>
                <td className="p-3">
                  <Badge variant="outline">{b.broadcastType}</Badge>
                </td>
                <td className="p-3 text-center">
                  <Badge variant={statusVariant(b.status)} data-testid={`badge-status-${b.id}`}>
                    {b.status === "live" && <Radio className="h-3 w-3 mr-1 animate-pulse" />}
                    {b.status}
                  </Badge>
                </td>
                <td className="p-3 text-muted-foreground text-xs">{formatDate(b.scheduledStartAt)}</td>
                <td className="p-3 text-center">{b.viewerCount}</td>
                <td className="p-3">
                  <div className="flex items-center justify-center gap-1">
                    {b.status === "scheduled" && (
                      <Button size="icon" variant="ghost" onClick={() => goLiveMutation.mutate(b.id)} data-testid={`button-go-live-${b.id}`}>
                        <Play className="h-4 w-4" />
                      </Button>
                    )}
                    {b.status === "live" && (
                      <Button size="icon" variant="ghost" onClick={() => endMutation.mutate(b.id)} data-testid={`button-end-${b.id}`}>
                        <Square className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => openEdit(b)} data-testid={`button-edit-broadcast-${b.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(b.id)} data-testid={`button-delete-broadcast-${b.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {(broadcasts || []).length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No broadcasts found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {dialogOpen && (
        <BroadcastFormDialog
          open={dialogOpen}
          onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditing(null); }}
          editing={editing}
        />
      )}
    </div>
  );
}

function LiveNowTab() {
  const { toast } = useToast();
  const { data: broadcasts, isLoading } = useQuery<LiveBroadcast[]>({
    queryKey: ["/api/admin/broadcasts"],
  });

  const endMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("PATCH", `/api/admin/broadcasts/${id}/end`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/broadcasts"] });
      toast({ title: "Broadcast ended" });
    },
    onError: () => toast({ title: "Error ending broadcast", variant: "destructive" }),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground p-4">Loading...</div>;

  const liveBroadcasts = (broadcasts || []).filter((b) => b.status === "live");

  if (liveBroadcasts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
        <Radio className="h-10 w-10 opacity-30" />
        <p className="text-sm" data-testid="text-no-live">No broadcasts are currently live</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {liveBroadcasts.map((b) => (
        <Card key={b.id} className="p-5" data-testid={`card-live-${b.id}`}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                <Badge variant="destructive">LIVE</Badge>
                <Badge variant="outline">{b.broadcastType}</Badge>
              </div>
              <h3 className="text-lg font-semibold" data-testid={`text-live-title-${b.id}`}>{b.title}</h3>
              {b.description && <p className="text-sm text-muted-foreground">{b.description}</p>}
              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                {b.hostName && (
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> {b.hostName}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> Elapsed: {elapsedTime(b.actualStartAt)}
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" /> {b.viewerCount} viewers
                </span>
              </div>
              {b.streamUrl && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Link2 className="h-3 w-3" />
                  <span className="truncate max-w-xs">{b.streamUrl}</span>
                </div>
              )}
            </div>
            <Button variant="destructive" onClick={() => endMutation.mutate(b.id)} disabled={endMutation.isPending} data-testid={`button-end-live-${b.id}`}>
              {endMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              <Square className="h-4 w-4 mr-1" /> End Broadcast
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

function RecordingsTab() {
  const { toast } = useToast();
  const { data: broadcasts, isLoading } = useQuery<LiveBroadcast[]>({
    queryKey: ["/api/admin/broadcasts"],
  });

  const [attachDialog, setAttachDialog] = useState<LiveBroadcast | null>(null);
  const [recordingUrl, setRecordingUrl] = useState("");

  const attachMutation = useMutation({
    mutationFn: async () => {
      if (!attachDialog) return;
      return apiRequest("PATCH", `/api/admin/broadcasts/${attachDialog.id}/recording`, { recordingUrl });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/broadcasts"] });
      toast({ title: "Recording URL attached" });
      setAttachDialog(null);
      setRecordingUrl("");
    },
    onError: () => toast({ title: "Error attaching recording", variant: "destructive" }),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground p-4">Loading...</div>;

  const endedBroadcasts = (broadcasts || []).filter((b) => b.status === "ended");

  return (
    <div className="space-y-4">
      <h3 className="font-semibold" data-testid="text-recordings-title">Past Recordings</h3>

      {endedBroadcasts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Video className="h-10 w-10 opacity-30" />
          <p className="text-sm" data-testid="text-no-recordings">No recordings available</p>
        </div>
      ) : (
        <div className="border rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Title</th>
                <th className="text-left p-3 font-medium">Host</th>
                <th className="text-left p-3 font-medium">Type</th>
                <th className="text-left p-3 font-medium">Ended At</th>
                <th className="text-left p-3 font-medium">Recording</th>
                <th className="text-center p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {endedBroadcasts.map((b) => (
                <tr key={b.id} className="border-b last:border-b-0" data-testid={`row-recording-${b.id}`}>
                  <td className="p-3 font-medium">{b.title}</td>
                  <td className="p-3 text-muted-foreground">{b.hostName || "-"}</td>
                  <td className="p-3">
                    <Badge variant="outline">{b.broadcastType}</Badge>
                  </td>
                  <td className="p-3 text-muted-foreground text-xs">{formatDate(b.endedAt)}</td>
                  <td className="p-3">
                    {b.recordingUrl ? (
                      <a href={b.recordingUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1" data-testid={`link-recording-${b.id}`}>
                        <ExternalLink className="h-3 w-3" /> View
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">No recording</span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <Button size="sm" variant="outline" onClick={() => { setAttachDialog(b); setRecordingUrl(b.recordingUrl || ""); }} data-testid={`button-attach-recording-${b.id}`}>
                      <Link2 className="h-3.5 w-3.5 mr-1" /> {b.recordingUrl ? "Update" : "Attach"} URL
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {attachDialog && (
        <Dialog open={!!attachDialog} onOpenChange={(v) => { if (!v) setAttachDialog(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Attach Recording URL</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Broadcast: {attachDialog.title}</p>
              <div className="space-y-2">
                <Label>Recording URL</Label>
                <Input value={recordingUrl} onChange={(e) => setRecordingUrl(e.target.value)} placeholder="https://..." data-testid="input-recording-url" />
              </div>
              <Button onClick={() => attachMutation.mutate()} disabled={!recordingUrl || attachMutation.isPending} className="w-full" data-testid="button-save-recording-url">
                {attachMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Save Recording URL
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function ScheduleTab() {
  const { data: broadcasts, isLoading } = useQuery<LiveBroadcast[]>({
    queryKey: ["/api/admin/broadcasts"],
  });

  if (isLoading) return <div className="text-sm text-muted-foreground p-4">Loading...</div>;

  const upcoming = (broadcasts || [])
    .filter((b) => b.status === "scheduled" && b.scheduledStartAt)
    .sort((a, b) => new Date(a.scheduledStartAt!).getTime() - new Date(b.scheduledStartAt!).getTime());

  const groupedByDate: Record<string, LiveBroadcast[]> = {};
  upcoming.forEach((b) => {
    const dateKey = new Date(b.scheduledStartAt!).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
    groupedByDate[dateKey].push(b);
  });

  if (upcoming.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
        <Calendar className="h-10 w-10 opacity-30" />
        <p className="text-sm" data-testid="text-no-schedule">No upcoming broadcasts scheduled</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="font-semibold" data-testid="text-schedule-title">Upcoming Schedule</h3>
      {Object.entries(groupedByDate).map(([date, items]) => (
        <div key={date} className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5" /> {date}
          </h4>
          <div className="space-y-2">
            {items.map((b) => (
              <Card key={b.id} className="p-3" data-testid={`card-schedule-${b.id}`}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-medium">
                      {new Date(b.scheduledStartAt!).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </div>
                    <div>
                      <div className="font-medium text-sm">{b.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {b.hostName && <span>{b.hostName}</span>}
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline">{b.broadcastType}</Badge>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function LiveBroadcastPanel({ cityId }: { cityId?: string }) {
  const { data: broadcasts } = useQuery<LiveBroadcast[]>({
    queryKey: ["/api/admin/broadcasts"],
  });

  const liveCount = (broadcasts || []).filter((b) => b.status === "live").length;
  const scheduledCount = (broadcasts || []).filter((b) => b.status === "scheduled").length;
  const endedCount = (broadcasts || []).filter((b) => b.status === "ended").length;
  const withRecording = (broadcasts || []).filter((b) => b.status === "ended" && b.recordingUrl).length;

  return (
    <div className="space-y-6 p-4 max-w-6xl">
      <div>
        <h2 className="text-xl font-bold" data-testid="text-panel-title">Live Broadcasts</h2>
        <p className="text-sm text-muted-foreground">Manage live streaming broadcasts, recordings, and schedules</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4" data-testid="stat-live">
          <div className="text-2xl font-bold">{liveCount}</div>
          <div className="text-xs text-muted-foreground">Live Now</div>
        </Card>
        <Card className="p-4" data-testid="stat-scheduled">
          <div className="text-2xl font-bold">{scheduledCount}</div>
          <div className="text-xs text-muted-foreground">Scheduled</div>
        </Card>
        <Card className="p-4" data-testid="stat-ended">
          <div className="text-2xl font-bold">{endedCount}</div>
          <div className="text-xs text-muted-foreground">Completed</div>
        </Card>
        <Card className="p-4" data-testid="stat-recordings">
          <div className="text-2xl font-bold">{withRecording}</div>
          <div className="text-xs text-muted-foreground">With Recordings</div>
        </Card>
      </div>

      {liveCount > 0 && (
        <Card className="border-red-500/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-semibold text-red-600 dark:text-red-400" data-testid="text-live-indicator">
              {liveCount} broadcast{liveCount > 1 ? "s" : ""} currently live
            </span>
          </div>
        </Card>
      )}

      <Tabs defaultValue="broadcasts">
        <TabsList data-testid="tabs-broadcast-panel">
          <TabsTrigger value="broadcasts" data-testid="tab-broadcasts">Broadcasts</TabsTrigger>
          <TabsTrigger value="live-now" data-testid="tab-live-now">
            Live Now {liveCount > 0 && <Badge variant="destructive" className="ml-1 text-[10px] px-1.5">{liveCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="recordings" data-testid="tab-recordings">Recordings</TabsTrigger>
          <TabsTrigger value="schedule" data-testid="tab-schedule">Schedule</TabsTrigger>
        </TabsList>

        <TabsContent value="broadcasts">
          <BroadcastsTab />
        </TabsContent>
        <TabsContent value="live-now">
          <LiveNowTab />
        </TabsContent>
        <TabsContent value="recordings">
          <RecordingsTab />
        </TabsContent>
        <TabsContent value="schedule">
          <ScheduleTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
