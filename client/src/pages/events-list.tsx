import { useQuery } from "@tanstack/react-query";
import { useCityZones, useCategories } from "@/hooks/use-city";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ZoneSelect } from "@/components/zone-select";
import { Calendar, X, Search, List, Grid3X3, Moon, Sun, MapPin, Clock, ArrowRight, ChevronLeft, ChevronRight, Sparkles, Repeat, Music, Utensils, Ticket, TrendingUp, FileText } from "lucide-react";
import { useState, useMemo, useEffect, useRef } from "react";
import type { Event as EventType } from "@shared/schema";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useI18n } from "@/lib/i18n";
import { EventSponsorAdSlot } from "@/components/ad-banner";
import { useAuth } from "@/hooks/use-auth";
import { ScrollWallOverlay } from "@/components/scroll-wall";
import { DarkPageShell } from "@/components/dark-page-shell";
import { Link } from "wouter";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, getDay, isSameMonth } from "date-fns";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface CalendarEvent {
  id: string;
  title: string;
  slug: string;
  start_date_time: string;
  end_date_time?: string | null;
  location_name?: string | null;
  cost_text?: string | null;
  recurring_rule?: string | null;
}

interface CuratedData {
  tonight: DiscoverEvent[];
  weekend: DiscoverEvent[];
  categories: { id: string; name: string; slug: string; icon: string | null; event_count: number }[];
  totalUpcoming: number;
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

interface DiscoverEvent {
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
  is_sponsored?: boolean;
  priority_rank?: number | null;
  created_at: string;
}

interface DiscoverResponse {
  events: DiscoverEvent[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const EVENT_GRADIENTS = [
  "from-rose-900 via-pink-900 to-purple-900",
  "from-purple-900 via-indigo-900 to-blue-900",
  "from-amber-900 via-orange-900 to-red-900",
  "from-teal-900 via-emerald-900 to-green-900",
  "from-blue-900 via-cyan-900 to-teal-900",
  "from-fuchsia-900 via-pink-900 to-rose-900",
];

function EventTileCard({ event, citySlug, size = "normal", storySlug }: { event: DiscoverEvent; citySlug: string; size?: "normal" | "large" | "compact"; storySlug?: string | null }) {
  const startDate = new Date(event.start_date_time);
  const gradientIdx = Math.abs(event.id.replace(/\D/g, "").slice(-2).charCodeAt(0) || 0) % EVENT_GRADIENTS.length;
  const hasImage = !!event.image_url;

  const heightClass = size === "large" ? "h-[320px]" : size === "compact" ? "h-[200px]" : "h-[260px]";

  return (
    <Link href={`/${citySlug}/events/${event.slug}`}>
      <div
        className={`relative ${heightClass} rounded-xl overflow-hidden cursor-pointer group`}
        data-testid={`event-tile-${event.id}`}
      >
        {hasImage ? (
          <img
            src={event.image_url!}
            alt={event.title}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
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
            <Badge className="bg-purple-500/90 text-white border-0 text-[10px]" data-testid={`badge-sponsored-${event.id}`}>
              Sponsored
            </Badge>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="font-bold text-white text-base leading-tight line-clamp-2 mb-2">
            {event.title}
          </h3>
          <div className="flex items-center gap-3 text-xs text-white/70 flex-wrap">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {format(startDate, "h:mm a")}
            </span>
            {event.location_name && (
              <span className="flex items-center gap-1 truncate max-w-[180px]">
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
                data-testid={`link-story-${event.id}`}
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

interface MapEvent {
  id: string;
  title: string;
  slug: string;
  start_date_time: string;
  location_name?: string | null;
  latitude?: string | null;
  longitude?: string | null;
}

function createMapIcon() {
  const color = "#6366f1";
  return L.divIcon({
    className: "",
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24],
    html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="24" height="24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`,
  });
}

function MapBoundsUpdater({ events }: { events: MapEvent[] }) {
  const map = useMap();
  const hasSet = useRef(false);
  useEffect(() => {
    if (hasSet.current || events.length === 0) return;
    const valid = events.filter(e => e.latitude && e.longitude);
    if (valid.length === 0) return;
    const bounds = L.latLngBounds(valid.map(e => [parseFloat(e.latitude!), parseFloat(e.longitude!)] as [number, number]));
    map.fitBounds(bounds.pad(0.15));
    hasSet.current = true;
  }, [events, map]);
  return null;
}

function InlineEventMap({ citySlug }: { citySlug: string }) {
  const { data: mapEvents, isLoading } = useQuery<MapEvent[]>({
    queryKey: ["/api/cities", citySlug, "events", "map"],
  });

  const validEvents = (mapEvents || []).filter(e => e.latitude && e.longitude);
  const defaultCenter: [number, number] = [35.2271, -80.8431];
  const center = validEvents.length > 0
    ? [parseFloat(validEvents[0].latitude!), parseFloat(validEvents[0].longitude!)] as [number, number]
    : defaultCenter;

  if (isLoading) return <Skeleton className="h-[280px] rounded-xl bg-white/5" />;
  if (validEvents.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/20">
          <MapPin className="h-4 w-4 text-purple-400" />
        </div>
        <h2 className="text-lg font-bold text-white">Event Map</h2>
        <span className="text-xs text-white/40 ml-1">{validEvents.length} locations</span>
      </div>
      <div className="rounded-xl overflow-hidden border border-white/10 h-[280px]" data-testid="section-inline-map">
        <MapContainer
          center={center}
          zoom={11}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          <MapBoundsUpdater events={validEvents} />
          {validEvents.map(evt => (
            <Marker
              key={evt.id}
              position={[parseFloat(evt.latitude!), parseFloat(evt.longitude!)] as [number, number]}
              icon={createMapIcon()}
            >
              <Popup>
                <div className="text-xs">
                  <Link href={`/${citySlug}/events/${evt.slug}`}>
                    <span className="font-semibold text-purple-600 cursor-pointer">{evt.title}</span>
                  </Link>
                  {evt.location_name && <div className="text-gray-600 mt-0.5">{evt.location_name}</div>}
                  <div className="text-gray-500 mt-0.5">{format(new Date(evt.start_date_time), "MMM d, h:mm a")}</div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}

function EventCalendar({ citySlug }: { citySlug: string }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedCategory, setSelectedCategory] = useState("");
  const { data: allCategories } = useCategories();
  const parentCategories = useMemo(() => (allCategories || []).filter(c => !c.parentCategoryId), [allCategories]);

  const month = currentMonth.getMonth() + 1;
  const year = currentMonth.getFullYear();

  const calQueryKey = selectedCategory
    ? ["/api/cities", citySlug, "events", "calendar", `?month=${month}&year=${year}&category=${selectedCategory}`]
    : ["/api/cities", citySlug, "events", "calendar", `?month=${month}&year=${year}`];

  const { data: calEvents, isLoading } = useQuery<CalendarEvent[]>({
    queryKey: calQueryKey,
  });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const startDayOfWeek = getDay(monthStart);
  const paddingDays = Array.from({ length: startDayOfWeek }, (_, i) => i);

  const eventsForDay = (day: Date) =>
    (calEvents || []).filter(e => isSameDay(new Date(e.start_date_time), day));

  return (
    <div className="space-y-4">
      {parentCategories.length > 0 && (
        <div className="flex flex-wrap gap-2" data-testid="calendar-category-filters">
          <button
            onClick={() => setSelectedCategory("")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${!selectedCategory ? "bg-purple-500/30 text-purple-200 border border-purple-500/50" : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80"}`}
            data-testid="calendar-filter-all"
          >
            All
          </button>
          {parentCategories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(selectedCategory === cat.slug ? "" : cat.slug)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedCategory === cat.slug ? "bg-purple-500/30 text-purple-200 border border-purple-500/50" : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80"}`}
              data-testid={`calendar-filter-${cat.slug}`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-xl bg-white/5 border border-white/10 p-5">
        <div className="flex items-center justify-between mb-5">
          <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="text-white/60" data-testid="button-prev-month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="font-bold text-lg text-white" data-testid="text-calendar-month">
            {format(currentMonth, "MMMM yyyy")}
          </h3>
          <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="text-white/60" data-testid="button-next-month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-7 gap-px">
            {Array.from({ length: 35 }, (_, i) => (
              <Skeleton key={i} className="min-h-[72px] rounded-lg bg-white/5" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-px">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
              <div key={d} className="text-center text-[11px] text-white/40 font-semibold py-2">{d}</div>
            ))}
            {paddingDays.map(i => (
              <div key={`pad-${i}`} className="min-h-[72px]" />
            ))}
            {days.map(day => {
              const dayEvents = eventsForDay(day);
              const isToday = isSameDay(day, new Date());
              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-[72px] p-1.5 border border-white/5 rounded-lg ${isToday ? "bg-purple-500/10 border-purple-500/30" : ""}`}
                  data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
                >
                  <div className={`text-xs font-semibold mb-1 ${isToday ? "text-purple-400" : "text-white/60"}`}>
                    {format(day, "d")}
                  </div>
                  {dayEvents.slice(0, 2).map(evt => (
                    <Link key={evt.id} href={`/${citySlug}/events/${evt.slug}`}>
                      <div
                        className="text-[9px] truncate px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-200 mb-0.5 cursor-pointer hover:bg-purple-500/30 transition-colors"
                        data-testid={`calendar-event-${evt.id}`}
                      >
                        {evt.title}
                      </div>
                    </Link>
                  ))}
                  {dayEvents.length > 2 && (
                    <div className="text-[9px] text-white/40 px-1">+{dayEvents.length - 2} more</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function CuratedSection({ title, icon: Icon, events, citySlug, emptyMessage, storyMap }: {
  title: string;
  icon: typeof Calendar;
  events: DiscoverEvent[];
  citySlug: string;
  emptyMessage?: string;
  storyMap?: Map<string, string>;
}) {
  if (!events || events.length === 0) {
    if (!emptyMessage) return null;
    return (
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/20">
            <Icon className="h-4 w-4 text-purple-400" />
          </div>
          <h2 className="text-lg font-bold text-white">{title}</h2>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/10 p-8 text-center">
          <p className="text-white/40 text-sm">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/20">
          <Icon className="h-4 w-4 text-purple-400" />
        </div>
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <span className="text-xs text-white/40 ml-1">{events.length} events</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {events.slice(0, 6).map(evt => (
          <EventTileCard key={evt.id} event={evt} citySlug={citySlug} storySlug={storyMap?.get(evt.title.toLowerCase().trim())} />
        ))}
      </div>
    </div>
  );
}

function StoryCard({ story, citySlug }: { story: EventStory; citySlug: string }) {
  return (
    <Link href={`/${citySlug}/news/${story.local_article_slug}`}>
      <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden cursor-pointer group hover:border-white/20 transition-colors" data-testid={`story-card-${story.id}`}>
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
  );
}

export default function EventsList({ citySlug }: { citySlug: string }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { data: zones } = useCityZones(citySlug);
  const { data: allCategories } = useCategories();

  usePageMeta({
    title: t("meta.eventsTitle"),
    description: t("meta.eventsDesc"),
    canonical: `${window.location.origin}/${citySlug}/events`,
  });

  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const initialView = params.get("view");
  const initialCategory = params.get("category") || "";
  const [activeSection, setActiveSection] = useState<"discover" | "calendar" | "search">(
    initialView || initialCategory ? "search" : (params.get("q") ? "search" : "discover")
  );
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [searchQuery, setSearchQuery] = useState(params.get("q") || "");
  const [activeSearchQuery, setActiveSearchQuery] = useState(params.get("q") || "");
  const [selectedZone, setSelectedZone] = useState(params.get("zone") || "");
  const [costFilter, setCostFilter] = useState("");
  const [sortBy, setSortBy] = useState("soonest");
  const [page, setPage] = useState(1);
  const [timeFilter, setTimeFilter] = useState<string>(initialView || "");

  const parentCategories = allCategories?.filter((c) => !c.parentCategoryId) || [];

  const { data: curated, isLoading: curatedLoading } = useQuery<CuratedData>({
    queryKey: ["/api/cities", citySlug, "events", "curated"],
    queryFn: async () => {
      const res = await fetch(`/api/cities/${citySlug}/events/curated`);
      if (!res.ok) throw new Error("Failed to load curated events");
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

  const searchParams = useMemo(() => {
    const qp = new URLSearchParams();
    if (selectedCategory && selectedCategory !== "all") qp.set("category", selectedCategory);
    if (activeSearchQuery) qp.set("q", activeSearchQuery);
    if (selectedZone && selectedZone !== "all") qp.set("zone", selectedZone);
    if (costFilter && costFilter !== "all") qp.set("cost", costFilter);
    if (sortBy) qp.set("sort", sortBy);
    if (timeFilter === "tonight") {
      const today = new Date();
      qp.set("dateFrom", today.toISOString().split("T")[0]);
      qp.set("dateTo", today.toISOString().split("T")[0]);
    } else if (timeFilter === "weekend") {
      const now = new Date();
      const day = now.getDay();
      const fri = new Date(now);
      if (day === 0) fri.setDate(now.getDate() + 5);
      else if (day === 6) fri.setDate(now.getDate() - 1);
      else fri.setDate(now.getDate() + (5 - day));
      const sun = new Date(fri);
      sun.setDate(fri.getDate() + 2);
      qp.set("dateFrom", fri.toISOString().split("T")[0]);
      qp.set("dateTo", sun.toISOString().split("T")[0]);
    }
    qp.set("page", String(page));
    qp.set("pageSize", "21");
    return qp.toString();
  }, [selectedCategory, activeSearchQuery, selectedZone, costFilter, sortBy, page, timeFilter]);

  const { data: searchData, isLoading: searchLoading } = useQuery<DiscoverResponse>({
    queryKey: ["/api/cities", citySlug, "events", "discover", searchParams],
    queryFn: async () => {
      const res = await fetch(`/api/cities/${citySlug}/events/discover?${searchParams}`);
      if (!res.ok) throw new Error("Failed to load events");
      return res.json();
    },
    enabled: activeSection === "search",
  });

  const isSearchActive = activeSection === "search";
  const totalPages = searchData?.totalPages || 1;

  const handleSearch = () => {
    setActiveSearchQuery(searchQuery);
    setActiveSection("search");
    setPage(1);
  };

  const handleCategoryClick = (slug: string) => {
    setSelectedCategory(slug);
    setActiveSection("search");
    setPage(1);
  };

  return (
    <DarkPageShell fillHeight>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-1" data-testid="text-events-title">
              {t("events.title")}
            </h1>
            <p className="text-white/50 text-sm">
              {curated?.totalUpcoming
                ? `${curated.totalUpcoming} upcoming events across Charlotte`
                : t("events.subtitle")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={activeSection === "discover" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveSection("discover")}
            className={activeSection !== "discover" ? "border-white/10 text-white/70" : ""}
            data-testid="button-discover-view"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Discover
          </Button>
          <Button
            variant={activeSection === "calendar" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveSection("calendar")}
            className={activeSection !== "calendar" ? "border-white/10 text-white/70" : ""}
            data-testid="button-calendar-view"
          >
            <Grid3X3 className="h-3.5 w-3.5 mr-1.5" /> Calendar
          </Button>
          <Button
            variant={activeSection === "search" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveSection("search")}
            className={activeSection !== "search" ? "border-white/10 text-white/70" : ""}
            data-testid="button-search-view"
          >
            <Search className="h-3.5 w-3.5 mr-1.5" /> Search
          </Button>
          <div className="ml-auto">
            <Link href={`/${citySlug}/events/map`}>
              <Button variant="outline" size="sm" className="border-white/10 text-white/70 gap-1.5" data-testid="link-map">
                <MapPin className="h-3.5 w-3.5" /> Map
              </Button>
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search events..."
              className="h-10 pl-9 pr-10 text-sm bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl"
              data-testid="input-events-search"
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(""); setActiveSearchQuery(""); if (isSearchActive) setActiveSection("discover"); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40" data-testid="button-clear-event-search">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {searchQuery && (
            <Button size="sm" onClick={handleSearch} data-testid="button-search-events">
              Search
            </Button>
          )}
        </div>

        <EventSponsorAdSlot citySlug={citySlug} page="events" />

        {activeSection === "discover" && (
          <div>
            {curatedLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <Skeleton key={i} className="h-[260px] rounded-xl bg-white/5" />
                ))}
              </div>
            ) : (
              <>
                {curated?.tonight && curated.tonight.length > 0 && (
                  <CuratedSection title="Tonight" icon={Moon} events={curated.tonight} citySlug={citySlug} storyMap={storyMap} />
                )}

                {curated?.weekend && curated.weekend.length > 0 && (
                  <CuratedSection title="This Weekend" icon={Sun} events={curated.weekend} citySlug={citySlug} storyMap={storyMap} />
                )}


                <InlineEventMap citySlug={citySlug} />

                {curated?.categories && curated.categories.length > 0 && (
                  <div className="mb-8">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/20">
                        <TrendingUp className="h-4 w-4 text-purple-400" />
                      </div>
                      <h2 className="text-lg font-bold text-white">Browse by Category</h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {curated.categories.map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => handleCategoryClick(cat.slug)}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 hover:border-white/20 transition-colors"
                          data-testid={`category-pill-${cat.slug}`}
                        >
                          <span className="text-sm font-medium">{cat.name}</span>
                          <span className="text-xs text-white/40">{cat.event_count}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {stories && stories.length > 0 && (
                  <div className="mb-8">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/20">
                        <FileText className="h-4 w-4 text-purple-400" />
                      </div>
                      <h2 className="text-lg font-bold text-white">Event Stories</h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {stories.slice(0, 6).map(story => (
                        <StoryCard key={story.id} story={story} citySlug={citySlug} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeSection === "calendar" && (
          <EventCalendar citySlug={citySlug} />
        )}

        {activeSection === "search" && (
          <div>
            <div className="flex flex-wrap gap-2 mb-4">
              <Select value={selectedCategory} onValueChange={(v) => { setSelectedCategory(v); setPage(1); }}>
                <SelectTrigger className="w-[170px] bg-white/5 border-white/10 text-white rounded-xl" data-testid="select-category-filter">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {parentCategories.map((c) => (
                    <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <ZoneSelect zones={zones || []} value={selectedZone} onValueChange={setSelectedZone} triggerClassName="w-[160px] bg-white/5 border-white/10 text-white rounded-xl" testId="select-zone-filter" />
              <Select value={costFilter} onValueChange={(v) => { setCostFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[130px] bg-white/5 border-white/10 text-white rounded-xl" data-testid="select-cost-filter">
                  <SelectValue placeholder="All Prices" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Prices</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setPage(1); }}>
                <SelectTrigger className="w-[150px] bg-white/5 border-white/10 text-white rounded-xl" data-testid="select-sort">
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="soonest">Soonest</SelectItem>
                  <SelectItem value="trending">Trending</SelectItem>
                  <SelectItem value="recent">Recently Added</SelectItem>
                </SelectContent>
              </Select>
              {(selectedCategory || selectedZone || costFilter || activeSearchQuery) && (
                <Button variant="ghost" size="sm" onClick={() => { setSelectedCategory(""); setSelectedZone(""); setCostFilter(""); setSearchQuery(""); setActiveSearchQuery(""); setPage(1); }} className="text-xs text-white/50" data-testid="button-clear-filters">
                  <X className="h-3 w-3 mr-1" /> Clear
                </Button>
              )}
            </div>

            {searchLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <Skeleton key={i} className="h-[260px] rounded-xl bg-white/5" />
                ))}
              </div>
            ) : searchData?.events && searchData.events.length > 0 ? (
              <>
                {(() => {
                  const PREVIEW_COUNT = 6;
                  const displayEvents = !user && searchData.events.length > PREVIEW_COUNT ? searchData.events.slice(0, PREVIEW_COUNT) : searchData.events;
                  const showWall = !user && searchData.events.length > PREVIEW_COUNT;

                  return (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {displayEvents.map(evt => (
                          <EventTileCard key={evt.id} event={evt} citySlug={citySlug} />
                        ))}
                      </div>
                      {showWall && <ScrollWallOverlay />}
                      {!showWall && totalPages > 1 && (
                        <div className="flex items-center justify-center gap-3 pt-6">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page <= 1}
                            className="border-white/10 text-white/70"
                            data-testid="button-prev-page"
                          >
                            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                          </Button>
                          <span className="text-sm text-white/60" data-testid="text-page-info">
                            Page {page} of {totalPages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                            className="border-white/10 text-white/70"
                            data-testid="button-next-page"
                          >
                            Next <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </>
            ) : (
              <div className="rounded-xl bg-white/5 border border-white/10 p-12 text-center">
                <Calendar className="mx-auto h-12 w-12 text-white/20 mb-4" />
                <h3 className="font-semibold text-lg mb-1 text-white">{t("events.noResults")}</h3>
                <p className="text-white/50 text-sm">{t("events.noResultsHint")}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </DarkPageShell>
  );
}
