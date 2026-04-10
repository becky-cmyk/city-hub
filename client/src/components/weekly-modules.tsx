import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Calendar, Building2, Heart } from "lucide-react";
import { format } from "date-fns";

interface WeeklyItem {
  type: "event" | "presence" | "organization";
  item: {
    id: string;
    name?: string;
    title?: string;
    slug: string;
    startDateTime?: string;
    description?: string | null;
  };
  sortOrder: number;
}

function WeeklyCard({
  entry,
  citySlug,
}: {
  entry: WeeklyItem;
  citySlug: string;
}) {
  const isEvent = entry.type === "event";
  const isOrg = entry.type === "organization";
  const displayName = isEvent ? entry.item.title : entry.item.name;
  const href = isEvent
    ? `/${citySlug}/events/${entry.item.slug}`
    : `/${citySlug}/presence/${entry.item.slug}`;
  const Icon = isEvent ? Calendar : isOrg ? Heart : Building2;
  const iconColor = isEvent
    ? "hsl(var(--brand-coral))"
    : "hsl(var(--brand-teal))";

  return (
    <Link href={href}>
      <Card
        className="hover-elevate cursor-pointer p-4 flex items-start gap-3 min-w-[260px] snap-start"
        data-testid={`card-weekly-${entry.item.id}`}
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
              {format(new Date(entry.item.startDateTime), "MMM d · h:mm a")}
            </p>
          )}
          <Badge variant="outline" className="text-[10px] mt-1.5">
            {isEvent ? "Event" : isOrg ? "Organization" : "Presence"}
          </Badge>
        </div>
      </Card>
    </Link>
  );
}

export function WeeklyModules({ citySlug }: { citySlug: string }) {
  const { data: weekItems, isLoading: loadingWeek } = useQuery<WeeklyItem[]>({
    queryKey: ["/api/cities", citySlug, "this-week"],
    queryFn: async () => {
      const res = await fetch(`/api/cities/${citySlug}/this-week`);
      if (!res.ok) throw new Error("Failed to fetch this week");
      return res.json();
    },
  });

  const { data: weekendItems, isLoading: loadingWeekend } = useQuery<
    WeeklyItem[]
  >({
    queryKey: ["/api/cities", citySlug, "this-weekend"],
    queryFn: async () => {
      const res = await fetch(`/api/cities/${citySlug}/this-weekend`);
      if (!res.ok) throw new Error("Failed to fetch this weekend");
      return res.json();
    },
  });

  const showWeek = !loadingWeek && weekItems && weekItems.length > 0;
  const showWeekend =
    !loadingWeekend && weekendItems && weekendItems.length > 0;

  if (!showWeek && !showWeekend && !loadingWeek && !loadingWeekend)
    return null;

  return (
    <>
      {(loadingWeek || showWeek) && (
        <>
          <div className="gradient-divider my-4" aria-hidden="true" />
          <section
            data-testid="section-this-week"
            className="section-band"
          >
            <div className="flex items-center gap-2 mb-4">
              <Calendar
                className="h-5 w-5"
                style={{ color: "hsl(var(--brand-coral))" }}
              />
              <h2 className="text-xl font-bold">This Week in Your Hub</h2>
            </div>
            {loadingWeek ? (
              <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory">
                {[1, 2, 3].map((i) => (
                  <Card
                    key={i}
                    className="p-4 space-y-2 min-w-[260px] snap-start"
                  >
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </Card>
                ))}
              </div>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory md:grid md:grid-cols-3 md:overflow-visible md:pb-0">
                {weekItems!.map((entry) => (
                  <WeeklyCard
                    key={`${entry.type}-${entry.item.id}`}
                    entry={entry}
                    citySlug={citySlug}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {(loadingWeekend || showWeekend) && (
        <>
          <div className="gradient-divider my-4" aria-hidden="true" />
          <section
            data-testid="section-this-weekend"
            className="section-band"
          >
            <div className="flex items-center gap-2 mb-4">
              <Calendar
                className="h-5 w-5"
                style={{ color: "hsl(var(--brand-coral))" }}
              />
              <h2 className="text-xl font-bold">This Weekend in Your Hub</h2>
            </div>
            {loadingWeekend ? (
              <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory">
                {[1, 2, 3].map((i) => (
                  <Card
                    key={i}
                    className="p-4 space-y-2 min-w-[260px] snap-start"
                  >
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </Card>
                ))}
              </div>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory md:grid md:grid-cols-3 md:overflow-visible md:pb-0">
                {weekendItems!.map((entry) => (
                  <WeeklyCard
                    key={`${entry.type}-${entry.item.id}`}
                    entry={entry}
                    citySlug={citySlug}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
