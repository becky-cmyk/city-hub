import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Flag, RefreshCw, Search, Newspaper } from "lucide-react";
import { evaluateAeoChecks } from "@/components/aeo-score-card";
import { evaluateSeoChecks } from "@/components/seo-score-card";

function computeInlineScores(title: string, content: string, slug?: string) {
  const seoChecks = evaluateSeoChecks({
    title,
    content,
    metaDescription: content?.slice(0, 160),
    slug,
    cityKeyword: "Charlotte",
  });
  const seoPassed = seoChecks.filter(c => c.status === "green").length;

  const aeoChecks = evaluateAeoChecks({ title, content });
  const aeoPassed = aeoChecks.filter(c => c.status === "green").length;

  return { seoPassed, seoTotal: seoChecks.length, aeoPassed, aeoTotal: aeoChecks.length };
}

function formatRelativeDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function RssReviewTab({ cityId }: { cityId?: string }) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/intelligence/rss-items", cityId, statusFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      if (statusFilter !== "all") params.set("reviewStatus", statusFilter);
      if (search) params.set("search", search);
      params.set("limit", "50");
      const res = await fetch(`/api/admin/intelligence/rss-items?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch RSS items");
      return res.json();
    },
  });

  const items: any[] = data?.items || [];
  const pendingCount = data?.pendingCount || 0;

  const invalidateItems = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/intelligence/rss-items"] });
  };

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/admin/intelligence/rss-items/${id}/review`, { status });
    },
    onSuccess: () => {
      invalidateItems();
      toast({ title: "Review updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const rewriteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/intelligence/rss-items/${id}/rewrite`);
      return res.json();
    },
    onSuccess: () => {
      invalidateItems();
      toast({ title: "Rewrite complete" });
    },
    onError: (err: any) => toast({ title: "Rewrite failed", description: err.message, variant: "destructive" }),
  });

  const bulkReviewMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      await apiRequest("POST", `/api/admin/intelligence/rss-items/bulk-review`, { ids, status });
    },
    onSuccess: () => {
      invalidateItems();
      setSelectedIds(new Set());
      toast({ title: "Bulk review applied" });
    },
    onError: (err: any) => toast({ title: "Bulk action failed", description: err.message, variant: "destructive" }),
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i: any) => i.id)));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Newspaper className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-sm">RSS Review</h3>
          {pendingCount > 0 && (
            <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" data-testid="badge-pending-count">
              {pendingCount} pending
            </Badge>
          )}
        </div>
        <div className="flex-1" />
        <div className="relative min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search articles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-rss"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Items</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="SKIPPED">Skipped</SelectItem>
            <SelectItem value="FLAGGED">Flagged</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md">
          <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => bulkReviewMutation.mutate({ ids: Array.from(selectedIds), status: "SKIPPED" })}
            disabled={bulkReviewMutation.isPending}
            data-testid="btn-bulk-skip"
          >
            <X className="w-4 h-4 mr-1" />
            {bulkReviewMutation.isPending ? "Skipping..." : "Skip Selected"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 dark:text-red-400"
            onClick={() => bulkReviewMutation.mutate({ ids: Array.from(selectedIds), status: "FLAGGED" })}
            disabled={bulkReviewMutation.isPending}
            data-testid="btn-bulk-flag"
          >
            <Flag className="w-4 h-4 mr-1" />
            {bulkReviewMutation.isPending ? "Flagging..." : "Flag Selected"}
          </Button>
        </div>
      )}

      {items.length > 0 && (
        <div className="flex items-center gap-2">
          <Checkbox
            checked={selectedIds.size === items.length && items.length > 0}
            onCheckedChange={toggleSelectAll}
            data-testid="checkbox-select-all"
          />
          <span className="text-xs text-muted-foreground">Select all</span>
          <span className="text-xs text-muted-foreground ml-auto">{data?.total || items.length} items</span>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading RSS items...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No RSS items found.</div>
      ) : (
        <div className="space-y-3">
          {items.map((item: any) => (
            <Card key={item.id} data-testid={`card-rss-item-${item.id}`}>
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <div className="pt-1">
                    <Checkbox
                      checked={selectedIds.has(item.id)}
                      onCheckedChange={() => toggleSelect(item.id)}
                      data-testid={`checkbox-rss-${item.id}`}
                    />
                  </div>
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="w-20 h-20 rounded-md object-cover flex-shrink-0"
                      data-testid={`img-rss-${item.id}`}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-sm hover:underline truncate"
                        data-testid={`link-rss-title-${item.id}`}
                      >
                        {item.title}
                      </a>
                      {item.sourceName && (
                        <Badge variant="secondary" className="text-xs" data-testid={`badge-source-${item.id}`}>
                          {item.sourceName}
                        </Badge>
                      )}
                      {item.publishedAt && (
                        <span className="text-xs text-muted-foreground" data-testid={`text-date-${item.id}`}>
                          {formatRelativeDate(item.publishedAt)}
                        </span>
                      )}
                      {item.reviewStatus && item.reviewStatus !== "PENDING" && (
                        <Badge
                          variant="outline"
                          className={
                            item.reviewStatus === "APPROVED"
                              ? "text-green-700 border-green-300 dark:text-green-400 dark:border-green-700"
                              : item.reviewStatus === "FLAGGED"
                              ? "text-red-700 border-red-300 dark:text-red-400 dark:border-red-700"
                              : "text-yellow-700 border-yellow-300 dark:text-yellow-400 dark:border-yellow-700"
                          }
                          data-testid={`badge-review-status-${item.id}`}
                        >
                          {item.reviewStatus}
                        </Badge>
                      )}
                    </div>
                    {item.summary && (
                      <p className="text-xs text-muted-foreground line-clamp-2" data-testid={`text-summary-${item.id}`}>
                        {item.summary}
                      </p>
                    )}
                    {item.reviewStatus === "APPROVED" && item.rewrittenSummary && (
                      <div
                        className="mt-2 p-2 text-xs rounded-md border border-green-300 bg-green-50 text-green-900 dark:border-green-700 dark:bg-green-950 dark:text-green-200"
                        data-testid={`text-rewritten-${item.id}`}
                      >
                        {item.rewrittenSummary}
                      </div>
                    )}
                    {item.localArticleBody && (() => {
                      const scores = computeInlineScores(item.title, item.localArticleBody, item.localArticleSlug);
                      const seoColor = scores.seoPassed >= 5 ? "text-green-700 border-green-300 dark:text-green-400 dark:border-green-700" : scores.seoPassed >= 3 ? "text-yellow-700 border-yellow-300 dark:text-yellow-400 dark:border-yellow-700" : "text-red-700 border-red-300 dark:text-red-400 dark:border-red-700";
                      const aeoColor = scores.aeoPassed >= 5 ? "text-green-700 border-green-300 dark:text-green-400 dark:border-green-700" : scores.aeoPassed >= 3 ? "text-yellow-700 border-yellow-300 dark:text-yellow-400 dark:border-yellow-700" : "text-red-700 border-red-300 dark:text-red-400 dark:border-red-700";
                      return (
                        <div className="flex items-center gap-2 mt-2" data-testid={`scores-${item.id}`}>
                          <Badge variant="outline" className={`text-[10px] ${seoColor}`} data-testid={`badge-seo-score-${item.id}`}>
                            SEO {scores.seoPassed}/{scores.seoTotal}
                          </Badge>
                          <Badge variant="outline" className={`text-[10px] ${aeoColor}`} data-testid={`badge-aeo-score-${item.id}`}>
                            AEO {scores.aeoPassed}/{scores.aeoTotal}
                          </Badge>
                        </div>
                      );
                    })()}
                    <div className="flex items-center gap-1 mt-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-green-700 dark:text-green-400"
                        onClick={() => reviewMutation.mutate({ id: item.id, status: "APPROVED" })}
                        disabled={reviewMutation.isPending || item.reviewStatus === "APPROVED"}
                        data-testid={`btn-approve-${item.id}`}
                      >
                        <Check className="w-3.5 h-3.5 mr-1" />
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-yellow-700 dark:text-yellow-400"
                        onClick={() => reviewMutation.mutate({ id: item.id, status: "SKIPPED" })}
                        disabled={reviewMutation.isPending || item.reviewStatus === "SKIPPED"}
                        data-testid={`btn-skip-${item.id}`}
                      >
                        <X className="w-3.5 h-3.5 mr-1" />
                        Skip
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-700 dark:text-red-400"
                        onClick={() => reviewMutation.mutate({ id: item.id, status: "FLAGGED" })}
                        disabled={reviewMutation.isPending || item.reviewStatus === "FLAGGED"}
                        data-testid={`btn-flag-${item.id}`}
                      >
                        <Flag className="w-3.5 h-3.5 mr-1" />
                        Flag
                      </Button>
                      {item.reviewStatus === "APPROVED" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-primary"
                          onClick={() => rewriteMutation.mutate(item.id)}
                          disabled={rewriteMutation.isPending}
                          data-testid={`btn-rewrite-${item.id}`}
                        >
                          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${rewriteMutation.isPending ? "animate-spin" : ""}`} />
                          {rewriteMutation.isPending ? "Rewriting..." : "Rewrite"}
                        </Button>
                      )}
                    </div>
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
