import { useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Map, MapPin, Navigation, Store, Calendar, Briefcase, ArrowRight, Star, Sparkles, Layers } from "lucide-react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { JsonLd } from "@/components/json-ld";
import { LandingPageShell } from "@/components/landing-page-shell";
import { getCityBranding, getBrandForContext } from "@shared/city-branding";
import { AddToHomescreenBanner } from "@/components/add-to-homescreen";

export default function MapLanding({ citySlug }: { citySlug: string }) {
  const cityName = citySlug.charAt(0).toUpperCase() + citySlug.slice(1);
  const branding = getCityBranding(citySlug);
  const brand = branding ? getBrandForContext(branding, "landing") : null;

  useEffect(() => {
    let link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    if (link) {
      link.href = "/manifest-map.json";
    }
    return () => {
      if (link) link.href = "/manifest.json";
    };
  }, []);

  usePageMeta({
    title: `${cityName} City Map — Explore Local Businesses, Events & Places ${brand?.titleSuffix || "| CLT Hub"}`,
    description: `Interactive map of ${cityName} on ${brand?.descriptionBrand || "CLT Hub"}. Find local businesses, events, restaurants, attractions, and places near you. Your local alternative to Google Maps.`,
    canonical: `${window.location.origin}/${citySlug}/map`,
    ogType: "website",
    ogSiteName: brand?.ogSiteName,
    ogTitle: `${cityName} City Map — Explore Everything Local`,
    ogDescription: `Interactive map of ${cityName} with businesses, events, restaurants, and attractions. Add to your home screen for quick access.`,
    keywords: `${cityName} map, CLT Hub map, local businesses ${cityName}, things near me ${cityName}, interactive map ${cityName}`,
  });

  return (
    <LandingPageShell citySlug={citySlug}>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: `${cityName} City Map`,
        description: `Interactive map of ${cityName} with local businesses, events, and points of interest.`,
        url: `${window.location.origin}/${citySlug}/map`,
        applicationCategory: "MapApplication",
        operatingSystem: "Any",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        isPartOf: { "@type": "WebSite", name: brand?.jsonLdName || "CLT Hub", alternateName: branding?.brandVariants || [], ...(brand?.sameAs && brand.sameAs.length > 0 && { sameAs: brand.sameAs }) },
      }} />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [
          { "@type": "Question", name: `What can I find on the CLT Hub Map?`, acceptedAnswer: { "@type": "Answer", text: `The CLT Hub (also known as CLT Metro Hub, Charlotte City Hub, CLT City Hub, and Charlotte Metro Hub) interactive map shows local businesses, events, restaurants, attractions, and points of interest across the ${cityName} metro area. Filter by category, neighborhood, or search to find what you need.` } },
          { "@type": "Question", name: `Is the CLT Hub Map free to use?`, acceptedAnswer: { "@type": "Answer", text: `Yes — the CLT Hub Map is completely free. You can explore the ${cityName} metro, discover local businesses, find events, and navigate to places near you without any cost or account required.` } },
        ],
      }} />

      <section className="max-w-6xl mx-auto px-4 pt-12 pb-8 text-center" data-testid="section-map-hero">
        <Badge className="mb-4 bg-emerald-600/20 text-emerald-300 border-emerald-500/30">INTERACTIVE MAP</Badge>
        <h1 className="text-3xl md:text-5xl font-bold text-white mb-4" data-testid="text-map-landing-title">
          Explore {cityName} on the Map
        </h1>
        <p className="text-lg text-white/60 max-w-2xl mx-auto mb-8">
          Discover local businesses, events, restaurants, attractions, and more — all plotted on an interactive, filterable map of the {cityName} metro.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href={`/${citySlug}/map`}>
            <Button className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-8 h-12 text-base font-semibold" data-testid="button-open-map">
              Open Map <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
          <Link href={`/${citySlug}/events/map`}>
            <Button variant="outline" className="border-white/20 text-white h-12 px-6" data-testid="button-events-map">
              <Calendar className="h-4 w-4 mr-2" /> Events Map
            </Button>
          </Link>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-3 gap-5" data-testid="section-features">
        {[
          { icon: Layers, title: "Multi-Layer Map", desc: "Toggle between businesses, events, jobs, attractions, and more. See exactly what's around you." },
          { icon: Navigation, title: "Directions Built-In", desc: "Get directions to any pin — opens in Google Maps or Apple Maps with one tap." },
          { icon: Star, title: "Save to Home Screen", desc: "Add the map to your phone's home screen for instant access — works like a native app." },
        ].map((f, i) => (
          <Card key={i} className="bg-white/5 border-white/10" data-testid={`card-feature-${i}`}>
            <CardContent className="p-5">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20">
                  <f.icon className="h-4 w-4 text-emerald-400" />
                </div>
                <h3 className="font-semibold text-white text-sm">{f.title}</h3>
              </div>
              <p className="text-white/60 text-sm leading-relaxed">{f.desc}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="max-w-6xl mx-auto px-4 py-8" data-testid="section-what-you-find">
        <h2 className="text-xl font-bold text-white mb-6 text-center">What You'll Find on the Map</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {[
            { icon: Store, label: "Businesses", color: "text-emerald-400" },
            { icon: Calendar, label: "Events", color: "text-purple-400" },
            { icon: Briefcase, label: "Jobs", color: "text-blue-400" },
            { icon: MapPin, label: "Attractions", color: "text-amber-400" },
          ].map((item, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center" data-testid={`map-type-${item.label.toLowerCase()}`}>
              <item.icon className={`h-6 w-6 mx-auto mb-2 ${item.color}`} />
              <span className="text-sm font-medium text-white">{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-12 text-center" data-testid="section-cta">
        <div className="rounded-2xl bg-gradient-to-r from-emerald-900/50 to-teal-900/50 border border-white/10 p-8 md:p-12">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">Your City at a Glance</h2>
          <p className="text-white/60 mb-6 max-w-xl mx-auto">
            Open the full interactive map to explore everything {cityName} has to offer — filter, search, and discover.
          </p>
          <Link href={`/${citySlug}/map`}>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 h-12 text-base font-semibold" data-testid="button-explore-map-cta">
              Launch Map <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      <AddToHomescreenBanner citySlug={citySlug} />
    </LandingPageShell>
  );
}
