import { useQuery } from "@tanstack/react-query";
import { useCategories, useCityZones } from "@/hooks/use-city";
import { SearchBar } from "@/components/search-bar";
import { BusinessCard, ArticleCard } from "@/components/content-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ZoneSelect } from "@/components/zone-select";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, X, Star, MapPin, Navigation, SlidersHorizontal, Newspaper, ChevronRight, Repeat, Calendar, FileText, Briefcase, ShoppingBag, ChevronDown } from "lucide-react";
import type { Business, Category, Article } from "@shared/schema";
import { BUSINESS_ATTRIBUTES } from "@shared/schema";
import { useI18n } from "@/lib/i18n";
import { usePageMeta } from "@/hooks/use-page-meta";
import { JsonLd } from "@/components/json-ld";
import { getCityBranding, getBrandForContext } from "@shared/city-branding";
import { mainLogo } from "@/lib/logos";
import { SidebarAd, DirectoryTileAd, useDirectoryTileAds } from "@/components/ad-banner";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { ScrollWallOverlay } from "@/components/scroll-wall";
import { DarkPageShell } from "@/components/dark-page-shell";

function PriceLabel({ level }: { level: number }) {
  return <span className="font-semibold text-white">{"$".repeat(level)}<span className="text-white/30">{"$".repeat(4 - level)}</span></span>;
}

