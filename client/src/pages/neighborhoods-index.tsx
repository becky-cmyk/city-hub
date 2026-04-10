import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Search, X, ChevronDown } from "lucide-react";
import { Link } from "wouter";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Region } from "@shared/schema";
import heroDefault from "@assets/ChatGPT_Image_Feb_22,_2026,_11_51_29_AM_1771794828800.png";
import { DarkPageShell } from "@/components/dark-page-shell";

type CountyWithHubs = Region & { hubs: Region[] };

const HEX_COLORS = [
  { h: 273, s: 66, l: 34 },
  { h: 174, s: 62, l: 44 },
  { h: 14, s: 77, l: 54 },
  { h: 46, s: 88, l: 57 },
  { h: 324, s: 85, l: 63 },
  { h: 211, s: 55, l: 64 },
  { h: 152, s: 30, l: 48 },
  { h: 40, s: 59, l: 63 },
];

function hsl(c: typeof HEX_COLORS[0], a?: number) {
  if (a !== undefined) return `hsla(${c.h}, ${c.s}%, ${c.l}%, ${a})`;
  return `hsl(${c.h}, ${c.s}%, ${c.l}%)`;
}

const COUNTY_COLORS = [
  "hsl(273 66% 50%)",
  "hsl(174 62% 45%)",
  "hsl(14 77% 52%)",
  "hsl(46 88% 52%)",
  "hsl(324 85% 55%)",
  "hsl(211 55% 55%)",
  "hsl(152 40% 45%)",
  "hsl(40 59% 55%)",
];

