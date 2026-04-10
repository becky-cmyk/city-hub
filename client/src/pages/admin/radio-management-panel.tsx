import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Plus, Pencil, Trash2, Loader2, Radio, Wifi, WifiOff, Play, Pause,
  SkipForward, Music, Mic, Megaphone, Clock, BarChart3, Activity, Zap,
} from "lucide-react";
import { useState } from "react";
import type { RadioStation, RadioSegment } from "@shared/schema";

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "-";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function segmentTypeIcon(type: string) {
  switch (type) {
    case "music": return <Music className="h-3.5 w-3.5" />;
    case "talk": return <Mic className="h-3.5 w-3.5" />;
    case "ad": return <Megaphone className="h-3.5 w-3.5" />;
    case "announcement": return <Radio className="h-3.5 w-3.5" />;
    case "interview": return <Mic className="h-3.5 w-3.5" />;
    case "expert_show": return <Mic className="h-3.5 w-3.5" />;
    default: return <Music className="h-3.5 w-3.5" />;
  }
}

function segmentTypeBadgeVariant(type: string): "default" | "secondary" | "outline" {
  switch (type) {
    case "music": return "default";
    case "ad": return "secondary";
    default: return "outline";
  }
}

function StationsTab() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RadioStation | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [stationType, setStationType] = useState("metro");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [streamUrl, setStreamUrl] = useState("");

  const { data: stations, isLoading } = useQuery<RadioStation[]>({
    queryKey: ["/api/admin/radio/stations"],
  });

  const resetForm = (s?: RadioStation | null) => {
    setName(s?.name || "");
    setSlug(s?.slug || "");
    setStationType(s?.stationType || "metro");
    setDescription(s?.description || "");
    setImageUrl(s?.imageUrl || "");
    setStreamUrl(s?.streamUrl || "");
  };

  const openCreate = () => { setEditing(null); resetForm(); setDialogOpen(true); };
  const openEdit = (s: RadioStation) => { setEditing(s); resetForm(s); setDialogOpen(true); };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        name,
        slug,
        stationType,
        description: description || null,
        imageUrl: imageUrl || null,
        streamUrl: streamUrl || null,
      };
      if (editing) {
        return apiRequest("PATCH", `/api/admin/radio/stations/${editing.id}`, body);
      }
      return apiRequest("POST", "/api/admin/radio/stations", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/radio/stations"] });
      toast({ title: editing ? "Station updated" : "Station created" });
      setDialogOpen(false);
    },
    onError: () => toast({ title: "Error saving station", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/radio/stations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/radio/stations"] });
      toast({ title: "Station deleted" });
    },
    onError: () => toast({ title: "Error deleting station", variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/admin/radio/stations/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/radio/stations"] });
      toast({ title: "Station status updated" });
    },
    onError: () => toast({ title: "Error updating status", variant: "destructive" }),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground p-4" data-testid="text-loading">Loading stations...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold" data-testid="text-stations-title">Radio Stations</h3>
        <Button onClick={openCreate} data-testid="button-create-station">
          <Plus className="h-4 w-4 mr-1" /> New Station
        </Button>
      </div>

      <div className="border rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Name</th>
              <th className="text-left p-3 font-medium">Type</th>
              <th className="text-center p-3 font-medium">Status</th>
              <th className="text-center p-3 font-medium">Listeners</th>
              <th className="text-left p-3 font-medium">Now Playing</th>
              <th className="text-center p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(stations || []).map((s) => (
              <tr key={s.id} className="border-b last:border-b-0" data-testid={`row-station-${s.id}`}>
                <td className="p-3">
                  <div>
                    <span className="font-medium">{s.name}</span>
                    <span className="text-muted-foreground text-xs ml-2">/{s.slug}</span>
                  </div>
                  {s.hubSlug && <span className="text-xs text-muted-foreground">Hub: {s.hubSlug}</span>}
                </td>
                <td className="p-3">
                  <Badge variant="outline" data-testid={`badge-type-${s.id}`}>{s.stationType}</Badge>
                </td>
                <td className="p-3 text-center">
                  <Badge
                    variant={s.status === "live" ? "default" : "secondary"}
                    data-testid={`badge-status-${s.id}`}
                  >
                    {s.status === "live" && <Wifi className="h-3 w-3 mr-1" />}
                    {s.status === "offline" && <WifiOff className="h-3 w-3 mr-1" />}
                    {s.status}
                  </Badge>
                </td>
                <td className="p-3 text-center">
                  <span className="text-muted-foreground" data-testid={`text-listeners-${s.id}`}>
                    {s.listenerCount}
                  </span>
                </td>
                <td className="p-3 text-muted-foreground text-xs">
                  {s.currentSegmentId ? `Segment: ${s.currentSegmentId.slice(0, 8)}...` : "Nothing playing"}
                </td>
                <td className="p-3">
                  <div className="flex items-center justify-center gap-1">
                    {s.status === "offline" ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => statusMutation.mutate({ id: s.id, status: "live" })}
                        data-testid={`button-go-live-${s.id}`}
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => statusMutation.mutate({ id: s.id, status: "offline" })}
                        data-testid={`button-go-offline-${s.id}`}
                      >
                        <Pause className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => openEdit(s)} data-testid={`button-edit-station-${s.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(s.id)} data-testid={`button-delete-station-${s.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {(stations || []).length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No radio stations configured</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Station" : "Create Station"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} data-testid="input-station-name" />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="charlotte-metro" data-testid="input-station-slug" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={stationType} onValueChange={setStationType}>
                <SelectTrigger data-testid="select-station-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="metro">Metro</SelectItem>
                  <SelectItem value="micro">Micro</SelectItem>
                  <SelectItem value="venue">Venue</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="resize-none" rows={3} data-testid="input-station-description" />
            </div>
            <div className="space-y-2">
              <Label>Stream URL</Label>
              <Input value={streamUrl} onChange={(e) => setStreamUrl(e.target.value)} data-testid="input-station-stream-url" />
            </div>
            <div className="space-y-2">
              <Label>Image URL</Label>
              <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} data-testid="input-station-image-url" />
            </div>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !name || !slug} className="w-full" data-testid="button-save-station">
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editing ? "Update Station" : "Create Station"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProgrammingTab() {
  const { toast } = useToast();
  const [selectedStationId, setSelectedStationId] = useState<string>("");
  const [segmentDialogOpen, setSegmentDialogOpen] = useState(false);
  const [segTitle, setSegTitle] = useState("");
  const [segType, setSegType] = useState("music");
  const [segAudioUrl, setSegAudioUrl] = useState("");
  const [segDuration, setSegDuration] = useState("180");
  const [segPriority, setSegPriority] = useState("5");
  const [segScheduledAt, setSegScheduledAt] = useState("");

  const { data: stations } = useQuery<RadioStation[]>({
    queryKey: ["/api/admin/radio/stations"],
  });

  const { data: segments, isLoading: segmentsLoading } = useQuery<RadioSegment[]>({
    queryKey: ["/api/admin/radio/segments", selectedStationId],
    queryFn: async () => {
      const url = selectedStationId
        ? `/api/admin/radio/segments?stationId=${selectedStationId}`
        : "/api/admin/radio/segments";
      const resp = await fetch(url);
      if (!resp.ok) throw new Error("Failed to fetch segments");
      return resp.json();
    },
    enabled: !!selectedStationId,
  });

  const addSegmentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStationId) throw new Error("Select a station first");
      return apiRequest("POST", `/api/admin/radio/stations/${selectedStationId}/segments`, {
        title: segTitle,
        segmentType: segType,
        audioUrl: segAudioUrl || null,
        durationSeconds: parseInt(segDuration) || 180,
        priority: parseInt(segPriority) || 5,
        scheduledAt: segScheduledAt || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/radio/segments", selectedStationId] });
      toast({ title: "Segment added" });
      setSegmentDialogOpen(false);
      setSegTitle("");
      setSegType("music");
      setSegAudioUrl("");
      setSegDuration("180");
      setSegPriority("5");
      setSegScheduledAt("");
    },
    onError: () => toast({ title: "Error adding segment", variant: "destructive" }),
  });

  const generatePlaylistMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStationId) throw new Error("Select a station first");
      const resp = await apiRequest("POST", `/api/admin/radio/stations/${selectedStationId}/generate-playlist`);
      return resp.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/radio/segments", selectedStationId] });
      toast({ title: `Playlist generated: ${data.generated} segments` });
    },
    onError: () => toast({ title: "Error generating playlist", variant: "destructive" }),
  });

  const deleteSegmentMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/radio/segments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/radio/segments", selectedStationId] });
      toast({ title: "Segment removed" });
    },
    onError: () => toast({ title: "Error deleting segment", variant: "destructive" }),
  });

  const skipSegmentMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("PATCH", `/api/admin/radio/segments/${id}`, { status: "skipped" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/radio/segments", selectedStationId] });
      toast({ title: "Segment skipped" });
    },
  });

  const queuedSegments = (segments || []).filter(s => s.status === "queued");
  const playedSegments = (segments || []).filter(s => s.status === "played" || s.status === "skipped");

  const segmentsByType: Record<string, number> = {};
  queuedSegments.forEach(s => {
    segmentsByType[s.segmentType] = (segmentsByType[s.segmentType] || 0) + 1;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold" data-testid="text-programming-title">Programming</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selectedStationId} onValueChange={setSelectedStationId}>
            <SelectTrigger className="w-[200px]" data-testid="select-programming-station">
              <SelectValue placeholder="Select station..." />
            </SelectTrigger>
            <SelectContent>
              {(stations || []).map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => generatePlaylistMutation.mutate()}
            disabled={!selectedStationId || generatePlaylistMutation.isPending}
            data-testid="button-generate-playlist"
          >
            {generatePlaylistMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Zap className="h-4 w-4 mr-1" />}
            Auto-Generate
          </Button>
          <Button
            onClick={() => setSegmentDialogOpen(true)}
            disabled={!selectedStationId}
            data-testid="button-add-segment"
          >
            <Plus className="h-4 w-4 mr-1" /> Add Segment
          </Button>
        </div>
      </div>

      {!selectedStationId && (
        <Card className="p-6 text-center text-muted-foreground">
          <Radio className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Select a station to view and manage its programming</p>
        </Card>
      )}

      {selectedStationId && (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            {Object.entries(segmentsByType).map(([type, count]) => (
              <div key={type} className="flex items-center gap-1.5">
                {segmentTypeIcon(type)}
                <span className="text-xs text-muted-foreground capitalize">{type}: {count}</span>
              </div>
            ))}
            {queuedSegments.length > 0 && (
              <span className="text-xs text-muted-foreground">Total queued: {queuedSegments.length}</span>
            )}
          </div>

          {segmentsLoading ? (
            <div className="text-sm text-muted-foreground p-4">Loading segments...</div>
          ) : (
            <div className="border rounded-md overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-center p-3 font-medium w-10">#</th>
                    <th className="text-left p-3 font-medium">Title</th>
                    <th className="text-center p-3 font-medium">Type</th>
                    <th className="text-center p-3 font-medium">Duration</th>
                    <th className="text-center p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Scheduled</th>
                    <th className="text-center p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {queuedSegments.map((seg, idx) => (
                    <tr key={seg.id} className="border-b last:border-b-0" data-testid={`row-segment-${seg.id}`}>
                      <td className="p-3 text-center text-muted-foreground">{idx + 1}</td>
                      <td className="p-3 font-medium">{seg.title}</td>
                      <td className="p-3 text-center">
                        <Badge variant={segmentTypeBadgeVariant(seg.segmentType)} className="gap-1" data-testid={`badge-seg-type-${seg.id}`}>
                          {segmentTypeIcon(seg.segmentType)}
                          {seg.segmentType}
                        </Badge>
                      </td>
                      <td className="p-3 text-center text-muted-foreground">
                        {formatDuration(seg.durationSeconds)}
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant={seg.status === "queued" ? "outline" : "secondary"}>
                          {seg.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {seg.scheduledAt ? new Date(seg.scheduledAt).toLocaleString() : "-"}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => skipSegmentMutation.mutate(seg.id)}
                            data-testid={`button-skip-segment-${seg.id}`}
                          >
                            <SkipForward className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteSegmentMutation.mutate(seg.id)}
                            data-testid={`button-delete-segment-${seg.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {queuedSegments.length === 0 && (
                    <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No queued segments. Use Auto-Generate or Add Segment to build a playlist.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {playedSegments.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Recently Played / Skipped ({playedSegments.length})</h4>
              <div className="border rounded-md overflow-x-auto max-h-48 overflow-y-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {playedSegments.slice(0, 20).map((seg) => (
                      <tr key={seg.id} className="border-b last:border-b-0 opacity-60">
                        <td className="p-2 font-medium">{seg.title}</td>
                        <td className="p-2 text-center">
                          <Badge variant="outline" className="text-xs">{seg.segmentType}</Badge>
                        </td>
                        <td className="p-2 text-center text-muted-foreground text-xs">{seg.status}</td>
                        <td className="p-2 text-xs text-muted-foreground">
                          {seg.playedAt ? new Date(seg.playedAt).toLocaleString() : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={segmentDialogOpen} onOpenChange={setSegmentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Segment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={segTitle} onChange={(e) => setSegTitle(e.target.value)} data-testid="input-segment-title" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={segType} onValueChange={setSegType}>
                <SelectTrigger data-testid="select-segment-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="music">Music</SelectItem>
                  <SelectItem value="talk">Talk</SelectItem>
                  <SelectItem value="ad">Ad</SelectItem>
                  <SelectItem value="announcement">Announcement</SelectItem>
                  <SelectItem value="interview">Interview</SelectItem>
                  <SelectItem value="expert_show">Expert Show</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Audio URL</Label>
              <Input value={segAudioUrl} onChange={(e) => setSegAudioUrl(e.target.value)} data-testid="input-segment-audio-url" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Duration (sec)</Label>
                <Input type="number" value={segDuration} onChange={(e) => setSegDuration(e.target.value)} data-testid="input-segment-duration" />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Input type="number" value={segPriority} onChange={(e) => setSegPriority(e.target.value)} data-testid="input-segment-priority" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Scheduled At (optional)</Label>
              <Input type="datetime-local" value={segScheduledAt} onChange={(e) => setSegScheduledAt(e.target.value)} data-testid="input-segment-scheduled" />
            </div>
            <Button
              onClick={() => addSegmentMutation.mutate()}
              disabled={addSegmentMutation.isPending || !segTitle}
              className="w-full"
              data-testid="button-save-segment"
            >
              {addSegmentMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Add Segment
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SegmentsTab() {
  const { toast } = useToast();
  const [selectedStationId, setSelectedStationId] = useState<string>("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingSeg, setEditingSeg] = useState<RadioSegment | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editType, setEditType] = useState("music");
  const [editAudioUrl, setEditAudioUrl] = useState("");
  const [editDuration, setEditDuration] = useState("180");
  const [editPriority, setEditPriority] = useState("5");
  const [editStatus, setEditStatus] = useState("queued");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: stations } = useQuery<RadioStation[]>({
    queryKey: ["/api/admin/radio/stations"],
  });

  const { data: segments, isLoading } = useQuery<RadioSegment[]>({
    queryKey: ["/api/admin/radio/segments", selectedStationId],
    queryFn: async () => {
      const url = selectedStationId
        ? `/api/admin/radio/segments?stationId=${selectedStationId}`
        : "/api/admin/radio/segments";
      const resp = await fetch(url);
      if (!resp.ok) throw new Error("Failed to fetch");
      return resp.json();
    },
    enabled: !!selectedStationId,
  });

  const openEdit = (seg: RadioSegment) => {
    setEditingSeg(seg);
    setEditTitle(seg.title);
    setEditType(seg.segmentType);
    setEditAudioUrl(seg.audioUrl || "");
    setEditDuration(String(seg.durationSeconds || 180));
    setEditPriority(String(seg.priority));
    setEditStatus(seg.status);
    setEditDialogOpen(true);
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingSeg) return;
      return apiRequest("PATCH", `/api/admin/radio/segments/${editingSeg.id}`, {
        title: editTitle,
        segmentType: editType,
        audioUrl: editAudioUrl || null,
        durationSeconds: parseInt(editDuration) || 180,
        priority: parseInt(editPriority) || 5,
        status: editStatus,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/radio/segments", selectedStationId] });
      toast({ title: "Segment updated" });
      setEditDialogOpen(false);
    },
    onError: () => toast({ title: "Error updating segment", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/radio/segments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/radio/segments", selectedStationId] });
      toast({ title: "Segment deleted" });
    },
    onError: () => toast({ title: "Error deleting segment", variant: "destructive" }),
  });

  const skipMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("PATCH", `/api/admin/radio/segments/${id}`, { status: "skipped" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/radio/segments", selectedStationId] });
      toast({ title: "Segment skipped" });
    },
  });

  const filteredSegments = (segments || []).filter(s => {
    if (filterType !== "all" && s.segmentType !== filterType) return false;
    if (filterStatus !== "all" && s.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold" data-testid="text-segments-title">All Segments</h3>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Select value={selectedStationId} onValueChange={setSelectedStationId}>
          <SelectTrigger className="w-[200px]" data-testid="select-segments-station">
            <SelectValue placeholder="Select station..." />
          </SelectTrigger>
          <SelectContent>
            {(stations || []).map(s => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[140px]" data-testid="select-filter-type">
            <SelectValue placeholder="Type..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="music">Music</SelectItem>
            <SelectItem value="talk">Talk</SelectItem>
            <SelectItem value="ad">Ad</SelectItem>
            <SelectItem value="announcement">Announcement</SelectItem>
            <SelectItem value="interview">Interview</SelectItem>
            <SelectItem value="expert_show">Expert Show</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px]" data-testid="select-filter-status">
            <SelectValue placeholder="Status..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="queued">Queued</SelectItem>
            <SelectItem value="playing">Playing</SelectItem>
            <SelectItem value="played">Played</SelectItem>
            <SelectItem value="skipped">Skipped</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!selectedStationId ? (
        <Card className="p-6 text-center text-muted-foreground">
          <p className="text-sm">Select a station to view segments</p>
        </Card>
      ) : isLoading ? (
        <div className="text-sm text-muted-foreground p-4">Loading segments...</div>
      ) : (
        <div className="border rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Title</th>
                <th className="text-center p-3 font-medium">Type</th>
                <th className="text-center p-3 font-medium">Duration</th>
                <th className="text-center p-3 font-medium">Priority</th>
                <th className="text-center p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Scheduled</th>
                <th className="text-center p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSegments.map((seg) => (
                <tr key={seg.id} className="border-b last:border-b-0" data-testid={`row-all-segment-${seg.id}`}>
                  <td className="p-3 font-medium">{seg.title}</td>
                  <td className="p-3 text-center">
                    <Badge variant={segmentTypeBadgeVariant(seg.segmentType)} className="gap-1">
                      {segmentTypeIcon(seg.segmentType)}
                      {seg.segmentType}
                    </Badge>
                  </td>
                  <td className="p-3 text-center text-muted-foreground">{formatDuration(seg.durationSeconds)}</td>
                  <td className="p-3 text-center text-muted-foreground">{seg.priority}</td>
                  <td className="p-3 text-center">
                    <Badge variant={seg.status === "queued" ? "outline" : seg.status === "playing" ? "default" : "secondary"}>
                      {seg.status}
                    </Badge>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {seg.scheduledAt ? new Date(seg.scheduledAt).toLocaleString() : "-"}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(seg)} data-testid={`button-edit-seg-${seg.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {seg.status === "queued" && (
                        <Button size="icon" variant="ghost" onClick={() => skipMutation.mutate(seg.id)} data-testid={`button-skip-seg-${seg.id}`}>
                          <SkipForward className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(seg.id)} data-testid={`button-del-seg-${seg.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredSegments.length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No segments found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Segment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} data-testid="input-edit-seg-title" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={editType} onValueChange={setEditType}>
                <SelectTrigger data-testid="select-edit-seg-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="music">Music</SelectItem>
                  <SelectItem value="talk">Talk</SelectItem>
                  <SelectItem value="ad">Ad</SelectItem>
                  <SelectItem value="announcement">Announcement</SelectItem>
                  <SelectItem value="interview">Interview</SelectItem>
                  <SelectItem value="expert_show">Expert Show</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Audio URL</Label>
              <Input value={editAudioUrl} onChange={(e) => setEditAudioUrl(e.target.value)} data-testid="input-edit-seg-audio" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Duration (sec)</Label>
                <Input type="number" value={editDuration} onChange={(e) => setEditDuration(e.target.value)} data-testid="input-edit-seg-duration" />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Input type="number" value={editPriority} onChange={(e) => setEditPriority(e.target.value)} data-testid="input-edit-seg-priority" />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger data-testid="select-edit-seg-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="queued">Queued</SelectItem>
                    <SelectItem value="playing">Playing</SelectItem>
                    <SelectItem value="played">Played</SelectItem>
                    <SelectItem value="skipped">Skipped</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending || !editTitle}
              className="w-full"
              data-testid="button-update-segment"
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Update Segment
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatsPanel() {
  const { data: stations } = useQuery<RadioStation[]>({
    queryKey: ["/api/admin/radio/stations"],
  });

  const activeStations = (stations || []).filter(s => s.status === "live").length;
  const totalStations = (stations || []).length;

  const { data: adBookings } = useQuery<any[]>({
    queryKey: ["/api/admin/radio/ad-bookings"],
    queryFn: async () => {
      const resp = await fetch("/api/admin/radio/ad-bookings");
      if (!resp.ok) return [];
      return resp.json();
    },
  });

  const activeBookings = (adBookings || []).filter((b: any) => b.status === "active").length;
  const totalBookings = (adBookings || []).length;

  const stats = [
    { label: "Total Stations", value: totalStations, icon: Radio },
    { label: "Live Now", value: activeStations, icon: Activity },
    { label: "Active Ad Bookings", value: activeBookings, icon: Megaphone },
    { label: "Total Ad Bookings", value: totalBookings, icon: BarChart3 },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((stat) => (
        <Card key={stat.label} className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <stat.icon className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{stat.label}</span>
          </div>
          <p className="text-2xl font-bold" data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, "-")}`}>
            {stat.value}
          </p>
        </Card>
      ))}
    </div>
  );
}

export default function RadioManagementPanel({ cityId }: { cityId?: string }) {
  return (
    <div className="space-y-6 p-4" data-testid="radio-management-panel">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2" data-testid="text-radio-management-title">
          <Radio className="h-5 w-5" /> Hub Radio Management
        </h2>
        <p className="text-sm text-muted-foreground">Manage radio stations, programming, and segment scheduling</p>
      </div>

      <StatsPanel />

      <Tabs defaultValue="stations">
        <TabsList data-testid="radio-tabs">
          <TabsTrigger value="stations" data-testid="tab-stations">Stations</TabsTrigger>
          <TabsTrigger value="programming" data-testid="tab-programming">Programming</TabsTrigger>
          <TabsTrigger value="segments" data-testid="tab-segments">Segments</TabsTrigger>
        </TabsList>
        <TabsContent value="stations">
          <StationsTab />
        </TabsContent>
        <TabsContent value="programming">
          <ProgrammingTab />
        </TabsContent>
        <TabsContent value="segments">
          <SegmentsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
