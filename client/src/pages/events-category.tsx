import { useQuery } from "@tanstack/react-query";
import { EventCard } from "@/components/content-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tag, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { DarkPageShell } from "@/components/dark-page-shell";

interface CategoryEvent {
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

function normalizeEvent(e: CategoryEvent) {
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

export default function EventsCategory({ citySlug, categorySlug }: { citySlug: string; categorySlug: string }) {
  const { data, isLoading } = useQuery<{ category: { id: string; name: string; slug: string }; events: CategoryEvent[] }>({
    queryKey: ["/api/cities", citySlug, "events", "category", categorySlug],
  });

  usePageMeta({
    title: data?.category ? `${data.category.name} Events` : "Category Events",
    description: data?.category ? `Browse upcoming ${data.category.name} events near you.` : "Browse events by category.",
    canonical: `${window.location.origin}/${citySlug}/events/category/${categorySlug}`,
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
          <h1 className="text-2xl font-bold flex items-center gap-2 mb-1 text-white" data-testid="text-category-title">
            <Tag className="h-6 w-6 text-purple-400" />
            {data?.category?.name || "Category"} Events
          </h1>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-md bg-white/10 border border-white/10 p-4 space-y-3">
                <Skeleton className="aspect-[16/10] w-full rounded-md bg-white/5" />
                <Skeleton className="h-5 w-3/4 bg-white/5" />
              </div>
            ))}
          </div>
        ) : data?.events && data.events.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.events.map((evt) => (
              <EventCard key={evt.id} event={normalizeEvent(evt)} citySlug={citySlug} />
            ))}
          </div>
        ) : (
          <div className="rounded-md bg-white/10 border border-white/10 p-12 text-center">
            <Tag className="mx-auto h-12 w-12 text-white/20 mb-4" />
            <h3 className="font-semibold text-lg mb-1 text-white" data-testid="text-category-empty">No events in this category</h3>
            <p className="text-white/50 text-sm">Check back later for new events.</p>
          </div>
        )}
      </div>
    </DarkPageShell>
  );
}
