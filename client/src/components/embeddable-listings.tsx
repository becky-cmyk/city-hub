import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Home, Tag, Wrench, Briefcase, Heart, Building2, Search,
  MapPin, Image as ImageIcon
} from "lucide-react";
import type { MarketplaceListing } from "@shared/schema";

const TYPE_BADGE: Record<string, { label: string; icon: typeof Home; className: string }> = {
  SERVICE: { label: "Service", icon: Wrench, className: "bg-purple-600" },
  FOR_SALE: { label: "For Sale", icon: Tag, className: "bg-emerald-600" },
  HOUSING: { label: "Housing", icon: Home, className: "bg-blue-600" },
  HOUSING_SUPPLY: { label: "For Rent/Sale", icon: Home, className: "bg-teal-600" },
  HOUSING_DEMAND: { label: "Housing Wanted", icon: Search, className: "bg-cyan-600" },
  COMMERCIAL_PROPERTY: { label: "Commercial", icon: Building2, className: "bg-indigo-600" },
  JOB: { label: "Job", icon: Briefcase, className: "bg-sky-600" },
  COMMUNITY: { label: "Community", icon: Heart, className: "bg-rose-600" },
  WANTED: { label: "Wanted", icon: Tag, className: "bg-orange-600" },
};

interface EmbeddableListingsProps {
  citySlug: string;
  hubPresenceId?: string;
  postedByBusinessId?: string;
  hubId?: string;
  type?: string;
  subtype?: string;
  cityId?: string;
  featured?: boolean;
  limit?: number;
  title?: string;
  emptyMessage?: string;
  columns?: 2 | 3 | 4;
}

export function EmbeddableListings({
  citySlug,
  hubPresenceId,
  postedByBusinessId,
  hubId,
  type,
  subtype,
  cityId,
  featured,
  limit = 8,
  title = "Listings",
  emptyMessage = "No listings available",
  columns = 3,
}: EmbeddableListingsProps) {
  const params = new URLSearchParams();
  if (hubPresenceId) params.set("hubPresenceId", hubPresenceId);
  if (postedByBusinessId) params.set("postedByBusinessId", postedByBusinessId);
  if (hubId) params.set("hubId", hubId);
  if (type) params.set("type", type);
  if (subtype) params.set("subtype", subtype);
  if (cityId) params.set("cityId", cityId);
  if (featured) params.set("featured", "true");
  params.set("limit", String(limit));

  const { data: listings, isLoading } = useQuery<MarketplaceListing[]>({
    queryKey: ["/api/marketplace/embed", params.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/marketplace/embed?${params.toString()}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3" data-testid="embed-listings-loading">
        {title && <h3 className="text-lg font-bold text-white">{title}</h3>}
        <div className={`grid gap-3 ${columns === 4 ? "grid-cols-2 sm:grid-cols-4" : columns === 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}`}>
          {Array.from({ length: Math.min(limit, 4) }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full bg-white/10 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!listings?.length) {
    return (
      <div data-testid="embed-listings-empty">
        {title && <h3 className="text-lg font-bold text-white mb-2">{title}</h3>}
        <p className="text-sm text-white/40">{emptyMessage}</p>
      </div>
    );
  }

  const colClass = columns === 4
    ? "grid-cols-2 sm:grid-cols-4"
    : columns === 3
    ? "grid-cols-2 sm:grid-cols-3"
    : "grid-cols-1 sm:grid-cols-2";

  return (
    <div data-testid="embed-listings">
      {title && <h3 className="text-lg font-bold text-white mb-3">{title}</h3>}
      <div className={`grid gap-3 ${colClass}`}>
        {listings.map((listing) => {
          const typeInfo = TYPE_BADGE[listing.type] || TYPE_BADGE.FOR_SALE;
          const TypeIcon = typeInfo.icon;
          const imageUrl = listing.imageUrl || listing.galleryImages?.[0];
          return (
            <Link key={listing.id} href={`/${citySlug}/marketplace/${listing.id}`}>
              <div
                className="group rounded-xl overflow-hidden border border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer transition-all"
                data-testid={`embed-listing-${listing.id}`}
              >
                <div className="relative aspect-[4/3] bg-white/5 overflow-hidden">
                  {imageUrl ? (
                    <img src={imageUrl} alt={listing.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <TypeIcon className="h-10 w-10 text-white/10" />
                    </div>
                  )}
                  {listing.price != null && (
                    <div className="absolute bottom-2 left-2 bg-black/80 backdrop-blur-sm text-white text-xs font-bold px-2 py-1 rounded-lg">
                      ${listing.price.toLocaleString()}
                      {listing.pricingType === "HOURLY" && "/hr"}
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <Badge className={`text-[8px] border-0 text-white ${typeInfo.className} mb-1`}>
                    <TypeIcon className="h-2 w-2 mr-0.5" />{typeInfo.label}
                  </Badge>
                  <h4 className="text-sm font-bold text-white line-clamp-2">{listing.title}</h4>
                  {listing.neighborhood && (
                    <p className="text-[10px] text-white/40 mt-1 flex items-center gap-0.5">
                      <MapPin className="h-2.5 w-2.5" />{listing.neighborhood}
                    </p>
                  )}
                  {(listing.bedrooms != null || listing.squareFeet != null) && (
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-white/40">
                      {listing.bedrooms != null && <span>{listing.bedrooms} bed</span>}
                      {listing.bathrooms != null && <span>{listing.bathrooms} bath</span>}
                      {listing.squareFeet != null && <span>{listing.squareFeet.toLocaleString()} sqft</span>}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
