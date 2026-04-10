import { Link, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Camera, Image as ImageIcon, MapPin, ArrowRight,
  Star, TrendingUp, Sparkles, Users, Building2, Download,
} from "lucide-react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { JsonLd } from "@/components/json-ld";
import { getCityBranding, getBrandForContext } from "@shared/city-branding";
import { DarkPageShell } from "@/components/dark-page-shell";

const CATEGORIES = [
  { label: "Neighborhoods", desc: "South End, NoDa, Dilworth, Plaza Midwood, and more", icon: MapPin },
  { label: "Architecture", desc: "Skyline, historic buildings, modern developments", icon: Building2 },
  { label: "Local Life", desc: "Street scenes, markets, parks, community events", icon: Users },
  { label: "Food & Dining", desc: "Restaurants, breweries, craft cocktails, plated dishes", icon: Star },
  { label: "Events", desc: "Festivals, concerts, races, parades, grand openings", icon: TrendingUp },
  { label: "Nature", desc: "Greenways, lakes, gardens, seasonal landscapes", icon: Sparkles },
];

const FAQ = [
  { question: "What types of Charlotte photos are available on CLT Hub?", answer: "The CLT Hub (also known as CLT Metro Hub, Charlotte City Hub, CLT City Hub, and Charlotte Metro Hub) gallery includes neighborhood street photography, architectural shots, aerial views, food and dining imagery, event coverage, nature and greenway photos, and lifestyle scenes from across the Charlotte metro area." },
  { question: "Can I use CLT Hub photos for commercial purposes?", answer: "Licensing terms vary by photographer. Many images on CLT Hub are available for editorial and commercial use. Check individual photo details for specific licensing information." },
  { question: "How do I submit my Charlotte photography to CLT Hub?", answer: "Local photographers can submit their work through the CLT Hub contributor portal. We feature authentic, high-quality imagery that captures the character of Charlotte's neighborhoods and community." },
  { question: "Are neighborhood-specific photos available on CLT Hub?", answer: "Yes — the CLT Hub gallery is organized by Charlotte neighborhood, making it easy to find imagery from South End, NoDa, Plaza Midwood, Dilworth, Ballantyne, and dozens of other communities." },
];

