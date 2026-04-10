import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, ChevronDown, Search, X, Navigation, Home, Briefcase, Globe } from "lucide-react";

type GeoContext = "near_me" | "home" | "work" | "metro";

interface Neighborhood {
  id: string;
  slug: string;
  label: string;
  code: string | null;
  countyName: string | null;
}

interface GroupedNeighborhoods {
  county: string;
  countyCode: string | null;
  neighborhoods: { id: string; slug: string; label: string; code: string | null }[];
}

interface GeoSelectorProps {
  citySlug: string;
  currentGeoTag?: string;
  geoContext: GeoContext;
  onGeoChange: (slug: string | undefined) => void;
  onGeoContextChange: (ctx: GeoContext) => void;
}

const GEO_CONTEXTS: { value: GeoContext; label: string; icon: typeof Navigation }[] = [
  { value: "near_me", label: "Near Me", icon: Navigation },
  { value: "home", label: "Home", icon: Home },
  { value: "work", label: "Work", icon: Briefcase },
  { value: "metro", label: "Metro", icon: Globe },
];

export function GeoSelector({ citySlug, currentGeoTag, geoContext, onGeoChange, onGeoContextChange }: GeoSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data } = useQuery<{ grouped: GroupedNeighborhoods[]; flat: Neighborhood[]; total: number }>({
    queryKey: ["/api/feed/neighborhoods", citySlug],
    queryFn: async () => {
      const res = await fetch(`/api/feed/neighborhoods?citySlug=${citySlug}`);
      return res.json();
    },
  });

  const grouped = data?.grouped || [];
  const flat = data?.flat || [];

  const filteredFlat = search
    ? flat.filter(n => n.label.toLowerCase().includes(search.toLowerCase()) || (n.countyName && n.countyName.toLowerCase().includes(search.toLowerCase())))
    : [];

  const cityName = citySlug.charAt(0).toUpperCase() + citySlug.slice(1);
  const currentLabel = currentGeoTag
    ? flat.find(n => n.slug === currentGeoTag)?.label || currentGeoTag
    : cityName;

  const activeCtx = GEO_CONTEXTS.find(c => c.value === geoContext);
  const ActiveIcon = activeCtx?.icon || Globe;

  return (
    <div className="relative">
      <button
        className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-bold text-white hover:bg-white/20 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
        data-testid="geo-selector-btn"
      >
        <ActiveIcon className="h-3.5 w-3.5 text-amber-400" />
        <span className="text-amber-400">#</span>
        {currentLabel}
        <span className="text-[10px] text-white/40 font-normal ml-0.5">{activeCtx?.label}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 top-full mt-2 z-50 w-80 max-h-[70vh] overflow-hidden rounded-xl border border-white/15 bg-gray-900/95 backdrop-blur-xl shadow-2xl" data-testid="geo-selector-dropdown">
            <div className="p-2 border-b border-white/10">
              <div className="flex gap-1" data-testid="geo-context-bar">
                {GEO_CONTEXTS.map((ctx) => {
                  const Icon = ctx.icon;
                  const isActive = geoContext === ctx.value;
                  return (
                    <button
                      key={ctx.value}
                      className={`flex-1 flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-semibold transition-colors ${
                        isActive
                          ? "bg-purple-600/40 text-purple-200 ring-1 ring-purple-500/50"
                          : "text-white/60 hover:bg-white/5 hover:text-white/80"
                      }`}
                      onClick={() => {
                        onGeoContextChange(ctx.value);
                        setIsOpen(false);
                        setSearch("");
                      }}
                      data-testid={`geo-ctx-${ctx.value}`}
                    >
                      <Icon className="h-3 w-3" />
                      {ctx.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {geoContext === "near_me" && (
              <div className="px-3 py-3 border-b border-white/10">
                <div className="flex items-center gap-2 text-xs text-white/60">
                  <Navigation className="h-3.5 w-3.5 text-purple-400" />
                  <span>Showing content near your location</span>
                </div>
              </div>
            )}

            {(geoContext === "home" || geoContext === "work") && !currentGeoTag && (
              <div className="px-3 py-3 border-b border-white/10">
                <p className="text-xs text-white/50 mb-1.5">
                  Pick a neighborhood to set as your {geoContext === "home" ? "Home" : "Work"} area
                </p>
              </div>
            )}

            <div className="p-2 border-b border-white/10">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
                <input
                  type="text"
                  placeholder="Search neighborhoods..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-8 py-2 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-purple-500/50"
                  autoFocus
                  data-testid="geo-search-input"
                />
                {search && (
                  <button className="absolute right-2.5 top-1/2 -translate-y-1/2" onClick={() => setSearch("")} data-testid="geo-search-clear">
                    <X className="h-3.5 w-3.5 text-white/40 hover:text-white" />
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-y-auto max-h-60 p-1">
              <button
                className={`w-full text-left rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                  !currentGeoTag ? "bg-purple-600/30 text-purple-300" : "text-white/80 hover:bg-white/5"
                }`}
                onClick={() => {
                  onGeoChange(undefined);
                  setIsOpen(false);
                  setSearch("");
                }}
                data-testid="geo-option-all"
              >
                <span className="flex items-center gap-2">
                  <MapPin className="h-3 w-3 text-amber-400" />
                  All {cityName}
                </span>
              </button>

              {search ? (
                <>
                  {filteredFlat.map((n) => (
                    <button
                      key={n.id}
                      className={`w-full text-left rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                        currentGeoTag === n.slug ? "bg-purple-600/30 text-purple-300" : "text-white/80 hover:bg-white/5"
                      }`}
                      onClick={() => {
                        onGeoChange(n.slug);
                        setIsOpen(false);
                        setSearch("");
                      }}
                      data-testid={`geo-option-${n.slug}`}
                    >
                      <span className="flex items-center gap-2">
                        <MapPin className="h-3 w-3 text-white/40" />
                        {n.label}
                        {n.countyName && <span className="text-[10px] text-white/30 ml-auto">{n.countyName}</span>}
                      </span>
                    </button>
                  ))}
                  {filteredFlat.length === 0 && (
                    <div className="px-3 py-4 text-center text-xs text-white/40">
                      No neighborhoods found
                    </div>
                  )}
                </>
              ) : (
                grouped.map((group) => (
                  <div key={group.county} className="mt-1">
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/30">
                      {group.county}
                    </div>
                    {group.neighborhoods.map((n) => (
                      <button
                        key={n.id}
                        className={`w-full text-left rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          currentGeoTag === n.slug ? "bg-purple-600/30 text-purple-300" : "text-white/70 hover:bg-white/5 hover:text-white/90"
                        }`}
                        onClick={() => {
                          onGeoChange(n.slug);
                          setIsOpen(false);
                          setSearch("");
                        }}
                        data-testid={`geo-option-${n.slug}`}
                      >
                        <span className="flex items-center gap-2">
                          <MapPin className="h-3 w-3 text-white/30" />
                          {n.label}
                        </span>
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
