import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRegisterAdminEdit } from "@/hooks/use-admin-edit";
import { Calendar, MapPin, ArrowLeft, Clock, Users, Repeat, Share2, ChevronDown, Store, Star } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { useState, useMemo } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useI18n } from "@/lib/i18n";
import { ShareMenu } from "@/components/share-menu";
import { DarkPageShell } from "@/components/dark-page-shell";
import { Archive } from "lucide-react";

interface SeriesData {
  id: string;
  title: string;
  title_es?: string;
  slug: string;
  description?: string;
  description_es?: string;
  image_url?: string;
  host_presence_name?: string;
  host_presence_slug?: string;
  host_image_url?: string;
  venue_presence_name?: string;
  venue_presence_slug?: string;
  venue_image_url?: string;
  recurrence_type: string;
  default_location_name?: string;
  default_address?: string;
  default_city?: string;
  default_state?: string;
  default_zip?: string;
  default_cost_text?: string;
  default_start_time?: string;
  status: string;
  archived_at?: string | null;
  upcoming_occurrences: any[];
  past_occurrences: any[];
  total_occurrences: number;
}

const RECURRENCE_LABELS: Record<string, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  custom: "Custom Schedule",
  none: "One-time",
};

export default function EventSeriesDetail({ citySlug, slug }: { citySlug: string; slug: string }) {
  const { t } = useI18n();

  const { data: series, isLoading } = useQuery<SeriesData>({
    queryKey: ["/api/event-series/by-slug", slug],
    queryFn: async () => {
      const resp = await fetch(`/api/event-series/by-slug/${slug}?citySlug=${encodeURIComponent(citySlug)}`);
      if (!resp.ok) throw new Error("Not found");
      return resp.json();
    },
  });

  useRegisterAdminEdit("event-collections", series?.id, "Edit Series");

  usePageMeta({
    title: series ? `${series.title} | Event Series` : "Event Series",
    description: series?.description?.slice(0, 160) || "Recurring event series",
    canonical: `${window.location.origin}/${citySlug}/events/series/${slug}`,
  });

  if (isLoading) {
    return (
      <DarkPageShell maxWidth="wide">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64 bg-white/10" />
          <Skeleton className="aspect-[3/1] w-full rounded-md bg-white/10" />
          <Skeleton className="h-24 w-full bg-white/10" />
        </div>
      </DarkPageShell>
    );
  }

  if (!series) {
    return (
      <DarkPageShell maxWidth="wide">
        <Card className="p-12 text-center bg-white/5 border-white/10">
          <h3 className="font-semibold text-lg mb-1 text-white" data-testid="text-series-not-found">Series not found</h3>
          <Link href={`/${citySlug}/events`}>
            <Button variant="ghost" className="mt-2 text-white/60" data-testid="link-back-events">Back to events</Button>
          </Link>
        </Card>
      </DarkPageShell>
    );
  }

  const upcoming = series.upcoming_occurrences || [];
  const past = series.past_occurrences || [];
  const isArchived = series.status === "archived" || !!series.archived_at;

  const pastByYear = useMemo(() => {
    const yearMap = new Map<number, any[]>();
    past.forEach((occ: any) => {
      const year = new Date(occ.start_date_time).getFullYear();
      if (!yearMap.has(year)) yearMap.set(year, []);
      yearMap.get(year)!.push(occ);
    });
    return Array.from(yearMap.entries()).sort((a, b) => b[0] - a[0]);
  }, [past]);

  const [expandedYear, setExpandedYear] = useState<number | null>(null);

  return (
    <DarkPageShell maxWidth="wide">
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Link href={`/${citySlug}/events`}>
            <Button variant="ghost" size="sm" className="text-white/60" data-testid="link-back-events">
              <ArrowLeft className="h-4 w-4 mr-1" /> Events
            </Button>
          </Link>
        </div>

        {series.image_url && (
          <div className="aspect-[3/1] rounded-lg overflow-hidden" data-testid="img-series-banner">
            <img src={series.image_url} alt={series.title} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-2">
              <h1 className="text-2xl md:text-3xl font-bold text-white" data-testid="text-series-title">
                {series.title}
              </h1>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="bg-purple-500/20 text-purple-200 border-purple-500/30" data-testid="badge-recurrence">
                  <Repeat className="h-3 w-3 mr-1" />
                  {RECURRENCE_LABELS[series.recurrence_type] || series.recurrence_type}
                </Badge>
                {isArchived && (
                  <Badge variant="outline" className="text-amber-300 border-amber-500/30" data-testid="badge-archived">
                    <Archive className="h-3 w-3 mr-1" /> Archived
                  </Badge>
                )}
                {series.status !== "active" && series.status !== "archived" && (
                  <Badge variant="outline" className="text-yellow-300 border-yellow-500/30" data-testid="badge-status">
                    {series.status}
                  </Badge>
                )}
              </div>
            </div>
            <ShareMenu
              url={`${window.location.origin}/${citySlug}/events/series/${slug}`}
              title={series.title}
            />
          </div>

          {series.description && (
            <p className="text-white/70 leading-relaxed" data-testid="text-series-description">
              {series.description}
            </p>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            {(series.host_presence_name || series.venue_presence_name) && (
              <Card className="p-4 bg-white/5 border-white/10 space-y-3">
                {series.host_presence_name && (
                  <div className="flex items-center gap-3">
                    {series.host_image_url ? (
                      <img src={series.host_image_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                        <Users className="h-5 w-5 text-purple-300" />
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-white/40">Hosted by</p>
                      <Link href={`/${citySlug}/directory/${series.host_presence_slug}`}>
                        <span className="text-sm font-medium text-white hover:text-purple-300 cursor-pointer" data-testid="link-host-presence">
                          {series.host_presence_name}
                        </span>
                      </Link>
                    </div>
                  </div>
                )}
                {series.venue_presence_name && (
                  <div className="flex items-center gap-3">
                    {series.venue_image_url ? (
                      <img src={series.venue_image_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <Store className="h-5 w-5 text-blue-300" />
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-white/40">Venue</p>
                      <Link href={`/${citySlug}/directory/${series.venue_presence_slug}`}>
                        <span className="text-sm font-medium text-white hover:text-blue-300 cursor-pointer" data-testid="link-venue-presence">
                          {series.venue_presence_name}
                        </span>
                      </Link>
                    </div>
                  </div>
                )}
              </Card>
            )}

            <Card className="p-4 bg-white/5 border-white/10 space-y-2">
              {series.default_location_name && (
                <p className="text-sm text-white/70 flex items-center gap-2" data-testid="text-series-location">
                  <MapPin className="h-4 w-4 text-white/40 shrink-0" />
                  {series.default_location_name}
                </p>
              )}
              {series.default_address && (
                <p className="text-xs text-white/40 pl-6">
                  {[series.default_address, series.default_city, series.default_state, series.default_zip].filter(Boolean).join(", ")}
                </p>
              )}
              {series.default_start_time && (
                <p className="text-sm text-white/70 flex items-center gap-2" data-testid="text-series-time">
                  <Clock className="h-4 w-4 text-white/40 shrink-0" />
                  {series.default_start_time}
                </p>
              )}
              {series.default_cost_text && (
                <p className="text-sm text-white/70" data-testid="text-series-cost">
                  💰 {series.default_cost_text}
                </p>
              )}
            </Card>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2" data-testid="text-upcoming-heading">
            <Calendar className="h-5 w-5 text-purple-400" />
            Upcoming Dates ({upcoming.length})
          </h2>

          {upcoming.length === 0 ? (
            <Card className="p-8 text-center bg-white/5 border-white/10">
              <Calendar className="h-10 w-10 text-white/20 mx-auto mb-3" />
              <p className="text-white/50" data-testid="text-no-upcoming">No upcoming dates scheduled</p>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((occ: any) => (
                <Link key={occ.id} href={`/${citySlug}/events/${occ.slug}`}>
                  <Card className="p-4 bg-white/5 border-white/10 space-y-2 cursor-pointer hover:bg-white/10 transition-colors" data-testid={`card-occurrence-${occ.id}`}>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-purple-400" />
                      <span className="text-sm font-medium text-purple-300">
                        {format(new Date(occ.start_date_time), "EEEE, MMM d, yyyy")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-white/50">
                      <Clock className="h-3 w-3" />
                      {format(new Date(occ.start_date_time), "h:mm a")}
                      {occ.end_date_time && ` – ${format(new Date(occ.end_date_time), "h:mm a")}`}
                    </div>
                    {occ.location_name && (
                      <p className="text-xs text-white/40 flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {occ.location_name}
                      </p>
                    )}
                    {occ.occurrence_status === "cancelled" && (
                      <Badge variant="destructive" className="text-[10px]">Cancelled</Badge>
                    )}
                    {occ.occurrence_status === "skipped" && (
                      <Badge variant="outline" className="text-[10px] text-yellow-300 border-yellow-500/30">Skipped</Badge>
                    )}
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        {pastByYear.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2" data-testid="text-past-heading">
              <Archive className="h-5 w-5 text-white/40" />
              Past Events ({past.length})
            </h2>
            <div className="space-y-2">
              {pastByYear.map(([year, yearEvents]) => (
                <div key={year}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedYear(expandedYear === year ? null : year)}
                    className="text-white/60 flex items-center gap-1 w-full justify-start"
                    data-testid={`button-year-${year}`}
                  >
                    <ChevronDown className={`h-4 w-4 transition-transform ${expandedYear === year ? "rotate-180" : ""}`} />
                    {year} ({yearEvents.length} event{yearEvents.length !== 1 ? "s" : ""})
                  </Button>
                  {expandedYear === year && (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 mt-2 ml-4">
                      {yearEvents.map((occ: any) => (
                        <Link key={occ.id} href={`/${citySlug}/events/${occ.slug}`}>
                          <Card className="p-3 bg-white/5 border-white/10 opacity-60 cursor-pointer hover:opacity-80 transition-opacity" data-testid={`card-past-occ-${occ.id}`}>
                            <div className="flex items-center gap-2 text-xs text-white/40">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(occ.start_date_time), "MMM d, yyyy")}
                            </div>
                            <p className="text-sm text-white/60 mt-1">{occ.title}</p>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DarkPageShell>
  );
}
