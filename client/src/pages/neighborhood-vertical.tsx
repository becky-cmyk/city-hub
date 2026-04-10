import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { getCityBranding, getBrandForContext } from "@shared/city-branding";
import { BizImage } from "@/components/biz-image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar, Briefcase, ShoppingBag, UtensilsCrossed, Users, MapPin,
  ChevronRight, ArrowRight, Building2, FileText, Clock, DollarSign, ArrowLeft,
} from "lucide-react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { JsonLd } from "@/components/json-ld";
import { DarkPageShell } from "@/components/dark-page-shell";

const VERTICAL_CONFIG: Record<string, {
  label: string;
  icon: typeof Calendar;
  color: string;
  schemaType: string;
  descFn: (hub: string, city: string) => string;
  titleFn: (hub: string, city: string) => string;
}> = {
  events: {
    label: "Events",
    icon: Calendar,
    color: "text-purple-400",
    schemaType: "Event",
    titleFn: (hub, city) => `Upcoming Events in ${hub}, ${city}`,
    descFn: (hub, city) => `Find upcoming events, concerts, festivals, and things to do in ${hub}, ${city}. Community events, family activities, and more.`,
  },
  jobs: {
    label: "Jobs",
    icon: Briefcase,
    color: "text-blue-400",
    schemaType: "JobPosting",
    titleFn: (hub, city) => `Jobs in ${hub}, ${city}`,
    descFn: (hub, city) => `Browse job openings near ${hub}, ${city}. Full-time, part-time, remote, and local career opportunities.`,
  },
  food: {
    label: "Food & Dining",
    icon: UtensilsCrossed,
    color: "text-orange-400",
    schemaType: "Restaurant",
    titleFn: (hub, city) => `Restaurants & Food in ${hub}, ${city}`,
    descFn: (hub, city) => `Discover the best restaurants, cafes, breweries, and food spots in ${hub}, ${city}.`,
  },
  family: {
    label: "Family & Kids",
    icon: Users,
    color: "text-pink-400",
    schemaType: "LocalBusiness",
    titleFn: (hub, city) => `Family Activities in ${hub}, ${city}`,
    descFn: (hub, city) => `Find kid-friendly activities, family events, schools, and more in ${hub}, ${city}.`,
  },
  marketplace: {
    label: "Marketplace",
    icon: ShoppingBag,
    color: "text-amber-400",
    schemaType: "ItemList",
    titleFn: (hub, city) => `Marketplace Listings near ${hub}, ${city}`,
    descFn: (hub, city) => `Browse local marketplace listings, jobs, rentals, and goods near ${hub}, ${city}.`,
  },
};

interface NeighborhoodVerticalProps {
  citySlug: string;
  code: string;
  verticalKey: string;
}

