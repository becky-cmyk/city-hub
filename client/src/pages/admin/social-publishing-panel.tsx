import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Copy, Check, X, Trash2, ExternalLink, Edit, Sparkles,
  Loader2, Eye, Play, Image as ImageIcon, Hash, FileText,
  Calendar, Building2, Radio
} from "lucide-react";
import { SiYoutube, SiFacebook, SiInstagram, SiTiktok } from "react-icons/si";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SocialPost } from "@shared/schema";

const PLATFORM_CONFIG: Record<string, { label: string; icon: any; maxChars: number; color: string }> = {
  youtube: { label: "YouTube", icon: SiYoutube, maxChars: 5000, color: "text-red-500" },
  facebook: { label: "Facebook", icon: SiFacebook, maxChars: 63206, color: "text-blue-500" },
  instagram: { label: "Instagram", icon: SiInstagram, maxChars: 2200, color: "text-pink-500" },
  tiktok: { label: "TikTok", icon: SiTiktok, maxChars: 2200, color: "text-foreground" },
  all: { label: "All Platforms", icon: Radio, maxChars: 2200, color: "text-muted-foreground" },
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  approved: "default",
  published: "outline",
  rejected: "destructive",
};

const SOURCE_LABELS: Record<string, string> = {
  article: "Article",
  post: "Pulse Post",
  event: "Event",
  business: "Business",
};

function PlatformIcon({ platform, className }: { platform: string; className?: string }) {
  const config = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.all;
  const Icon = config.icon;
  return <Icon className={`${className || "h-4 w-4"} ${config.color}`} />;
}

function CharacterCount({ text, platform }: { text: string; platform: string }) {
  const config = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.all;
  const len = text.length;
  const over = len > config.maxChars;
  return (
    <span className={`text-[10px] ${over ? "text-red-500 font-medium" : "text-muted-foreground"}`} data-testid="text-char-count">
      {len}/{config.maxChars}
    </span>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ title: `${label} copied to clipboard` });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={handleCopy} data-testid={`button-copy-${label.toLowerCase().replace(/\s/g, "-")}`}>
      {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
      {copied ? "Copied" : `Copy ${label}`}
    </Button>
  );
}

