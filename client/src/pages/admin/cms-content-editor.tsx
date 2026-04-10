import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAdminCitySelection } from "@/hooks/use-city";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Save,
  Send,
  CheckCircle,
  Clock,
  Archive,
  XCircle,
  Image,
  X,
  Tag,
  Link2,
  Trash2,
  Search,
  Building2,
  Calendar,
  MapPin,
  FileText,
  Eye,
  Sparkles,
  Wand2,
  Mail,
  Loader2,
  Package,
} from "lucide-react";
import CmsMediaLibrary from "./cms-media-library";
import { SeoScoreCard } from "@/components/seo-score-card";
import { AeoScoreCard } from "@/components/aeo-score-card";

interface CmsContentItem {
  id: string;
  contentType: string;
  titleEn: string;
  titleEs: string | null;
  slug: string;
  excerptEn: string | null;
  excerptEs: string | null;
  bodyEn: string | null;
  bodyEs: string | null;
  status: string;
  publishAt: string | null;
  unpublishAt: string | null;
  publishedAt: string | null;
  cityId: string;
  seoTitleEn: string | null;
  seoTitleEs: string | null;
  seoDescriptionEn: string | null;
  seoDescriptionEs: string | null;
  longTailKeywords: string[] | null;
  questionsAnswered: string[] | null;
  canonicalUrl: string | null;
  heroImageAssetId: string | null;
  authorId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CmsRevision {
  id: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  actorType: string;
  actorUserId: string | null;
  createdAt: string;
}

interface City {
  id: string;
  name: string;
}

const CONTENT_TYPES = [
  { value: "article", label: "Article" },
  { value: "press_release", label: "Press Release" },
  { value: "shoutout", label: "Shout-out" },
  { value: "media_mention", label: "Media Mention" },
  { value: "digest", label: "Digest" },
  { value: "curated_list", label: "Curated List" },
  { value: "attraction", label: "Attraction" },
  { value: "page", label: "Page" },
];

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  in_review: "outline",
  scheduled: "outline",
  published: "default",
  archived: "destructive",
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toISOString().slice(0, 16);
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function CmsContentEditor({
  itemId,
  onBack,
  cityId,
}: {
  itemId: string | null;
  onBack: () => void;
  cityId?: string;
}) {
  const { toast } = useToast();
  const { selectedCitySlug } = useAdminCitySelection();
  const isEditing = itemId !== null;

  const [titleEn, setTitleEn] = useState("");
  const [titleEs, setTitleEs] = useState("");
  const [slug, setSlug] = useState("");
  const [contentType, setContentType] = useState("article");
  const [excerptEn, setExcerptEn] = useState("");
  const [excerptEs, setExcerptEs] = useState("");
  const [bodyEn, setBodyEn] = useState("");
  const [bodyEs, setBodyEs] = useState("");
  const [seoTitleEn, setSeoTitleEn] = useState("");
  const [seoTitleEs, setSeoTitleEs] = useState("");
  const [seoDescriptionEn, setSeoDescriptionEn] = useState("");
  const [seoDescriptionEs, setSeoDescriptionEs] = useState("");
  const [longTailKeywords, setLongTailKeywords] = useState<string[]>([]);
  const [questionsAnswered, setQuestionsAnswered] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [newQuestion, setNewQuestion] = useState("");
  const [canonicalUrl, setCanonicalUrl] = useState("");
  const [publishAt, setPublishAt] = useState("");
  const [unpublishAt, setUnpublishAt] = useState("");
  const [status, setStatus] = useState("draft");
  const [heroImageAssetId, setHeroImageAssetId] = useState<string | null>(null);
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null);
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [authorId, setAuthorId] = useState<string | null>(null);
  const [aiGenerating, setAiGenerating] = useState<string | null>(null);
  const [showEmailDrafter, setShowEmailDrafter] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");
  const [emailPurpose, setEmailPurpose] = useState("");
  const [emailRecipient, setEmailRecipient] = useState("");
  const [emailContext, setEmailContext] = useState("");
  const [loaded, setLoaded] = useState(false);

  const { data: item, isLoading: itemLoading } = useQuery<CmsContentItem>({
    queryKey: ["/api/admin/cms/content", itemId],
    enabled: isEditing,
  });

  const { data: cities } = useQuery<City[]>({
    queryKey: ["/api/cities"],
    enabled: !isEditing,
  });

  const { data: revisions } = useQuery<CmsRevision[]>({
    queryKey: ["/api/admin/cms/content", itemId, "revisions"],
    enabled: isEditing,
  });

  const { data: heroAsset } = useQuery<{ id: string; fileUrl: string }>({
    queryKey: ["/api/admin/cms/assets", item?.heroImageAssetId],
    enabled: !!item?.heroImageAssetId,
  });

