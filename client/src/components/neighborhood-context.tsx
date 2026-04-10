import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Store, Calendar, Newspaper, ShoppingBag, MapPin, Landmark, Briefcase } from "lucide-react";
import type { VerticalType, NearbyResponse, NearbyGroup, NearbyItem } from "@shared/neighborhood-context";

const ICON_MAP: Record<string, typeof Store> = {
  Store,
  Calendar,
  Newspaper,
  ShoppingBag,
  Landmark,
  Briefcase,
};

const TYPE_COLORS: Record<VerticalType, string> = {
  business: "border-emerald-500/30 text-emerald-400",
  event: "border-purple-500/30 text-purple-400",
  article: "border-blue-500/30 text-blue-400",
  marketplace: "border-amber-500/30 text-amber-400",
  attraction: "border-teal-500/30 text-teal-400",
  job: "border-sky-500/30 text-sky-400",
};

function formatDistance(miles: number): string {
  if (miles < 0.1) return "< 0.1 mi";
  return `${miles.toFixed(1)} mi`;
}

function NearbyItemCard({ item, citySlug }: { item: NearbyItem; citySlug: string }) {
  const colorClass = TYPE_COLORS[item.type] || "border-white/20 text-white/60";

  return (
    <Link href={item.detailUrl}>
      <div
        className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors hover:bg-white/5"
        data-testid={`nearby-item-${item.type}-${item.slug}`}
      >
        <div className="h-10 w-10 rounded-md bg-white/5 overflow-hidden flex items-center justify-center shrink-0">
          {item.imageUrl ? (
            <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <MapPin className="h-4 w-4 text-white/20" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{item.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${colorClass}`}>
              {item.type === "marketplace" ? "Listing" : item.type.charAt(0).toUpperCase() + item.type.slice(1)}
            </Badge>
            <span className="text-[11px] text-white/30">{formatDistance(item.distanceMiles)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function NearbyGroupSection({ group, citySlug }: { group: NearbyGroup; citySlug: string }) {
  const Icon = ICON_MAP[group.icon] || MapPin;

  return (
    <div data-testid={`nearby-group-${group.type}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-3.5 w-3.5 text-white/40" />
        <span className="text-xs font-medium text-white/50 uppercase tracking-wider">
          {group.pluralLabel}
        </span>
        <span className="text-[10px] text-white/20">{group.items.length}</span>
      </div>
      <div className="space-y-0.5">
        {group.items.map((item) => (
          <NearbyItemCard key={`${item.type}-${item.id}`} item={item} citySlug={citySlug} />
        ))}
      </div>
    </div>
  );
}

function NeighborhoodContextSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-5 w-36 bg-white/10" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-md bg-white/10" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-32 bg-white/10" />
            <Skeleton className="h-3 w-20 bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

const SCHEMA_TYPE_MAP: Record<VerticalType, string> = {
  business: "LocalBusiness",
  event: "Event",
  article: "Article",
  marketplace: "Product",
  attraction: "TouristAttraction",
  job: "JobPosting",
};

export function buildNearbyJsonLd(data: NearbyResponse | undefined): Record<string, unknown>[] {
  if (!data || data.groups.length === 0) return [];
  const items: Record<string, unknown>[] = [];
  for (const group of data.groups) {
    for (const item of group.items) {
      items.push({
        "@type": SCHEMA_TYPE_MAP[item.type] || "Thing",
        name: item.name,
        url: `${window.location.origin}${item.detailUrl}`,
        ...(item.imageUrl && { image: item.imageUrl }),
      });
    }
  }
  return items;
}

export function useNearbyData(citySlug: string, lat: number | string | null | undefined, lng: number | string | null | undefined, sourceType: VerticalType, radius?: number) {
  const parsedLat = typeof lat === "string" ? parseFloat(lat) : lat;
  const parsedLng = typeof lng === "string" ? parseFloat(lng) : lng;
  const hasCoords = Number.isFinite(parsedLat) && Number.isFinite(parsedLng);

  const params = new URLSearchParams();
  if (hasCoords) {
    params.set("lat", String(parsedLat));
    params.set("lng", String(parsedLng));
    params.set("sourceType", sourceType);
    if (radius) params.set("radius", String(radius));
  }

  return useQuery<NearbyResponse>({
    queryKey: ["/api/cities", citySlug, "nearby", params.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/cities/${citySlug}/nearby?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch nearby content");
      return res.json();
    },
    enabled: hasCoords,
    staleTime: 5 * 60 * 1000,
  });
}

interface NeighborhoodContextProps {
  citySlug: string;
  lat: number | string | null | undefined;
  lng: number | string | null | undefined;
  sourceType: VerticalType;
  radius?: number;
}

export function NeighborhoodContext({ citySlug, lat, lng, sourceType, radius }: NeighborhoodContextProps) {
  const parsedLat = typeof lat === "string" ? parseFloat(lat) : lat;
  const parsedLng = typeof lng === "string" ? parseFloat(lng) : lng;
  const hasCoords = Number.isFinite(parsedLat) && Number.isFinite(parsedLng);

  const { data, isLoading } = useNearbyData(citySlug, lat, lng, sourceType, radius);

  if (!hasCoords) return null;
  if (isLoading) return (
    <Card className="p-4 bg-white/5 border-white/10" data-testid="neighborhood-context-loading">
      <NeighborhoodContextSkeleton />
    </Card>
  );
  if (!data || data.groups.length === 0) return null;

  const totalItems = data.groups.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <Card className="p-4 bg-white/5 border-white/10" data-testid="neighborhood-context">
      <div className="flex items-center gap-2 mb-4">
        <MapPin className="h-4 w-4 text-white/40" />
        <h3 className="text-sm font-semibold text-white">Nearby in This Area</h3>
        <Badge variant="outline" className="text-[10px] border-white/15 text-white/30 ml-auto">
          {totalItems}
        </Badge>
      </div>
      <div className="space-y-4">
        {data.groups.map((group) => (
          <NearbyGroupSection key={group.type} group={group} citySlug={citySlug} />
        ))}
      </div>
    </Card>
  );
}
