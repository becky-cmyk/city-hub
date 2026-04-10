import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Link } from "wouter";
import { useState } from "react";
import {
  Search,
  Scissors,
  Star,
  CheckCircle,
  Users,
  Calendar,
  Zap,
  MapPin,
  Filter,
  Clock,
} from "lucide-react";
import { OpeningCard } from "@/components/booking-module-renderer";
import type { Provider, ProviderOpening } from "@shared/schema";
import { PROVIDER_CATEGORIES } from "@shared/schema";
import { DarkPageShell } from "@/components/dark-page-shell";

export default function ProviderDirectory({ citySlug }: { citySlug: string }) {
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [walkInsOnly, setWalkInsOnly] = useState(false);
  const [hasBookingOnly, setHasBookingOnly] = useState(false);
  const [availability, setAvailability] = useState<string>("");

  const queryParams = new URLSearchParams();
  if (selectedCategory) queryParams.set("category", selectedCategory);
  if (searchQuery) queryParams.set("q", searchQuery);
  if (verifiedOnly) queryParams.set("verified", "true");
  if (walkInsOnly) queryParams.set("acceptsWalkIns", "true");
  if (hasBookingOnly) queryParams.set("hasBooking", "true");
  if (availability) queryParams.set("availability", availability);

  const { data: providersList, isLoading } = useQuery<Provider[]>({
    queryKey: ["/api/cities", citySlug, "providers", `?${queryParams.toString()}`],
    queryFn: async () => {
      const res = await fetch(`/api/cities/${citySlug}/providers?${queryParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch providers");
      return res.json();
    },
  });

  const { data: openings } = useQuery<(ProviderOpening & { providerName: string; providerSlug: string; providerCategory: string; providerImageUrl: string | null })[]>({
    queryKey: ["/api/cities", citySlug, "openings"],
    queryFn: async () => {
      const res = await fetch(`/api/cities/${citySlug}/openings?limit=6`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  usePageMeta({
    title: "Service Providers | CLT Metro Hub",
    description: "Find and book local service providers in Charlotte, NC. Salons, stylists, barbers, wellness, and more.",
  });

  const activeFilters = [
    selectedCategory && PROVIDER_CATEGORIES.find(c => c.key === selectedCategory)?.label,
    verifiedOnly && "Verified",
    walkInsOnly && "Walk-Ins",
    hasBookingOnly && "Booking Available",
    availability === "today" && "Available Today",
    availability === "tomorrow" && "Available Tomorrow",
  ].filter(Boolean);

  return (
    <DarkPageShell maxWidth="wide">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white" data-testid="text-providers-heading">Service Providers</h1>
          <p className="text-muted-foreground text-sm mt-1">Book appointments with local service professionals</p>
        </div>

        {openings && openings.length > 0 && (
          <div data-testid="section-live-openings-feed">
            <h2 className="font-semibold text-white mb-3 flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-green-400" />
              Available Now
            </h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {openings.slice(0, 6).map((o) => (
                <Link key={o.id} href={`/${citySlug}/provider/${o.providerSlug}`}>
                  <OpeningCard
                    opening={o}
                    provider={{
                      id: o.providerId,
                      displayName: o.providerName,
                      slug: o.providerSlug,
                      phone: null,
                      smsNumber: null,
                      instagramUrl: null,
                      bookingUrl: null,
                      profileImageUrl: o.providerImageUrl,
                    }}
                    compact
                  />
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search providers..."
                className="pl-9"
                data-testid="input-search-providers"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={!selectedCategory ? "default" : "outline"}
              onClick={() => setSelectedCategory("")}
              data-testid="filter-category-all"
            >
              All
            </Button>
            {PROVIDER_CATEGORIES.map((cat) => (
              <Button
                key={cat.key}
                size="sm"
                variant={selectedCategory === cat.key ? "default" : "outline"}
                onClick={() => setSelectedCategory(selectedCategory === cat.key ? "" : cat.key)}
                data-testid={`filter-category-${cat.key.toLowerCase()}`}
              >
                {cat.label}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={verifiedOnly ? "default" : "outline"}
              className="gap-1"
              onClick={() => setVerifiedOnly(!verifiedOnly)}
              data-testid="filter-verified"
            >
              <CheckCircle className="h-3 w-3" /> Verified
            </Button>
            <Button
              size="sm"
              variant={walkInsOnly ? "default" : "outline"}
              className="gap-1"
              onClick={() => setWalkInsOnly(!walkInsOnly)}
              data-testid="filter-walkins"
            >
              <Users className="h-3 w-3" /> Walk-Ins
            </Button>
            <Button
              size="sm"
              variant={hasBookingOnly ? "default" : "outline"}
              className="gap-1"
              onClick={() => setHasBookingOnly(!hasBookingOnly)}
              data-testid="filter-booking"
            >
              <Calendar className="h-3 w-3" /> Booking Available
            </Button>
            <Button
              size="sm"
              variant={availability === "today" ? "default" : "outline"}
              className="gap-1"
              onClick={() => setAvailability(availability === "today" ? "" : "today")}
              data-testid="filter-available-today"
            >
              <Zap className="h-3 w-3" /> Available Today
            </Button>
            <Button
              size="sm"
              variant={availability === "tomorrow" ? "default" : "outline"}
              className="gap-1"
              onClick={() => setAvailability(availability === "tomorrow" ? "" : "tomorrow")}
              data-testid="filter-available-tomorrow"
            >
              <Clock className="h-3 w-3" /> Available Tomorrow
            </Button>
          </div>

          {activeFilters.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Filter className="h-3 w-3" />
              Filtered by: {activeFilters.join(", ")}
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        ) : !providersList || providersList.length === 0 ? (
          <Card className="p-12 text-center" data-testid="card-no-providers">
            <Scissors className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
            <h3 className="font-semibold text-lg mb-1">No providers found</h3>
            <p className="text-muted-foreground text-sm">Try adjusting your filters or search.</p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {providersList.map((provider) => {
              const catLabel = PROVIDER_CATEGORIES.find(c => c.key === provider.category)?.label || provider.category;
              return (
                <Link key={provider.id} href={`/${citySlug}/provider/${provider.slug}`}>
                  <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer h-full" data-testid={`card-provider-${provider.id}`}>
                    {provider.heroImageUrl ? (
                      <div className="aspect-[16/9]">
                        <img src={provider.heroImageUrl} alt={provider.displayName} className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <div className="aspect-[16/9] bg-gradient-to-br from-purple-900/40 to-teal-900/40 flex items-center justify-center">
                        {provider.profileImageUrl ? (
                          <img src={provider.profileImageUrl} alt={provider.displayName} className="h-16 w-16 rounded-full object-cover border-2 border-white/20" />
                        ) : (
                          <Scissors className="h-10 w-10 text-muted-foreground/30" />
                        )}
                      </div>
                    )}
                    <div className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-sm line-clamp-1">{provider.displayName}</h3>
                        {provider.isVerified && (
                          <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        )}
                      </div>
                      {provider.bio && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{provider.bio}</p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">{catLabel}</Badge>
                        {provider.acceptsWalkIns && (
                          <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                            Walk-Ins
                          </Badge>
                        )}
                        {provider.bookingUrl && (
                          <Badge variant="secondary" className="text-xs gap-0.5">
                            <Calendar className="h-2.5 w-2.5" />
                            Book Online
                          </Badge>
                        )}
                      </div>
                      {provider.specialties && provider.specialties.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          {provider.specialties.slice(0, 3).map((s, i) => (
                            <span key={i} className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">{s}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </DarkPageShell>
  );
}
