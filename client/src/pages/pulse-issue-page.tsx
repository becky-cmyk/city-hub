import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useParams } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Newspaper, MapPin, Zap, Building2, Gift, ArrowRight, ExternalLink } from "lucide-react";
import { BizImage } from "@/components/biz-image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useRef } from "react";

interface PulseIssuePageProps {
  citySlug: string;
}

interface EnrichedEntry {
  type: string;
  businessId?: string;
  name?: string;
  slug?: string;
  imageUrl?: string;
  tagline?: string;
  description?: string;
  address?: string;
  latitude?: string;
  longitude?: string;
  ctaText?: string;
  ctaUrl?: string;
}

interface PickupLocation {
  name: string;
  address: string;
  latitude?: string | null;
  longitude?: string | null;
}

interface PulseIssueData {
  id: string;
  slug: string;
  title: string;
  issueNumber: number;
  intro?: string | null;
  heroImageUrl?: string | null;
  heroCtaText?: string | null;
  heroCtaUrl?: string | null;
  featuredStoryTitle?: string | null;
  featuredStoryImage?: string | null;
  featuredStoryBody?: string | null;
  featuredStoryCtaText?: string | null;
  featuredStoryCtaUrl?: string | null;
  quickHits?: string[];
  featuredBusinesses?: EnrichedEntry[];
  advertisers?: EnrichedEntry[];
  giveawayEnabled?: boolean;
  giveawayTitle?: string | null;
  giveawayText?: string | null;
  giveawayCtaText?: string | null;
  giveawayCtaUrl?: string | null;
  conversionTitle?: string | null;
  conversionText?: string | null;
  conversionCtaText?: string | null;
  conversionCtaUrl?: string | null;
  pickupLocations?: PickupLocation[];
  publishedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export default function PulseIssuePage({ citySlug }: PulseIssuePageProps) {
  const params = useParams<{ hubSlug: string; issueSlug: string }>();
  const hubSlug = params.hubSlug;
  const issueSlug = params.issueSlug;

  const { data: issue, isLoading, error } = useQuery<PulseIssueData>({
    queryKey: ["/api/cities", citySlug, "hub", hubSlug, "pulse", issueSlug],
    queryFn: () => apiRequest("GET", `/api/cities/${citySlug}/hub/${hubSlug}/pulse/${issueSlug}`).then(r => r.json()),
    enabled: !!citySlug && !!hubSlug && !!issueSlug,
  });

  const canonicalUrl = issue
    ? `${window.location.origin}/${citySlug}/hub/${hubSlug}/pulse/${issue.slug}`
    : undefined;

  const ogImage = issue?.heroImageUrl || issue?.featuredStoryImage || undefined;
  const metaDescription = issue?.intro || "Your local community pulse — stories, businesses, and what's happening nearby.";

  usePageMeta({
    title: issue ? `${issue.title} | Hub Pulse` : "Hub Pulse",
    description: metaDescription,
    canonical: canonicalUrl,
    ogTitle: issue ? `${issue.title} | Hub Pulse` : "Hub Pulse",
    ogDescription: metaDescription,
    ogImage: ogImage || undefined,
    ogUrl: canonicalUrl,
    ogType: "article",
    twitterCard: "summary_large_image",
    twitterTitle: issue ? `${issue.title} | Hub Pulse` : "Hub Pulse",
    twitterDescription: metaDescription,
    twitterImage: ogImage || undefined,
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <Newspaper className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Issue Not Found</h1>
        <p className="text-muted-foreground">This pulse issue may not be published yet.</p>
      </div>
    );
  }

  const quickHits = (issue.quickHits as string[]) || [];
  const featuredBusinesses: EnrichedEntry[] = (issue.featuredBusinesses as EnrichedEntry[]) || [];
  const advertisers: EnrichedEntry[] = (issue.advertisers as EnrichedEntry[]) || [];
  const pickupLocs: PickupLocation[] = (issue.pickupLocations as PickupLocation[]) || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      <JsonLdScript issue={issue} citySlug={citySlug} hubSlug={hubSlug!} />

      {issue.heroImageUrl && (
        <div className="relative w-full h-64 md:h-80 overflow-hidden" data-testid="section-hero">
          <img
            src={issue.heroImageUrl}
            alt={issue.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
          <div className="absolute bottom-6 left-6 right-6">
            <Badge className="bg-amber-500 text-white mb-2">Issue #{issue.issueNumber}</Badge>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2" data-testid="text-issue-title">{issue.title}</h1>
            {issue.heroCtaText && issue.heroCtaUrl && (
              <a href={issue.heroCtaUrl}>
                <Button className="bg-amber-500 hover:bg-amber-600 text-white" data-testid="button-hero-cta">
                  {issue.heroCtaText} <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </a>
            )}
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-12">
        {!issue.heroImageUrl && (
          <div className="text-center space-y-3 pt-4" data-testid="section-header">
            <Badge className="bg-amber-500 text-white">Issue #{issue.issueNumber}</Badge>
            <h1 className="text-3xl md:text-4xl font-bold" data-testid="text-issue-title">{issue.title}</h1>
          </div>
        )}

        {issue.intro && (
          <div className="text-center max-w-2xl mx-auto" data-testid="section-intro">
            <p className="text-lg text-muted-foreground leading-relaxed">{issue.intro}</p>
          </div>
        )}

        {issue.featuredStoryTitle && (
          <section className="space-y-4" data-testid="section-featured-story">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-px flex-1 bg-border" />
              <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-600">Featured Story</h2>
              <div className="h-px flex-1 bg-border" />
            </div>

            <Card className="overflow-hidden">
              {issue.featuredStoryImage && (
                <img src={issue.featuredStoryImage} alt={issue.featuredStoryTitle} className="w-full h-48 md:h-64 object-cover" />
              )}
              <CardContent className="p-6 space-y-4">
                <h3 className="text-2xl font-bold" data-testid="text-story-title">{issue.featuredStoryTitle}</h3>
                <div className="prose prose-slate dark:prose-invert max-w-none">
                  {issue.featuredStoryBody?.split("\n\n").map((paragraph: string, i: number) => (
                    <p key={i}>{paragraph}</p>
                  ))}
                </div>
                {issue.featuredStoryCtaText && issue.featuredStoryCtaUrl && (
                  <a href={issue.featuredStoryCtaUrl}>
                    <Button variant="outline" data-testid="button-story-cta">
                      {issue.featuredStoryCtaText} <ExternalLink className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </a>
                )}
              </CardContent>
            </Card>
          </section>
        )}

        {quickHits.length > 0 && (
          <section data-testid="section-quick-hits">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-px flex-1 bg-border" />
              <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-600 flex items-center gap-1">
                <Zap className="h-4 w-4" /> Quick Hits
              </h2>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {quickHits.map((hit: string, i: number) => (
                <Card key={i} className="border-l-4 border-l-amber-500">
                  <CardContent className="py-3 px-4">
                    <p className="text-sm" data-testid={`text-quick-hit-${i}`}>{hit}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {featuredBusinesses.length > 0 && (
          <section data-testid="section-featured-businesses">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-px flex-1 bg-border" />
              <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-600 flex items-center gap-1">
                <Building2 className="h-4 w-4" /> Featured Businesses
              </h2>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featuredBusinesses.map((biz, i) => (
                <Card key={i} className="overflow-hidden hover:shadow-md transition-shadow" data-testid={`card-featured-biz-${i}`}>
                  <BizImage src={biz.imageUrl} alt={biz.name || ""} className="w-full h-32 object-cover" />
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-1">{biz.name || "Local Business"}</h3>
                    {biz.tagline && <p className="text-sm text-muted-foreground mb-2">{biz.tagline}</p>}
                    {biz.description && !biz.tagline && <p className="text-sm text-muted-foreground mb-2">{biz.description}</p>}
                    {biz.type === "linked" && biz.slug && (
                      <a href={`/${citySlug}/directory/${biz.slug}`} className="text-xs text-amber-600 hover:underline flex items-center gap-1">
                        View Profile <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {biz.type === "manual" && biz.ctaText && biz.ctaUrl && (
                      <a href={biz.ctaUrl} className="text-xs text-amber-600 hover:underline flex items-center gap-1">
                        {biz.ctaText} <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {advertisers.length > 0 && (
          <section data-testid="section-advertisers">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-px flex-1 bg-border" />
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Our Sponsors</h2>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {advertisers.map((ad, i) => (
                <Card key={i} className="text-center hover:shadow-sm transition-shadow" data-testid={`card-advertiser-${i}`}>
                  <CardContent className="p-4">
                    {ad.imageUrl && <img src={ad.imageUrl} alt={ad.name || ""} className="h-12 w-12 mx-auto mb-2 rounded-full object-cover" />}
                    <p className="text-sm font-medium">{ad.name || "Sponsor"}</p>
                    {ad.type === "linked" && ad.slug && (
                      <a href={`/${citySlug}/directory/${ad.slug}`} className="text-xs text-amber-600 hover:underline">
                        Learn more
                      </a>
                    )}
                    {ad.type === "manual" && ad.ctaText && ad.ctaUrl && (
                      <a href={ad.ctaUrl} className="text-xs text-amber-600 hover:underline">
                        {ad.ctaText}
                      </a>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {issue.giveawayEnabled && issue.giveawayTitle && (
          <section data-testid="section-giveaway">
            <Card className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800">
              <CardContent className="p-6 text-center space-y-3">
                <Gift className="h-8 w-8 mx-auto text-amber-600" />
                <h3 className="text-xl font-bold">{issue.giveawayTitle}</h3>
                {issue.giveawayText && <p className="text-muted-foreground">{issue.giveawayText}</p>}
                {issue.giveawayCtaText && issue.giveawayCtaUrl && (
                  <a href={issue.giveawayCtaUrl}>
                    <Button className="bg-amber-500 hover:bg-amber-600 text-white mt-2" data-testid="button-giveaway-cta">
                      {issue.giveawayCtaText} <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </a>
                )}
              </CardContent>
            </Card>
          </section>
        )}

        {(pickupLocs.length > 0 || featuredBusinesses.some(b => b.latitude && b.longitude)) && (
          <section data-testid="section-pickup-locations">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-px flex-1 bg-border" />
              <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-600 flex items-center gap-1">
                <MapPin className="h-4 w-4" /> Pick Up Your Copy
              </h2>
              <div className="h-px flex-1 bg-border" />
            </div>

            {pickupLocs.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {pickupLocs.map((loc, i) => (
                  <Card key={i} data-testid={`card-pickup-loc-${i}`}>
                    <CardContent className="py-3 px-4 flex items-center gap-3">
                      <MapPin className="h-5 w-5 text-amber-600 shrink-0" />
                      <div>
                        <p className="font-medium text-sm">{loc.name}</p>
                        <p className="text-xs text-muted-foreground">{loc.address}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <IssueMiniMap pickupLocations={pickupLocs} featuredBusinesses={featuredBusinesses} />
          </section>
        )}

        {issue.conversionTitle && (
          <section data-testid="section-conversion">
            <Card className="bg-gradient-to-r from-violet-600 to-purple-700 text-white">
              <CardContent className="p-8 text-center space-y-4">
                <h3 className="text-2xl font-bold">{issue.conversionTitle}</h3>
                {issue.conversionText && <p className="text-white/80 max-w-lg mx-auto">{issue.conversionText}</p>}
                {issue.conversionCtaText && issue.conversionCtaUrl && (
                  <a href={issue.conversionCtaUrl}>
                    <Button className="bg-amber-500 hover:bg-amber-600 text-white mt-2" size="lg" data-testid="button-conversion-cta">
                      {issue.conversionCtaText} <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </a>
                )}
              </CardContent>
            </Card>
          </section>
        )}

        <footer className="text-center text-xs text-muted-foreground py-6 border-t">
          <p>Hub Pulse &middot; Your Local Print-to-Digital Community Publication</p>
          <p className="mt-1">Powered by City Metro Hub</p>
        </footer>
      </div>
    </div>
  );
}

interface MapMarker {
  lat: number;
  lng: number;
  name: string;
  label: string;
  color: string;
  markerType: "pickup" | "business";
}

function IssueMiniMap({ pickupLocations, featuredBusinesses }: { pickupLocations: PickupLocation[]; featuredBusinesses: EnrichedEntry[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const markers: MapMarker[] = [];

  pickupLocations.forEach(loc => {
    if (loc.latitude && loc.longitude) {
      markers.push({
        lat: parseFloat(loc.latitude),
        lng: parseFloat(loc.longitude),
        name: loc.name,
        label: loc.address,
        color: "#f59e0b",
        markerType: "pickup",
      });
    }
  });

  featuredBusinesses.forEach(biz => {
    if (biz.latitude && biz.longitude) {
      markers.push({
        lat: parseFloat(biz.latitude),
        lng: parseFloat(biz.longitude),
        name: biz.name || "Featured Business",
        label: biz.address || biz.tagline || "",
        color: "#7c3aed",
        markerType: "business",
      });
    }
  });

  if (markers.length === 0) return null;

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const loadMap = async () => {
      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");

      const center: [number, number] = [
        markers.reduce((s, m) => s + m.lat, 0) / markers.length,
        markers.reduce((s, m) => s + m.lng, 0) / markers.length,
      ];

      const map = L.map(mapRef.current!, { scrollWheelZoom: false, zoomControl: true }).setView(center, 13);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      const pickupSvg = `<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>`;
      const bizSvg = `<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M16 3H8l-2 4h12z"/>`;

      markers.forEach(m => {
        const svg = m.markerType === "pickup" ? pickupSvg : bizSvg;
        const icon = L.divIcon({
          className: "pulse-map-marker",
          html: `<div style="background:${m.color};width:28px;height:28px;border-radius:50%;border:3px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${svg}</svg></div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        L.marker([m.lat, m.lng], { icon })
          .addTo(map)
          .bindPopup(`<strong>${m.name}</strong>${m.label ? `<br/>${m.label}` : ""}<br/><span style="font-size:11px;color:#888">${m.markerType === "pickup" ? "Pickup Location" : "Featured Business"}</span>`);
      });

      if (markers.length > 1) {
        const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng]));
        map.fitBounds(bounds, { padding: [30, 30] });
      }

      mapInstanceRef.current = map;
    };

    loadMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const hasPickup = markers.some(m => m.markerType === "pickup");
  const hasBiz = markers.some(m => m.markerType === "business");

  return (
    <div className="mt-4">
      <div
        ref={mapRef}
        className="w-full h-48 md:h-64 rounded-lg border overflow-hidden"
        data-testid="map-issue-locations"
      />
      {(hasPickup || hasBiz) && (
        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          {hasPickup && (
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-full" style={{ background: "#f59e0b" }} /> Pickup Locations
            </span>
          )}
          {hasBiz && (
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-full" style={{ background: "#7c3aed" }} /> Featured Businesses
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function JsonLdScript({ issue, citySlug, hubSlug }: { issue: PulseIssueData; citySlug: string; hubSlug: string }) {
  useEffect(() => {
    const existingScript = document.getElementById("pulse-issue-jsonld");
    if (existingScript) existingScript.remove();

    const baseUrl = window.location.origin;
    const canonicalUrl = `${baseUrl}/${citySlug}/hub/${hubSlug}/pulse/${issue.slug}`;

    const articleData = {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      headline: issue.title,
      description: issue.intro || `Issue #${issue.issueNumber} of the ${hubSlug} Hub Pulse`,
      image: issue.heroImageUrl || issue.featuredStoryImage || undefined,
      datePublished: issue.publishedAt || issue.createdAt,
      dateModified: issue.updatedAt,
      url: canonicalUrl,
      publisher: {
        "@type": "Organization",
        name: "City Metro Hub",
        url: baseUrl,
      },
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": canonicalUrl,
      },
      about: {
        "@type": "Place",
        name: hubSlug.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
        containedInPlace: {
          "@type": "City",
          name: citySlug.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
        },
      },
    };

    const breadcrumbData = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: citySlug, item: `${baseUrl}/${citySlug}` },
        { "@type": "ListItem", position: 2, name: hubSlug, item: `${baseUrl}/${citySlug}/hub/${hubSlug}` },
        { "@type": "ListItem", position: 3, name: "Pulse", item: `${baseUrl}/${citySlug}/hub/${hubSlug}/pulse` },
        { "@type": "ListItem", position: 4, name: issue.title, item: canonicalUrl },
      ],
    };

    const script = document.createElement("script");
    script.id = "pulse-issue-jsonld";
    script.type = "application/ld+json";
    script.textContent = JSON.stringify([articleData, breadcrumbData]);
    document.head.appendChild(script);

    return () => {
      const s = document.getElementById("pulse-issue-jsonld");
      if (s) s.remove();
    };
  }, [issue, citySlug, hubSlug]);

  return null;
}
