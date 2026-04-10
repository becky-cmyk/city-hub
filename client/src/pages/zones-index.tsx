import { useCityZones } from "@/hooks/use-city";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { MapPin, ChevronRight, Building, Map, Hash, Search, X } from "lucide-react";
import { Link } from "wouter";
import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

const TYPE_CONFIG = [
  { type: "COUNTY", label: "County", icon: Map, color: "hsl(var(--brand-primary, 273 66% 34%))" },
  { type: "DISTRICT", label: "City / Town", icon: Building, color: "hsl(var(--brand-teal, 174 42% 44%))" },
  { type: "NEIGHBORHOOD", label: "Neighborhood", icon: MapPin, color: "hsl(var(--brand-coral, 12 75% 54%))" },
  { type: "ZIP", label: "Zip Code", icon: Hash, color: "hsl(var(--brand-sky, 211 55% 64%))" },
] as const;

export default function ZonesIndex({ citySlug }: { citySlug: string }) {
  const { data: zones, isLoading } = useCityZones(citySlug);
  const { t } = useI18n();
  const [search, setSearch] = useState("");

  const grouped = useMemo(() => {
    if (!zones) return [];
    const q = search.trim().toLowerCase();
    const filtered = q
      ? zones.filter((z) => z.name.toLowerCase().includes(q) || (z.county && z.county.toLowerCase().includes(q)))
      : zones;

    const byType: Record<string, typeof zones> = {};
    for (const z of filtered) {
      const type = z.type || "NEIGHBORHOOD";
      if (!byType[type]) byType[type] = [];
      byType[type].push(z);
    }
    return TYPE_CONFIG
      .filter((cfg) => byType[cfg.type] && byType[cfg.type].length > 0)
      .map((cfg) => ({
        ...cfg,
        zones: byType[cfg.type].sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [zones, search]);

  const totalResults = grouped.reduce((sum, g) => sum + g.zones.length, 0);
  const isSearching = search.trim().length > 0;
  const defaultOpen = isSearching ? grouped.map((g) => g.type) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2 mb-1" data-testid="text-zones-title">
          <MapPin className="h-6 w-6 text-primary" />
          {t("nav.topLists")}
        </h1>
        <p className="text-muted-foreground text-sm">Find your area by county, city, neighborhood, or zip code</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by zip code, neighborhood, or county..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 pr-9"
          data-testid="input-zone-search"
        />
        {isSearching && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={() => setSearch("")}
            data-testid="button-clear-zone-search"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {isSearching && (
        <p className="text-sm text-muted-foreground" data-testid="text-zone-search-results">
          {totalResults} {totalResults === 1 ? "result" : "results"} for "{search.trim()}"
        </p>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-md" />
          ))}
        </div>
      ) : grouped.length > 0 ? (
        <Accordion
          type="multiple"
          defaultValue={defaultOpen}
          key={isSearching ? "searching" : "default"}
          className="space-y-2"
        >
          {grouped.map((group) => {
            const Icon = group.icon;
            return (
              <AccordionItem
                key={group.type}
                value={group.type}
                className="border rounded-lg px-4"
                data-testid={`section-zone-type-${group.type.toLowerCase()}`}
              >
                <AccordionTrigger className="hover:no-underline py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-md"
                      style={{ backgroundColor: `color-mix(in srgb, ${group.color} 12%, transparent)` }}
                    >
                      <Icon className="h-4 w-4" style={{ color: group.color }} />
                    </div>
                    <span className="text-base font-semibold">{group.label}</span>
                    <Badge variant="secondary" className="text-[11px]">{group.zones.length}</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div
                    className={`grid gap-2 ${
                      group.type === "ZIP"
                        ? "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6"
                        : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
                    }`}
                  >
                    {group.zones.map((zone) => (
                      <Link key={zone.id} href={`/${citySlug}/directory?zone=${zone.slug}`}>
                        <Card
                          className="hover-elevate cursor-pointer px-3 py-2.5 flex items-center justify-between gap-2"
                          data-testid={`card-zone-${zone.slug}`}
                        >
                          <span className="text-sm font-medium truncate">{zone.name}</span>
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        </Card>
                      </Link>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      ) : isSearching ? (
        <Card className="p-8 text-center">
          <Search className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <h3 className="font-semibold text-base mb-1">No results found</h3>
          <p className="text-muted-foreground text-sm">Try a different zip code or neighborhood name</p>
        </Card>
      ) : (
        <Card className="p-12 text-center">
          <MapPin className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-lg mb-1">No locations configured</h3>
        </Card>
      )}
    </div>
  );
}
