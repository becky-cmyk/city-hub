import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Plus, Pencil, Trash2, Check, X, Loader2, Music, Mic2, Settings2, Users,
  Play, Pause, Star, Search, Filter, Volume2, Headphones, Zap, ChevronDown, ChevronRight,
  BarChart3, Upload, Eye
} from "lucide-react";
import { useState, useRef, useCallback } from "react";
import type { MusicArtist, MusicTrack, MusicMoodPreset, VenueAudioProfile } from "@shared/schema";

type VenueProfileWithMeta = VenueAudioProfile & {
  venueName?: string | null;
  screenKey?: string | null;
  hubSlug?: string | null;
};

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  approved: "default",
  pending: "secondary",
  rejected: "destructive",
  suspended: "outline",
};

const MOOD_OPTIONS = ["chill", "focus", "upbeat", "nightlife", "background", "energy"];
const GENRE_OPTIONS = [
  "pop", "r&b", "hip-hop", "jazz", "rock", "indie", "electronic", "dance",
  "acoustic", "soul", "lo-fi", "ambient", "classical", "latin", "country", "folk",
];
const ENERGY_OPTIONS = ["low", "medium", "high"];

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "-";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function StatsBar({ artists, tracks, presets, venueProfiles }: {
  artists: MusicArtist[];
  tracks: MusicTrack[];
  presets: MusicMoodPreset[];
  venueProfiles: VenueProfileWithMeta[];
}) {
  const totalArtists = artists.length;
  const totalTracks = tracks.length;
  const pendingArtists = artists.filter(a => a.status === "pending").length;
  const pendingTracks = tracks.filter(t => t.status === "pending").length;
  const totalPlays = tracks.reduce((sum, t) => sum + (t.playCount || 0), 0);
  const venuesWithProfiles = venueProfiles.length;

  const stats = [
    { label: "Artists", value: totalArtists, icon: Users },
    { label: "Tracks", value: totalTracks, icon: Music },
    { label: "Pending", value: pendingArtists + pendingTracks, icon: Loader2 },
    { label: "Total Plays", value: totalPlays.toLocaleString(), icon: Play },
    { label: "Presets", value: presets.length, icon: Settings2 },
    { label: "Venue Profiles", value: venuesWithProfiles, icon: Volume2 },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="stats-bar">
      {stats.map(s => (
        <Card key={s.label} className="p-3">
          <div className="flex items-center gap-2">
            <s.icon className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-lg font-bold leading-none" data-testid={`stat-${s.label.toLowerCase().replace(/\s+/g, "-")}`}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function ArtistsTab() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [genreFilter, setGenreFilter] = useState<string>("");
  const [searchQ, setSearchQ] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingArtist, setEditingArtist] = useState<MusicArtist | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [formName, setFormName] = useState("");
  const [formBio, setFormBio] = useState("");
  const [formGenre, setFormGenre] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formWebsiteUrl, setFormWebsiteUrl] = useState("");
  const [formEmail, setFormEmail] = useState("");

  const { data: artists = [], isLoading } = useQuery<MusicArtist[]>({
    queryKey: ["/api/admin/music/artists", statusFilter, genreFilter, searchQ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      if (genreFilter) params.set("genre", genreFilter);
      if (searchQ) params.set("q", searchQ);
      const resp = await fetch(`/api/admin/music/artists?${params}`, { credentials: "include" });
      return resp.json();
    },
  });

  const { data: artistTracks = [] } = useQuery<MusicTrack[]>({
    queryKey: ["/api/admin/music/tracks", { artistId: expandedId }],
    queryFn: async () => {
      if (!expandedId) return [];
      const resp = await fetch(`/api/admin/music/tracks?artistId=${expandedId}`, { credentials: "include" });
      return resp.json();
    },
    enabled: !!expandedId,
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/admin/music/artists/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/music/artists"] });
      toast({ title: "Artist status updated" });
    },
    onError: () => toast({ title: "Error updating status", variant: "destructive" }),
  });

  const bulkApproveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map(id =>
        apiRequest("PATCH", `/api/admin/music/artists/${id}/status`, { status: "approved" })
      ));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/music/artists"] });
      setSelectedIds(new Set());
      toast({ title: "Artists approved" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/music/artists/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/music/artists"] });
      toast({ title: "Artist deleted" });
    },
    onError: () => toast({ title: "Error deleting artist", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingArtist) return;
      await apiRequest("PATCH", `/api/admin/music/artists/${editingArtist.id}`, {
        name: formName,
        bio: formBio || null,
        genre: formGenre || null,
        imageUrl: formImageUrl || null,
        websiteUrl: formWebsiteUrl || null,
        submittedByEmail: formEmail || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/music/artists"] });
      toast({ title: "Artist updated" });
      setEditDialogOpen(false);
    },
    onError: () => toast({ title: "Error updating artist", variant: "destructive" }),
  });

  const openEdit = (a: MusicArtist) => {
    setEditingArtist(a);
    setFormName(a.name);
    setFormBio(a.bio || "");
    setFormGenre(a.genre || "");
    setFormImageUrl(a.imageUrl || "");
    setFormWebsiteUrl(a.websiteUrl || "");
    setFormEmail(a.submittedByEmail || "");
    setEditDialogOpen(true);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === artists.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(artists.map(a => a.id)));
  };

  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">Loading artists...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="Search artists..."
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            data-testid="input-search-artists"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px]" data-testid="select-artist-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Filter by genre..."
          value={genreFilter}
          onChange={e => setGenreFilter(e.target.value)}
          className="w-[140px]"
          data-testid="input-genre-filter"
        />
        {selectedIds.size > 0 && (
          <Button
            onClick={() => bulkApproveMutation.mutate(Array.from(selectedIds))}
            disabled={bulkApproveMutation.isPending}
            data-testid="button-bulk-approve"
          >
            {bulkApproveMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
            Approve ({selectedIds.size})
          </Button>
        )}
      </div>

      <div className="border rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-3 w-8">
                <Checkbox checked={selectedIds.size === artists.length && artists.length > 0} onCheckedChange={toggleAll} data-testid="checkbox-select-all-artists" />
              </th>
              <th className="text-left p-3 font-medium">Artist</th>
              <th className="text-left p-3 font-medium">Genre</th>
              <th className="text-center p-3 font-medium">Status</th>
              <th className="text-center p-3 font-medium">Featured</th>
              <th className="text-left p-3 font-medium">Email</th>
              <th className="text-center p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {artists.map(a => (
              <>
                <tr key={a.id} className="border-b last:border-b-0" data-testid={`row-artist-${a.id}`}>
                  <td className="p-3">
                    <Checkbox
                      checked={selectedIds.has(a.id)}
                      onCheckedChange={() => toggleSelect(a.id)}
                      data-testid={`checkbox-artist-${a.id}`}
                    />
                  </td>
                  <td className="p-3">
                    <button
                      className="flex items-center gap-2 text-left"
                      onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                      data-testid={`button-expand-artist-${a.id}`}
                    >
                      {expandedId === a.id ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                      {a.imageUrl && <img src={a.imageUrl} alt="" className="h-8 w-8 rounded-md object-cover shrink-0" />}
                      <span className="font-medium">{a.name}</span>
                    </button>
                  </td>
                  <td className="p-3 text-muted-foreground">{a.genre || "-"}</td>
                  <td className="p-3 text-center">
                    <Badge variant={STATUS_COLORS[a.status] || "secondary"} data-testid={`badge-artist-status-${a.id}`}>
                      {a.status}
                    </Badge>
                  </td>
                  <td className="p-3 text-center">
                    {a.featured && <Star className="h-4 w-4 text-yellow-500 mx-auto" />}
                  </td>
                  <td className="p-3 text-muted-foreground text-xs">{a.submittedByEmail || "-"}</td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-1">
                      {a.status !== "approved" && (
                        <Button size="icon" variant="ghost" onClick={() => statusMutation.mutate({ id: a.id, status: "approved" })} data-testid={`button-approve-artist-${a.id}`}>
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                      )}
                      {a.status !== "rejected" && (
                        <Button size="icon" variant="ghost" onClick={() => statusMutation.mutate({ id: a.id, status: "rejected" })} data-testid={`button-reject-artist-${a.id}`}>
                          <X className="h-4 w-4 text-red-600" />
                        </Button>
                      )}
                      {a.status === "approved" && (
                        <Button size="icon" variant="ghost" onClick={() => statusMutation.mutate({ id: a.id, status: "suspended" })} data-testid={`button-suspend-artist-${a.id}`}>
                          <Pause className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => openEdit(a)} data-testid={`button-edit-artist-${a.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(a.id)} data-testid={`button-delete-artist-${a.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
                {expandedId === a.id && (
                  <tr key={`${a.id}-tracks`} className="border-b bg-muted/30">
                    <td colSpan={7} className="p-3">
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Tracks by {a.name}</p>
                        {artistTracks.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No tracks found</p>
                        ) : (
                          <div className="space-y-1">
                            {artistTracks.map(t => (
                              <div key={t.id} className="flex items-center gap-3 text-xs py-1" data-testid={`row-artist-track-${t.id}`}>
                                <Badge variant={STATUS_COLORS[t.status] || "secondary"} className="text-[10px]">{t.status}</Badge>
                                <span className="font-medium">{t.title}</span>
                                <span className="text-muted-foreground">{t.genre || "-"}</span>
                                <span className="text-muted-foreground">{formatDuration(t.durationSeconds)}</span>
                                <span className="text-muted-foreground">{t.playCount} plays</span>
                                {t.mood && t.mood.length > 0 && (
                                  <div className="flex gap-1">{t.mood.map(m => <Badge key={m} variant="outline" className="text-[9px]">{m}</Badge>)}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {artists.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No artists found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Artist</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} data-testid="input-edit-artist-name" />
            </div>
            <div className="space-y-2">
              <Label>Genre</Label>
              <Input value={formGenre} onChange={e => setFormGenre(e.target.value)} data-testid="input-edit-artist-genre" />
            </div>
            <div className="space-y-2">
              <Label>Bio</Label>
              <Textarea value={formBio} onChange={e => setFormBio(e.target.value)} rows={3} className="resize-none" data-testid="input-edit-artist-bio" />
            </div>
            <div className="space-y-2">
              <Label>Image URL</Label>
              <Input value={formImageUrl} onChange={e => setFormImageUrl(e.target.value)} data-testid="input-edit-artist-image" />
            </div>
            <div className="space-y-2">
              <Label>Website URL</Label>
              <Input value={formWebsiteUrl} onChange={e => setFormWebsiteUrl(e.target.value)} data-testid="input-edit-artist-website" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={formEmail} onChange={e => setFormEmail(e.target.value)} data-testid="input-edit-artist-email" />
            </div>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} className="w-full" data-testid="button-save-artist">
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TracksTab() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQ, setSearchQ] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTrack, setEditingTrack] = useState<MusicTrack | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const [formTitle, setFormTitle] = useState("");
  const [formGenre, setFormGenre] = useState("");
  const [formAlbum, setFormAlbum] = useState("");
  const [formMoods, setFormMoods] = useState<string[]>([]);
  const [formEnergy, setFormEnergy] = useState<string>("");
  const [formBpmRange, setFormBpmRange] = useState("");
  const [formAudioUrl, setFormAudioUrl] = useState("");
  const [formCoverArtUrl, setFormCoverArtUrl] = useState("");
  const [formDuration, setFormDuration] = useState("");

  const [uploadArtistId, setUploadArtistId] = useState("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadAudioUrl, setUploadAudioUrl] = useState("");
  const [uploadGenre, setUploadGenre] = useState("");
  const [uploadMoods, setUploadMoods] = useState<string[]>([]);
  const [uploadEnergy, setUploadEnergy] = useState<string>("");

  const { data: tracks = [], isLoading } = useQuery<MusicTrack[]>({
    queryKey: ["/api/admin/music/tracks", statusFilter, searchQ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      if (searchQ) params.set("q", searchQ);
      const resp = await fetch(`/api/admin/music/tracks?${params}`, { credentials: "include" });
      return resp.json();
    },
  });

  const { data: allArtists = [] } = useQuery<MusicArtist[]>({
    queryKey: ["/api/admin/music/artists"],
    queryFn: async () => {
      const resp = await fetch("/api/admin/music/artists", { credentials: "include" });
      return resp.json();
    },
  });

  const artistMap = Object.fromEntries(allArtists.map(a => [a.id, a.name]));

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/admin/music/tracks/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/music/tracks"] });
      toast({ title: "Track status updated" });
    },
  });

  const featuredMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PATCH", `/api/admin/music/tracks/${id}/featured`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/music/tracks"] });
      toast({ title: "Featured toggled" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/music/tracks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/music/tracks"] });
      toast({ title: "Track deleted" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingTrack) return;
      await apiRequest("PATCH", `/api/admin/music/tracks/${editingTrack.id}`, {
        title: formTitle,
        genre: formGenre || null,
        albumName: formAlbum || null,
        mood: formMoods,
        energy: formEnergy || null,
        bpmRange: formBpmRange || null,
        audioUrl: formAudioUrl || null,
        coverArtUrl: formCoverArtUrl || null,
        durationSeconds: formDuration ? parseInt(formDuration) : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/music/tracks"] });
      toast({ title: "Track updated" });
      setEditDialogOpen(false);
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/music/tracks/submit", {
        artistId: uploadArtistId,
        title: uploadTitle,
        audioUrl: uploadAudioUrl || null,
        genre: uploadGenre || null,
        mood: uploadMoods,
        energy: uploadEnergy || null,
        licenseAgreedAt: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/music/tracks"] });
      toast({ title: "Track submitted" });
      setUploadDialogOpen(false);
    },
    onError: () => toast({ title: "Error submitting track", variant: "destructive" }),
  });

  const openEdit = (t: MusicTrack) => {
    setEditingTrack(t);
    setFormTitle(t.title);
    setFormGenre(t.genre || "");
    setFormAlbum(t.albumName || "");
    setFormMoods(t.mood || []);
    setFormEnergy(t.energy || "");
    setFormBpmRange(t.bpmRange || "");
    setFormAudioUrl(t.audioUrl || "");
    setFormCoverArtUrl(t.coverArtUrl || "");
    setFormDuration(t.durationSeconds?.toString() || "");
    setEditDialogOpen(true);
  };

  const togglePlay = (trackId: string, audioUrl: string | null) => {
    if (!audioUrl) return;
    if (playingId === trackId) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.play();
    audio.onended = () => setPlayingId(null);
    setPlayingId(trackId);
  };

  const toggleMood = (mood: string, setter: (fn: (prev: string[]) => string[]) => void) => {
    setter(prev => prev.includes(mood) ? prev.filter(m => m !== mood) : [...prev, mood]);
  };

  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">Loading tracks...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="Search tracks..."
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            data-testid="input-search-tracks"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px]" data-testid="select-track-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => { setUploadArtistId(""); setUploadTitle(""); setUploadAudioUrl(""); setUploadGenre(""); setUploadMoods([]); setUploadEnergy(""); setUploadDialogOpen(true); }} data-testid="button-upload-track">
          <Upload className="h-4 w-4 mr-1" /> New Track
        </Button>
      </div>

      <div className="border rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-3 w-10"></th>
              <th className="text-left p-3 font-medium">Title</th>
              <th className="text-left p-3 font-medium">Artist</th>
              <th className="text-left p-3 font-medium">Genre</th>
              <th className="text-center p-3 font-medium">Duration</th>
              <th className="text-center p-3 font-medium">Plays</th>
              <th className="text-center p-3 font-medium">Status</th>
              <th className="text-left p-3 font-medium">Mood</th>
              <th className="text-center p-3 font-medium">Energy</th>
              <th className="text-center p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tracks.map(t => (
              <tr key={t.id} className="border-b last:border-b-0" data-testid={`row-track-${t.id}`}>
                <td className="p-3">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => togglePlay(t.id, t.audioUrl)}
                    disabled={!t.audioUrl}
                    data-testid={`button-play-track-${t.id}`}
                  >
                    {playingId === t.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    {t.coverArtUrl && <img src={t.coverArtUrl} alt="" className="h-8 w-8 rounded-md object-cover shrink-0" />}
                    <div>
                      <span className="font-medium">{t.title}</span>
                      {t.albumName && <p className="text-[10px] text-muted-foreground">{t.albumName}</p>}
                    </div>
                  </div>
                </td>
                <td className="p-3 text-muted-foreground">{artistMap[t.artistId] || t.artistId}</td>
                <td className="p-3 text-muted-foreground">{t.genre || "-"}</td>
                <td className="p-3 text-center text-muted-foreground">{formatDuration(t.durationSeconds)}</td>
                <td className="p-3 text-center" data-testid={`text-play-count-${t.id}`}>{t.playCount}</td>
                <td className="p-3 text-center">
                  <Badge variant={STATUS_COLORS[t.status] || "secondary"} data-testid={`badge-track-status-${t.id}`}>{t.status}</Badge>
                </td>
                <td className="p-3">
                  <div className="flex gap-1 flex-wrap">
                    {(t.mood || []).map(m => <Badge key={m} variant="outline" className="text-[9px]">{m}</Badge>)}
                  </div>
                </td>
                <td className="p-3 text-center">
                  {t.energy && <Badge variant="outline" className="text-[9px]">{t.energy}</Badge>}
                </td>
                <td className="p-3">
                  <div className="flex items-center justify-center gap-1">
                    {t.status !== "approved" && (
                      <Button size="icon" variant="ghost" onClick={() => statusMutation.mutate({ id: t.id, status: "approved" })} data-testid={`button-approve-track-${t.id}`}>
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                    )}
                    {t.status !== "rejected" && (
                      <Button size="icon" variant="ghost" onClick={() => statusMutation.mutate({ id: t.id, status: "rejected" })} data-testid={`button-reject-track-${t.id}`}>
                        <X className="h-4 w-4 text-red-600" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => featuredMutation.mutate(t.id)} data-testid={`button-feature-track-${t.id}`}>
                      <Star className={`h-4 w-4 ${t.featured ? "text-yellow-500 fill-yellow-500" : ""}`} />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(t)} data-testid={`button-edit-track-${t.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(t.id)} data-testid={`button-delete-track-${t.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {tracks.length === 0 && (
              <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">No tracks found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Track</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={formTitle} onChange={e => setFormTitle(e.target.value)} data-testid="input-edit-track-title" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Genre</Label>
                <Input value={formGenre} onChange={e => setFormGenre(e.target.value)} data-testid="input-edit-track-genre" />
              </div>
              <div className="space-y-2">
                <Label>Album</Label>
                <Input value={formAlbum} onChange={e => setFormAlbum(e.target.value)} data-testid="input-edit-track-album" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Audio URL</Label>
              <Input value={formAudioUrl} onChange={e => setFormAudioUrl(e.target.value)} data-testid="input-edit-track-audio" />
            </div>
            <div className="space-y-2">
              <Label>Cover Art URL</Label>
              <Input value={formCoverArtUrl} onChange={e => setFormCoverArtUrl(e.target.value)} data-testid="input-edit-track-cover" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Duration (seconds)</Label>
                <Input value={formDuration} onChange={e => setFormDuration(e.target.value)} type="number" data-testid="input-edit-track-duration" />
              </div>
              <div className="space-y-2">
                <Label>BPM Range</Label>
                <Input value={formBpmRange} onChange={e => setFormBpmRange(e.target.value)} placeholder="80-100" data-testid="input-edit-track-bpm" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Mood Tags</Label>
              <div className="flex gap-1.5 flex-wrap">
                {MOOD_OPTIONS.map(m => (
                  <Badge
                    key={m}
                    variant={formMoods.includes(m) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleMood(m, setFormMoods)}
                    data-testid={`badge-mood-${m}`}
                  >
                    {m}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Energy Level</Label>
              <Select value={formEnergy} onValueChange={setFormEnergy}>
                <SelectTrigger data-testid="select-edit-track-energy"><SelectValue placeholder="Select energy" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} className="w-full" data-testid="button-save-track">
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload New Track</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Artist</Label>
              <Select value={uploadArtistId} onValueChange={setUploadArtistId}>
                <SelectTrigger data-testid="select-upload-artist"><SelectValue placeholder="Select artist" /></SelectTrigger>
                <SelectContent>
                  {allArtists.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} data-testid="input-upload-track-title" />
            </div>
            <div className="space-y-2">
              <Label>Audio URL</Label>
              <Input value={uploadAudioUrl} onChange={e => setUploadAudioUrl(e.target.value)} data-testid="input-upload-track-audio" />
            </div>
            <div className="space-y-2">
              <Label>Genre</Label>
              <Input value={uploadGenre} onChange={e => setUploadGenre(e.target.value)} data-testid="input-upload-track-genre" />
            </div>
            <div className="space-y-2">
              <Label>Mood Tags</Label>
              <div className="flex gap-1.5 flex-wrap">
                {MOOD_OPTIONS.map(m => (
                  <Badge
                    key={m}
                    variant={uploadMoods.includes(m) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleMood(m, setUploadMoods)}
                    data-testid={`badge-upload-mood-${m}`}
                  >
                    {m}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Energy Level</Label>
              <Select value={uploadEnergy} onValueChange={setUploadEnergy}>
                <SelectTrigger data-testid="select-upload-energy"><SelectValue placeholder="Select energy" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => uploadMutation.mutate()}
              disabled={uploadMutation.isPending || !uploadArtistId || !uploadTitle}
              className="w-full"
              data-testid="button-submit-upload-track"
            >
              {uploadMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              Submit Track
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MoodPresetsTab() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<MusicMoodPreset | null>(null);

  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formMoods, setFormMoods] = useState<string[]>([]);
  const [formGenres, setFormGenres] = useState<string[]>([]);
  const [formEnergyLevels, setFormEnergyLevels] = useState<string[]>([]);
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [formSortOrder, setFormSortOrder] = useState("0");

  const { data: presets = [], isLoading } = useQuery<MusicMoodPreset[]>({
    queryKey: ["/api/admin/music/mood-presets"],
  });

  const [previewCounts, setPreviewCounts] = useState<Record<string, number>>({});

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        name: formName,
        slug: formSlug,
        description: formDescription || null,
        moods: formMoods,
        genres: formGenres,
        energyLevels: formEnergyLevels,
        isDefault: formIsDefault,
        sortOrder: parseInt(formSortOrder) || 0,
      };
      if (editingPreset) {
        await apiRequest("PATCH", `/api/admin/music/mood-presets/${editingPreset.id}`, body);
      } else {
        await apiRequest("POST", "/api/admin/music/mood-presets", body);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/music/mood-presets"] });
      toast({ title: editingPreset ? "Preset updated" : "Preset created" });
      setDialogOpen(false);
    },
    onError: () => toast({ title: "Error saving preset", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/music/mood-presets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/music/mood-presets"] });
      toast({ title: "Preset deleted" });
    },
  });

  const openCreate = () => {
    setEditingPreset(null);
    setFormName(""); setFormSlug(""); setFormDescription("");
    setFormMoods([]); setFormGenres([]); setFormEnergyLevels([]);
    setFormIsDefault(false); setFormSortOrder("0");
    setDialogOpen(true);
  };

  const openEdit = (p: MusicMoodPreset) => {
    setEditingPreset(p);
    setFormName(p.name);
    setFormSlug(p.slug);
    setFormDescription(p.description || "");
    setFormMoods(p.moods || []);
    setFormGenres(p.genres || []);
    setFormEnergyLevels(p.energyLevels || []);
    setFormIsDefault(p.isDefault);
    setFormSortOrder(String(p.sortOrder));
    setDialogOpen(true);
  };

  const toggleItem = (item: string, list: string[], setter: (v: string[]) => void) => {
    setter(list.includes(item) ? list.filter(i => i !== item) : [...list, item]);
  };

  const previewTrackCount = useCallback(async (presetId: string) => {
    try {
      const resp = await fetch(`/api/admin/music/mood-presets`, { credentials: "include" });
      const allPresets = await resp.json();
      const preset = allPresets.find((p: any) => p.id === presetId);
      if (!preset) return;
      const params = new URLSearchParams();
      params.set("status", "approved");
      if (preset.moods?.length) preset.moods.forEach((m: string) => params.append("mood", m));
      if (preset.energyLevels?.length) preset.energyLevels.forEach((e: string) => params.append("energy", e));
      const tracksResp = await fetch(`/api/music/tracks?${params}`, { credentials: "include" });
      const tracks = await tracksResp.json();
      setPreviewCounts(prev => ({ ...prev, [presetId]: Array.isArray(tracks) ? tracks.length : 0 }));
    } catch {
      setPreviewCounts(prev => ({ ...prev, [presetId]: 0 }));
    }
  }, []);

  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">Loading presets...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold" data-testid="text-presets-title">Mood Presets</h3>
        <Button onClick={openCreate} data-testid="button-create-preset">
          <Plus className="h-4 w-4 mr-1" /> New Preset
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {presets.map(p => (
          <Card key={p.id} className="p-4 space-y-3" data-testid={`card-preset-${p.id}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{p.name}</p>
                {p.description && <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {p.isDefault && <Badge variant="default" className="text-[9px]">Default</Badge>}
                <Button size="icon" variant="ghost" onClick={() => openEdit(p)} data-testid={`button-edit-preset-${p.id}`}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(p.id)} data-testid={`button-delete-preset-${p.id}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[10px] text-muted-foreground w-14 shrink-0">Moods:</span>
                {(p.moods || []).map(m => <Badge key={m} variant="outline" className="text-[9px]">{m}</Badge>)}
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[10px] text-muted-foreground w-14 shrink-0">Genres:</span>
                {(p.genres || []).map(g => <Badge key={g} variant="outline" className="text-[9px]">{g}</Badge>)}
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[10px] text-muted-foreground w-14 shrink-0">Energy:</span>
                {(p.energyLevels || []).map(e => <Badge key={e} variant="outline" className="text-[9px]">{e}</Badge>)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => previewTrackCount(p.id)}
                data-testid={`button-preview-preset-${p.id}`}
              >
                <Eye className="h-3 w-3 mr-1" /> Preview Match
              </Button>
              {previewCounts[p.id] !== undefined && (
                <span className="text-xs text-muted-foreground" data-testid={`text-preset-match-${p.id}`}>
                  {previewCounts[p.id]} tracks match
                </span>
              )}
            </div>
          </Card>
        ))}
        {presets.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-2 text-center py-6">No mood presets configured</p>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPreset ? "Edit Preset" : "Create Preset"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={formName} onChange={e => { setFormName(e.target.value); if (!editingPreset) setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-")); }} data-testid="input-preset-name" />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input value={formSlug} onChange={e => setFormSlug(e.target.value)} data-testid="input-preset-slug" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} rows={2} className="resize-none" data-testid="input-preset-description" />
            </div>
            <div className="space-y-2">
              <Label>Moods</Label>
              <div className="flex gap-1.5 flex-wrap">
                {MOOD_OPTIONS.map(m => (
                  <Badge
                    key={m}
                    variant={formMoods.includes(m) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleItem(m, formMoods, setFormMoods)}
                    data-testid={`badge-preset-mood-${m}`}
                  >
                    {m}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Genres</Label>
              <div className="flex gap-1.5 flex-wrap">
                {GENRE_OPTIONS.map(g => (
                  <Badge
                    key={g}
                    variant={formGenres.includes(g) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleItem(g, formGenres, setFormGenres)}
                    data-testid={`badge-preset-genre-${g}`}
                  >
                    {g}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Energy Levels</Label>
              <div className="flex gap-1.5 flex-wrap">
                {ENERGY_OPTIONS.map(e => (
                  <Badge
                    key={e}
                    variant={formEnergyLevels.includes(e) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleItem(e, formEnergyLevels, setFormEnergyLevels)}
                    data-testid={`badge-preset-energy-${e}`}
                  >
                    {e}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch checked={formIsDefault} onCheckedChange={setFormIsDefault} data-testid="switch-preset-default" />
                <Label>Default preset</Label>
              </div>
              <div className="space-y-2 flex-1">
                <Label>Sort Order</Label>
                <Input value={formSortOrder} onChange={e => setFormSortOrder(e.target.value)} type="number" data-testid="input-preset-sort-order" />
              </div>
            </div>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full" data-testid="button-save-preset">
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              {editingPreset ? "Save Changes" : "Create Preset"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VenueProfilesTab() {
  const { toast } = useToast();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<VenueProfileWithMeta | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPresetId, setBulkPresetId] = useState("");

  const [formPresetId, setFormPresetId] = useState<string>("");
  const [formCustomMoods, setFormCustomMoods] = useState<string[]>([]);
  const [formCustomGenres, setFormCustomGenres] = useState<string[]>([]);
  const [formExcludedGenres, setFormExcludedGenres] = useState<string[]>([]);
  const [formExcludedArtistIds, setFormExcludedArtistIds] = useState("");
  const [formVolumeLevel, setFormVolumeLevel] = useState<string>("medium");
  const [formMusicEnabled, setFormMusicEnabled] = useState(true);
  const [formTalkEnabled, setFormTalkEnabled] = useState(true);
  const [formAdEnabled, setFormAdEnabled] = useState(true);
  const [formMusicMix, setFormMusicMix] = useState(70);
  const [formScreenId, setFormScreenId] = useState("");

  const { data: profiles = [], isLoading } = useQuery<VenueProfileWithMeta[]>({
    queryKey: ["/api/admin/music/venue-profiles"],
  });

  const { data: presets = [] } = useQuery<MusicMoodPreset[]>({
    queryKey: ["/api/admin/music/mood-presets"],
  });

  const presetMap = Object.fromEntries(presets.map(p => [p.id, p.name]));

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingProfile) return;
      await apiRequest("PATCH", `/api/admin/music/venue-profiles/${editingProfile.id}`, {
        presetId: formPresetId || null,
        customMoods: formCustomMoods,
        customGenres: formCustomGenres,
        excludedGenres: formExcludedGenres,
        excludedArtistIds: formExcludedArtistIds ? formExcludedArtistIds.split(",").map(s => s.trim()).filter(Boolean) : [],
        volumeLevel: formVolumeLevel,
        musicEnabled: formMusicEnabled,
        talkSegmentsEnabled: formTalkEnabled,
        adSegmentsEnabled: formAdEnabled,
        musicMixPercent: formMusicMix,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/music/venue-profiles"] });
      toast({ title: "Profile updated" });
      setEditDialogOpen(false);
    },
    onError: () => toast({ title: "Error updating profile", variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/music/venue-profiles", {
        screenId: formScreenId,
        presetId: formPresetId || null,
        customMoods: formCustomMoods,
        customGenres: formCustomGenres,
        excludedGenres: formExcludedGenres,
        volumeLevel: formVolumeLevel,
        musicEnabled: formMusicEnabled,
        talkSegmentsEnabled: formTalkEnabled,
        adSegmentsEnabled: formAdEnabled,
        musicMixPercent: formMusicMix,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/music/venue-profiles"] });
      toast({ title: "Profile created" });
      setCreateDialogOpen(false);
    },
    onError: () => toast({ title: "Error creating profile", variant: "destructive" }),
  });

  const bulkAssignMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(Array.from(selectedIds).map(id =>
        apiRequest("PATCH", `/api/admin/music/venue-profiles/${id}`, { presetId: bulkPresetId || null })
      ));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/music/venue-profiles"] });
      setSelectedIds(new Set());
      toast({ title: "Preset assigned to venues" });
    },
  });

  const openEdit = (p: VenueProfileWithMeta) => {
    setEditingProfile(p);
    setFormPresetId(p.presetId || "");
    setFormCustomMoods(p.customMoods || []);
    setFormCustomGenres(p.customGenres || []);
    setFormExcludedGenres(p.excludedGenres || []);
    setFormExcludedArtistIds((p.excludedArtistIds || []).join(", "));
    setFormVolumeLevel(p.volumeLevel || "medium");
    setFormMusicEnabled(p.musicEnabled);
    setFormTalkEnabled(p.talkSegmentsEnabled);
    setFormAdEnabled(p.adSegmentsEnabled);
    setFormMusicMix(p.musicMixPercent);
    setEditDialogOpen(true);
  };

  const openCreate = () => {
    setFormScreenId(""); setFormPresetId(""); setFormCustomMoods([]); setFormCustomGenres([]);
    setFormExcludedGenres([]); setFormExcludedArtistIds(""); setFormVolumeLevel("medium");
    setFormMusicEnabled(true); setFormTalkEnabled(true); setFormAdEnabled(true); setFormMusicMix(70);
    setCreateDialogOpen(true);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleItem = (item: string, list: string[], setter: (v: string[]) => void) => {
    setter(list.includes(item) ? list.filter(i => i !== item) : [...list, item]);
  };

  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">Loading venue profiles...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold" data-testid="text-venue-profiles-title">Venue Audio Profiles</h3>
        <div className="flex items-center gap-2 flex-wrap">
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <Select value={bulkPresetId} onValueChange={setBulkPresetId}>
                <SelectTrigger className="w-[160px]" data-testid="select-bulk-preset">
                  <SelectValue placeholder="Assign preset..." />
                </SelectTrigger>
                <SelectContent>
                  {presets.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button
                onClick={() => bulkAssignMutation.mutate()}
                disabled={!bulkPresetId || bulkAssignMutation.isPending}
                data-testid="button-bulk-assign-preset"
              >
                Assign ({selectedIds.size})
              </Button>
            </div>
          )}
          <Button onClick={openCreate} data-testid="button-create-venue-profile">
            <Plus className="h-4 w-4 mr-1" /> New Profile
          </Button>
        </div>
      </div>

      <div className="border rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-3 w-8">
                <Checkbox
                  checked={selectedIds.size === profiles.length && profiles.length > 0}
                  onCheckedChange={() => {
                    if (selectedIds.size === profiles.length) setSelectedIds(new Set());
                    else setSelectedIds(new Set(profiles.map(p => p.id)));
                  }}
                  data-testid="checkbox-select-all-profiles"
                />
              </th>
              <th className="text-left p-3 font-medium">Venue</th>
              <th className="text-left p-3 font-medium">Hub</th>
              <th className="text-left p-3 font-medium">Preset</th>
              <th className="text-center p-3 font-medium">Music</th>
              <th className="text-center p-3 font-medium">Talk</th>
              <th className="text-center p-3 font-medium">Ads</th>
              <th className="text-center p-3 font-medium">Mix %</th>
              <th className="text-center p-3 font-medium">Volume</th>
              <th className="text-center p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map(p => (
              <tr key={p.id} className="border-b last:border-b-0" data-testid={`row-venue-profile-${p.id}`}>
                <td className="p-3">
                  <Checkbox checked={selectedIds.has(p.id)} onCheckedChange={() => toggleSelect(p.id)} data-testid={`checkbox-profile-${p.id}`} />
                </td>
                <td className="p-3 font-medium">{p.venueName || p.screenId}</td>
                <td className="p-3 text-muted-foreground">{p.hubSlug || "-"}</td>
                <td className="p-3">
                  {p.presetId ? (
                    <Badge variant="outline">{presetMap[p.presetId] || "Custom"}</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">Custom</span>
                  )}
                </td>
                <td className="p-3 text-center">
                  {p.musicEnabled ? <Check className="h-4 w-4 text-green-600 mx-auto" /> : <X className="h-4 w-4 text-red-500 mx-auto" />}
                </td>
                <td className="p-3 text-center">
                  {p.talkSegmentsEnabled ? <Check className="h-4 w-4 text-green-600 mx-auto" /> : <X className="h-4 w-4 text-red-500 mx-auto" />}
                </td>
                <td className="p-3 text-center">
                  {p.adSegmentsEnabled ? <Check className="h-4 w-4 text-green-600 mx-auto" /> : <X className="h-4 w-4 text-red-500 mx-auto" />}
                </td>
                <td className="p-3 text-center" data-testid={`text-mix-percent-${p.id}`}>{p.musicMixPercent}%</td>
                <td className="p-3 text-center">
                  <Badge variant="outline" className="text-[9px]">{p.volumeLevel}</Badge>
                </td>
                <td className="p-3">
                  <div className="flex items-center justify-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(p)} data-testid={`button-edit-profile-${p.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {profiles.length === 0 && (
              <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">No venue audio profiles configured</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Venue Audio Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Preset</Label>
              <Select value={formPresetId} onValueChange={setFormPresetId}>
                <SelectTrigger data-testid="select-profile-preset"><SelectValue placeholder="Select preset (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No preset (custom)</SelectItem>
                  {presets.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Custom Moods Override</Label>
              <div className="flex gap-1.5 flex-wrap">
                {MOOD_OPTIONS.map(m => (
                  <Badge key={m} variant={formCustomMoods.includes(m) ? "default" : "outline"} className="cursor-pointer" onClick={() => toggleItem(m, formCustomMoods, setFormCustomMoods)} data-testid={`badge-profile-mood-${m}`}>
                    {m}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Custom Genres Override</Label>
              <div className="flex gap-1.5 flex-wrap">
                {GENRE_OPTIONS.map(g => (
                  <Badge key={g} variant={formCustomGenres.includes(g) ? "default" : "outline"} className="cursor-pointer" onClick={() => toggleItem(g, formCustomGenres, setFormCustomGenres)} data-testid={`badge-profile-genre-${g}`}>
                    {g}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Excluded Genres</Label>
              <div className="flex gap-1.5 flex-wrap">
                {GENRE_OPTIONS.map(g => (
                  <Badge key={g} variant={formExcludedGenres.includes(g) ? "destructive" : "outline"} className="cursor-pointer" onClick={() => toggleItem(g, formExcludedGenres, setFormExcludedGenres)} data-testid={`badge-profile-excluded-genre-${g}`}>
                    {g}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Excluded Artist IDs (comma-separated)</Label>
              <Input value={formExcludedArtistIds} onChange={e => setFormExcludedArtistIds(e.target.value)} data-testid="input-excluded-artist-ids" />
            </div>
            <div className="space-y-2">
              <Label>Volume Level</Label>
              <Select value={formVolumeLevel} onValueChange={setFormVolumeLevel}>
                <SelectTrigger data-testid="select-profile-volume"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Switch checked={formMusicEnabled} onCheckedChange={setFormMusicEnabled} data-testid="switch-music-enabled" />
                <Label className="text-xs">Music</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={formTalkEnabled} onCheckedChange={setFormTalkEnabled} data-testid="switch-talk-enabled" />
                <Label className="text-xs">Talk</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={formAdEnabled} onCheckedChange={setFormAdEnabled} data-testid="switch-ads-enabled" />
                <Label className="text-xs">Ads</Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Music Mix: {formMusicMix}%</Label>
              <Slider
                value={[formMusicMix]}
                onValueChange={([v]) => setFormMusicMix(v)}
                min={0}
                max={100}
                step={5}
                data-testid="slider-music-mix"
              />
              <p className="text-[10px] text-muted-foreground">Music vs talk/ads ratio</p>
            </div>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} className="w-full" data-testid="button-save-profile">
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Venue Audio Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Screen ID</Label>
              <Input value={formScreenId} onChange={e => setFormScreenId(e.target.value)} placeholder="Enter TV screen ID" data-testid="input-create-screen-id" />
            </div>
            <div className="space-y-2">
              <Label>Preset</Label>
              <Select value={formPresetId} onValueChange={setFormPresetId}>
                <SelectTrigger data-testid="select-create-profile-preset"><SelectValue placeholder="Select preset" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No preset (custom)</SelectItem>
                  {presets.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !formScreenId} className="w-full" data-testid="button-submit-create-profile">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              Create Profile
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SubmissionsTab() {
  const { toast } = useToast();

  const { data: pendingArtists = [] } = useQuery<MusicArtist[]>({
    queryKey: ["/api/admin/music/artists", "pending"],
    queryFn: async () => {
      const resp = await fetch("/api/admin/music/artists?status=pending", { credentials: "include" });
      return resp.json();
    },
  });

  const { data: pendingTracks = [] } = useQuery<MusicTrack[]>({
    queryKey: ["/api/admin/music/tracks", "pending"],
    queryFn: async () => {
      const resp = await fetch("/api/admin/music/tracks?status=pending", { credentials: "include" });
      return resp.json();
    },
  });

  const { data: allArtists = [] } = useQuery<MusicArtist[]>({
    queryKey: ["/api/admin/music/artists"],
    queryFn: async () => {
      const resp = await fetch("/api/admin/music/artists", { credentials: "include" });
      return resp.json();
    },
  });

  const artistMap = Object.fromEntries(allArtists.map(a => [a.id, a.name]));

  const artistStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/admin/music/artists/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/music/artists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/music/tracks"] });
      toast({ title: "Status updated" });
    },
  });

  const trackStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/admin/music/tracks/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/music/tracks"] });
      toast({ title: "Status updated" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h3 className="font-semibold flex items-center gap-2" data-testid="text-pending-artists-title">
          <Users className="h-4 w-4" /> Pending Artists ({pendingArtists.length})
        </h3>
        {pendingArtists.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending artist submissions</p>
        ) : (
          <div className="space-y-2">
            {pendingArtists.map(a => (
              <Card key={a.id} className="p-3" data-testid={`card-pending-artist-${a.id}`}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    {a.imageUrl && <img src={a.imageUrl} alt="" className="h-10 w-10 rounded-md object-cover shrink-0" />}
                    <div className="min-w-0">
                      <p className="font-medium truncate">{a.name}</p>
                      <p className="text-xs text-muted-foreground">{a.genre || "No genre"} &middot; {a.submittedByEmail || "No email"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => artistStatusMutation.mutate({ id: a.id, status: "approved" })}
                      disabled={artistStatusMutation.isPending}
                      data-testid={`button-quick-approve-artist-${a.id}`}
                    >
                      <Check className="h-3 w-3 mr-1" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => artistStatusMutation.mutate({ id: a.id, status: "rejected" })}
                      disabled={artistStatusMutation.isPending}
                      data-testid={`button-quick-reject-artist-${a.id}`}
                    >
                      <X className="h-3 w-3 mr-1" /> Reject
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold flex items-center gap-2" data-testid="text-pending-tracks-title">
          <Music className="h-4 w-4" /> Pending Tracks ({pendingTracks.length})
        </h3>
        {pendingTracks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending track submissions</p>
        ) : (
          <div className="space-y-2">
            {pendingTracks.map(t => (
              <Card key={t.id} className="p-3" data-testid={`card-pending-track-${t.id}`}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    {t.coverArtUrl && <img src={t.coverArtUrl} alt="" className="h-10 w-10 rounded-md object-cover shrink-0" />}
                    <div className="min-w-0">
                      <p className="font-medium truncate">{t.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {artistMap[t.artistId] || "Unknown Artist"} &middot; {t.genre || "No genre"} &middot; {formatDuration(t.durationSeconds)}
                      </p>
                      {t.mood && t.mood.length > 0 && (
                        <div className="flex gap-1 mt-1">{t.mood.map(m => <Badge key={m} variant="outline" className="text-[9px]">{m}</Badge>)}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => trackStatusMutation.mutate({ id: t.id, status: "approved" })}
                      disabled={trackStatusMutation.isPending}
                      data-testid={`button-quick-approve-track-${t.id}`}
                    >
                      <Check className="h-3 w-3 mr-1" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => trackStatusMutation.mutate({ id: t.id, status: "rejected" })}
                      disabled={trackStatusMutation.isPending}
                      data-testid={`button-quick-reject-track-${t.id}`}
                    >
                      <X className="h-3 w-3 mr-1" /> Reject
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MusicLibraryPanel({ cityId }: { cityId?: string }) {
  const { data: artists = [] } = useQuery<MusicArtist[]>({
    queryKey: ["/api/admin/music/artists"],
    queryFn: async () => {
      const resp = await fetch("/api/admin/music/artists", { credentials: "include" });
      return resp.json();
    },
  });

  const { data: tracks = [] } = useQuery<MusicTrack[]>({
    queryKey: ["/api/admin/music/tracks"],
    queryFn: async () => {
      const resp = await fetch("/api/admin/music/tracks", { credentials: "include" });
      return resp.json();
    },
  });

  const { data: presets = [] } = useQuery<MusicMoodPreset[]>({
    queryKey: ["/api/admin/music/mood-presets"],
  });

  const { data: venueProfiles = [] } = useQuery<VenueProfileWithMeta[]>({
    queryKey: ["/api/admin/music/venue-profiles"],
  });

  return (
    <div className="p-4 space-y-6 max-w-7xl mx-auto" data-testid="music-library-panel">
      <div>
        <h2 className="text-xl font-bold" data-testid="text-music-library-title">Music Library</h2>
        <p className="text-sm text-muted-foreground">Manage artists, tracks, mood presets, and venue audio profiles</p>
      </div>

      <StatsBar artists={artists} tracks={tracks} presets={presets} venueProfiles={venueProfiles} />

      <Tabs defaultValue="artists">
        <TabsList data-testid="tabs-music-library">
          <TabsTrigger value="artists" data-testid="tab-artists">Artists</TabsTrigger>
          <TabsTrigger value="tracks" data-testid="tab-tracks">Tracks</TabsTrigger>
          <TabsTrigger value="presets" data-testid="tab-presets">Mood Presets</TabsTrigger>
          <TabsTrigger value="venues" data-testid="tab-venues">Venue Profiles</TabsTrigger>
          <TabsTrigger value="submissions" data-testid="tab-submissions">Submissions</TabsTrigger>
        </TabsList>
        <TabsContent value="artists">
          <ArtistsTab />
        </TabsContent>
        <TabsContent value="tracks">
          <TracksTab />
        </TabsContent>
        <TabsContent value="presets">
          <MoodPresetsTab />
        </TabsContent>
        <TabsContent value="venues">
          <VenueProfilesTab />
        </TabsContent>
        <TabsContent value="submissions">
          <SubmissionsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
