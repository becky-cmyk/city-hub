import { useRef, useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { MapPin, Grid3X3, X, ChevronRight, ExternalLink } from "lucide-react";

interface Neighborhood {
  id: string;
  slug: string;
  label: string;
  code: string | null;
  centerLat?: number | null;
  centerLng?: number | null;
}

interface GroupedNeighborhoods {
  county: string;
  countyCode: string | null;
  neighborhoods: Neighborhood[];
}

interface StoriesRowProps {
  citySlug: string;
  activeGeoTag?: string;
  onHubSelect: (slug: string | undefined) => void;
  userLat?: number | null;
  userLng?: number | null;
}

const STORAGE_PREFIX = "clt_recent_neighborhoods_";
const MAX_RECENT = 10;
const MAX_VISIBLE_CIRCLES = 4;

const DEFAULT_NEIGHBORHOODS = ["uptown", "noda", "southend", "southpark", "ballantyne"];

function storageKey(citySlug: string) {
  return `${STORAGE_PREFIX}${citySlug}`;
}

function getRecentSlugs(citySlug: string): string[] {
  try {
    const stored = localStorage.getItem(storageKey(citySlug));
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function trackSelection(citySlug: string, slug: string) {
  try {
    const recent = getRecentSlugs(citySlug).filter(s => s !== slug);
    recent.unshift(slug);
    localStorage.setItem(storageKey(citySlug), JSON.stringify(recent.slice(0, MAX_RECENT)));
  } catch {}
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getNearestHubSlugs(hubs: Neighborhood[], lat: number, lng: number, count: number): string[] {
  return hubs
    .filter(h => h.centerLat != null && h.centerLng != null)
    .map(h => ({ slug: h.slug, dist: haversineDistance(lat, lng, h.centerLat!, h.centerLng!) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, count)
    .map(h => h.slug);
}

export function StoriesRow({ citySlug, activeGeoTag, onHubSelect, userLat, userLng }: StoriesRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [, setLocation] = useLocation();
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  const navigateToHub = useCallback((slug: string) => {
    setLocation(`/${citySlug}/neighborhoods/${slug}`);
  }, [citySlug, setLocation]);

  const { data } = useQuery<{ flat: Neighborhood[]; grouped: GroupedNeighborhoods[] }>({
    queryKey: [`/api/feed/neighborhoods?citySlug=${citySlug}`],
  });

  const allHubs = data?.flat || [];
  const grouped = data?.grouped || [];

  const recentSlugs = getRecentSlugs(citySlug);

  const anchorHub = activeGeoTag ? allHubs.find(h => h.slug === activeGeoTag) : null;
  const anchorLat = anchorHub?.centerLat != null ? parseFloat(String(anchorHub.centerLat)) : userLat;
  const anchorLng = anchorHub?.centerLng != null ? parseFloat(String(anchorHub.centerLng)) : userLng;

  const geoSlugs = (anchorLat != null && anchorLng != null && allHubs.length > 0)
    ? getNearestHubSlugs(allHubs, anchorLat, anchorLng, MAX_VISIBLE_CIRCLES)
    : null;

  let personalizedSlugs: string[];
  if (geoSlugs) {
    const geoSet = new Set(geoSlugs);
    const recentGeo = recentSlugs.filter(s => geoSet.has(s));
    const remaining = geoSlugs.filter(s => !recentGeo.includes(s));
    personalizedSlugs = [...recentGeo, ...remaining].slice(0, MAX_VISIBLE_CIRCLES);
  } else if (recentSlugs.length > 0) {
    personalizedSlugs = recentSlugs.filter(s => allHubs.some(h => h.slug === s)).slice(0, MAX_VISIBLE_CIRCLES);
  } else {
    personalizedSlugs = DEFAULT_NEIGHBORHOODS.slice(0, MAX_VISIBLE_CIRCLES);
  }

  const visibleHubs = personalizedSlugs
    .map(slug => allHubs.find(h => h.slug === slug))
    .filter(Boolean) as Neighborhood[];

  if (visibleHubs.length < MAX_VISIBLE_CIRCLES) {
    const remaining = DEFAULT_NEIGHBORHOODS
      .filter(s => !visibleHubs.some(h => h.slug === s))
      .map(s => allHubs.find(h => h.slug === s))
      .filter(Boolean) as Neighborhood[];
    for (const hub of remaining) {
      if (visibleHubs.length >= MAX_VISIBLE_CIRCLES) break;
      visibleHubs.push(hub);
    }
  }

  const handleHubSelect = useCallback((slug: string | undefined) => {
    if (slug) {
      trackSelection(citySlug, slug);
    }
    onHubSelect(slug);
  }, [citySlug, onHubSelect]);

  const handleBrowseSelect = useCallback((slug: string) => {
    trackSelection(citySlug, slug);
    onHubSelect(slug);
    setBrowseOpen(false);
    setSearchQuery("");
  }, [citySlug, onHubSelect]);

  useEffect(() => {
    if (!browseOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setBrowseOpen(false);
        setSearchQuery("");
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setBrowseOpen(false);
        setSearchQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [browseOpen]);

  useEffect(() => {
    if (browseOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [browseOpen]);

  const sortedGrouped = grouped
    .map(g => ({
      ...g,
      neighborhoods: [...g.neighborhoods].sort((a, b) => a.label.localeCompare(b.label)),
    }))
    .sort((a, b) => a.county.localeCompare(b.county));

  const filteredGrouped = searchQuery.trim()
    ? sortedGrouped
        .map(g => ({
          ...g,
          neighborhoods: g.neighborhoods.filter(n =>
            n.label.toLowerCase().includes(searchQuery.toLowerCase())
          ),
        }))
        .filter(g => g.neighborhoods.length > 0)
    : sortedGrouped;

  if (allHubs.length === 0) return null;

  return (
    <div className="relative" data-testid="stories-row">
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto px-3 py-2 scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}
      >
        <button
          className="flex flex-col items-center gap-1 flex-shrink-0"
          onClick={() => handleHubSelect(undefined)}
          data-testid="story-all"
        >
          <div className={`w-14 h-14 rounded-full p-[2px] ${!activeGeoTag ? "bg-gradient-to-br from-purple-500 via-pink-500 to-amber-500" : "bg-white/20"}`}>
            <div className="w-full h-full rounded-full bg-gray-900 flex items-center justify-center overflow-hidden">
              <MapPin className="h-5 w-5 text-white/70" />
            </div>
          </div>
          <span className={`text-[10px] font-medium w-14 text-center truncate ${!activeGeoTag ? "text-white" : "text-white/50"}`}>
            All CLT
          </span>
        </button>

        {visibleHubs.map((hub) => {
          const isActive = activeGeoTag === hub.slug;
          const initial = hub.label.charAt(0).toUpperCase();
          return (
            <button
              key={hub.id}
              className="flex flex-col items-center gap-1 flex-shrink-0"
              onClick={() => {
                if (didLongPress.current) {
                  didLongPress.current = false;
                  return;
                }
                handleHubSelect(hub.slug);
              }}
              onPointerDown={() => {
                didLongPress.current = false;
                longPressTimer.current = setTimeout(() => {
                  didLongPress.current = true;
                  navigateToHub(hub.slug);
                }, 500);
              }}
              onPointerUp={() => {
                if (longPressTimer.current) {
                  clearTimeout(longPressTimer.current);
                  longPressTimer.current = null;
                }
              }}
              onPointerCancel={() => {
                if (longPressTimer.current) {
                  clearTimeout(longPressTimer.current);
                  longPressTimer.current = null;
                }
              }}
              data-testid={`story-${hub.slug}`}
            >
              <div className={`w-14 h-14 rounded-full p-[2px] ${isActive ? "bg-gradient-to-br from-purple-500 via-pink-500 to-amber-500" : "bg-gradient-to-br from-purple-500/40 via-pink-500/40 to-amber-500/40"}`}>
                <div className="w-full h-full rounded-full bg-gray-900 flex items-center justify-center">
                  <span className={`text-lg font-bold ${isActive ? "text-white" : "text-white/50"}`}>{initial}</span>
                </div>
              </div>
              <span className={`text-[10px] font-medium w-14 text-center truncate ${isActive ? "text-white" : "text-white/50"}`}>
                {hub.label}
              </span>
            </button>
          );
        })}

        <button
          className="flex flex-col items-center gap-1 flex-shrink-0"
          onClick={() => setBrowseOpen(true)}
          data-testid="story-browse-all"
        >
          <div className="w-14 h-14 rounded-full p-[2px] bg-white/20">
            <div className="w-full h-full rounded-full bg-gray-900 flex items-center justify-center">
              <Grid3X3 className="h-5 w-5 text-white/50" />
            </div>
          </div>
          <span className="text-[10px] font-medium w-14 text-center truncate text-white/50">
            Browse
          </span>
        </button>
      </div>

      <div className="absolute left-0 top-0 bottom-0 w-3 bg-gradient-to-r from-gray-950 to-transparent pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-gray-950 to-transparent pointer-events-none" />

      {browseOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-start md:justify-center" data-testid="browse-areas-overlay">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => { setBrowseOpen(false); setSearchQuery(""); }}
          />

          <div
            ref={panelRef}
            className="relative z-10 w-full md:w-[480px] max-h-[80vh] md:max-h-[70vh] md:mt-24 bg-gray-900 border border-white/10 rounded-t-2xl md:rounded-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom md:slide-in-from-top duration-200"
            data-testid="browse-areas-panel"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <h3 className="text-base font-semibold text-white">Browse All Areas</h3>
              <button
                onClick={() => { setBrowseOpen(false); setSearchQuery(""); }}
                className="p-1 rounded-full hover:bg-white/10 transition-colors"
                data-testid="browse-areas-close"
              >
                <X className="h-5 w-5 text-white/60" />
              </button>
            </div>

            <div className="px-4 py-2 border-b border-white/10">
              <input
                type="text"
                placeholder="Search neighborhoods..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50"
                data-testid="browse-areas-search"
                autoFocus
              />
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              {filteredGrouped.length === 0 && (
                <p className="text-sm text-white/40 text-center py-6" data-testid="browse-areas-empty">
                  No areas found
                </p>
              )}

              {filteredGrouped.map((group) => (
                <div key={group.county} data-testid={`browse-county-${group.county.toLowerCase().replace(/\s+/g, "-")}`}>
                  <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
                    {group.county}
                  </h4>
                  <div className="grid grid-cols-2 gap-1">
                    {group.neighborhoods.map((n) => {
                      const isActive = activeGeoTag === n.slug;
                      return (
                        <div key={n.id} className="flex items-center gap-1">
                          <button
                            onClick={() => handleBrowseSelect(n.slug)}
                            className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                              isActive
                                ? "bg-purple-500/20 text-purple-300"
                                : "text-white/70 hover:bg-white/5 hover:text-white"
                            }`}
                            data-testid={`browse-area-${n.slug}`}
                          >
                            <span className="truncate">{n.label}</span>
                            {isActive && <ChevronRight className="h-3 w-3 ml-auto flex-shrink-0 text-purple-400" />}
                          </button>
                          <button
                            onClick={() => {
                              setBrowseOpen(false);
                              setSearchQuery("");
                              navigateToHub(n.slug);
                            }}
                            className="p-1.5 rounded-md text-white/30 hover:text-white/70 hover:bg-white/10 transition-colors flex-shrink-0"
                            title={`Visit ${n.label} Hub`}
                            data-testid={`browse-visit-${n.slug}`}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
