import { useQuery } from "@tanstack/react-query";
import { useState, useRef, useCallback } from "react";
import { BusinessCard, EventCard, ArticleCard } from "@/components/content-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSmartBack } from "@/hooks/use-smart-back";
import { Link, useSearch, useLocation } from "wouter";
import { Calendar, Building2, FileText, ChevronRight, ChevronDown, MapPin, ArrowLeft, UtensilsCrossed, Music, Briefcase, Heart, Users, Layers, Radio, Star, ShoppingBag, DollarSign, Zap, Store, Navigation, Newspaper } from "lucide-react";
import type { Business, Event as EventType, Article, Region, Category } from "@shared/schema";
import { useCategories } from "@/hooks/use-city";
import { useAuth } from "@/hooks/use-auth";
import { useRegisterAdminEdit } from "@/hooks/use-admin-edit";
import { usePageMeta } from "@/hooks/use-page-meta";
import { JsonLd } from "@/components/json-ld";
import { getCityBranding, getBrandForContext } from "@shared/city-branding";
import VerticalHub from "@/pages/vertical-hub";
import heroDefault from "@assets/ChatGPT_Image_Feb_22,_2026,_11_51_29_AM_1771794828800.png";
import { LeaderboardAd } from "@/components/ad-banner";
import { ScrollWallOverlay } from "@/components/scroll-wall";
import { HubTvWidget } from "@/components/tv/hub-tv-widget";
import { NeighborhoodReviews } from "@/components/community/neighborhood-reviews";
import { useI18n, type TranslationKey } from "@/lib/i18n";

const MAJOR_CATEGORIES: { key: string; labelKey: TranslationKey; icon: typeof UtensilsCrossed; color: string }[] = [
  { key: "food", labelKey: "layout.food", icon: UtensilsCrossed, color: "hsl(var(--brand-coral))" },
  { key: "music", labelKey: "layout.music", icon: Music, color: "hsl(var(--brand-sky))" },
  { key: "commerce", labelKey: "layout.commerce", icon: Briefcase, color: "hsl(var(--brand-teal))" },
  { key: "senior", labelKey: "layout.senior", icon: Heart, color: "hsl(var(--brand-gold))" },
  { key: "family", labelKey: "layout.family", icon: Users, color: "hsl(var(--brand-pink-edge))" },
];

