import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Calendar, Building2, Heart, Compass, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { useI18n, localized } from "@/lib/i18n";

interface WildcardItem {
  type: "event" | "presence" | "organization";
  item: {
    id: string;
    name?: string;
    title?: string;
    titleEs?: string | null;
    slug: string;
    startDateTime?: string;
    description?: string | null;
    descriptionEs?: string | null;
    imageUrl?: string | null;
  };
}

interface WildcardPage {
  items: WildcardItem[];
  seed: string;
  hasMore: boolean;
}

export function WildcardFeed({ citySlug }: { citySlug: string }) {
  const { locale, t } = useI18n();
  const seed = useMemo(() => Math.random().toString(36).slice(2), []);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery<WildcardPage>({
    queryKey: ["/api/cities", citySlug, "wildcard-feed", seed],
    queryFn: async ({ pageParam }) => {
      const offset = (pageParam as number) * 12;
      const res = await fetch(
        `/api/cities/${citySlug}/wildcard-feed?limit=12&offset=${offset}&seed=${seed}`
      );
      if (!res.ok) throw new Error("Failed to fetch wildcard feed");
      return res.json();
    },
    initialPageParam: 0,
    getNextPageParam: (_lastPage, pages) =>
      _lastPage.hasMore ? pages.length : undefined,
  });

  const allItems = data?.pages.flatMap((p) => p.items) ?? [];

  const badgeLabel = (type: string) => {
    if (type === "event") return t("wildcard.event");
    if (type === "organization") return t("wildcard.organization");
    return t("wildcard.presence");
  };

  if (isLoading) {
    return (
      <section data-testid="section-wildcard-feed" className="section-band">
        <div className="flex items-center gap-2 mb-5">
          <Compass className="h-5 w-5" style={{ color: "hsl(var(--brand-teal))" }} />
          <h2 className="text-xl font-bold">{t("wildcard.title")}</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="p-4 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </Card>
          ))}
        </div>
      </section>
    );
  }

  if (allItems.length === 0) return null;

  return (
    <>
      <div className="gradient-divider my-4" aria-hidden="true" />
      <section data-testid="section-wildcard-feed" className="section-band">
        <div className="flex items-center gap-2 mb-5">
          <Compass className="h-5 w-5" style={{ color: "hsl(var(--brand-teal))" }} />
          <h2 className="text-xl font-bold">{t("wildcard.title")}</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {allItems.map((entry, idx) => {
            const isEvent = entry.type === "event";
            const displayName = isEvent
              ? localized(locale, entry.item.title, entry.item.titleEs)
              : entry.item.name;
            const href = isEvent
              ? `/${citySlug}/events/${entry.item.slug}`
              : `/${citySlug}/presence/${entry.item.slug}`;
            const Icon = isEvent ? Calendar : entry.type === "organization" ? Heart : Building2;
            const iconColor = isEvent
              ? "hsl(var(--brand-coral))"
              : "hsl(var(--brand-teal))";

            return (
              <Link key={`${entry.type}-${entry.item.id}-${idx}`} href={href}>
                <Card
                  className="hover-elevate cursor-pointer p-4 flex items-start gap-3"
                  data-testid={`card-wildcard-${entry.item.id}`}
                >
                  <div
                    className="p-2 rounded-lg shrink-0"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${iconColor} 12%, transparent)`,
                    }}
                  >
                    <Icon className="h-4 w-4" style={{ color: iconColor }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-sm leading-tight truncate">
                      {displayName}
                    </h3>
                    {isEvent && entry.item.startDateTime && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(entry.item.startDateTime), "MMM d, yyyy · h:mm a")}
                      </p>
                    )}
                    <Badge variant="outline" className="text-[10px] mt-1.5">
                      {badgeLabel(entry.type)}
                    </Badge>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>

        {isFetchingNextPage && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-4 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </Card>
            ))}
          </div>
        )}

        {hasNextPage && !isFetchingNextPage && (
          <div className="flex justify-center mt-6">
            <Button
              variant="outline"
              onClick={(e) => {
                e.preventDefault();
                fetchNextPage();
              }}
              data-testid="button-load-more-wildcard"
              className="gap-1"
            >
              {t("wildcard.loadMore")} <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </section>
    </>
  );
}
