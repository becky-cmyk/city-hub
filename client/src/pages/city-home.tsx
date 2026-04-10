import { useQuery } from "@tanstack/react-query";
import { useCategories, useCity, useCityZones } from "@/hooks/use-city";
import { BusinessCard, EventCard, ArticleCard } from "@/components/content-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useLocation } from "wouter";
import { Calendar, Building2, FileText, ChevronRight, Megaphone, Compass, Landmark, Newspaper, Map, Store, Crown, MapPinned, Users, Briefcase, ShoppingBag, TrendingUp, Sparkles } from "lucide-react";
import type { Business, Event as EventType, Article, CuratedList } from "@shared/schema";
import heroBg from "@assets/CLT_Skyline_Logo_1771791860436.png";
import { useI18n } from "@/lib/i18n";
import { usePageMeta } from "@/hooks/use-page-meta";
import { JsonLd } from "@/components/json-ld";
import { getCityBranding, getBrandForContext } from "@shared/city-branding";
import { FunFactsBanner } from "@/components/fun-facts";
import { useAuth } from "@/hooks/use-auth";
import { useHubContext } from "@/hooks/use-hub-context";
import { HubLocationBanner } from "@/components/hub-location-banner";
import { WildcardFeed } from "@/components/wildcard-feed";
import { WeeklyModules } from "@/components/weekly-modules";
import { LocalUpdatesModule } from "@/components/local-updates-module";
import { CampaignBanner } from "@/components/campaign-banner";
import { LeaderboardAd } from "@/components/ad-banner";

