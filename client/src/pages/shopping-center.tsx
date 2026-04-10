import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useSmartBack } from "@/hooks/use-smart-back";
import { useRegisterAdminEdit } from "@/hooks/use-admin-edit";
import { BizImage } from "@/components/biz-image";
import { Link } from "wouter";
import {
  MapPin,
  ArrowLeft,
  Building2,
  Store,
  Star,
  CheckCircle,
} from "lucide-react";
import type { Business } from "@shared/schema";
import { TransitBadgeFromId } from "@/components/transit-badge";

const CENTER_TYPE_LABELS: Record<string, string> = {
  SHOPPING_CENTER: "Shopping Center",
  BUSINESS_CENTER: "Business Center",
  TECH_PARK: "Tech Park",
  OFFICE_COMPLEX: "Office Complex",
  MIXED_USE: "Mixed-Use Development",
  PLAZA: "Plaza",
  MALL: "Mall",
  OTHER: "Commercial Center",
};

interface ShoppingCenterData {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  centerType?: string;
  alsoKnownAs?: string | null;
  residentialName?: string | null;
  nearestTransitStopId?: string | null;
  cityId: string | null;
  zoneId: string | null;
  businesses: Business[];
}

export default function ShoppingCenterPage({ citySlug, slug }: { citySlug: string; slug: string }) {
  const smartBack = useSmartBack(`/${citySlug}/directory`);
  const { data: center, isLoading } = useQuery<ShoppingCenterData>({
    queryKey: ["/api/cities", citySlug, "shopping-centers", slug],
  });

  useRegisterAdminEdit("businesses", center?.id, "Edit Center");

  const centerTypeLabel = center?.centerType ? CENTER_TYPE_LABELS[center.centerType] || "Commercial Center" : "Commercial Center";

  usePageMeta({
    title: center ? `${center.name} — ${centerTypeLabel} | CLT Metro Hub` : "Commercial Center | CLT Metro Hub",
    description: center ? `Browse businesses at ${center.name}` : "Commercial center directory",
  });

  if (isLoading) {
    return (
      <div className="mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  if (!center) {
    return (
      <Card className="p-12 text-center max-w-lg mx-auto">
        <Building2 className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
        <h3 className="font-semibold text-lg mb-1" data-testid="text-not-found">Commercial center not found</h3>
        <Link href={`/${citySlug}`}>
          <Button variant="ghost" className="mt-2" data-testid="link-back-home">Back to Home</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="mx-auto space-y-6">
      <Button variant="ghost" size="sm" className="gap-1" onClick={smartBack} data-testid="link-back-directory">
        <ArrowLeft className="h-4 w-4" /> Back to Directory
      </Button>

      <div>
        <div className="flex items-center gap-3 mb-2">
          <Building2 className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold" data-testid="text-center-name">{center.name}</h1>
          <Badge variant="secondary" className="text-xs">{centerTypeLabel}</Badge>
        </div>
        {(center.alsoKnownAs || center.residentialName) && (
          <div className="flex flex-wrap gap-2 mt-1">
            {center.alsoKnownAs && (
              <p className="text-sm text-muted-foreground" data-testid="text-also-known-as">
                Also known as: {center.alsoKnownAs}
              </p>
            )}
            {center.residentialName && (
              <p className="text-sm text-muted-foreground" data-testid="text-residential-name">
                Residential: {center.residentialName}
              </p>
            )}
          </div>
        )}
        {center.address && (
          <p className="text-muted-foreground flex items-center gap-1 text-sm" data-testid="text-center-address">
            <MapPin className="h-4 w-4" /> {center.address}
          </p>
        )}
        {center.nearestTransitStopId && (
          <div className="mt-2">
            <TransitBadgeFromId stopId={center.nearestTransitStopId} citySlug={citySlug} />
          </div>
        )}
      </div>

      <div>
        <h2 className="font-semibold text-lg mb-4" data-testid="text-businesses-heading">
          {center.businesses.length} {center.businesses.length === 1 ? "Business" : "Businesses"} at {center.name}
        </h2>

        {center.businesses.length === 0 ? (
          <Card className="p-8 text-center" data-testid="card-no-businesses">
            <Store className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-muted-foreground text-sm">No businesses listed at this location yet.</p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {center.businesses.map((biz) => (
              <Link key={biz.id} href={`/${citySlug}/presence/${biz.slug}`}>
                <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer h-full" data-testid={`card-business-${biz.id}`}>
                  <div className="aspect-[16/9] bg-muted overflow-hidden">
                    <BizImage src={biz.imageUrl} alt={biz.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-sm line-clamp-2">{biz.name}</h3>
                      {biz.isVerified && (
                        <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      )}
                    </div>
                    {biz.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{biz.description}</p>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                      {biz.googleRating && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Star className="h-3 w-3" /> {biz.googleRating}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">{biz.listingTier}</Badge>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
