import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Newspaper, ExternalLink, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { usePageMeta } from "@/hooks/use-page-meta";
import { DarkPageShell } from "@/components/dark-page-shell";

interface LocalUpdate {
  id: string;
  title: string;
  url: string;
  summary: string | null;
  rawSummary: string | null;
  imageUrl: string | null;
  sourceName: string;
  publishedAt: string;
  viewCount: number;
}

interface PaginatedResponse {
  rows: LocalUpdate[];
  total: number;
  page: number;
}

interface RssSource {
  id: string;
  name: string;
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  const diffWeek = Math.floor(diffDay / 7);
  return `${diffWeek}w ago`;
}

function trackView(id: string) {
  apiRequest("POST", `/api/content/local-updates/${id}/view`).catch(() => {});
}

function capitalizeCity(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function LocalUpdatesPage({ citySlug }: { citySlug: string }) {
  const [page, setPage] = useState(1);
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const cityName = capitalizeCity(citySlug);

  usePageMeta({
    title: `Local Updates — ${cityName}`,
    description: `Latest local updates and news for ${cityName}`,
    canonical: `${window.location.origin}/${citySlug}/local-updates`,
  });

  const { data: sources } = useQuery<RssSource[]>({
    queryKey: ["/api/content/rss-sources", citySlug],
    queryFn: async () => {
      const res = await fetch(`/api/content/rss-sources?citySlug=${citySlug}`);
      if (!res.ok) throw new Error("Failed to fetch sources");
      return res.json();
    },
  });

  const { data: paginated, isLoading } = useQuery<PaginatedResponse>({
    queryKey: ["/api/content/local-updates/page", citySlug, page, sourceFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        citySlug,
        page: String(page),
        limit: "20",
      });
      if (sourceFilter !== "all") params.set("sourceId", sourceFilter);
      const res = await fetch(`/api/content/local-updates/page?${params}`);
      if (!res.ok) throw new Error("Failed to fetch local updates");
      return res.json();
    },
  });

  return (
    <DarkPageShell maxWidth="wide" fillHeight>
      <div className="space-y-6" data-testid="page-local-updates">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2 text-white" data-testid="text-page-title">
          <Newspaper className="h-6 w-6" style={{ color: "hsl(var(--brand-sky))" }} />
          Local Updates — {cityName}
        </h1>
        <div className="flex items-center gap-2" data-testid="filter-source-container">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select
            value={sourceFilter}
            onValueChange={(val) => {
              setSourceFilter(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[200px]" data-testid="select-source-filter">
              <SelectValue placeholder="All Sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" data-testid="option-source-all">All Sources</SelectItem>
              {sources?.map((src) => (
                <SelectItem key={src.id} value={String(src.id)} data-testid={`option-source-${src.id}`}>
                  {src.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="p-4 space-y-3" data-testid={`skeleton-update-${i}`}>
              <Skeleton className="aspect-[16/9] w-full rounded-md" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </Card>
          ))}
        </div>
      ) : paginated && paginated.rows && paginated.rows.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paginated.rows.map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackView(item.id)}
                data-testid={`card-update-${item.id}`}
              >
                <Card className="hover-elevate cursor-pointer p-4 h-full flex flex-col gap-3">
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="w-full aspect-[16/9] object-cover rounded-md"
                      data-testid={`img-update-${item.id}`}
                    />
                  )}
                  <div className="flex-1 min-w-0 space-y-2">
                    <h3 className="font-semibold text-sm leading-tight line-clamp-3 flex items-start gap-1" data-testid={`title-update-${item.id}`}>
                      {item.title}
                      <ExternalLink className="h-3 w-3 shrink-0 mt-0.5 text-muted-foreground" />
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px]" data-testid={`badge-source-${item.id}`}>
                        {item.sourceName}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground" data-testid={`time-update-${item.id}`}>
                        {relativeTime(item.publishedAt)}
                      </span>
                    </div>
                    {item.summary && (
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4" data-testid={`summary-update-${item.id}`}>
                        {item.summary}
                      </p>
                    )}
                  </div>
                </Card>
              </a>
            ))}
          </div>

          <div className="flex items-center justify-center gap-4 pt-4" data-testid="pagination-controls">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground" data-testid="text-page-info">
              Page {paginated.page} of {Math.ceil(paginated.total / 20) || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= Math.ceil(paginated.total / 20)}
              onClick={() => setPage((p) => p + 1)}
              data-testid="button-next-page"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </>
      ) : (
        <div className="text-center py-16" data-testid="empty-state">
          <Newspaper className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground">No local updates available yet.</p>
        </div>
      )}
    </div>
    </DarkPageShell>
  );
}
