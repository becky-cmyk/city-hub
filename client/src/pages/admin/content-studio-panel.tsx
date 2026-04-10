import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";
import {
  Sparkles, Loader2, Copy, Check, X, Eye, Pencil,
  Instagram, FileText, Megaphone, Radio, Hash,
  Trash2, Package, Send, ChevronDown, ChevronUp,
  RefreshCw, Video, Mail,
} from "lucide-react";
import { SiTiktok } from "react-icons/si";

interface ContentSource {
  sourceType: string;
  sourceId: string;
  title: string;
  excerpt: string;
  imageUrl: string | null;
  createdAt: string;
}

interface ContentDeliverable {
  id: string;
  packageId: string;
  type: string;
  platform: string | null;
  variant: string | null;
  content: string;
  hashtags: string[];
  imageUrl: string | null;
  status: string;
  scheduledAt: string | null;
  publishedExternallyAt: string | null;
  createdAt: string;
}

interface ContentPackageWithDeliverables {
  id: string;
  metroId: string;
  sourceType: string;
  sourceId: string;
  sourceTitle: string;
  sourceExcerpt: string | null;
  sourceImageUrl: string | null;
  contentItemId: string | null;
  status: string;
  createdBy: string;
  createdAt: string;
  deliverables: ContentDeliverable[];
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  article: "Article",
  event: "Event",
  business: "Business",
  post: "Pulse Post",
  cms_content: "CMS Content",
};

const DELIVERABLE_TYPE_LABELS: Record<string, string> = {
  social_post: "Social Post",
  caption_variant: "Caption Variant",
  pulse_update: "Pulse Update",
  ad_copy: "Ad Copy",
  email_blurb: "Email Blurb",
  newsletter: "Newsletter",
  video_script: "Video/Script",
};

const STATUS_BADGE_MAP: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  approved: "default",
  rejected: "destructive",
  published: "outline",
  review: "secondary",
  archived: "outline",
};

function DeliverableIcon({ type, platform }: { type: string; platform: string | null }) {
  if (type === "social_post" && platform === "instagram") return <Instagram className="h-4 w-4" />;
  if (type === "social_post" && platform === "tiktok") return <SiTiktok className="h-3.5 w-3.5" />;
  if (type === "social_post" && platform === "twitter") return <Send className="h-4 w-4" />;
  if (type === "social_post") return <Send className="h-4 w-4" />;
  if (type === "caption_variant") return <FileText className="h-4 w-4" />;
  if (type === "pulse_update") return <Radio className="h-4 w-4" />;
  if (type === "ad_copy") return <Megaphone className="h-4 w-4" />;
  if (type === "newsletter") return <Mail className="h-4 w-4" />;
  if (type === "video_script") return <Video className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
}

function DeliverableLabel({ type, platform, variant }: { type: string; platform: string | null; variant: string | null }) {
  let label = "";
  if (type === "social_post" && platform) {
    label = `${platform.charAt(0).toUpperCase() + platform.slice(1)} Post`;
  } else {
    label = DELIVERABLE_TYPE_LABELS[type] || type;
  }
  if (variant) {
    label += ` (${variant})`;
  }
  return label;
}

function CopiedFeedback({ copied }: { copied: boolean }) {
  if (!copied) return null;
  return <span className="text-xs text-green-600 dark:text-green-400 font-medium">Copied</span>;
}