function EditPostDialog({ post, open, onClose }: { post: SocialPost; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [caption, setCaption] = useState(post.caption);
  const [hashtags, setHashtags] = useState((post.hashtags || []).join(" "));
  const [platform, setPlatform] = useState(post.platform);
  const [imageUrl, setImageUrl] = useState(post.imageUrl || "");

  const updateMutation = useMutation({
    mutationFn: async () => {
      const hashArr = hashtags.split(/\s+/).filter(h => h.startsWith("#") || h.length > 0).map(h => h.startsWith("#") ? h : `#${h}`);
      await apiRequest("PATCH", `/api/admin/social/posts/${post.id}`, {
        caption,
        hashtags: hashArr,
        platform,
        imageUrl: imageUrl || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/social/posts"] });
      toast({ title: "Post updated" });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Social Post</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Platform</label>
            <Select value={platform} onValueChange={(v: any) => setPlatform(v)}>
              <SelectTrigger data-testid="select-edit-platform">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PLATFORM_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium">Caption</label>
              <CharacterCount text={caption} platform={platform} />
            </div>
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={5}
              data-testid="input-edit-caption"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Hashtags</label>
            <Input
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              placeholder="#CLT #Charlotte #local"
              data-testid="input-edit-hashtags"
            />
            <p className="text-[10px] text-muted-foreground">
              {hashtags.split(/\s+/).filter(Boolean).length} hashtags
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Image URL</label>
            <Input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              data-testid="input-edit-image"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-edit">Cancel</Button>
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={!caption.trim() || updateMutation.isPending}
            data-testid="button-save-edit"
          >
            {updateMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PublishDialog({ post, open, onClose }: { post: SocialPost; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [externalUrl, setExternalUrl] = useState(post.externalUrl || "");

  const publishMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/admin/social/posts/${post.id}`, {
        status: "published",
        externalUrl: externalUrl || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/social/posts"] });
      toast({ title: "Marked as published" });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark as Published</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            After posting on the platform, paste the live URL below (optional).
          </p>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">External URL (optional)</label>
            <Input
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="https://instagram.com/p/..."
              data-testid="input-publish-url"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-publish">Cancel</Button>
          <Button onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending} data-testid="button-confirm-publish">
            {publishMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Mark Published
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateFromContentDialog({ open, onClose, metroId }: { open: boolean; onClose: () => void; metroId: string }) {
  const { toast } = useToast();
  const [sourceType, setSourceType] = useState("article");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("#CLT #Charlotte");
  const [platform, setPlatform] = useState("all");
  const [imageUrl, setImageUrl] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      const hashArr = hashtags.split(/\s+/).filter(Boolean).map(h => h.startsWith("#") ? h : `#${h}`);
      const resp = await apiRequest("POST", "/api/admin/social/posts", {
        metroId,
        sourceType,
        platform,
        caption,
        hashtags: hashArr,
        imageUrl: imageUrl || null,
        status: "draft",
        createdBy: "admin",
      });
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/social/posts"] });
      toast({ title: "Social post created" });
      setCaption("");
      setHashtags("#CLT #Charlotte");
      setImageUrl("");
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Create failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Social Post</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Source Type</label>
              <Select value={sourceType} onValueChange={setSourceType}>
                <SelectTrigger data-testid="select-create-source-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="article">Article</SelectItem>
                  <SelectItem value="post">Pulse Post</SelectItem>
                  <SelectItem value="event">Event</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Platform</label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger data-testid="select-create-platform">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PLATFORM_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium">Caption</label>
              <CharacterCount text={caption} platform={platform} />
            </div>
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={4}
              placeholder="Write your social caption..."
              data-testid="input-create-caption"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Hashtags</label>
            <Input
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              placeholder="#CLT #Charlotte"
              data-testid="input-create-hashtags"
            />
            <p className="text-[10px] text-muted-foreground">
              {hashtags.split(/\s+/).filter(Boolean).length} hashtags
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Image URL (optional)</label>
            <Input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              data-testid="input-create-image"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-create">Cancel</Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!caption.trim() || createMutation.isPending}
            data-testid="button-submit-create"
          >
            {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Create Draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SocialPostCard({ post }: { post: SocialPost }) {
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);

  const platformConfig = PLATFORM_CONFIG[post.platform] || PLATFORM_CONFIG.all;
  const hashtagsStr = (post.hashtags || []).join(" ");

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      await apiRequest("PATCH", `/api/admin/social/posts/${post.id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/social/posts"] });
    },
    onError: (err: any) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/admin/social/posts/${post.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/social/posts"] });
      toast({ title: "Post deleted" });
    },
  });

  return (
    <>
      <Card data-testid={`card-social-post-${post.id}`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {post.imageUrl && (
              <div className="shrink-0 w-16 h-16 rounded-md overflow-hidden bg-muted">
                <img src={post.imageUrl} alt="" className="w-full h-full object-cover" data-testid={`img-social-${post.id}`} />
              </div>
            )}
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <PlatformIcon platform={post.platform} className="h-4 w-4" />
                <span className="text-xs font-medium">{platformConfig.label}</span>
                <Badge variant={STATUS_VARIANTS[post.status] || "outline"} data-testid={`badge-status-${post.id}`}>
                  {post.status}
                </Badge>
                {post.sourceType && (
                  <Badge variant="outline" className="text-[10px]">
                    {SOURCE_LABELS[post.sourceType] || post.sourceType}
                  </Badge>
                )}
                {post.createdBy === "charlotte" && (
                  <Badge variant="outline" className="text-[10px] gap-0.5">
                    <Sparkles className="h-2.5 w-2.5" /> AI
                  </Badge>
                )}
              </div>
              <p className="text-sm line-clamp-3" data-testid={`text-caption-${post.id}`}>{post.caption}</p>
              {post.hashtags && post.hashtags.length > 0 && (
                <div className="flex items-center gap-1">
                  <Hash className="h-3 w-3 text-muted-foreground shrink-0" />
                  <p className="text-xs text-muted-foreground line-clamp-1" data-testid={`text-hashtags-${post.id}`}>
                    {post.hashtags.join(" ")}
                  </p>
                </div>
              )}
              {post.externalUrl && (
                <a
                  href={post.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1"
                  data-testid={`link-external-${post.id}`}
                >
                  <ExternalLink className="h-3 w-3" />
                  View on platform
                </a>
              )}
              <p className="text-[10px] text-muted-foreground">
                {new Date(post.createdAt).toLocaleDateString()}
                {post.publishedAt && ` \u00b7 Published ${new Date(post.publishedAt).toLocaleDateString()}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 mt-3 pt-3 border-t flex-wrap">
            <CopyButton text={post.caption} label="Caption" />
            {hashtagsStr && <CopyButton text={hashtagsStr} label="Hashtags" />}
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)} data-testid={`button-edit-${post.id}`}>
              <Edit className="h-3 w-3 mr-1" />
              Edit
            </Button>
            {post.status === "draft" && (
              <Button
                size="sm"
                onClick={() => updateStatusMutation.mutate("approved")}
                disabled={updateStatusMutation.isPending}
                data-testid={`button-approve-${post.id}`}
              >
                <Check className="h-3 w-3 mr-1" />
                Approve
              </Button>
            )}
            {(post.status === "draft" || post.status === "approved") && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPublishOpen(true)}
                data-testid={`button-publish-${post.id}`}
              >
                <Play className="h-3 w-3 mr-1" />
                Published
              </Button>
            )}
            {post.status === "draft" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => updateStatusMutation.mutate("rejected")}
                disabled={updateStatusMutation.isPending}
                data-testid={`button-reject-${post.id}`}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              data-testid={`button-delete-${post.id}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {editOpen && <EditPostDialog post={post} open={editOpen} onClose={() => setEditOpen(false)} />}
      {publishOpen && <PublishDialog post={post} open={publishOpen} onClose={() => setPublishOpen(false)} />}
    </>
  );
}

export default function SocialPublishingPanel({ selectedCityId }: { selectedCityId?: string }) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);

  const metroParam = selectedCityId ? `?metroId=${selectedCityId}` : "";
  const { data: allPosts, isLoading } = useQuery<SocialPost[]>({
    queryKey: ["/api/admin/social/posts", selectedCityId],
    queryFn: async () => {
      const resp = await fetch(`/api/admin/social/posts${metroParam}`);
      if (!resp.ok) throw new Error("Failed to fetch");
      return resp.json();
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", "/api/admin/social/generate", { metroId: selectedCityId || "" });
      return resp.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/social/posts"] });
      toast({
        title: "Social posts generated",
        description: `${data.generated || 0} new posts created by Charlotte`,
      });
    },
    onError: (err: any) => {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    },
  });

  const posts = allPosts || [];
  const drafts = posts.filter(p => p.status === "draft");
  const approved = posts.filter(p => p.status === "approved");
  const published = posts.filter(p => p.status === "published");
  const rejected = posts.filter(p => p.status === "rejected");

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const publishedThisWeek = published.filter(p => p.publishedAt && new Date(p.publishedAt) >= weekAgo);

  const filteredPosts = activeTab === "all" ? posts
    : activeTab === "drafts" ? drafts
    : activeTab === "approved" ? approved
    : activeTab === "published" ? published
    : rejected;

  return (
    <div className="space-y-4 p-4 max-w-5xl" data-testid="social-publishing-panel">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-bold" data-testid="text-panel-title">Social Publishing Queue</h2>
          <p className="text-xs text-muted-foreground">
            Manage Charlotte-generated social media posts. Copy to clipboard and publish on each platform.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            data-testid="button-generate-social"
          >
            {generateMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            )}
            Generate Social Posts
          </Button>
          <Button onClick={() => setCreateOpen(true)} data-testid="button-create-from-content">
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Create from Content
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold" data-testid="text-drafts-count">{drafts.length}</p>
          <p className="text-[10px] text-muted-foreground">Drafts Pending</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold" data-testid="text-published-week">{publishedThisWeek.length}</p>
          <p className="text-[10px] text-muted-foreground">Published This Week</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold" data-testid="text-total-count">{posts.length}</p>
          <p className="text-[10px] text-muted-foreground">Total Generated</p>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList data-testid="tabs-social-filter">
          <TabsTrigger value="all" data-testid="tab-all">
            All
            {posts.length > 0 && <Badge variant="secondary" className="ml-1.5 text-[9px] h-4 min-w-[16px] justify-center">{posts.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="drafts" data-testid="tab-drafts">
            Drafts
            {drafts.length > 0 && <Badge variant="secondary" className="ml-1.5 text-[9px] h-4 min-w-[16px] justify-center">{drafts.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="approved" data-testid="tab-approved">
            Approved
            {approved.length > 0 && <Badge variant="secondary" className="ml-1.5 text-[9px] h-4 min-w-[16px] justify-center">{approved.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="published" data-testid="tab-published">Published</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : filteredPosts.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground" data-testid="text-empty-state">
            {activeTab === "drafts"
              ? "No drafts pending. Click \"Generate Social Posts\" to have Charlotte create content."
              : activeTab === "approved"
              ? "No approved posts waiting to be published."
              : activeTab === "published"
              ? "No published posts yet."
              : "No social posts yet. Generate posts from your best content or create one manually."}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredPosts.map((post) => (
            <SocialPostCard key={post.id} post={post} />
          ))}
        </div>
      )}

      <CreateFromContentDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        metroId={selectedCityId || ""}
      />
    </div>
  );
}
