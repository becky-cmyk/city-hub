import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Search,
  Archive,
  SendHorizonal,
  Sparkles,
  Loader2,
  ArrowLeft,
  Save,
  Send,
  Tag,
  Leaf,
  Clock,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SeoScoreCard } from "@/components/seo-score-card";
import { AeoScoreCard } from "@/components/aeo-score-card";

interface CmsContentItem {
  id: string;
  contentType: string;
  titleEn: string;
  slug: string;
  status: string;
  publishAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
  assignedEditorUserId: string | null;
  assignedReviewerUserId: string | null;
}

interface FaqPair {
  question: string;
  answer: string;
}

interface PolishResult {
  parsedTitle: string;
  body: string;
  seoTitle: string;
  metaDescription: string;
  slug: string;
  excerpt: string;
  tags: string[];
  faqPairs: FaqPair[];
  isEvergreen: boolean;
  evergreenReason: string;
}

const CONTENT_TYPE_LABELS: Record<string, string> = {
  article: "Article",
  press_release: "Press Release",
  shoutout: "Shout-out",
  media_mention: "Media Mention",
  digest: "Digest",
  curated_list: "Curated List",
  attraction: "Attraction",
  page: "Page",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  in_review: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  published: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  archived: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const PAGE_SIZE = 25;

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString();
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function PastePolishView({
  cityId,
  onBack,
  onSelectItem,
}: {
  cityId?: string;
  onBack: () => void;
  onSelectItem: (id: string) => void;
}) {
  const { toast } = useToast();
  const [rawText, setRawText] = useState("");
  const [polishResult, setPolishResult] = useState<PolishResult | null>(null);

  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editSeoTitle, setEditSeoTitle] = useState("");
  const [editMetaDescription, setEditMetaDescription] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editExcerpt, setEditExcerpt] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editFaqPairs, setEditFaqPairs] = useState<FaqPair[]>([]);
  const [editIsEvergreen, setEditIsEvergreen] = useState(false);
  const [editEvergreenReason, setEditEvergreenReason] = useState("");
  const [newTag, setNewTag] = useState("");

  const polishMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await apiRequest("POST", "/api/admin/cms/charlotte-polish", { rawText: text });
      return res.json() as Promise<PolishResult>;
    },
    onSuccess: (data) => {
      setPolishResult(data);
      setEditTitle(data.parsedTitle);
      setEditBody(data.body);
      setEditSeoTitle(data.seoTitle);
      setEditMetaDescription(data.metaDescription);
      setEditSlug(data.slug);
      setEditExcerpt(data.excerpt);
      setEditTags(data.tags);
      setEditFaqPairs(data.faqPairs);
      setEditIsEvergreen(data.isEvergreen);
      setEditEvergreenReason(data.evergreenReason);
      toast({ title: "Charlotte has polished your article" });
    },
    onError: (err: Error) => {
      toast({ title: "Polish failed", description: err.message, variant: "destructive" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (publishNow: boolean) => {
      if (!cityId) throw new Error("No city selected. Please select a city first.");

      const validFaqs = editFaqPairs.filter(f => f.question.trim() && f.answer.trim());
      const faqQuestions = validFaqs.map(f => `${f.question} — ${f.answer}`);

      const allKeywords = [...editTags];
      if (editIsEvergreen) {
        allKeywords.push("evergreen");
      }
      if (editEvergreenReason.trim()) {
        allKeywords.push(`evergreen-reason:${editEvergreenReason.trim()}`);
      }

      const payload = {
        contentType: "article" as const,
        titleEn: editTitle,
        slug: editSlug || editTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        excerptEn: editExcerpt || null,
        bodyEn: editBody,
        seoTitleEn: editSeoTitle || null,
        seoDescriptionEn: editMetaDescription || null,
        longTailKeywords: allKeywords.length > 0 ? allKeywords : null,
        questionsAnswered: faqQuestions.length > 0 ? faqQuestions : null,
        status: "draft" as const,
        cityId,
        languagePrimary: "en" as const,
        visibility: "public" as const,
        allowComments: false,
      };

      const createRes = await apiRequest("POST", "/api/admin/cms/content", payload);
      const created = await createRes.json();

      if (publishNow && created?.id) {
        await apiRequest("POST", `/api/admin/cms/content/${created.id}/transition`, {
          action: "publish",
        });
      }

      return created;
    },
    onSuccess: (data, publishNow) => {
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/admin/cms/content") });
      toast({ title: publishNow ? "Article published" : "Article saved as draft" });
      if (data?.id) {
        onSelectItem(data.id);
      } else {
        onBack();
      }
    },
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  function addTag() {
    const tag = newTag.trim().toLowerCase();
    if (tag && !editTags.includes(tag)) {
      setEditTags([...editTags, tag]);
    }
    setNewTag("");
  }

  function removeTag(t: string) {
    setEditTags(editTags.filter(tag => tag !== t));
  }

  function updateFaq(index: number, field: "question" | "answer", value: string) {
    const updated = [...editFaqPairs];
    updated[index] = { ...updated[index], [field]: value };
    setEditFaqPairs(updated);
  }

  function removeFaq(index: number) {
    setEditFaqPairs(editFaqPairs.filter((_, i) => i !== index));
  }

  function addFaq() {
    setEditFaqPairs([...editFaqPairs, { question: "", answer: "" }]);
  }

  if (!polishResult) {
    return (
      <div className="space-y-4" data-testid="paste-polish-intake">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-polish-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="font-semibold text-lg" data-testid="text-polish-title">Paste & Polish</h2>
            <p className="text-sm text-muted-foreground">Paste your complete article below — title and body together — and Charlotte will generate all the publishing metadata.</p>
          </div>
        </div>

        <Card className="p-4 space-y-4">
          <Textarea
            placeholder="Paste your full article here (title + body in one paste)..."
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={20}
            className="font-mono text-sm"
            data-testid="textarea-raw-article"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground" data-testid="text-char-count">
              {rawText.length} characters / ~{rawText.split(/\s+/).filter(Boolean).length} words
            </span>
            <Button
              onClick={() => polishMutation.mutate(rawText)}
              disabled={rawText.length < 10 || polishMutation.isPending}
              data-testid="button-send-to-charlotte"
            >
              {polishMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              {polishMutation.isPending ? "Charlotte is working..." : "Send to Charlotte"}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const faqContentForScoring = editFaqPairs.filter(f => f.question.trim() && f.answer.trim()).length > 0
    ? "\n\n" + editFaqPairs.filter(f => f.question.trim() && f.answer.trim()).map(f => `**Q: ${f.question}**\nA: ${f.answer}`).join("\n\n")
    : "";
  const bodyForScoring = editBody + faqContentForScoring;

  return (
    <div className="space-y-4" data-testid="paste-polish-review">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-review-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="font-semibold text-lg" data-testid="text-review-title">Review & Publish</h2>
          <Badge variant="secondary" data-testid="badge-evergreen">
            {editIsEvergreen ? (
              <><Leaf className="h-3 w-3 mr-1" /> Evergreen</>
            ) : (
              <><Clock className="h-3 w-3 mr-1" /> Time-sensitive</>
            )}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => saveMutation.mutate(false)}
            disabled={saveMutation.isPending || !editTitle}
            data-testid="button-save-draft"
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Save as Draft
          </Button>
          <Button
            onClick={() => saveMutation.mutate(true)}
            disabled={saveMutation.isPending || !editTitle}
            data-testid="button-publish"
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
            Publish
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-4 space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Title</Label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="text-lg font-semibold"
                data-testid="input-edit-title"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Article Body (original, preserved verbatim)</Label>
              <div
                className="rounded-md border bg-muted/30 p-3 font-mono text-sm whitespace-pre-wrap max-h-[400px] overflow-y-auto"
                data-testid="text-edit-body"
              >
                {editBody}
              </div>
              <p className="text-xs text-muted-foreground mt-1" data-testid="text-body-word-count">
                {editBody.split(/\s+/).filter(Boolean).length} words
              </p>
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <h3 className="font-medium text-sm">SEO Metadata</h3>
            <div>
              <Label className="text-xs text-muted-foreground">SEO Title ({editSeoTitle.length} chars)</Label>
              <Input
                value={editSeoTitle}
                onChange={(e) => setEditSeoTitle(e.target.value)}
                data-testid="input-edit-seo-title"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Meta Description ({editMetaDescription.length} chars)</Label>
              <Textarea
                value={editMetaDescription}
                onChange={(e) => setEditMetaDescription(e.target.value)}
                rows={2}
                data-testid="textarea-edit-meta-description"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">URL Slug</Label>
              <Input
                value={editSlug}
                onChange={(e) => setEditSlug(e.target.value)}
                data-testid="input-edit-slug"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Excerpt</Label>
              <Textarea
                value={editExcerpt}
                onChange={(e) => setEditExcerpt(e.target.value)}
                rows={2}
                data-testid="textarea-edit-excerpt"
              />
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <h3 className="font-medium text-sm">FAQ Pairs (AEO Optimization)</h3>
            {editFaqPairs.map((faq, i) => (
              <div key={i} className="border rounded-md p-3 space-y-2" data-testid={`faq-pair-${i}`}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    <Input
                      value={faq.question}
                      onChange={(e) => updateFaq(i, "question", e.target.value)}
                      placeholder="Question..."
                      className="text-sm"
                      data-testid={`input-faq-question-${i}`}
                    />
                    <Textarea
                      value={faq.answer}
                      onChange={(e) => updateFaq(i, "answer", e.target.value)}
                      placeholder="Answer..."
                      rows={2}
                      className="text-sm"
                      data-testid={`textarea-faq-answer-${i}`}
                    />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeFaq(i)} data-testid={`button-remove-faq-${i}`}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addFaq} data-testid="button-add-faq">
              <Plus className="h-3 w-3 mr-1" /> Add FAQ
            </Button>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4 space-y-3">
            <h3 className="font-medium text-sm flex items-center gap-1">
              <Tag className="h-4 w-4" /> Tags
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {editTags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1" data-testid={`badge-tag-${tag}`}>
                  {tag}
                  <button onClick={() => removeTag(tag)} className="ml-0.5 hover:text-destructive" data-testid={`button-remove-tag-${tag}`}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-1.5">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add tag..."
                className="text-sm"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                data-testid="input-new-tag"
              />
              <Button size="sm" variant="outline" onClick={addTag} disabled={!newTag.trim()} data-testid="button-add-tag">
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </Card>

          <Card className="p-4 space-y-2">
            <h3 className="font-medium text-sm">Evergreen Classification</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditIsEvergreen(!editIsEvergreen)}
                data-testid="button-toggle-evergreen"
              >
                <Badge variant={editIsEvergreen ? "default" : "secondary"}>
                  {editIsEvergreen ? "Evergreen" : "Time-sensitive"}
                </Badge>
              </button>
              <span className="text-xs text-muted-foreground">Click to toggle</span>
            </div>
            <Input
              value={editEvergreenReason}
              onChange={(e) => setEditEvergreenReason(e.target.value)}
              placeholder="Reason for classification"
              className="text-sm"
              data-testid="input-evergreen-reason"
            />
          </Card>

          <SeoScoreCard
            input={{
              title: editSeoTitle,
              metaDescription: editMetaDescription,
              content: bodyForScoring,
              slug: editSlug,
            }}
          />

          <AeoScoreCard
            input={{
              title: editSeoTitle,
              metaDescription: editMetaDescription,
              content: bodyForScoring,
              slug: editSlug,
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default function CmsContentLibrary({
  onSelectItem,
  onCreateNew,
  cityId,
}: {
  onSelectItem: (id: string) => void;
  cityId?: string;
  onCreateNew: () => void;
}) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [contentType, setContentType] = useState("all");
  const [status, setStatus] = useState("all");
  const [offset, setOffset] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showPastePolish, setShowPastePolish] = useState(false);

  const queryParams = new URLSearchParams();
  if (contentType !== "all") queryParams.set("contentType", contentType);
  if (status !== "all") queryParams.set("status", status);
  if (search) queryParams.set("search", search);
  queryParams.set("limit", String(PAGE_SIZE));
  queryParams.set("offset", String(offset));

  const url = `/api/admin/cms/content?${queryParams.toString()}`;

  const { data, isLoading } = useQuery<{ items: CmsContentItem[]; total: number }>({
    queryKey: [url],
  });

  const bulkTransitionMutation = useMutation({
    mutationFn: async ({ ids, action }: { ids: string[]; action: string }) => {
      await Promise.all(
        ids.map((id) =>
          apiRequest("POST", `/api/admin/cms/content/${id}/transition`, { action })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/admin/cms/content") });
      setSelectedIds(new Set());
      toast({ title: "Bulk action completed" });
    },
    onError: (err: any) => {
      toast({ title: "Bulk action failed", description: err.message, variant: "destructive" });
    },
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)));
    }
  }

  function handleFilterChange(setter: (v: string) => void, value: string) {
    setter(value);
    setOffset(0);
    setSelectedIds(new Set());
  }

  if (showPastePolish) {
    return (
      <PastePolishView
        cityId={cityId}
        onBack={() => setShowPastePolish(false)}
        onSelectItem={(id) => {
          setShowPastePolish(false);
          onSelectItem(id);
        }}
      />
    );
  }

  return (
    <div className="space-y-4" data-testid="cms-content-library">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="font-semibold text-lg" data-testid="text-content-library-title">
          Content Library
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowPastePolish(true)} data-testid="button-paste-polish">
            <Sparkles className="h-4 w-4 mr-1" /> Paste & Polish
          </Button>
          <Button onClick={onCreateNew} data-testid="button-create-new-content">
            <Plus className="h-4 w-4 mr-1" /> New Content
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap" data-testid="filter-bar">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search content..."
            value={search}
            onChange={(e) => handleFilterChange(setSearch, e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
        <Select
          value={contentType}
          onValueChange={(v) => handleFilterChange(setContentType, v)}
        >
          <SelectTrigger className="w-[160px]" data-testid="select-content-type">
            <SelectValue placeholder="Content Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" data-testid="option-type-all">All Types</SelectItem>
            <SelectItem value="article" data-testid="option-type-article">Article</SelectItem>
            <SelectItem value="press_release" data-testid="option-type-press_release">Press Release</SelectItem>
            <SelectItem value="shoutout" data-testid="option-type-shoutout">Shout-out</SelectItem>
            <SelectItem value="media_mention" data-testid="option-type-media_mention">Media Mention</SelectItem>
            <SelectItem value="digest" data-testid="option-type-digest">Digest</SelectItem>
            <SelectItem value="curated_list" data-testid="option-type-curated_list">Curated List</SelectItem>
            <SelectItem value="attraction" data-testid="option-type-attraction">Attraction</SelectItem>
            <SelectItem value="page" data-testid="option-type-page">Page</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(v) => handleFilterChange(setStatus, v)}
        >
          <SelectTrigger className="w-[140px]" data-testid="select-status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" data-testid="option-status-all">All Statuses</SelectItem>
            <SelectItem value="draft" data-testid="option-status-draft">Draft</SelectItem>
            <SelectItem value="in_review" data-testid="option-status-in_review">In Review</SelectItem>
            <SelectItem value="scheduled" data-testid="option-status-scheduled">Scheduled</SelectItem>
            <SelectItem value="published" data-testid="option-status-published">Published</SelectItem>
            <SelectItem value="archived" data-testid="option-status-archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selectedIds.size > 0 && (
        <Card className="p-3" data-testid="bulk-actions-bar">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-muted-foreground" data-testid="text-selected-count">
              {selectedIds.size} selected
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                bulkTransitionMutation.mutate({
                  ids: Array.from(selectedIds),
                  action: "submit_for_review",
                })
              }
              disabled={bulkTransitionMutation.isPending}
              data-testid="button-bulk-review"
            >
              <SendHorizonal className="h-4 w-4 mr-1" /> Move to Review
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                bulkTransitionMutation.mutate({
                  ids: Array.from(selectedIds),
                  action: "archive",
                })
              }
              disabled={bulkTransitionMutation.isPending}
              data-testid="button-bulk-archive"
            >
              <Archive className="h-4 w-4 mr-1" /> Archive
            </Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-2" data-testid="loading-skeleton">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center" data-testid="empty-state">
          <h3 className="font-semibold mb-1">No content found</h3>
          <p className="text-sm text-muted-foreground">
            Try adjusting your filters or create new content.
          </p>
        </Card>
      ) : (
        <Card data-testid="content-table">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-3 text-left w-10">
                    <Checkbox
                      checked={selectedIds.size === items.length && items.length > 0}
                      onCheckedChange={toggleSelectAll}
                      data-testid="checkbox-select-all"
                    />
                  </th>
                  <th className="p-3 text-left font-medium" data-testid="th-title">Title</th>
                  <th className="p-3 text-left font-medium" data-testid="th-type">Type</th>
                  <th className="p-3 text-left font-medium" data-testid="th-status">Status</th>
                  <th className="p-3 text-left font-medium" data-testid="th-updated">Updated</th>
                  <th className="p-3 text-left font-medium" data-testid="th-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b last:border-b-0 hover-elevate cursor-pointer"
                    onClick={() => onSelectItem(item.id)}
                    data-testid={`row-content-${item.id}`}
                  >
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(item.id)}
                        onCheckedChange={() => toggleSelect(item.id)}
                        data-testid={`checkbox-select-${item.id}`}
                      />
                    </td>
                    <td className="p-3 font-medium" data-testid={`text-title-${item.id}`}>
                      {item.titleEn}
                    </td>
                    <td className="p-3">
                      <Badge variant="secondary" data-testid={`badge-type-${item.id}`}>
                        {CONTENT_TYPE_LABELS[item.contentType] || item.contentType}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[item.status] || ""}`}
                        data-testid={`badge-status-${item.id}`}
                      >
                        {statusLabel(item.status)}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground" data-testid={`text-updated-${item.id}`}>
                      {formatDate(item.updatedAt)}
                    </td>
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onSelectItem(item.id)}
                        data-testid={`button-edit-${item.id}`}
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap" data-testid="pagination-bar">
        <span className="text-sm text-muted-foreground" data-testid="text-total-count">
          {total} item{total !== 1 ? "s" : ""} total
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={offset === 0}
            onClick={() => {
              setOffset(Math.max(0, offset - PAGE_SIZE));
              setSelectedIds(new Set());
            }}
            data-testid="button-prev-page"
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Prev
          </Button>
          <span className="text-sm text-muted-foreground" data-testid="text-page-info">
            Page {currentPage} of {totalPages || 1}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => {
              setOffset(offset + PAGE_SIZE);
              setSelectedIds(new Set());
            }}
            data-testid="button-next-page"
          >
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