function DeliverableCard({
  deliverable,
  onUpdate,
  onRegenerate,
  isUpdating,
  isRegenerating,
}: {
  deliverable: ContentDeliverable;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  onRegenerate: (id: string) => void;
  isUpdating: boolean;
  isRegenerating: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(deliverable.content);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const hashtagStr = deliverable.hashtags.length > 0 ? "\n\n" + deliverable.hashtags.join(" ") : "";
    navigator.clipboard.writeText(deliverable.content + hashtagStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    onUpdate(deliverable.id, { content: editContent });
    setEditing(false);
  };

  return (
    <div className="border rounded-lg p-4 space-y-3" data-testid={`deliverable-card-${deliverable.id}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <DeliverableIcon type={deliverable.type} platform={deliverable.platform} />
          <span className="text-sm font-medium" data-testid={`text-deliverable-type-${deliverable.id}`}>
            {DeliverableLabel({ type: deliverable.type, platform: deliverable.platform, variant: deliverable.variant })}
          </span>
          <Badge variant={STATUS_BADGE_MAP[deliverable.status] || "secondary"} data-testid={`badge-deliverable-status-${deliverable.id}`}>
            {deliverable.status}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <CopiedFeedback copied={copied} />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            data-testid={`button-copy-${deliverable.id}`}
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setEditing(!editing); setEditContent(deliverable.content); }}
            data-testid={`button-edit-${deliverable.id}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRegenerate(deliverable.id)}
            disabled={isRegenerating}
            data-testid={`button-regenerate-single-${deliverable.id}`}
          >
            {isRegenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={4}
            data-testid={`textarea-edit-${deliverable.id}`}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isUpdating}
              data-testid={`button-save-edit-${deliverable.id}`}
            >
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(false)}
              data-testid={`button-cancel-edit-${deliverable.id}`}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm whitespace-pre-wrap" data-testid={`text-deliverable-content-${deliverable.id}`}>
          {deliverable.content}
        </p>
      )}

      {deliverable.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {deliverable.hashtags.map((tag, i) => (
            <span key={i} className="text-xs text-muted-foreground" data-testid={`text-hashtag-${deliverable.id}-${i}`}>
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-1">
        {deliverable.status !== "approved" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onUpdate(deliverable.id, { status: "approved" })}
            disabled={isUpdating}
            data-testid={`button-approve-${deliverable.id}`}
          >
            <Check className="h-3.5 w-3.5 mr-1" /> Approve
          </Button>
        )}
        {deliverable.status !== "rejected" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onUpdate(deliverable.id, { status: "rejected" })}
            disabled={isUpdating}
            data-testid={`button-reject-${deliverable.id}`}
          >
            <X className="h-3.5 w-3.5 mr-1" /> Reject
          </Button>
        )}
      </div>
    </div>
  );
}

