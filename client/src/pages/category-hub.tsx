import { useQuery } from "@tanstack/react-query";
import { useCategories } from "@/hooks/use-city";
import { BusinessCard, EventCard } from "@/components/content-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Layers, Star, ChevronRight, MapPin } from "lucide-react";
import { Link } from "wouter";
import type { Business, Event as EventType } from "@shared/schema";
import { getCategoryLogo } from "@/lib/logos";
import { useI18n } from "@/lib/i18n";
import { usePageMeta } from "@/hooks/use-page-meta";
import { JsonLd } from "@/components/json-ld";
import { getCityBranding, getBrandForContext } from "@shared/city-branding";
import NotFound from "@/pages/not-found";
import { InlineAd } from "@/components/ad-banner";
import { FARM_CATEGORY_SLUG } from "@shared/schema";

export default function CategoryHub({ citySlug, categorySlug }: { citySlug: string; categorySlug: string }) {
  const { t } = useI18n();
  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const category = categories?.find((c) => c.slug === categorySlug);

  const { data, isLoading } = useQuery<{ businesses: Business[]; events: EventType[] }>({
    queryKey: ["/api/cities", citySlug, "category", categorySlug],
    enabled: !!categorySlug,
  });

  const { data: crossCombos } = useQuery<{ code: string; hubName: string; categorySlug: string; categoryName: string; count: number }[]>({
    queryKey: ["/api/cities", citySlug, "neighborhood-category-combos"],
    queryFn: async () => {
      const res = await fetch(`/api/cities/${citySlug}/neighborhood-category-combos`);
      if (!res.ok) return [];
      return res.json();
    },
  });
  const neighborhoodLinks = crossCombos?.filter(c => c.categorySlug === categorySlug) || [];

  const cityName = citySlug.charAt(0).toUpperCase() + citySlug.slice(1);
  const stateName = "NC";
  const hubName = "CLT Hub";
  const bizCount = data?.businesses?.length || 0;
  const categoryName = category?.name || categorySlug;
  const branding = getCityBranding(citySlug);
  const brand = branding ? getBrandForContext(branding, "category") : null;

  const parentCategory = category?.parentCategoryId && categories
    ? categories.find((c) => c.id === category.parentCategoryId)
    : null;

  const siblingCategories = categories
    ? (category?.parentCategoryId
        ? categories.filter((c) => c.parentCategoryId === category.parentCategoryId && c.id !== category?.id)
        : categories.filter((c) => !c.parentCategoryId && c.id !== category?.id)
      ).slice(0, 8)
    : [];

  const farmRootCategory = categories?.find((c) => c.slug === FARM_CATEGORY_SLUG);
  const isFarmL1 = categorySlug === FARM_CATEGORY_SLUG;
  const isFarmL2 = !isFarmL1 && parentCategory?.slug === FARM_CATEGORY_SLUG;
  const isFarmL3 = !isFarmL1 && !isFarmL2 && parentCategory && farmRootCategory
    ? categories?.some((c) => c.id === parentCategory.parentCategoryId && c.slug === FARM_CATEGORY_SLUG) || false
    : false;
  const isFarmCategory = isFarmL1 || isFarmL2 || isFarmL3;
  const farmSeoTitle = isFarmCategory && categorySlug === FARM_CATEGORY_SLUG
    ? `Local Farms & Food Sources in ${cityName}, ${stateName} | ${hubName}`
    : isFarmCategory
      ? `${categoryName} — Local Farm & Food Sources in ${cityName} | ${hubName}`
      : null;
  const farmSeoDesc = isFarmCategory && categorySlug === FARM_CATEGORY_SLUG
    ? `Discover local farms, farmers markets, CSA programs, farm stores, and more in the ${cityName} area. Support local agriculture and eat fresh.`
    : isFarmCategory
      ? `Browse ${categoryName.toLowerCase()} near ${cityName}. Find local farms, vendors, and food producers for ${categoryName.toLowerCase()}.`
      : null;

  usePageMeta({
    title: farmSeoTitle || `Best ${categoryName} in ${cityName}, ${stateName} ${brand?.titleSuffix || `| ${hubName}`}`,
    description: farmSeoDesc || `Find the best ${categoryName.toLowerCase()} in ${cityName} on ${brand?.descriptionBrand || hubName}. Browse ${bizCount} local ${categoryName.toLowerCase()} listings with reviews, photos, and more.`,
    canonical: `${window.location.origin}/${citySlug}/${categorySlug}`,
    ogSiteName: brand?.ogSiteName,
  });

  if (!categoriesLoading && !isLoading && !category && data && data.businesses.length === 0 && data.events.length === 0) {
    return <NotFound />;
  }

  return (
    <div className="space-y-6">
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${window.location.origin}/${citySlug}` },
          ...(parentCategory ? [{ "@type": "ListItem" as const, position: 2, name: parentCategory.name, item: `${window.location.origin}/${citySlug}/${parentCategory.slug}` }] : []),
          { "@type": "ListItem", position: parentCategory ? 3 : 2, name: categoryName, item: `${window.location.origin}/${citySlug}/${categorySlug}` },
        ],
      }} />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: `${categoryName} in ${cityName}`,
        description: `Browse ${categoryName.toLowerCase()} in ${cityName}.`,
        url: `${window.location.origin}/${citySlug}/${categorySlug}`,
        isPartOf: { "@type": "WebSite", name: brand?.jsonLdName || hubName, alternateName: branding?.brandVariants || [], ...(brand?.sameAs && brand.sameAs.length > 0 && { sameAs: brand.sameAs }) },
      }} />
      {data?.businesses && data.businesses.length > 0 && (
        <JsonLd data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `${categoryName} in ${cityName}`,
          numberOfItems: data.businesses.length,
          itemListElement: data.businesses.map((biz, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: biz.name,
            url: `${window.location.origin}/${citySlug}/${categorySlug}/${biz.slug}`,
          })),
        }} />
      )}
      <div>
        {(() => {
          const logo = getCategoryLogo(categorySlug);
          return logo ? (
            <div className="flex items-center gap-3 mb-1">
              <img src={logo} alt={categoryName} className="h-14 w-auto object-contain" data-testid="img-category-logo" />
              <h1 className="text-2xl font-bold" data-testid="text-category-title">
                {t("category.inCity", { name: categoryName, city: cityName })}
              </h1>
            </div>
          ) : (
            <h1 className="text-2xl font-bold flex items-center gap-2 mb-1" data-testid="text-category-title">
              <Layers className="h-6 w-6 text-primary" />
              {t("category.inCity", { name: categoryName, city: cityName })}
            </h1>
          );
        })()}
        <p className="text-muted-foreground text-sm">{t("category.browse", { name: categoryName })}</p>
        {parentCategory && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
            <Link href={`/${citySlug}/${parentCategory.slug}`}>
              <span className="hover:underline cursor-pointer" data-testid="link-parent-category">{parentCategory.name}</span>
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span>{categoryName}</span>
          </div>
        )}
      </div>

      {siblingCategories.length > 0 && (
        <div className="flex flex-wrap gap-2" data-testid="section-sibling-categories">
          {siblingCategories.map((sib) => (
            <Link key={sib.id} href={`/${citySlug}/${sib.slug}`}>
              <Badge variant="outline" className="cursor-pointer text-xs" data-testid={`link-sibling-category-${sib.slug}`}>
                {sib.name}
              </Badge>
            </Link>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4 space-y-3">
              <Skeleton className="aspect-[16/10] w-full rounded-md" />
              <Skeleton className="h-5 w-3/4" />
            </Card>
          ))}
        </div>
      ) : (
        <>
          {data?.businesses && data.businesses.length > 0 && (() => {
            const topFeatured = data.businesses.filter((b: any) => b.priorityScore > 0 || b.isFeatured).slice(0, 3);
            const remaining = topFeatured.length > 0
              ? data.businesses.filter((b) => !topFeatured.some((f) => f.id === b.id))
              : data.businesses;
            return (
              <section className="space-y-6">
                {topFeatured.length > 0 && (
                  <div className="sponsored-section rounded-md p-4 -mx-2 md:mx-0" data-testid="section-featured-in-category">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <h3 className="text-sm font-semibold flex items-center gap-1.5 text-muted-foreground">
                        <Star className="h-3.5 w-3.5" />
                        {t("directory.featuredIn")} {categoryName}
                      </h3>
                      <Badge variant="outline" className="text-[10px] text-muted-foreground border-muted-foreground/20">
                        {t("badge.featured")}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {topFeatured.map((biz) => (
                        <BusinessCard key={biz.id} business={biz} citySlug={citySlug} categories={categories} />
                      ))}
                    </div>
                  </div>
                )}
                {remaining.length > 0 && (
                  <div>
                    <h2 className="text-lg font-semibold mb-3">{t("category.businesses")}</h2>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {remaining.map((biz) => (
                        <BusinessCard key={biz.id} business={biz} citySlug={citySlug} categories={categories} />
                      ))}
                    </div>
                  </div>
                )}
              </section>
            );
          })()}
          <InlineAd citySlug={citySlug} />

          {data?.events && data.events.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-3">{t("category.events")}</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.events.map((evt) => (
                  <EventCard key={evt.id} event={evt} citySlug={citySlug} />
                ))}
              </div>
            </section>
          )}
          {(!data?.businesses?.length && !data?.events?.length) && (
            <Card className="p-12 text-center">
              <Layers className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="font-semibold text-lg mb-1">{t("category.noContent")}</h3>
              <p className="text-muted-foreground text-sm">{t("category.noContentHint")}</p>
            </Card>
          )}
        </>
      )}

      {neighborhoodLinks.length > 0 && (
        <section data-testid="section-neighborhood-cross-links">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-muted-foreground" />
            {t("category.byNeighborhood", { name: categoryName })}
          </h2>
          <div className="flex flex-wrap gap-2">
            {neighborhoodLinks.slice(0, 12).map((combo) => (
              <Link key={combo.code} href={`/${citySlug}/neighborhoods/${combo.code}/${categorySlug}`}>
                <Badge variant="outline" className="cursor-pointer text-xs" data-testid={`link-cross-neighborhood-${combo.code}`}>
                  {combo.hubName} ({combo.count})
                </Badge>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
