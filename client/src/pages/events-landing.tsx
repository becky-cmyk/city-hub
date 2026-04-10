import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, MapPin, Clock, ArrowRight, Star, TrendingUp, Sparkles, Users, ChevronRight, Moon, Sun, Music, Utensils, Ticket, FileText, HelpCircle, Building2, Camera } from "lucide-react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { JsonLd } from "@/components/json-ld";
import { LandingPageShell } from "@/components/landing-page-shell";
import { getCityBranding, getBrandForContext } from "@shared/city-branding";
import { format } from "date-fns";

interface CuratedData {
  tonight: EventRow[];
  weekend: EventRow[];
  categories: { id: string; name: string; slug: string; icon: string | null; event_count: number }[];
  totalUpcoming: number;
}

interface EventRow {
  id: string;
  title: string;
  slug: string;
  start_date_time: string;
  end_date_time?: string | null;
  location_name?: string | null;
  cost_text?: string | null;
  image_url?: string | null;
  is_sponsored?: boolean;
  description?: string | null;
}

interface EventStory {
  id: string;
  title: string;
  local_article_slug: string;
  rewritten_summary: string | null;
  image_url: string | null;
  source_name: string;
  published_at: string;
}

const EVENT_GRADIENTS = [
  "from-rose-900 via-pink-900 to-purple-900",
  "from-purple-900 via-indigo-900 to-blue-900",
  "from-amber-900 via-orange-900 to-red-900",
  "from-teal-900 via-emerald-900 to-green-900",
  "from-blue-900 via-cyan-900 to-teal-900",
  "from-fuchsia-900 via-pink-900 to-rose-900",
];

