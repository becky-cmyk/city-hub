import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Search, ChevronDown, ChevronRight, Download, Building2, Home, Map } from "lucide-react";
import { useState, useMemo } from "react";

interface ZoneData {
  id: string;
  name: string;
  slug: string;
  type: string;
  county: string | null;
  stateCode: string | null;
  zipCodes: string[] | null;
  isActive: boolean;
  parentZoneId: string | null;
}

function typeBadge(type: string) {
  switch (type) {
    case "COUNTY": return <Badge variant="default" className="bg-blue-600 text-xs" data-testid={`badge-type-county`}>County</Badge>;
    case "DISTRICT": return <Badge variant="default" className="bg-green-600 text-xs" data-testid={`badge-type-district`}>Town</Badge>;
    case "NEIGHBORHOOD": return <Badge variant="default" className="bg-teal-600 text-xs" data-testid={`badge-type-neighborhood`}>Neighborhood</Badge>;
    case "ZIP": return <Badge variant="outline" className="text-xs text-muted-foreground" data-testid={`badge-type-zip`}>ZIP</Badge>;
    default: return <Badge variant="outline" className="text-xs">{type}</Badge>;
  }
}

export default function CoverageAuditPanel({ cityId }: { cityId?: string }) {
  const [search, setSearch] = useState("");
  const [expandedCounties, setExpandedCounties] = useState<Set<string>>(new Set(["Mecklenburg"]));
  const [expandedTowns, setExpandedTowns] = useState<Set<string>>(new Set());
  const { data: zones, isLoading } = useQuery<ZoneData[]>({
    queryKey: ["/api/admin/zones"],
  });

  const grouped = useMemo(() => {
    if (!zones) return { counties: [], towns: [], neighborhoods: [], zips: [], byCounty: new Map() };
    const charlotte = zones.filter(z => z.county !== "Marion");
    const counties = charlotte.filter(z => z.type === "COUNTY").sort((a, b) => a.name.localeCompare(b.name));
    const towns = charlotte.filter(z => z.type === "DISTRICT").sort((a, b) => a.name.localeCompare(b.name));
    const neighborhoods = charlotte.filter(z => z.type === "NEIGHBORHOOD").sort((a, b) => a.name.localeCompare(b.name));
    const zips = charlotte.filter(z => z.type === "ZIP").sort((a, b) => a.name.localeCompare(b.name));

    const byCounty = new Map<string, { county: ZoneData; towns: Map<string, { town: ZoneData; neighborhoods: ZoneData[] }> }>();
    for (const c of counties) {
      const key = `${c.county}:${c.stateCode}`;
      byCounty.set(key, { county: c, towns: new Map() });
    }
    for (const t of towns) {
      const key = `${t.county}:${t.stateCode}`;
      const entry = byCounty.get(key);
      if (entry) {
        entry.towns.set(t.slug, { town: t, neighborhoods: [] });
      }
    }
    for (const n of neighborhoods) {
      const key = `${n.county}:${n.stateCode}`;
      const entry = byCounty.get(key);
      if (entry) {
        if (n.parentZoneId) {
          for (const [, townEntry] of entry.towns) {
            if (townEntry.town.id === n.parentZoneId) {
              townEntry.neighborhoods.push(n);
              break;
            }
          }
        } else {
          const nZips = n.zipCodes || [];
          for (const [, townEntry] of entry.towns) {
            const tZips = townEntry.town.zipCodes || [];
            if (nZips.some(z => tZips.includes(z))) {
              townEntry.neighborhoods.push(n);
              break;
            }
          }
        }
      }
    }

    return { counties, towns, neighborhoods, zips, byCounty };
  }, [zones]);

  const stats = useMemo(() => ({
    counties: grouped.counties.length,
    towns: grouped.towns.length,
    neighborhoods: grouped.neighborhoods.length,
    zips: grouped.zips.length,
    total: grouped.counties.length + grouped.towns.length + grouped.neighborhoods.length + grouped.zips.length,
  }), [grouped]);

  const filteredCounties = useMemo(() => {
    const lowerSearch = search.toLowerCase();
    const entries = Array.from(grouped.byCounty.values());
    if (!lowerSearch) return entries;

    return entries.filter(entry => {
      if (lowerSearch) {
        const countyMatch = entry.county.name.toLowerCase().includes(lowerSearch);
        const townMatch = Array.from(entry.towns.values()).some(t =>
          t.town.name.toLowerCase().includes(lowerSearch) ||
          t.neighborhoods.some(n => n.name.toLowerCase().includes(lowerSearch))
        );
        const zipMatch = (entry.county.zipCodes || []).some(z => z.includes(lowerSearch));
        return countyMatch || townMatch || zipMatch;
      }
      return true;
    });
  }, [grouped.byCounty, search]);

  const toggleCounty = (county: string) => {
    setExpandedCounties(prev => {
      const next = new Set(prev);
      if (next.has(county)) next.delete(county); else next.add(county);
      return next;
    });
  };

  const toggleTown = (slug: string) => {
    setExpandedTowns(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug); else next.add(slug);
      return next;
    });
  };

  const exportCSV = () => {
    if (!zones) return;
    const charlotte = zones.filter(z => z.county !== "Marion" && z.type !== "ZIP");
    const rows = [["Name", "Type", "County", "State", "ZIP Codes", "Status"]];
    for (const z of charlotte.sort((a, b) => {
      const typeOrder: Record<string, number> = { COUNTY: 0, DISTRICT: 1, NEIGHBORHOOD: 2 };
      const aOrder = typeOrder[a.type] ?? 3;
      const bOrder = typeOrder[b.type] ?? 3;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (a.county || "").localeCompare(b.county || "") || a.name.localeCompare(b.name);
    })) {
      rows.push([
        z.name,
        z.type === "DISTRICT" ? "Town" : z.type === "COUNTY" ? "County" : z.type === "NEIGHBORHOOD" ? "Neighborhood" : z.type,
        z.county || "",
        z.stateCode || "",
        (z.zipCodes || []).join("; "),
        z.isActive ? "Active" : "Inactive",
      ]);
    }
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "coverage-audit.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4" data-testid="coverage-audit-panel">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold" data-testid="text-coverage-title">Coverage Audit</h2>
          <p className="text-sm text-muted-foreground">Charlotte Metro — County → Town → Neighborhood hierarchy</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} data-testid="button-export-csv">
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold text-blue-600" data-testid="text-stat-counties">{stats.counties}</div>
          <div className="text-xs text-muted-foreground">Counties</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold text-green-600" data-testid="text-stat-towns">{stats.towns}</div>
          <div className="text-xs text-muted-foreground">Towns</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold text-teal-600" data-testid="text-stat-neighborhoods">{stats.neighborhoods}</div>
          <div className="text-xs text-muted-foreground">Neighborhoods</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold text-gray-500" data-testid="text-stat-zips">{stats.zips}</div>
          <div className="text-xs text-muted-foreground">ZIP Codes</div>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, county, or ZIP..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-coverage-search"
        />
      </div>

      <div className="space-y-2">
        {filteredCounties.map(({ county, towns }) => {
          const countyKey = county.county || county.name;
          const isExpanded = expandedCounties.has(countyKey);
          const townList = Array.from(towns.values());
          const totalNeighborhoods = townList.reduce((sum, t) => sum + t.neighborhoods.length, 0);

          return (
            <Card key={county.slug} className="overflow-hidden" data-testid={`card-county-${county.slug}`}>
              <button
                className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50 transition-colors"
                onClick={() => toggleCounty(countyKey)}
                data-testid={`button-toggle-county-${county.slug}`}
              >
                {isExpanded ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                <Map className="w-4 h-4 shrink-0 text-blue-600" />
                <span className="font-semibold flex-1">{county.name}{county.stateCode === "SC" ? ", SC" : ""}</span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{townList.length} towns</span>
                  <span>·</span>
                  <span>{totalNeighborhoods} neighborhoods</span>
                  <span>·</span>
                  <span>{(county.zipCodes || []).length} ZIPs</span>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t px-3 pb-3">
                  {townList.length === 0 && (
                    <p className="text-sm text-muted-foreground py-2 pl-8">No towns seeded yet</p>
                  )}
                  {townList.map(({ town, neighborhoods: hoods }) => {
                    const townExpanded = expandedTowns.has(town.slug);
                    return (
                      <div key={town.slug} className="mt-1" data-testid={`row-town-${town.slug}`}>
                        <button
                          className="w-full flex items-center gap-2 py-2 pl-6 pr-2 text-left rounded hover:bg-muted/30 transition-colors"
                          onClick={() => hoods.length > 0 && toggleTown(town.slug)}
                          data-testid={`button-toggle-town-${town.slug}`}
                        >
                          {hoods.length > 0 ? (
                            townExpanded ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />
                          ) : <span className="w-3" />}
                          <Building2 className="w-3.5 h-3.5 shrink-0 text-green-600" />
                          <span className="text-sm font-medium flex-1">{town.name}</span>
                          <span className="text-xs text-muted-foreground mr-1">{(town.zipCodes || []).join(", ")}</span>
                          {hoods.length > 0 && (
                            <Badge variant="outline" className="text-[10px] px-1.5">{hoods.length}</Badge>
                          )}
                        </button>
                        {townExpanded && hoods.length > 0 && (
                          <div className="ml-12 border-l pl-3 pb-1">
                            {hoods.map(n => (
                              <div key={n.slug} className="flex items-center gap-2 py-1 text-sm" data-testid={`row-neighborhood-${n.slug}`}>
                                <Home className="w-3 h-3 shrink-0 text-teal-600" />
                                <span className="flex-1">{n.name}</span>
                                <span className="text-xs text-muted-foreground">{(n.zipCodes || []).join(", ")}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}

        {filteredCounties.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <MapPin className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>No results matching "{search}"</p>
          </div>
        )}
      </div>
    </div>
  );
}