function PackageCard({
  pkg,
  onUpdateDeliverable,
  onDeletePackage,
  onRegeneratePackage,
  onRegenerateDeliverable,
  isUpdating,
  isRegeneratingPkg,
  regeneratingDeliverableId,
}: {
  pkg: ContentPackageWithDeliverables;
  onUpdateDeliverable: (id: string, data: Record<string, unknown>) => void;
  onDeletePackage: (id: string) => void;
  onRegeneratePackage: (id: string) => void;
  onRegenerateDeliverable: (id: string) => void;
  isUpdating: boolean;
  isRegeneratingPkg: boolean;
  regeneratingDeliverableId: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const approvedCount = pkg.deliverables.filter(d => d.status === "approved").length;

  return (
    <Card className="p-4 space-y-3" data-testid={`package-card-${pkg.id}`}>
      <div className="flex items-start justify-between">
        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" data-testid={`badge-source-type-${pkg.id}`}>
              {SOURCE_TYPE_LABELS[pkg.sourceType] || pkg.sourceType}
            </Badge>
            <Badge variant={STATUS_BADGE_MAP[pkg.status] || "secondary"} data-testid={`badge-pkg-status-${pkg.id}`}>
              {pkg.status}
            </Badge>
            <span className="text-xs text-muted-foreground" data-testid={`text-deliverable-count-${pkg.id}`}>
              {pkg.deliverables.length} items ({approvedCount} approved)
            </span>
          </div>
          <h3 className="font-medium truncate" data-testid={`text-pkg-title-${pkg.id}`}>{pkg.sourceTitle}</h3>
          {pkg.sourceExcerpt && (
            <p className="text-sm text-muted-foreground line-clamp-2">{pkg.sourceExcerpt}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {new Date(pkg.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRegeneratePackage(pkg.id)}
            disabled={isRegeneratingPkg}
            title="Regenerate entire package"
            data-testid={`button-regenerate-pkg-${pkg.id}`}
          >
            {isRegeneratingPkg ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            data-testid={`button-expand-${pkg.id}`}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDeletePackage(pkg.id)}
            data-testid={`button-delete-pkg-${pkg.id}`}
          >
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="space-y-3 pt-2 border-t">
          {pkg.deliverables.map(d => (
            <DeliverableCard
              key={d.id}
              deliverable={d}
              onUpdate={onUpdateDeliverable}
              onRegenerate={onRegenerateDeliverable}
              isUpdating={isUpdating}
              isRegenerating={regeneratingDeliverableId === d.id}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

export default function ContentStudioPanel({ cityId }: { cityId: string }) {
  const { toast } = useToast();
  const [sourceFilter, setSourceFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [regeneratingPkgId, setRegeneratingPkgId] = useState<string | null>(null);
  const [regeneratingDeliverableId, setRegeneratingDeliverableId] = useState<string | null>(null);

  const { data: sources, isLoading: sourcesLoading } = useQuery<ContentSource[]>({
    queryKey: ["/api/admin/content-studio/sources", cityId, sourceFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ metroId: cityId });
      if (sourceFilter !== "all") params.set("type", sourceFilter);
      const resp = await fetch(`/api/admin/content-studio/sources?${params}`);
      if (!resp.ok) throw new Error("Failed to fetch sources");
      return resp.json();
    },
    enabled: !!cityId,
  });

  const { data: packages, isLoading: packagesLoading } = useQuery<ContentPackageWithDeliverables[]>({
    queryKey: ["/api/admin/content-studio/packages", cityId, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ metroId: cityId });
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      const resp = await fetch(`/api/admin/content-studio/packages?${params}`);
      if (!resp.ok) throw new Error("Failed to fetch packages");
      return resp.json();
    },
    enabled: !!cityId,
  });

  const generateMutation = useMutation({
    mutationFn: async (source: ContentSource) => {
      const payload: Record<string, unknown> = {
        metroId: cityId,
        sourceType: source.sourceType,
        sourceId: source.sourceId,
        sourceTitle: source.title,
        sourceExcerpt: source.excerpt,
        sourceImageUrl: source.imageUrl,
      };
      if (source.sourceType === "cms_content") {
        payload.contentItemId = source.sourceId;
      }
      const res = await apiRequest("POST", "/api/admin/content-studio/generate", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/content-studio/packages"] });
      toast({ title: "Content package generated", description: "Review your content below" });
      setGeneratingId(null);
    },
    onError: (err: Error) => {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
      setGeneratingId(null);
    },
  });

  const updateDeliverableMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/admin/content-studio/deliverables/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/content-studio/packages"] });
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const deletePackageMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/content-studio/packages/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/content-studio/packages"] });
      toast({ title: "Package deleted" });
    },
  });

  const regeneratePackageMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/content-studio/packages/${id}/regenerate`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/content-studio/packages"] });
      toast({ title: "Package regenerated", description: "Fresh content has been generated" });
      setRegeneratingPkgId(null);
    },
    onError: (err: Error) => {
      toast({ title: "Regeneration failed", description: err.message, variant: "destructive" });
      setRegeneratingPkgId(null);
    },
  });

  const regenerateDeliverableMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/content-studio/deliverables/${id}/regenerate`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/content-studio/packages"] });
      toast({ title: "Deliverable regenerated" });
      setRegeneratingDeliverableId(null);
    },
    onError: (err: Error) => {
      toast({ title: "Regeneration failed", description: err.message, variant: "destructive" });
      setRegeneratingDeliverableId(null);
    },
  });

  const handleGenerate = (source: ContentSource) => {
    setGeneratingId(source.sourceId);
    generateMutation.mutate(source);
  };

  const handleUpdateDeliverable = (id: string, data: Record<string, unknown>) => {
    updateDeliverableMutation.mutate({ id, data });
  };

  const handleRegeneratePackage = (id: string) => {
    setRegeneratingPkgId(id);
    regeneratePackageMutation.mutate(id);
  };

  const handleRegenerateDeliverable = (id: string) => {
    setRegeneratingDeliverableId(id);
    regenerateDeliverableMutation.mutate(id);
  };

  const filteredSources = sources?.filter(s => {
    if (!searchTerm) return true;
    return s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.excerpt.toLowerCase().includes(searchTerm.toLowerCase());
  }) || [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold text-lg" data-testid="text-studio-title">Content Studio</h2>
        <p className="text-sm text-muted-foreground">
          Generate complete content packages with social posts, newsletters, Pulse snippets, and video prompts from any content source.
        </p>
      </div>

      <Tabs defaultValue="sources">
        <TabsList>
          <TabsTrigger value="sources" data-testid="tab-sources">
            <Eye className="h-4 w-4 mr-1.5" /> Browse Sources
          </TabsTrigger>
          <TabsTrigger value="packages" data-testid="tab-packages">
            <Package className="h-4 w-4 mr-1.5" /> Packages ({packages?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sources" className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Input
              placeholder="Search content..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-xs"
              data-testid="input-search-sources"
            />
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-40" data-testid="select-source-type">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="article">Articles</SelectItem>
                <SelectItem value="event">Events</SelectItem>
                <SelectItem value="business">Businesses</SelectItem>
                <SelectItem value="post">Pulse Posts</SelectItem>
                <SelectItem value="cms_content">CMS Content</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {sourcesLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          ) : filteredSources.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground" data-testid="text-no-sources">No content sources found</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredSources.map(source => {
                const isGenerating = generatingId === source.sourceId && generateMutation.isPending;
                return (
                  <Card key={`${source.sourceType}-${source.sourceId}`} className="p-4" data-testid={`source-card-${source.sourceId}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" data-testid={`badge-source-${source.sourceId}`}>
                            {SOURCE_TYPE_LABELS[source.sourceType] || source.sourceType}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(source.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        </div>
                        <h3 className="font-medium truncate" data-testid={`text-source-title-${source.sourceId}`}>
                          {source.title}
                        </h3>
                        {source.excerpt && (
                          <p className="text-sm text-muted-foreground line-clamp-2">{source.excerpt}</p>
                        )}
                      </div>
                      {source.imageUrl && !source.imageUrl.startsWith("data:") && (
                        <img
                          src={source.imageUrl}
                          alt=""
                          className="w-16 h-16 rounded object-cover shrink-0"
                        />
                      )}
                      <Button
                        size="sm"
                        onClick={() => handleGenerate(source)}
                        disabled={isGenerating}
                        className="shrink-0"
                        data-testid={`button-generate-${source.sourceId}`}
                      >
                        {isGenerating ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <Sparkles className="h-4 w-4 mr-1" />
                        )}
                        Generate
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="packages" className="space-y-4">
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40" data-testid="select-pkg-status">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {packagesLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full rounded-lg" />
              ))}
            </div>
          ) : !packages || packages.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground" data-testid="text-no-packages">
                No content packages yet. Browse sources and generate your first package.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {packages.map(pkg => (
                <PackageCard
                  key={pkg.id}
                  pkg={pkg}
                  onUpdateDeliverable={handleUpdateDeliverable}
                  onDeletePackage={(id) => deletePackageMutation.mutate(id)}
                  onRegeneratePackage={handleRegeneratePackage}
                  onRegenerateDeliverable={handleRegenerateDeliverable}
                  isUpdating={updateDeliverableMutation.isPending}
                  isRegeneratingPkg={regeneratingPkgId === pkg.id && regeneratePackageMutation.isPending}
                  regeneratingDeliverableId={regeneratingDeliverableId}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