export default function CityHome({ citySlug }: { citySlug: string }) {
  const { data: categories } = useCategories();
  const { data: zones } = useCityZones(citySlug);
  const { data: city } = useCity(citySlug);
  const [, navigate] = useLocation();
  const { t } = useI18n();
  const { user, isLoggedIn, activeHub } = useAuth();
  const hubCtx = useHubContext(citySlug);

  const branding = getCityBranding(citySlug);
  const brand = branding ? getBrandForContext(branding, "home") : null;

  const personalizedTitle = isLoggedIn && user?.displayName
    ? `${user.displayName}'s ${activeHub?.city || "Charlotte"} Hub`
    : (brand?.ogSiteName || "CLT Metro Hub");

  usePageMeta({
    title: `${personalizedTitle} — Discover Charlotte`,
    description: t("meta.cityHomeDesc"),
    canonical: `${window.location.origin}/${citySlug}`,
    ogSiteName: brand?.ogSiteName,
  });

  const { data: featured, isLoading: loadingFeatured } = useQuery<{
    businesses: Business[];
    sponsored: Business[];
    events: EventType[];
    articles: Article[];
    curatedLists: CuratedList[];
  }>({
    queryKey: ["/api/cities", citySlug, "featured", hubCtx.activeZoneId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (hubCtx.activeZoneId) params.set("hubZoneId", hubCtx.activeZoneId);
      const res = await fetch(`/api/cities/${citySlug}/featured?${params}`);
      if (!res.ok) throw new Error("Failed to fetch featured content");
      return res.json();
    },
  });

  const { data: activitySignals } = useQuery<{
    counts: { newBusinesses: number; upcomingEvents: number; activeJobs: number; newArticles: number; newListings: number; hiringBusinesses: number };
    recentBusinesses: { id: string; name: string; slug: string }[];
    upcomingEvents: { id: string; title: string; slug: string }[];
    trendingJobs: { id: string; title: string; employer: string }[];
  }>({
    queryKey: ["/api/cities", citySlug, "activity-signals"],
  });

  const { data: hiringIds } = useQuery<string[]>({
    queryKey: ["/api/cities", citySlug, "hiring-businesses"],
    queryFn: async () => {
      const res = await fetch(`/api/cities/${citySlug}/hiring-businesses`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.businessIds || [];
    },
  });

  const hiringSet = new Set(hiringIds || []);

  const isNewBusiness = (biz: Business) => {
    if (!biz.createdAt) return false;
    return Date.now() - new Date(biz.createdAt).getTime() < 14 * 24 * 60 * 60 * 1000;
  };

  const spotlightZone = zones && zones.length > 0 ? zones[Math.floor(Date.now() / 86400000) % zones.length] : null;

  return (
    <div className="relative min-h-screen">
      <JsonLd data={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Organization",
            name: brand?.jsonLdName || "CLT Metro Hub",
            alternateName: branding?.brandVariants || [],
            url: window.location.origin,
            description: t("meta.cityHomeOrgDesc"),
            ...(brand?.sameAs && brand.sameAs.length > 0 && { sameAs: brand.sameAs }),
            areaServed: { "@type": "City", name: "Charlotte", addressRegion: "NC", addressCountry: "US" },
          },
          {
            "@type": "WebSite",
            name: brand?.jsonLdName || "CLT Metro Hub",
            alternateName: branding?.brandVariants || [],
            url: window.location.origin,
            ...(brand?.sameAs && brand.sameAs.length > 0 && { sameAs: brand.sameAs }),
            potentialAction: {
              "@type": "SearchAction",
              target: {
                "@type": "EntryPoint",
                urlTemplate: `${window.location.origin}/${citySlug}/directory?q={search_term_string}`,
              },
              "query-input": "required name=search_term_string",
            },
          },
        ],
      }} />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "What is CLT Hub?",
            acceptedAnswer: { "@type": "Answer", text: "CLT Hub (also known as CLT Metro Hub, Charlotte City Hub, CLT City Hub, and Charlotte Metro Hub) is Charlotte's neighborhood-first local platform. It connects residents, businesses, and visitors with local commerce, events, community organizations, and real-time neighborhood updates across 30+ Charlotte metro communities." },
          },
          {
            "@type": "Question",
            name: "What neighborhoods does CLT Hub cover?",
            acceptedAnswer: { "@type": "Answer", text: "CLT Hub covers 30+ neighborhoods and communities including Uptown, South End, NoDa, Plaza Midwood, Dilworth, Myers Park, Ballantyne, SouthPark, University City, Steele Creek, Huntersville, Cornelius, Davidson, Matthews, Mint Hill, Fort Mill, and more across the Charlotte metro." },
          },
          {
            "@type": "Question",
            name: "How do I find local businesses on CLT Hub?",
            acceptedAnswer: { "@type": "Answer", text: "Browse the CLT Hub directory by category, neighborhood, or search by name. Every business has a profile with hours, contact info, reviews, and neighborhood context. Verified and Enhanced listings include additional features like galleries, menus, and direct booking." },
          },
        ],
      }} />
      <div className="space-y-0">

      <section className="hero-section overflow-hidden" data-testid="section-hero">
        <img
          src={heroBg}
          alt={t("meta.cityHomeHeroAlt")}
          className="w-full h-auto block"
          data-testid="hero-image"
        />
      </section>

      <HubLocationBanner
        detectedZoneName={hubCtx.detectedZone?.zoneName || null}
        homeZoneName={hubCtx.homeZoneName}
        isInDifferentZone={hubCtx.isInDifferentZone}
        dismissed={hubCtx.dismissed}
        isLoggedIn={isLoggedIn}
        onExploreHere={hubCtx.switchToDetectedZone}
        onStayInHub={() => { hubCtx.switchBackToHomeZone(); hubCtx.dismissBanner(); }}
        onDismiss={hubCtx.dismissBanner}
        tempZoneActive={hubCtx.tempZoneActive}
        onSwitchBack={hubCtx.switchBackToHomeZone}
      />

      <div className="mx-auto px-4 space-y-0">

      <section className="section-band section-band-layers" data-testid="section-layers">
        <div className="text-center mb-8 md:mb-10">
          <h2 className="text-xl md:text-2xl font-bold tracking-tight section-heading-brand" data-testid="text-layers-title">{t("layers.title")}</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-lg mx-auto">{t("layers.subtitle")}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 mx-auto">
          {([
            { icon: Store, title: t("layers.commerceTitle"), desc: t("layers.commerceDesc"), variant: "layer-card-gold" },
            { icon: Crown, title: t("layers.leadershipTitle"), desc: t("layers.leadershipDesc"), variant: "layer-card-plum" },
            { icon: MapPinned, title: t("layers.neighborhoodsTitle"), desc: t("layers.neighborhoodsDesc"), variant: "layer-card-teal" },
            { icon: Users, title: t("layers.communityTitle"), desc: t("layers.communityDesc"), variant: "layer-card-pink" },
          ]).map((layer) => (
            <Card key={layer.title} className={`layer-card-accent ${layer.variant} p-4 pt-5 space-y-3`}>
              <div className="flex items-center gap-2.5">
                <div className="layer-icon p-2 rounded-lg shrink-0">
                  <layer.icon className="h-4 w-4" />
                </div>
                <h3 className="font-semibold text-sm tracking-tight">{layer.title}</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{layer.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="section-band section-band-explore" data-testid="section-explore">
        <h2 className="text-xl md:text-2xl font-bold tracking-tight text-center mb-8 section-heading-brand" data-testid="text-what-looking-for">
          {t("home.whatLookingFor")}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mx-auto">
          {([
            { path: `/${citySlug}/neighborhoods`, icon: Map, label: "home.exploreTopLists" as const, desc: "home.exploreTopListsDesc" as const, color: "hsl(var(--brand-primary))" },
            { path: `/${citySlug}/events`, icon: Calendar, label: "home.exploreEvents" as const, desc: "home.exploreEventsDesc" as const, color: "hsl(var(--brand-coral))" },
            { path: `/${citySlug}/articles`, icon: FileText, label: "home.exploreArticles" as const, desc: "home.exploreArticlesDesc" as const, color: "hsl(var(--brand-sky))" },
            { path: `/${citySlug}/directory`, icon: Building2, label: "home.exploreDirectory" as const, desc: "home.exploreDirectoryDesc" as const, color: "hsl(var(--brand-teal))" },
            { path: `/${citySlug}/attractions`, icon: Landmark, label: "home.exploreAttractions" as const, desc: "home.exploreAttractionsDesc" as const, color: "hsl(var(--brand-gold))" },
            { path: `/${citySlug}/digests`, icon: Newspaper, label: "home.exploreDigests" as const, desc: "home.exploreDigestsDesc" as const, color: "hsl(var(--brand-sand))" },
          ]).map((item) => (
            <Link key={item.path} href={item.path}>
              <Card className="hover-elevate glow-card cursor-pointer p-4 h-full flex flex-col items-center text-center gap-2" data-testid={`explore-card-${item.label.split(".").pop()}`}>
                <div className="p-2.5 rounded-lg" style={{ backgroundColor: `color-mix(in srgb, ${item.color} 12%, transparent)` }}>
                  <item.icon className="h-5 w-5" style={{ color: item.color }} />
                </div>
                <h3 className="text-sm font-semibold leading-tight">{t(item.label)}</h3>
                <p className="text-[11px] text-muted-foreground leading-snug hidden sm:block">{t(item.desc)}</p>
              </Card>
            </Link>
          ))}
        </div>

      </section>

      <LeaderboardAd citySlug={citySlug} />

      <FunFactsBanner citySlug={citySlug} />

      {activitySignals && (activitySignals.counts.activeJobs > 0 || activitySignals.counts.newBusinesses > 0 || activitySignals.counts.upcomingEvents > 0 || activitySignals.counts.newArticles > 0 || activitySignals.counts.newListings > 0) && (
        <>
        <div className="gradient-divider my-4" aria-hidden="true" />
        <section className="section-band" data-testid="section-activity-signals">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="h-5 w-5" style={{ color: "hsl(var(--brand-coral))" }} />
            <h2 className="text-xl font-bold tracking-tight">Happening Now</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {activitySignals.counts.newBusinesses > 0 && (
              <Link href={`/${citySlug}/directory?sort=newest`}>
                <Card className="hover-elevate glow-card cursor-pointer p-4 text-center space-y-1" data-testid="signal-new-businesses">
                  <div className="flex justify-center">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: "color-mix(in srgb, hsl(var(--brand-teal)) 12%, transparent)" }}>
                      <Sparkles className="h-5 w-5" style={{ color: "hsl(var(--brand-teal))" }} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold">{activitySignals.counts.newBusinesses}</p>
                  <p className="text-xs text-muted-foreground">New This Week</p>
                </Card>
              </Link>
            )}
            {activitySignals.counts.upcomingEvents > 0 && (
              <Link href={`/${citySlug}/events`}>
                <Card className="hover-elevate glow-card cursor-pointer p-4 text-center space-y-1" data-testid="signal-upcoming-events">
                  <div className="flex justify-center">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: "color-mix(in srgb, hsl(var(--brand-coral)) 12%, transparent)" }}>
                      <Calendar className="h-5 w-5" style={{ color: "hsl(var(--brand-coral))" }} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold">{activitySignals.counts.upcomingEvents}</p>
                  <p className="text-xs text-muted-foreground">Upcoming Events</p>
                </Card>
              </Link>
            )}
            {activitySignals.counts.activeJobs > 0 && (
              <Link href={`/${citySlug}/directory?attribute=hiring`}>
                <Card className="hover-elevate glow-card cursor-pointer p-4 text-center space-y-1" data-testid="signal-active-jobs">
                  <div className="flex justify-center">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: "color-mix(in srgb, hsl(var(--brand-sky)) 12%, transparent)" }}>
                      <Briefcase className="h-5 w-5" style={{ color: "hsl(var(--brand-sky))" }} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold">{activitySignals.counts.activeJobs}</p>
                  <p className="text-xs text-muted-foreground">Active Jobs</p>
                </Card>
              </Link>
            )}
            {activitySignals.counts.newArticles > 0 && (
              <Link href={`/${citySlug}/articles`}>
                <Card className="hover-elevate glow-card cursor-pointer p-4 text-center space-y-1" data-testid="signal-new-articles">
                  <div className="flex justify-center">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: "color-mix(in srgb, hsl(var(--brand-gold)) 12%, transparent)" }}>
                      <FileText className="h-5 w-5" style={{ color: "hsl(var(--brand-gold))" }} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold">{activitySignals.counts.newArticles}</p>
                  <p className="text-xs text-muted-foreground">New Articles</p>
                </Card>
              </Link>
            )}
            {activitySignals.counts.newListings > 0 && (
              <Link href={`/${citySlug}/marketplace`}>
                <Card className="hover-elevate glow-card cursor-pointer p-4 text-center space-y-1" data-testid="signal-new-listings">
                  <div className="flex justify-center">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: "color-mix(in srgb, hsl(var(--brand-sand)) 12%, transparent)" }}>
                      <ShoppingBag className="h-5 w-5" style={{ color: "hsl(var(--brand-sand))" }} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold">{activitySignals.counts.newListings}</p>
                  <p className="text-xs text-muted-foreground">New Listings</p>
                </Card>
              </Link>
            )}
          </div>
        </section>
        </>
      )}

      {loadingFeatured ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 py-8">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4 space-y-3">
              <Skeleton className="aspect-[16/10] w-full rounded-md" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
            </Card>
          ))}
        </div>
      ) : (
        <>
          {featured?.sponsored && featured.sponsored.length > 0 && (
            <section className="sponsored-section rounded-md p-4 -mx-2 md:mx-0 my-4" data-testid="section-sponsored-spotlight">
              <div className="flex items-center justify-between gap-4 mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2 text-muted-foreground">
                  <Megaphone className="h-4 w-4" />
                  {t("home.sponsoredSpotlight")}
                </h2>
                <Badge variant="outline" className="text-[10px] text-muted-foreground border-muted-foreground/20">
                  {t("badge.sponsored")}
                </Badge>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory md:grid md:grid-cols-3 md:overflow-visible md:pb-0">
                {featured.sponsored.slice(0, 6).map((biz) => (
                  <div key={biz.id} className="min-w-[280px] snap-start md:min-w-0">
                    <BusinessCard business={biz} citySlug={citySlug} categories={categories} sponsoredLabel isHiring={hiringSet.has(biz.id)} isNew={isNewBusiness(biz)} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {featured?.businesses && featured.businesses.length > 0 && (
            <>
            <div className="gradient-divider my-4" aria-hidden="true" />
            <section className="section-band section-band-plum">
              <div className="flex items-center justify-between gap-4 mb-5">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Building2 className="h-5 w-5" style={{ color: "hsl(var(--brand-pink-edge))" }} />
                  {t("home.featuredBusinesses")}
                </h2>
                <Link href={`/${citySlug}/directory`}>
                  <Button variant="ghost" size="sm" className="gap-1" data-testid="link-view-all-businesses">
                    {t("home.viewAll")} <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                {featured.businesses.slice(0, 1).map((biz) => (
                  <div key={biz.id} className="md:col-span-7">
                    <BusinessCard business={biz} citySlug={citySlug} categories={categories} highlight isHiring={hiringSet.has(biz.id)} isNew={isNewBusiness(biz)} />
                  </div>
                ))}
                <div className="md:col-span-5 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-1">
                  {featured.businesses.slice(1, 4).map((biz) => (
                    <BusinessCard key={biz.id} business={biz} citySlug={citySlug} categories={categories} isHiring={hiringSet.has(biz.id)} isNew={isNewBusiness(biz)} />
                  ))}
                </div>
              </div>
              {featured.businesses.length > 4 && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
                  {featured.businesses.slice(4, 7).map((biz) => (
                    <BusinessCard key={biz.id} business={biz} citySlug={citySlug} categories={categories} isHiring={hiringSet.has(biz.id)} isNew={isNewBusiness(biz)} />
                  ))}
                </div>
              )}
            </section>
            </>
          )}

          {featured?.events && featured.events.length > 0 && (
            <>
            <div className="gradient-divider my-4" aria-hidden="true" />
            <section className="section-band section-band-coral">
              <div className="flex items-center justify-between gap-4 mb-5">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Calendar className="h-5 w-5" style={{ color: "hsl(var(--brand-coral))" }} />
                  {t("home.upcomingEvents")}
                </h2>
                <Link href={`/${citySlug}/events`}>
                  <Button variant="ghost" size="sm" className="gap-1" data-testid="link-view-all-events">
                    {t("home.viewAll")} <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {featured.events.slice(0, 6).map((evt) => (
                  <EventCard key={evt.id} event={evt} citySlug={citySlug} />
                ))}
              </div>
            </section>
            </>
          )}


          {featured?.articles && featured.articles.length > 0 && (
            <>
            <div className="gradient-divider my-4" aria-hidden="true" />
            <section className="section-band section-band-gold">
              <div className="flex items-center justify-between gap-4 mb-5">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <FileText className="h-5 w-5" style={{ color: "hsl(var(--brand-gold))" }} />
                  {t("home.latestArticles")}
                </h2>
                <Link href={`/${citySlug}/articles`}>
                  <Button variant="ghost" size="sm" className="gap-1" data-testid="link-view-all-articles">
                    {t("home.viewAll")} <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                {featured.articles.slice(0, 1).map((art) => (
                  <div key={art.id} className="md:col-span-7">
                    <ArticleCard article={art} citySlug={citySlug} />
                  </div>
                ))}
                <div className="md:col-span-5 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-1">
                  {featured.articles.slice(1, 3).map((art) => (
                    <ArticleCard key={art.id} article={art} citySlug={citySlug} />
                  ))}
                </div>
              </div>
            </section>
            </>
          )}

          {featured?.curatedLists && featured.curatedLists.length > 0 && (
            <>
            <div className="gradient-divider my-4" aria-hidden="true" />
            <section className="section-band section-band-teal">
              <div className="flex items-center justify-between gap-4 mb-5">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Map className="h-5 w-5" style={{ color: "hsl(var(--brand-primary))" }} />
                  {t("home.curatedLists")}
                </h2>
                <Link href={`/${citySlug}/top`}>
                  <Button variant="ghost" size="sm" className="gap-1" data-testid="link-view-all-lists">
                    {t("home.viewAll")} <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {featured.curatedLists.map((list) => (
                  <Link key={list.id} href={`/${citySlug}/top/${list.slug}`}>
                    <Card className="hover-elevate glow-card cursor-pointer p-5" data-testid={`card-list-${list.id}`}>
                      <h3 className="font-semibold">{list.title}</h3>
                      {list.description && (
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{list.description}</p>
                      )}
                      <div className="mt-2 flex items-center gap-1 text-xs font-medium" style={{ color: "hsl(var(--brand-primary))" }}>
                        {t("home.viewList")} <ChevronRight className="h-3 w-3" />
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
            </>
          )}
        </>
      )}

      <WeeklyModules citySlug={citySlug} />
      <LocalUpdatesModule citySlug={citySlug} />
      <CampaignBanner citySlug={citySlug} />
      <WildcardFeed citySlug={citySlug} />

      {spotlightZone && (
        <section className="zone-spotlight rounded-md p-5 md:p-6 my-4" data-testid="section-zone-spotlight">
          <div className="flex items-center justify-between gap-4 mb-3">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Compass className="h-5 w-5" style={{ color: "hsl(var(--brand-teal))" }} />
              {t("home.exploreZones")}: {spotlightZone.name}
            </h2>
            <Link href={`/${citySlug}/directory?zone=${spotlightZone.slug}`}>
              <Button variant="ghost" size="sm" className="gap-1" data-testid="link-spotlight-zone">
                {t("home.viewAll")} <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            {t("zone.spotlightDesc", { zone: spotlightZone.name })}
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            <Link href={`/${citySlug}/directory?zone=${spotlightZone.slug}`}>
              <Badge variant="secondary" className="cursor-pointer gap-1">
                <Building2 className="h-3 w-3" /> {t("nav.directory")}
              </Badge>
            </Link>
            <Link href={`/${citySlug}/events?zone=${spotlightZone.slug}`}>
              <Badge variant="secondary" className="cursor-pointer gap-1">
                <Calendar className="h-3 w-3" /> {t("nav.events")}
              </Badge>
            </Link>
          </div>
        </section>
      )}

      </div>
      </div>
    </div>
  );
}
