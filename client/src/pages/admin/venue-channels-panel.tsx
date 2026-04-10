import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Plus, Pencil, Trash2, Loader2, Video, Radio, ShoppingBag, DollarSign, Eye
} from "lucide-react";
import { useState } from "react";
import type {
  VenueChannel, VideoContent, LiveSession, Offer, Transaction
} from "@shared/schema";

function formatCents(cents: number | null | undefined): string {
  if (cents == null) return "-";
  return `$${(cents / 100).toFixed(2)}`;
}

function extractYoutubeVideoId(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
    return u.searchParams.get("v") || "";
  } catch {
    return "";
  }
}

function youtubeThumbnail(videoId: string): string {
  if (!videoId) return "";
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}

function ChannelsTab({ cityId: propCityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<VenueChannel | null>(null);

  const [businessId, setBusinessId] = useState("");
  const [cityId, setCityId] = useState("");
  const [channelSlug, setChannelSlug] = useState("");
  const [channelTitle, setChannelTitle] = useState("");
  const [channelDescription, setChannelDescription] = useState("");
  const [youtubePlaylistId, setYoutubePlaylistId] = useState("");
  const [channelStatus, setChannelStatus] = useState("draft");

  const { data: channels, isLoading } = useQuery<VenueChannel[]>({
    queryKey: ["/api/admin/venue-channels", propCityId],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (propCityId) p.set("cityId", propCityId);
      const res = await fetch(`/api/admin/venue-channels?${p}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const resetForm = (c?: VenueChannel | null) => {
    setBusinessId(c?.businessId || "");
    setCityId(c?.cityId || "");
    setChannelSlug(c?.channelSlug || "");
    setChannelTitle(c?.channelTitle || "");
    setChannelDescription(c?.channelDescription || "");
    setYoutubePlaylistId(c?.youtubePlaylistId || "");
    setChannelStatus(c?.channelStatus || "draft");
  };

  const openCreate = () => { setEditing(null); resetForm(); setDialogOpen(true); };
  const openEdit = (c: VenueChannel) => { setEditing(c); resetForm(c); setDialogOpen(true); };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        businessId,
        cityId,
        channelSlug,
        channelTitle,
        channelDescription: channelDescription || null,
        youtubePlaylistId: youtubePlaylistId || null,
        channelStatus,
      };
      if (editing) {
        return apiRequest("PATCH", `/api/admin/venue-channels/${editing.id}`, body);
      }
      return apiRequest("POST", "/api/admin/venue-channels", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/venue-channels"] });
      toast({ title: editing ? "Channel updated" : "Channel created" });
      setDialogOpen(false);
    },
    onError: () => toast({ title: "Error saving channel", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/venue-channels/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/venue-channels"] });
      toast({ title: "Channel deleted" });
    },
    onError: () => toast({ title: "Error deleting channel", variant: "destructive" }),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground p-4" data-testid="text-loading-channels">Loading channels...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold" data-testid="text-channels-title">Venue Channels</h3>
        <Button onClick={openCreate} data-testid="button-create-channel">
          <Plus className="h-4 w-4 mr-1" /> New Channel
        </Button>
      </div>

      <div className="border rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Title</th>
              <th className="text-left p-3 font-medium">Slug</th>
              <th className="text-left p-3 font-medium">Business ID</th>
              <th className="text-center p-3 font-medium">Status</th>
              <th className="text-center p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(channels || []).map((c) => (
              <tr key={c.id} className="border-b last:border-b-0" data-testid={`row-channel-${c.id}`}>
                <td className="p-3 font-medium">{c.channelTitle}</td>
                <td className="p-3 text-muted-foreground">{c.channelSlug}</td>
                <td className="p-3 text-muted-foreground text-xs">{c.businessId}</td>
                <td className="p-3 text-center">
                  <Badge variant={c.channelStatus === "active" ? "default" : "secondary"} data-testid={`badge-channel-status-${c.id}`}>
                    {c.channelStatus}
                  </Badge>
                </td>
                <td className="p-3">
                  <div className="flex items-center justify-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(c)} data-testid={`button-edit-channel-${c.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(c.id)} data-testid={`button-delete-channel-${c.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {(channels || []).length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground" data-testid="text-no-channels">No venue channels</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Channel" : "Create Channel"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Channel Title</Label>
              <Input value={channelTitle} onChange={(e) => setChannelTitle(e.target.value)} data-testid="input-channel-title" />
            </div>
            <div className="space-y-2">
              <Label>Channel Slug</Label>
              <Input value={channelSlug} onChange={(e) => setChannelSlug(e.target.value)} data-testid="input-channel-slug" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Business ID</Label>
                <Input value={businessId} onChange={(e) => setBusinessId(e.target.value)} data-testid="input-channel-business-id" />
              </div>
              <div className="space-y-2">
                <Label>City ID</Label>
                <Input value={cityId} onChange={(e) => setCityId(e.target.value)} data-testid="input-channel-city-id" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>YouTube Playlist ID</Label>
              <Input value={youtubePlaylistId} onChange={(e) => setYoutubePlaylistId(e.target.value)} data-testid="input-channel-playlist-id" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={channelDescription} onChange={(e) => setChannelDescription(e.target.value)} className="resize-none" rows={3} data-testid="input-channel-description" />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={channelStatus} onValueChange={setChannelStatus}>
                <SelectTrigger data-testid="select-channel-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel-channel">Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-channel">
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editing ? "Update" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VideosTab({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<VideoContent | null>(null);
  const [filterChannelId, setFilterChannelId] = useState("");

  const [venueChannelId, setVenueChannelId] = useState("");
  const [vBusinessId, setVBusinessId] = useState("");
  const [vCityId, setVCityId] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeVideoId, setYoutubeVideoId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [screenEligible, setScreenEligible] = useState(false);
  const [pulseEligible, setPulseEligible] = useState(true);
  const [durationSec, setDurationSec] = useState("");
  const [sortOrder, setSortOrder] = useState("0");

  const { data: channels } = useQuery<VenueChannel[]>({
    queryKey: ["/api/admin/venue-channels", cityId],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (cityId) p.set("cityId", cityId);
      const res = await fetch(`/api/admin/venue-channels?${p}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: videos, isLoading } = useQuery<VideoContent[]>({
    queryKey: ["/api/admin/video-content", cityId, filterChannelId],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (filterChannelId) p.set("channelId", filterChannelId);
      else if (cityId) p.set("cityId", cityId);
      else p.set("cityId", "all");
      const res = await fetch(`/api/admin/video-content?${p}`, { credentials: "include" });
      return res.json();
    },
  });

  const resetForm = (v?: VideoContent | null) => {
    setVenueChannelId(v?.venueChannelId || "");
    setVBusinessId(v?.businessId || "");
    setVCityId(v?.cityId || "");
    setYoutubeUrl(v?.youtubeUrl || "");
    setYoutubeVideoId(v?.youtubeVideoId || "");
    setTitle(v?.title || "");
    setDescription(v?.description || "");
    setThumbnailUrl(v?.thumbnailUrl || "");
    setScreenEligible(v?.screenEligible || false);
    setPulseEligible(v?.pulseEligible ?? true);
    setDurationSec(v?.durationSec ? String(v.durationSec) : "");
    setSortOrder(String(v?.sortOrder || 0));
  };

  const openCreate = () => { setEditing(null); resetForm(); setDialogOpen(true); };
  const openEdit = (v: VideoContent) => { setEditing(v); resetForm(v); setDialogOpen(true); };

  const handleYoutubeUrlChange = (url: string) => {
    setYoutubeUrl(url);
    const vid = extractYoutubeVideoId(url);
    if (vid) {
      setYoutubeVideoId(vid);
      if (!thumbnailUrl) setThumbnailUrl(youtubeThumbnail(vid));
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        venueChannelId: venueChannelId || null,
        businessId: vBusinessId || null,
        cityId: vCityId,
        youtubeUrl: youtubeUrl || null,
        youtubeVideoId: youtubeVideoId || null,
        title,
        description: description || null,
        thumbnailUrl: thumbnailUrl || null,
        screenEligible,
        pulseEligible,
        durationSec: durationSec ? parseInt(durationSec) : null,
        sortOrder: parseInt(sortOrder) || 0,
      };
      if (editing) {
        return apiRequest("PATCH", `/api/admin/video-content/${editing.id}`, body);
      }
      return apiRequest("POST", "/api/admin/video-content", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/video-content"] });
      toast({ title: editing ? "Video updated" : "Video created" });
      setDialogOpen(false);
    },
    onError: () => toast({ title: "Error saving video", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/video-content/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/video-content"] });
      toast({ title: "Video deleted" });
    },
    onError: () => toast({ title: "Error deleting video", variant: "destructive" }),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground p-4" data-testid="text-loading-videos">Loading videos...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold" data-testid="text-videos-title">Videos</h3>
          <Select value={filterChannelId} onValueChange={setFilterChannelId}>
            <SelectTrigger className="w-48" data-testid="select-filter-channel">
              <SelectValue placeholder="Filter by channel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Channels</SelectItem>
              {(channels || []).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.channelTitle}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={openCreate} data-testid="button-create-video">
          <Plus className="h-4 w-4 mr-1" /> Add Video
        </Button>
      </div>

      <div className="border rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Thumbnail</th>
              <th className="text-left p-3 font-medium">Title</th>
              <th className="text-center p-3 font-medium">Screen</th>
              <th className="text-center p-3 font-medium">Pulse</th>
              <th className="text-center p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(videos || []).map((v) => (
              <tr key={v.id} className="border-b last:border-b-0" data-testid={`row-video-${v.id}`}>
                <td className="p-3">
                  {v.thumbnailUrl ? (
                    <img src={v.thumbnailUrl} alt={v.title} className="h-10 w-16 object-cover rounded-md" data-testid={`img-video-thumb-${v.id}`} />
                  ) : (
                    <div className="h-10 w-16 bg-muted rounded-md flex items-center justify-center">
                      <Video className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </td>
                <td className="p-3">
                  <div className="font-medium" data-testid={`text-video-title-${v.id}`}>{v.title}</div>
                  {v.youtubeVideoId && <div className="text-xs text-muted-foreground">{v.youtubeVideoId}</div>}
                </td>
                <td className="p-3 text-center">
                  <Badge variant={v.screenEligible ? "default" : "outline"} data-testid={`badge-screen-${v.id}`}>
                    {v.screenEligible ? "Yes" : "No"}
                  </Badge>
                </td>
                <td className="p-3 text-center">
                  <Badge variant={v.pulseEligible ? "default" : "outline"} data-testid={`badge-pulse-${v.id}`}>
                    {v.pulseEligible ? "Yes" : "No"}
                  </Badge>
                </td>
                <td className="p-3">
                  <div className="flex items-center justify-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(v)} data-testid={`button-edit-video-${v.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(v.id)} data-testid={`button-delete-video-${v.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {(videos || []).length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground" data-testid="text-no-videos">No videos</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Video" : "Add Video"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>YouTube URL</Label>
              <Input value={youtubeUrl} onChange={(e) => handleYoutubeUrlChange(e.target.value)} placeholder="https://youtube.com/watch?v=..." data-testid="input-video-youtube-url" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Video ID (auto-extracted)</Label>
                <Input value={youtubeVideoId} onChange={(e) => setYoutubeVideoId(e.target.value)} data-testid="input-video-youtube-id" />
              </div>
              <div className="space-y-2">
                <Label>Duration (sec)</Label>
                <Input value={durationSec} onChange={(e) => setDurationSec(e.target.value)} type="number" data-testid="input-video-duration" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} data-testid="input-video-title" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="resize-none" rows={2} data-testid="input-video-description" />
            </div>
            <div className="space-y-2">
              <Label>Thumbnail URL</Label>
              <Input value={thumbnailUrl} onChange={(e) => setThumbnailUrl(e.target.value)} data-testid="input-video-thumbnail" />
              {thumbnailUrl && <img src={thumbnailUrl} alt="Thumbnail preview" className="h-16 rounded-md" />}
            </div>
            <div className="space-y-2">
              <Label>Channel</Label>
              <Select value={venueChannelId || "none"} onValueChange={(v) => setVenueChannelId(v === "none" ? "" : v)}>
                <SelectTrigger data-testid="select-video-channel"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Channel</SelectItem>
                  {(channels || []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.channelTitle}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Business ID</Label>
                <Input value={vBusinessId} onChange={(e) => setVBusinessId(e.target.value)} data-testid="input-video-business-id" />
              </div>
              <div className="space-y-2">
                <Label>City ID</Label>
                <Input value={vCityId} onChange={(e) => setVCityId(e.target.value)} data-testid="input-video-city-id" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} type="number" data-testid="input-video-sort-order" />
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={screenEligible} onCheckedChange={setScreenEligible} data-testid="switch-screen-eligible" />
                <Label>Screen Eligible</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={pulseEligible} onCheckedChange={setPulseEligible} data-testid="switch-pulse-eligible" />
                <Label>Pulse Eligible</Label>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel-video">Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-video">
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editing ? "Update" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LiveSessionsTab({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LiveSession | null>(null);

  const [lsBusinessId, setLsBusinessId] = useState("");
  const [lsCityId, setLsCityId] = useState("");
  const [lsVenueChannelId, setLsVenueChannelId] = useState("");
  const [lsYoutubeLiveUrl, setLsYoutubeLiveUrl] = useState("");
  const [lsYoutubeVideoId, setLsYoutubeVideoId] = useState("");
  const [lsStatus, setLsStatus] = useState("scheduled");
  const [lsTitle, setLsTitle] = useState("");
  const [lsDescription, setLsDescription] = useState("");
  const [lsThumbnailUrl, setLsThumbnailUrl] = useState("");
  const [lsStartTime, setLsStartTime] = useState("");
  const [lsEndTime, setLsEndTime] = useState("");
  const [lsAttachedOfferIds, setLsAttachedOfferIds] = useState<string[]>([]);

  const { data: channels } = useQuery<VenueChannel[]>({
    queryKey: ["/api/admin/venue-channels", cityId],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (cityId) p.set("cityId", cityId);
      const res = await fetch(`/api/admin/venue-channels?${p}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: sessions, isLoading } = useQuery<LiveSession[]>({
    queryKey: ["/api/admin/live-sessions", cityId],
    queryFn: async () => {
      const p = new URLSearchParams();
      p.set("cityId", cityId || "all");
      const res = await fetch(`/api/admin/live-sessions?${p}`, { credentials: "include" });
      return res.json();
    },
  });

  const { data: availableOffers } = useQuery<Offer[]>({
    queryKey: ["/api/admin/offers", "for-session", lsBusinessId],
    queryFn: async () => {
      if (!lsBusinessId) return [];
      const res = await fetch(`/api/admin/offers?businessId=${lsBusinessId}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!lsBusinessId && dialogOpen,
  });

  const resetForm = (s?: LiveSession | null) => {
    setLsBusinessId(s?.businessId || "");
    setLsCityId(s?.cityId || "");
    setLsVenueChannelId(s?.venueChannelId || "");
    setLsYoutubeLiveUrl(s?.youtubeLiveUrl || "");
    setLsYoutubeVideoId(s?.youtubeVideoId || "");
    setLsStatus(s?.status || "scheduled");
    setLsTitle(s?.title || "");
    setLsDescription(s?.description || "");
    setLsThumbnailUrl(s?.thumbnailUrl || "");
    setLsStartTime(s?.startTime ? new Date(s.startTime).toISOString().slice(0, 16) : "");
    setLsEndTime(s?.endTime ? new Date(s.endTime).toISOString().slice(0, 16) : "");
    setLsAttachedOfferIds(s?.attachedOfferIds || []);
  };

  const openCreate = () => { setEditing(null); resetForm(); setDialogOpen(true); };
  const openEdit = (s: LiveSession) => { setEditing(s); resetForm(s); setDialogOpen(true); };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, any> = {
        businessId: lsBusinessId,
        cityId: lsCityId,
        venueChannelId: lsVenueChannelId || null,
        youtubeLiveUrl: lsYoutubeLiveUrl || null,
        youtubeVideoId: lsYoutubeVideoId || null,
        status: lsStatus,
        title: lsTitle,
        description: lsDescription || null,
        thumbnailUrl: lsThumbnailUrl || null,
        startTime: lsStartTime ? new Date(lsStartTime).toISOString() : null,
        endTime: lsEndTime ? new Date(lsEndTime).toISOString() : null,
        attachedOfferIds: lsAttachedOfferIds,
      };
      if (editing) {
        return apiRequest("PATCH", `/api/admin/live-sessions/${editing.id}`, body);
      }
      return apiRequest("POST", "/api/admin/live-sessions", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/live-sessions"] });
      toast({ title: editing ? "Session updated" : "Session created" });
      setDialogOpen(false);
    },
    onError: () => toast({ title: "Error saving session", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/live-sessions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/live-sessions"] });
      toast({ title: "Session cancelled" });
    },
    onError: () => toast({ title: "Error cancelling session", variant: "destructive" }),
  });

  const statusColor = (s: string) => {
    switch (s) {
      case "live": return "destructive" as const;
      case "scheduled": return "default" as const;
      case "ended": return "secondary" as const;
      case "cancelled": return "outline" as const;
      default: return "secondary" as const;
    }
  };

  if (isLoading) return <div className="text-sm text-muted-foreground p-4" data-testid="text-loading-sessions">Loading sessions...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold" data-testid="text-sessions-title">Live Sessions</h3>
        <Button onClick={openCreate} data-testid="button-create-session">
          <Plus className="h-4 w-4 mr-1" /> Schedule Session
        </Button>
      </div>

      <div className="border rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Title</th>
              <th className="text-left p-3 font-medium">Start</th>
              <th className="text-center p-3 font-medium">Status</th>
              <th className="text-center p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(sessions || []).map((s) => (
              <tr key={s.id} className="border-b last:border-b-0" data-testid={`row-session-${s.id}`}>
                <td className="p-3 font-medium" data-testid={`text-session-title-${s.id}`}>{s.title}</td>
                <td className="p-3 text-muted-foreground text-xs">
                  {s.startTime ? new Date(s.startTime).toLocaleString() : "-"}
                </td>
                <td className="p-3 text-center">
                  <div className="flex items-center justify-center gap-1 flex-wrap">
                    <Badge variant={statusColor(s.status)} data-testid={`badge-session-status-${s.id}`}>
                      {s.status}
                    </Badge>
                    {s.attachedOfferIds && s.attachedOfferIds.length > 0 && (
                      <Badge variant="outline" data-testid={`badge-session-offers-${s.id}`}>
                        <ShoppingBag className="h-3 w-3 mr-0.5" />
                        {s.attachedOfferIds.length}
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex items-center justify-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(s)} data-testid={`button-edit-session-${s.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(s.id)} data-testid={`button-cancel-session-${s.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {(sessions || []).length === 0 && (
              <tr><td colSpan={4} className="p-6 text-center text-muted-foreground" data-testid="text-no-sessions">No live sessions</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Live Session" : "Schedule Live Session"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={lsTitle} onChange={(e) => setLsTitle(e.target.value)} data-testid="input-session-title" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={lsDescription} onChange={(e) => setLsDescription(e.target.value)} className="resize-none" rows={2} data-testid="input-session-description" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Business ID</Label>
                <Input value={lsBusinessId} onChange={(e) => setLsBusinessId(e.target.value)} data-testid="input-session-business-id" />
              </div>
              <div className="space-y-2">
                <Label>City ID</Label>
                <Input value={lsCityId} onChange={(e) => setLsCityId(e.target.value)} data-testid="input-session-city-id" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Channel</Label>
              <Select value={lsVenueChannelId || "none"} onValueChange={(v) => setLsVenueChannelId(v === "none" ? "" : v)}>
                <SelectTrigger data-testid="select-session-channel"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Channel</SelectItem>
                  {(channels || []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.channelTitle}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>YouTube Live URL</Label>
              <Input value={lsYoutubeLiveUrl} onChange={(e) => setLsYoutubeLiveUrl(e.target.value)} data-testid="input-session-youtube-url" />
            </div>
            <div className="space-y-2">
              <Label>YouTube Video ID</Label>
              <Input value={lsYoutubeVideoId} onChange={(e) => setLsYoutubeVideoId(e.target.value)} data-testid="input-session-youtube-id" />
            </div>
            <div className="space-y-2">
              <Label>Thumbnail URL</Label>
              <Input value={lsThumbnailUrl} onChange={(e) => setLsThumbnailUrl(e.target.value)} data-testid="input-session-thumbnail" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input type="datetime-local" value={lsStartTime} onChange={(e) => setLsStartTime(e.target.value)} data-testid="input-session-start" />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input type="datetime-local" value={lsEndTime} onChange={(e) => setLsEndTime(e.target.value)} data-testid="input-session-end" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={lsStatus} onValueChange={setLsStatus}>
                <SelectTrigger data-testid="select-session-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="live">Live</SelectItem>
                  <SelectItem value="ended">Ended</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {lsBusinessId && (availableOffers || []).length > 0 && (
              <div className="space-y-2">
                <Label>Attach Offers</Label>
                <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
                  {(availableOffers || []).map((offer) => {
                    const isSelected = lsAttachedOfferIds.includes(offer.id);
                    return (
                      <label key={offer.id} className="flex items-center gap-2 cursor-pointer" data-testid={`label-attach-offer-${offer.id}`}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            if (isSelected) {
                              setLsAttachedOfferIds(lsAttachedOfferIds.filter((id) => id !== offer.id));
                            } else {
                              setLsAttachedOfferIds([...lsAttachedOfferIds, offer.id]);
                            }
                          }}
                          className="rounded"
                          data-testid={`checkbox-attach-offer-${offer.id}`}
                        />
                        <span className="text-sm flex-1 truncate">{offer.title}</span>
                        <span className="text-xs text-muted-foreground">{formatCents(offer.price)}</span>
                        <Badge variant={offer.active ? "default" : "secondary"} className="text-[10px]">
                          {offer.active ? "Active" : "Inactive"}
                        </Badge>
                      </label>
                    );
                  })}
                </div>
                {lsAttachedOfferIds.length > 0 && (
                  <p className="text-xs text-muted-foreground" data-testid="text-attached-count">
                    {lsAttachedOfferIds.length} offer{lsAttachedOfferIds.length !== 1 ? "s" : ""} attached
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel-session-dialog">Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-session">
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editing ? "Update" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OffersTab({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Offer | null>(null);
  const [filterBusinessId, setFilterBusinessId] = useState("");

  const [oBusinessId, setOBusinessId] = useState("");
  const [oCityId, setOCityId] = useState("");
  const [oTitle, setOTitle] = useState("");
  const [oDescription, setODescription] = useState("");
  const [oPrice, setOPrice] = useState("");
  const [oProductType, setOProductType] = useState("product");
  const [oImageUrl, setOImageUrl] = useState("");
  const [oCheckoutUrl, setOCheckoutUrl] = useState("");
  const [oLiveSessionId, setOLiveSessionId] = useState("");
  const [oVideoContentId, setOVideoContentId] = useState("");
  const [oActive, setOActive] = useState(true);

  const { data: offers, isLoading } = useQuery<Offer[]>({
    queryKey: ["/api/admin/offers", cityId, filterBusinessId],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (filterBusinessId) p.set("businessId", filterBusinessId);
      else p.set("cityId", cityId || "all");
      const res = await fetch(`/api/admin/offers?${p}`, { credentials: "include" });
      return res.json();
    },
  });

  const resetForm = (o?: Offer | null) => {
    setOBusinessId(o?.businessId || "");
    setOCityId(o?.cityId || "");
    setOTitle(o?.title || "");
    setODescription(o?.description || "");
    setOPrice(o?.price ? String(o.price) : "");
    setOProductType(o?.productType || "product");
    setOImageUrl(o?.imageUrl || "");
    setOCheckoutUrl(o?.checkoutUrl || "");
    setOLiveSessionId(o?.liveSessionId || "");
    setOVideoContentId(o?.videoContentId || "");
    setOActive(o?.active ?? true);
  };

  const openCreate = () => { setEditing(null); resetForm(); setDialogOpen(true); };
  const openEdit = (o: Offer) => { setEditing(o); resetForm(o); setDialogOpen(true); };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        businessId: oBusinessId,
        cityId: oCityId,
        title: oTitle,
        description: oDescription || null,
        price: oPrice ? parseInt(oPrice) : null,
        productType: oProductType,
        imageUrl: oImageUrl || null,
        checkoutUrl: oCheckoutUrl || null,
        liveSessionId: oLiveSessionId || null,
        videoContentId: oVideoContentId || null,
        active: oActive,
      };
      if (editing) {
        return apiRequest("PATCH", `/api/admin/offers/${editing.id}`, body);
      }
      return apiRequest("POST", "/api/admin/offers", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/offers"] });
      toast({ title: editing ? "Offer updated" : "Offer created" });
      setDialogOpen(false);
    },
    onError: () => toast({ title: "Error saving offer", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/offers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/offers"] });
      toast({ title: "Offer deleted" });
    },
    onError: () => toast({ title: "Error deleting offer", variant: "destructive" }),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground p-4" data-testid="text-loading-offers">Loading offers...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold" data-testid="text-offers-title">Offers</h3>
          <Input
            value={filterBusinessId}
            onChange={(e) => setFilterBusinessId(e.target.value)}
            placeholder="Filter by Business ID"
            className="w-48"
            data-testid="input-filter-offers-business"
          />
        </div>
        <Button onClick={openCreate} data-testid="button-create-offer">
          <Plus className="h-4 w-4 mr-1" /> New Offer
        </Button>
      </div>

      <div className="border rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Title</th>
              <th className="text-left p-3 font-medium">Type</th>
              <th className="text-right p-3 font-medium">Price</th>
              <th className="text-center p-3 font-medium">Active</th>
              <th className="text-center p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(offers || []).map((o) => (
              <tr key={o.id} className="border-b last:border-b-0" data-testid={`row-offer-${o.id}`}>
                <td className="p-3 font-medium" data-testid={`text-offer-title-${o.id}`}>{o.title}</td>
                <td className="p-3">
                  <Badge variant="outline">{o.productType}</Badge>
                </td>
                <td className="p-3 text-right" data-testid={`text-offer-price-${o.id}`}>{formatCents(o.price)}</td>
                <td className="p-3 text-center">
                  <Badge variant={o.active ? "default" : "secondary"} data-testid={`badge-offer-active-${o.id}`}>
                    {o.active ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td className="p-3">
                  <div className="flex items-center justify-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(o)} data-testid={`button-edit-offer-${o.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(o.id)} data-testid={`button-delete-offer-${o.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {(offers || []).length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground" data-testid="text-no-offers">No offers</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Offer" : "Create Offer"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={oTitle} onChange={(e) => setOTitle(e.target.value)} data-testid="input-offer-title" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={oDescription} onChange={(e) => setODescription(e.target.value)} className="resize-none" rows={2} data-testid="input-offer-description" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Price (cents)</Label>
                <Input value={oPrice} onChange={(e) => setOPrice(e.target.value)} type="number" data-testid="input-offer-price" />
              </div>
              <div className="space-y-2">
                <Label>Product Type</Label>
                <Select value={oProductType} onValueChange={setOProductType}>
                  <SelectTrigger data-testid="select-offer-product-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="product">Product</SelectItem>
                    <SelectItem value="event">Event</SelectItem>
                    <SelectItem value="bundle">Bundle</SelectItem>
                    <SelectItem value="gift_card">Gift Card</SelectItem>
                    <SelectItem value="reservation">Reservation</SelectItem>
                    <SelectItem value="promotion">Promotion</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Business ID</Label>
                <Input value={oBusinessId} onChange={(e) => setOBusinessId(e.target.value)} data-testid="input-offer-business-id" />
              </div>
              <div className="space-y-2">
                <Label>City ID</Label>
                <Input value={oCityId} onChange={(e) => setOCityId(e.target.value)} data-testid="input-offer-city-id" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Image URL</Label>
              <Input value={oImageUrl} onChange={(e) => setOImageUrl(e.target.value)} data-testid="input-offer-image" />
            </div>
            <div className="space-y-2">
              <Label>Checkout URL</Label>
              <Input value={oCheckoutUrl} onChange={(e) => setOCheckoutUrl(e.target.value)} data-testid="input-offer-checkout-url" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Live Session ID</Label>
                <Input value={oLiveSessionId} onChange={(e) => setOLiveSessionId(e.target.value)} data-testid="input-offer-live-session-id" />
              </div>
              <div className="space-y-2">
                <Label>Video Content ID</Label>
                <Input value={oVideoContentId} onChange={(e) => setOVideoContentId(e.target.value)} data-testid="input-offer-video-id" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={oActive} onCheckedChange={setOActive} data-testid="switch-offer-active" />
              <Label>Active</Label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel-offer">Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-offer">
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editing ? "Update" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TransactionsTab({ cityId }: { cityId?: string }) {
  const [filterBusinessId, setFilterBusinessId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data: txns, isLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/admin/transactions", cityId, filterBusinessId, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      if (filterBusinessId) params.set("businessId", filterBusinessId);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      const qs = params.toString();
      const res = await fetch(`/api/admin/transactions${qs ? `?${qs}` : ""}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!filterBusinessId,
  });

  const totalAmount = (txns || []).reduce((sum, t) => sum + t.amount, 0);
  const totalPlatform = (txns || []).reduce((sum, t) => sum + t.platformShare, 0);
  const totalVenue = (txns || []).reduce((sum, t) => sum + t.venueShare, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold" data-testid="text-transactions-title">Transactions</h3>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Input
          value={filterBusinessId}
          onChange={(e) => setFilterBusinessId(e.target.value)}
          placeholder="Business ID"
          className="w-48"
          data-testid="input-filter-txn-business"
        />
        <Input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-40"
          data-testid="input-filter-txn-start"
        />
        <Input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="w-40"
          data-testid="input-filter-txn-end"
        />
      </div>

      {!filterBusinessId && (
        <div className="text-sm text-muted-foreground p-4" data-testid="text-txn-enter-business">Enter a Business ID to view transactions</div>
      )}

      {filterBusinessId && isLoading && (
        <div className="text-sm text-muted-foreground p-4" data-testid="text-loading-transactions">Loading transactions...</div>
      )}

      {filterBusinessId && !isLoading && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Total Amount</div>
              <div className="text-lg font-semibold" data-testid="text-total-amount">{formatCents(totalAmount)}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Platform Share</div>
              <div className="text-lg font-semibold" data-testid="text-total-platform">{formatCents(totalPlatform)}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Venue Share</div>
              <div className="text-lg font-semibold" data-testid="text-total-venue">{formatCents(totalVenue)}</div>
            </Card>
          </div>

          <div className="border rounded-md overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Date</th>
                  <th className="text-right p-3 font-medium">Amount</th>
                  <th className="text-right p-3 font-medium">Platform</th>
                  <th className="text-right p-3 font-medium">Venue</th>
                  <th className="text-center p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Buyer</th>
                </tr>
              </thead>
              <tbody>
                {(txns || []).map((t) => (
                  <tr key={t.id} className="border-b last:border-b-0" data-testid={`row-txn-${t.id}`}>
                    <td className="p-3 text-muted-foreground text-xs">
                      {new Date(t.createdAt).toLocaleString()}
                    </td>
                    <td className="p-3 text-right font-medium" data-testid={`text-txn-amount-${t.id}`}>{formatCents(t.amount)}</td>
                    <td className="p-3 text-right text-muted-foreground">{formatCents(t.platformShare)}</td>
                    <td className="p-3 text-right text-muted-foreground">{formatCents(t.venueShare)}</td>
                    <td className="p-3 text-center">
                      <Badge
                        variant={t.status === "completed" ? "default" : t.status === "refunded" ? "destructive" : "secondary"}
                        data-testid={`badge-txn-status-${t.id}`}
                      >
                        {t.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-muted-foreground text-xs">{t.buyerEmail || "-"}</td>
                  </tr>
                ))}
                {(txns || []).length === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground" data-testid="text-no-transactions">No transactions</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default function VenueChannelsPanel({ cityId }: { cityId?: string }) {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold" data-testid="text-venue-channels-heading">Venue Channels</h2>
        <p className="text-sm text-muted-foreground">Manage venue channels, videos, live sessions, offers, and transactions</p>
      </div>

      <Tabs defaultValue="channels">
        <TabsList data-testid="tabs-venue-channels">
          <TabsTrigger value="channels" data-testid="tab-channels">
            <Video className="h-4 w-4 mr-1" /> Channels
          </TabsTrigger>
          <TabsTrigger value="videos" data-testid="tab-videos">
            <Eye className="h-4 w-4 mr-1" /> Videos
          </TabsTrigger>
          <TabsTrigger value="live-sessions" data-testid="tab-live-sessions">
            <Radio className="h-4 w-4 mr-1" /> Live Sessions
          </TabsTrigger>
          <TabsTrigger value="offers" data-testid="tab-offers">
            <ShoppingBag className="h-4 w-4 mr-1" /> Offers
          </TabsTrigger>
          <TabsTrigger value="transactions" data-testid="tab-transactions">
            <DollarSign className="h-4 w-4 mr-1" /> Transactions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="channels">
          <ChannelsTab cityId={cityId} />
        </TabsContent>
        <TabsContent value="videos">
          <VideosTab cityId={cityId} />
        </TabsContent>
        <TabsContent value="live-sessions">
          <LiveSessionsTab cityId={cityId} />
        </TabsContent>
        <TabsContent value="offers">
          <OffersTab cityId={cityId} />
        </TabsContent>
        <TabsContent value="transactions">
          <TransactionsTab cityId={cityId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
