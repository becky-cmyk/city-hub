import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Film, Plus, Play, Clock, Eye, Trash2, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  archived: "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
};

const TIER_COLORS: Record<string, string> = {
  free: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  featured: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  promoted: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  ad: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
};

export default function PulseVideosPanel({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [durationSec, setDurationSec] = useState("");
  const [tier, setTier] = useState("free");
  const [isAd, setIsAd] = useState(false);
  const [authorName, setAuthorName] = useState("");

  const videosUrl = cityId ? `/api/admin/pulse-videos?cityId=${cityId}` : "/api/admin/pulse-videos";
  const { data: videos = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/pulse-videos", cityId],
    queryFn: async () => {
      const res = await fetch(videosUrl, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch videos");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/admin/pulse-videos", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pulse-videos", cityId] });
      setCreateOpen(false);
      resetForm();
      toast({ title: "Video created" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      await apiRequest("PATCH", `/api/admin/pulse-videos/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pulse-videos", cityId] });
      toast({ title: "Video updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/pulse-videos/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pulse-videos", cityId] });
      toast({ title: "Video deleted" });
    },
  });

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setVideoUrl("");
    setThumbnailUrl("");
    setDurationSec("");
    setTier("free");
    setIsAd(false);
    setAuthorName("");
  };

  const handleCreate = () => {
    if (!title || !videoUrl) return;
    createMutation.mutate({ title, description, videoUrl, thumbnailUrl, durationSec, tier, isAd, authorName, cityId: cityId || "" });
  };

  const filtered = filterStatus === "all" ? videos : videos.filter((v: any) => v.status === filterStatus);

  const counts = {
    all: videos.length,
    draft: videos.filter((v: any) => v.status === "draft").length,
    review: videos.filter((v: any) => v.status === "review").length,
    approved: videos.filter((v: any) => v.status === "approved").length,
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="pulse-videos-panel">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Film className="w-6 h-6 text-fuchsia-600 dark:text-fuchsia-400" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Pulse Videos</h2>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-video">
              <Plus className="w-4 h-4 mr-1" />
              Add Video
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Short Video</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Video title" data-testid="input-video-title" />
              </div>
              <div>
                <Label>Video URL</Label>
                <Input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://..." data-testid="input-video-url" />
                <p className="text-xs text-gray-500 mt-1">Direct video file URL (mp4, webm) or hosted video link</p>
              </div>
              <div>
                <Label>Thumbnail URL (optional)</Label>
                <Input value={thumbnailUrl} onChange={e => setThumbnailUrl(e.target.value)} placeholder="https://..." data-testid="input-thumbnail-url" />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Short description..." data-testid="input-video-description" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Duration (seconds)</Label>
                  <Input type="number" value={durationSec} onChange={e => setDurationSec(e.target.value)} placeholder="30" data-testid="input-duration" />
                </div>
                <div>
                  <Label>Author Name</Label>
                  <Input value={authorName} onChange={e => setAuthorName(e.target.value)} placeholder="Creator name" data-testid="input-author" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tier</Label>
                  <Select value={tier} onValueChange={setTier}>
                    <SelectTrigger data-testid="select-tier">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free (Verified)</SelectItem>
                      <SelectItem value="featured">Featured (Hub Presence)</SelectItem>
                      <SelectItem value="promoted">Promoted (Paid)</SelectItem>
                      <SelectItem value="ad">Ad (Monetized)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch checked={isAd} onCheckedChange={setIsAd} data-testid="switch-is-ad" />
                  <Label>Paid Ad Placement</Label>
                </div>
              </div>
              <Button onClick={handleCreate} disabled={createMutation.isPending || !title || !videoUrl} className="w-full" data-testid="button-submit-video">
                {createMutation.isPending ? "Creating..." : "Create Video"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["all", "draft", "review", "approved"] as const).map(status => (
          <Button
            key={status}
            variant={filterStatus === status ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterStatus(status)}
            data-testid={`filter-${status}`}
          >
            {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
            <span className="ml-1 opacity-70">({counts[status]})</span>
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          No videos found. Add your first short video above.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((video: any) => (
            <Card key={video.id} data-testid={`video-card-${video.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="shrink-0 w-24 h-16 rounded bg-gray-100 dark:bg-gray-800 overflow-hidden flex items-center justify-center">
                    {video.thumbnailUrl ? (
                      <img src={video.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Play className="w-8 h-8 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-gray-900 dark:text-white truncate">{video.title}</h3>
                    </div>
                    {video.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1 mb-2">{video.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={STATUS_COLORS[video.status] || STATUS_COLORS.draft}>
                        {video.status}
                      </Badge>
                      <Badge className={TIER_COLORS[video.tier] || TIER_COLORS.free}>
                        {video.tier}
                      </Badge>
                      {video.isAd && (
                        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">Ad</Badge>
                      )}
                      {video.durationSec && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {Math.floor(video.durationSec / 60)}:{(video.durationSec % 60).toString().padStart(2, "0")}
                        </span>
                      )}
                      {video.authorName && (
                        <span className="text-xs text-gray-500">by {video.authorName}</span>
                      )}
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {video.viewCount || 0}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {video.status === "draft" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => updateMutation.mutate({ id: video.id, status: "approved" })}
                        data-testid={`approve-${video.id}`}
                      >
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      </Button>
                    )}
                    {video.status === "approved" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => updateMutation.mutate({ id: video.id, status: "archived" })}
                        data-testid={`archive-${video.id}`}
                      >
                        <XCircle className="w-4 h-4 text-gray-500" />
                      </Button>
                    )}
                    <Select
                      value={video.tier}
                      onValueChange={(val) => updateMutation.mutate({ id: video.id, tier: val })}
                    >
                      <SelectTrigger className="w-28" data-testid={`tier-select-${video.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="featured">Featured</SelectItem>
                        <SelectItem value="promoted">Promoted</SelectItem>
                        <SelectItem value="ad">Ad</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(video.id)}
                      data-testid={`delete-${video.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