  const resolvedCityIdForAuthors = cityId || item?.cityId || cities?.[0]?.id;
  const { data: authorsList } = useQuery<{ id: string; name: string; photoUrl: string | null; roleTitle: string | null }[]>({
    queryKey: ["/api/admin/authors", { cityId: resolvedCityIdForAuthors }],
    queryFn: () => fetch(`/api/admin/authors?cityId=${encodeURIComponent(resolvedCityIdForAuthors!)}`, { credentials: "include" }).then(r => { if (!r.ok) throw new Error("Failed to fetch authors"); return r.json(); }),
    enabled: !!resolvedCityIdForAuthors,
  });

  useEffect(() => {
    if (heroAsset?.fileUrl) {
      setHeroImageUrl(heroAsset.fileUrl);
    }
  }, [heroAsset]);

  useEffect(() => {
    if (item && !loaded) {
      setTitleEn(item.titleEn || "");
      setTitleEs(item.titleEs || "");
      setSlug(item.slug || "");
      setContentType(item.contentType || "article");
      setExcerptEn(item.excerptEn || "");
      setExcerptEs(item.excerptEs || "");
      setBodyEn(item.bodyEn || "");
      setBodyEs(item.bodyEs || "");
      setSeoTitleEn(item.seoTitleEn || "");
      setSeoTitleEs(item.seoTitleEs || "");
      setSeoDescriptionEn(item.seoDescriptionEn || "");
      setSeoDescriptionEs(item.seoDescriptionEs || "");
      setLongTailKeywords(item.longTailKeywords || []);
      setQuestionsAnswered(item.questionsAnswered || []);
      setCanonicalUrl(item.canonicalUrl || "");
      setPublishAt(formatDateTime(item.publishAt));
      setUnpublishAt(formatDateTime(item.unpublishAt));
      setStatus(item.status || "draft");
      setHeroImageAssetId(item.heroImageAssetId || null);
      setAuthorId(item.authorId || null);
      setLoaded(true);
    }
  }, [item, loaded]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, any> = {
        titleEn,
        titleEs: titleEs || null,
        slug: slug || slugify(titleEn),
        excerptEn: excerptEn || null,
        excerptEs: excerptEs || null,
        bodyEn: bodyEn || null,
        bodyEs: bodyEs || null,
        seoTitleEn: seoTitleEn || null,
        seoTitleEs: seoTitleEs || null,
        seoDescriptionEn: seoDescriptionEn || null,
        seoDescriptionEs: seoDescriptionEs || null,
        longTailKeywords: longTailKeywords.length > 0 ? longTailKeywords : null,
        questionsAnswered: questionsAnswered.length > 0 ? questionsAnswered : null,
        canonicalUrl: canonicalUrl || null,
        heroImageAssetId: heroImageAssetId || null,
        authorId: authorId || null,
        publishAt: publishAt ? new Date(publishAt).toISOString() : null,
        unpublishAt: unpublishAt ? new Date(unpublishAt).toISOString() : null,
      };

      if (isEditing) {
        return apiRequest("PATCH", `/api/admin/cms/content/${itemId}`, payload);
      } else {
        const resolvedCityId = cityId || cities?.[0]?.id;
        if (!resolvedCityId) throw new Error("No city available");
        return apiRequest("POST", "/api/admin/cms/content", {
          ...payload,
          contentType,
          cityId: resolvedCityId,
          status: "draft",
          languagePrimary: "en",
          visibility: "public",
          allowComments: false,
        });
      }
    },
    onSuccess: async (res) => {
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/admin/cms/content") });
      if (isEditing) {
        queryClient.invalidateQueries({
          queryKey: ["/api/admin/cms/content", itemId],
        });
      }
      toast({ title: isEditing ? "Content saved" : "Content created" });
      if (!isEditing) {
        const data = await res.json();
        if (data?.id) {
          onBack();
        }
      }
    },
    onError: (err: any) => {
      toast({
        title: "Error saving content",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleAiStream = async (url: string, payload: Record<string, any>, onChunk: (text: string) => void) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ...payload, citySlug: selectedCitySlug || "" }),
    });
    if (!res.ok) throw new Error("AI request failed");
    const reader = res.body?.getReader();
    if (!reader) throw new Error("No reader");
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.content) onChunk(data.content);
          } catch {}
        }
      }
    }
  };

  const handleAiCompose = async (action: "generate" | "improve" | "excerpt") => {
    setAiGenerating(action);
    try {
      let result = "";
      await handleAiStream("/api/admin/ai/compose", {
        action,
        title: titleEn,
        excerpt: excerptEn,
        body: bodyEn,
        contentType,
      }, (chunk) => {
        result += chunk;
      });
      if (action === "excerpt") {
        setExcerptEn(result);
        toast({ title: "Excerpt generated" });
      } else {
        setBodyEn(result);
        toast({ title: action === "generate" ? "Content generated" : "Content improved" });
      }
    } catch (err: any) {
      toast({ title: "AI Error", description: err.message, variant: "destructive" });
    } finally {
      setAiGenerating(null);
    }
  };

  const handleAiSeo = async () => {
    setAiGenerating("seo");
    try {
      const res = await fetch("/api/admin/ai/seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: titleEn, excerpt: excerptEn, body: bodyEn, contentType, citySlug: selectedCitySlug || "" }),
      });
      if (!res.ok) throw new Error("Failed to generate SEO");
      const data = await res.json();
      if (data.seoTitle) setSeoTitleEn(data.seoTitle);
      if (data.seoDescription) setSeoDescriptionEn(data.seoDescription);
      toast({ title: "SEO metadata generated" });
    } catch (err: any) {
      toast({ title: "AI Error", description: err.message, variant: "destructive" });
    } finally {
      setAiGenerating(null);
    }
  };

  const handleAiDraftEmail = async () => {
    setAiGenerating("email");
    try {
      let result = "";
      await handleAiStream("/api/admin/ai/draft-email", {
        purpose: emailPurpose,
        recipientName: emailRecipient,
        context: emailContext,
      }, (chunk) => {
        result += chunk;
      });
      setEmailDraft(result);
    } catch (err: any) {
      toast({ title: "AI Error", description: err.message, variant: "destructive" });
    } finally {
      setAiGenerating(null);
    }
  };

  const generatePackageMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/content-studio/generate-for-cms/${itemId}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Content package generated", description: "A full content output package has been created in Content Studio" });
    },
    onError: (err: any) => {
      toast({ title: "Package generation failed", description: err.message, variant: "destructive" });
    },
  });

  const transitionMutation = useMutation({
    mutationFn: async (action: string) => {
      return apiRequest(
        "POST",
        `/api/admin/cms/content/${itemId}/transition`,
        { action }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/cms/content", itemId],
      });
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/admin/cms/content") });
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/cms/content", itemId, "revisions"],
      });
      toast({ title: "Status updated" });
      setLoaded(false);
    },
    onError: (err: any) => {
      toast({
        title: "Transition failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  if (isEditing && itemLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const currentStatus = isEditing ? item?.status || status : "draft";

  return (
    <div className="space-y-4" data-testid="cms-content-editor">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            data-testid="button-back"
          >
            <ArrowLeft />
          </Button>
          <h2
            className="text-lg font-semibold"
            data-testid="text-editor-title"
          >
            {isEditing ? "Edit Content" : "New Content"}
          </h2>
          {isEditing && (
            <Badge
              variant={STATUS_VARIANT[currentStatus] || "secondary"}
              data-testid="badge-status"
            >
              {statusLabel(currentStatus)}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(true)}
            disabled={!titleEn}
            data-testid="button-preview"
          >
            <FileText className="h-4 w-4 mr-1" />
            Preview
          </Button>
          {isEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => generatePackageMutation.mutate()}
              disabled={generatePackageMutation.isPending || !titleEn}
              data-testid="button-generate-content-package"
            >
              {generatePackageMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Package className="h-4 w-4 mr-1" />
              )}
              Generate Content Package
            </Button>
          )}
          {(currentStatus === "draft" || !isEditing) && (
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !titleEn}
              data-testid="button-save-draft"
            >
              <Save className="h-4 w-4 mr-1" />
              {saveMutation.isPending ? "Saving..." : "Save Draft"}
            </Button>
          )}
          {isEditing && currentStatus === "draft" && (
            <Button
              variant="outline"
              onClick={() => transitionMutation.mutate("submit_for_review")}
              disabled={transitionMutation.isPending}
              data-testid="button-submit-review"
            >
              <Send className="h-4 w-4 mr-1" />
              Submit for Review
            </Button>
          )}
          {isEditing && currentStatus === "in_review" && (
            <>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !titleEn}
                data-testid="button-save-changes"
              >
                <Save className="h-4 w-4 mr-1" />
                Save Changes
              </Button>
              <Button
                onClick={() => transitionMutation.mutate("approve")}
                disabled={transitionMutation.isPending}
                data-testid="button-approve-publish"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Approve & Publish
              </Button>
              <Button
                variant="outline"
                onClick={() => transitionMutation.mutate("schedule")}
                disabled={transitionMutation.isPending}
                data-testid="button-schedule"
              >
                <Clock className="h-4 w-4 mr-1" />
                Schedule
              </Button>
              <Button
                variant="outline"
                onClick={() => transitionMutation.mutate("reject")}
                disabled={transitionMutation.isPending}
                data-testid="button-reject"
              >
                <XCircle className="h-4 w-4 mr-1" />
                Reject
              </Button>
            </>
          )}
          {isEditing && currentStatus === "scheduled" && (
            <Button
              variant="outline"
              onClick={() => transitionMutation.mutate("unpublish")}
              disabled={transitionMutation.isPending}
              data-testid="button-unpublish"
            >
              <XCircle className="h-4 w-4 mr-1" />
              Unpublish
            </Button>
          )}
          {isEditing && currentStatus === "published" && (
            <>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !titleEn}
                data-testid="button-save-published"
              >
                <Save className="h-4 w-4 mr-1" />
                Save Changes
              </Button>
              <Button
                variant="outline"
                onClick={() => transitionMutation.mutate("unpublish")}
                disabled={transitionMutation.isPending}
                data-testid="button-unpublish"
              >
                <XCircle className="h-4 w-4 mr-1" />
                Unpublish
              </Button>
              <Button
                variant="outline"
                onClick={() => transitionMutation.mutate("archive")}
                disabled={transitionMutation.isPending}
                data-testid="button-archive"
              >
                <Archive className="h-4 w-4 mr-1" />
                Archive
              </Button>
            </>
          )}
          {isEditing && currentStatus === "archived" && (
            <Button
              variant="outline"
              onClick={() => transitionMutation.mutate("reject")}
              disabled={transitionMutation.isPending}
              data-testid="button-restore-draft"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Draft
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="content" data-testid="tabs-editor">
        <TabsList data-testid="tabs-list">
          <TabsTrigger value="content" data-testid="tab-content">
            Content
          </TabsTrigger>
          <TabsTrigger value="seo" data-testid="tab-seo">
            SEO
          </TabsTrigger>
          <TabsTrigger value="schedule" data-testid="tab-schedule">
            Schedule
          </TabsTrigger>
          {isEditing && (
            <TabsTrigger value="revisions" data-testid="tab-revisions">
              Revisions
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="content" className="space-y-4 mt-4">
          <Card className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Title (EN)</label>
                <Input
                  value={titleEn}
                  onChange={(e) => {
                    setTitleEn(e.target.value);
                    if (!isEditing && !slug) {
                      setSlug(slugify(e.target.value));
                    }
                  }}
                  placeholder="English title"
                  data-testid="input-title-en"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Title (ES)</label>
                <Input
                  value={titleEs}
                  onChange={(e) => setTitleEs(e.target.value)}
                  placeholder="Spanish title"
                  data-testid="input-title-es"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Slug</label>
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="auto-generated-from-title"
                  data-testid="input-slug"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Content Type</label>
                <Select
                  value={contentType}
                  onValueChange={setContentType}
                  disabled={isEditing}
                >
                  <SelectTrigger data-testid="select-content-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTENT_TYPES.map((ct) => (
                      <SelectItem
                        key={ct.value}
                        value={ct.value}
                        data-testid={`select-content-type-${ct.value}`}
                      >
                        {ct.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Excerpt (EN)</label>
                <Textarea
                  value={excerptEn}
                  onChange={(e) => setExcerptEn(e.target.value)}
                  placeholder="English excerpt"
                  rows={3}
                  data-testid="input-excerpt-en"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Excerpt (ES)</label>
                <Textarea
                  value={excerptEs}
                  onChange={(e) => setExcerptEs(e.target.value)}
                  placeholder="Spanish excerpt"
                  rows={3}
                  data-testid="input-excerpt-es"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Hero Image</label>
              <div className="flex items-center gap-3">
                {heroImageAssetId && heroImageUrl ? (
                  <div className="relative w-32 h-20 rounded overflow-hidden border">
                    <img src={heroImageUrl} alt="Hero" className="w-full h-full object-cover" />
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute top-1 right-1 h-5 w-5"
                      onClick={() => { setHeroImageAssetId(null); setHeroImageUrl(null); }}
                      data-testid="button-remove-hero"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="w-32 h-20 rounded border border-dashed flex items-center justify-center text-muted-foreground">
                    <Image className="w-6 h-6" />
                  </div>
                )}
                <Button variant="outline" onClick={() => setShowAssetPicker(true)} data-testid="button-pick-hero">
                  {heroImageAssetId ? "Change Image" : "Select Image"}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Author</label>
              <div className="flex items-center gap-3">
                {authorId && authorsList ? (
                  (() => {
                    const author = authorsList.find((a) => a.id === authorId);
                    if (!author) return null;
                    return (
                      <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2" data-testid="selected-author">
                        {author.photoUrl ? (
                          <img src={author.photoUrl} alt={author.name} className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                            {author.name.charAt(0)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{author.name}</p>
                          {author.roleTitle && <p className="text-xs text-muted-foreground">{author.roleTitle}</p>}
                        </div>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setAuthorId(null)} data-testid="button-remove-author">
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    );
                  })()
                ) : (
                  <Select value={authorId || ""} onValueChange={(val) => setAuthorId(val || null)}>
                    <SelectTrigger className="w-full" data-testid="select-author">
                      <SelectValue placeholder="Select an author..." />
                    </SelectTrigger>
                    <SelectContent>
                      {authorsList?.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          <span className="flex items-center gap-2">
                            {a.photoUrl ? (
                              <img src={a.photoUrl} alt="" className="w-5 h-5 rounded-full object-cover inline-block" />
                            ) : (
                              <span className="w-5 h-5 rounded-full bg-primary/10 inline-flex items-center justify-center text-primary text-[10px] font-bold">
                                {a.name.charAt(0)}
                              </span>
                            )}
                            {a.name}
                            {a.roleTitle && <span className="text-muted-foreground text-xs ml-1">({a.roleTitle})</span>}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <div className="bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/20 dark:to-indigo-950/20 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                <span className="text-sm font-medium text-violet-900 dark:text-violet-300">Charlotte AI</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs bg-white dark:bg-background"
                  disabled={!!aiGenerating || !titleEn}
                  onClick={() => handleAiCompose("generate")}
                  data-testid="button-ai-generate"
                >
                  {aiGenerating === "generate" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                  Generate Content
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs bg-white dark:bg-background"
                  disabled={!!aiGenerating || !bodyEn}
                  onClick={() => handleAiCompose("improve")}
                  data-testid="button-ai-improve"
                >
                  {aiGenerating === "improve" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Improve Content
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs bg-white dark:bg-background"
                  disabled={!!aiGenerating || !bodyEn}
                  onClick={() => handleAiCompose("excerpt")}
                  data-testid="button-ai-excerpt"
                >
                  {aiGenerating === "excerpt" ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
                  Generate Excerpt
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs bg-white dark:bg-background"
                  disabled={!!aiGenerating || !titleEn}
                  onClick={handleAiSeo}
                  data-testid="button-ai-seo"
                >
                  {aiGenerating === "seo" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                  Auto SEO
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs bg-white dark:bg-background"
                  disabled={!!aiGenerating}
                  onClick={() => setShowEmailDrafter(true)}
                  data-testid="button-ai-email"
                >
                  <Mail className="h-3 w-3" />
                  Draft Email
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Body (EN)</label>
                <Textarea
                  value={bodyEn}
                  onChange={(e) => setBodyEn(e.target.value)}
                  placeholder="English body content"
                  rows={12}
                  data-testid="input-body-en"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Body (ES)</label>
                <Textarea
                  value={bodyEs}
                  onChange={(e) => setBodyEs(e.target.value)}
                  placeholder="Spanish body content"
                  rows={12}
                  data-testid="input-body-es"
                />
              </div>
            </div>
          </Card>

          {isEditing && (
            <Card className="p-4 space-y-3">
              <label className="text-sm font-medium">Tags</label>
              <TagPicker contentItemId={itemId!} />
            </Card>
          )}

          {isEditing && (
            <Card className="p-4 space-y-3">
              <label className="text-sm font-medium">Related Items</label>
              <RelationsPicker contentItemId={itemId!} />
            </Card>
          )}
        </TabsContent>

        <TabsContent value="seo" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SeoScoreCard
              input={{
                title: seoTitleEn || titleEn,
                metaDescription: seoDescriptionEn,
                content: bodyEn,
                slug: slug,
                cityKeyword: "Charlotte",
              }}
            />
            <AeoScoreCard
              input={{
                title: seoTitleEn || titleEn,
                metaDescription: seoDescriptionEn,
                content: bodyEn,
                slug: slug,
              }}
            />
          </div>
          <Card className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">SEO Title (EN) <span className="text-muted-foreground text-xs">({seoTitleEn.length}/60)</span></label>
                <Input
                  value={seoTitleEn}
                  onChange={(e) => setSeoTitleEn(e.target.value)}
                  placeholder="SEO title in English"
                  data-testid="input-seo-title-en"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">SEO Title (ES)</label>
                <Input
                  value={seoTitleEs}
                  onChange={(e) => setSeoTitleEs(e.target.value)}
                  placeholder="SEO title in Spanish"
                  data-testid="input-seo-title-es"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">SEO Description (EN) <span className="text-muted-foreground text-xs">({seoDescriptionEn.length}/160)</span></label>
                <Textarea
                  value={seoDescriptionEn}
                  onChange={(e) => setSeoDescriptionEn(e.target.value)}
                  placeholder="SEO description in English"
                  rows={3}
                  data-testid="input-seo-description-en"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">SEO Description (ES)</label>
                <Textarea
                  value={seoDescriptionEs}
                  onChange={(e) => setSeoDescriptionEs(e.target.value)}
                  placeholder="SEO description in Spanish"
                  rows={3}
                  data-testid="input-seo-description-es"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Canonical URL</label>
              <Input
                value={canonicalUrl}
                onChange={(e) => setCanonicalUrl(e.target.value)}
                placeholder="https://..."
                data-testid="input-canonical-url"
              />
            </div>
          </Card>

          <Card className="p-4 space-y-4">
            <div>
              <label className="text-sm font-medium">Long-Tail Keywords</label>
              <p className="text-xs text-muted-foreground mb-2">Natural phrases people search for, e.g. "best family brunch spots in South End Charlotte"</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {longTailKeywords.map((kw, i) => (
                  <Badge key={i} variant="secondary" className="gap-1 text-xs" data-testid={`badge-keyword-${i}`}>
                    {kw}
                    <button onClick={() => setLongTailKeywords(longTailKeywords.filter((_, j) => j !== i))} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  placeholder="Add a long-tail keyword phrase..."
                  className="flex-1 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newKeyword.trim()) {
                      e.preventDefault();
                      setLongTailKeywords([...longTailKeywords, newKeyword.trim()]);
                      setNewKeyword("");
                    }
                  }}
                  data-testid="input-new-keyword"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (newKeyword.trim()) {
                      setLongTailKeywords([...longTailKeywords, newKeyword.trim()]);
                      setNewKeyword("");
                    }
                  }}
                  data-testid="button-add-keyword"
                >Add</Button>
              </div>
            </div>
          </Card>

          <Card className="p-4 space-y-4">
            <div>
              <label className="text-sm font-medium">Questions This Content Answers</label>
              <p className="text-xs text-muted-foreground mb-2">Natural questions AI search pulls from, e.g. "Where can I find live music in NoDa on weekends?"</p>
              <div className="space-y-1.5 mb-2">
                {questionsAnswered.map((q, i) => (
                  <div key={i} className="flex items-center gap-2 bg-muted/50 rounded px-2.5 py-1.5" data-testid={`question-${i}`}>
                    <span className="text-xs flex-1">{q}</span>
                    <button onClick={() => setQuestionsAnswered(questionsAnswered.filter((_, j) => j !== i))} className="hover:text-destructive shrink-0">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="Add a question this content answers..."
                  className="flex-1 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newQuestion.trim()) {
                      e.preventDefault();
                      setQuestionsAnswered([...questionsAnswered, newQuestion.trim()]);
                      setNewQuestion("");
                    }
                  }}
                  data-testid="input-new-question"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (newQuestion.trim()) {
                      setQuestionsAnswered([...questionsAnswered, newQuestion.trim()]);
                      setNewQuestion("");
                    }
                  }}
                  data-testid="button-add-question"
                >Add</Button>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="schedule" className="space-y-4 mt-4">
          <Card className="p-4 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">Current Status:</span>
              <Badge
                variant={STATUS_VARIANT[currentStatus] || "secondary"}
                data-testid="badge-schedule-status"
              >
                {statusLabel(currentStatus)}
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Publish At</label>
                <Input
                  type="datetime-local"
                  value={publishAt}
                  onChange={(e) => setPublishAt(e.target.value)}
                  data-testid="input-publish-at"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Unpublish At</label>
                <Input
                  type="datetime-local"
                  value={unpublishAt}
                  onChange={(e) => setUnpublishAt(e.target.value)}
                  data-testid="input-unpublish-at"
                />
              </div>
            </div>
            {item?.publishedAt && (
              <p
                className="text-sm text-muted-foreground"
                data-testid="text-published-at"
              >
                Published at:{" "}
                {new Date(item.publishedAt).toLocaleString()}
              </p>
            )}
          </Card>
        </TabsContent>

        {isEditing && (
          <TabsContent value="revisions" className="space-y-4 mt-4">
            <Card className="p-4">
              {!revisions || revisions.length === 0 ? (
                <p
                  className="text-sm text-muted-foreground text-center py-6"
                  data-testid="text-no-revisions"
                >
                  No revisions yet
                </p>
              ) : (
                <div className="space-y-3" data-testid="revisions-list">
                  {revisions.map((rev) => (
                    <div
                      key={rev.id}
                      className="border-b last:border-b-0 pb-3 last:pb-0"
                      data-testid={`revision-${rev.id}`}
                    >
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs text-muted-foreground">
                          {new Date(rev.createdAt).toLocaleString()}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {rev.fieldName}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {rev.actorType}
                          {rev.actorUserId ? ` (${rev.actorUserId.slice(0, 8)})` : ""}
                        </Badge>
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground line-through">
                          {rev.oldValue || "(empty)"}
                        </span>
                        <span className="mx-2 text-muted-foreground">&rarr;</span>
                        <span>{rev.newValue || "(empty)"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={showAssetPicker} onOpenChange={setShowAssetPicker}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Hero Image</DialogTitle>
            <DialogDescription>Choose an image from the media library or upload a new one.</DialogDescription>
          </DialogHeader>
          <CmsMediaLibrary
            mode="picker"
            onSelect={(asset) => {
              setHeroImageAssetId(asset.id);
              setHeroImageUrl(asset.fileUrl);
              setShowAssetPicker(false);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Content Preview
            </DialogTitle>
            <DialogDescription>Preview how this content will appear when published.</DialogDescription>
          </DialogHeader>
          <ContentPreview
            title={titleEn}
            subtitle={titleEs}
            body={bodyEn}
            bodyEs={bodyEs}
            excerpt={excerptEn}
            contentType={contentType}
            heroImageUrl={heroImageUrl}
            status={currentStatus}
            publishAt={publishAt}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showEmailDrafter} onOpenChange={(open) => { setShowEmailDrafter(open); if (!open) { setEmailDraft(""); setEmailPurpose(""); setEmailRecipient(""); setEmailContext(""); } }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-violet-600" />
              Charlotte AI Email Drafter
            </DialogTitle>
            <DialogDescription>Generate a professional email draft for outreach or notifications.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Purpose</Label>
              <Select value={emailPurpose} onValueChange={setEmailPurpose}>
                <SelectTrigger data-testid="select-email-purpose">
                  <SelectValue placeholder="Select email purpose..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="claim_followup">Claim Follow-up</SelectItem>
                  <SelectItem value="listing_upgrade">Listing Upgrade Pitch</SelectItem>
                  <SelectItem value="event_promotion">Event Promotion</SelectItem>
                  <SelectItem value="welcome">Welcome / Onboarding</SelectItem>
                  <SelectItem value="review_request">Review Request</SelectItem>
                  <SelectItem value="partnership">Partnership Outreach</SelectItem>
                  <SelectItem value="content_pitch">Content / Article Pitch</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Recipient Name</Label>
              <Input value={emailRecipient} onChange={(e) => setEmailRecipient(e.target.value)} placeholder="e.g. John Smith" data-testid="input-email-recipient" />
            </div>
            <div className="space-y-1.5">
              <Label>Additional Context</Label>
              <Textarea value={emailContext} onChange={(e) => setEmailContext(e.target.value)} placeholder="Any specific details for the email..." rows={3} data-testid="input-email-context" />
            </div>
            <Button
              onClick={handleAiDraftEmail}
              disabled={!emailPurpose || !!aiGenerating}
              className="gap-1.5"
              data-testid="button-generate-email"
            >
              {aiGenerating === "email" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate Draft
            </Button>
            {emailDraft && (
              <div className="space-y-2">
                <Label>Generated Email</Label>
                <Textarea value={emailDraft} onChange={(e) => setEmailDraft(e.target.value)} rows={12} className="font-mono text-sm" data-testid="textarea-email-draft" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { navigator.clipboard.writeText(emailDraft); toast({ title: "Email copied to clipboard" }); }}
                  data-testid="button-copy-email"
                >
                  Copy to Clipboard
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ContentPreview({
  title,
  subtitle,
  body,
  bodyEs,
  excerpt,
  contentType,
  heroImageUrl,
  status,
  publishAt,
}: {
  title: string;
  subtitle: string;
  body: string;
  bodyEs: string;
  excerpt: string;
  contentType: string;
  heroImageUrl: string | null;
  status: string;
  publishAt: string;
}) {
  return (
    <div className="space-y-4" data-testid="content-preview">
      <div className="flex items-center gap-2 text-xs text-muted-foreground border-b pb-2">
        <Badge variant="outline">{contentType}</Badge>
        <Badge variant={status === "published" ? "default" : "secondary"}>{status}</Badge>
        {publishAt && <span>Scheduled: {new Date(publishAt).toLocaleString()}</span>}
      </div>

      {heroImageUrl && (
        <div className="rounded-lg overflow-hidden border">
          <img
            src={heroImageUrl}
            alt="Hero"
            className="w-full h-48 object-cover"
            data-testid="img-preview-hero"
          />
        </div>
      )}

      <h1 className="text-2xl font-bold" data-testid="text-preview-title">{title || "Untitled"}</h1>

      {subtitle && (
        <p className="text-sm text-muted-foreground italic" data-testid="text-preview-subtitle">
          {subtitle}
        </p>
      )}

      {excerpt && (
        <div className="bg-muted/30 rounded p-3 border border-primary/20">
          <p className="text-sm font-medium text-muted-foreground mb-1">Excerpt</p>
          <p className="text-sm" data-testid="text-preview-excerpt">{excerpt}</p>
        </div>
      )}

      <div className="prose prose-sm max-w-none dark:prose-invert" data-testid="text-preview-body">
        {body ? body.split("\n").map((line, i) => (
          <p key={i}>{line || <br />}</p>
        )) : <p className="text-muted-foreground italic">No content yet.</p>}
      </div>

      {bodyEs && (
        <div className="border-t pt-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">Spanish Version</p>
          <div className="prose prose-sm max-w-none dark:prose-invert" data-testid="text-preview-body-es">
            {bodyEs.split("\n").map((line, i) => (
              <p key={i}>{line || <br />}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const RELATION_TYPES = [
  { value: "presence", label: "Business", icon: Building2 },
  { value: "event", label: "Event", icon: Calendar },
  { value: "zone", label: "Zone", icon: MapPin },
];

function RelationsPicker({ contentItemId }: { contentItemId: string }) {
  const { toast } = useToast();
  const [relationType, setRelationType] = useState("presence");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; name: string }[]>([]);
  const [searching, setSearching] = useState(false);

  const { data: relations, isLoading } = useQuery<{ id: string; relationType: string; relatedId: string; createdAt: string }[]>({
    queryKey: ["/api/admin/cms/content", contentItemId, "relations"],
  });

  const addMutation = useMutation({
    mutationFn: async (data: { relationType: string; relatedId: string }) => {
      return apiRequest("POST", `/api/admin/cms/content/${contentItemId}/relations`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cms/content", contentItemId, "relations"] });
      setSearchResults([]);
      setSearchTerm("");
      toast({ title: "Relation added" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to add relation", description: err.message, variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/cms/relations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cms/content", contentItemId, "relations"] });
      toast({ title: "Relation removed" });
    },
  });

  async function doSearch() {
    if (!searchTerm.trim()) return;
    setSearching(true);
    try {
      let endpoint = "";
      if (relationType === "presence") {
        endpoint = `/api/admin/businesses?search=${encodeURIComponent(searchTerm)}&limit=10`;
      } else if (relationType === "event") {
        endpoint = `/api/admin/events?search=${encodeURIComponent(searchTerm)}&limit=10`;
      } else if (relationType === "zone") {
        endpoint = `/api/admin/zones?search=${encodeURIComponent(searchTerm)}&limit=10`;
      }
      const res = await fetch(endpoint, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data) ? data : data.items || data.businesses || data.events || [];
        setSearchResults(items.map((i: any) => ({ id: i.id, name: i.name || i.title || i.titleEn || "Unknown" })));
      }
    } catch {
      setSearchResults([]);
    }
    setSearching(false);
  }

  if (isLoading) return <Skeleton className="h-8 w-full" />;

  const RelIcon = RELATION_TYPES.find(r => r.value === relationType)?.icon || Link2;

  return (
    <div className="space-y-3" data-testid="relations-picker">
      {relations && relations.length > 0 && (
        <div className="space-y-1">
          {relations.map((rel) => (
            <div key={rel.id} className="flex items-center justify-between text-sm p-2 rounded bg-muted/50" data-testid={`relation-${rel.id}`}>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">{rel.relationType}</Badge>
                <span className="font-mono text-xs text-muted-foreground">{rel.relatedId.slice(0, 12)}...</span>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-destructive"
                onClick={() => removeMutation.mutate(rel.id)}
                data-testid={`button-remove-relation-${rel.id}`}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Type</Label>
          <Select value={relationType} onValueChange={setRelationType}>
            <SelectTrigger className="w-[120px] h-8" data-testid="select-relation-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RELATION_TYPES.map(rt => (
                <SelectItem key={rt.value} value={rt.value}>{rt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 space-y-1">
          <Label className="text-xs">Search</Label>
          <div className="flex gap-1">
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Search ${relationType}s...`}
              className="h-8"
              onKeyDown={(e) => e.key === "Enter" && doSearch()}
              data-testid="input-relation-search"
            />
            <Button size="sm" variant="outline" className="h-8" onClick={doSearch} disabled={searching} data-testid="button-relation-search">
              <Search className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>

      {searchResults.length > 0 && (
        <div className="border rounded p-2 space-y-1 max-h-40 overflow-y-auto">
          {searchResults.map((result) => (
            <div
              key={result.id}
              className="flex items-center justify-between text-sm p-1.5 hover:bg-muted rounded cursor-pointer"
              onClick={() => addMutation.mutate({ relationType, relatedId: result.id })}
              data-testid={`result-relation-${result.id}`}
            >
              <span>{result.name}</span>
              <Badge variant="secondary" className="text-[10px]">Add</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TagPicker({ contentItemId }: { contentItemId: string }) {
  const { toast } = useToast();

  const { data: allTags } = useQuery<{ id: string; name: string; slug: string }[]>({
    queryKey: ["/api/admin/cms/tags"],
  });

  const { data: assignedIds, isLoading } = useQuery<string[]>({
    queryKey: ["/api/admin/cms/content", contentItemId, "tags"],
  });

  const assignMutation = useMutation({
    mutationFn: async (tagIds: string[]) => {
      return apiRequest("PUT", `/api/admin/cms/content/${contentItemId}/tags`, { tagIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cms/content", contentItemId, "tags"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to update tags", description: err.message, variant: "destructive" });
    },
  });

  const assigned = new Set(assignedIds || []);

  function toggle(tagId: string) {
    const next = new Set(assigned);
    if (next.has(tagId)) next.delete(tagId);
    else next.add(tagId);
    assignMutation.mutate(Array.from(next));
  }

  if (isLoading) return <Skeleton className="h-8 w-full" />;

  return (
    <div className="flex flex-wrap gap-2" data-testid="tag-picker">
      {allTags?.map((tag) => (
        <Badge
          key={tag.id}
          variant={assigned.has(tag.id) ? "default" : "outline"}
          className="cursor-pointer select-none"
          onClick={() => toggle(tag.id)}
          data-testid={`tag-toggle-${tag.id}`}
        >
          <Tag className="w-3 h-3 mr-1" />
          {tag.name}
        </Badge>
      ))}
      {(!allTags || allTags.length === 0) && (
        <p className="text-xs text-muted-foreground">No tags available. Create tags in the Tags section first.</p>
      )}
    </div>
  );
}