export default function Directory({ citySlug }: { citySlug: string }) {
  const [location] = useLocation();
  const { data: categories } = useCategories();
  const { data: zones } = useCityZones(citySlug);
  const { t } = useI18n();
  const { user } = useAuth();

  const branding = getCityBranding(citySlug);
  const brand = branding ? getBrandForContext(branding, "category") : null;

  usePageMeta({
    title: `${t("meta.directoryTitle")} ${brand?.titleSuffix || ""}`.trim(),
    description: `${t("meta.directoryDesc")} Browse on ${brand?.descriptionBrand || "CLT Hub"}.`,
    canonical: `${window.location.origin}/${citySlug}/directory`,
    ogSiteName: brand?.ogSiteName,
  });

  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const [selectedZone, setSelectedZone] = useState(params.get("zone") || "");
  const [selectedCategory, setSelectedCategory] = useState(params.get("category") || "");
  const [selectedSubcategory, setSelectedSubcategory] = useState(params.get("subcategory") || "");
  const [selectedSubtype, setSelectedSubtype] = useState(params.get("subtype") || "");
  const [searchQuery, setSearchQuery] = useState(params.get("q") || "");

  useEffect(() => {
    const currentParams = new URLSearchParams(window.location.search);
    const urlQ = currentParams.get("q") || "";
    setSearchQuery(urlQ);
  }, [location]);
  const [sortBy, setSortBy] = useState("default");
  const [priceFilter, setPriceFilter] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [kidsEatFree, setKidsEatFree] = useState(params.get("kidsEatFree") === "true");
  const [itexOnly, setItexOnly] = useState(params.get("barter") === "itex");
  const [selectedAttribute, setSelectedAttribute] = useState(params.get("attribute") || "");
  const [showAdvanced, setShowAdvanced] = useState(params.get("kidsEatFree") === "true" || params.get("barter") === "itex" || !!params.get("attribute"));
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);

  const parentCategories = useMemo(() =>
    categories?.filter((c) => !c.parentCategoryId) || [],
    [categories]
  );

  const subcategories = useMemo(() => {
    if (!selectedCategory || !categories) return [];
    const parent = categories.find((c) => c.slug === selectedCategory && !c.parentCategoryId);
    if (!parent) return [];
    return categories.filter((c) => c.parentCategoryId === parent.id);
  }, [selectedCategory, categories]);

  const subtypes = useMemo(() => {
    if (!selectedSubcategory || !categories) return [];
    const sub = categories.find((c) => c.slug === selectedSubcategory);
    if (!sub) return [];
    return categories.filter((c) => c.parentCategoryId === sub.id);
  }, [selectedSubcategory, categories]);

  const handleCategoryChange = useCallback((val: string) => {
    setSelectedCategory(val);
    setSelectedSubcategory("");
    setSelectedSubtype("");
  }, []);

  const handleSubcategoryChange = useCallback((val: string) => {
    setSelectedSubcategory(val);
    setSelectedSubtype("");
  }, []);

  const requestLocation = useCallback(() => {
    if (userLocation) {
      setUserLocation(null);
      if (sortBy === "nearest") setSortBy("default");
      return;
    }
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setSortBy("nearest");
        setLocationLoading(false);
      },
      () => setLocationLoading(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [userLocation, sortBy]);

  const queryParams = new URLSearchParams();
  if (selectedZone && selectedZone !== "all") queryParams.set("zone", selectedZone);
  if (selectedCategory && selectedCategory !== "all") queryParams.set("category", selectedCategory);
  if (selectedSubcategory && selectedSubcategory !== "all") queryParams.set("subcategory", selectedSubcategory);
  if (selectedSubtype && selectedSubtype !== "all") queryParams.set("subtype", selectedSubtype);
  if (searchQuery) queryParams.set("q", searchQuery);
  if (sortBy !== "default") queryParams.set("sort", sortBy);
  if (priceFilter && priceFilter !== "all") queryParams.set("price", priceFilter);
  if (verifiedOnly) queryParams.set("verified", "true");
  if (kidsEatFree) queryParams.set("kidsEatFree", "true");
  if (itexOnly) queryParams.set("barter", "itex");
  if (selectedAttribute && selectedAttribute !== "all") queryParams.set("attribute", selectedAttribute);
  if (userLocation) {
    queryParams.set("lat", userLocation.lat.toString());
    queryParams.set("lng", userLocation.lng.toString());
  }

  const { data: businesses, isLoading } = useQuery<(Business & { distance?: number | null })[]>({
    queryKey: ["/api/cities", citySlug, "businesses", `?${queryParams.toString()}`],
  });

  const { data: directorySearch } = useQuery<{
    events: any[];
    articles: any[];
    jobs: any[];
    attractions: any[];
    marketplace: any[];
  }>({
    queryKey: ["/api/cities", citySlug, "directory-search", `?q=${encodeURIComponent(searchQuery)}`],
    enabled: !!searchQuery && searchQuery.length >= 2,
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

  const hiringSet = useMemo(() => new Set(hiringIds || []), [hiringIds]);

  const isNewBusiness = useCallback((biz: Business) => {
    if (!biz.createdAt) return false;
    const diff = Date.now() - new Date(biz.createdAt).getTime();
    return diff < 14 * 24 * 60 * 60 * 1000;
  }, []);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const toggleSection = useCallback((key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const hasFilters = (selectedZone && selectedZone !== "all") || (selectedCategory && selectedCategory !== "all") || (selectedSubcategory && selectedSubcategory !== "all") || (selectedSubtype && selectedSubtype !== "all") || (priceFilter && priceFilter !== "all") || verifiedOnly || kidsEatFree || itexOnly || (selectedAttribute && selectedAttribute !== "all");
  const activeZoneName = zones?.find((z) => z.slug === selectedZone)?.name;

  const BUSINESS_CATEGORY_SLUGS = "professional-services-cat,consulting,financial-services,insurance,real-estate,it-technology,marketing-advertising,legal,accounting-tax,coworking-spaces,graphic-design-branding,print-copy-services,shipping-logistics,hr-staffing,office-supplies,event-venues,business-coaching,event-meeting-planners,events-production";

  const pulseParams = new URLSearchParams();
  pulseParams.set("categories", BUSINESS_CATEGORY_SLUGS);
  if (selectedZone && selectedZone !== "all") pulseParams.set("zone", selectedZone);

  const { data: pulseArticles } = useQuery<Article[]>({
    queryKey: ["/api/cities", citySlug, "articles", `?${pulseParams.toString()}`],
  });

  const { data: allPulseArticles } = useQuery<Article[]>({
    queryKey: ["/api/cities", citySlug, "articles"],
    enabled: !pulseArticles || pulseArticles.length === 0,
  });

  const businessPulseArticles = useMemo(() => {
    if (pulseArticles && pulseArticles.length > 0) return pulseArticles.slice(0, 6);
    if (allPulseArticles && allPulseArticles.length > 0) return allPulseArticles.slice(0, 6);
    return [];
  }, [pulseArticles, allPulseArticles]);

  const tileAds = useDirectoryTileAds(citySlug);

  const { zoneFeatured, mainList } = useMemo(() => {
    if (!businesses || !selectedZone) return { zoneFeatured: [] as (Business & { distance?: number | null })[], mainList: businesses || [] };
    const top = businesses.filter((b: any) => b.priorityScore > 0 || b.isFeatured).slice(0, 3);
    if (top.length === 0) return { zoneFeatured: [], mainList: businesses };
    const rest = businesses.filter((b) => !top.some((f) => f.id === b.id));
    return { zoneFeatured: top, mainList: rest };
  }, [businesses, selectedZone]);

  const gridItems = useMemo(() => {
    if (!mainList || mainList.length === 0) return [];
    if (tileAds.length === 0) return mainList.map((biz) => ({ type: "business" as const, data: biz }));
    const items: ({ type: "business"; data: typeof mainList[0] } | { type: "ad"; data: (typeof tileAds)[0] })[] = [];
    let adIndex = 0;
    for (let i = 0; i < mainList.length; i++) {
      items.push({ type: "business", data: mainList[i] });
      if ((i + 1) % 6 === 0 && adIndex < tileAds.length) {
        items.push({ type: "ad", data: tileAds[adIndex] });
        adIndex++;
      }
    }
    return items;
  }, [mainList, tileAds]);

  const clearAll = () => {
    setSelectedZone("");
    setSelectedCategory("");
    setSelectedSubcategory("");
    setSelectedSubtype("");
    setPriceFilter("");
    setVerifiedOnly(false);
    setKidsEatFree(false);
    setItexOnly(false);
    setSelectedAttribute("");
    setSortBy("default");
  };

  return (
    <DarkPageShell maxWidth="wide" fillHeight>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: `${citySlug.charAt(0).toUpperCase() + citySlug.slice(1)} Business Directory`,
        description: `Browse local businesses in the ${citySlug.charAt(0).toUpperCase() + citySlug.slice(1)} metro area.`,
        url: `${window.location.origin}/${citySlug}/directory`,
        isPartOf: { "@type": "WebSite", name: brand?.jsonLdName || "CLT Hub", alternateName: branding?.brandVariants || [], ...(brand?.sameAs && brand.sameAs.length > 0 && { sameAs: brand.sameAs }) },
      }} />
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 mb-1 text-white" data-testid="text-directory-title">
            <Building2 className="h-6 w-6 text-purple-400" />
            {t("directory.title")}
          </h1>
          <p className="text-white/50 text-sm">
            {t("directory.subtitle")}
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SearchBar citySlug={citySlug} className="flex-1" placeholder={t("search.businessPlaceholder")} mode="directory" />
            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              <ZoneSelect zones={zones || []} value={selectedZone} onValueChange={setSelectedZone} triggerClassName="w-full sm:w-[150px] bg-white/5 border-white/10 text-white" testId="select-zone-filter" />
              <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                <SelectTrigger className="w-full sm:w-[170px] bg-white/5 border-white/10 text-white" data-testid="select-category-filter">
                  <SelectValue placeholder={t("directory.allCategories")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("directory.allCategories")}</SelectItem>
                  {parentCategories.map((c) => (
                    <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {subcategories.length > 0 && (
                <Select value={selectedSubcategory} onValueChange={handleSubcategoryChange}>
                  <SelectTrigger className="w-full sm:w-[170px] bg-white/5 border-white/10 text-white" data-testid="select-subcategory-filter">
                    <SelectValue placeholder={t("directory.allSubcategories")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("directory.allSubcategories")}</SelectItem>
                    {subcategories.map((c) => (
                      <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {subtypes.length > 0 && (
                <Select value={selectedSubtype} onValueChange={setSelectedSubtype}>
                  <SelectTrigger className="w-full sm:w-[170px] bg-white/5 border-white/10 text-white" data-testid="select-subtype-filter">
                    <SelectValue placeholder="All Subtypes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Subtypes</SelectItem>
                    {subtypes.map((c) => (
                      <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button
                variant={showAdvanced ? "secondary" : "outline"}
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="gap-1"
                data-testid="button-toggle-advanced"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {showAdvanced && (
            <div className="flex flex-wrap items-center gap-2 p-3 rounded-md bg-white/5 border border-white/10" data-testid="section-advanced-filters">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[130px] bg-white/5 border-white/10 text-white" data-testid="select-sort">
                  <SelectValue placeholder={t("directory.sortBy")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">{t("directory.sortDefault")}</SelectItem>
                  <SelectItem value="az">{t("directory.sortAZ")}</SelectItem>
                  {userLocation && <SelectItem value="nearest">{t("directory.sortNearest")}</SelectItem>}
                  <SelectItem value="rating">{t("directory.sortRating")}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priceFilter} onValueChange={setPriceFilter}>
                <SelectTrigger className="w-[120px] bg-white/5 border-white/10 text-white" data-testid="select-price-filter">
                  <SelectValue placeholder={t("directory.allPrices")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("directory.allPrices")}</SelectItem>
                  <SelectItem value="1">$</SelectItem>
                  <SelectItem value="2">$$</SelectItem>
                  <SelectItem value="3">$$$</SelectItem>
                  <SelectItem value="4">$$$$</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant={verifiedOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setVerifiedOnly(!verifiedOnly)}
                className="gap-1 text-xs"
                data-testid="button-verified-filter"
              >
                <Star className="h-3 w-3" />
                {t("directory.verifiedOnly")}
              </Button>
              <Button
                variant={kidsEatFree ? "default" : "outline"}
                size="sm"
                onClick={() => setKidsEatFree(!kidsEatFree)}
                className="gap-1 text-xs"
                data-testid="button-kids-eat-free-filter"
              >
                {t("directory.kidsEatFree")}
              </Button>
              <Button
                variant={itexOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setItexOnly(!itexOnly)}
                className="gap-1 text-xs"
                data-testid="button-itex-filter"
              >
                <Repeat className="h-3 w-3" />
                ITEX Accepted
              </Button>
              <Select value={selectedAttribute} onValueChange={setSelectedAttribute}>
                <SelectTrigger className="w-[170px] bg-white/5 border-white/10 text-white" data-testid="select-attribute-filter">
                  <SelectValue placeholder="Attributes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Attributes</SelectItem>
                  {BUSINESS_ATTRIBUTES.map((attr) => (
                    <SelectItem key={attr.slug} value={attr.slug}>{attr.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant={userLocation ? "default" : "outline"}
                size="sm"
                onClick={requestLocation}
                disabled={locationLoading}
                className="gap-1 text-xs"
                data-testid="button-near-me"
              >
                <Navigation className="h-3 w-3" />
                {locationLoading ? "..." : t("directory.nearMe")}
              </Button>
            </div>
          )}

          {hasFilters && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-white/40">{t("directory.activeFilters")}</span>
              {selectedCategory && selectedCategory !== "all" && (
                <Badge variant="secondary" className="text-xs gap-1 bg-purple-500/20 text-purple-200 border-purple-500/30">
                  {parentCategories.find(c => c.slug === selectedCategory)?.name}
                  {selectedSubcategory && selectedSubcategory !== "all" && ` › ${subcategories.find(c => c.slug === selectedSubcategory)?.name}`}
                </Badge>
              )}
              {selectedZone && selectedZone !== "all" && (
                <Badge variant="secondary" className="text-xs bg-purple-500/20 text-purple-200 border-purple-500/30">{activeZoneName}</Badge>
              )}
              {priceFilter && priceFilter !== "all" && (
                <Badge variant="secondary" className="text-xs bg-purple-500/20 text-purple-200 border-purple-500/30">{"$".repeat(parseInt(priceFilter))}</Badge>
              )}
              {verifiedOnly && (
                <Badge variant="secondary" className="text-xs bg-purple-500/20 text-purple-200 border-purple-500/30">{t("directory.verifiedOnly")}</Badge>
              )}
              {itexOnly && (
                <Badge variant="secondary" className="text-xs bg-purple-500/20 text-purple-200 border-purple-500/30">ITEX Accepted</Badge>
              )}
              {selectedAttribute && selectedAttribute !== "all" && (
                <Badge variant="secondary" className="text-xs bg-purple-500/20 text-purple-200 border-purple-500/30" data-testid="badge-attribute-filter">
                  {BUSINESS_ATTRIBUTES.find(a => a.slug === selectedAttribute)?.label || selectedAttribute}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="text-xs text-white/60"
                data-testid="button-clear-filters"
              >
                <X className="h-3 w-3 mr-1" /> {t("directory.clear")}
              </Button>
            </div>
          )}
        </div>

        <div className="flex gap-6">
          <div className="flex-1 min-w-0">
            {isLoading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="rounded-md bg-white/10 border border-white/10 p-4 space-y-3">
                    <Skeleton className="aspect-[16/10] w-full rounded-md bg-white/5" />
                    <Skeleton className="h-5 w-3/4 bg-white/5" />
                    <Skeleton className="h-4 w-full bg-white/5" />
                  </div>
                ))}
              </div>
            ) : businesses && businesses.length > 0 ? (() => {
              const DIR_PREVIEW = 6;
              const gatedGridItems = !user && gridItems.length > DIR_PREVIEW ? gridItems.slice(0, DIR_PREVIEW) : gridItems;
              const showDirWall = !user && gridItems.length > DIR_PREVIEW;
              return (
              <div className="space-y-6">
                {zoneFeatured.length > 0 && activeZoneName && (
                  <div className="rounded-md p-4 bg-white/5 border border-white/10" data-testid="section-featured-in-zone">
                    <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                      <h3 className="text-sm font-semibold flex items-center gap-1.5 text-amber-400">
                        <Star className="h-3.5 w-3.5" />
                        {t("directory.featuredIn")} {activeZoneName}
                      </h3>
                      <Badge variant="outline" className="text-[10px] text-amber-400/70 border-amber-400/30">
                        {t("badge.featured")}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {zoneFeatured.map((biz) => (
                        <BusinessCard key={biz.id} business={biz} citySlug={citySlug} categories={categories} distance={biz.distance} isHiring={hiringSet.has(biz.id)} isNew={isNewBusiness(biz)} />
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {gatedGridItems.map((item, idx) =>
                    item.type === "business" ? (
                      <BusinessCard key={`biz-${item.data.id}`} business={item.data} citySlug={citySlug} categories={categories} distance={item.data.distance} isHiring={hiringSet.has(item.data.id)} isNew={isNewBusiness(item.data)} />
                    ) : (
                      <DirectoryTileAd key={`ad-${item.data.id}`} ad={item.data} citySlug={citySlug} />
                    )
                  )}
                </div>
                {showDirWall && <ScrollWallOverlay />}
              </div>
              );
            })() : (
              <div className="rounded-md bg-white/10 border border-white/10 p-12 text-center">
                <Building2 className="mx-auto h-12 w-12 text-white/20 mb-4" />
                <h3 className="font-semibold text-lg mb-1 text-white">{t("directory.noResults")}</h3>
                <p className="text-white/50 text-sm">
                  {t("directory.noResultsHint")}
                </p>
              </div>
            )}
          </div>
          <aside className="hidden lg:block w-[200px] shrink-0 space-y-4">
            <SidebarAd citySlug={citySlug} />
            <SidebarAd citySlug={citySlug} />
          </aside>
        </div>

        {searchQuery && directorySearch && (
          <DirectorySearchResults
            data={directorySearch}
            citySlug={citySlug}
            expandedSections={expandedSections}
            toggleSection={toggleSection}
          />
        )}

        {businessPulseArticles.length > 0 && !searchQuery && (
          <section className="space-y-4" data-testid="section-business-pulse">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Newspaper className="h-5 w-5 text-purple-400" />
                <h2 className="text-lg font-bold text-white">{t("nav.articles")} {t("directory.forBusiness")}</h2>
              </div>
              <Link href={`/${citySlug}/articles`}>
                <Button variant="ghost" size="sm" className="gap-1 text-xs text-white/60" data-testid="link-view-all-pulse">
                  {t("home.viewAll")} <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {businessPulseArticles.map((article) => (
                <ArticleCard key={article.id} article={article} citySlug={citySlug} />
              ))}
            </div>
          </section>
        )}
      </div>
    </DarkPageShell>
  );
}

function DirectorySearchResults({
  data,
  citySlug,
  expandedSections,
  toggleSection,
}: {
  data: { events: any[]; articles: any[]; jobs: any[]; attractions: any[]; marketplace: any[] };
  citySlug: string;
  expandedSections: Record<string, boolean>;
  toggleSection: (key: string) => void;
}) {
  const sections: { key: string; label: string; icon: any; items: any[]; linkBase: string; noSlug?: boolean }[] = [
    { key: "events", label: "Events", icon: <Calendar className="h-4 w-4 text-rose-400" />, items: data.events, linkBase: `/${citySlug}/events` },
    { key: "articles", label: "Articles", icon: <FileText className="h-4 w-4 text-sky-400" />, items: data.articles, linkBase: `/${citySlug}/articles` },
    { key: "jobs", label: "Jobs", icon: <Briefcase className="h-4 w-4 text-green-400" />, items: data.jobs, linkBase: `/${citySlug}/jobs`, noSlug: true },
    { key: "attractions", label: "Attractions", icon: <MapPin className="h-4 w-4 text-purple-400" />, items: data.attractions, linkBase: `/${citySlug}/attractions`, noSlug: true },
    { key: "marketplace", label: "Marketplace", icon: <ShoppingBag className="h-4 w-4 text-orange-400" />, items: data.marketplace, linkBase: `/${citySlug}/marketplace`, noSlug: true },
  ];
  const filtered = sections.filter((s) => s.items && s.items.length > 0);

  if (filtered.length === 0) return null;

  return (
    <div className="space-y-3" data-testid="directory-search-results">
      {filtered.map((section) => {
        const isExpanded = expandedSections[section.key] !== false;
        return (
          <div key={section.key} className="rounded-md bg-white/5 border border-white/10 overflow-hidden" data-testid={`directory-search-section-${section.key}`}>
            <button
              onClick={() => toggleSection(section.key)}
              className="w-full flex items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-white/5"
              data-testid={`button-toggle-${section.key}`}
            >
              {section.icon}
              <span className="font-semibold text-sm text-white flex-1">{section.label}</span>
              <Badge variant="outline" className="text-[10px] text-white/50 border-white/20">{section.items.length}</Badge>
              <ChevronDown className={`h-4 w-4 text-white/40 transition-transform ${isExpanded ? "" : "-rotate-90"}`} />
            </button>
            {isExpanded && (
              <div className="px-4 pb-3 space-y-2">
                {section.items.map((item: any) => (
                  <Link key={item.id} href={section.noSlug ? section.linkBase : `${section.linkBase}/${item.slug || ""}`}>
                    <div className="flex items-center gap-3 p-2 rounded-md hover:bg-white/5 transition-colors cursor-pointer" data-testid={`search-result-${section.key}-${item.id}`}>
                      <img src={item.imageUrl || mainLogo} alt="" className="h-10 w-10 rounded object-cover shrink-0" onError={(e) => { const el = e.target as HTMLImageElement; el.onerror = null; el.src = mainLogo; }} />
                      <div className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-white truncate">{item.title || item.name}</span>
                        {item.employer && <span className="block text-xs text-white/50 truncate">{item.employer}</span>}
                        {item.startDateTime && (
                          <span className="block text-xs text-white/50">
                            {new Date(item.startDateTime).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        )}
                        {item.attractionType && <span className="block text-xs text-white/50">{item.attractionType}</span>}
                        {item.type && section.key === "marketplace" && (
                          <span className="block text-xs text-white/50">
                            {item.price ? `$${(item.price / 100).toFixed(0)}` : ""} {item.type}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
