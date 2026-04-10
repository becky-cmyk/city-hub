import { useQuery } from "@tanstack/react-query";
import { useCategories, useCityZones } from "@/hooks/use-city";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { MapPin, Phone, Globe, Star, Bookmark, Navigation, CalendarCheck, DollarSign, MapPinned, Play, Instagram, Facebook, ChevronLeft, ChevronRight, Home, Languages, Award, Calendar, Rss, CreditCard, Banknote, FileCheck, Repeat, Wallet, Radio, Video, ShoppingBag, ExternalLink, ShieldCheck, AlertCircle, UtensilsCrossed, Menu as MenuIcon, Car, Users, HelpCircle, Crown, ArrowLeft, ArrowRight, Building2, Building, Heart, Headphones, PenTool, Mic, Palette, Camera, BookOpen, Music, Hammer, GraduationCap, Newspaper, Briefcase, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRegisterAdminEdit } from "@/hooks/use-admin-edit";
import { AuthDialog } from "@/components/auth-dialog";
import { SiVisa, SiMastercard, SiAmericanexpress, SiApplepay, SiGooglepay, SiCashapp, SiBitcoin, SiVenmo } from "react-icons/si";
import { useSmartBack } from "@/hooks/use-smart-back";
import { Link } from "wouter";
import { useState, useEffect, useRef } from "react";
import { getDeviceId } from "@/lib/device";
import { trackLeadEvent } from "@/lib/lead-tracking";
import { trackIntelligenceEvent } from "@/lib/intelligence-tracker";
import type { Business, VenueChannel, VideoContent, LiveSession, Offer, MicrositeBlock, ProfileBadge } from "@shared/schema";
import { DEFAULT_MICROSITE_BLOCKS, BADGE_BLOCK_MAP, BUSINESS_ATTRIBUTES, FARM_PRODUCT_TYPES, FARM_ORDERING_METHODS, FARM_CSA_TYPES } from "@shared/schema";
import { getBusinessUrl } from "@/lib/business-url";
import { usePageMeta } from "@/hooks/use-page-meta";
import { JsonLd } from "@/components/json-ld";
import { getCityBranding, getBrandForContext } from "@shared/city-branding";
import { useI18n, localized } from "@/lib/i18n";
import ReviewSection, { computeCombinedRating } from "@/components/review-section";
import { getBusinessCanonicalUrl } from "@/lib/business-url";
import { ShareMenu } from "@/components/share-menu";
import { getBusinessFallbackImage, getSmallFallbackImage } from "@/lib/fallback-image";
import { mainLogo } from "@/lib/logos";
import { FeedCard, type FeedCardItem } from "@/components/feed/feed-card";
import { SidebarAd } from "@/components/ad-banner";
import { usePlatformAffiliates } from "@/hooks/use-platform-affiliates";
import { TrustCard, TrustSummary, deriveTrustSignals } from "@/components/trust-card";
import { buildUberRideLink, buildLyftRideLink, wrapAffiliateLink, getAffiliateId } from "@/lib/affiliate-links";
import { BlockRenderer, type BlockRendererContext } from "@/components/microsite/block-renderer";
import { DarkPageShell } from "@/components/dark-page-shell";
import { NeighborhoodContext, useNearbyData, buildNearbyJsonLd } from "@/components/neighborhood-context";

const RIDE_WORTHY_SLUGS = [
  "restaurant-dining", "fine-dining", "casual-dining", "fast-casual", "bars-breweries", "coffee-tea",
  "music-nightlife", "entertainment-recreation", "arts-culture", "sports-athletics", "family-fun", "parks-outdoors",
  "retail-shopping-cat", "clothing-apparel", "grocery-market", "furniture-home-decor",
];

