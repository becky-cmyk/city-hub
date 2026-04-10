import { useState, useEffect, lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { BizImage } from "@/components/biz-image";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Home,
  MapPin,
  Phone,
  Search,
  ArrowRight,
  Star,
  SlidersHorizontal,
  ChevronDown,
  Dog,
  Car,
  Key,
  Users,
  Briefcase,
  DollarSign,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { usePageMeta } from "@/hooks/use-page-meta";
import { DarkPageShell } from "@/components/dark-page-shell";

const NeighborhoodMapLazy = lazy(() =>
  import("@/components/neighborhood-map").then(mod => ({ default: mod.NeighborhoodMap }))
);

interface HousingBusiness {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  imageUrl: string | null;
  tagline: string | null;
  listingTier: string | null;
  zip: string | null;
  zoneName: string | null;
  zoneSlug: string | null;
  googleRating: number | null;
  mlsEmbedUrl: string | null;
  priceRange: number | null;
  categorySlug: string | null;
}

interface HousingMarketplaceListing {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  imageUrl: string | null;
  contactName: string | null;
  contactPhone: string | null;
  externalUrl: string | null;
  subtype: string | null;
  postedByBusinessId: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  petFriendly: boolean | null;
  availableDate: string | null;
  linkedBusiness: HousingBusiness | null;
}

interface HousingHub {
  name: string;
  slug: string;
  code: string;
  centerLat: string | null;
  centerLng: string | null;
  description: string | null;
  lifestyleTags: string[];
  housingCount: number;
}

interface HousingData {
  apartments: HousingBusiness[];
  realEstate: HousingBusiness[];
  propertyManagement: HousingBusiness[];
  marketplaceListings: HousingMarketplaceListing[];
  currentHub: HousingHub | null;
  neighboringHubs: HousingHub[];
  totalCount: number;
}

const AMENITY_FILTERS = [
  { key: "pet-friendly", label: "Pet Friendly", icon: Dog },
  { key: "parking", label: "Parking", icon: Car },
  { key: "furnished", label: "Furnished", icon: Home },
] as const;

function HousingCard({ biz, citySlug }: { biz: HousingBusiness; citySlug: string }) {
  return (
    <Link href={`/${citySlug}/directory/${biz.slug}`} data-testid={`housing-card-${biz.id}`}>
      <Card className="h-full cursor-pointer transition-shadow hover:shadow-lg bg-white/5 border-white/10 overflow-hidden">
        <div className="aspect-[16/9] overflow-hidden bg-muted">
          <BizImage src={biz.imageUrl} alt={biz.name} className="w-full h-full object-cover" />
        </div>
        <div className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-sm text-white line-clamp-1" data-testid={`text-housing-name-${biz.id}`}>{biz.name}</h3>
            {biz.listingTier && biz.listingTier !== "FREE" && (
              <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 shrink-0">{biz.listingTier}</Badge>
            )}
          </div>
          {biz.tagline && <p className="text-xs text-white/50 line-clamp-2">{biz.tagline}</p>}
          <div className="space-y-1">
            {biz.zoneName && (
              <div className="flex items-center gap-1.5 text-xs text-white/40">
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate">{biz.zoneName}</span>
              </div>
            )}
            {biz.phone && (
              <div className="flex items-center gap-1.5 text-xs text-white/40">
                <Phone className="w-3 h-3 shrink-0" />
                <span>{biz.phone}</span>
              </div>
            )}
            {biz.googleRating != null && (
              <div className="flex items-center gap-1.5 text-xs text-amber-400/70">
                <Star className="w-3 h-3 shrink-0 fill-current" />
                <span>{Number(biz.googleRating).toFixed(1)}</span>
              </div>
            )}
            {biz.priceRange != null && biz.priceRange > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400/70" data-testid={`text-price-range-${biz.id}`}>
                <DollarSign className="w-3 h-3 shrink-0" />
                <span>{"$".repeat(biz.priceRange)}</span>
              </div>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}

function MarketplaceListingCard({ listing, citySlug }: { listing: HousingMarketplaceListing; citySlug: string }) {
  const linked = listing.linkedBusiness;
  return (
    <Card className="h-full bg-emerald-900/20 border-emerald-500/20 overflow-hidden" data-testid={`marketplace-housing-${listing.id}`}>
      <Link href={`/${citySlug}/marketplace/${listing.id}`}>
        <div className="cursor-pointer transition-shadow hover:shadow-lg">
          {listing.imageUrl && (
            <div className="aspect-[16/9] overflow-hidden relative">
              <img src={listing.imageUrl} alt={listing.title} className="w-full h-full object-cover" loading="lazy" />
              <Badge className="absolute top-2 right-2 bg-emerald-500 text-black text-[10px] font-bold">AVAILABLE</Badge>
            </div>
          )}
          <div className="p-4 space-y-2">
            <h3 className="font-semibold text-sm text-white line-clamp-1">{listing.title}</h3>
            {listing.description && <p className="text-xs text-white/50 line-clamp-2">{listing.description}</p>}
            <div className="flex items-center gap-3 text-xs">
              {listing.price && (
                <span className="text-emerald-400 font-semibold">${listing.price.toLocaleString()}/mo</span>
              )}
              {listing.bedrooms && <span className="text-white/40">{listing.bedrooms} bed</span>}
              {listing.bathrooms && <span className="text-white/40">{listing.bathrooms} bath</span>}
              {listing.sqft && <span className="text-white/40">{listing.sqft.toLocaleString()} sqft</span>}
            </div>
            {listing.petFriendly && (
              <div className="flex items-center gap-1 text-xs text-emerald-400/70">
                <Dog className="w-3 h-3" />
                <span>Pet Friendly</span>
              </div>
            )}
          </div>
        </div>
      </Link>
      {linked && (
        <Link href={`/${citySlug}/directory/${linked.slug}`}>
          <div className="px-4 pb-3 pt-1 border-t border-emerald-500/10 cursor-pointer" data-testid={`linked-biz-${linked.id}`}>
            <div className="flex items-center gap-2 text-xs text-white/50">
              <Building2 className="w-3 h-3 text-emerald-400/60 shrink-0" />
              <span className="truncate">Listed by {linked.name}</span>
              {linked.zoneName && <span className="text-white/30 shrink-0">{linked.zoneName}</span>}
            </div>
          </div>
        </Link>
      )}
    </Card>
  );
}

function HousingSection({
  title,
  icon: Icon,
  businesses,
  marketplaceListings,
  citySlug,
}: {
  title: string;
  icon: typeof Building2;
  businesses: HousingBusiness[];
  marketplaceListings: HousingMarketplaceListing[];
  citySlug: string;
}) {
  if (businesses.length === 0 && marketplaceListings.length === 0) return null;

  return (
    <section className="mb-10" data-testid={`section-${title.replace(/\s+/g, "-").toLowerCase()}`}>
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-5 h-5 text-emerald-400" />
        <h2 className="text-xl font-bold text-white">{title}</h2>
        <Badge variant="outline" className="text-xs border-white/20 text-white/50 ml-auto">
          {businesses.length + marketplaceListings.length}
        </Badge>
      </div>

      {marketplaceListings.length > 0 && (
        <div className="mb-6">
          <p className="text-xs text-emerald-400/70 uppercase tracking-wider font-medium mb-3">Current Availability</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {marketplaceListings.map(listing => (
              <MarketplaceListingCard key={listing.id} listing={listing} citySlug={citySlug} />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {businesses.map(biz => (
          <HousingCard key={biz.id} biz={biz} citySlug={citySlug} />
        ))}
      </div>
    </section>
  );
}

export default function HousingPage({ citySlug }: { citySlug: string }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [activeAmenities, setActiveAmenities] = useState<Set<string>>(new Set());
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [selectedHubSlug, setSelectedHubSlug] = useState("");
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoCenteringEnabled, setGeoCenteringEnabled] = useState(true);

  useEffect(() => {
    if (geoCenteringEnabled && !selectedHubSlug && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { timeout: 5000, maximumAge: 300000 }
      );
    }
  }, [geoCenteringEnabled, selectedHubSlug]);

  usePageMeta({
    title: "Housing & Real Estate Directory - Charlotte Metro | CLT Metro Hub",
    description: "Find apartments, real estate agents, and property management companies across the Charlotte metro. Browse by neighborhood with local context you won't find on apartments.com.",
    canonical: `${window.location.origin}/${citySlug}/relocation/housing`,
  });

  const queryParams = new URLSearchParams();
  if (searchTerm) queryParams.set("q", searchTerm);
  if (priceMin) queryParams.set("priceMin", priceMin);
  if (priceMax) queryParams.set("priceMax", priceMax);
  if (activeAmenities.size > 0) queryParams.set("amenities", Array.from(activeAmenities).join(","));
  if (selectedHubSlug) queryParams.set("hub", selectedHubSlug);
  if (!selectedHubSlug && geoCenteringEnabled && userCoords) {
    queryParams.set("lat", userCoords.lat.toFixed(6));
    queryParams.set("lng", userCoords.lng.toFixed(6));
  }

  const { data, isLoading } = useQuery<HousingData>({
    queryKey: ["/api/cities", citySlug, "relocation/housing", queryParams.toString()],
    queryFn: async () => {
      const qs = queryParams.toString();
      const url = `/api/cities/${citySlug}/relocation/housing${qs ? `?${qs}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch housing data");
      return res.json();
    },
  });

  const toggleAmenity = (key: string) => {
    setActiveAmenities(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const allHubs = data?.neighboringHubs || [];
  const currentHub = data?.currentHub;

  const mapHubs = [
    ...(currentHub ? [currentHub] : []),
    ...allHubs,
  ].filter(h => h.centerLat && h.centerLng).map(h => ({
    name: h.name,
    code: h.code,
    slug: h.slug,
    centerLat: h.centerLat,
    centerLng: h.centerLng,
    description: `${h.housingCount} housing listing${h.housingCount !== 1 ? "s" : ""}`,
    lifestyleTags: h.lifestyleTags || [],
  }));

  const apartmentMpListings = (data?.marketplaceListings || []).filter(l =>
    l.subtype === "APARTMENT_COMMUNITY" || l.subtype === "APARTMENT_UNIT"
  );
  const reListings = (data?.marketplaceListings || []).filter(l =>
    l.subtype === "HOUSE_FOR_SALE_FSBO" || l.subtype === "HOUSE_FOR_RENT" || !l.subtype
  );

  return (
    <DarkPageShell maxWidth="wide" className="housing-page">
      <div data-testid="housing-page">
        <section className="mb-10" data-testid="section-hero">
          <div className="rounded-xl bg-gradient-to-br from-emerald-900 via-teal-900 to-cyan-900 p-8 md:p-12">
            <div className="flex items-center gap-3 mb-4">
              <Home className="w-8 h-8 text-emerald-400" />
              <h1 className="text-3xl md:text-4xl font-bold text-white" data-testid="text-housing-title">
                Housing & Real Estate
              </h1>
            </div>
            <p className="text-lg text-white/70 max-w-2xl" data-testid="text-housing-tagline">
              Apartment communities, real estate agents, and property managers across the Charlotte metro.
              Every listing lives in a named neighborhood with local context.
            </p>
            {data && (
              <div className="flex items-center gap-4 mt-6 text-sm text-white/50">
                <span className="flex items-center gap-1"><Building2 className="w-4 h-4" /> {data.totalCount} listings</span>
                <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {allHubs.length + (currentHub ? 1 : 0)} neighborhoods</span>
              </div>
            )}
          </div>
        </section>

        <section className="mb-8">
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <Input
                placeholder="Search apartments, realtors, property managers..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 h-10 bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm"
                data-testid="input-housing-search"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-white/10 text-white/60 gap-1 text-xs h-10"
              onClick={() => setShowFilters(!showFilters)}
              data-testid="button-toggle-housing-filters"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filters
              <ChevronDown className={`w-3 h-3 transition-transform ${showFilters ? "rotate-180" : ""}`} />
            </Button>
          </div>

          {showFilters && (
            <div className="space-y-4 p-4 rounded-xl bg-white/5 border border-white/10 mb-4" data-testid="housing-filters-panel">
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider mb-2 block">Amenities</label>
                <div className="flex flex-wrap gap-2">
                  {AMENITY_FILTERS.map(filter => {
                    const isActive = activeAmenities.has(filter.key);
                    const FilterIcon = filter.icon;
                    return (
                      <button
                        key={filter.key}
                        onClick={() => toggleAmenity(filter.key)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                          isActive
                            ? "bg-emerald-500 text-black border-emerald-500"
                            : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10"
                        }`}
                        data-testid={`amenity-${filter.key}`}
                      >
                        <FilterIcon className="w-3 h-3" />
                        {filter.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 max-w-sm">
                <div>
                  <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Min Price</label>
                  <Input
                    type="number"
                    placeholder="$0"
                    value={priceMin}
                    onChange={e => setPriceMin(e.target.value)}
                    className="h-8 text-xs bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    data-testid="input-price-min"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Max Price</label>
                  <Input
                    type="number"
                    placeholder="Any"
                    value={priceMax}
                    onChange={e => setPriceMax(e.target.value)}
                    className="h-8 text-xs bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    data-testid="input-price-max"
                  />
                </div>
              </div>
            </div>
          )}
        </section>

        {currentHub && (
          <section className="mb-6" data-testid="section-current-hub">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-900/30 border border-emerald-500/20">
              <MapPin className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-white">{currentHub.name}</span>
                <span className="text-xs text-white/40 ml-2">{currentHub.housingCount} listing{currentHub.housingCount !== 1 ? "s" : ""}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-white/20 text-white/60 text-xs shrink-0"
                onClick={() => { setSelectedHubSlug(""); setGeoCenteringEnabled(false); }}
                data-testid="button-clear-hub-filter"
              >
                Show All Neighborhoods
              </Button>
            </div>
          </section>
        )}

        <div className="flex flex-col lg:flex-row gap-6" data-testid="housing-split-layout">
          <div className="flex-1 min-w-0">
            {isLoading ? (
              <div className="space-y-8">
                {[1, 2, 3].map(i => (
                  <div key={i}>
                    <Skeleton className="h-8 w-48 bg-white/10 mb-4" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                      {[1, 2, 3, 4].map(j => (
                        <Skeleton key={j} className="h-48 bg-white/10 rounded-lg" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <HousingSection
                  title="Apartment Communities"
                  icon={Building2}
                  businesses={data?.apartments || []}
                  marketplaceListings={apartmentMpListings}
                  citySlug={citySlug}
                />

                <HousingSection
                  title="Real Estate & Realtors"
                  icon={Key}
                  businesses={data?.realEstate || []}
                  marketplaceListings={reListings}
                  citySlug={citySlug}
                />

                <HousingSection
                  title="Property Management"
                  icon={Briefcase}
                  businesses={data?.propertyManagement || []}
                  marketplaceListings={[]}
                  citySlug={citySlug}
                />

                {(!data || (data.apartments.length === 0 && data.realEstate.length === 0 && data.propertyManagement.length === 0)) && (
                  <div className="rounded-xl bg-white/5 border border-white/10 p-12 text-center" data-testid="housing-empty">
                    <Home className="w-10 h-10 mx-auto mb-4 text-white/20" />
                    <h3 className="font-semibold text-lg text-white mb-2">Housing Directory Coming Soon</h3>
                    <p className="text-sm text-white/50 max-w-md mx-auto">
                      We're building Charlotte's most comprehensive housing directory.
                      Apartment communities, realtors, and property managers will be listed here.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          <aside className="w-full lg:w-[400px] shrink-0" data-testid="section-housing-map">
            <div className="lg:sticky lg:top-4">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-bold text-white">Neighborhoods</h2>
              </div>
              {isLoading ? (
                <Skeleton className="h-[350px] w-full rounded-xl bg-gray-800" />
              ) : mapHubs.length > 0 ? (
                <Suspense fallback={<Skeleton className="h-[350px] w-full rounded-xl bg-gray-800" />}>
                  <NeighborhoodMapLazy hubs={mapHubs} citySlug={citySlug} />
                </Suspense>
              ) : (
                <div className="h-[200px] rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/30 text-sm">
                  No neighborhood data available
                </div>
              )}
            </div>
          </aside>
        </div>

        {data && data.neighboringHubs.length > 0 && (
          <section className="mt-12 mb-8" data-testid="section-more-to-explore">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" />
                {currentHub ? "Other Neighborhoods" : "Explore by Neighborhood"}
              </h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {data.neighboringHubs.map(hub => (
                <button
                  key={hub.code}
                  onClick={() => setSelectedHubSlug(hub.slug)}
                  data-testid={`explore-hub-${hub.code}`}
                  className="text-left"
                >
                  <Card className={`p-4 cursor-pointer transition-colors border ${
                    selectedHubSlug === hub.slug
                      ? "bg-emerald-500/10 border-emerald-500/50"
                      : "bg-white/5 border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/5"
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="font-medium text-sm text-white truncate">{hub.name}</span>
                    </div>
                    {hub.housingCount > 0 && (
                      <p className="text-xs text-white/40 mt-1">{hub.housingCount} listing{hub.housingCount !== 1 ? "s" : ""}</p>
                    )}
                    {hub.description && (
                      <p className="text-xs text-white/30 mt-1 line-clamp-1">{hub.description}</p>
                    )}
                  </Card>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="mt-12 mb-8 rounded-xl bg-white/5 border border-white/10 p-6" data-testid="section-cta-claim">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="font-semibold text-lg text-white mb-1">Own an apartment community or real estate office?</h3>
              <p className="text-sm text-white/50">Claim your free listing, then upgrade to showcase availability and attract renters directly.</p>
            </div>
            <Link href={`/${citySlug}/submit/business`}>
              <Button className="bg-emerald-500 text-black font-bold gap-1.5" data-testid="button-claim-housing">
                <ArrowRight className="w-4 h-4" /> Claim Your Listing
              </Button>
            </Link>
          </div>
        </section>
      </div>
    </DarkPageShell>
  );
}
