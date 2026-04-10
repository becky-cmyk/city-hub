import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Plus, Edit, Trash2, Star, Zap, Bot, Loader2, Sparkles, Check, Search, X, Store, Link2, Languages } from "lucide-react";
import { useState, useEffect } from "react";
import type { Article, Business } from "@shared/schema";
import { useDefaultCityId } from "@/hooks/use-city";
import { SeoScoreCard, evaluateSeoChecks } from "@/components/seo-score-card";
import { AeoScoreCard, evaluateAeoChecks } from "@/components/aeo-score-card";

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().split("T")[0];
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  return new Date(dateStr + "T00:00:00Z");
}

function ArticleForm({ article, onClose }: { article?: Article; onClose: () => void }) {
  const CITY_ID = useDefaultCityId();
  const { toast } = useToast();
  const [title, setTitle] = useState(article?.title || "");
  const [slug, setSlug] = useState(article?.slug || "");
  const [excerpt, setExcerpt] = useState(article?.excerpt || "");
  const [content, setContent] = useState(article?.content || "");
  const [imageUrl, setImageUrl] = useState(article?.imageUrl || "");
  const [publishedAt, setPublishedAt] = useState(formatDate(article?.publishedAt || new Date()));
  const [displayDate, setDisplayDate] = useState(formatDate(article?.displayDate));
  const [isEvergreen, setIsEvergreen] = useState(article?.isEvergreen || false);
  const [isFeatured, setIsFeatured] = useState(article?.isFeatured || false);
  const [mentionedBusinessIds, setMentionedBusinessIds] = useState<string[]>((article as any)?.mentionedBusinessIds || []);
  const [bizSearchQuery, setBizSearchQuery] = useState("");
  const [bizSearchResults, setBizSearchResults] = useState<Business[]>([]);
  const [bizSearching, setBizSearching] = useState(false);
  const [linkedBusinesses, setLinkedBusinesses] = useState<{ id: string; name: string }[]>([]);
  const [seoSuggesting, setSeoSuggesting] = useState(false);

  const { data: allBusinesses } = useQuery<Business[]>({
    queryKey: ["/api/admin/businesses"],
  });

  const resolvedLinkedBusinesses = mentionedBusinessIds
    .map((id) => {
      const found = linkedBusinesses.find((b) => b.id === id);
      if (found) return found;
      const fromAll = allBusinesses?.find((b) => b.id === id);
      if (fromAll) return { id: fromAll.id, name: fromAll.name };
      return { id, name: id };
    });

  const handleBizSearch = () => {
    if (!bizSearchQuery.trim() || !allBusinesses) return;
    setBizSearching(true);
    const q = bizSearchQuery.toLowerCase();
    const results = allBusinesses
      .filter((b) => b.name.toLowerCase().includes(q) && !mentionedBusinessIds.includes(b.id))
      .slice(0, 8);
    setBizSearchResults(results);
    setBizSearching(false);
  };

  const addBusiness = (biz: Business) => {
    setMentionedBusinessIds((prev) => [...prev, biz.id]);
    setLinkedBusinesses((prev) => [...prev, { id: biz.id, name: biz.name }]);
    setBizSearchResults((prev) => prev.filter((b) => b.id !== biz.id));
    setBizSearchQuery("");
  };

  const removeBusiness = (bizId: string) => {
    setMentionedBusinessIds((prev) => prev.filter((id) => id !== bizId));
    setLinkedBusinesses((prev) => prev.filter((b) => b.id !== bizId));
  };
  const [seoSuggestion, setSeoSuggestion] = useState<{
    suggestedTitle: string;
    suggestedSlug: string;
    suggestedMetaDescription: string;
    source: string;
  } | null>(null);

  const suggestedMetaTitle = title ? `${title} | CLT Metro Hub` : "";
  const suggestedMetaDesc = excerpt ? excerpt.slice(0, 155) : "";

  const handleAiSuggestSeo = async () => {
    if (!title) {
      toast({ title: "Enter a title first", variant: "destructive" });
      return;
    }
    setSeoSuggesting(true);
    try {
      const resp = await apiRequest("POST", "/api/admin/articles/suggest-seo", {
        title,
        excerpt,
        content,
        cityName: "Charlotte",
      });
      const data = await resp.json();
      setSeoSuggestion(data);
    } catch (err: any) {
      toast({ title: "SEO suggestion failed", description: err.message, variant: "destructive" });
    }
    setSeoSuggesting(false);
  };

  const applySeoSuggestion = (field: "title" | "slug" | "excerpt") => {
    if (!seoSuggestion) return;
    if (field === "title") setTitle(seoSuggestion.suggestedTitle);
    if (field === "slug") setSlug(seoSuggestion.suggestedSlug);
    if (field === "excerpt") setExcerpt(seoSuggestion.suggestedMetaDescription);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title,
        slug: slug || slugify(title),
        excerpt: excerpt || null,
        content: content || null,
        imageUrl: imageUrl || null,
        cityId: CITY_ID,
        isFeatured,
        publishedAt: publishedAt ? parseDate(publishedAt) : new Date(),
        displayDate: displayDate ? parseDate(displayDate) : null,
        isEvergreen,
        mentionedBusinessIds,
      };
      if (article) {
        return apiRequest("PATCH", `/api/admin/articles/${article.id}`, payload);
      }
      return apiRequest("POST", "/api/admin/articles", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/articles"] });
      toast({ title: article ? "Article updated" : "Article created" });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Error saving article", description: err.message, variant: "destructive" });
    },
  });

  return (
    <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{article ? "Edit Article" : "New Article"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Title *</Label>
          <Input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!article) setSlug(slugify(e.target.value));
            }}
            placeholder="Article title"
            data-testid="input-article-title"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Slug</Label>
          <Input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="auto-generated-from-title"
            data-testid="input-article-slug"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Excerpt / Meta Description</Label>
          <Input
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            placeholder="Short summary of the article (used as meta description)"
            data-testid="input-article-excerpt"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Content</Label>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Full article content"
            rows={6}
            data-testid="input-article-content"
          />
        </div>

        <div className="border-t pt-3 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h4 className="text-sm font-semibold flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> SEO Optimization
              </h4>
              <p className="text-[10px] text-muted-foreground">Auto-suggested SEO metadata or use AI for optimized suggestions</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleAiSuggestSeo}
              disabled={seoSuggesting || !title}
              data-testid="button-ai-suggest-seo"
            >
              {seoSuggesting ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Bot className="h-3 w-3 mr-1" />
              )}
              AI Suggest SEO
            </Button>
          </div>

          <div className="rounded-md border p-3 space-y-2 bg-muted/30">
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Meta Title Preview</p>
              <p className="text-xs" data-testid="text-meta-title-preview">
                {suggestedMetaTitle || <span className="text-muted-foreground italic">Enter a title to see preview</span>}
              </p>
              <p className="text-[10px] text-muted-foreground">{suggestedMetaTitle.length}/60 chars</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Meta Description Preview</p>
              <p className="text-xs" data-testid="text-meta-desc-preview">
                {suggestedMetaDesc || <span className="text-muted-foreground italic">Enter an excerpt to see preview</span>}
              </p>
              <p className="text-[10px] text-muted-foreground">{suggestedMetaDesc.length}/155 chars</p>
            </div>
          </div>

          {seoSuggestion && (
            <div className="rounded-md border border-primary/20 bg-primary/5 p-3 space-y-2">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                AI Suggestions {seoSuggestion.source === "ai" ? "(GPT-4o-mini)" : "(Auto-generated)"}
              </p>
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted-foreground">Title</p>
                    <p className="text-xs truncate" data-testid="text-seo-suggested-title">{seoSuggestion.suggestedTitle}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => applySeoSuggestion("title")}
                    data-testid="button-apply-seo-title"
                  >
                    <Check className="h-3 w-3 mr-1" /> Apply
                  </Button>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted-foreground">Slug</p>
                    <p className="text-xs font-mono truncate" data-testid="text-seo-suggested-slug">{seoSuggestion.suggestedSlug}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => applySeoSuggestion("slug")}
                    data-testid="button-apply-seo-slug"
                  >
                    <Check className="h-3 w-3 mr-1" /> Apply
                  </Button>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted-foreground">Meta Description</p>
                    <p className="text-xs" data-testid="text-seo-suggested-desc">{seoSuggestion.suggestedMetaDescription}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => applySeoSuggestion("excerpt")}
                    data-testid="button-apply-seo-desc"
                  >
                    <Check className="h-3 w-3 mr-1" /> Apply
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>Image URL</Label>
          <Input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://..."
            data-testid="input-article-imageUrl"
          />
        </div>

        <div className="border-t pt-3 space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-1.5">
            <Link2 className="h-3.5 w-3.5" /> Linked Businesses
          </h4>
          <p className="text-[10px] text-muted-foreground">Link businesses mentioned in this article. They will appear as inline cards within the article.</p>
          {resolvedLinkedBusinesses.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {resolvedLinkedBusinesses.map((biz) => (
                <Badge key={biz.id} variant="secondary" className="gap-1" data-testid={`badge-linked-biz-${biz.id}`}>
                  <Store className="h-3 w-3" />
                  {biz.name}
                  <button
                    type="button"
                    onClick={() => removeBusiness(biz.id)}
                    className="ml-1"
                    data-testid={`button-remove-biz-${biz.id}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={bizSearchQuery}
              onChange={(e) => setBizSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleBizSearch(); } }}
              placeholder="Search businesses by name..."
              data-testid="input-biz-search"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleBizSearch}
              disabled={bizSearching || !bizSearchQuery.trim()}
              data-testid="button-biz-search"
            >
              <Search className="h-3 w-3 mr-1" /> Search
            </Button>
          </div>
          {bizSearchResults.length > 0 && (
            <div className="rounded-md border divide-y max-h-40 overflow-y-auto">
              {bizSearchResults.map((biz) => (
                <button
                  key={biz.id}
                  type="button"
                  className="w-full flex items-center gap-2 p-2 text-left text-sm hover-elevate"
                  onClick={() => addBusiness(biz)}
                  data-testid={`button-add-biz-${biz.id}`}
                >
                  <Store className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{biz.name}</span>
                  <Plus className="h-3 w-3 ml-auto text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border-t pt-3 space-y-3">
          <h4 className="text-sm font-semibold">Publishing</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Published At</Label>
              <Input
                type="date"
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
                data-testid="input-article-publishedAt"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Display Date (optional)</Label>
              <Input
                type="date"
                value={displayDate}
                onChange={(e) => setDisplayDate(e.target.value)}
                placeholder="Leave blank to use published date"
                data-testid="input-article-displayDate"
              />
            </div>
          </div>
        </div>

        <div className="border-t pt-3 space-y-3">
          <h4 className="text-sm font-semibold">Options</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">Is Evergreen (timeless article)</span>
              <Switch
                checked={isEvergreen}
                onCheckedChange={setIsEvergreen}
                data-testid="switch-article-isEvergreen"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">Is Featured</span>
              <Switch
                checked={isFeatured}
                onCheckedChange={setIsFeatured}
                data-testid="switch-article-isFeatured"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SeoScoreCard
            input={{
              title,
              metaDescription: excerpt,
              content,
              slug: slug || slugify(title),
              cityKeyword: "Charlotte",
            }}
          />
          <AeoScoreCard
            input={{
              title,
              metaDescription: excerpt,
              content,
              slug: slug || slugify(title),
            }}
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !title}
            data-testid="button-save-article"
          >
            {saveMutation.isPending ? "Saving..." : article ? "Update Article" : "Create Article"}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}

export default function ArticlesPanel({ cityId, autoOpenEntityId, onAutoOpenConsumed }: { cityId?: string; autoOpenEntityId?: string | null; onAutoOpenConsumed?: () => void }) {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [deletingArticle, setDeletingArticle] = useState<Article | null>(null);

  const { data: articles, isLoading, isError: articlesError } = useQuery<Article[]>({
    queryKey: ["/api/admin/articles", cityId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      const resp = await fetch(`/api/admin/articles?${params}`, { credentials: "include" });
      if (!resp.ok) throw new Error("Failed to load");
      return resp.json();
    },
  });

  useEffect(() => {
    if (!autoOpenEntityId) return;
    if (articles) {
      const match = articles.find(a => a.id === autoOpenEntityId);
      if (match) {
        setEditingArticle(match);
      }
      onAutoOpenConsumed?.();
    } else if (articlesError) {
      onAutoOpenConsumed?.();
    }
  }, [autoOpenEntityId, articles, articlesError]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/articles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/articles"] });
      toast({ title: "Article deleted" });
      setDeletingArticle(null);
    },
    onError: (err: any) => {
      toast({ title: "Error deleting article", description: err.message, variant: "destructive" });
    },
  });

  function getDateDisplay(article: Article): { label: string; isBadge: boolean } {
    if (article.isEvergreen) {
      return { label: "Evergreen", isBadge: true };
    }
    if (article.displayDate) {
      const displayDateObj = typeof article.displayDate === "string" ? new Date(article.displayDate) : article.displayDate;
      if (displayDateObj instanceof Date && !isNaN(displayDateObj.getTime())) {
        return { label: displayDateObj.toLocaleDateString(), isBadge: false };
      }
    }
    if (article.publishedAt) {
      const publishedDateObj = typeof article.publishedAt === "string" ? new Date(article.publishedAt) : article.publishedAt;
      if (publishedDateObj instanceof Date && !isNaN(publishedDateObj.getTime())) {
        return { label: publishedDateObj.toLocaleDateString(), isBadge: false };
      }
    }
    return { label: "No date", isBadge: false };
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-lg flex items-center gap-2" data-testid="text-articles-title">
            <Calendar className="h-5 w-5" /> Articles
          </h2>
          <p className="text-sm text-muted-foreground">Manage articles with custom date and evergreen options</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-article">
            <Plus className="h-4 w-4 mr-1" /> New Article
          </Button>
          {isCreateOpen && <ArticleForm onClose={() => setIsCreateOpen(false)} />}
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : !articles || articles.length === 0 ? (
        <Card className="p-8 text-center">
          <Calendar className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <h3 className="font-semibold mb-1">No articles found</h3>
          <p className="text-sm text-muted-foreground">Create your first article to get started</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {articles.map((article) => {
            const dateInfo = getDateDisplay(article);
            return (
              <Card key={article.id} className="p-4" data-testid={`card-article-${article.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold truncate" data-testid={`text-article-title-${article.id}`}>
                        {article.title}
                      </h3>
                      {article.isFeatured && (
                        <Badge variant="default" className="shrink-0" data-testid={`badge-featured-${article.id}`}>
                          <Star className="h-3 w-3 mr-1" /> Featured
                        </Badge>
                      )}
                      {dateInfo.isBadge && (
                        <Badge variant="secondary" className="shrink-0" data-testid={`badge-date-${article.id}`}>
                          <Zap className="h-3 w-3 mr-1" /> {dateInfo.label}
                        </Badge>
                      )}
                      {(article as Article & { translationStatus?: string }).translationStatus && (
                        <Badge
                          variant="outline"
                          className={`text-[9px] shrink-0 ${
                            (article as Article & { translationStatus?: string }).translationStatus === "completed" ? "border-green-400 text-green-600 bg-green-50 dark:bg-green-950" :
                            (article as Article & { translationStatus?: string }).translationStatus === "failed" ? "border-red-400 text-red-600 bg-red-50 dark:bg-red-950" :
                            "border-amber-400 text-amber-600 bg-amber-50 dark:bg-amber-950"
                          }`}
                          data-testid={`badge-translation-${article.id}`}
                        >
                          <Languages className="h-2.5 w-2.5 mr-0.5" />
                          {(article as Article & { translationStatus?: string }).translationStatus === "completed" ? "ES✓" : (article as Article & { translationStatus?: string }).translationStatus === "failed" ? "ES✗" : "ES…"}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-2" data-testid={`text-slug-${article.id}`}>
                      {article.slug}
                    </p>
                    <div className="text-sm text-muted-foreground space-y-1">
                      {article.excerpt && (
                        <p className="line-clamp-2" data-testid={`text-excerpt-${article.id}`}>
                          {article.excerpt}
                        </p>
                      )}
                      {!dateInfo.isBadge && (
                        <p data-testid={`text-date-${article.id}`}>
                          Published: {dateInfo.label}
                        </p>
                      )}
                    </div>
                    {article.content && (() => {
                      const seoChecks = evaluateSeoChecks({ title: article.title, content: article.content || "", metaDescription: article.excerpt || "", slug: article.slug, cityKeyword: "Charlotte" });
                      const seoPassed = seoChecks.filter(c => c.status === "green").length;
                      const aeoChecks = evaluateAeoChecks({ title: article.title, content: article.content || "", metaDescription: article.excerpt || "" });
                      const aeoPassed = aeoChecks.filter(c => c.status === "green").length;
                      const seoColor = seoPassed >= 5 ? "text-green-700 border-green-300 dark:text-green-400 dark:border-green-700" : seoPassed >= 3 ? "text-yellow-700 border-yellow-300 dark:text-yellow-400 dark:border-yellow-700" : "text-red-700 border-red-300 dark:text-red-400 dark:border-red-700";
                      const aeoColor = aeoPassed >= 5 ? "text-green-700 border-green-300 dark:text-green-400 dark:border-green-700" : aeoPassed >= 3 ? "text-yellow-700 border-yellow-300 dark:text-yellow-400 dark:border-yellow-700" : "text-red-700 border-red-300 dark:text-red-400 dark:border-red-700";
                      return (
                        <div className="flex items-center gap-2 mt-1.5" data-testid={`scores-article-${article.id}`}>
                          <Badge variant="outline" className={`text-[10px] ${seoColor}`} data-testid={`badge-seo-article-${article.id}`}>
                            SEO {seoPassed}/{seoChecks.length}
                          </Badge>
                          <Badge variant="outline" className={`text-[10px] ${aeoColor}`} data-testid={`badge-aeo-article-${article.id}`}>
                            AEO {aeoPassed}/{aeoChecks.length}
                          </Badge>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Dialog open={editingArticle?.id === article.id} onOpenChange={(open) => setEditingArticle(open ? article : null)}>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingArticle(article)}
                        data-testid={`button-edit-article-${article.id}`}
                      >
                        <Edit className="h-3 w-3 mr-1" /> Edit
                      </Button>
                      {editingArticle?.id === article.id && (
                        <ArticleForm article={article} onClose={() => setEditingArticle(null)} />
                      )}
                    </Dialog>
                    <AlertDialog open={deletingArticle?.id === article.id} onOpenChange={(open) => setDeletingArticle(open ? article : null)}>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDeletingArticle(article)}
                        data-testid={`button-delete-article-${article.id}`}
                      >
                        <Trash2 className="h-3 w-3 mr-1" /> Delete
                      </Button>
                      {deletingArticle?.id === article.id && (
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Article?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete "{article.title}". This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <div className="flex gap-2 justify-end">
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(article.id)}
                              disabled={deleteMutation.isPending}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              data-testid="button-confirm-delete"
                            >
                              {deleteMutation.isPending ? "Deleting..." : "Delete"}
                            </AlertDialogAction>
                          </div>
                        </AlertDialogContent>
                      )}
                    </AlertDialog>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
