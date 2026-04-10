import { useQuery } from "@tanstack/react-query";
import { EventCard } from "@/components/content-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Sun, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useI18n } from "@/lib/i18n";
import { DarkPageShell } from "@/components/dark-page-shell";

interface WeekendEvent {
  id: string;
  title: string;
  title_es?: string | null;
  slug: string;
  description?: string | null;
  description_es?: string | null;
  image_url?: string | null;
  start_date_time: string;
  end_date_time?: string | null;
  location_name?: string | null;
  cost_text?: string | null;
  is_featured: boolean;
  sponsor_business_ids?: string[] | null;
}

function normalizeEvent(e: WeekendEvent) {
  return {
    id: e.id,
    title: e.title,
    titleEs: e.title_es,
    slug: e.slug,
    description: e.description,
    descriptionEs: e.description_es,
    imageUrl: e.image_url,
    startDateTime: e.start_date_time,
    endDateTime: e.end_date_time,
    locationName: e.location_name,
    costText: e.cost_text,
    isFeatured: e.is_featured,
    sponsorBusinessIds: e.sponsor_business_ids,
  };
}

export default function EventsWeekend({ citySlug }: { citySlug: string }) {
  const { t } = useI18n();

  usePageMeta({
    title: "This Weekend | Events",
    description: "See what's happening this weekend — Friday through Sunday events near you.",
    canonical: `${window.location.origin}/${citySlug}/events/weekend`,
  });

  const { data: events, isLoading } = useQuery<WeekendEvent[]>({
    queryKey: ["/api/cities", citySlug, "events", "weekend"],
  });

  return (
    <DarkPageShell fillHeight>
      <div className="space-y-6">
        <div>
          <Link href={`/${citySlug}/events`}>
            <Button variant="ghost" size="sm" className="text-white/60 mb-2" data-testid="button-back-events">
              <ArrowLeft className="h-4 w-4 mr-1" /> All Events
            </Button>
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2 mb-1 text-white" data-testid="text-weekend-title">
            <Sun className="h-6 w-6 text-amber-400" />
            This Weekend
          </h1>
          <p className="text-white/50 text-sm">Friday 4 PM – Sunday Midnight</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-md bg-white/10 border border-white/10 p-4 space-y-3">
                <Skeleton className="aspect-[16/10] w-full rounded-md bg-white/5" />
                <Skeleton className="h-5 w-3/4 bg-white/5" />
                <Skeleton className="h-4 w-full bg-white/5" />
              </div>
            ))}
          </div>
        ) : events && events.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((evt) => (
              <EventCard key={evt.id} event={normalizeEvent(evt)} citySlug={citySlug} />
            ))}
          </div>
        ) : (
          <div className="rounded-md bg-white/10 border border-white/10 p-12 text-center">
            <Sun className="mx-auto h-12 w-12 text-white/20 mb-4" />
            <h3 className="font-semibold text-lg mb-1 text-white" data-testid="text-weekend-empty">No weekend events yet</h3>
            <p className="text-white/50 text-sm">Check back closer to the weekend for updates.</p>
            <Link href={`/${citySlug}/events`}>
              <Button variant="outline" size="sm" className="mt-4 border-white/20 text-white/70" data-testid="button-browse-all">
                Browse All Events
              </Button>
            </Link>
          </div>
        )}
      </div>
    </DarkPageShell>
  );
}