export default function NeighborhoodVertical({ citySlug, code, verticalKey }: NeighborhoodVerticalProps) {
  const config = VERTICAL_CONFIG[verticalKey];
  const cityName = citySlug.charAt(0).toUpperCase() + citySlug.slice(1);

  const { data: hubData, isLoading: hubLoading } = useQuery<{
    hub: { name: string; code: string; description: string | null };
    zipCodes: string[];
  }>({
    queryKey: ["/api/cities", citySlug, "neighborhoods", code, "info"],
    queryFn: async () => {
      const res = await fetch(`/api/cities/${citySlug}/neighborhoods/${code}`);
      if (!res.ok) throw new Error("Failed to load hub");
      return res.json();
    },
  });

  const hubName = hubData?.hub?.name || code.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  const { data: verticalData, isLoading: verticalLoading } = useQuery<{
    events?: any[];
    jobs?: any[];
    businesses?: any[];
  }>({
    queryKey: ["/api/cities", citySlug, "neighborhoods", code, "vertical", verticalKey],
    queryFn: async () => {
      if (verticalKey === "events") {
        const res = await fetch(`/api/cities/${citySlug}/events?zone=${code}&page=1&pageSize=12`);
        if (!res.ok) return { events: [] };
        const json = await res.json();
        return { events: json.events || [] };
      }
      if (verticalKey === "jobs") {
        const res = await fetch(`/api/cities/${citySlug}/jobs?zone=${code}&page=1&pageSize=12`);
        if (!res.ok) return { jobs: [] };
        const json = await res.json();
        return { jobs: json.jobs || [] };
      }
      const res = await fetch(`/api/cities/${citySlug}/verticals/${verticalKey}?hub=${code}`);
      if (!res.ok) return { businesses: [] };
      return res.json();
    },
  });

  const isLoading = hubLoading || verticalLoading;
  const Icon = config?.icon || Calendar;
  const pageTitle = config?.titleFn(hubName, cityName) || `${hubName} — ${cityName}`;
  const pageDesc = config?.descFn(hubName, cityName) || "";

  const nvBranding = getCityBranding(citySlug);
  const nvBrand = nvBranding ? getBrandForContext(nvBranding, "default") : null;
  usePageMeta({
    title: `${pageTitle} | ${nvBrand?.ogSiteName || "CLT Hub"}`,
    description: pageDesc,
    canonical: `${window.location.origin}/${citySlug}/neighborhoods/${code}/${verticalKey}`,
    ogType: "website",
    ogSiteName: nvBrand?.ogSiteName,
    ogTitle: pageTitle,
    ogDescription: pageDesc,
    keywords: `${verticalKey} ${hubName}, ${hubName} ${cityName}, ${verticalKey} near ${hubName}`,
  });

  const jsonLdData = verticalKey === "events" ? {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: pageTitle,
    description: pageDesc,
    url: `${window.location.origin}/${citySlug}/neighborhoods/${code}/${verticalKey}`,
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: cityName, item: `${window.location.origin}/${citySlug}` },
        { "@type": "ListItem", position: 2, name: "Neighborhoods", item: `${window.location.origin}/${citySlug}/neighborhoods` },
        { "@type": "ListItem", position: 3, name: hubName, item: `${window.location.origin}/${citySlug}/neighborhoods/${code}` },
        { "@type": "ListItem", position: 4, name: config?.label || verticalKey },
      ],
    },
  } : {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: pageTitle,
    description: pageDesc,
    url: `${window.location.origin}/${citySlug}/neighborhoods/${code}/${verticalKey}`,
  };

  return (
    <DarkPageShell maxWidth="wide">
      <JsonLd data={jsonLdData} />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: cityName, item: `${window.location.origin}/${citySlug}` },
          { "@type": "ListItem", position: 2, name: "Neighborhoods", item: `${window.location.origin}/${citySlug}/neighborhoods` },
          { "@type": "ListItem", position: 3, name: hubName, item: `${window.location.origin}/${citySlug}/neighborhoods/${code}` },
          { "@type": "ListItem", position: 4, name: config?.label || verticalKey },
        ],
      }} />

      <nav className="flex items-center gap-2 text-sm text-white/60 mb-6 flex-wrap" data-testid="nav-breadcrumb">
        <Link href={`/${citySlug}`} className="hover:text-white">{cityName}</Link>
        <ChevronRight className="h-3 w-3" />
        <Link href={`/${citySlug}/neighborhoods`} className="hover:text-white">Neighborhoods</Link>
        <ChevronRight className="h-3 w-3" />
        <Link href={`/${citySlug}/neighborhoods/${code}`} className="hover:text-white">{hubName}</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-white">{config?.label || verticalKey}</span>
      </nav>

      <section className="mb-8" data-testid="section-neighborhood-vertical-header">
        <Link href={`/${citySlug}/neighborhoods/${code}`}>
          <Button variant="ghost" size="sm" className="gap-1.5 mb-3 -ml-2 text-white/80 hover:text-white hover:bg-white/10" data-testid="link-back-hub">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to {hubName}
          </Button>
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
            <Icon className={`h-5 w-5 ${config?.color || "text-white"}`} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white" data-testid="text-neighborhood-vertical-title">
              {pageTitle}
            </h1>
          </div>
        </div>
        <p className="text-white/60 text-sm mt-2 max-w-2xl">{pageDesc}</p>
      </section>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 bg-white/10 rounded-xl" />)}
        </div>
      ) : (
        <>
          {verticalKey === "events" && verticalData?.events && verticalData.events.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="grid-events">
              {verticalData.events.map((evt: any) => (
                <Link key={evt.id} href={`/${citySlug}/events/${evt.slug}`}>
                  <Card className="h-full cursor-pointer transition-shadow hover:shadow-lg bg-white/5 border-white/10" data-testid={`card-event-${evt.id}`}>
                    {(evt.image_url || evt.imageUrl) && (
                      <div className="aspect-video overflow-hidden rounded-t-lg">
                        <img src={evt.image_url || evt.imageUrl} alt={evt.title} className="w-full h-full object-cover" loading="lazy" />
                      </div>
                    )}
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-sm text-white line-clamp-2">{evt.title}</h3>
                      <div className="flex items-center gap-2 text-xs text-white/50 mt-2">
                        <Clock className="h-3 w-3" />
                        {(evt.start_date_time || evt.startDateTime)
                          ? new Date(evt.start_date_time || evt.startDateTime).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
                          : "TBD"}
                      </div>
                      {(evt.location_name || evt.locationName) && (
                        <div className="flex items-center gap-2 text-xs text-white/50 mt-1">
                          <MapPin className="h-3 w-3" />
                          <span className="line-clamp-1">{evt.location_name || evt.locationName}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}

          {verticalKey === "jobs" && verticalData?.jobs && verticalData.jobs.length > 0 && (
            <div className="space-y-3" data-testid="grid-jobs">
              {verticalData.jobs.map((job: any) => (
                <Link key={job.id} href={`/${citySlug}/jobs/browse`}>
                  <div className="rounded-xl bg-white/5 border border-white/10 p-4 cursor-pointer hover:border-blue-500/30 transition-colors" data-testid={`card-job-${job.id}`}>
                    <h3 className="font-semibold text-sm text-white">{job.title}</h3>
                    {job.employer && (
                      <div className="flex items-center gap-1.5 text-xs text-white/50 mt-1">
                        <Building2 className="h-3 w-3" /> {job.employer}
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {job.locationText && (
                        <span className="flex items-center gap-1 text-xs text-white/40">
                          <MapPin className="h-3 w-3" /> {job.locationText}
                        </span>
                      )}
                      {job.employmentType && (
                        <Badge variant="outline" className="text-xs border-white/10 text-white/50">{job.employmentType}</Badge>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {(verticalKey === "food" || verticalKey === "family") && verticalData?.businesses && verticalData.businesses.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="grid-businesses">
              {verticalData.businesses.map((biz: any) => (
                <Link key={biz.id} href={`/${citySlug}/directory/${biz.slug}`}>
                  <Card className="h-full cursor-pointer transition-shadow hover:shadow-lg bg-white/5 border-white/10" data-testid={`card-business-${biz.id}`}>
                    <div className="aspect-video overflow-hidden rounded-t-lg bg-muted">
                      <BizImage src={biz.imageUrl} alt={biz.name} className="w-full h-full object-cover" />
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-sm text-white line-clamp-1">{biz.name}</h3>
                      {biz.tagline && <p className="text-xs text-white/50 line-clamp-2 mt-1">{biz.tagline}</p>}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}

          {(!verticalData || (
            (!verticalData.events || verticalData.events.length === 0) &&
            (!verticalData.jobs || verticalData.jobs.length === 0) &&
            (!verticalData.businesses || verticalData.businesses.length === 0)
          )) && (
            <Card className="p-8 text-center bg-white/5 border-white/10" data-testid="empty-state">
              <Icon className={`mx-auto h-10 w-10 text-white/20 mb-3`} />
              <h3 className="font-semibold text-base mb-1 text-white">No {config?.label || verticalKey} Yet</h3>
              <p className="text-white/50 text-sm">
                {config?.label || verticalKey} content for {hubName} is being built out. Check back soon!
              </p>
            </Card>
          )}
        </>
      )}

      <section className="mt-10 pt-8 border-t border-white/10" data-testid="section-cross-links">
        <h3 className="text-lg font-bold text-white mb-4">Explore More in {hubName}</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(VERTICAL_CONFIG).filter(([k]) => k !== verticalKey).map(([key, cfg]) => {
            const VIcon = cfg.icon;
            return (
              <Link key={key} href={`/${citySlug}/neighborhoods/${code}/${key}`}>
                <Badge variant="outline" className="cursor-pointer px-3 py-1.5 text-sm border-white/20 text-white/70 hover:bg-white/10 gap-1" data-testid={`link-vertical-${key}`}>
                  <VIcon className={`h-3 w-3 ${cfg.color}`} />
                  {cfg.label}
                </Badge>
              </Link>
            );
          })}
          <Link href={`/${citySlug}/neighborhoods/${code}`}>
            <Badge variant="outline" className="cursor-pointer px-3 py-1.5 text-sm border-white/20 text-white/70 hover:bg-white/10 gap-1" data-testid="link-hub-home">
              <MapPin className="h-3 w-3 text-emerald-400" />
              {hubName} Hub
            </Badge>
          </Link>
        </div>
      </section>
    </DarkPageShell>
  );
}
