import { useQuery } from "@tanstack/react-query";
import { EventCard } from "@/components/content-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Moon, ArrowLeft, Clock, MapPin, Ticket } from "lucide-react";
import { Link } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useI18n } from "@/lib/i18n";
import { DarkPageShell } from "@/components/dark-page-shell";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface TonightEvent {
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
  rsvp_enabled?: boolean;
}

function normalizeEvent(e: TonightEvent) {
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

export default function EventsTonight({ citySlug }: { citySlug: string }) {
  const { t } = useI18n();

  usePageMeta({
    title: "What's Happening Tonight | Events",
    description: "Discover events happening tonight in your city — concerts, dining, nightlife, and more.",
    canonical: `${window.location.origin}/${citySlug}/events/tonight`,
  });

  const { data: events, isLoading } = useQuery<TonightEvent[]>({
    queryKey: ["/api/cities", citySlug, "events", "tonight"],
  });

  const today = format(new Date(), "EEEE, MMMM d");

  return (
    <DarkPageShell fillHeight>
      <div className="space-y-6">
        <div>
          <Link href={`/${citySlug}/events`}>
            <Button variant="ghost" size="sm" className="text-white/60 mb-2" data-testid="button-back-events">
              <ArrowLeft className="h-4 w-4 mr-1" /> All Events
            </Button>
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2 mb-1 text-white" data-testid="text-tonight-title">
            <Moon className="h-6 w-6 text-purple-400" />
            What's Happening Tonight
          </h1>
          <p className="text-white/50 text-sm">{today} &middot; 4 PM – Midnight</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-md bg-white/10 border border-white/10 p-4 space-y-3">
                <Skeleton className="aspect-[16/10] w-full rounded-md bg-white/5" />
                <Skeleton className="h-5 w-3/4 bg-white/5" />
                <Skeleton className="h-4 w-full bg-white/5" />
              </div>
            ))}
          </div>
        ) : events && events.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {events.map((evt) => (
              <div key={evt.id} className="space-y-2" data-testid={`tonight-event-${evt.id}`}>
                <EventCard event={normalizeEvent(evt)} citySlug={citySlug} />
                <div className="flex items-center gap-2 px-1">
                  <span className="text-xs text-white/40 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(new Date(evt.start_date_time), "h:mm a")}
                  </span>
                  {evt.location_name && (
                    <span className="text-xs text-white/40 flex items-center gap-1 truncate">
                      <MapPin className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{evt.location_name.split(",")[0]}</span>
                    </span>
                  )}
                  {evt.cost_text && !evt.cost_text.toLowerCase().includes("free") ? (
                    <Badge variant="outline" className="text-[10px] border-white/10 text-white/50">{evt.cost_text}</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] border-green-500/30 text-green-400">Free</Badge>
                  )}
                  <Link href={`/${citySlug}/events/${evt.slug}`} className="ml-auto">
                    <Button variant="outline" size="sm" className="h-7 text-xs border-purple-500/30 text-purple-300 hover:bg-purple-500/10 gap-1" data-testid={`button-rsvp-${evt.id}`}>
                      <Ticket className="h-3 w-3" />
                      {evt.rsvp_enabled ? "RSVP" : "Details"}
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-md bg-white/10 border border-white/10 p-12 text-center">
            <Moon className="mx-auto h-12 w-12 text-white/20 mb-4" />
            <h3 className="font-semibold text-lg mb-1 text-white" data-testid="text-tonight-empty">No events tonight</h3>
            <p className="text-white/50 text-sm">Check back later or browse all upcoming events.</p>
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
