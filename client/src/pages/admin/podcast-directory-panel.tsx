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
  Plus, Pencil, Trash2, Loader2, Check, X, Star, Rss,
  Headphones, ExternalLink, Play, Clock, Hash
} from "lucide-react";
import { useState } from "react";
import type { LocalPodcast, LocalPodcastEpisode } from "@shared/schema";

type PodcastWithCount = LocalPodcast & { episodeCount: number };

function formatDuration(seconds: number | null): string {
  if (!seconds) return "-";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function StatusBadge({ status }: { status: string }) {
  const variant = status === "approved" ? "default" : status === "rejected" ? "destructive" : "secondary";
  return <Badge variant={variant} data-testid={`badge-status-${status}`}>{status}</Badge>;
}

function PodcastsTab() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [editDialog, setEditDialog] = useState(false);
  const [editing, setEditing] = useState<PodcastWithCount | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editRssUrl, setEditRssUrl] = useState("");
  const [editWebsiteUrl, setEditWebsiteUrl] = useState("");
  const [editApplePodcastUrl, setEditApplePodcastUrl] = useState("");
  const [editSpotifyUrl, setEditSpotifyUrl] = useState("");
  const [editHostName, setEditHostName] = useState("");
  const [editHostEmail, setEditHostEmail] = useState("");
  const [editCategory, setEditCategory] = useState("");

  const { data: podcasts, isLoading } = useQuery<PodcastWithCount[]>({
    queryKey: ["/api/admin/podcasts", statusFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search) params.set("q", search);
      const res = await fetch(`/api/admin/podcasts?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest("PATCH", `/api/admin/podcasts/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/podcasts"] });
      toast({ title: "Status updated" });
    },
    onError: () => toast({ title: "Error updating status", variant: "destructive" }),
  });

  const featuredMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/admin/podcasts/${id}/featured`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/podcasts"] });
      toast({ title: "Featured toggled" });
    },
    onError: () => toast({ title: "Error toggling featured", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/podcasts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/podcasts"] });
      toast({ title: "Podcast deleted" });
    },
    onError: () => toast({ title: "Error deleting podcast", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      return apiRequest("PATCH", `/api/admin/podcasts/${editing.id}`, {
        name: editName,
        description: editDescription || null,
        imageUrl: editImageUrl || null,
        rssUrl: editRssUrl || null,
        websiteUrl: editWebsiteUrl || null,
        applePodcastUrl: editApplePodcastUrl || null,
        spotifyUrl: editSpotifyUrl || null,
        hostName: editHostName || null,
        hostEmail: editHostEmail || null,
        category: editCategory || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/podcasts"] });
      toast({ title: "Podcast updated" });
      setEditDialog(false);
    },
    onError: () => toast({ title: "Error updating podcast", variant: "destructive" }),
  });

  const rssImportMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/admin/podcasts/${id}/import-rss`, {});
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/podcasts"] });
      toast({ title: `Imported ${data?.imported || 0} episodes` });
    },
    onError: () => toast({ title: "Error importing RSS", variant: "destructive" }),
  });

  const openEdit = (p: PodcastWithCount) => {
    setEditing(p);
    setEditName(p.name);
    setEditDescription(p.description || "");
    setEditImageUrl(p.imageUrl || "");
    setEditRssUrl(p.rssUrl || "");
    setEditWebsiteUrl(p.websiteUrl || "");
    setEditApplePodcastUrl(p.applePodcastUrl || "");
    setEditSpotifyUrl(p.spotifyUrl || "");
    setEditHostName(p.hostName || "");
    setEditHostEmail(p.hostEmail || "");
    setEditCategory(p.category || "");
    setEditDialog(true);
  };

  if (isLoading) return <div className="text-sm text-muted-foreground p-4" data-testid="text-loading">Loading podcasts...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold" data-testid="text-podcasts-title">All Podcasts</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48"
            data-testid="input-podcast-search"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36" data-testid="select-status-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Podcast</th>
              <th className="text-left p-3 font-medium">Host</th>
              <th className="text-left p-3 font-medium">Category</th>
              <th className="text-center p-3 font-medium">Episodes</th>
              <th className="text-center p-3 font-medium">Status</th>
              <th className="text-center p-3 font-medium">Featured</th>
              <th className="text-center p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(podcasts || []).map((p) => (
              <tr key={p.id} className="border-b last:border-b-0" data-testid={`row-podcast-${p.id}`}>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt="" className="h-8 w-8 rounded-md object-cover" />
                    ) : (
                      <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center">
                        <Headphones className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <span className="font-medium">{p.name}</span>
                  </div>
                </td>
                <td className="p-3 text-muted-foreground">{p.hostName || "-"}</td>
                <td className="p-3 text-muted-foreground">{p.category || "-"}</td>
                <td className="p-3 text-center">{p.episodeCount}</td>
                <td className="p-3 text-center"><StatusBadge status={p.status} /></td>
                <td className="p-3 text-center">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => featuredMutation.mutate(p.id)}
                    data-testid={`button-featured-${p.id}`}
                  >
                    <Star className={`h-4 w-4 ${p.featured ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                  </Button>
                </td>
                <td className="p-3">
                  <div className="flex items-center justify-center gap-1">
                    {p.status === "pending" && (
                      <>
                        <Button size="icon" variant="ghost" onClick={() => statusMutation.mutate({ id: p.id, status: "approved" })} data-testid={`button-approve-${p.id}`}>
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => statusMutation.mutate({ id: p.id, status: "rejected" })} data-testid={`button-reject-${p.id}`}>
                          <X className="h-4 w-4 text-red-600" />
                        </Button>
                      </>
                    )}
                    {p.rssUrl && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => rssImportMutation.mutate(p.id)}
                        disabled={rssImportMutation.isPending}
                        data-testid={`button-rss-import-${p.id}`}
                      >
                        <Rss className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => openEdit(p)} data-testid={`button-edit-${p.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(p.id)} data-testid={`button-delete-${p.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {(podcasts || []).length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No podcasts found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Podcast</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} data-testid="input-edit-name" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} className="resize-none" data-testid="input-edit-description" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Host Name</Label>
                <Input value={editHostName} onChange={(e) => setEditHostName(e.target.value)} data-testid="input-edit-host" />
              </div>
              <div className="space-y-2">
                <Label>Host Email</Label>
                <Input value={editHostEmail} onChange={(e) => setEditHostEmail(e.target.value)} data-testid="input-edit-host-email" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Input value={editCategory} onChange={(e) => setEditCategory(e.target.value)} data-testid="input-edit-category" />
            </div>
            <div className="space-y-2">
              <Label>Image URL</Label>
              <Input value={editImageUrl} onChange={(e) => setEditImageUrl(e.target.value)} data-testid="input-edit-image" />
            </div>
            <div className="space-y-2">
              <Label>RSS URL</Label>
              <Input value={editRssUrl} onChange={(e) => setEditRssUrl(e.target.value)} data-testid="input-edit-rss" />
            </div>
            <div className="space-y-2">
              <Label>Website URL</Label>
              <Input value={editWebsiteUrl} onChange={(e) => setEditWebsiteUrl(e.target.value)} data-testid="input-edit-website" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Apple Podcasts URL</Label>
                <Input value={editApplePodcastUrl} onChange={(e) => setEditApplePodcastUrl(e.target.value)} data-testid="input-edit-apple" />
              </div>
              <div className="space-y-2">
                <Label>Spotify URL</Label>
                <Input value={editSpotifyUrl} onChange={(e) => setEditSpotifyUrl(e.target.value)} data-testid="input-edit-spotify" />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditDialog(false)} data-testid="button-cancel-edit">Cancel</Button>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} data-testid="button-save-edit">
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EpisodesTab() {
  const { toast } = useToast();
  const [selectedPodcastId, setSelectedPodcastId] = useState<string>("");
  const [addDialog, setAddDialog] = useState(false);
  const [epTitle, setEpTitle] = useState("");
  const [epDescription, setEpDescription] = useState("");
  const [epAudioUrl, setEpAudioUrl] = useState("");
  const [epExternalUrl, setEpExternalUrl] = useState("");
  const [epDuration, setEpDuration] = useState("");
  const [epNumber, setEpNumber] = useState("");
  const [epSeason, setEpSeason] = useState("");
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);

  const { data: podcasts } = useQuery<PodcastWithCount[]>({
    queryKey: ["/api/admin/podcasts"],
  });

  const { data: episodes, isLoading: episodesLoading } = useQuery<{ episodes: LocalPodcastEpisode[]; podcastId: string; podcastName: string }>({
    queryKey: ["/api/podcasts", selectedPodcastId, "episodes"],
    queryFn: async () => {
      if (!selectedPodcastId) return { episodes: [], podcastId: "", podcastName: "" };
      const podcast = podcasts?.find(p => p.id === selectedPodcastId);
      if (!podcast) return { episodes: [], podcastId: "", podcastName: "" };
      const res = await fetch(`/api/podcasts/${podcast.slug}/episodes?limit=100`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!selectedPodcastId,
  });

  const addEpisodeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/admin/podcasts/${selectedPodcastId}/episodes`, {
        title: epTitle,
        description: epDescription || null,
        audioUrl: epAudioUrl || null,
        externalUrl: epExternalUrl || null,
        durationSeconds: epDuration ? parseInt(epDuration) : null,
        episodeNumber: epNumber ? parseInt(epNumber) : null,
        seasonNumber: epSeason ? parseInt(epSeason) : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/podcasts", selectedPodcastId, "episodes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/podcasts"] });
      toast({ title: "Episode added" });
      setAddDialog(false);
      setEpTitle("");
      setEpDescription("");
      setEpAudioUrl("");
      setEpExternalUrl("");
      setEpDuration("");
      setEpNumber("");
      setEpSeason("");
    },
    onError: () => toast({ title: "Error adding episode", variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold" data-testid="text-episodes-title">Episodes</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selectedPodcastId} onValueChange={setSelectedPodcastId}>
            <SelectTrigger className="w-64" data-testid="select-podcast-filter">
              <SelectValue placeholder="Select a podcast..." />
            </SelectTrigger>
            <SelectContent>
              {(podcasts || []).map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedPodcastId && (
            <Button onClick={() => setAddDialog(true)} data-testid="button-add-episode">
              <Plus className="h-4 w-4 mr-1" /> Add Episode
            </Button>
          )}
        </div>
      </div>

      {!selectedPodcastId && (
        <Card className="p-8 text-center text-muted-foreground" data-testid="text-select-prompt">
          <Headphones className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Select a podcast to view its episodes</p>
        </Card>
      )}

      {selectedPodcastId && episodesLoading && (
        <div className="text-sm text-muted-foreground p-4">Loading episodes...</div>
      )}

      {selectedPodcastId && !episodesLoading && (
        <div className="border rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Ep #</th>
                <th className="text-left p-3 font-medium">Title</th>
                <th className="text-center p-3 font-medium">Duration</th>
                <th className="text-left p-3 font-medium">Published</th>
                <th className="text-center p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(episodes?.episodes || []).map((ep) => (
                <tr key={ep.id} className="border-b last:border-b-0" data-testid={`row-episode-${ep.id}`}>
                  <td className="p-3 text-muted-foreground">
                    {ep.seasonNumber && ep.episodeNumber
                      ? `S${ep.seasonNumber}E${ep.episodeNumber}`
                      : ep.episodeNumber
                        ? `#${ep.episodeNumber}`
                        : "-"}
                  </td>
                  <td className="p-3 font-medium">{ep.title}</td>
                  <td className="p-3 text-center text-muted-foreground">{formatDuration(ep.durationSeconds)}</td>
                  <td className="p-3 text-muted-foreground">
                    {ep.publishedAt ? new Date(ep.publishedAt).toLocaleDateString() : "-"}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-1">
                      {ep.audioUrl && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setPlayingUrl(playingUrl === ep.audioUrl ? null : ep.audioUrl)}
                          data-testid={`button-play-${ep.id}`}
                        >
                          <Play className={`h-4 w-4 ${playingUrl === ep.audioUrl ? "text-green-600" : ""}`} />
                        </Button>
                      )}
                      {ep.externalUrl && (
                        <Button size="icon" variant="ghost" onClick={() => window.open(ep.externalUrl!, "_blank")} data-testid={`button-external-${ep.id}`}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {(episodes?.episodes || []).length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No episodes found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {playingUrl && (
        <Card className="p-3">
          <audio controls autoPlay src={playingUrl} className="w-full" data-testid="audio-player" />
        </Card>
      )}

      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Episode</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={epTitle} onChange={(e) => setEpTitle(e.target.value)} data-testid="input-ep-title" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={epDescription} onChange={(e) => setEpDescription(e.target.value)} rows={3} className="resize-none" data-testid="input-ep-description" />
            </div>
            <div className="space-y-2">
              <Label>Audio URL</Label>
              <Input value={epAudioUrl} onChange={(e) => setEpAudioUrl(e.target.value)} data-testid="input-ep-audio" />
            </div>
            <div className="space-y-2">
              <Label>External URL</Label>
              <Input value={epExternalUrl} onChange={(e) => setEpExternalUrl(e.target.value)} data-testid="input-ep-external" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Duration (sec)</Label>
                <Input value={epDuration} onChange={(e) => setEpDuration(e.target.value)} type="number" data-testid="input-ep-duration" />
              </div>
              <div className="space-y-2">
                <Label>Episode #</Label>
                <Input value={epNumber} onChange={(e) => setEpNumber(e.target.value)} type="number" data-testid="input-ep-number" />
              </div>
              <div className="space-y-2">
                <Label>Season #</Label>
                <Input value={epSeason} onChange={(e) => setEpSeason(e.target.value)} type="number" data-testid="input-ep-season" />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setAddDialog(false)} data-testid="button-cancel-episode">Cancel</Button>
            <Button onClick={() => addEpisodeMutation.mutate()} disabled={addEpisodeMutation.isPending || !epTitle} data-testid="button-save-episode">
              {addEpisodeMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Add Episode
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SubmissionsTab() {
  const { toast } = useToast();

  const { data: pending, isLoading } = useQuery<PodcastWithCount[]>({
    queryKey: ["/api/admin/podcasts", "pending"],
    queryFn: async () => {
      const res = await fetch("/api/admin/podcasts?status=pending");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest("PATCH", `/api/admin/podcasts/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/podcasts"] });
      toast({ title: "Status updated" });
    },
    onError: () => toast({ title: "Error updating status", variant: "destructive" }),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground p-4">Loading submissions...</div>;

  return (
    <div className="space-y-4">
      <h3 className="font-semibold" data-testid="text-submissions-title">Pending Submissions</h3>

      {(pending || []).length === 0 && (
        <Card className="p-8 text-center text-muted-foreground" data-testid="text-no-submissions">
          <Check className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No pending submissions</p>
        </Card>
      )}

      <div className="space-y-3">
        {(pending || []).map((p) => (
          <Card key={p.id} className="p-4" data-testid={`card-submission-${p.id}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt="" className="h-12 w-12 rounded-md object-cover flex-shrink-0" />
                ) : (
                  <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                    <Headphones className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-medium truncate" data-testid={`text-submission-name-${p.id}`}>{p.name}</p>
                  <p className="text-sm text-muted-foreground">Host: {p.hostName || "Unknown"}</p>
                  {p.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {p.category && <Badge variant="outline" className="text-[10px]">{p.category}</Badge>}
                    {p.submittedByEmail && <span className="text-[10px] text-muted-foreground">{p.submittedByEmail}</span>}
                    <span className="text-[10px] text-muted-foreground">{new Date(p.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button onClick={() => statusMutation.mutate({ id: p.id, status: "approved" })} data-testid={`button-approve-sub-${p.id}`}>
                  <Check className="h-4 w-4 mr-1" /> Approve
                </Button>
                <Button variant="outline" onClick={() => statusMutation.mutate({ id: p.id, status: "rejected" })} data-testid={`button-reject-sub-${p.id}`}>
                  <X className="h-4 w-4 mr-1" /> Reject
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function StatsSection() {
  const { data: allPodcasts } = useQuery<PodcastWithCount[]>({
    queryKey: ["/api/admin/podcasts"],
  });

  const total = allPodcasts?.length || 0;
  const pending = allPodcasts?.filter(p => p.status === "pending").length || 0;
  const approved = allPodcasts?.filter(p => p.status === "approved").length || 0;
  const totalEpisodes = allPodcasts?.reduce((sum, p) => sum + (p.episodeCount || 0), 0) || 0;

  const stats = [
    { label: "Total Podcasts", value: total, icon: Headphones },
    { label: "Approved", value: approved, icon: Check },
    { label: "Pending", value: pending, icon: Clock },
    { label: "Total Episodes", value: totalEpisodes, icon: Hash },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map((s) => (
        <Card key={s.label} className="p-4" data-testid={`stat-${s.label.toLowerCase().replace(/\s+/g, "-")}`}>
          <div className="flex items-center gap-2">
            <s.icon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{s.label}</span>
          </div>
          <p className="text-2xl font-bold mt-1">{s.value}</p>
        </Card>
      ))}
    </div>
  );
}

export default function PodcastDirectoryPanel({ cityId }: { cityId?: string }) {
  return (
    <div className="space-y-6" data-testid="podcast-directory-panel">
      <div>
        <h2 className="text-xl font-bold" data-testid="text-panel-title">Podcast Directory</h2>
        <p className="text-sm text-muted-foreground">Manage local podcasts, episodes, and submissions</p>
      </div>

      <StatsSection />

      <Tabs defaultValue="podcasts" data-testid="podcast-tabs">
        <TabsList data-testid="podcast-tabs-list">
          <TabsTrigger value="podcasts" data-testid="tab-podcasts">Podcasts</TabsTrigger>
          <TabsTrigger value="episodes" data-testid="tab-episodes">Episodes</TabsTrigger>
          <TabsTrigger value="submissions" data-testid="tab-submissions">Submissions</TabsTrigger>
        </TabsList>
        <TabsContent value="podcasts"><PodcastsTab /></TabsContent>
        <TabsContent value="episodes"><EpisodesTab /></TabsContent>
        <TabsContent value="submissions"><SubmissionsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
