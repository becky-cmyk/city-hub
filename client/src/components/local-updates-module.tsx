import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Newspaper, ExternalLink, ChevronRight } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useI18n, localized, type TranslationKey } from "@/lib/i18n";

interface LocalUpdate {
  id: string;
  title: string;
  titleEs?: string | null;
  url: string;
  summary: string | null;
  summaryEs?: string | null;
  imageUrl: string | null;
  sourceName: string;
  publishedAt: string;
  viewCount: number;
}

function relativeTime(dateStr: string, t: (key: TranslationKey, replacements?: Record<string, string>) => string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return t("localUpdates.justNow");
  if (diffMin < 60) return t("localUpdates.mAgo", { n: String(diffMin) });
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return t("localUpdates.hAgo", { n: String(diffHr) });
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return t("localUpdates.dAgo", { n: String(diffDay) });
  const diffWeek = Math.floor(diffDay / 7);
  return t("localUpdates.wAgo", { n: String(diffWeek) });
}

function pickWeightedItems(items: LocalUpdate[], count: number, maxPerSource: number): LocalUpdate[] {
  const sourceCount: Record<string, number> = {};
  const shuffled = [...items].sort(() => Math.random() - 0.5);
  const result: LocalUpdate[] = [];

  for (const item of shuffled) {
    if (result.length >= count) break;
    const key = item.sourceName;
    const cnt = sourceCount[key] || 0;
    if (cnt >= maxPerSource) continue;
    result.push(item);
    sourceCount[key] = cnt + 1;
  }

  return result;
}

function trackView(id: string) {
  apiRequest("POST", `/api/content/local-updates/${id}/view`).catch(() => {});
}

export function LocalUpdatesModule({ citySlug }: { citySlug: string }) {
  const { locale, t } = useI18n();
  const { data: allItems, isLoading } = useQuery<LocalUpdate[]>({
    queryKey: ["/api/content/local-updates", citySlug],
    queryFn: async () => {
      const res = await fetch(`/api/content/local-updates?citySlug=${citySlug}&limit=12`);
      if (!res.ok) throw new Error("Failed to fetch local updates");
      return res.json();
    },
  });

  const displayItems = useMemo(() => {
    if (!allItems || allItems.length === 0) return [];
    return pickWeightedItems(allItems, 6, 2);
  }, [allItems]);

  if (!isLoading && displayItems.length === 0) return null;

  return (
    <>
      <div className="gradient-divider my-4" aria-hidden="true" />
      <section className="section-band" data-testid="section-local-updates">
        <div className="flex items-center justify-between gap-4 mb-5">
          <h2 className="text-xl font-bold flex items-center gap-2" data-testid="text-local-updates-title">
            <Newspaper className="h-5 w-5" style={{ color: "hsl(var(--brand-sky))" }} />
            {t("localUpdates.title")}
          </h2>
          <Link href={`/${citySlug}/articles`}>
            <Button variant="ghost" size="sm" className="gap-1" data-testid="link-see-all-local-updates">
              {t("localUpdates.seeAll")} <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-4 space-y-3" data-testid={`skeleton-local-update-${i}`}>
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-4 w-full" />
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {displayItems.map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackView(item.id)}
                data-testid={`card-local-update-${item.id}`}
              >
                <Card className="hover-elevate cursor-pointer p-4 h-full flex flex-col gap-3">
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt={localized(locale, item.title, item.titleEs)}
                      className="w-full h-32 object-cover rounded-md"
                      data-testid={`img-local-update-${item.id}`}
                    />
                  )}
                  <div className="flex-1 min-w-0 space-y-2">
                    <h3 className="font-semibold text-sm leading-tight line-clamp-2 flex items-start gap-1" data-testid={`title-local-update-${item.id}`}>
                      {localized(locale, item.title, item.titleEs)}
                      <ExternalLink className="h-3 w-3 shrink-0 mt-0.5 text-muted-foreground" />
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px]" data-testid={`badge-source-${item.id}`}>
                        {item.sourceName}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground" data-testid={`time-local-update-${item.id}`}>
                        {relativeTime(item.publishedAt, t)}
                      </span>
                    </div>
                    {(item.summary || item.summaryEs) && (() => {
                      const text = localized(locale, item.summary, item.summaryEs);
                      return text ? (
                        <p className="text-xs text-muted-foreground leading-relaxed" data-testid={`summary-local-update-${item.id}`}>
                          {text.length > 120 ? text.slice(0, 120) + "..." : text}
                        </p>
                      ) : null;
                    })()}
                  </div>
                </Card>
              </a>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
