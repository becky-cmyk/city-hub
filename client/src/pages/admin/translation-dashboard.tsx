import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Languages, RefreshCw, AlertTriangle, CheckCircle2, Clock, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TranslationStatusSummary {
  businesses: { completed: number; pending: number; failed: number };
  events: { completed: number; pending: number; failed: number };
  articles: { completed: number; pending: number; failed: number };
  posts: { completed: number; pending: number; failed: number };
  marketplaceListings: { completed: number; pending: number; failed: number };
  cmsContent: { completed: number; pending: number; failed: number };
}

interface FailedTranslation {
  type: string;
  id: string;
  name: string;
  error: string | null;
  attempts: number;
  lastAttempt: string | null;
}

export default function TranslationDashboard({ cityId }: { cityId?: string }) {
  const { toast } = useToast();

  const { data: status, isLoading: statusLoading } = useQuery<TranslationStatusSummary>({
    queryKey: ["/api/admin/translations/status"],
  });

  const { data: failedData, isLoading: failedLoading } = useQuery<{ items: FailedTranslation[]; total: number }>({
    queryKey: ["/api/admin/translations/failed"],
  });

  const retryMutation = useMutation({
    mutationFn: async ({ type, id }: { type: string; id: string }) => {
      return apiRequest("POST", "/api/admin/translations/retry", { type, id });
    },
    onSuccess: () => {
      toast({ title: "Translation retried", description: "The translation has been re-queued." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/translations/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/translations/failed"] });
    },
    onError: () => {
      toast({ title: "Retry failed", description: "Could not retry the translation.", variant: "destructive" });
    },
  });

  const retryAllMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/translations/retry-all", {});
    },
    onSuccess: async (res) => {
      const data = await res.json();
      toast({ title: "Translations queued", description: `${data.queued} translations have been queued.` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/translations/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/translations/failed"] });
    },
    onError: () => {
      toast({ title: "Retry all failed", description: "Could not queue translations.", variant: "destructive" });
    },
  });

  const contentTypes = [
    { key: "businesses", label: "Businesses" },
    { key: "events", label: "Events" },
    { key: "articles", label: "Articles" },
    { key: "posts", label: "Posts" },
    { key: "marketplaceListings", label: "Marketplace" },
    { key: "cmsContent", label: "CMS Content" },
  ];

  const totals = status ? contentTypes.reduce(
    (acc, ct) => {
      const s = status[ct.key as keyof TranslationStatusSummary];
      if (s) {
        acc.completed += s.completed;
        acc.pending += s.pending;
        acc.failed += s.failed;
      }
      return acc;
    },
    { completed: 0, pending: 0, failed: 0 }
  ) : { completed: 0, pending: 0, failed: 0 };

  const totalAll = totals.completed + totals.pending + totals.failed;
  const completionPct = totalAll > 0 ? Math.round((totals.completed / totalAll) * 100) : 0;

  function typeLabel(type: string): string {
    const labels: Record<string, string> = {
      business: "Business",
      event: "Event",
      article: "Article",
      post: "Post",
      marketplace_listing: "Marketplace",
      cms_content: "CMS Content",
    };
    return labels[type] || type;
  }

  return (
    <div className="space-y-6" data-testid="translation-dashboard">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Languages className="h-6 w-6 text-purple-600" />
          <div>
            <h2 className="text-xl font-bold" data-testid="text-translation-title">Translation Pipeline</h2>
            <p className="text-sm text-muted-foreground">Bilingual auto-translation status across all content</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { queryClient.invalidateQueries({ queryKey: ["/api/admin/translations/status"] }); queryClient.invalidateQueries({ queryKey: ["/api/admin/translations/failed"] }); }}
            data-testid="button-refresh-translations"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => retryAllMutation.mutate()}
            disabled={retryAllMutation.isPending}
            data-testid="button-retry-all-translations"
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            {retryAllMutation.isPending ? "Queuing..." : "Scan & Retry"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <div className="text-3xl font-bold text-purple-600" data-testid="text-completion-pct">{completionPct}%</div>
            <p className="text-xs text-muted-foreground mt-1">Fully Bilingual</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <div className="text-3xl font-bold text-green-600" data-testid="text-completed-count">{totals.completed}</div>
            <p className="text-xs text-muted-foreground mt-1">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <div className="text-3xl font-bold text-amber-600" data-testid="text-pending-count">{totals.pending}</div>
            <p className="text-xs text-muted-foreground mt-1">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <div className="text-3xl font-bold text-red-600" data-testid="text-failed-count">{totals.failed}</div>
            <p className="text-xs text-muted-foreground mt-1">Failed</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Translation Status by Content Type</CardTitle>
        </CardHeader>
        <CardContent>
          {statusLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <div className="space-y-3">
              {contentTypes.map((ct) => {
                const s = status?.[ct.key as keyof TranslationStatusSummary];
                if (!s) return null;
                const total = s.completed + s.pending + s.failed;
                const pct = total > 0 ? Math.round((s.completed / total) * 100) : 0;

                return (
                  <div key={ct.key} className="flex items-center gap-3" data-testid={`row-translation-${ct.key}`}>
                    <div className="w-32 text-sm font-medium">{ct.label}</div>
                    <div className="flex-1">
                      <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden flex">
                        {s.completed > 0 && (
                          <div
                            className="bg-green-500 h-full"
                            style={{ width: `${(s.completed / total) * 100}%` }}
                          />
                        )}
                        {s.pending > 0 && (
                          <div
                            className="bg-amber-400 h-full"
                            style={{ width: `${(s.pending / total) * 100}%` }}
                          />
                        )}
                        {s.failed > 0 && (
                          <div
                            className="bg-red-500 h-full"
                            style={{ width: `${(s.failed / total) * 100}%` }}
                          />
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs min-w-[140px] justify-end">
                      <span className="text-green-600">{s.completed}</span>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-amber-600">{s.pending}</span>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-red-600">{s.failed}</span>
                      <Badge variant={pct === 100 ? "default" : "secondary"} className="text-xs ml-1">
                        {pct}%
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            Failed Translations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {failedLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : !failedData?.items?.length ? (
            <div className="flex items-center gap-2 text-sm text-green-600 py-4">
              <CheckCircle2 className="h-4 w-4" />
              No failed translations
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {failedData.items.map((item) => (
                <div
                  key={`${item.type}-${item.id}`}
                  className="flex items-center justify-between p-3 border rounded-lg"
                  data-testid={`row-failed-${item.type}-${item.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs shrink-0">{typeLabel(item.type)}</Badge>
                      <span className="text-sm font-medium truncate">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-red-500 truncate max-w-[300px]">{item.error || "Unknown error"}</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                        <Clock className="h-3 w-3" />
                        {item.attempts} attempts
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => retryMutation.mutate({ type: item.type, id: item.id })}
                    disabled={retryMutation.isPending}
                    data-testid={`button-retry-${item.type}-${item.id}`}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
