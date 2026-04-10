import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useDefaultCityId } from "@/hooks/use-city";
import { PhotoUpload } from "@/components/photo-upload";
import {
  Plus, Sparkles, Video, ExternalLink, Loader2, Eye,
  Clock, CheckCircle, FileText, Play
} from "lucide-react";
import { SiTiktok } from "react-icons/si";

interface Post {
  id: string;
  title: string;
  body: string;
  coverImageUrl: string | null;
  videoUrl: string | null;
  videoEmbedUrl: string | null;
  videoThumbnailUrl: string | null;
  mediaType: string;
  status: string;
  sourceType: string;
  createdAt: string;
  publishedAt: string | null;
}

function isTikTokUrl(url: string): boolean {
  return /tiktok\.com|vm\.tiktok\.com/i.test(url);
}

export default function PulsePostsPanel({ cityId: propCityId }: { cityId?: string }) {
  const { toast } = useToast();
  const defaultCityId = useDefaultCityId();
  const cityId = propCityId || defaultCityId;
  const [showCreate, setShowCreate] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [context, setContext] = useState("");
  const [publishImmediately, setPublishImmediately] = useState(true);

  const postsQuery = useQuery<Post[]>({
    queryKey: [`/api/admin/pulse/posts?cityId=${cityId}&limit=50`],
    enabled: !!cityId,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/admin/pulse/create-post", data),
    onSuccess: () => {
      toast({ title: "Post created", description: publishImmediately ? "Published to Pulse" : "Saved as draft" });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/pulse/posts?cityId=${cityId}&limit=50`] });
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to create post", variant: "destructive" });
    },
  });

  const aiCaptionMutation = useMutation({
    mutationFn: (data: { videoUrl: string; context?: string }) =>
      apiRequest("POST", "/api/admin/pulse/ai-caption", data).then(r => r.json()),
    onSuccess: (data: any) => {
      if (data.title) setTitle(data.title);
      if (data.body) setBody(data.body);
      toast({ title: "AI caption generated", description: "Review and edit before publishing" });
    },
    onError: () => {
      toast({ title: "AI unavailable", description: "Write your caption manually", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setVideoUrl("");
    setTitle("");
    setBody("");
    setCoverImageUrl("");
    setContext("");
    setShowCreate(false);
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      title: title.trim(),
      body: body.trim() || undefined,
      coverImageUrl: coverImageUrl || undefined,
      videoUrl: videoUrl || undefined,
      cityId,
      publishImmediately,
    });
  };

  const handleAiCaption = () => {
    if (!videoUrl.trim()) {
      toast({ title: "Paste a video URL first", variant: "destructive" });
      return;
    }
    aiCaptionMutation.mutate({ videoUrl: videoUrl.trim(), context: context.trim() || undefined });
  };

  const isTikTok = videoUrl ? isTikTokUrl(videoUrl) : false;

  return (
    <div className="space-y-6" data-testid="panel-pulse-posts">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-pulse-posts-title">Pulse Posts</h2>
          <p className="text-sm text-muted-foreground">Create and manage social posts for the Pulse feed</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)} data-testid="button-create-pulse-post">
          <Plus className="h-4 w-4 mr-2" />
          Create Post
        </Button>
      </div>

      {showCreate && (
        <Card className="border-2 border-primary/20" data-testid="card-create-post">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Video className="h-5 w-5" />
              New Pulse Post
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Video URL (TikTok, YouTube, or direct link)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="https://www.tiktok.com/@user/video/..."
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  data-testid="input-video-url"
                />
                {isTikTok && (
                  <Badge variant="secondary" className="flex items-center gap-1 shrink-0 px-3">
                    <SiTiktok className="h-3 w-3" />
                    TikTok
                  </Badge>
                )}
              </div>
              {isTikTok && videoUrl && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  TikTok URL detected — will auto-embed and fetch thumbnail
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Context for AI (optional — describe what the video is about)</Label>
              <Input
                placeholder="e.g. New restaurant opening in South End, great brunch spot..."
                value={context}
                onChange={(e) => setContext(e.target.value)}
                data-testid="input-ai-context"
              />
            </div>

            <Button
              variant="secondary"
              onClick={handleAiCaption}
              disabled={aiCaptionMutation.isPending || !videoUrl.trim()}
              className="w-full"
              data-testid="button-ai-caption"
            >
              {aiCaptionMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              {aiCaptionMutation.isPending ? "Generating caption..." : "Generate Caption with AI"}
            </Button>

            <div className="border-t pt-4 space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  placeholder="Short, punchy headline..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={500}
                  data-testid="input-post-title"
                />
              </div>

              <div className="space-y-2">
                <Label>Caption / Body</Label>
                <Textarea
                  placeholder="Write your caption... include hashtags at the end"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={4}
                  data-testid="input-post-body"
                />
              </div>

              <div className="space-y-2">
                <Label>Cover Image (optional — auto-fetched for TikTok)</Label>
                <PhotoUpload
                  value={coverImageUrl}
                  onChange={setCoverImageUrl}
                  label="Upload cover image"
                />
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  checked={publishImmediately}
                  onCheckedChange={setPublishImmediately}
                  data-testid="switch-publish-immediately"
                />
                <Label className="cursor-pointer">Publish immediately to Pulse</Label>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleSubmit}
                  disabled={createMutation.isPending || !title.trim()}
                  className="flex-1"
                  data-testid="button-submit-post"
                >
                  {createMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  {publishImmediately ? "Publish to Pulse" : "Save as Draft"}
                </Button>
                <Button variant="outline" onClick={resetForm} data-testid="button-cancel-post">
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          Recent Posts ({postsQuery.data?.length || 0})
        </h3>

        {postsQuery.isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
          </div>
        )}

        {postsQuery.data?.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No Pulse posts yet. Create your first post above.</p>
            </CardContent>
          </Card>
        )}

        {postsQuery.data?.map((post) => (
          <Card key={post.id} className="overflow-hidden" data-testid={`card-post-${post.id}`}>
            <CardContent className="p-4">
              <div className="flex gap-4">
                {(post.videoThumbnailUrl || post.coverImageUrl) && (
                  <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-muted shrink-0">
                    <img
                      src={post.videoThumbnailUrl || post.coverImageUrl || ""}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    {post.mediaType === "video" && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <Play className="h-6 w-6 text-white fill-white" />
                      </div>
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-sm truncate" data-testid={`text-post-title-${post.id}`}>
                      {post.title}
                    </h4>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {post.videoUrl && isTikTokUrl(post.videoUrl) && (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <SiTiktok className="h-2.5 w-2.5" /> TikTok
                        </Badge>
                      )}
                      <Badge
                        variant={post.status === "published" ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {post.status === "published" ? (
                          <><CheckCircle className="h-2.5 w-2.5 mr-0.5" /> Live</>
                        ) : post.status === "draft" ? (
                          <><Clock className="h-2.5 w-2.5 mr-0.5" /> Draft</>
                        ) : (
                          post.status
                        )}
                      </Badge>
                    </div>
                  </div>
                  {post.body && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{post.body}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(post.createdAt).toLocaleDateString()}
                    </span>
                    <span>{post.sourceType}</span>
                    {post.videoUrl && (
                      <a
                        href={post.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-0.5 text-primary hover:underline"
                        data-testid={`link-post-video-${post.id}`}
                      >
                        <ExternalLink className="h-3 w-3" /> Source
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