export default function NeighborhoodsIndex({ citySlug }: { citySlug: string }) {
  const [search, setSearch] = useState("");
  const [selectedCountyId, setSelectedCountyId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{
    metro: Region | null;
    counties: CountyWithHubs[];
    allHubs: Region[];
  }>({
    queryKey: ["/api/cities", citySlug, "regions"],
    queryFn: async () => {
      const res = await fetch(`/api/cities/${citySlug}/regions`);
      if (!res.ok) throw new Error("Failed to load regions");
      return res.json();
    },
  });

  const counties = useMemo(() => {
    if (!data?.counties) return [];
    return data.counties.sort((a, b) => {
      if (a.name === "Mecklenburg") return -1;
      if (b.name === "Mecklenburg") return 1;
      return a.name.localeCompare(b.name);
    });
  }, [data]);

  const allHubs = useMemo(() => {
    if (!data) return [];
    const hubs: (Region & { countyName?: string })[] = [];
    data.counties.forEach((county) => {
      county.hubs.forEach((hub) => {
        hubs.push({ ...hub, countyName: county.name });
      });
    });
    return hubs;
  }, [data]);

  const filtered = useMemo(() => {
    let list = allHubs;
    if (selectedCountyId) {
      const county = counties.find(c => c.id === selectedCountyId);
      if (county) {
        const hubIds = new Set(county.hubs.map(h => h.id));
        list = list.filter(h => hubIds.has(h.id));
      }
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (h) =>
          h.name.toLowerCase().includes(q) ||
          (h.code && h.code.toLowerCase().includes(q)) ||
          (h as any).countyName?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [allHubs, counties, selectedCountyId, search]);

  const selectedCountyName = selectedCountyId
    ? counties.find(c => c.id === selectedCountyId)?.name || "All"
    : null;

  return (
    <DarkPageShell maxWidth="wide" fillHeight>
      <div className="space-y-6">
        <div className="text-center">
          <h1
            className="text-2xl font-bold flex items-center justify-center gap-2 mb-1 text-white"
            data-testid="text-neighborhoods-title"
          >
            <MapPin className="h-6 w-6 text-purple-400" />
            Neighborhoods & Areas
          </h1>
          <p className="text-white/50 text-sm max-w-lg mx-auto">
            Explore the Charlotte Metro by county and neighborhood. Tap a county to filter, then explore its hubs.
          </p>
        </div>

        {!isLoading && counties.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 text-xs text-white/40 font-medium uppercase tracking-wider">
              <ChevronDown className="h-3.5 w-3.5" />
              <span>Select a County</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </div>
            <div className="county-hex-grid" data-testid="county-hex-grid">
              <button
                onClick={() => setSelectedCountyId(null)}
                className={`county-hex ${!selectedCountyId ? "active" : ""}`}
                data-testid="county-hex-all"
              >
                <div className="hex-inner">
                  <div
                    className="county-hex-bg"
                    style={{ background: "linear-gradient(135deg, hsl(273 66% 30%) 0%, hsl(174 62% 35%) 50%, hsl(14 77% 45%) 100%)" }}
                  />
                  <div className="county-hex-label">
                    <span className="county-hex-name">All</span>
                    <span className="county-hex-count">{allHubs.length} hubs</span>
                  </div>
                </div>
              </button>
              {counties.map((county, idx) => {
                const color = COUNTY_COLORS[idx % COUNTY_COLORS.length];
                const isActive = selectedCountyId === county.id;
                return (
                  <button
                    key={county.id}
                    onClick={() => setSelectedCountyId(isActive ? null : county.id)}
                    className={`county-hex ${isActive ? "active" : ""}`}
                    data-testid={`county-hex-${county.code?.toLowerCase()}`}
                  >
                    <div className="hex-inner">
                      <div
                        className="county-hex-bg"
                        style={{ background: `linear-gradient(180deg, ${color} 0%, ${color} 100%)` }}
                      />
                      <div className="county-hex-label">
                        <span className="county-hex-name">{county.name}</span>
                        <span className="county-hex-count">{county.hubs.length} {county.hubs.length === 1 ? "hub" : "hubs"}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-center text-sm text-purple-400 font-semibold" data-testid="text-selected-county">
              {selectedCountyName
                ? `Showing ${selectedCountyName} County — ${filtered.length} ${filtered.length === 1 ? "neighborhood" : "neighborhoods"}`
                : `All counties — ${allHubs.length} neighborhoods`
              }
            </p>
          </div>
        )}

        <div className="relative max-w-md mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <Input
            placeholder="Search neighborhoods..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-9 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-purple-500/40"
            data-testid="input-neighborhood-search"
          />
          {search && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 text-white/60"
              onClick={() => setSearch("")}
              data-testid="button-clear-neighborhood-search"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {search && (
          <p className="text-sm text-white/50 text-center" data-testid="text-neighborhood-search-results">
            {filtered.length} {filtered.length === 1 ? "result" : "results"} for "{search.trim()}"
          </p>
        )}

        {isLoading ? (
          <div className="hex-grid">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="hex-item">
                <div className="hex-inner">
                  <Skeleton className="absolute inset-0 bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="hex-grid" data-testid="hex-neighborhood-grid">
            {filtered.filter(hub => hub.code).map((hub, idx) => {
              const c = HEX_COLORS[idx % HEX_COLORS.length];
              return (
                <Link key={hub.id} href={`/${citySlug}/neighborhoods/${hub.code!.toLowerCase()}`}>
                  <div
                    className="hex-item"
                    data-testid={`hex-hub-${hub.code?.toLowerCase()}`}
                  >
                    <div className="hex-inner">
                      <div
                        className="hex-bg"
                        style={{
                          backgroundImage: `url(${heroDefault})`,
                          backgroundColor: hsl(c),
                          backgroundBlendMode: "overlay",
                        }}
                      />
                      <div
                        className="hex-overlay"
                        style={{
                          background: `linear-gradient(180deg, ${hsl(c, 0.27)} 0%, ${hsl(c, 0.8)} 100%)`,
                        }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center z-[1]">
                        <div className="hex-label-wrap">
                          <div className="hex-label-bg" />
                          <span className="hex-name">{hub.name}</span>
                          {(hub as any).countyName && (
                            <span className="hex-county">{(hub as any).countyName} County</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : search ? (
          <div className="rounded-md bg-white/10 border border-white/10 p-8 text-center">
            <Search className="mx-auto h-10 w-10 text-white/20 mb-3" />
            <h3 className="font-semibold text-base mb-1 text-white">No results found</h3>
            <p className="text-white/50 text-sm">Try a different neighborhood or county name</p>
          </div>
        ) : selectedCountyId ? (
          <div className="rounded-md bg-white/10 border border-white/10 p-8 text-center">
            <MapPin className="mx-auto h-10 w-10 text-white/20 mb-3" />
            <h3 className="font-semibold text-base mb-1 text-white">No neighborhoods yet</h3>
            <p className="text-white/50 text-sm">This county doesn't have any neighborhood hubs configured yet.</p>
            <Button variant="outline" className="mt-3 border-white/20 text-white" onClick={() => setSelectedCountyId(null)} data-testid="button-show-all-counties">
              Show All Neighborhoods
            </Button>
          </div>
        ) : (
          <div className="rounded-md bg-white/10 border border-white/10 p-12 text-center">
            <MapPin className="mx-auto h-12 w-12 text-white/20 mb-4" />
            <h3 className="font-semibold text-lg mb-1 text-white">No neighborhoods configured</h3>
          </div>
        )}
      </div>
    </DarkPageShell>
  );
}
