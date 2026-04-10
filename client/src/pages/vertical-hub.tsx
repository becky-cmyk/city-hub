import { useQuery } from "@tanstack/react-query";
import { BusinessCard, EventCard, ArticleCard } from "@/components/content-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSmartBack } from "@/hooks/use-smart-back";
import { Link } from "wouter";
import { Calendar, Building2, FileText, ChevronRight, ArrowLeft, UtensilsCrossed, Music, Briefcase, Heart, Users, MapPin, PawPrint, Home, Mic, Newspaper } from "lucide-react";
import type { Business, Event as EventType, Article } from "@shared/schema";
import { useCategories } from "@/hooks/use-city";
import { usePageMeta } from "@/hooks/use-page-meta";
import { DarkPageShell } from "@/components/dark-page-shell";
import heroDefault from "@assets/ChatGPT_Image_Feb_22,_2026,_11_51_29_AM_1771794828800.png";

const VERTICALS: Record<string, { label: string; tagline: string; icon: typeof UtensilsCrossed; color: string }> = {
  food: { label: "Food", tagline: "Restaurants, cafes, breweries, and the flavors that make Charlotte unique.", icon: UtensilsCrossed, color: "hsl(var(--brand-coral))" },
  music: { label: "Arts & Entertainment", tagline: "Theater, galleries, live music, museums, and the creative pulse of the Queen City.", icon: Music, color: "hsl(var(--brand-sky))" },
  "arts-entertainment": { label: "Arts & Entertainment", tagline: "Theater, galleries, live music, museums, and the creative pulse of the Queen City.", icon: Music, color: "hsl(var(--brand-sky))" },
  commerce: { label: "Commerce", tagline: "Local shops, professional services, and the businesses building Charlotte.", icon: Briefcase, color: "hsl(var(--brand-teal))" },
  senior: { label: "Senior", tagline: "Resources, services, health & wellness for Charlotte's senior community.", icon: Heart, color: "hsl(var(--brand-gold))" },
  pets: { label: "Pets", tagline: "Vets, groomers, boarding, parks, and everything for Charlotte's four-legged family.", icon: PawPrint, color: "hsl(152 70% 45%)" },
  family: { label: "Family", tagline: "Kid-friendly activities, schools, camps, and family fun across the metro.", icon: Users, color: "hsl(var(--brand-pink-edge))" },
  relocation: { label: "Relocation", tagline: "Neighborhood guides, real estate, moving services, and everything newcomers need to settle into Charlotte.", icon: Home, color: "hsl(200 70% 50%)" },
  speakers: { label: "Speakers", tagline: "Local thought leaders, keynote speakers, panelists, and subject matter experts across the Queen City.", icon: Mic, color: "hsl(280 70% 55%)" },
  sources: { label: "Local Sources", tagline: "Expert voices, community leaders, and local professionals available for media, interviews, and commentary.", icon: Newspaper, color: "hsl(35 80% 50%)" },
};