function LandingEventCard({ event, citySlug, size = "normal", storySlug }: { event: EventRow; citySlug: string; size?: "normal" | "hero"; storySlug?: string | null }) {
  const startDate = new Date(event.start_date_time);
  const gradientIdx = Math.abs(event.id.replace(/\D/g, "").slice(-2).charCodeAt(0) || 0) % EVENT_GRADIENTS.length;
  const hasImage = !!event.image_url;
  const heightClass = size === "hero" ? "h-[340px]" : "h-[260px]";

  return (
    <Link href={`/${citySlug}/events/${event.slug}`}>
      <div
        className={`relative ${heightClass} rounded-xl overflow-hidden cursor-pointer group`}
        data-testid={`landing-event-${event.id}`}
      >
        {hasImage ? (
          <img src={event.image_url!} alt={event.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${EVENT_GRADIENTS[gradientIdx]}`} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 rounded-lg px-2.5 py-1.5">
          <span className="text-[10px] uppercase tracking-wide text-white/80 font-semibold leading-none">{format(startDate, "MMM")}</span>
          <span className="text-lg font-bold text-white leading-none">{format(startDate, "d")}</span>
        </div>

        {event.is_sponsored && (
          <div className="absolute top-3 right-3">
            <Badge className="bg-purple-500/90 text-white border-0 text-[10px]">
              Sponsored
            </Badge>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className={`font-bold text-white leading-tight line-clamp-2 mb-2 ${size === "hero" ? "text-lg" : "text-base"}`}>
            {event.title}
          </h3>
          {size === "hero" && event.description && (
            <p className="text-sm text-white/70 line-clamp-2 mb-2">{event.description}</p>
          )}
          <div className="flex items-center gap-3 text-xs text-white/70 flex-wrap">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {format(startDate, "EEE, MMM d 'at' h:mm a")}
            </span>
            {event.location_name && (
              <span className="flex items-center gap-1 truncate max-w-[200px]">
                <MapPin className="h-3 w-3 shrink-0" />
                {event.location_name}
              </span>
            )}
            {event.cost_text && (
              <span className="font-semibold text-white/90">{event.cost_text}</span>
            )}
            {storySlug && (
              <span
                className="flex items-center gap-1 text-purple-300 cursor-pointer"
                data-testid={`landing-link-story-${event.id}`}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = `/${citySlug}/news/${storySlug}`; }}
              >
                <FileText className="h-3 w-3" />
                Full Story
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

const FAQ_ITEMS = [
  { q: "How do I find free events in Charlotte?", a: "Use our events page and filter by 'Free' to discover complimentary concerts, festivals, community gatherings, and cultural events happening across the Charlotte metro area." },
  { q: "What events are happening this weekend in Charlotte?", a: "Check our 'This Weekend' section for a curated list of the best events from Friday through Sunday, including live music, food festivals, family activities, and nightlife." },
  { q: "Where can I find live music in Charlotte?", a: "Charlotte's live music scene spans venues from the Blumenthal Performing Arts Center and PNC Music Pavilion to intimate spots in NoDa and Plaza Midwood. Browse our Music & Concerts category for upcoming shows." },
  { q: "How do I submit an event to CLT Hub?", a: "Business owners and event organizers can submit events through their CLT Hub dashboard (also known as CLT Metro Hub, Charlotte City Hub, and Charlotte Metro Hub). Community members can suggest events through our submission form." },
  { q: "Are there family-friendly events in Charlotte?", a: "Absolutely! Filter by Family & Kids to find activities at Discovery Place, the Charlotte Nature Museum, ImaginOn, local parks, and community centers throughout the metro." },
];

export default function EventsLanding({ citySlug }: { citySlug: string }) {
  const { data: curated, isLoading } = useQuery<CuratedData>({
    queryKey: ["/api/cities", citySlug, "events", "curated"],
    queryFn: async () => {
      const res = await fetch(`/api/cities/${citySlug}/events/curated`);
      if (!res.ok) return { tonight: [], weekend: [], categories: [], totalUpcoming: 0 };
      return res.json();
    },
  });

  const { data: seenAroundTown } = useQuery<any[]>({
    queryKey: ["/api/cities", citySlug, "seen-around-town"],
    queryFn: async () => {
      const res = await fetch(`/api/cities/${citySlug}/seen-around-town`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: stories } = useQuery<EventStory[]>({
    queryKey: ["/api/cities", citySlug, "events", "stories"],
    queryFn: async () => {
      const res = await fetch(`/api/cities/${citySlug}/events/stories`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const storyMap = useMemo(() => {
    const map = new Map<string, string>();
    if (stories) {
      for (const s of stories) {
        map.set(s.title.toLowerCase().trim(), s.local_article_slug);
      }
    }
    return map;
  }, [stories]);

  const cityName = "Charlotte";
  const totalEvents = curated?.totalUpcoming || 0;
  const branding = getCityBranding(citySlug);
  const brand = branding ? getBrandForContext(branding, "landing") : null;

  usePageMeta({
    title: `Events in ${cityName} NC — Concerts, Festivals, Things to Do ${brand?.titleSuffix || "| CLT Hub"}`,
    description: `Discover ${totalEvents || "hundreds of"} upcoming events in ${cityName}, North Carolina on ${brand?.descriptionBrand || "CLT Hub"}. Find concerts, festivals, food events, family activities, nightlife, and things to do this week in the ${cityName} metro area.`,
    canonical: `${window.location.origin}/${citySlug}/events`,
    ogType: "website",
    ogSiteName: brand?.ogSiteName,
    ogTitle: `Events in ${cityName} NC — What's Happening This Week`,
    ogDescription: `Find the best events, concerts, festivals, and things to do in ${cityName}. Updated daily with ${totalEvents}+ upcoming events.`,
    keywords: `${cityName} events, things to do ${cityName}, concerts ${cityName}, festivals ${cityName}, CLT Hub events, weekend events ${cityName}, ${cityName} NC events, Charlotte nightlife, family events Charlotte`,
  });

  const venueSpotlights = useMemo(() => {
    const allEvents = [
      ...(curated?.tonight || []),
      ...(curated?.weekend || []),
    ];
    const venueMap = new Map<string, EventRow[]>();
    for (const evt of allEvents) {
      if (!evt.location_name) continue;
      const name = evt.location_name;
      if (!venueMap.has(name)) venueMap.set(name, []);
      const list = venueMap.get(name)!;
      if (!list.find(e => e.id === evt.id)) list.push(evt);
    }
    return Array.from(venueMap.entries())
      .filter(([, evts]) => evts.length >= 1)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 6)
      .map(([name, events]) => ({ name, events }));
  }, [curated]);

  return (
    <LandingPageShell citySlug={citySlug} standalone>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: `Events in ${cityName}, NC`,
        description: `Discover upcoming events, concerts, festivals, and things to do in ${cityName}, North Carolina.`,
        url: `${window.location.origin}/${citySlug}/events`,
        isPartOf: { "@type": "WebSite", name: brand?.jsonLdName || "CLT Hub", alternateName: branding?.brandVariants || [], ...(brand?.sameAs && brand.sameAs.length > 0 && { sameAs: brand.sameAs }) },
        numberOfItems: totalEvents,
      }} />

      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: FAQ_ITEMS.map(faq => ({
          "@type": "Question",
          name: faq.q,
          acceptedAnswer: { "@type": "Answer", text: faq.a },
        })),
      }} />

      <section className="max-w-6xl mx-auto px-4 pt-14 pb-10 text-center" data-testid="section-events-hero">
        <Badge className="mb-5 bg-purple-600/20 text-purple-300 border-purple-500/30 text-xs px-3 py-1">EVENTS &amp; THINGS TO DO</Badge>
        <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-white mb-5 leading-tight" data-testid="text-events-landing-title">
          What's Happening in {cityName}
        </h1>
        <p className="text-lg md:text-xl text-white/60 max-w-3xl mx-auto mb-8 leading-relaxed">
          {totalEvents > 0
            ? `Discover ${totalEvents}+ upcoming events — concerts, festivals, food events, family activities, and more across the ${cityName} metro.`
            : `Discover concerts, festivals, food events, family activities, and more across the ${cityName} metro.`}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href={`/${citySlug}/events/browse`}>
            <Button className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-8 h-12 text-base font-semibold rounded-xl" data-testid="button-browse-events">
              Browse All Events <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
          <Link href={`/${citySlug}/events/browse?view=tonight`}>
            <Button variant="outline" className="border-white/20 text-white h-12 px-6 rounded-xl" data-testid="button-tonight">
              <Moon className="h-4 w-4 mr-2" /> Tonight
            </Button>
          </Link>
          <Link href={`/${citySlug}/events/browse?view=weekend`}>
            <Button variant="outline" className="border-white/20 text-white h-12 px-6 rounded-xl" data-testid="button-weekend">
              <Sun className="h-4 w-4 mr-2" /> This Weekend
            </Button>
          </Link>
        </div>
      </section>

      {isLoading && (
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-[200px] rounded-xl bg-white/5" />)}
          </div>
        </div>
      )}

      {curated?.categories && curated.categories.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 py-10" data-testid="section-categories">
          <h2 className="text-xl md:text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-purple-400" /> Explore by Category
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {curated.categories.map(cat => (
              <Link key={cat.id} href={`/${citySlug}/events/browse?category=${cat.slug}`}>
                <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 hover:border-white/20 transition-colors" data-testid={`landing-category-${cat.slug}`}>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/20">
                    <Calendar className="h-5 w-5 text-purple-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-white truncate">{cat.name}</div>
                    <div className="text-xs text-white/40">{cat.event_count} events</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {stories && stories.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 py-10" data-testid="section-event-stories">
          <h2 className="text-xl md:text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <FileText className="h-5 w-5 text-purple-400" /> Event Spotlights
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {stories.slice(0, 6).map(story => (
              <Link key={story.id} href={`/${citySlug}/news/${story.local_article_slug}`}>
                <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden cursor-pointer group hover:border-white/20 transition-colors" data-testid={`landing-story-${story.id}`}>
                  {story.image_url && (
                    <div className="aspect-video overflow-hidden">
                      <img src={story.image_url} alt={story.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <FileText className="h-3 w-3 text-purple-400" />
                      <span className="text-[10px] uppercase tracking-wide text-purple-400 font-semibold">{story.source_name}</span>
                    </div>
                    <h3 className="font-semibold text-sm text-white line-clamp-2 mb-1">{story.title}</h3>
                    {story.rewritten_summary && (
                      <p className="text-xs text-white/50 line-clamp-2">{story.rewritten_summary}</p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {venueSpotlights.length > 0 && (
        <>
          <JsonLd data={{
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: `Popular Event Venues in ${cityName}`,
            itemListElement: venueSpotlights.map((v, i) => ({
              "@type": "ListItem",
              position: i + 1,
              item: {
                "@type": "Place",
                name: v.name,
                address: {
                  "@type": "PostalAddress",
                  addressLocality: cityName,
                  addressRegion: "NC",
                  addressCountry: "US",
                },
                event: v.events.slice(0, 3).map(e => ({
                  "@type": "Event",
                  name: e.title,
                  startDate: e.start_date_time,
                })),
              },
            })),
          }} />
          <section className="max-w-6xl mx-auto px-4 py-10" data-testid="section-venues">
            <h2 className="text-xl md:text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-purple-400" /> Popular Venues
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {venueSpotlights.map(venue => (
                <div key={venue.name} className="rounded-xl bg-white/5 border border-white/10 p-5 hover:bg-white/10 hover:border-white/20 transition-colors" data-testid={`venue-card-${venue.name.replace(/\s+/g, "-").toLowerCase()}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/20">
                      <Building2 className="h-5 w-5 text-purple-400" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm text-white truncate">{venue.name}</h3>
                      <span className="text-xs text-white/40">{venue.events.length} upcoming event{venue.events.length !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {venue.events.slice(0, 3).map(evt => (
                      <Link key={evt.id} href={`/${citySlug}/events/${evt.slug}`}>
                        <div className="flex items-center gap-2 text-xs text-white/60 hover:text-white/90 transition-colors cursor-pointer py-0.5">
                          <Calendar className="h-3 w-3 shrink-0 text-purple-400/60" />
                          <span className="truncate">{evt.title}</span>
                          <span className="text-white/30 shrink-0 ml-auto">{format(new Date(evt.start_date_time), "MMM d")}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {seenAroundTown && seenAroundTown.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 py-10" data-testid="section-seen-around-town">
          <h2 className="text-xl md:text-2xl font-bold text-white mb-2 flex items-center gap-2">
            <Camera className="h-5 w-5 text-purple-400" /> Seen Around Town
          </h2>
          <p className="text-sm text-white/50 mb-6">AI-curated recaps from recent events across the metro</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {seenAroundTown.slice(0, 6).map((sat: any) => (
              <div key={sat.id} className="rounded-xl bg-white/5 border border-white/10 overflow-hidden group hover:border-white/20 transition-colors" data-testid={`sat-card-${sat.id}`}>
                {sat.cover_image_url && (
                  <div className="aspect-video overflow-hidden">
                    <img src={sat.cover_image_url} alt={sat.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Camera className="h-3 w-3 text-purple-400" />
                    <span className="text-[10px] uppercase tracking-wide text-purple-400 font-semibold">Seen Around Town</span>
                    {sat.generated_by_ai && (
                      <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-[9px] ml-auto">AI Generated</Badge>
                    )}
                  </div>
                  <h3 className="font-semibold text-sm text-white line-clamp-2 mb-1">{sat.title}</h3>
                  {sat.body && (
                    <p className="text-xs text-white/50 line-clamp-3">{sat.body.substring(0, 200)}</p>
                  )}
                  {sat.photo_highlights && sat.photo_highlights.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {sat.photo_highlights.slice(0, 4).map((photo: string, i: number) => (
                        <div key={i} className="h-12 w-12 rounded overflow-hidden">
                          <img src={photo} alt="" className="w-full h-full object-cover" loading="lazy" />
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-white/30">
                    <Calendar className="h-3 w-3" />
                    <span>{new Date(sat.publish_at).toLocaleDateString()}</span>
                    {sat.attendance_notes && <span className="text-white/40">· {sat.attendance_notes}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="max-w-6xl mx-auto px-4 py-10 grid grid-cols-1 md:grid-cols-3 gap-5" data-testid="section-highlights">
        {[
          { icon: Star, title: "Curated Picks", desc: `Hand-selected events from local editors covering the best things to do each week in ${cityName}.` },
          { icon: TrendingUp, title: "Always Updated", desc: "New events added daily from venues, promoters, and community organizations across the metro." },
          { icon: Sparkles, title: "Free & Paid", desc: "From free community gatherings to premium concert experiences — find something for every budget." },
        ].map((h, i) => (
          <div key={i} className="rounded-xl bg-white/5 border border-white/10 p-6" data-testid={`card-highlight-${i}`}>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/20">
                <h.icon className="h-4 w-4 text-purple-400" />
              </div>
              <h3 className="font-semibold text-white">{h.title}</h3>
            </div>
            <p className="text-white/60 text-sm leading-relaxed">{h.desc}</p>
          </div>
        ))}
      </section>

      <section className="max-w-4xl mx-auto px-4 py-10" data-testid="section-faq">
        <h2 className="text-xl md:text-2xl font-bold text-white mb-6 flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-purple-400" /> Frequently Asked Questions
        </h2>
        <div className="space-y-3">
          {FAQ_ITEMS.map((faq, i) => (
            <details key={i} className="group rounded-xl bg-white/5 border border-white/10 overflow-hidden" data-testid={`faq-item-${i}`}>
              <summary className="flex items-center justify-between p-5 cursor-pointer text-white font-medium text-sm hover:bg-white/5 transition-colors list-none">
                {faq.q}
                <ChevronRight className="h-4 w-4 text-white/40 transition-transform group-open:rotate-90 shrink-0 ml-4" />
              </summary>
              <div className="px-5 pb-5 text-sm text-white/60 leading-relaxed">
                {faq.a}
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-12 text-center" data-testid="section-cta">
        <div className="rounded-2xl bg-gradient-to-r from-purple-900/50 to-indigo-900/50 border border-white/10 p-8 md:p-12">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">Never Miss an Event</h2>
          <p className="text-white/60 mb-6 max-w-xl mx-auto leading-relaxed">
            Explore the full calendar, filter by neighborhood or category, and discover your next favorite experience in {cityName}.
          </p>
          <Link href={`/${citySlug}/events/browse`}>
            <Button className="bg-purple-600 text-white px-8 h-12 text-base font-semibold rounded-xl" data-testid="button-explore-events-cta">
              Explore All Events <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>
    </LandingPageShell>
  );
}
