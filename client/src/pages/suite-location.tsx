import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useSmartBack } from "@/hooks/use-smart-back";
import { Link } from "wouter";
import {
  ArrowLeft,
  Building2,
  MapPin,
  Scissors,
  CheckCircle,
  Calendar,
  Users,
  Phone,
  Globe,
} from "lucide-react";
import type { Provider, SuiteLocation } from "@shared/schema";
import { SUITE_LOCATION_TYPES, PROVIDER_CATEGORIES } from "@shared/schema";
import { DarkPageShell } from "@/components/dark-page-shell";

interface SuiteLocationData {
  location: SuiteLocation;
  providers: Provider[];
}

export default function SuiteLocationPage({ citySlug, slug }: { citySlug: string; slug: string }) {
  const smartBack = useSmartBack(`/${citySlug}/providers`);
  const { data, isLoading } = useQuery<SuiteLocationData>({
    queryKey: ["/api/cities", citySlug, "suite-locations", slug],
  });

  const location = data?.location;
  const locationProviders = data?.providers || [];
  const typeLabel = SUITE_LOCATION_TYPES.find(t => t.key === location?.suiteType)?.label || "Suite Location";

  usePageMeta({
    title: location ? `${location.name} — ${typeLabel} | CLT Metro Hub` : "Suite Location | CLT Metro Hub",
    description: location ? `Find service providers at ${location.name}` : "Suite location directory",
  });

  if (isLoading) {
    return (
      <DarkPageShell maxWidth="wide">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-48" />)}
          </div>
        </div>
      </DarkPageShell>
    );
  }

  if (!location) {
    return (
      <DarkPageShell maxWidth="wide">
        <Card className="p-12 text-center max-w-lg mx-auto">
          <Building2 className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <h3 className="font-semibold text-lg mb-1" data-testid="text-not-found">Suite location not found</h3>
          <Link href={`/${citySlug}/providers`}>
            <Button variant="ghost" className="mt-2" data-testid="link-back-providers">Back to Providers</Button>
          </Link>
        </Card>
      </DarkPageShell>
    );
  }

  return (
    <DarkPageShell maxWidth="wide">
      <div className="space-y-6">
      <Button variant="ghost" size="sm" className="gap-1" onClick={smartBack} data-testid="link-back-providers">
        <ArrowLeft className="h-4 w-4" /> Back to Providers
      </Button>

      <div>
        <div className="flex items-center gap-3 mb-2">
          <Building2 className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold" data-testid="text-location-name">{location.name}</h1>
          <Badge variant="secondary" className="text-xs">{typeLabel}</Badge>
        </div>

        {location.description && (
          <p className="text-muted-foreground text-sm mt-2" data-testid="text-location-description">{location.description}</p>
        )}
        {location.address && (
          <p className="text-muted-foreground flex items-center gap-1 text-sm mt-1" data-testid="text-location-address">
            <MapPin className="h-4 w-4" /> {location.address}
          </p>
        )}
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {location.phone && (
            <a href={`tel:${location.phone}`} className="text-sm text-muted-foreground flex items-center gap-1 hover:text-foreground">
              <Phone className="h-3.5 w-3.5" /> {location.phone}
            </a>
          )}
          {location.websiteUrl && (
            <a href={location.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground flex items-center gap-1 hover:text-foreground">
              <Globe className="h-3.5 w-3.5" /> Website
            </a>
          )}
        </div>
      </div>

      {location.imageUrl && (
        <div className="aspect-[3/1] overflow-hidden rounded-md">
          <img src={location.imageUrl} alt={location.name} className="h-full w-full object-cover" />
        </div>
      )}

      <div>
        <h2 className="font-semibold text-lg mb-4" data-testid="text-providers-heading">
          {locationProviders.length} {locationProviders.length === 1 ? "Provider" : "Providers"} at {location.name}
        </h2>

        {locationProviders.length === 0 ? (
          <Card className="p-8 text-center" data-testid="card-no-providers">
            <Scissors className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-muted-foreground text-sm">No providers listed at this location yet.</p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {locationProviders.map((provider) => {
              const catLabel = PROVIDER_CATEGORIES.find(c => c.key === provider.category)?.label || provider.category;
              return (
                <Link key={provider.id} href={`/${citySlug}/provider/${provider.slug}`}>
                  <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer h-full" data-testid={`card-provider-${provider.id}`}>
                    <div className="aspect-[16/9] bg-gradient-to-br from-purple-900/40 to-teal-900/40 flex items-center justify-center">
                      {provider.profileImageUrl ? (
                        <img src={provider.profileImageUrl} alt={provider.displayName} className="h-14 w-14 rounded-full object-cover border-2 border-white/20" />
                      ) : (
                        <Scissors className="h-8 w-8 text-muted-foreground/30" />
                      )}
                    </div>
                    <div className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-sm line-clamp-1">{provider.displayName}</h3>
                        {provider.isVerified && (
                          <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        )}
                      </div>
                      {provider.suiteNumber && (
                        <p className="text-xs text-muted-foreground">Suite {provider.suiteNumber}</p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">{catLabel}</Badge>
                        {provider.acceptsWalkIns && (
                          <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                            <Users className="h-2.5 w-2.5 mr-0.5" />
                            Walk-Ins
                          </Badge>
                        )}
                        {provider.bookingUrl && (
                          <Badge variant="secondary" className="text-xs gap-0.5">
                            <Calendar className="h-2.5 w-2.5" />
                            Book
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
      </div>
    </DarkPageShell>
  );
}