export default function StockPhotosLanding() {
  const params = useParams<{ citySlug: string }>();
  const citySlug = params.citySlug || "charlotte";
  const branding = getCityBranding(citySlug);
  const brand = branding ? getBrandForContext(branding, "landing") : null;

  usePageMeta({
    title: `Charlotte Stock Photos — Local Photography ${brand?.titleSuffix || "| CLT Metro Hub"}`,
    description: `Browse authentic Charlotte stock photos on ${brand?.descriptionBrand || "CLT Hub"}. Neighborhood scenes, skyline views, local events, food photography, and community life across the Queen City.`,
    canonical: `${window.location.origin}/${citySlug}/stock-photos`,
    ogType: "website",
    ogSiteName: brand?.ogSiteName,
    keywords: "Charlotte stock photos, Charlotte photography, Charlotte images, Queen City photos, Charlotte NC pictures, local Charlotte photography, CLT Hub",
  });

  return (
    <DarkPageShell maxWidth="wide">
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Charlotte Stock Photos",
        description: "Authentic local photography from Charlotte, NC neighborhoods and community events.",
        url: `${window.location.origin}/${citySlug}/stock-photos`,
        isPartOf: {
          "@type": "WebSite",
          name: brand?.jsonLdName || "CLT Metro Hub",
          alternateName: branding?.brandVariants || [],
          ...(brand?.sameAs && brand.sameAs.length > 0 && { sameAs: brand.sameAs }),
        },
      }} />

      <section className="relative rounded-xl overflow-hidden mb-8" data-testid="section-stock-photos-hero">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-900 via-purple-900 to-violet-900" aria-hidden="true" />
        <div className="relative p-8 md:p-12">
          <Badge className="mb-4 bg-white/15 text-white border-white/20" data-testid="badge-local-photography">
            <Camera className="h-3.5 w-3.5 mr-1.5" /> Local Photography
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3" data-testid="text-stock-photos-title">
            Charlotte Stock Photos
          </h1>
          <p className="text-white/80 text-lg max-w-2xl mb-6">
            Authentic imagery from Charlotte's neighborhoods, businesses, events, and community life. Captured by local photographers who know the Queen City.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href={`/${citySlug}/gallery`}>
              <Button className="gap-2 bg-white text-gray-900 hover:bg-white/90" data-testid="button-browse-gallery">
                <ImageIcon className="h-4 w-4" /> Browse Full Gallery <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="mb-10" data-testid="section-photo-categories">
        <h2 className="text-xl font-semibold text-white mb-5">Photo Categories</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CATEGORIES.map(cat => {
            const Icon = cat.icon;
            return (
              <Card key={cat.label} className="bg-white/5 border-white/10 hover:bg-white/8 transition-colors">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/20">
                      <Icon className="h-5 w-5 text-purple-300" />
                    </div>
                    <div>
                      <h3 className="font-medium text-white mb-1" data-testid={`text-category-${cat.label.toLowerCase().replace(/\s+/g, "-")}`}>{cat.label}</h3>
                      <p className="text-white/60 text-sm">{cat.desc}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="mb-10" data-testid="section-featured-photographers">
        <h2 className="text-xl font-semibold text-white mb-5">Featured Local Photographers</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { name: "Neighborhood Storytellers", focus: "Street-level scenes capturing daily life in South End, NoDa, and Plaza Midwood" },
            { name: "Skyline & Architecture", focus: "Uptown skyline views, Bank of America Stadium, historic Fourth Ward homes" },
            { name: "Event Coverage", focus: "Speed Street, CIAA, Juneteenth CLT, brewery crawls, and seasonal festivals" },
          ].map(photographer => (
            <Card key={photographer.name} className="bg-white/5 border-white/10">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-500/20">
                    <Camera className="h-4 w-4 text-purple-300" />
                  </div>
                  <h3 className="font-medium text-white" data-testid={`text-photographer-${photographer.name.toLowerCase().replace(/\s+/g, "-")}`}>{photographer.name}</h3>
                </div>
                <p className="text-white/60 text-sm">{photographer.focus}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mb-10" data-testid="section-licensing">
        <Card className="bg-gradient-to-br from-purple-900/40 to-indigo-900/40 border-white/10 p-6 md:p-8">
          <h2 className="text-xl font-semibold text-white mb-4">Licensing & Pricing</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="font-medium text-white mb-1">Editorial Use</h3>
              <p className="text-white/60 text-sm">Free for news, blogs, and educational content with attribution to the photographer.</p>
            </div>
            <div>
              <h3 className="font-medium text-white mb-1">Commercial License</h3>
              <p className="text-white/60 text-sm">One-time licensing for marketing materials, websites, and advertising campaigns.</p>
            </div>
            <div>
              <h3 className="font-medium text-white mb-1">Extended Rights</h3>
              <p className="text-white/60 text-sm">Unlimited use, resale rights, and exclusive territory licensing available for select images.</p>
            </div>
          </div>
        </Card>
      </section>

      <section className="mb-10" data-testid="section-why-local">
        <Card className="bg-gradient-to-br from-white/8 to-white/3 border-white/10 p-6 md:p-8">
          <h2 className="text-xl font-semibold text-white mb-4">Why Local Stock Photography?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-purple-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-white mb-1">Neighborhood Authentic</h3>
                <p className="text-white/60 text-sm">Real scenes from real Charlotte neighborhoods — not generic city stock.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Camera className="h-5 w-5 text-purple-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-white mb-1">Local Photographers</h3>
                <p className="text-white/60 text-sm">Support Charlotte creatives while getting imagery that tells an authentic story.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Download className="h-5 w-5 text-purple-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-white mb-1">Ready to Use</h3>
                <p className="text-white/60 text-sm">High-resolution images for websites, marketing, social media, and print.</p>
              </div>
            </div>
          </div>
        </Card>
      </section>

      <section className="mb-10" data-testid="section-stock-photos-faq">
        <h2 className="text-xl font-semibold text-white mb-5">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {FAQ.map((item, i) => (
            <Card key={i} className="bg-white/5 border-white/10">
              <CardContent className="p-5">
                <h3 className="font-medium text-white mb-2" data-testid={`text-faq-question-${i}`}>{item.question}</h3>
                <p className="text-white/60 text-sm">{item.answer}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: FAQ.map(item => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      }} />

      <section className="text-center py-8" data-testid="section-stock-photos-cta">
        <h2 className="text-xl font-semibold text-white mb-3">Ready to explore?</h2>
        <p className="text-white/60 mb-5 max-w-lg mx-auto">
          Browse hundreds of authentic Charlotte photos organized by neighborhood, category, and photographer.
        </p>
        <Link href={`/${citySlug}/gallery`}>
          <Button className="gap-2 bg-white text-gray-900 hover:bg-white/90" data-testid="button-explore-gallery">
            <ImageIcon className="h-4 w-4" /> Open Gallery <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </section>
    </DarkPageShell>
  );
}