export default function VerticalHub({ citySlug, verticalKey, hubCode }: { citySlug: string; verticalKey: string; hubCode?: string }) {
  const { data: categories } = useCategories();
  const smartBack = useSmartBack(hubCode ? `/${citySlug}/neighborhoods/${hubCode}` : `/${citySlug}`);
  const vertical = VERTICALS[verticalKey];

  const apiUrl = hubCode
    ? `/api/cities/${citySlug}/verticals/${verticalKey}?hub=${hubCode}`
    : `/api/cities/${citySlug}/verticals/${verticalKey}`;

  const { data, isLoading } = useQuery<{
    businesses: Business[];
    events: any[];
    articles: Article[];
    verticalKey: string;
  }>({
    queryKey: ["/api/cities", citySlug, "verticals", verticalKey, hubCode || "all"],
    queryFn: async () => {
      const res = await fetch(apiUrl);
      if (!res.ok) throw new Error("Failed to load vertical");
      return res.json();
    },
  });

  const hubLabel = hubCode ? hubCode.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : null;

  usePageMeta({
    title: vertical
      ? `${vertical.label}${hubLabel ? ` in ${hubLabel}` : ""} — CLT Metro Hub`
      : "CLT Metro Hub",
    description: vertical?.tagline || "",
  });

  if (!vertical) {
    return (
      <DarkPageShell maxWidth="wide">
        <Card className="p-12 text-center bg-white/5 border-white/10">
          <h3 className="font-semibold text-lg mb-1 text-white">Category not found</h3>
          <p className="text-white/50 text-sm mb-4">This category page doesn't exist yet.</p>
          <Button variant="outline" className="gap-2 border-white/20 text-white" onClick={smartBack} data-testid="link-back-home">
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </Button>
        </Card>
      </DarkPageShell>
    );
  }

  const Icon = vertical.icon;

  return (
    <DarkPageShell maxWidth="wide">
      <section className="relative rounded-xl overflow-hidden mb-6" data-testid="section-vertical-hero">
        <img src={heroDefault} alt="" className="absolute inset-0 w-full h-full object-cover" aria-hidden="true" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/30" aria-hidden="true" />
        <div className="relative p-6 md:p-8">
          <Button variant="ghost" size="sm" className="gap-1.5 mb-3 -ml-2 text-white/80 hover:text-white hover:bg-white/10" onClick={smartBack} data-testid="link-back">
            <ArrowLeft className="h-3.5 w-3.5" /> {hubCode ? "Back to Hub" : "Home"}
          </Button>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white drop-shadow-lg" data-testid="text-vertical-name">
                {vertical.label}
                {hubLabel && <span className="text-white/70 font-normal text-lg ml-2">in {hubLabel}</span>}
              </h1>
            </div>
          </div>
          <p className="text-white/80 text-sm mt-2 max-w-lg">{vertical.tagline}</p>
          {hubCode && (
            <div className="flex items-center gap-1.5 mt-3">
              <MapPin className="h-3.5 w-3.5 text-white/60" />
              <span className="text-white/60 text-xs">Filtered to {hubLabel}</span>
            </div>
          )}
        </div>
      </section>

      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-8 w-48 bg-white/10" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <Card key={i} className="p-4 space-y-3 bg-white/5 border-white/10">
                <Skeleton className="aspect-[16/10] w-full rounded-md bg-white/10" />
                <Skeleton className="h-5 w-3/4 bg-white/10" />
                <Skeleton className="h-4 w-full bg-white/10" />
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-0">
          {data && data.articles.length > 0 && (
            <>
              <div className="gradient-divider my-4" aria-hidden="true" />
              <section className="section-band section-band-gold">
                <div className="flex items-center justify-between gap-4 mb-5">
                  <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                    <FileText className="h-5 w-5" style={{ color: "hsl(var(--brand-gold))" }} />
                    {vertical.label} Stories
                  </h2>
                  <Link href={`/${citySlug}/articles`}>
                    <Button variant="ghost" size="sm" className="gap-1 text-white/70" data-testid="link-view-all-articles">
                      View All <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                  {data.articles.slice(0, 1).map(art => (
                    <div key={art.id} className="md:col-span-7">
                      <ArticleCard article={art} citySlug={citySlug} />
                    </div>
                  ))}
                  <div className="md:col-span-5 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-1">
                    {data.articles.slice(1, 3).map(art => (
                      <ArticleCard key={art.id} article={art} citySlug={citySlug} />
                    ))}
                  </div>
                </div>
              </section>
            </>
          )}

          {data && data.events.length > 0 && (
            <>
              <div className="gradient-divider my-4" aria-hidden="true" />
              <section className="section-band section-band-coral">
                <div className="flex items-center justify-between gap-4 mb-5">
                  <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                    <Calendar className="h-5 w-5" style={{ color: "hsl(var(--brand-coral))" }} />
                    {vertical.label} Events
                  </h2>
                  <Link href={`/${citySlug}/events`}>
                    <Button variant="ghost" size="sm" className="gap-1 text-white/70" data-testid="link-view-all-events">
                      View All <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {data.events.slice(0, 6).map(evt => (
                    <EventCard key={evt.id} event={evt} citySlug={citySlug} />
                  ))}
                </div>
              </section>
            </>
          )}

          {data && data.businesses.length > 0 && (
            <>
              <div className="gradient-divider my-4" aria-hidden="true" />
              <section className="section-band section-band-plum">
                <div className="flex items-center justify-between gap-4 mb-5">
                  <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                    <Building2 className="h-5 w-5" style={{ color: vertical.color }} />
                    {vertical.label} Businesses
                  </h2>
                  <Link href={`/${citySlug}/directory`}>
                    <Button variant="ghost" size="sm" className="gap-1 text-white/70" data-testid="link-view-all-businesses">
                      View All <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                  {data.businesses.slice(0, 1).map(biz => (
                    <div key={biz.id} className="md:col-span-7">
                      <BusinessCard business={biz} citySlug={citySlug} categories={categories} highlight />
                    </div>
                  ))}
                  <div className="md:col-span-5 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-1">
                    {data.businesses.slice(1, 4).map(biz => (
                      <BusinessCard key={biz.id} business={biz} citySlug={citySlug} categories={categories} />
                    ))}
                  </div>
                </div>
                {data.businesses.length > 4 && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
                    {data.businesses.slice(4, 10).map(biz => (
                      <BusinessCard key={biz.id} business={biz} citySlug={citySlug} categories={categories} />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          {data && data.businesses.length === 0 && data.events.length === 0 && data.articles.length === 0 && (
            <Card className="p-8 text-center my-6 bg-white/5 border-white/10">
              <Icon className="mx-auto h-10 w-10 text-white/30 mb-3" />
              <h3 className="font-semibold text-base mb-1 text-white">Coming Soon</h3>
              <p className="text-white/50 text-sm">
                {vertical.label} content{hubLabel ? ` for ${hubLabel}` : ""} is being built out. Check back soon!
              </p>
            </Card>
          )}
        </div>
      )}
    </DarkPageShell>
  );
}