export default function BusinessDetail({ citySlug, slug, categorySlug }: { citySlug: string; slug: string; categorySlug?: string }) {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const smartBack = useSmartBack(categorySlug ? `/${citySlug}/${categorySlug}` : `/${citySlug}/directory`);
  const { data: categories } = useCategories();
  const { data: zones } = useCityZones(citySlug);
  const { data: affiliateConfigs } = usePlatformAffiliates();
  const { user } = useAuth();
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [saved, setSaved] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const { data: business, isLoading } = useQuery<Business>({
    queryKey: ["/api/cities", citySlug, "businesses", slug],
  });

  useRegisterAdminEdit("businesses", business?.id, "Edit Business");

  const primaryCategory = business && categories
    ? categories.find((c) => business.categoryIds.includes(c.id))
    : undefined;

  const effectiveCategorySlug = categorySlug || primaryCategory?.slug;

  const { data: reviewsData } = useQuery<{ reviews: any[]; stats: { avgRating: number; count: number } }>({
    queryKey: ["/api/cities", citySlug, "businesses", slug, "reviews"],
    enabled: !!business,
  });

  const { data: relatedData } = useQuery<{ related: Business[]; topics: string[] }>({
    queryKey: ["/api/cities", citySlug, "businesses", slug, "related"],
    enabled: !!business,
  });

  const { data: sponsoredEvents } = useQuery<any[]>({
    queryKey: ["/api/cities", citySlug, "businesses", slug, "sponsored-events"],
    enabled: !!business,
  });

  const { data: businessFeedData, isLoading: isFeedLoading } = useQuery<{ items: FeedCardItem[]; total: number }>({
    queryKey: [`/api/business/${business?.id}/feed?citySlug=${citySlug}`],
    enabled: !!business?.id,
  });

  const { data: venueChannelData } = useQuery<{ channel: VenueChannel; videos: VideoContent[]; liveSession: LiveSession | null; offers: Offer[] } | null>({
    queryKey: ["/api/venue-channels/by-business", business?.id],
    enabled: !!business?.id,
  });

  const { data: nearbyData } = useNearbyData(
    citySlug,
    (business as Record<string, unknown>)?.latitude,
    (business as Record<string, unknown>)?.longitude,
    "business"
  );

  const { data: profileBadgesData } = useQuery<ProfileBadge[]>({
    queryKey: ["/api/businesses", business?.id, "badges"],
    enabled: !!business?.id,
  });

  const { data: crownStatusData } = useQuery<{ status: string; categoryName: string } | null>({
    queryKey: ["/api/businesses", business?.id, "crown-status"],
    enabled: !!business?.id,
  });

  const enabledBadges = profileBadgesData?.filter(b => b.enabled) || [];

  const isMicrositeView = !!((business?.listingTier === "ENHANCED" || business?.listingTier === "ENTERPRISE") && business?.micrositeEnabled);

  const { data: qaItems } = useQuery<{ id: string; question: string; answer: string | null; askedByName: string | null; createdAt: string }[]>({
    queryKey: ["/api/cities", citySlug, "presence", slug, "qa"],
    enabled: isMicrositeView,
  });

  const { data: shoppingCenterData } = useQuery<{ id: string; name: string; slug: string; address: string | null; centerType: string; businesses: Business[] }>({
    queryKey: ["/api/shopping-centers", business?.shoppingCenterId],
    enabled: !!business?.shoppingCenterId,
  });

  interface JobRow { id: string; title: string; employment_type: string | null; pay_min: number | null; pay_max: number | null; pay_unit: string | null; apply_url: string | null; details_url: string | null }
  interface JobListingRow { id: string; title: string; employment_type: string | null; compensation_min: number | null; compensation_max: number | null }

  const { data: jobsData } = useQuery<{ jobs: JobRow[]; jobListings: JobListingRow[] }>({
    queryKey: ["/api/businesses", business?.id, "jobs"],
    enabled: !!business?.id,
  });

  const activeJobs = [
    ...(jobsData?.jobs || []).map((j) => ({ id: j.id, title: j.title, type: j.employment_type, pay: j.pay_min && j.pay_max ? `$${j.pay_min}-$${j.pay_max}/${j.pay_unit || "hr"}` : null, url: j.apply_url || j.details_url, source: "job" as const })),
    ...(jobsData?.jobListings || []).map((j) => ({ id: j.id, title: j.title, type: j.employment_type, pay: j.compensation_min && j.compensation_max ? `$${j.compensation_min}-$${j.compensation_max}` : null, url: null as string | null, source: "listing" as const })),
  ];

  const relatedBusinesses = relatedData?.related || [];
  const topicTags = relatedData?.topics || [];

  const handleDisplay = (business as any)?.handle ? `@${(business as any).handle}` : null;

  const cityName = citySlug.charAt(0).toUpperCase() + citySlug.slice(1);
  const branding = getCityBranding(citySlug);
  const brand = branding ? getBrandForContext(branding, "default") : null;
  const hubName = brand?.ogSiteName || "CLT Hub";
  usePageMeta({
    title: business ? `${business.name}${handleDisplay ? ` (${handleDisplay})` : ""} | ${hubName}` : `Business | ${hubName}`,
    description: business?.description?.slice(0, 160) || `Local business in ${cityName} on ${hubName}.`,
    canonical: getBusinessCanonicalUrl(window.location.origin, citySlug, slug, effectiveCategorySlug),
    ogImage: `${window.location.origin}/api/og-image/business/${slug}`,
    ogSiteName: brand?.ogSiteName,
  });

  const profileViewFired = useRef(false);
  useEffect(() => {
    if (business?.id && !profileViewFired.current) {
      profileViewFired.current = true;
      trackIntelligenceEvent({
        citySlug,
        entityType: "BUSINESS",
        entityId: business.id,
        eventType: "PROFILE_VIEW",
        language: locale,
        referrer: document.referrer || undefined,
      });
    }
  }, [business?.id, citySlug, locale]);

  const handleSave = async () => {
    if (!user) {
      setShowAuthDialog(true);
      return;
    }
    const deviceId = getDeviceId();
    try {
      await apiRequest("POST", `/api/cities/${citySlug}/saved`, {
        deviceId,
        itemType: "BUSINESS",
        itemId: business?.id,
      });
      setSaved(true);
      if (business?.id) trackIntelligenceEvent({ citySlug, entityType: "BUSINESS", entityId: business.id, eventType: "SAVE" });
      toast({ title: t("biz.saved"), description: t("biz.savedDesc") });
    } catch {
      toast({ title: t("toast.error"), variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <DarkPageShell maxWidth="wide">
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="aspect-[2/1] w-full rounded-md" />
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-20 w-full" />
        </div>
      </DarkPageShell>
    );
  }

  if (!business) {
    return (
      <DarkPageShell maxWidth="wide">
        <Card className="p-12 text-center">
          <h3 className="font-semibold text-lg mb-1">{t("biz.notFound")}</h3>
          <Link href={`/${citySlug}/directory`}>
            <Button variant="ghost" className="mt-2">{t("biz.backToDirectory")}</Button>
          </Link>
        </Card>
      </DarkPageShell>
    );
  }

  const catNames = categories?.filter((c) => business.categoryIds.includes(c.id)).map((c) => c.name) || [];

  const serviceAreaZoneNames = (business.isServiceArea && business.serviceAreaZoneIds && zones)
    ? zones.filter((z: any) => business.serviceAreaZoneIds!.includes(z.id)).map((z: any) => z.name)
    : [];

  const matchedZone = business.zoneId && zones
    ? zones.find((z) => z.id === business.zoneId)
    : null;

  const galleryImages: string[] = (business as any).galleryImages || [];
  const socialLinks: Record<string, string> = (business as any).socialLinks || {};
  const youtubeUrl: string | null = (business as any).youtubeUrl || null;
  const languagesSpoken: string[] = business.languagesSpoken || [];
  const acceptedPayments: string[] = business.acceptedPayments || [];
  const barterNetworks: string[] = business.barterNetworks || [];
  const isItexMember = barterNetworks.includes("itex");

  const youtubeEmbedUrl = youtubeUrl ? (() => {
    const match = youtubeUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? `https://www.youtube.com/embed/${match[1]}` : null;
  })() : null;

  return (
    <DarkPageShell maxWidth="wide">
    <div className="space-y-6">
      <JsonLd data={(() => {
        const CATEGORY_SCHEMA_MAP: Record<string, string> = {
          "restaurants": "Restaurant",
          "food": "FoodEstablishment",
          "food-drink": "FoodEstablishment",
          "bars": "BarOrPub",
          "cafes": "CafeOrCoffeeShop",
          "bakeries": "Bakery",
          "health": "HealthAndBeautyBusiness",
          "health-beauty": "HealthAndBeautyBusiness",
          "beauty": "HealthAndBeautyBusiness",
          "spa": "HealthAndBeautyBusiness",
          "fitness": "HealthAndBeautyBusiness",
          "dental": "Dentist",
          "medical": "MedicalBusiness",
          "legal": "LegalService",
          "attorneys": "LegalService",
          "law": "LegalService",
          "automotive": "AutomotiveBusiness",
          "auto": "AutomotiveBusiness",
          "car-dealers": "AutoDealer",
          "auto-repair": "AutoRepair",
          "real-estate": "RealEstateAgent",
          "realtors": "RealEstateAgent",
          "home-services": "HomeAndConstructionBusiness",
          "plumbing": "Plumber",
          "electricians": "Electrician",
          "roofing": "RoofingContractor",
          "hvac": "HVACBusiness",
          "hotels": "Hotel",
          "lodging": "LodgingBusiness",
          "insurance": "InsuranceAgency",
          "accounting": "AccountingService",
          "pet-services": "PetStore",
          "veterinary": "Veterinarycare",
          "education": "EducationalOrganization",
          "childcare": "ChildCare",
          "shopping": "Store",
          "retail": "Store",
          "clothing": "ClothingStore",
          "jewelry": "JewelryStore",
          "electronics": "ElectronicsStore",
          "grocery": "GroceryStore",
          "florists": "Florist",
          "travel": "TravelAgency",
          "entertainment": "EntertainmentBusiness",
          "nightlife": "NightClub",
          "financial": "FinancialService",
          "banking": "BankOrCreditUnion",
        };

        const matchedCats = categories?.filter((c) => business.categoryIds.includes(c.id)) || [];
        let schemaType = "LocalBusiness";
        const isRestaurantCategory = matchedCats.some((c) =>
          ["restaurants", "food", "food-drink", "cafes", "bakeries", "bars"].includes(c.slug)
        );
        for (const cat of matchedCats) {
          if (CATEGORY_SCHEMA_MAP[cat.slug]) {
            schemaType = CATEGORY_SCHEMA_MAP[cat.slug];
            break;
          }
        }

        if ((business as any).isNonprofit) {
          schemaType = "NGO";
        }

        const DAY_MAP: Record<string, string> = {
          monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday",
          thursday: "Thursday", friday: "Friday", saturday: "Saturday", sunday: "Sunday",
        };

        const hoursData: Record<string, string> = (business as any).hoursOfOperation || {};
        const openingHoursSpec = Object.entries(hoursData)
          .filter(([, val]) => typeof val === 'string' && val.toLowerCase() !== "closed")
          .map(([day, val]) => {
            const dayName = DAY_MAP[day.toLowerCase()] || day;
            const parts = (val as string).split(/\s*[-–]\s*/);
            if (parts.length === 2) {
              const toTime = (t: string) => {
                const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
                if (!m) return t.trim();
                let h = parseInt(m[1]);
                const min = m[2];
                const ampm = m[3].toUpperCase();
                if (ampm === "PM" && h !== 12) h += 12;
                if (ampm === "AM" && h === 12) h = 0;
                return `${h.toString().padStart(2, "0")}:${min}`;
              };
              return {
                "@type": "OpeningHoursSpecification",
                dayOfWeek: dayName,
                opens: toTime(parts[0]),
                closes: toTime(parts[1]),
              };
            }
            return null;
          }).filter(Boolean);

        const lat = (business as any).latitude;
        const lng = (business as any).longitude;

        const langs: string[] = (business as any).languagesSpoken || [];

        return {
          "@context": "https://schema.org",
          "@type": schemaType,
          name: business.name,
          url: getBusinessCanonicalUrl(window.location.origin, citySlug, slug, effectiveCategorySlug),
          ...(business.description && { description: business.description }),
          ...(business.imageUrl && { image: business.imageUrl }),
          ...(business.isVerified && business.phone && { telephone: business.phone }),
          ...((business as any).handle && { alternateName: `@${(business as any).handle}` }),
          ...(business.isVerified && business.websiteUrl && { sameAs: [business.websiteUrl] }),
          ...(business.isVerified && business.address && {
            address: {
              "@type": "PostalAddress",
              streetAddress: business.address,
              addressLocality: business.city || cityName,
              addressRegion: business.state || "",
              ...(business.zip && { postalCode: business.zip }),
              addressCountry: "US",
            },
          }),
          ...(() => {
            const hubStats = reviewsData?.stats;
            const combined = computeCombinedRating(
              business.googleRating || undefined,
              business.googleReviewCount || undefined,
              hubStats?.avgRating,
              hubStats?.count,
            );
            return combined.totalCount > 0 ? {
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: Number(combined.combinedAvg.toFixed(1)),
                reviewCount: combined.totalCount,
              },
            } : {};
          })(),
          ...(business.priceRange && {
            priceRange: "$".repeat(business.priceRange),
          }),
          ...(business.isServiceArea && serviceAreaZoneNames.length > 0 && {
            areaServed: serviceAreaZoneNames.map((name: string) => ({
              "@type": "City",
              name,
            })),
          }),
          ...(isRestaurantCategory && business.websiteUrl && {
            hasMenu: business.websiteUrl,
          }),
          ...(openingHoursSpec.length > 0 && {
            openingHoursSpecification: openingHoursSpec,
          }),
          ...(lat && lng && {
            geo: {
              "@type": "GeoCoordinates",
              latitude: parseFloat(lat),
              longitude: parseFloat(lng),
            },
          }),
          ...((business as any).googleMapsUrl && {
            hasMap: (business as any).googleMapsUrl,
          }),
          ...(langs.length > 0 && {
            knowsLanguage: langs,
          }),
          isPartOf: {
            "@type": "WebSite",
            name: brand?.jsonLdName || "CLT Metro Hub",
            alternateName: branding?.brandVariants || [],
            ...(brand?.sameAs && brand.sameAs.length > 0 && { sameAs: brand.sameAs }),
          },
        };
      })()} />
      {youtubeEmbedUrl && (
        <JsonLd data={{
          "@context": "https://schema.org",
          "@type": "VideoObject",
          name: `${business.name} Video`,
          description: business.description?.slice(0, 200) || `Video for ${business.name}`,
          embedUrl: youtubeEmbedUrl,
          ...(youtubeUrl && { contentUrl: youtubeUrl }),
          ...(business.imageUrl && { thumbnailUrl: business.imageUrl }),
          uploadDate: (business as any).createdAt ? new Date((business as any).createdAt).toISOString() : new Date().toISOString(),
        }} />
      )}
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: t("biz.home"), item: `${window.location.origin}/${citySlug}` },
          ...(effectiveCategorySlug ? [
            { "@type": "ListItem", position: 2, name: catNames[0] || effectiveCategorySlug, item: `${window.location.origin}/${citySlug}/${effectiveCategorySlug}` },
            { "@type": "ListItem", position: 3, name: business.name, item: getBusinessCanonicalUrl(window.location.origin, citySlug, slug, effectiveCategorySlug) },
          ] : [
            { "@type": "ListItem", position: 2, name: t("biz.commerceHub"), item: `${window.location.origin}/${citySlug}/directory` },
            { "@type": "ListItem", position: 3, name: business.name, item: `${window.location.origin}/${citySlug}/directory/${slug}` },
          ]),
        ],
      }} />
      {nearbyData && nearbyData.groups.length > 0 && (
        <JsonLd data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `Nearby points of interest around ${business.name}`,
          itemListElement: buildNearbyJsonLd(nearbyData).map((item, i) => ({
            "@type": "ListItem",
            position: i + 1,
            item,
          })),
        }} />
      )}
      {(() => {
        const backCategory = categories?.find((c) => business.categoryIds.includes(c.id));
        const backSlug = categorySlug || backCategory?.slug;
        const backLabel = backCategory?.name;
        return (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-purple-300 mb-2"
            data-testid="link-back-context"
            onClick={() => backSlug ? smartBack(`/${citySlug}/${backSlug}`) : smartBack()}
          >
            <ArrowLeft className="h-4 w-4" /> {backSlug && backLabel ? `Back to ${backLabel}` : "Back to Directory"}
          </Button>
        );
      })()}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground flex-wrap" data-testid="nav-breadcrumb" aria-label="Breadcrumb">
        <Link href={`/${citySlug}`}>
          <span className="hover:text-foreground cursor-pointer flex items-center gap-1">
            <Home className="h-3.5 w-3.5" />
            {t("biz.home")}
          </span>
        </Link>
        {effectiveCategorySlug && primaryCategory ? (
          <>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link href={`/${citySlug}/${effectiveCategorySlug}`}>
              <span className="hover:text-foreground cursor-pointer">{primaryCategory.name}</span>
            </Link>
          </>
        ) : (
          <>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link href={`/${citySlug}/directory`}>
              <span className="hover:text-foreground cursor-pointer">{t("biz.commerceHub")}</span>
            </Link>
          </>
        )}
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium truncate max-w-[200px]">{business.name}</span>
      </nav>

      {!isMicrositeView && (
        <div className="aspect-[2.5/1] overflow-hidden rounded-md">
          <img
            src={getBusinessFallbackImage(
              business.imageUrl,
              categories?.filter((c) => business.categoryIds.includes(c.id)).map((c) => c.slug) || []
            )}
            alt={business.name}
            className="h-full w-full object-cover"
          />
        </div>
      )}

      {!isMicrositeView && business.listingTier === "ENHANCED" && (
        <div className="flex items-center gap-2 flex-wrap" data-testid="section-tier-badge">
          <Badge style={{ backgroundColor: business.listingTier === "ENHANCED" ? "#5B1D8F" : "#F2C230", color: business.listingTier === "ENHANCED" ? "white" : "black" }}>
            <Crown className="h-3 w-3 mr-1" />
            Enhanced Hub Presence
          </Badge>
        </div>
      )}

      {!isMicrositeView && <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl text-white" data-testid="text-business-name">{business.name}</h1>
          {handleDisplay && (
            <p className="text-sm text-muted-foreground mt-0.5" data-testid="text-business-handle">{handleDisplay}</p>
          )}
          {(business as any).parentBrand && (
            <p className="text-sm text-muted-foreground mt-0.5" data-testid="text-parent-brand">Independent agent of <strong>{(business as any).parentBrand}</strong></p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {business.claimStatus === "UNCLAIMED" && !isMicrositeView && (
              <Badge variant="outline" className="text-white/60 border-white/20 gap-1" data-testid="badge-unclaimed">
                <AlertCircle className="h-3 w-3" />
                Unclaimed
              </Badge>
            )}
            {business.isVerified && (
              <Badge variant="secondary"><Star className="mr-1 h-3 w-3" />{t("badge.verified")}</Badge>
            )}
            {business.isFeatured && <Badge>{t("badge.featured")}</Badge>}
            {activeJobs.length > 0 && (
              <Badge className="bg-green-600 text-white gap-1" data-testid="badge-now-hiring">
                <Briefcase className="h-3 w-3" />Now Hiring
              </Badge>
            )}
            {business.creatorType && (
              <Badge className="bg-purple-600 text-white gap-1" data-testid="badge-creator-type">
                <Sparkles className="h-3 w-3" />{business.creatorType}
              </Badge>
            )}
            {business.listingTier !== "VERIFIED" && (
              <Badge variant="outline" className="text-white/70 border-white/20">{business.listingTier}</Badge>
            )}
            {business.priceRange && (
              <Badge variant="outline" className="font-semibold text-white/70 border-white/20" data-testid="badge-price-range">
                <DollarSign className="h-3 w-3 mr-0.5" />
                {"$".repeat(business.priceRange)}
              </Badge>
            )}
            {business.claimStatus !== "UNCLAIMED" && (() => {
              const hubStats = reviewsData?.stats;
              const combined = computeCombinedRating(
                business.googleRating || undefined,
                business.googleReviewCount || undefined,
                hubStats?.avgRating,
                hubStats?.count,
              );
              return combined.totalCount > 0 ? (
                <Badge variant="outline" className="text-white/80 border-white/20" data-testid="badge-combined-rating">
                  <Star className="h-3 w-3 mr-0.5 fill-amber-400 text-amber-400" />
                  {combined.combinedAvg.toFixed(1)} ({combined.totalCount})
                </Badge>
              ) : business.googleRating ? (
                <Badge variant="outline" className="text-white/80 border-white/20" data-testid="badge-google-rating">
                  <Star className="h-3 w-3 mr-0.5 fill-amber-400 text-amber-400" />
                  {business.googleRating}
                </Badge>
              ) : null;
            })()}
            {catNames.map((name) => (
              <Badge key={name} variant="outline" className="text-white/70 border-white/20">{name}</Badge>
            ))}
            {shoppingCenterData && (
              <Link href={`/${citySlug}/shopping-centers/${shoppingCenterData.slug}`}>
                <Badge variant="outline" className="text-white/70 border-white/20 gap-1 cursor-pointer hover:text-white hover:border-white/40" data-testid="badge-shopping-center">
                  <Building2 className="h-3 w-3" />
                  {shoppingCenterData.name}
                </Badge>
              </Link>
            )}
            {(business.featureAttributes || []).includes("lgbtq-friendly") && (
              <Badge variant="secondary" className="bg-gradient-to-r from-red-500/20 via-purple-500/20 to-blue-500/20 border-purple-500/30" data-testid="badge-lgbtq-friendly">
                <span className="mr-1">🏳️‍🌈</span> LGBTQ+ Friendly
              </Badge>
            )}
            {(business.featureAttributes || []).includes("veteran-owned") && (
              <Badge variant="secondary" data-testid="badge-veteran-owned">
                <span className="mr-1">🎖️</span> Veteran Owned
              </Badge>
            )}
            {(business.featureAttributes || []).includes("black-owned") && (
              <Badge variant="secondary" data-testid="badge-black-owned">
                <span className="mr-1">✊</span> Black Owned
              </Badge>
            )}
            {(business.featureAttributes || []).includes("women-owned") && (
              <Badge variant="secondary" data-testid="badge-women-owned">
                <span className="mr-1">💪</span> Women Owned
              </Badge>
            )}
            {enabledBadges.map((pb) => {
              const badgeConfig: Record<string, { icon: typeof Building2; label: string }> = {
                BUSINESS: { icon: Building2, label: "Business" },
                ORGANIZATION: { icon: Building, label: "Organization" },
                NONPROFIT: { icon: Heart, label: "Nonprofit" },
                PODCAST: { icon: Headphones, label: "Podcast" },
                CREATOR: { icon: Video, label: "Creator" },
                CONTRIBUTOR: { icon: PenTool, label: "Contributor" },
                LOCAL_EXPERT: { icon: Award, label: "Local Expert" },
                SPEAKER: { icon: Mic, label: "Speaker" },
                VENUE: { icon: MapPin, label: "Venue" },
                ARTIST: { icon: Palette, label: "Artist" },
                PHOTOGRAPHER: { icon: Camera, label: "Photographer" },
                AUTHOR: { icon: BookOpen, label: "Author" },
                MUSICIAN: { icon: Music, label: "Musician" },
                MAKER: { icon: Hammer, label: "Maker" },
                INSTRUCTOR: { icon: GraduationCap, label: "Instructor" },
                COMMUNITY_LEADER: { icon: Users, label: "Community Leader" },
                EVENT_HOST: { icon: CalendarCheck, label: "Event Host" },
                PRESS_SOURCE: { icon: Newspaper, label: "Press Source" },
              };
              const cfg = badgeConfig[pb.badgeType];
              if (!cfg) return null;
              const Icon = cfg.icon;
              return (
                <Badge key={pb.id} variant="secondary" data-testid={`badge-profile-${pb.badgeType.toLowerCase()}`}>
                  <Icon className="h-3 w-3 mr-1" />
                  {cfg.label}
                </Badge>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="text-white/70 border-white/20 hover:text-white hover:border-white/40" onClick={handleSave} data-testid="button-save-business">
            <Bookmark className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
          </Button>
          <ShareMenu title={business.name} type="business" slug={slug} triggerClassName="text-white/70 border-white/20 hover:text-white hover:border-white/40" />
        </div>
      </div>}

      {!isMicrositeView && (business.acceptingSpeakingRequests || business.acceptingPressRequests || business.acceptingMarketplaceOrders) && (
        <div className="flex flex-wrap gap-2 mb-4" data-testid="accepting-indicators">
          {business.acceptingSpeakingRequests && (
            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs flex items-center gap-1">
              <Mic className="h-3 w-3" />
              Accepting Speaking Requests
            </Badge>
          )}
          {business.acceptingPressRequests && (
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs flex items-center gap-1">
              <Newspaper className="h-3 w-3" />
              Accepting Press Requests
            </Badge>
          )}
          {business.acceptingMarketplaceOrders && (
            <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs flex items-center gap-1">
              <ShoppingBag className="h-3 w-3" />
              Accepting Marketplace Orders
            </Badge>
          )}
        </div>
      )}

      {!isMicrositeView && <div className="flex flex-wrap gap-2 mb-4" data-testid="cross-links">
        {matchedZone && (
          <Link href={`/${citySlug}/neighborhoods/${matchedZone.slug}`}>
            <Button variant="outline" size="sm" className="text-cyan-400 border-cyan-500/30" data-testid="link-neighborhood-hub">
              <MapPin className="h-3 w-3 mr-1" />
              {matchedZone.name}
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        )}
        <Link href={`/${citySlug}/map`}>
          <Button variant="outline" size="sm" className="text-indigo-400 border-indigo-500/30" data-testid="link-view-on-map">
            <Navigation className="h-3 w-3 mr-1" />
            {t("biz.viewOnMap")}
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </Link>
        {enabledBadges.some(b => b.badgeType === "SPEAKER") && (
          <a href={`/${citySlug}/speakers`} data-testid="link-speakers-bureau">
            <Button variant="outline" size="sm" className="text-blue-400 border-blue-500/30">
              <Mic className="h-3 w-3 mr-1" />
              Speakers Bureau
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </a>
        )}
        {enabledBadges.some(b => b.badgeType === "LOCAL_EXPERT") && (
          <a href={`/${citySlug}/experts`} data-testid="link-expert-directory">
            <Button variant="outline" size="sm" className="text-amber-400 border-amber-500/30">
              <Award className="h-3 w-3 mr-1" />
              Expert Directory
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </a>
        )}
        {enabledBadges.some(b => ["CREATOR", "ARTIST", "PHOTOGRAPHER", "AUTHOR", "MUSICIAN", "MAKER", "INSTRUCTOR"].includes(b.badgeType)) && (
          <a href={`/${citySlug}/creators`} data-testid="link-creator-directory">
            <Button variant="outline" size="sm" className="text-purple-400 border-purple-500/30">
              <Palette className="h-3 w-3 mr-1" />
              Creator Directory
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </a>
        )}
        {enabledBadges.some(b => b.badgeType === "PRESS_SOURCE") && (
          <a href={`/${citySlug}/press`} data-testid="link-press-directory">
            <Button variant="outline" size="sm" className="text-emerald-400 border-emerald-500/30">
              <Newspaper className="h-3 w-3 mr-1" />
              Press Directory
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </a>
        )}
      </div>}

      <div className={isMicrositeView ? "space-y-0" : "grid grid-cols-1 gap-6 lg:grid-cols-3"}>
        <div className={isMicrositeView ? "space-y-4" : "lg:col-span-2 space-y-4"}>
          {!isMicrositeView && business.description && (
            <Card className="p-5">
              <h2 className="font-semibold mb-2 text-white">{t("biz.about")}</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{localized(locale, business.description, business.descriptionEs)}</p>
            </Card>
          )}

          {(() => {
            const attrs = business.featureAttributes || [];
            const detailAttrs = BUSINESS_ATTRIBUTES.filter(a => a.tier === "detail");
            const matched = detailAttrs.filter(a => attrs.includes(a.slug));
            if (matched.length === 0) return null;
            return (
              <Card className="p-5" data-testid="card-detail-badges">
                <h2 className="font-semibold mb-3 text-white flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Features & Options
                </h2>
                <div className="flex flex-wrap gap-2">
                  {matched.map(a => (
                    <Badge key={a.slug} className="bg-white/10 text-white/80 border-white/20 text-xs" data-testid={`badge-detail-${a.slug}`}>
                      {a.label}
                    </Badge>
                  ))}
                </div>
              </Card>
            );
          })()}

          {(() => {
            const farmProducts = business.farmProductTypes || [];
            const farmOrdering = business.orderingMethod || [];
            const farmMarketDays = business.marketDays || [];
            const hasFarmData = farmProducts.length > 0 || farmOrdering.length > 0 || farmMarketDays.length > 0 || business.csaSubscriptionType || business.pickupSchedule || business.acceptsPreorders || (business.seasonalAvailability && Object.keys(business.seasonalAvailability).length > 0);
            if (!hasFarmData) return null;
            return (
              <Card className="p-5 border-green-500/20" data-testid="card-farm-info">
                <h2 className="font-semibold mb-3 text-white flex items-center gap-2">
                  <span>🌱</span>
                  Farm & Local Food Info
                </h2>
                <div className="space-y-3">
                  {farmProducts.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-400 mb-1.5" data-testid="label-farm-products">Products Available</p>
                      <div className="flex flex-wrap gap-1.5">
                        {farmProducts.map((p: string) => {
                          const info = FARM_PRODUCT_TYPES.find(t => t.slug === p);
                          return <Badge key={p} variant="outline" className="border-green-500/30 text-green-300 text-xs" data-testid={`badge-farm-product-${p}`}>{info?.label || p}</Badge>;
                        })}
                      </div>
                    </div>
                  )}
                  {farmOrdering.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-400 mb-1.5" data-testid="label-ordering-methods">How to Order</p>
                      <div className="flex flex-wrap gap-1.5">
                        {farmOrdering.map((m: string) => {
                          const info = FARM_ORDERING_METHODS.find(t => t.slug === m);
                          return <Badge key={m} variant="outline" className="border-blue-500/30 text-blue-300 text-xs" data-testid={`badge-ordering-${m}`}>{info?.label || m}</Badge>;
                        })}
                      </div>
                    </div>
                  )}
                  {business.csaSubscriptionType && business.csaSubscriptionType !== "none" && (
                    <div>
                      <p className="text-xs text-gray-400 mb-1" data-testid="label-csa-type">CSA / Subscription</p>
                      <p className="text-sm text-white" data-testid="text-csa-type">{FARM_CSA_TYPES.find(t => t.slug === business.csaSubscriptionType)?.label || business.csaSubscriptionType}</p>
                    </div>
                  )}
                  {business.pickupSchedule && (
                    <div>
                      <p className="text-xs text-gray-400 mb-1" data-testid="label-pickup-schedule">Pickup Schedule</p>
                      <p className="text-sm text-white" data-testid="text-pickup-schedule">{business.pickupSchedule}</p>
                    </div>
                  )}
                  {farmMarketDays.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-400 mb-1.5" data-testid="label-market-days">Market Days</p>
                      <div className="flex flex-wrap gap-1.5">
                        {farmMarketDays.map((d: string) => (
                          <Badge key={d} variant="outline" className="border-amber-500/30 text-amber-300 text-xs" data-testid={`badge-market-day-${d}`}>{d}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {business.acceptsPreorders && (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-green-500/20 text-green-300 border-green-500/30 text-xs" data-testid="badge-accepts-preorders">Accepts Pre-orders</Badge>
                    </div>
                  )}
                  {business.seasonalAvailability && Object.keys(business.seasonalAvailability).length > 0 && (
                    <div>
                      <p className="text-xs text-gray-400 mb-1.5" data-testid="label-seasonal">Seasonal Availability</p>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(business.seasonalAvailability).map(([season, desc]) => (
                          <Badge key={season} variant="outline" className="border-orange-500/30 text-orange-300 text-xs" data-testid={`badge-season-${season}`}>
                            {season}: {desc as string}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })()}

          {enabledBadges.some(b => b.badgeType === "SPEAKER") && (business.speakerTopics?.length || business.speakingFeeRange || business.speakingFormats?.length) && (
            <Card className="p-5 border-blue-500/20" data-testid="card-speaker-quick-info">
              <div className="flex items-center gap-2 mb-3">
                <Mic className="w-5 h-5 text-blue-400" />
                <h2 className="font-semibold text-white">Speaker Info</h2>
              </div>
              <div className="space-y-3">
                {business.speakerTopics && business.speakerTopics.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1.5">Topics</p>
                    <div className="flex flex-wrap gap-1.5">
                      {business.speakerTopics.map((topic: string, i: number) => (
                        <Badge key={i} variant="outline" className="border-blue-500/30 text-blue-300 text-xs">{topic}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {business.speakingFormats && business.speakingFormats.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1.5">Formats</p>
                    <div className="flex flex-wrap gap-1.5">
                      {business.speakingFormats.map((fmt: string, i: number) => (
                        <Badge key={i} variant="outline" className="border-gray-600 text-gray-300 text-xs">{fmt}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {business.speakingFeeRange && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Fee Range</p>
                    <p className="text-sm text-white">{business.speakingFeeRange}</p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {enabledBadges.some(b => b.badgeType === "LOCAL_EXPERT") && business.expertCategories && business.expertCategories.length > 0 && (
            <Card className="p-5 border-amber-500/20" data-testid="card-expert-quick-info">
              <div className="flex items-center gap-2 mb-3">
                <Award className="w-5 h-5 text-amber-400" />
                <h2 className="font-semibold text-white">Expert Categories</h2>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {business.expertCategories.map((cat: string, i: number) => (
                  <Badge key={i} variant="outline" className="border-amber-500/30 text-amber-300 text-xs">{cat}</Badge>
                ))}
              </div>
            </Card>
          )}

          {(() => {
            const badgeUnlockedTypes = enabledBadges.flatMap(b => BADGE_BLOCK_MAP[b.badgeType] || []);
            const hasBadgeBlocks = badgeUnlockedTypes.length > 0;
            if (!isMicrositeView && !hasBadgeBlocks) return null;
            const blocks: MicrositeBlock[] = (business.micrositeBlocks as MicrositeBlock[] | null) || DEFAULT_MICROSITE_BLOCKS;
            const filteredBlocks = isMicrositeView
              ? blocks
              : blocks.filter(b => badgeUnlockedTypes.includes(b.type));
            const draftMeta = (business as any).micrositeDraftMeta as Record<string, any> | null;
            const brandColors = draftMeta?.brandColors as string[] | undefined;
            const accentColor = business.micrositeThemeColor || (brandColors && brandColors.length > 0 ? brandColors[0] : null) || "#5B1D8F";
            const template = business.micrositeTemplate || "modern";
            const blockContext: BlockRendererContext = {
              businessName: business.name,
              coverImage: business.imageUrl,
              galleryImages: galleryImages,
              hoursOfOperation: business.hoursOfOperation || {},
              address: business.address,
              phone: business.phone,
              email: business.ownerEmail,
              website: business.websiteUrl,
              menuUrl: business.menuUrl,
              orderingLinks: business.orderingLinks,
              reservationUrl: business.reservationUrl,
              businessId: business.id,
              events: sponsoredEvents?.map((e: any) => ({
                id: e.id, title: e.title, slug: e.slug,
                startDateTime: e.startDateTime || e.start_date_time || "",
                endDateTime: e.endDateTime || e.end_date_time || null,
                locationName: e.locationName || e.location_name,
                visibility: e.visibility || "public",
              })) || [],
              reviews: reviewsData?.reviews?.map((r: any) => ({
                id: r.id, rating: r.rating, text: r.text || r.comment || "",
                displayName: r.displayName || r.display_name || "Anonymous",
                source: r.source || "internal",
                createdAt: r.createdAt || r.created_at || "",
              })) || [],
              googleRating: business.googleRating || undefined,
              googleReviewCount: business.googleReviewCount || undefined,
              citySlug,
              businessSlug: slug,
              latitude: business.latitude ? parseFloat(String(business.latitude)) : null,
              longitude: business.longitude ? parseFloat(String(business.longitude)) : null,
            };
            return filteredBlocks.some(b => b.enabled) ? (
              <>
                <div data-testid="section-microsite-blocks" className={isMicrositeView ? "-mx-6 -mt-4 overflow-hidden" : "rounded-md overflow-hidden"}>
                  <BlockRenderer
                    blocks={filteredBlocks}
                    template={template}
                    accentColor={accentColor}
                    context={blockContext}
                    locale={locale as "en" | "es"}
                  />
                </div>
                {isMicrositeView && (
                  <div className="mt-4 flex items-center gap-2 flex-wrap" data-testid="microsite-trust-summary">
                    <TrustSummary
                      signals={deriveTrustSignals(business, {
                        profileBadges: enabledBadges.map(b => b.badgeType),
                        hubAvgRating: reviewsData?.stats?.avgRating,
                        hubReviewCount: reviewsData?.stats?.count,
                        crownStatus: crownStatusData?.status || null,
                        crownCategoryName: crownStatusData?.categoryName || null,
                      })}
                    />
                  </div>
                )}
              </>
            ) : null;
          })()}

          {isMicrositeView && qaItems && qaItems.length > 0 && (() => {
            const draftMeta2 = (business as any).micrositeDraftMeta as Record<string, any> | null;
            const brandColors2 = draftMeta2?.brandColors as string[] | undefined;
            const qaBorderColor = business.micrositeThemeColor || (brandColors2 && brandColors2.length > 0 ? brandColors2[0] : null) || "#5B1D8F";
            return (
              <div className="mx-auto max-w-4xl px-4 py-8 space-y-4" data-testid="section-expert-qa">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <HelpCircle className="h-5 w-5" />
                  Expert Q&A
                </h2>
                <div className="space-y-3">
                  {qaItems.filter(q => q.answer).map(qa => (
                    <Card key={qa.id} className="p-4 border-l-4" style={{ borderLeftColor: qaBorderColor }} data-testid={`qa-item-${qa.id}`}>
                      <p className="font-medium text-white text-sm">{qa.question}</p>
                      {qa.askedByName && <p className="text-xs text-muted-foreground mt-0.5">Asked by {qa.askedByName}</p>}
                      <p className="text-sm text-muted-foreground mt-2">{qa.answer}</p>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })()}

          {venueChannelData?.channel ? (
            <Card className="p-5" data-testid="card-venue-channel">
              <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                <h2 className="font-semibold flex items-center gap-2 text-white">
                  <Video className="h-4 w-4" />
                  {venueChannelData.channel.channelTitle}
                </h2>
                <Link href={`/${citySlug}/channel/${venueChannelData.channel.channelSlug}`}>
                  <Button variant="outline" size="sm" className="gap-1 text-white/70 border-white/20 hover:text-white hover:border-white/40" data-testid="link-view-full-channel">
                    {locale === "es" ? "Ver Canal Completo" : "View Full Channel"}
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </Link>
              </div>

              {venueChannelData.liveSession && venueChannelData.liveSession.status === "live" && (
                <div className="mb-4" data-testid="section-live-now">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-red-600 text-white gap-1 no-default-hover-elevate no-default-active-elevate">
                      <Radio className="h-3 w-3 animate-pulse" />
                      LIVE NOW
                    </Badge>
                    <span className="text-sm font-medium truncate">{venueChannelData.liveSession.title}</span>
                  </div>
                  {venueChannelData.liveSession.youtubeVideoId && (
                    <div className="aspect-video rounded-md overflow-hidden">
                      <iframe
                        src={`https://www.youtube.com/embed/${venueChannelData.liveSession.youtubeVideoId}?autoplay=1`}
                        title={venueChannelData.liveSession.title}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  )}
                </div>
              )}

              {venueChannelData.liveSession && venueChannelData.liveSession.status === "scheduled" && (
                <div className="mb-4 p-3 rounded-md bg-muted/50 flex items-center gap-2 flex-wrap" data-testid="section-scheduled-live">
                  <Badge variant="outline" className="gap-1">
                    <Calendar className="h-3 w-3" />
                    {locale === "es" ? "Próximamente en Vivo" : "Upcoming Live"}
                  </Badge>
                  <span className="text-sm font-medium">{venueChannelData.liveSession.title}</span>
                  {venueChannelData.liveSession.startTime && (
                    <span className="text-xs text-muted-foreground">
                      {new Date(venueChannelData.liveSession.startTime).toLocaleString()}
                    </span>
                  )}
                </div>
              )}

              {venueChannelData.videos.length > 0 && (
                <div className="mb-4" data-testid="section-channel-videos">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">
                    {locale === "es" ? "Videos Recientes" : "Latest Videos"}
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {venueChannelData.videos.slice(0, 4).map((video) => {
                      const videoEmbedId = video.youtubeVideoId || (() => {
                        if (!video.youtubeUrl) return null;
                        const m = video.youtubeUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
                        return m ? m[1] : null;
                      })();
                      return (
                        <a
                          key={video.id}
                          href={video.youtubeUrl || `https://www.youtube.com/watch?v=${videoEmbedId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group relative aspect-video rounded-md overflow-hidden bg-muted"
                          data-testid={`card-channel-video-${video.id}`}
                        >
                          {video.thumbnailUrl || videoEmbedId ? (
                            <img
                              src={video.thumbnailUrl || `https://img.youtube.com/vi/${videoEmbedId}/mqdefault.jpg`}
                              alt={video.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Play className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Play className="h-8 w-8 text-white" />
                          </div>
                          <p className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 text-xs text-white truncate">
                            {video.title}
                          </p>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              {venueChannelData.offers.length > 0 && (
                <div data-testid="section-channel-offers">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <ShoppingBag className="h-3.5 w-3.5" />
                    {locale === "es" ? "Ofertas Disponibles" : "Available Offers"}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {venueChannelData.offers.slice(0, 2).map((offer) => (
                      <Card key={offer.id} className="p-3" data-testid={`card-channel-offer-${offer.id}`}>
                        <div className="flex items-start gap-3">
                          {offer.imageUrl && (
                            <img src={offer.imageUrl} alt={offer.title} className="w-12 h-12 rounded object-cover shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{offer.title}</p>
                            {offer.price != null && (
                              <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                                ${(offer.price / 100).toFixed(2)}
                              </p>
                            )}
                          </div>
                          {offer.checkoutUrl && (
                            <a href={offer.checkoutUrl} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" data-testid={`button-buy-offer-${offer.id}`}>
                                {locale === "es" ? "Comprar" : "Buy"}
                              </Button>
                            </a>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                  {venueChannelData.offers.length > 2 && (
                    <Link href={`/${citySlug}/channel/${venueChannelData.channel.channelSlug}`}>
                      <Button variant="ghost" size="sm" className="mt-2 gap-1 text-sm" data-testid="link-see-all-offers">
                        {locale === "es" ? "Ver Todas las Ofertas" : "See All Offers"} <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  )}
                </div>
              )}
            </Card>
          ) : youtubeEmbedUrl ? (
            <Card className="p-5" data-testid="card-youtube-embed">
              <h2 className="font-semibold mb-3 flex items-center gap-2 text-white"><Play className="h-4 w-4" /> {t("biz.video")}</h2>
              <div className="aspect-video rounded-md overflow-hidden">
                <iframe
                  src={youtubeEmbedUrl}
                  title={`${business.name} video`}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </Card>
          ) : null}

          {business.mlsEmbedUrl && (
            <Card className="p-5" data-testid="card-mls-embed">
              <h2 className="font-semibold mb-3 flex items-center gap-2 text-white">
                <Home className="h-4 w-4" />
                MLS Listings
              </h2>
              <div className="aspect-video rounded-md overflow-hidden">
                <iframe
                  src={business.mlsEmbedUrl}
                  title={`${business.name} MLS listings`}
                  className="w-full h-full border-0"
                  sandbox="allow-scripts allow-same-origin allow-popups"
                  loading="lazy"
                  data-testid="iframe-mls-embed"
                />
              </div>
            </Card>
          )}

          {galleryImages.length > 0 && (
            <Card className="p-5" data-testid="card-photo-gallery">
              <h2 className="font-semibold mb-3 text-white">{t("biz.photoGallery")}</h2>
              <div className="relative">
                <div className="aspect-[16/9] overflow-hidden rounded-md">
                  <img
                    src={galleryImages[galleryIndex]}
                    alt={`${business.name} photo ${galleryIndex + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                {galleryImages.length > 1 && (
                  <>
                    <button
                      onClick={() => setGalleryIndex((i) => (i - 1 + galleryImages.length) % galleryImages.length)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1.5 hover:bg-black/70"
                      data-testid="button-gallery-prev"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setGalleryIndex((i) => (i + 1) % galleryImages.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1.5 hover:bg-black/70"
                      data-testid="button-gallery-next"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {galleryImages.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setGalleryIndex(i)}
                          className={`w-2 h-2 rounded-full ${i === galleryIndex ? "bg-white" : "bg-white/50"}`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
              {galleryImages.length > 1 && (
                <div className="mt-2 flex gap-2 overflow-x-auto">
                  {galleryImages.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setGalleryIndex(i)}
                      className={`shrink-0 w-16 h-12 rounded overflow-hidden border-2 ${i === galleryIndex ? "border-primary" : "border-transparent"}`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </Card>
          )}

          {business.listingTier === "ENHANCED" ? (
            <ReviewSection
              citySlug={citySlug}
              businessSlug={slug}
              businessId={business.id}
              businessName={business.name}
              listingTier={business.listingTier}
              googleRating={business.claimStatus !== "UNCLAIMED" ? (business.googleRating || undefined) : undefined}
              googleReviewCount={business.claimStatus !== "UNCLAIMED" ? (business.googleReviewCount || undefined) : undefined}
              onRequireAuth={!user ? () => setShowAuthDialog(true) : undefined}
            />
          ) : business.claimStatus !== "UNCLAIMED" ? (
            <Card className="bg-white/5 border-white/10 p-6" data-testid="section-reviews-upgrade">
              <div className="flex items-center gap-2 mb-3">
                <Star className="h-5 w-5 text-amber-400" />
                <h3 className="text-white font-semibold">Reviews</h3>
              </div>
              <p className="text-white/70 text-sm mb-4">
                Collect and display customer reviews to build trust and attract more customers.
              </p>
              <Link href={`/${citySlug}/activate?upgrade=true`}>
                <Button className="bg-amber-500 hover:bg-amber-600 text-black font-semibold" data-testid="button-upgrade-reviews">
                  <Crown className="h-4 w-4 mr-2" />
                  Upgrade to Enhanced to Unlock Reviews
                </Button>
              </Link>
            </Card>
          ) : null}


          {(businessFeedData?.items?.length ?? 0) > 0 && (
            <section data-testid="section-business-updates">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 text-white">
                <Rss className="h-4 w-4 text-muted-foreground" />
                Updates
              </h2>
              <div className="space-y-3">
                {businessFeedData!.items.map((item) => (
                  <div key={item.id} data-testid={`card-business-feed-${item.id}`}>
                    <FeedCard
                      item={item}
                      onCardClick={() => {}}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}
          {isFeedLoading && (
            <div className="space-y-3">
              <Skeleton className="h-48 w-full rounded-md" />
              <Skeleton className="h-48 w-full rounded-md" />
            </div>
          )}
        </div>

        {!isMicrositeView && <div className="space-y-4">
          {(() => {
            const trustSignals = deriveTrustSignals(business, {
              profileBadges: enabledBadges.map(b => b.badgeType),
              hubAvgRating: reviewsData?.stats?.avgRating,
              hubReviewCount: reviewsData?.stats?.count,
              crownStatus: crownStatusData?.status || null,
              crownCategoryName: crownStatusData?.categoryName || null,
            });
            return <TrustCard signals={trustSignals} />;
          })()}

          {business.isVerified ? (
            business.isServiceArea && serviceAreaZoneNames.length > 0 ? (
              <Card className="p-5 space-y-3" data-testid="card-service-area">
                <h3 className="font-semibold text-white">{t("biz.serviceArea")}</h3>
                <div className="flex items-start gap-2 text-sm">
                  <MapPinned className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <span>{t("biz.serves")} {serviceAreaZoneNames.join(", ")}</span>
                </div>
              </Card>
            ) : business.address ? (
              <Card className="p-5 space-y-3">
                <h3 className="font-semibold text-white">{t("biz.location")}</h3>
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <span>{[business.address, business.city, business.state, business.zip].filter(Boolean).join(", ")}</span>
                </div>
              </Card>
            ) : null
          ) : null}

          {business.isVerified && Object.keys(socialLinks).length > 0 && (
            <Card className="p-5 space-y-2" data-testid="card-social-links">
              <h3 className="font-semibold mb-1 text-white">{t("biz.socialMedia")}</h3>
              {socialLinks.instagram && (
                <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                  <Instagram className="h-4 w-4" /> Instagram
                </a>
              )}
              {socialLinks.facebook && (
                <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                  <Facebook className="h-4 w-4" /> Facebook
                </a>
              )}
              {socialLinks.twitter && (
                <a href={socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                  <Globe className="h-4 w-4" /> X / Twitter
                </a>
              )}
              {socialLinks.linkedin && (
                <a href={socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                  <Globe className="h-4 w-4" /> LinkedIn
                </a>
              )}
              {socialLinks.tiktok && (
                <a href={socialLinks.tiktok} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                  <Globe className="h-4 w-4" /> TikTok
                </a>
              )}
              {socialLinks.yelp && (
                <a href={socialLinks.yelp} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                  <Globe className="h-4 w-4" /> Yelp
                </a>
              )}
            </Card>
          )}

          {languagesSpoken.length > 0 && (
            <Card className="p-5 space-y-2" data-testid="card-languages-spoken">
              <h3 className="font-semibold mb-1 flex items-center gap-2 text-white">
                <Languages className="h-4 w-4 text-muted-foreground" />
                {locale === "es" ? "Idiomas" : "Languages Spoken"}
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {languagesSpoken.map((lang: string) => (
                  <Badge key={lang} variant="secondary" data-testid={`badge-language-${lang}`}>{lang}</Badge>
                ))}
              </div>
            </Card>
          )}

          {acceptedPayments.length > 0 && (
            <Card className="p-5 space-y-2" data-testid="card-accepted-payments">
              <h3 className="font-semibold mb-1 flex items-center gap-2 text-white">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                {locale === "es" ? "Pagos Aceptados" : "Payment Accepted"}
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {acceptedPayments.map((method: string) => {
                  const paymentConfig: Record<string, { icon: any; label: string }> = {
                    cash: { icon: Banknote, label: "Cash" },
                    visa: { icon: SiVisa, label: "Visa" },
                    mastercard: { icon: SiMastercard, label: "Mastercard" },
                    amex: { icon: SiAmericanexpress, label: "Amex" },
                    discover: { icon: CreditCard, label: "Discover" },
                    apple_pay: { icon: SiApplepay, label: "Apple Pay" },
                    google_pay: { icon: SiGooglepay, label: "Google Pay" },
                    venmo: { icon: SiVenmo, label: "Venmo" },
                    zelle: { icon: Wallet, label: "Zelle" },
                    cashapp: { icon: SiCashapp, label: "CashApp" },
                    crypto: { icon: SiBitcoin, label: "Crypto" },
                    check: { icon: FileCheck, label: "Check" },
                  };
                  const config = paymentConfig[method] || { icon: CreditCard, label: method };
                  const IconComp = config.icon;
                  return (
                    <Badge key={method} variant="secondary" data-testid={`badge-payment-${method}`} className="gap-1">
                      <IconComp className="h-3 w-3" />
                      {config.label}
                    </Badge>
                  );
                })}
              </div>
            </Card>
          )}

          {isItexMember && (
            <Card className="p-5 border-green-500/30 bg-green-50/50 dark:bg-green-950/20" data-testid="card-itex-member">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-green-600 text-white shrink-0">
                  <Repeat className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-green-700 dark:text-green-400" data-testid="text-itex-accepted">ITEX Accepted</p>
                  <p className="text-xs text-muted-foreground">{locale === "es" ? "Miembro de la Red de Comercio" : "Trade Network Member"}</p>
                </div>
              </div>
            </Card>
          )}

          {sponsoredEvents && sponsoredEvents.length > 0 && (
            <Card className="p-5 space-y-2" data-testid="card-sponsored-events">
              <h3 className="font-semibold mb-1 flex items-center gap-2 text-white">
                <Award className="h-4 w-4 text-amber-500" />
                Event Sponsor
              </h3>
              <div className="space-y-2">
                {sponsoredEvents.map((evt: any) => (
                  <Link key={evt.id} href={`/${citySlug}/events/${evt.slug}`}>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer" data-testid={`link-sponsored-event-${evt.id}`}>
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{evt.title}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {activeJobs.length > 0 && (
            <Card className="p-5 space-y-3" data-testid="card-active-jobs">
              <h3 className="font-semibold flex items-center gap-2 text-white">
                <Briefcase className="h-4 w-4 text-green-500" />
                Open Positions ({activeJobs.length})
              </h3>
              <div className="space-y-2">
                {activeJobs.map((job) => (
                  <div key={job.id} className="flex items-start gap-2 text-sm" data-testid={`job-listing-${job.id}`}>
                    <Briefcase className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">{job.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {job.type && <span>{job.type.replace(/_/g, " ")}</span>}
                        {job.pay && <span>{job.pay}</span>}
                      </div>
                    </div>
                    {job.url && (
                      <a href={job.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                        <Badge variant="outline" className="text-[10px] cursor-pointer" data-testid={`button-apply-${job.id}`}>Apply</Badge>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="p-5 space-y-2">
              {business.isVerified ? (
                <>
                  <h3 className="font-semibold mb-1 text-white">{t("biz.quickActions")}</h3>
                  {business.phone && (
                    <a
                      href={`tel:${business.phone}`}
                      onClick={() => { trackLeadEvent(citySlug, slug, "CLICK_CALL"); if (business?.id) trackIntelligenceEvent({ citySlug, entityType: "BUSINESS", entityId: business.id, eventType: "CALL_CLICK" }); }}
                      className="block"
                      data-testid="button-action-call"
                    >
                      <Button variant="outline" className="w-full justify-start gap-2">
                        <Phone className="h-4 w-4" />
                        {t("biz.call")}
                      </Button>
                    </a>
                  )}
                  {business.address && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([business.address, business.city, business.state, business.zip].filter(Boolean).join(", "))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => { trackLeadEvent(citySlug, slug, "CLICK_DIRECTIONS"); if (business?.id) trackIntelligenceEvent({ citySlug, entityType: "BUSINESS", entityId: business.id, eventType: "DIRECTIONS_CLICK" }); }}
                      className="block"
                      data-testid="button-action-directions"
                    >
                      <Button variant="outline" className="w-full justify-start gap-2">
                        <Navigation className="h-4 w-4" />
                        {t("biz.getDirections")}
                      </Button>
                    </a>
                  )}
                  {business.websiteUrl && (
                    <a
                      href={business.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => { trackLeadEvent(citySlug, slug, "CLICK_WEBSITE"); if (business?.id) trackIntelligenceEvent({ citySlug, entityType: "BUSINESS", entityId: business.id, eventType: "WEBSITE_CLICK" }); }}
                      className="block"
                      data-testid="button-action-website"
                    >
                      <Button variant="outline" className="w-full justify-start gap-2">
                        <Globe className="h-4 w-4" />
                        {t("biz.visitWebsite")}
                      </Button>
                    </a>
                  )}
                </>
              ) : !isMicrositeView ? (
                <div className="text-center py-2">
                  <p className="text-sm text-white/50 mb-3">Contact information is available after verification</p>
                  <Link href={`/${citySlug}/activate?claim=${business.id}&name=${encodeURIComponent(business.name)}`}>
                    <Button className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white gap-2" data-testid="button-verify-for-contact">
                      <ShieldCheck className="h-4 w-4" />
                      Verify This Listing
                    </Button>
                  </Link>
                </div>
              ) : null}
              {business.reservationUrl && (
                <a
                  href={business.reservationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => { trackLeadEvent(citySlug, slug, "CLICK_BOOKING"); if (business?.id) trackIntelligenceEvent({ citySlug, entityType: "BUSINESS", entityId: business.id, eventType: "BOOKING_CLICK" }); }}
                  className="block"
                  data-testid="button-action-reserve"
                >
                  <Button className="w-full justify-start gap-2 bg-green-600 hover:bg-green-700 text-white">
                    <CalendarCheck className="h-4 w-4" />
                    {t("directory.reserveTable")}
                  </Button>
                </a>
              )}
              {(business as any).menuUrl && (
                <a
                  href={(business as any).menuUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => { trackLeadEvent(citySlug, slug, "CLICK_MENU"); if (business?.id) trackIntelligenceEvent({ citySlug, entityType: "BUSINESS", entityId: business.id, eventType: "MENU_CLICK" }); }}
                  className="block"
                  data-testid="button-action-menu"
                >
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <MenuIcon className="h-4 w-4" />
                    {locale === "es" ? "Ver Menu" : "View Menu"}
                  </Button>
                </a>
              )}
              {(business as any).orderingLinks && Object.keys((business as any).orderingLinks).length > 0 && (
                <>
                  {Object.entries((business as any).orderingLinks as Record<string, string>).map(([platform, url]) => {
                    if (!url) return null;
                    const labels: Record<string, string> = { doordash: "DoorDash", ubereats: "Uber Eats", postmates: "Postmates", grubhub: "Grubhub" };
                    const label = labels[platform] || platform;
                    const affiliatedUrl = wrapAffiliateLink(platform, url, getAffiliateId(affiliateConfigs || [], platform));
                    return (
                      <a
                        key={platform}
                        href={affiliatedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => { trackLeadEvent(citySlug, slug, "CLICK_ORDER"); if (business?.id) trackIntelligenceEvent({ citySlug, entityType: "BUSINESS", entityId: business.id, eventType: "ORDER_CLICK", metadata: { platform } }); }}
                        className="block"
                        data-testid={`button-action-order-${platform}`}
                      >
                        <Button variant="outline" className="w-full justify-start gap-2">
                          <UtensilsCrossed className="h-4 w-4" />
                          {locale === "es" ? `Pedir en ${label}` : `Order on ${label}`}
                        </Button>
                      </a>
                    );
                  })}
                </>
              )}
              {business.latitude && business.longitude && (() => {
                const bizCatSlugs = categories?.filter(c => business.categoryIds.includes(c.id)).map(c => c.slug) || [];
                const isRideWorthy = bizCatSlugs.some(s => RIDE_WORTHY_SLUGS.includes(s)) || !!business.reservationUrl;
                if (!isRideWorthy) return null;
                return (
                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
                      <Car className="h-3 w-3" /> {locale === "es" ? "Pide un viaje" : "Get a Ride"}
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={buildUberRideLink(Number(business.latitude), Number(business.longitude), business.name, getAffiliateId(affiliateConfigs || [], "uber"))}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => { trackLeadEvent(citySlug, slug, "CLICK_RIDE"); if (business?.id) trackIntelligenceEvent({ citySlug, entityType: "BUSINESS", entityId: business.id, eventType: "RIDE_CLICK", metadata: { platform: "uber" } }); }}
                        className="flex-1"
                        data-testid="button-ride-uber"
                      >
                        <Button variant="outline" size="sm" className="w-full text-xs">Uber</Button>
                      </a>
                      <a
                        href={buildLyftRideLink(Number(business.latitude), Number(business.longitude), getAffiliateId(affiliateConfigs || [], "lyft"))}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => { trackLeadEvent(citySlug, slug, "CLICK_RIDE"); if (business?.id) trackIntelligenceEvent({ citySlug, entityType: "BUSINESS", entityId: business.id, eventType: "RIDE_CLICK", metadata: { platform: "lyft" } }); }}
                        className="flex-1"
                        data-testid="button-ride-lyft"
                      >
                        <Button variant="outline" size="sm" className="w-full text-xs">Lyft</Button>
                      </a>
                    </div>
                  </div>
                );
              })()}
          </Card>

          <SidebarAd citySlug={citySlug} page="business-detail" />
        </div>}
      </div>

      {shoppingCenterData && shoppingCenterData.businesses && shoppingCenterData.businesses.length > 1 && (
        <section className="space-y-3" data-testid="section-shopping-center-tenants">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              More at {shoppingCenterData.name}
            </h2>
            <Link href={`/${citySlug}/shopping-centers/${shoppingCenterData.slug}`}>
              <Button variant="ghost" size="sm" className="gap-1 text-sm text-white/70 hover:text-white" data-testid="link-view-all-tenants">
                View All <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shoppingCenterData.businesses
              .filter((b) => b.id !== business?.id)
              .slice(0, 6)
              .map((biz) => (
              <Link key={biz.id} href={getBusinessUrl(citySlug, biz.slug, biz.categoryIds, categories)}>
                <Card className="p-3 hover:shadow-md transition-shadow cursor-pointer" data-testid={`card-tenant-${biz.id}`}>
                  <div className="flex items-center gap-3">
                    {(() => {
                      const thumb = getSmallFallbackImage(biz.imageUrl, categories?.filter(c => biz.categoryIds.includes(c.id)).map(c => c.slug) || []);
                      return (
                        <img src={thumb || mainLogo} alt={biz.name} className="w-12 h-12 rounded object-cover shrink-0" onError={(e) => { const el = e.target as HTMLImageElement; el.onerror = null; el.src = mainLogo; }} />
                      );
                    })()}
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{biz.name}</p>
                      {biz.googleRating && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          {biz.googleRating}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      <BusinessEventsSection businessId={business.id} citySlug={citySlug} />

      {topicTags.length > 0 && (
        <section className="space-y-2" data-testid="section-topic-tags">
          <h2 className="text-sm font-medium text-white/60">Known for</h2>
          <div className="flex flex-wrap gap-1.5">
            {topicTags.map((tag) => (
              <Badge key={tag} variant="outline" className="border-white/20 text-white/80 text-xs" data-testid={`badge-topic-${tag}`}>{tag}</Badge>
            ))}
          </div>
        </section>
      )}

      {relatedBusinesses.length > 0 && (
        <section className="space-y-3" data-testid="section-related-businesses">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              {primaryCategory ? t("biz.moreIn", { category: primaryCategory.name }) : "Related Businesses"}
            </h2>
            {effectiveCategorySlug && (
              <Link href={`/${citySlug}/${effectiveCategorySlug}`}>
                <Button variant="ghost" size="sm" className="gap-1 text-sm text-white/70 hover:text-white" data-testid="link-view-all-category">
                  {t("biz.viewAll")} <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {relatedBusinesses.map((biz) => (
              <Link key={biz.id} href={getBusinessUrl(citySlug, biz.slug, biz.categoryIds, categories)}>
                <Card className="p-3 hover:shadow-md transition-shadow cursor-pointer" data-testid={`card-related-${biz.id}`}>
                  <div className="flex items-center gap-3">
                    {(() => {
                      const thumb = getSmallFallbackImage(biz.imageUrl, categories?.filter(c => biz.categoryIds.includes(c.id)).map(c => c.slug) || []);
                      return (
                        <img src={thumb || mainLogo} alt={biz.name} className="w-12 h-12 rounded object-cover shrink-0" onError={(e) => { const el = e.target as HTMLImageElement; el.onerror = null; el.src = mainLogo; }} />
                      );
                    })()}
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{biz.name}</p>
                      {biz.address && (
                        <p className="text-xs text-muted-foreground truncate">{biz.address}</p>
                      )}
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
      <NeighborhoodContext
        citySlug={citySlug}
        lat={(business as Record<string, unknown>).latitude}
        lng={(business as Record<string, unknown>).longitude}
        sourceType="business"
      />
      {business.claimStatus === "UNCLAIMED" && !isMicrositeView && (
        <Card className="p-6" data-testid="card-claim-listing-cta">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-purple-500/10 shrink-0">
              <ShieldCheck className="h-5 w-5 text-purple-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base text-white" data-testid="text-claim-heading">Is this your business?</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Verify ownership for $1 and take control of your listing — update info, add photos, respond to reviews, and unlock premium features.
              </p>
            </div>
            <Link href={`/${citySlug}/activate?claim=${business.id}&name=${encodeURIComponent(business.name)}`}>
              <Button data-testid="button-claim-listing" className="shrink-0 gap-2">
                <ShieldCheck className="h-4 w-4" />
                Claim This Listing
              </Button>
            </Link>
          </div>
        </Card>
      )}
      <AuthDialog
        open={showAuthDialog}
        onOpenChange={setShowAuthDialog}
        defaultTab="register"
      />
    </div>
    </DarkPageShell>
  );
}

function BusinessEventsSection({ businessId, citySlug }: { businessId: string; citySlug: string }) {
  const { data: events } = useQuery<any[]>({
    queryKey: ["/api/businesses", businessId, "events"],
    queryFn: async () => {
      const resp = await fetch(`/api/businesses/${businessId}/events`);
      if (!resp.ok) return [];
      return resp.json();
    },
  });

  if (!events || events.length === 0) return null;

  return (
    <section className="space-y-3" data-testid="section-business-events">
      <h2 className="text-lg font-semibold text-white flex items-center gap-2">
        <Calendar className="h-5 w-5 text-purple-400" /> Upcoming Events
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {events.map((evt: any) => (
          <Link key={evt.id} href={`/${citySlug}/events/${evt.slug}`}>
            <Card className="p-4 bg-white/5 border-white/10 space-y-2 cursor-pointer hover:bg-white/10 transition-colors" data-testid={`card-biz-event-${evt.id}`}>
              <h3 className="text-sm font-medium text-white line-clamp-2">{evt.title}</h3>
              {evt.start_date_time && (
                <p className="text-xs text-white/50 flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  {new Date(evt.start_date_time).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                </p>
              )}
              {evt.location_name && (
                <p className="text-xs text-white/40 flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {evt.location_name}
                </p>
              )}
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