function NeighborhoodCategoryCrossPage({ citySlug, code, categorySlug }: { citySlug: string; code: string; categorySlug: string }) {
  const { t } = useI18n();
  const smartBack = useSmartBack(`/${citySlug}/neighborhoods`);
  const { data: allCategories } = useCategories();

  const { data, isLoading } = useQuery<{
    hub: Region;
    parent: Region | null;
    category: Category;
    zipCodes: string[];
    businesses: Business[];
    relatedCategories: { id: string; name: string; slug: string; count: number }[];
  }>({
    queryKey: ["/api/cities", citySlug, "neighborhoods", code, categorySlug],
    queryFn: async () => {
      const res = await fetch(`/api/cities/${citySlug}/neighborhoods/${code}/${categorySlug}`);
      if (!res.ok) throw new Error("Failed to load neighborhood category");
      return res.json();
    },
  });

  const cityName = citySlug.charAt(0).toUpperCase() + citySlug.slice(1);
  const hubName = "CLT Hub";
  const neighborhoodName = data?.hub?.name || "Neighborhood";
  const categoryName = data?.category?.name || categorySlug;
  const bizCount = data?.businesses?.length || 0;
  const branding1 = getCityBranding(citySlug);
  const brand1 = branding1 ? getBrandForContext(branding1, "category") : null;

  usePageMeta({
    title: data?.hub && data?.category ? `Best ${categoryName} in ${neighborhoodName}, ${cityName} ${brand1?.titleSuffix || `| ${hubName}`}` : "Neighborhood Category",
    description: data?.hub && data?.category
      ? `Find the best ${categoryName.toLowerCase()} in ${neighborhoodName}, ${cityName} on ${brand1?.descriptionBrand || hubName}. Browse ${bizCount} local ${categoryName.toLowerCase()} listings with reviews, photos, and more.`
      : "",
    canonical: `${window.location.origin}/${citySlug}/neighborhoods/${code}/${categorySlug}`,
    ogSiteName: brand1?.ogSiteName,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full rounded-lg" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4 space-y-3">
              <Skeleton className="aspect-[16/10] w-full rounded-md" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data?.hub || !data?.category) {
    return (
      <Card className="p-12 text-center">
        <MapPin className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
        <h3 className="font-semibold text-lg mb-1">{t("neighborhood.notFound")}</h3>
        <p className="text-muted-foreground text-sm mb-4">{t("neighborhood.notFoundDesc")}</p>
        <Button variant="outline" className="gap-2" onClick={smartBack} data-testid="link-back-neighborhoods">
          <ArrowLeft className="h-4 w-4" /> {t("neighborhood.backToNeighborhoods")}
        </Button>
      </Card>
    );
  }

  const { hub, parent, category, businesses } = data;

  return (
    <div className="space-y-6">
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: cityName, item: `${window.location.origin}/${citySlug}` },
          { "@type": "ListItem", position: 2, name: t("neighborhood.neighborhoods"), item: `${window.location.origin}/${citySlug}/neighborhoods` },
          { "@type": "ListItem", position: 3, name: hub.name, item: `${window.location.origin}/${citySlug}/neighborhoods/${code}` },
          { "@type": "ListItem", position: 4, name: category.name, item: `${window.location.origin}/${citySlug}/neighborhoods/${code}/${categorySlug}` },
        ],
      }} />
      {businesses.length > 0 && (
        <JsonLd data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `${category.name} in ${hub.name}, ${cityName}`,
          numberOfItems: businesses.length,
          itemListElement: businesses.map((biz, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: biz.name,
            url: `${window.location.origin}/${citySlug}/${categorySlug}/${biz.slug}`,
          })),
        }} />
      )}

      <section
        className="relative rounded-xl overflow-hidden"
        data-testid="section-cross-page-hero"
      >
        <img
          src={heroDefault}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/30" aria-hidden="true" />
        <div className="relative p-6 md:p-8">
          <Link href={`/${citySlug}/neighborhoods/${code}`}>
            <Button variant="ghost" size="sm" className="gap-1.5 mb-3 -ml-2 text-white/80 hover:text-white hover:bg-white/10" data-testid="link-back-neighborhood">
              <ArrowLeft className="h-3.5 w-3.5" /> {hub.name} Hub
            </Button>
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
              <Layers className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white drop-shadow-lg" data-testid="text-cross-page-title">
                {t("neighborhood.categoryIn", { category: category.name, hub: hub.name })}
              </h1>
              {parent && (
                <p className="text-sm text-white/75">{parent.name} County, {cityName} Metro</p>
              )}
            </div>
          </div>
          <p className="text-white/80 text-sm mt-2 max-w-lg">
            {t("neighborhood.browseListings", { count: String(bizCount), category: category.name.toLowerCase(), hub: hub.name, city: cityName })}
          </p>
        </div>
      </section>

      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href={`/${citySlug}/neighborhoods/${code}`}>
          <span className="hover:underline cursor-pointer" data-testid="link-breadcrumb-neighborhood">{hub.name}</span>
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span>{category.name}</span>
      </div>

      <section className="mb-4" data-testid="section-cross-page-intro">
        <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-cross-page-intro">
          {t("neighborhood.introDesc", { category: category.name.toLowerCase(), hub: hub.name, count: String(bizCount), countLabel: bizCount === 1 ? "option" : "options", city: cityName })}
        </p>
      </section>

      {businesses.length > 0 ? (
        <section>
          <h2 className="text-lg font-semibold mb-3" data-testid="text-businesses-heading">
            {t("neighborhood.categoryIn", { category: category.name, hub: hub.name })}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {businesses.map((biz) => (
              <BusinessCard key={biz.id} business={biz} citySlug={citySlug} categories={allCategories} />
            ))}
          </div>
        </section>
      ) : (
        <Card className="p-8 text-center">
          <MapPin className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <h3 className="font-semibold text-base mb-1">{t("neighborhood.noCategoryFound", { category: category.name })}</h3>
          <p className="text-muted-foreground text-sm">
            {t("neighborhood.noCategoryDesc", { category: category.name.toLowerCase(), hub: hub.name })}
          </p>
        </Card>
      )}

      {data.relatedCategories && data.relatedCategories.length > 0 && (
        <>
          <div className="gradient-divider my-4" aria-hidden="true" />
          <section className="py-4" data-testid="section-related-categories">
            <h2 className="text-lg font-semibold mb-3" data-testid="text-related-categories">{t("neighborhood.moreCategories", { hub: hub.name })}</h2>
            <div className="flex flex-wrap gap-2">
              {data.relatedCategories.map((cat) => (
                <Link key={cat.slug} href={`/${citySlug}/neighborhoods/${code}/${cat.slug}`}>
                  <Badge variant="outline" className="cursor-pointer text-xs" data-testid={`link-related-cat-${cat.slug}`}>
                    {cat.name} ({cat.count})
                  </Badge>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}

      <div className="gradient-divider my-4" aria-hidden="true" />
      <section className="py-4">
        <h2 className="text-lg font-semibold mb-3" data-testid="text-explore-more">{t("neighborhood.exploreMore")}</h2>
        <div className="flex flex-wrap gap-2">
          <Link href={`/${citySlug}/neighborhoods/${code}`}>
            <Badge variant="outline" className="cursor-pointer text-xs" data-testid="link-neighborhood-hub">
              {hub.name} Hub
            </Badge>
          </Link>
          <Link href={`/${citySlug}/${categorySlug}`}>
            <Badge variant="outline" className="cursor-pointer text-xs" data-testid="link-category-citywide">
              {t("neighborhood.categoryIn", { category: category.name, hub: cityName })}
            </Badge>
          </Link>
          <Link href={`/${citySlug}/directory`}>
            <Badge variant="outline" className="cursor-pointer text-xs" data-testid="link-city-directory">
              {t("neighborhood.cityDirectory", { city: cityName })}
            </Badge>
          </Link>
          <Link href={`/${citySlug}/neighborhoods`}>
            <Badge variant="outline" className="cursor-pointer text-xs" data-testid="link-all-neighborhoods">
              {t("neighborhood.allNeighborhoods")}
            </Badge>
          </Link>
        </div>
      </section>
    </div>
  );
}

function NeighborhoodPolls(_props: { cityId: string; zoneId: string | null }) {
  return null;
}

const NAV_TABS = [
  { id: "pulse", label: "Pulse", icon: Zap },
  { id: "events", label: "Events", icon: Calendar },
  { id: "articles", label: "Articles", icon: FileText },
  { id: "jobs", label: "Jobs", icon: Briefcase },
  { id: "marketplace", label: "Marketplace", icon: ShoppingBag },
  { id: "directory", label: "Directory", icon: Store },
] as const;

function PortalSection({
  id,
  icon: Icon,
  title,
  count,
  hubLink,
  hubLinkLabel,
  metroLink,
  metroLinkLabel,
  defaultExpanded,
  children,
}: {
  id: string;
  icon: typeof Calendar;
  title: string;
  count: number;
  hubLink: string;
  hubLinkLabel: string;
  metroLink: string;
  metroLinkLabel: string;
  defaultExpanded: boolean;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <section id={`section-${id}`} className="scroll-mt-28" data-testid={`section-hub-${id}`}>
      <button
        className="w-full flex items-center justify-between gap-3 py-3 md:py-4"
        onClick={() => setExpanded(prev => !prev)}
        data-testid={`toggle-section-${id}`}
      >
        <div className="flex items-center gap-2.5">
          <Icon className="h-5 w-5 text-white/70" />
          <h2 className="text-lg font-semibold text-white" data-testid={`text-section-title-${id}`}>{title}</h2>
          {count > 0 && (
            <span className="text-xs font-medium text-white/50 bg-white/10 rounded-full px-2 py-0.5">{count}</span>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 text-white/40 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && (
        <div className="pb-4">
          {children}
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <Link href={hubLink}>
              <Button variant="outline" size="sm" className="gap-1 text-xs border-white/20 text-white/80 bg-white/5" data-testid={`link-hub-${id}`}>
                {hubLinkLabel} <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
            <Link href={metroLink}>
              <Button variant="outline" size="sm" className="gap-1 text-xs border-white/20 text-white/80 bg-white/5" data-testid={`link-metro-${id}`}>
                {metroLinkLabel} <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}

export default function NeighborhoodHub({ citySlug, code, categorySlug }: { citySlug: string; code: string; categorySlug?: string }) {
  if (categorySlug) {
    return <NeighborhoodCategoryCrossPage citySlug={citySlug} code={code} categorySlug={categorySlug} />;
  }

  const searchString = useSearch();
  const verticalParam = new URLSearchParams(searchString).get("vertical");
  if (verticalParam && ["food", "music", "commerce", "senior", "family"].includes(verticalParam)) {
    return <VerticalHub citySlug={citySlug} verticalKey={verticalParam} hubCode={code} />;
  }
  const { t } = useI18n();
  const smartBack = useSmartBack(`/${citySlug}/neighborhoods`);
  const { data: categories } = useCategories();
  const { user } = useAuth();
  const navScrollRef = useRef<HTMLDivElement>(null);

  useRegisterAdminEdit("hub-management", code, "Edit Hub");

  const { data, isLoading } = useQuery<{
    hub: Region;
    parent: Region | null;
    zipCodes: string[];
    businesses: Business[];
    events: any[];
    articles: Article[];
    jobs: any[];
    marketplace: any[];
    nearbyHubs: { id: string; name: string; code: string | null }[];
    popularCategories: { id: string; name: string; slug: string; count: number }[];
    cityId: string;
    zoneId: string | null;
  }>({
    queryKey: ["/api/cities", citySlug, "neighborhoods", code],
    queryFn: async () => {
      const res = await fetch(`/api/cities/${citySlug}/neighborhoods/${code}`);
      if (!res.ok) throw new Error("Failed to load neighborhood");
      return res.json();
    },
  });

  const { data: crossCombos } = useQuery<{ code: string; hubName: string; categorySlug: string; categoryName: string; count: number }[]>({
    queryKey: ["/api/cities", citySlug, "neighborhood-category-combos"],
    queryFn: async () => {
      const res = await fetch(`/api/cities/${citySlug}/neighborhood-category-combos`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: authorityData } = useQuery<{ hubCode: string; categorySlug: string; categoryName: string; bizCount: number; eventCount: number; articleCount: number; reviewCount: number; score: number; rank: number }[]>({
    queryKey: ["/api/cities", citySlug, "neighborhoods", code, "authority"],
    enabled: !!data?.hub,
  });

  const { data: connectionsData } = useQuery<{
    category: { id: string; name: string; slug: string };
    businesses: { id: string; name: string; slug: string }[];
    source: string;
  }[]>({
    queryKey: ["/api/cities", citySlug, "neighborhoods", code, "connections"],
    enabled: !!data?.hub,
  });

  const cityName = citySlug.charAt(0).toUpperCase() + citySlug.slice(1);
  const hubName = "CLT Hub";
  const neighborhoodName = data?.hub?.name || "Neighborhood";
  const bizCount = data?.businesses?.length || 0;
  const evtCount = data?.events?.length || 0;
  const branding = getCityBranding(citySlug);
  const brand = branding ? getBrandForContext(branding, "hub") : null;

  usePageMeta({
    title: data?.hub ? `${neighborhoodName}, ${cityName} - Your Local Hub ${brand?.titleSuffix || `| ${hubName}`}` : "Neighborhood Hub",
    description: data?.hub
      ? `Your local portal for ${neighborhoodName} in ${cityName} on ${brand?.descriptionBrand || hubName}. Discover ${bizCount} businesses, ${evtCount} events, articles, jobs, and marketplace listings nearby.`
      : "",
    canonical: `${window.location.origin}/${citySlug}/neighborhoods/${code}`,
    ogSiteName: brand?.ogSiteName,
  });

  const [, setLocation] = useLocation();

  const scrollToSection = useCallback((sectionId: string) => {
    const el = document.getElementById(`section-${sectionId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full rounded-xl" />
        <div className="flex gap-2 overflow-hidden">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-10 w-24 rounded-lg flex-shrink-0" />)}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-4 space-y-3 bg-white/5 border-white/10">
              <Skeleton className="aspect-[16/10] w-full rounded-md" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data?.hub) {
    return (
      <Card className="p-12 text-center">
        <MapPin className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
        <h3 className="font-semibold text-lg mb-1">{t("neighborhood.hubNotFound")}</h3>
        <p className="text-muted-foreground text-sm mb-4">{t("neighborhood.hubNotFoundDesc")}</p>
        <Button variant="outline" className="gap-2" onClick={smartBack} data-testid="link-back-neighborhoods">
          <ArrowLeft className="h-4 w-4" /> {t("neighborhood.backToNeighborhoods")}
        </Button>
      </Card>
    );
  }

  const { hub, parent } = data;
  const SECTION_PREVIEW = 4;
  const allBusinesses = data.businesses;
  const allEvents = data.events;
  const allArticles = data.articles;
  const rssNews: any[] = data.rssNews || [];
  const allJobs = data.jobs || [];
  const allMarketplace = data.marketplace || [];
  const businesses = user ? allBusinesses : allBusinesses.slice(0, SECTION_PREVIEW);
  const events = user ? allEvents : allEvents.slice(0, SECTION_PREVIEW);
  const articles = user ? allArticles : allArticles.slice(0, SECTION_PREVIEW);
  const jobsToShow = user ? allJobs : allJobs.slice(0, SECTION_PREVIEW);
  const marketplaceToShow = user ? allMarketplace : allMarketplace.slice(0, SECTION_PREVIEW);
  const showNeighborhoodWall = !user && (allBusinesses.length > SECTION_PREVIEW || allEvents.length > SECTION_PREVIEW || (allArticles.length + rssNews.length) > SECTION_PREVIEW || allJobs.length > SECTION_PREVIEW || allMarketplace.length > SECTION_PREVIEW);
  const nearbyHubs = data.nearbyHubs || [];
  const popularCategories = data.popularCategories || [];
  const neighborhoodCrossLinks = crossCombos?.filter(c => c.code === code.toLowerCase()) || [];
  const connectedClusters = (connectionsData || []).map(c => ({
    cat: c.category,
    bizzes: c.businesses,
  }));
  const hubZipParam = data.zipCodes.length > 0 ? data.zipCodes.join(",") : "";
  const hubGeoTag = (hub.code || code).toLowerCase();
  const jobsViewAllUrl = hubZipParam ? `/${citySlug}/jobs?zip=${hubZipParam}` : `/${citySlug}/jobs`;
  const marketplaceViewAllUrl = hub.name ? `/${citySlug}/marketplace?neighborhood=${encodeURIComponent(hub.name)}` : `/${citySlug}/marketplace`;

  return (
    <div className="space-y-0 -mx-3 md:mx-0">
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: `${neighborhoodName} — ${cityName} Neighborhood Hub`,
        description: `Local portal for ${neighborhoodName} in ${cityName}. Businesses, events, articles, and community.`,
        url: `${window.location.origin}/${citySlug}/neighborhoods/${code}`,
        isPartOf: { "@type": "WebSite", name: brand?.jsonLdName || hubName, alternateName: branding?.brandVariants || [], ...(brand?.sameAs && brand.sameAs.length > 0 && { sameAs: brand.sameAs }) },
      }} />
      {Number.isFinite(parseFloat(String(hub.centerLat))) && Number.isFinite(parseFloat(String(hub.centerLng))) && (
        <JsonLd data={{
          "@context": "https://schema.org",
          "@type": "Place",
          name: neighborhoodName,
          description: `${neighborhoodName} neighborhood in ${cityName}`,
          geo: {
            "@type": "GeoCoordinates",
            latitude: parseFloat(String(hub.centerLat)),
            longitude: parseFloat(String(hub.centerLng)),
          },
          containedInPlace: {
            "@type": "City",
            name: cityName,
          },
        }} />
      )}
      <section className="relative overflow-hidden" data-testid="section-hub-hero">
        <img
          src={heroDefault}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-gray-950" aria-hidden="true" />
        <div className="relative px-4 pt-4 pb-5 md:px-8 md:pt-6 md:pb-6">
          <Link href={`/${citySlug}/neighborhoods`}>
            <Button variant="ghost" size="sm" className="gap-1.5 mb-3 -ml-2 text-white/70 hover:text-white hover:bg-white/10" data-testid="link-back-neighborhoods">
              <ArrowLeft className="h-3.5 w-3.5" /> {t("neighborhood.allNeighborhoods")}
            </Button>
          </Link>

          <div className="flex items-start gap-3 mb-1">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 flex-shrink-0">
              <Navigation className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-white/60 font-medium uppercase tracking-wider" data-testid="text-location-context">
                {parent ? `${parent.name} County` : cityName} Metro
              </p>
              <h1 className="text-2xl md:text-3xl font-bold text-white truncate" data-testid="text-hub-name">
                {hub.name}
              </h1>
            </div>
          </div>

          {hub.description && (
            <p className="text-white/70 text-sm mt-2 max-w-lg line-clamp-2" data-testid="text-hub-description">
              {hub.description}
            </p>
          )}

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Link href={`/${citySlug}/pulse?geo=${hubGeoTag}`}>
              <Button variant="outline" size="sm" className="gap-1.5 border-white/30 text-white bg-white/10 text-xs" data-testid="link-view-in-feed">
                <Radio className="h-3.5 w-3.5" /> {t("neighborhood.viewInFeed")}
              </Button>
            </Link>
            {data.zipCodes.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {data.zipCodes.slice(0, 3).map(zip => (
                  <Badge key={zip} className="text-[10px] bg-white/10 text-white/60 border-white/15" data-testid={`badge-zip-${zip}`}>{zip}</Badge>
                ))}
                {data.zipCodes.length > 3 && (
                  <Badge className="text-[10px] bg-white/10 text-white/60 border-white/15">+{data.zipCodes.length - 3}</Badge>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="sticky top-0 z-20 bg-gray-950/95 border-b border-white/10" data-testid="nav-quick-tabs">
        <div
          ref={navScrollRef}
          className="flex items-center gap-1 px-3 py-2 overflow-x-auto no-scrollbar"
        >
          {NAV_TABS.map(tab => {
            const tabCount =
              tab.id === "events" ? allEvents.length :
              tab.id === "articles" ? (allArticles.length + rssNews.length) :
              tab.id === "jobs" ? allJobs.length :
              tab.id === "marketplace" ? allMarketplace.length :
              tab.id === "directory" ? allBusinesses.length :
              0;
            if (tab.id !== "pulse" && tabCount === 0) return null;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.id === "pulse") {
                    setLocation(`/${citySlug}/pulse?geo=${hubGeoTag}`);
                  } else {
                    scrollToSection(tab.id);
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white/70 bg-white/5 whitespace-nowrap flex-shrink-0 transition-colors active:bg-white/15"
                data-testid={`nav-tab-${tab.id}`}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
                {tabCount > 0 && tab.id !== "pulse" && (
                  <span className="text-[10px] text-white/40">{tabCount}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {nearbyHubs.length > 0 && (
        <div className="px-3 py-3" data-testid="section-nearby-chips">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <MapPin className="h-3.5 w-3.5 text-white/40 flex-shrink-0" />
            <span className="text-xs text-white/40 flex-shrink-0">Nearby</span>
            {nearbyHubs.map((nearby) => (
              <Link key={nearby.id} href={`/${citySlug}/neighborhoods/${(nearby.code || "").toLowerCase()}`}>
                <Badge
                  variant="outline"
                  className="cursor-pointer text-xs whitespace-nowrap border-white/15 text-white/60 bg-white/5"
                  data-testid={`link-nearby-hub-${nearby.code}`}
                >
                  {nearby.name}
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      )}

      {authorityData && authorityData.length > 0 && (
        <div className="px-3 py-3" data-testid="section-authority-badges">
          <p className="text-xs text-white/40 mb-2 font-medium uppercase tracking-wider">Top ranked categories</p>
          <div className="flex flex-wrap gap-2">
            {authorityData.map((auth) => (
              <Link key={auth.categorySlug} href={`/${citySlug}/neighborhoods/${code}/${auth.categorySlug}`}>
                <div
                  className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/25 rounded-lg px-2.5 py-1.5 cursor-pointer hover:bg-amber-500/15 transition-colors"
                  data-testid={`badge-authority-${auth.categorySlug}`}
                >
                  <Star className="h-3 w-3 text-amber-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-amber-300">#{auth.rank} {auth.categoryName}</p>
                    <p className="text-[10px] text-amber-300/60">{auth.bizCount} biz{auth.eventCount > 0 ? ` / ${auth.eventCount} events` : ""}{auth.reviewCount > 0 ? ` / ${auth.reviewCount} reviews` : ""}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {connectedClusters.length > 0 && (
        <details className="px-3 py-3" data-testid="section-connected-in-hub">
          <summary className="text-xs text-white/40 font-medium uppercase tracking-wider cursor-pointer select-none list-none flex items-center gap-1.5 hover:text-white/60 transition-colors">
            <ChevronRight className="h-3 w-3 transition-transform details-open-rotate" />
            Connected in {hub.name} <span className="text-white/25">({connectedClusters.reduce((sum, c) => sum + c.bizzes.length, 0)})</span>
          </summary>
          <div className="space-y-3 mt-2">
            {connectedClusters.map(({ cat, bizzes }) => (
              <div key={cat.id} data-testid={`cluster-${cat.slug}`}>
                <Link href={`/${citySlug}/neighborhoods/${code}/${cat.slug}`}>
                  <p className="text-xs font-medium text-white/70 mb-1 hover:text-white cursor-pointer">{cat.name} ({bizzes.length})</p>
                </Link>
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                  {bizzes.slice(0, 6).map(biz => (
                    <Link key={biz.id} href={`/${citySlug}/${cat.slug}/${biz.slug}`}>
                      <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-2 py-1 whitespace-nowrap cursor-pointer hover:bg-white/10 transition-colors" data-testid={`connected-biz-${biz.id}`}>
                        <Building2 className="h-3 w-3 text-white/40 flex-shrink-0" />
                        <span className="text-xs text-white/70">{biz.name}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      <div className="px-3 md:px-0 space-y-0">
        {allEvents.length > 0 && (
          <>
            <div className="border-t border-white/5" aria-hidden="true" />
            <PortalSection
              id="events"
              icon={Calendar}
              title={t("neighborhood.upcomingEvents")}
              count={allEvents.length}
              hubLink={`/${citySlug}/events?geo=${hubGeoTag}`}
              hubLinkLabel={`Events in ${hub.name}`}
              metroLink={`/${citySlug}/events`}
              metroLinkLabel={`All ${cityName} Events`}
              defaultExpanded={true}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {events.map((evt) => (
                  <EventCard key={evt.id} event={evt} citySlug={citySlug} />
                ))}
              </div>
            </PortalSection>
          </>
        )}

        {(allArticles.length > 0 || rssNews.length > 0) && (
          <>
            <div className="border-t border-white/5" aria-hidden="true" />
            <PortalSection
              id="articles"
              icon={FileText}
              title={t("neighborhood.latestStories")}
              count={allArticles.length + rssNews.length}
              hubLink={`/${citySlug}/articles?geo=${hubGeoTag}`}
              hubLinkLabel={`Stories in ${hub.name}`}
              metroLink={`/${citySlug}/articles`}
              metroLinkLabel={`All ${cityName} Articles`}
              defaultExpanded={true}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {rssNews.slice(0, user ? rssNews.length : SECTION_PREVIEW).map((item: any) => {
                  const newsUrl = item.localArticleSlug
                    ? `/${citySlug}/news/${item.localArticleSlug}`
                    : `/${citySlug}/news/${item.id}`;
                  const safeImg = item.imageUrl && !/maps\.googleapis\.com/i.test(item.imageUrl) && !/staticmap/i.test(item.imageUrl) && !/streetviewpixels/i.test(item.imageUrl);
                  return (
                    <Link key={`rss-${item.id}`} href={newsUrl}>
                      <div className="group rounded-lg border border-white/10 bg-white/5 p-3 cursor-pointer hover:bg-white/10 transition-colors" data-testid={`card-rss-news-${item.id}`}>
                        {safeImg && (
                          <div className="aspect-video overflow-hidden rounded-md mb-2">
                            <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
                          </div>
                        )}
                        <h4 className="text-sm font-semibold text-white/90 line-clamp-2">{item.title}</h4>
                        {item.summary && <p className="text-xs text-white/50 line-clamp-2 mt-1">{item.summary}</p>}
                        <div className="flex items-center gap-2 mt-2 text-[11px] text-white/40">
                          <Newspaper className="h-3 w-3" />
                          <span>{hub.name} CLT Hub</span>
                          {item.publishedAt && (
                            <span>{new Date(item.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
                {articles.map((art) => (
                  <ArticleCard key={art.id} article={art} citySlug={citySlug} />
                ))}
              </div>
            </PortalSection>
          </>
        )}

        {allBusinesses.length > 0 && (
          <>
            <div className="border-t border-white/5" aria-hidden="true" />
            <PortalSection
              id="directory"
              icon={Store}
              title={t("neighborhood.localBusinesses")}
              count={allBusinesses.length}
              hubLink={`/${citySlug}/directory?geo=${hubGeoTag}`}
              hubLinkLabel={`Directory in ${hub.name}`}
              metroLink={`/${citySlug}/directory`}
              metroLinkLabel={`All ${cityName} Directory`}
              defaultExpanded={true}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {businesses.map((biz) => (
                  <BusinessCard key={biz.id} business={biz} citySlug={citySlug} categories={categories} />
                ))}
              </div>
            </PortalSection>
          </>
        )}

        <LeaderboardAd citySlug={citySlug} page="neighborhoods" />

        {allJobs.length > 0 && (
          <>
            <div className="border-t border-white/5" aria-hidden="true" />
            <PortalSection
              id="jobs"
              icon={Briefcase}
              title="Local Jobs"
              count={allJobs.length}
              hubLink={jobsViewAllUrl}
              hubLinkLabel={`Jobs in ${hub.name}`}
              metroLink={`/${citySlug}/jobs`}
              metroLinkLabel={`All ${cityName} Jobs`}
              defaultExpanded={false}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {jobsToShow.map((job: any) => (
                  <Card key={job.id} className="p-4 bg-white/5 border-white/10" data-testid={`card-job-${job.id}`}>
                    <h3 className="font-semibold text-sm text-white line-clamp-1" data-testid={`text-job-title-${job.id}`}>{job.title}</h3>
                    {job.employer && (
                      <div className="flex items-center gap-1.5 text-xs text-white/50 mt-1">
                        <Building2 className="h-3 w-3" />
                        <span>{job.employer}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-3 flex-wrap mt-2">
                      {job.employmentType && (
                        <Badge variant="secondary" className="text-xs">{job.employmentType.replace(/_/g, " ")}</Badge>
                      )}
                      {job.locationText && (
                        <span className="flex items-center gap-1 text-xs text-white/50">
                          <MapPin className="h-3 w-3" />
                          {job.locationText}
                        </span>
                      )}
                      {(job.payMin != null || job.payMax != null) && (
                        <span className="flex items-center gap-1 text-xs text-white/50">
                          <DollarSign className="h-3 w-3" />
                          {job.payMin != null && job.payMax != null ? `$${job.payMin}–$${job.payMax}` : job.payMin != null ? `From $${job.payMin}` : `Up to $${job.payMax}`}
                          {job.payUnit ? `/${job.payUnit}` : ""}
                        </span>
                      )}
                    </div>
                    {job.postedAt && (
                      <span className="text-xs text-white/40 mt-2 block">
                        Posted {new Date(job.postedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    )}
                  </Card>
                ))}
              </div>
            </PortalSection>
          </>
        )}

        {allMarketplace.length > 0 && (
          <>
            <div className="border-t border-white/5" aria-hidden="true" />
            <PortalSection
              id="marketplace"
              icon={ShoppingBag}
              title="Marketplace"
              count={allMarketplace.length}
              hubLink={marketplaceViewAllUrl}
              hubLinkLabel={`Marketplace in ${hub.name}`}
              metroLink={`/${citySlug}/marketplace`}
              metroLinkLabel={`All ${cityName} Marketplace`}
              defaultExpanded={false}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {marketplaceToShow.map((item: any) => (
                  <Card key={item.id} className="p-4 bg-white/5 border-white/10" data-testid={`card-marketplace-${item.id}`}>
                    {item.imageUrls?.[0] && (
                      <div className="aspect-video overflow-hidden rounded-lg mb-3">
                        <img src={item.imageUrls[0]} alt={item.title} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <h3 className="font-semibold text-sm text-white line-clamp-1" data-testid={`text-marketplace-title-${item.id}`}>{item.title}</h3>
                    <div className="flex items-center gap-2 mt-1.5">
                      {item.type && (
                        <Badge variant="secondary" className="text-xs">{item.type.replace(/_/g, " ")}</Badge>
                      )}
                      {item.price != null && (
                        <span className="text-sm font-medium text-white">${Number(item.price).toLocaleString()}</span>
                      )}
                    </div>
                    {item.neighborhood && (
                      <span className="flex items-center gap-1 text-xs text-white/50 mt-2">
                        <MapPin className="h-3 w-3" />
                        {item.neighborhood}
                      </span>
                    )}
                  </Card>
                ))}
              </div>
            </PortalSection>
          </>
        )}

        {data.cityId && data.zoneId && (
          <>
            <div className="border-t border-white/5" aria-hidden="true" />
            <NeighborhoodReviews
              cityId={data.cityId}
              zoneId={data.zoneId}
              neighborhoodName={hub.name}
            />
          </>
        )}

        {data.cityId && (
          <NeighborhoodPolls cityId={data.cityId} zoneId={data.zoneId} />
        )}

        <div className="border-t border-white/5" aria-hidden="true" />
        <section className="py-2" data-testid="section-hub-tv">
          <HubTvWidget citySlug={citySlug} hubSlug={code.toLowerCase()} hubName={hub.name} />
        </section>

        {showNeighborhoodWall && <ScrollWallOverlay />}

        {allBusinesses.length === 0 && allEvents.length === 0 && allArticles.length === 0 && allJobs.length === 0 && allMarketplace.length === 0 && (
          <Card className="p-8 text-center my-6 bg-white/5 border-white/10">
            <MapPin className="mx-auto h-10 w-10 text-white/30 mb-3" />
            <h3 className="font-semibold text-base text-white mb-1">{t("neighborhood.comingSoon")}</h3>
            <p className="text-white/50 text-sm">
              {t("neighborhood.comingSoonDesc", { name: hub.name })}
            </p>
          </Card>
        )}

        {neighborhoodCrossLinks.length > 0 && (
          <>
            <div className="border-t border-white/5" aria-hidden="true" />
            <section className="py-4">
              <h2 className="text-lg font-semibold text-white mb-3" data-testid="text-browse-by-category">{t("neighborhood.browseByCategory", { name: hub.name })}</h2>
              <div className="flex flex-wrap gap-2">
                {neighborhoodCrossLinks.slice(0, 12).map((combo) => (
                  <Link key={combo.categorySlug} href={`/${citySlug}/neighborhoods/${code}/${combo.categorySlug}`}>
                    <Badge variant="outline" className="cursor-pointer text-xs border-white/15 text-white/60" data-testid={`link-cross-page-${combo.categorySlug}`}>
                      {combo.categoryName} ({combo.count})
                    </Badge>
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}

        {popularCategories.length > 0 && (
          <>
            <div className="border-t border-white/5" aria-hidden="true" />
            <section className="py-4" data-testid="section-popular-categories">
              <h2 className="text-lg font-semibold text-white mb-3" data-testid="text-popular-categories">{t("neighborhood.popularCategories", { name: hub.name })}</h2>
              <div className="flex flex-wrap gap-2">
                {popularCategories.map((cat) => (
                  <Link key={cat.slug} href={`/${citySlug}/neighborhoods/${code}/${cat.slug}`}>
                    <Badge variant="outline" className="cursor-pointer text-xs border-white/15 text-white/60" data-testid={`link-popular-cat-${cat.slug}`}>
                      {cat.name} ({cat.count})
                    </Badge>
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}

        <div className="border-t border-white/5" aria-hidden="true" />
        <section className="py-4">
          <h2 className="text-lg font-semibold text-white mb-3" data-testid="text-explore-more">{t("neighborhood.exploreMore")}</h2>
          <div className="flex flex-wrap gap-2">
            <Link href={`/${citySlug}/directory`}>
              <Badge variant="outline" className="cursor-pointer text-xs border-white/15 text-white/60" data-testid="link-city-directory">
                {t("neighborhood.cityDirectory", { city: cityName })}
              </Badge>
            </Link>
            <Link href={`/${citySlug}/neighborhoods`}>
              <Badge variant="outline" className="cursor-pointer text-xs border-white/15 text-white/60" data-testid="link-all-neighborhoods">
                {t("neighborhood.allNeighborhoods")}
              </Badge>
            </Link>
            <Link href={`/${citySlug}`}>
              <Badge variant="outline" className="cursor-pointer text-xs border-white/15 text-white/60" data-testid="link-city-home">
                {t("neighborhood.cityHome", { city: cityName })}
              </Badge>
            </Link>
          </div>
        </section>
      </div>

      <button
        onClick={() => setLocation(`/${citySlug}/pulse?geo=${hubGeoTag}`)}
        className="fixed bottom-6 right-4 z-30 flex items-center gap-2 px-4 py-2.5 rounded-full bg-purple-600 text-white text-sm font-medium shadow-lg transition-transform active:scale-95"
        data-testid="fab-back-to-pulse"
      >
        <Zap className="h-4 w-4" />
        Pulse
      </button>
    </div>
  );
}
