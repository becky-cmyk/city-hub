import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Landmark, TreePine, Star, MapPin, Sparkles, Camera, Compass, Map } from "lucide-react";
import type { Attraction } from "@shared/schema";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { usePageMeta } from "@/hooks/use-page-meta";
import { InlineAd } from "@/components/ad-banner";

const TYPE_CONFIG: Record<string, { icon: typeof Landmark; color: string }> = {
  HISTORICAL: { icon: Landmark, color: "hsl(var(--brand-gold))" },
  PARK: { icon: TreePine, color: "hsl(var(--brand-teal))" },
  LANDMARK: { icon: Star, color: "hsl(var(--brand-coral))" },
  HIDDEN_GEM: { icon: Sparkles, color: "hsl(var(--brand-primary))" },
  MUSEUM: { icon: Camera, color: "hsl(var(--brand-sky))" },
  TOUR: { icon: Compass, color: "hsl(var(--brand-sand))" },
};

const TYPE_KEYS: Record<string, TranslationKey> = {
  HISTORICAL: "attractions.historical",
  PARK: "attractions.park",
  LANDMARK: "attractions.landmark",
  HIDDEN_GEM: "attractions.hiddenGem",
  MUSEUM: "attractions.museum",
  TOUR: "attractions.tour",
};

export default function AttractionsPage({ citySlug }: { citySlug: string }) {
  const { t } = useI18n();
  const [selectedType, setSelectedType] = useState("");

  usePageMeta({
    title: "Attractions & Tour Guide — CLT Metro Hub",
    description: "Discover Charlotte's landmarks, parks, hidden gems, and historic sites with fun facts and local knowledge.",
    canonical: `${window.location.origin}/${citySlug}/attractions`,
  });

  const queryParams = new URLSearchParams();
  if (selectedType) queryParams.set("type", selectedType);

  const { data: attractions, isLoading } = useQuery<Attraction[]>({
    queryKey: ["/api/cities", citySlug, "attractions", `?${queryParams.toString()}`],
  });

  const types = ["HISTORICAL", "PARK", "LANDMARK", "HIDDEN_GEM", "MUSEUM", "TOUR"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2 mb-1" data-testid="text-attractions-title">
          <Map className="h-6 w-6 text-primary" />
          {t("attractions.title")}
        </h1>
        <p className="text-muted-foreground text-sm">{t("attractions.subtitle")}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={!selectedType ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedType("")}
          className="rounded-full gap-1"
          data-testid="filter-all-types"
        >
          {t("attractions.allTypes")}
        </Button>
        {types.map((type) => {
          const config = TYPE_CONFIG[type];
          const Icon = config.icon;
          return (
            <Button
              key={type}
              variant={selectedType === type ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedType(selectedType === type ? "" : type)}
              className="rounded-full gap-1"
              data-testid={`filter-type-${type.toLowerCase()}`}
            >
              <Icon className="h-3.5 w-3.5" style={{ color: selectedType !== type ? config.color : undefined }} />
              {t(TYPE_KEYS[type])}
            </Button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-5 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-20 w-full rounded-md" />
            </Card>
          ))}
        </div>
      ) : attractions && attractions.length > 0 ? (
        <>
        <InlineAd citySlug={citySlug} page="attractions" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {attractions.map((attraction) => {
            const config = TYPE_CONFIG[attraction.attractionType] || TYPE_CONFIG.LANDMARK;
            const Icon = config.icon;
            return (
              <Card key={attraction.id} className="hover-elevate p-5 space-y-3" data-testid={`card-attraction-${attraction.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 shrink-0" style={{ color: config.color }} />
                    <h3 className="font-semibold text-base">{attraction.name}</h3>
                  </div>
                  {attraction.isFeatured && (
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      <Star className="h-3 w-3 mr-0.5" /> Featured
                    </Badge>
                  )}
                </div>

                {attraction.description && (
                  <p className="text-sm text-muted-foreground line-clamp-3">{attraction.description}</p>
                )}

                {attraction.address && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span>{attraction.address}</span>
                  </div>
                )}

                <Badge variant="outline" className="text-[10px]">
                  {t(TYPE_KEYS[attraction.attractionType])}
                </Badge>

                {attraction.funFact && (
                  <div className="mt-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
                    <p className="text-xs font-semibold flex items-center gap-1 mb-1" style={{ color: "hsl(var(--brand-primary))" }}>
                      <Sparkles className="h-3 w-3" />
                      {t("attractions.funFact")}
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{attraction.funFact}</p>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
        </>
      ) : (
        <div className="text-center py-12">
          <Map className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">{t("attractions.noResults")}</p>
          <p className="text-sm text-muted-foreground/60 mt-1">{t("attractions.noResultsHint")}</p>
        </div>
      )}
    </div>
  );
}
