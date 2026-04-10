import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Briefcase, Home, Palette, ArrowRight, Star, TrendingUp, Sparkles } from "lucide-react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { JsonLd } from "@/components/json-ld";
import { LandingPageShell } from "@/components/landing-page-shell";
import { getCityBranding, getBrandForContext } from "@shared/city-branding";

export default function MarketplaceLanding({ citySlug }: { citySlug: string }) {
  const cityName = citySlug.charAt(0).toUpperCase() + citySlug.slice(1);
  const branding = getCityBranding(citySlug);
  const brand = branding ? getBrandForContext(branding, "landing") : null;

  usePageMeta({
    title: `${cityName} Marketplace — Jobs, Rentals, Local Goods ${brand?.titleSuffix || "| CLT Hub"}`,
    description: `Browse the ${cityName} local marketplace on ${brand?.descriptionBrand || "CLT Hub"}. Find jobs, rental listings, creator goods, handmade products, and more from the ${cityName} metro community.`,
    canonical: `${window.location.origin}/${citySlug}/marketplace`,
    ogType: "website",
    ogSiteName: brand?.ogSiteName,
    ogTitle: `${cityName} Marketplace — Local Jobs, Rentals & Goods`,
    ogDescription: `Discover local listings in ${cityName}. Jobs, rentals, creator goods, and community classifieds.`,
    keywords: `${cityName} marketplace, CLT Hub marketplace, local jobs ${cityName}, rentals ${cityName}, classifieds ${cityName}, handmade ${cityName}`,
  });

  return (
    <LandingPageShell citySlug={citySlug}>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: `${cityName} Marketplace`,
        description: `Local marketplace for jobs, rentals, and creator goods in ${cityName}.`,
        url: `${window.location.origin}/${citySlug}/marketplace`,
        isPartOf: { "@type": "WebSite", name: brand?.jsonLdName || "CLT Hub", alternateName: branding?.brandVariants || [], ...(brand?.sameAs && brand.sameAs.length > 0 && { sameAs: brand.sameAs }) },
      }} />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [
          { "@type": "Question", name: `What can I find on the CLT Hub Marketplace?`, acceptedAnswer: { "@type": "Answer", text: `The CLT Hub (also known as CLT Metro Hub, Charlotte City Hub, CLT City Hub, and Charlotte Metro Hub) Marketplace features local job listings, rental properties, creator goods, handmade products, and community classifieds across the ${cityName} metro area.` } },
          { "@type": "Question", name: `How do I list something on CLT Hub Marketplace?`, acceptedAnswer: { "@type": "Answer", text: `Create a free account on CLT Hub and post your listing in the Marketplace section. You can list jobs, rentals, goods for sale, services, and more to reach the local ${cityName} community.` } },
        ],
      }} />

      <section className="max-w-6xl mx-auto px-4 pt-12 pb-8 text-center" data-testid="section-marketplace-hero">
        <Badge className="mb-4 bg-amber-600/20 text-amber-300 border-amber-500/30">LOCAL MARKETPLACE</Badge>
        <h1 className="text-3xl md:text-5xl font-bold text-white mb-4" data-testid="text-marketplace-landing-title">
          {cityName} Marketplace
        </h1>
        <p className="text-lg text-white/60 max-w-2xl mx-auto mb-8">
          Jobs, rentals, creator goods, and community classifieds — all local to the {cityName} metro.
        </p>
        <Link href={`/${citySlug}/marketplace/browse`}>
          <Button className="bg-gradient-to-r from-amber-500 to-orange-500 text-black px-8 h-12 text-base font-semibold" data-testid="button-browse-marketplace">
            Browse Marketplace <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </Link>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-3 gap-5" data-testid="section-categories">
        {[
          { icon: Briefcase, title: "Local Jobs", desc: "Full-time, part-time, and contract positions from Charlotte employers and small businesses.", color: "bg-blue-500/20", iconColor: "text-blue-400" },
          { icon: Home, title: "Rentals & Housing", desc: "Apartments, condos, townhomes, and sublets across neighborhoods and suburbs.", color: "bg-emerald-500/20", iconColor: "text-emerald-400" },
          { icon: Palette, title: "Creator Shop", desc: "Original art, prints, photography, handmade goods, music, and workshops from local creators.", color: "bg-purple-500/20", iconColor: "text-purple-400" },
        ].map((cat, i) => (
          <Card key={i} className="bg-white/5 border-white/10" data-testid={`card-category-${i}`}>
            <CardContent className="p-5">
              <div className="flex items-center gap-2.5 mb-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${cat.color}`}>
                  <cat.icon className={`h-4 w-4 ${cat.iconColor}`} />
                </div>
                <h3 className="font-semibold text-white text-sm">{cat.title}</h3>
              </div>
              <p className="text-white/60 text-sm leading-relaxed">{cat.desc}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-3 gap-5" data-testid="section-highlights">
        {[
          { icon: Star, title: "Community First", desc: "Every listing is local to the Charlotte metro — supporting neighbors, not algorithms." },
          { icon: TrendingUp, title: "Growing Daily", desc: "New listings added every day. From first jobs to dream apartments, find what's new." },
          { icon: Sparkles, title: "Direct Contact", desc: "Reach out directly to sellers, employers, and landlords. No middleman." },
        ].map((h, i) => (
          <Card key={i} className="bg-white/5 border-white/10" data-testid={`card-highlight-${i}`}>
            <CardContent className="p-5">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20">
                  <h.icon className="h-4 w-4 text-amber-400" />
                </div>
                <h3 className="font-semibold text-white text-sm">{h.title}</h3>
              </div>
              <p className="text-white/60 text-sm leading-relaxed">{h.desc}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="max-w-6xl mx-auto px-4 py-12 text-center" data-testid="section-cta">
        <div className="rounded-2xl bg-gradient-to-r from-amber-900/50 to-orange-900/50 border border-white/10 p-8 md:p-12">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">Browse the {cityName} Marketplace</h2>
          <p className="text-white/60 mb-6 max-w-xl mx-auto">
            Discover jobs, rentals, handmade goods, and local classifieds. Everything from your community.
          </p>
          <Link href={`/${citySlug}/marketplace/browse`}>
            <Button className="bg-amber-500 hover:bg-amber-600 text-black px-8 h-12 text-base font-semibold" data-testid="button-explore-marketplace-cta">
              Explore Marketplace <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>
    </LandingPageShell>
  );
}
