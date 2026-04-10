import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useSmartBack } from "@/hooks/use-smart-back";
import { useRegisterAdminEdit } from "@/hooks/use-admin-edit";
import { Link } from "wouter";
import {
  ArrowLeft,
  Star,
  MapPin,
  Clock,
  DollarSign,
  CheckCircle,
  Scissors,
  Sparkles,
  Calendar,
  Users,
} from "lucide-react";
import { BookingModuleRenderer, OpeningCard } from "@/components/booking-module-renderer";
import { apiRequest } from "@/lib/queryClient";
import { useEffect, useRef } from "react";
import type { Provider, ProviderService, ProviderOpening, SuiteLocation } from "@shared/schema";
import { PROVIDER_CATEGORIES } from "@shared/schema";
import { DarkPageShell } from "@/components/dark-page-shell";

interface ProviderProfileData {
  provider: Provider;
  services: ProviderService[];
  openings: ProviderOpening[];
  suiteLocation?: SuiteLocation;
}

function trackAction(providerId: string, actionType: string) {
  apiRequest("POST", `/api/providers/${providerId}/contact-action`, {
    actionType,
    sourceContext: "provider_profile",
    referrerPage: window.location.pathname,
  }).catch(() => {});
}

export default function ProviderProfile({ citySlug, slug }: { citySlug: string; slug: string }) {
  const smartBack = useSmartBack(`/${citySlug}/providers`);
  const { data, isLoading } = useQuery<ProviderProfileData>({
    queryKey: ["/api/cities", citySlug, "providers", slug],
  });

  useRegisterAdminEdit("businesses", data?.provider?.id, "Edit Provider");

  const { data: relatedProviders } = useQuery<Provider[]>({
    queryKey: ["/api/cities", citySlug, "providers"],
    enabled: !!data?.provider,
  });

  const profileViewFired = useRef(false);
  useEffect(() => {
    if (data?.provider?.id && !profileViewFired.current) {
      profileViewFired.current = true;
      trackAction(data.provider.id, "profile_view");
    }
  }, [data?.provider?.id]);

  const provider = data?.provider;
  const services = data?.services || [];
  const openings = data?.openings || [];
  const suiteLocation = data?.suiteLocation;

  const categoryLabel = PROVIDER_CATEGORIES.find(c => c.key === provider?.category)?.label || provider?.category;

  usePageMeta({
    title: provider ? `${provider.displayName} — ${categoryLabel} | CLT Metro Hub` : "Provider | CLT Metro Hub",
    description: provider?.bio?.slice(0, 160) || `Local service provider in Charlotte, NC`,
  });

  const related = relatedProviders
    ?.filter(p => p.id !== provider?.id && p.category === provider?.category)
    ?.slice(0, 4) || [];

  if (isLoading) {
    return (
      <DarkPageShell maxWidth="wide">
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="aspect-[2.5/1] w-full rounded-md" />
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-20 w-full" />
        </div>
      </DarkPageShell>
    );
  }

  if (!provider) {
    return (
      <DarkPageShell maxWidth="wide">
        <Card className="p-12 text-center">
          <Scissors className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <h3 className="font-semibold text-lg mb-1" data-testid="text-provider-not-found">Provider not found</h3>
          <Link href={`/${citySlug}/providers`}>
            <Button variant="ghost" className="mt-2" data-testid="link-back-providers">Back to Providers</Button>
          </Link>
        </Card>
      </DarkPageShell>
    );
  }

  const featuredServices = services.filter(s => s.isFeatured && s.isActive);
  const otherServices = services.filter(s => !s.isFeatured && s.isActive);

  return (
    <DarkPageShell maxWidth="wide">
      <div className="space-y-6">
        <Button variant="ghost" size="sm" className="gap-1 text-purple-300 mb-2" onClick={smartBack} data-testid="link-back-providers">
          <ArrowLeft className="h-4 w-4" /> Providers
        </Button>

        {provider.heroImageUrl && (
          <div className="aspect-[2.5/1] overflow-hidden rounded-md">
            <img src={provider.heroImageUrl} alt={provider.displayName} className="h-full w-full object-cover" />
          </div>
        )}

        <div className="flex items-start gap-4">
          {provider.profileImageUrl && (
            <div className="shrink-0">
              <img
                src={provider.profileImageUrl}
                alt={provider.displayName}
                className="h-20 w-20 rounded-full object-cover border-2 border-white/20"
                data-testid="img-provider-avatar"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-white" data-testid="text-provider-name">{provider.displayName}</h1>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              {provider.isVerified && (
                <Badge variant="secondary" data-testid="badge-provider-verified">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Verified
                </Badge>
              )}
              <Badge variant="outline" className="text-white/70 border-white/20" data-testid="badge-provider-category">
                {categoryLabel}
              </Badge>
              {provider.subcategory && (
                <Badge variant="outline" className="text-white/70 border-white/20">{provider.subcategory}</Badge>
              )}
              {provider.acceptsWalkIns && (
                <Badge variant="outline" className="text-green-400 border-green-400/30" data-testid="badge-walk-ins">
                  <Users className="h-3 w-3 mr-1" />
                  Walk-Ins Welcome
                </Badge>
              )}
            </div>
          </div>
        </div>

        {(suiteLocation || provider.suiteNumber) && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="text-suite-info">
            <MapPin className="h-4 w-4 shrink-0" />
            {suiteLocation ? (
              <Link href={`/${citySlug}/suite/${suiteLocation.slug}`}>
                <span className="hover:text-white cursor-pointer">
                  {suiteLocation.name}
                  {provider.suiteNumber ? ` - Suite ${provider.suiteNumber}` : ""}
                </span>
              </Link>
            ) : (
              <span>Suite {provider.suiteNumber}</span>
            )}
          </div>
        )}

        {provider.bio && (
          <p className="text-white/80 leading-relaxed" data-testid="text-provider-bio">{provider.bio}</p>
        )}

        {provider.specialties && provider.specialties.length > 0 && (
          <div data-testid="section-specialties">
            <h3 className="font-semibold text-white mb-2 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" />
              Specialties
            </h3>
            <div className="flex flex-wrap gap-2">
              {provider.specialties.map((s, i) => (
                <Badge key={i} variant="outline" className="text-white/70 border-white/20">{s}</Badge>
              ))}
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            {(featuredServices.length > 0 || otherServices.length > 0) && (
              <div data-testid="section-services">
                <h3 className="font-semibold text-white text-lg mb-3 flex items-center gap-1.5">
                  <DollarSign className="h-5 w-5" />
                  Services & Pricing
                </h3>
                <div className="space-y-2">
                  {featuredServices.map((svc) => (
                    <Card key={svc.id} className="p-3 border-primary/20" data-testid={`card-service-${svc.id}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm">{svc.name}</p>
                            <Badge className="text-[9px] bg-primary/20 text-primary border-primary/30">Featured</Badge>
                          </div>
                          {svc.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{svc.description}</p>
                          )}
                          {svc.durationMinutes && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <Clock className="h-3 w-3" />
                              {svc.durationMinutes} min
                            </span>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          {svc.priceDisplay && (
                            <p className="font-semibold text-sm">{svc.priceDisplay}</p>
                          )}
                          {!svc.priceDisplay && svc.priceMin != null && (
                            <p className="font-semibold text-sm">
                              ${svc.priceMin}{svc.priceMax && svc.priceMax !== svc.priceMin ? `–$${svc.priceMax}` : ""}
                            </p>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                  {otherServices.map((svc) => (
                    <Card key={svc.id} className="p-3" data-testid={`card-service-${svc.id}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{svc.name}</p>
                          {svc.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{svc.description}</p>
                          )}
                          {svc.durationMinutes && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <Clock className="h-3 w-3" />
                              {svc.durationMinutes} min
                            </span>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          {svc.priceDisplay && (
                            <p className="font-medium text-sm">{svc.priceDisplay}</p>
                          )}
                          {!svc.priceDisplay && svc.priceMin != null && (
                            <p className="font-medium text-sm">
                              ${svc.priceMin}{svc.priceMax && svc.priceMax !== svc.priceMin ? `–$${svc.priceMax}` : ""}
                            </p>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {openings.length > 0 && (
              <div data-testid="section-live-openings">
                <h3 className="font-semibold text-white text-lg mb-3 flex items-center gap-1.5">
                  <Calendar className="h-5 w-5" />
                  Live Openings
                </h3>
                <div className="space-y-2">
                  {openings.map((o) => (
                    <OpeningCard key={o.id} opening={o} provider={provider} />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <Card className="p-4 space-y-3" data-testid="section-booking-module">
              <h3 className="font-semibold text-sm">
                {provider.bookingModuleType === "call_text_fallback" ? "Get in Touch" : "Book an Appointment"}
              </h3>
              <BookingModuleRenderer provider={provider} openings={openings} />
            </Card>

            {provider.bookingPlatform && (
              <p className="text-xs text-center text-muted-foreground">
                Powered by {provider.bookingPlatform}
              </p>
            )}
          </div>
        </div>

        {related.length > 0 && (
          <div data-testid="section-related-providers">
            <h3 className="font-semibold text-white text-lg mb-3">More {categoryLabel} Providers</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {related.map((rp) => (
                <Link key={rp.id} href={`/${citySlug}/provider/${rp.slug}`}>
                  <Card className="p-3 hover:shadow-md transition-shadow cursor-pointer" data-testid={`card-related-provider-${rp.id}`}>
                    <div className="flex items-center gap-3">
                      {rp.profileImageUrl ? (
                        <img src={rp.profileImageUrl} alt={rp.displayName} className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                          <Scissors className="h-5 w-5 text-muted-foreground/40" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{rp.displayName}</p>
                        <div className="flex items-center gap-2">
                          {rp.isVerified && <Star className="h-3 w-3 text-primary" />}
                          {rp.acceptsWalkIns && (
                            <span className="text-[10px] text-green-500">Walk-Ins</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </DarkPageShell>
  );
}
