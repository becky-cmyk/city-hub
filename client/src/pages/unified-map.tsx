import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, Popup, useMap, Circle } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";
import { Link } from "wouter";
import { useI18n } from "@/lib/i18n";
import cltNavLogo from "@assets/CLT_Charlotte_Skyline_Transparent_1773270853281.png";
import { usePageMeta } from "@/hooks/use-page-meta";
import { getCityBranding, getBrandForContext } from "@shared/city-branding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MapPin, Search, Navigation, X,
  LocateFixed, ChevronDown, ChevronUp,
  ArrowLeft, ArrowRight, SlidersHorizontal,
  Compass, Calendar, Map as MapIcon, Rss
} from "lucide-react";
import {
  FILTER_GROUPS,
  filterItems,
  resolveGroupForItem,
  type MapItem,
  type FilterGroup,
} from "@/lib/map-filter-config";

function escHtml(str: string | undefined | null): string {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

interface MapPlacement {
  id: string;
  type: string;
  business_id?: string;
  zone_id?: string;
  title?: string;
  tagline?: string;
  logo_url?: string;
  cta_url?: string;
  cta_text?: string;
  business_name?: string;
  biz_logo?: string;
  zone_name?: string;
  zone_slug?: string;
  zone_center_lat?: string;
  zone_center_lng?: string;
}

interface MapZone {
  id: string;
  name: string;
  slug: string;
  center_lat?: string;
  center_lng?: string;
}

interface MapData {
  items: MapItem[];
  placements: MapPlacement[];
  zones: MapZone[];
  categories: { name: string; slug: string }[];
  center?: { lat: number; lng: number };
}

function createMarkerIcon(item: MapItem) {
  const group = resolveGroupForItem(item);
  const color = group?.color || "#10b981";
  const isPromoted = item.promotedPin;
  const isCrown = item.isCrown;
  const size = isPromoted ? 38 : 28;
  const glowFilter = isPromoted ? `filter: drop-shadow(0 0 6px ${color}) drop-shadow(0 0 12px ${color}40);` : "";
  const crownBadge = isCrown ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#eab308" width="14" height="14" style="position:absolute;top:-8px;left:50%;transform:translateX(-50%);"><path d="M2 4l3 12h14l3-12-6 7-4-9-4 9-6-7z"/><path d="M5 20h14v-2H5v2z"/></svg>` : "";

  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
    html: `<div style="position:relative;${glowFilter}">${crownBadge}<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="${size}" height="${size}" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5))"><path stroke="white" stroke-width="0.8" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg></div>`,
  });
}

function MarkerClusterLayer({ items, citySlug, onSelectItem, t }: {
  items: MapItem[];
  citySlug: string;
  onSelectItem: (item: MapItem) => void;
  t: (key: string, r?: Record<string, string>) => string;
}) {
  const map = useMap();
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    if (clusterRef.current) {
      map.removeLayer(clusterRef.current);
    }

    const cluster = (L as Record<string, Function>).markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      iconCreateFunction: (clstr: { getChildCount: () => number }) => {
        const count = clstr.getChildCount();
        let size = 'small';
        if (count > 50) size = 'large';
        else if (count > 20) size = 'medium';
        return L.divIcon({
          html: `<div style="background:rgba(16,185,129,0.85);color:white;border-radius:50%;width:${size === 'large' ? 48 : size === 'medium' ? 40 : 32}px;height:${size === 'large' ? 48 : size === 'medium' ? 40 : 32}px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${size === 'large' ? 14 : 12}px;border:2px solid rgba(255,255,255,0.5);box-shadow:0 2px 8px rgba(0,0,0,0.4);">${count}</div>`,
          className: "",
          iconSize: L.point(size === 'large' ? 48 : size === 'medium' ? 40 : 32, size === 'large' ? 48 : size === 'medium' ? 40 : 32),
        });
      },
    });

    items.forEach(item => {
      const marker = L.marker([item.lat, item.lng], {
        icon: createMarkerIcon(item),
        zIndexOffset: item.promotedPin ? 1000 : item.isFeatured ? 500 : 0,
      });

      marker.on("click", () => {
        onSelectItem(item);
        map.setView([item.lat, item.lng], Math.max(map.getZoom(), 14), { animate: true });
      });

      cluster.addLayer(marker);
    });

    map.addLayer(cluster);
    clusterRef.current = cluster;

    return () => {
      if (clusterRef.current) {
        map.removeLayer(clusterRef.current);
      }
    };
  }, [items, map, citySlug, t, onSelectItem]);

  return null;
}

function MapBoundsUpdater({ items }: { items: MapItem[] }) {
  const map = useMap();
  const hasSet = useRef(false);

  useEffect(() => {
    if (hasSet.current || items.length === 0) return;
    const bounds = L.latLngBounds(items.map(i => [i.lat, i.lng] as [number, number]));
    map.fitBounds(bounds.pad(0.1), { maxZoom: 13 });
    hasSet.current = true;
  }, [items, map]);

  return null;
}

function UserLocationCenterUpdater({ location, centerVersion }: { location: { lat: number; lng: number } | null; centerVersion: number }) {
  const map = useMap();
  const lastVersion = useRef(0);

  useEffect(() => {
    if (location && centerVersion > lastVersion.current) {
      map.setView([location.lat, location.lng], 14, { animate: true });
      lastVersion.current = centerVersion;
    }
  }, [location, centerVersion, map]);

  return null;
}

function DetailPanel({ item, onClose }: {
  item: MapItem;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const group = resolveGroupForItem(item);
  const destination = `${item.lat},${item.lng}`;
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;

  return (
    <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:top-4 sm:bottom-4 sm:w-80 z-[1000] animate-in slide-in-from-bottom-4 sm:slide-in-from-right-4 duration-200" data-testid="detail-panel">
      <div className="bg-gray-900/95 border border-white/15 rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[50vh] sm:max-h-full">
        <div className="flex items-center justify-between p-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: group?.color || "#666" }}
            />
            <span className="text-[10px] uppercase tracking-wide font-semibold text-white/50 truncate">{item.type}</span>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white p-1" data-testid="button-close-detail">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {item.imageUrl && (
            <div className="rounded-lg overflow-hidden mb-3 aspect-video">
              <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
            </div>
          )}

          <h3 className="font-bold text-base text-white mb-2" data-testid="text-detail-title">{item.title}</h3>

          <div className="flex items-center gap-1.5 flex-wrap mb-3">
            {item.isFeatured && <Badge className="bg-emerald-500/20 text-emerald-300 border-0 text-[10px]">{t("map.featured")}</Badge>}
            {item.isVerified && <Badge className="bg-blue-500/20 text-blue-300 border-0 text-[10px]">{t("map.verified")}</Badge>}
            {item.isSponsored && <Badge className="bg-amber-500/20 text-amber-300 border-0 text-[10px]">{t("map.sponsored")}</Badge>}
            {item.isCrown && <Badge className="bg-yellow-500/20 text-yellow-300 border-0 text-[10px]">{t("map.crownBadge")}</Badge>}
          </div>

          {item.category && (
            <p className="text-xs text-white/50 mb-1">{item.category}</p>
          )}
          {item.zone && (
            <p className="text-xs text-white/50 flex items-center gap-1 mb-1">
              <MapPin className="h-3 w-3 shrink-0" /> {item.zone}
            </p>
          )}
          {item.address && (
            <p className="text-xs text-white/40 mb-3">{item.address}</p>
          )}
          {item.description && (
            <p className="text-sm text-white/60 line-clamp-3 mb-4">{item.description}</p>
          )}

          <div className="flex flex-col gap-2">
            <Link href={item.detailUrl}>
              <Button size="sm" className="w-full" data-testid="button-view-detail">
                {t("map.viewDetails")} <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </Link>
            <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="w-full border-white/10 text-white" data-testid="button-get-directions">
                <Navigation className="h-3.5 w-3.5 mr-1" /> {t("map.getDirections")}
              </Button>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function NeighborhoodOverlays({ zones, selectedZone, onSelectZone }: {
  zones: MapZone[];
  selectedZone: string;
  onSelectZone: (slug: string) => void;
}) {
  const zonesWithCoords = zones.filter(z => z.center_lat && z.center_lng);
  if (zonesWithCoords.length === 0) return null;

  return (
    <>
      {zonesWithCoords.map(zone => {
        const lat = parseFloat(zone.center_lat!);
        const lng = parseFloat(zone.center_lng!);
        if (isNaN(lat) || isNaN(lng)) return null;
        const isSelected = selectedZone === zone.slug;
        return (
          <Circle
            key={zone.id}
            center={[lat, lng]}
            radius={1200}
            pathOptions={{
              color: isSelected ? "#a78bfa" : "#6366f1",
              fillColor: isSelected ? "#a78bfa" : "#6366f1",
              fillOpacity: isSelected ? 0.15 : 0.05,
              weight: isSelected ? 2.5 : 1,
              dashArray: isSelected ? undefined : "4 6",
            }}
            eventHandlers={{
              click: () => {
                onSelectZone(isSelected ? "" : zone.slug);
              },
            }}
          >
            <Popup>
              <div style={{ minWidth: 120 }} data-testid={`popup-neighborhood-${zone.slug}`}>
                <p style={{ fontWeight: 700, fontSize: 13, margin: "0 0 4px" }}>
                  {zone.name}
                </p>
                <button
                  onClick={(e) => { e.stopPropagation(); onSelectZone(isSelected ? "" : zone.slug); }}
                  style={{
                    background: isSelected ? "#dc2626" : "#6366f1",
                    color: "white",
                    padding: "4px 10px",
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                  }}
                  data-testid={`button-explore-neighborhood-${zone.slug}`}
                >
                  {isSelected ? "Clear Filter" : "Explore"}
                </button>
              </div>
            </Popup>
          </Circle>
        );
      })}
    </>
  );
}

function SponsoredZoneOverlays({ placements }: { placements: MapPlacement[] }) {
  const { t } = useI18n();
  const zoneOverlays = placements.filter(p => p.type === "zone_overlay" && p.zone_center_lat && p.zone_center_lng);
  if (zoneOverlays.length === 0) return null;
  return (
    <>
      {zoneOverlays.map(overlay => {
        const lat = parseFloat(overlay.zone_center_lat!);
        const lng = parseFloat(overlay.zone_center_lng!);
        if (isNaN(lat) || isNaN(lng)) return null;
        return (
          <Circle
            key={overlay.id}
            center={[lat, lng]}
            radius={800}
            pathOptions={{
              color: "#eab308",
              fillColor: "#eab308",
              fillOpacity: 0.08,
              weight: 2,
              dashArray: "6 4",
            }}
          >
            <Popup>
              <div style={{ minWidth: 160 }} data-testid={`popup-zone-overlay-${overlay.id}`}>
                <p style={{ fontWeight: 700, fontSize: 13, margin: "0 0 4px" }}>
                  {escHtml(overlay.zone_name || overlay.title || t("map.sponsoredZone"))}
                </p>
                {overlay.tagline && <p style={{ fontSize: 11, color: "#888", margin: "0 0 6px" }}>{escHtml(overlay.tagline)}</p>}
                {overlay.cta_url && (
                  <a href={escHtml(overlay.cta_url)} target="_blank" rel="noopener noreferrer"
                    style={{ background: "#eab308", color: "white", padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, textDecoration: "none" }}>
                    {escHtml(overlay.cta_text || t("map.learnMore"))}
                  </a>
                )}
              </div>
            </Popup>
          </Circle>
        );
      })}
    </>
  );
}

function FilterBar({
  activeGroups,
  activeSubCategories,
  onToggleGroup,
  onToggleSubCategory,
  expandedGroup,
  onSetExpandedGroup,
}: {
  activeGroups: Set<string>;
  activeSubCategories: Map<string, Set<string>>;
  onToggleGroup: (key: string) => void;
  onToggleSubCategory: (groupKey: string, subKey: string) => void;
  expandedGroup: string | null;
  onSetExpandedGroup: (key: string | null) => void;
}) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const activeCount = activeGroups.size;
  const totalCount = FILTER_GROUPS.length;

  return (
    <div className="absolute bottom-20 sm:bottom-4 left-0 right-0 z-[1000]" data-testid="filter-bar">
      {expandedGroup && (
        <div className="mx-3 mb-2 animate-in slide-in-from-bottom-2 duration-150">
          <div className="bg-gray-900/95 border border-white/15 rounded-xl p-2.5 shadow-2xl">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-semibold text-white/70">
                {FILTER_GROUPS.find(g => g.key === expandedGroup)?.label} — Sub-filters
              </span>
              <button
                onClick={() => onSetExpandedGroup(null)}
                className="text-white/40 hover:text-white p-0.5"
                data-testid="button-close-subcategories"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {FILTER_GROUPS.find(g => g.key === expandedGroup)?.subCategories?.map(sub => {
                const activeSubs = activeSubCategories.get(expandedGroup);
                const isActive = !activeSubs || activeSubs.size === 0 || activeSubs.has(sub.key);
                const groupColor = FILTER_GROUPS.find(g => g.key === expandedGroup)?.color || "#666";
                return (
                  <button
                    key={sub.key}
                    onClick={() => onToggleSubCategory(expandedGroup, sub.key)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border shrink-0 ${
                      isActive
                        ? "text-white border-transparent"
                        : "text-white/30 border-white/10 bg-gray-800/60"
                    }`}
                    style={isActive ? { backgroundColor: groupColor + "99", borderColor: groupColor } : undefined}
                    data-testid={`sub-toggle-${sub.key}`}
                  >
                    {sub.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="sm:hidden mx-3 mb-2">
        <button
          onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-gray-900/90 border border-white/15 shadow-lg text-white text-sm font-medium"
          data-testid="button-mobile-filter-toggle"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
          {activeCount < totalCount && (
            <span className="bg-purple-500/80 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {mobileDrawerOpen && (
        <div className="sm:hidden mx-3 mb-2 animate-in slide-in-from-bottom-4 duration-200">
          <div className="bg-gray-900/95 border border-white/15 rounded-xl p-3 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-white">Categories</span>
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="text-white/40 hover:text-white p-1"
                data-testid="button-close-mobile-filters"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2" data-testid="mobile-filter-grid">
              {FILTER_GROUPS.map(group => {
                const Icon = group.icon;
                const isActive = activeGroups.has(group.key);
                return (
                  <button
                    key={group.key}
                    onClick={() => onToggleGroup(group.key)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all min-h-[72px] ${
                      isActive
                        ? "text-white border-transparent"
                        : "text-white/40 border-white/10 bg-gray-800/40"
                    }`}
                    style={
                      isActive
                        ? { backgroundColor: group.color + "33", borderColor: group.color + "88" }
                        : undefined
                    }
                    data-testid={`mobile-toggle-${group.key}`}
                  >
                    <Icon className="w-5 h-5" style={isActive ? { color: group.color } : undefined} />
                    <span className="text-[10px] font-medium leading-tight text-center">{group.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="hidden sm:block mx-3">
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none" data-testid="type-toggles">
          {FILTER_GROUPS.map(group => {
            const Icon = group.icon;
            const isActive = activeGroups.has(group.key);
            const hasSubs = group.subCategories && group.subCategories.length > 0;
            const isExpanded = expandedGroup === group.key;
            return (
              <div key={group.key} className="flex items-center shrink-0">
                <button
                  onClick={() => onToggleGroup(group.key)}
                  className={`flex items-center gap-1 px-2.5 py-2 text-xs font-medium transition-all border shadow-lg ${
                    hasSubs ? "rounded-l-full" : "rounded-full"
                  } ${
                    isActive
                      ? "text-white border-transparent"
                      : "text-white/40 border-white/10"
                  }`}
                  style={
                    isActive
                      ? { backgroundColor: group.color + "cc", borderColor: group.color }
                      : { backgroundColor: "rgba(17,24,39,0.85)" }
                  }
                  data-testid={`toggle-${group.key}`}
                >
                  <Icon className="w-3 h-3" />
                  <span className="whitespace-nowrap">{group.label}</span>
                </button>
                {hasSubs && (
                  <button
                    onClick={() => onSetExpandedGroup(isExpanded ? null : group.key)}
                    className={`flex items-center px-1.5 py-2 text-xs border border-l-0 rounded-r-full transition-all shadow-lg ${
                      isActive
                        ? "text-white/70 border-transparent"
                        : "text-white/30 border-white/10"
                    }`}
                    style={
                      isActive
                        ? { backgroundColor: group.color + "99", borderColor: group.color }
                        : { backgroundColor: "rgba(17,24,39,0.85)" }
                    }
                    data-testid={`expand-${group.key}`}
                  >
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function UnifiedMap({ citySlug }: { citySlug: string }) {
  const { t } = useI18n();
  const cityName = citySlug.charAt(0).toUpperCase() + citySlug.slice(1);
  const mapBranding = getCityBranding(citySlug);
  const mapBrand = mapBranding ? getBrandForContext(mapBranding, "default") : null;
  usePageMeta({
    title: `${t("map.title")} | ${mapBrand?.ogSiteName || "CLT Hub"}`,
    description: t("map.subtitle"),
    canonical: `${window.location.origin}/${citySlug}/map`,
    ogSiteName: mapBrand?.ogSiteName,
  });

  const defaultActiveGroups = new Set(
    FILTER_GROUPS
      .filter(g => g.key !== "housing")
      .map(g => g.key)
  );
  const [activeGroups, setActiveGroups] = useState<Set<string>>(defaultActiveGroups);
  const [activeSubCategories, setActiveSubCategories] = useState<Map<string, Set<string>>>(new Map());
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<MapItem | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(() => {
    try {
      const cached = localStorage.getItem("hub_user_coords");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number' && Number.isFinite(parsed.lat) && Number.isFinite(parsed.lng) && Date.now() - (parsed.ts || 0) < 24 * 60 * 60 * 1000) {
          return { lat: parsed.lat, lng: parsed.lng };
        }
      }
    } catch {}
    return null;
  });
  const [centerVersion, setCenterVersion] = useState(() => (userLocation ? 1 : 0));
  const [searchOpen, setSearchOpen] = useState(false);
  const geoRequested = useRef(false);

  useEffect(() => {
    if (geoRequested.current) return;
    geoRequested.current = true;
    if (userLocation) return;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLocation(coords);
          setCenterVersion(v => v + 1);
          try {
            localStorage.setItem("hub_user_coords", JSON.stringify({ ...coords, ts: Date.now() }));
          } catch {}
        },
        () => {},
        { timeout: 8000, maximumAge: 300000 }
      );
    }
  }, []);

  const { data, isLoading } = useQuery<MapData>({
    queryKey: ["/api/cities", citySlug, "map"],
  });

  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    let items = filterItems(data.items, activeGroups, activeSubCategories);

    if (["charlotte", "clt"].includes(citySlug)) {
      items = items.filter(i =>
        i.lat >= 34.5 && i.lat <= 36.0 && i.lng >= -82.5 && i.lng <= -79.5
      );
    }

    if (selectedZone) {
      items = items.filter(i => i.zoneSlug === selectedZone);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.category?.toLowerCase().includes(q) ||
        i.zone?.toLowerCase().includes(q) ||
        i.address?.toLowerCase().includes(q)
      );
    }

    return items;
  }, [data, activeGroups, activeSubCategories, selectedZone, searchQuery, citySlug]);

  const toggleGroup = useCallback((key: string) => {
    setActiveGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleSubCategory = useCallback((groupKey: string, subKey: string) => {
    setActiveSubCategories(prev => {
      const next = new Map(prev);
      const group = FILTER_GROUPS.find(g => g.key === groupKey);
      if (!group?.subCategories) return next;

      const current = next.get(groupKey) || new Set<string>();
      const updated = new Set(current);

      if (updated.size === 0) {
        group.subCategories.forEach(s => {
          if (s.key !== subKey) updated.add(s.key);
        });
      } else if (updated.has(subKey)) {
        updated.delete(subKey);
        if (updated.size === 0) {
          next.delete(groupKey);
          return next;
        }
      } else {
        updated.add(subKey);
        if (updated.size === group.subCategories.length) {
          next.delete(groupKey);
          return next;
        }
      }

      next.set(groupKey, updated);
      return next;
    });
  }, []);

  const handleNearMe = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLocation(loc);
          setCenterVersion(v => v + 1);
        },
        () => {}
      );
    }
  };

  const nearbyItems = useMemo(() => {
    if (!userLocation || !filteredItems.length) return [];
    return filteredItems
      .map(item => {
        const R = 3959;
        const dLat = ((item.lat - userLocation.lat) * Math.PI) / 180;
        const dLng = ((item.lng - userLocation.lng) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos((userLocation.lat * Math.PI) / 180) * Math.cos((item.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
        const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return { ...item, distance: dist };
      })
      .filter(i => i.distance <= 5)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 8);
  }, [userLocation, filteredItems]);

  const defaultCenter: [number, number] = data?.center ? [data.center.lat, data.center.lng] : [35.2271, -80.8431];

  return (
    <div className="fixed inset-0 bg-gray-950 flex flex-col" data-testid="unified-map-page">
      <div className="absolute top-0 left-0 right-0 z-[1000]">
        <div className="flex items-center justify-between px-3 py-2 bg-gray-950/80 backdrop-blur-md border-b border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            <Link href={`/${citySlug}`}>
              <img
                src={cltNavLogo}
                alt="CLT Hub"
                className="h-6 w-auto cursor-pointer drop-shadow-md"
                data-testid="map-nav-logo"
              />
            </Link>
            <span className="w-px h-4 bg-white/20" aria-hidden="true" />
            <div className="flex items-center gap-1">
              <Link href={`/${citySlug}/pulse`}>
                <button className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors" data-testid="map-nav-pulse">
                  <Rss className="h-3 w-3" />
                  <span className="hidden sm:inline">Pulse</span>
                </button>
              </Link>
              <Link href={`/${citySlug}/neighborhoods`}>
                <button className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors" data-testid="map-nav-neighborhoods">
                  <Compass className="h-3 w-3" />
                  <span className="hidden sm:inline">Neighborhoods</span>
                </button>
              </Link>
              <Link href={`/${citySlug}/events/browse`}>
                <button className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors" data-testid="map-nav-events">
                  <Calendar className="h-3 w-3" />
                  <span className="hidden sm:inline">Events</span>
                </button>
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="bg-white/5 rounded-md px-2 py-1">
              <span className="text-[10px] text-white/50 font-medium" data-testid="text-map-count">
                {filteredItems.length} {t("map.items")}
              </span>
            </div>
            {selectedZone && (
              <button
                onClick={() => setSelectedZone("")}
                className="bg-purple-600/80 rounded-md px-2 py-1 flex items-center gap-1"
                data-testid="button-clear-zone-filter"
              >
                <span className="text-[10px] text-white font-medium truncate max-w-[80px]">
                  {data?.zones?.find(z => z.slug === selectedZone)?.name || selectedZone}
                </span>
                <X className="h-3 w-3 text-purple-200" />
              </button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSearchOpen(!searchOpen)}
              className={`h-7 w-7 p-0 ${searchOpen ? "text-purple-300 bg-purple-500/20" : "text-white/60 hover:text-white"}`}
              data-testid="button-toggle-search"
            >
              <Search className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleNearMe}
              className={`h-7 w-7 p-0 ${userLocation ? "text-blue-300 bg-blue-500/20" : "text-white/60 hover:text-white"}`}
              data-testid="button-near-me"
            >
              <LocateFixed className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {searchOpen && (
        <div className="absolute top-12 left-3 right-3 sm:left-auto sm:right-3 sm:w-80 z-[1000] animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="bg-gray-900/95 border border-white/15 rounded-xl p-3 shadow-2xl space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("map.searchPlaceholder")}
                className="pl-9 bg-white/5 border-white/10 text-white text-sm"
                data-testid="input-map-search"
                autoFocus
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white" data-testid="button-clear-map-search">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {data?.zones && data.zones.length > 0 && (
              <select
                value={selectedZone}
                onChange={e => setSelectedZone(e.target.value)}
                className="w-full bg-white/5 border border-white/10 text-white text-sm rounded-lg px-3 py-2"
                data-testid="select-zone"
              >
                <option value="">{t("map.allNeighborhoods")}</option>
                {data.zones.map(z => (
                  <option key={z.slug} value={z.slug}>{z.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

      <FilterBar
        activeGroups={activeGroups}
        activeSubCategories={activeSubCategories}
        onToggleGroup={toggleGroup}
        onToggleSubCategory={toggleSubCategory}
        expandedGroup={expandedGroup}
        onSetExpandedGroup={setExpandedGroup}
      />

      <div className="flex-1 relative">
        {isLoading ? (
          <div className="w-full h-full flex items-center justify-center bg-gray-950">
            <div className="text-center">
              <Skeleton className="w-12 h-12 rounded-full mx-auto mb-3 bg-white/10" />
              <p className="text-white/40 text-sm">{t("map.loading")}</p>
            </div>
          </div>
        ) : (
          <MapContainer
            center={defaultCenter}
            zoom={11}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom={true}
            zoomControl={false}
            {...(["charlotte", "clt"].includes(citySlug) ? {
              maxBounds: [[34.5, -82.5], [36.0, -79.5]] as [[number, number], [number, number]],
              maxBoundsViscosity: 0.9,
              minZoom: 8,
            } : {})}
          >
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />
            <UserLocationCenterUpdater location={userLocation} centerVersion={centerVersion} />
            {filteredItems.length > 0 && !userLocation && <MapBoundsUpdater items={filteredItems} />}
            <MarkerClusterLayer
              items={filteredItems}
              citySlug={citySlug}
              onSelectItem={setSelectedItem}
              t={t}
            />
            {userLocation && (
              <Circle
                center={[userLocation.lat, userLocation.lng]}
                radius={200}
                pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.3 }}
              />
            )}
            {data?.placements && <SponsoredZoneOverlays placements={data.placements} />}
            {data?.zones && (
              <NeighborhoodOverlays
                zones={data.zones}
                selectedZone={selectedZone}
                onSelectZone={setSelectedZone}
              />
            )}
          </MapContainer>
        )}

        {selectedItem && (
          <DetailPanel
            item={selectedItem}
            onClose={() => setSelectedItem(null)}
          />
        )}

        {userLocation && nearbyItems.length > 0 && !selectedItem && (
          <div className="absolute top-12 left-3 z-[1000] animate-in slide-in-from-left-4 duration-200 sm:w-72" data-testid="near-me-panel">
            <div className="bg-gray-900/95 border border-blue-500/20 rounded-xl overflow-hidden shadow-2xl max-h-[40vh] flex flex-col">
              <div className="p-3 border-b border-white/10 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <LocateFixed className="h-4 w-4 text-blue-400" />
                  <span className="text-sm font-semibold text-white">Near You</span>
                  <span className="text-[10px] text-white/40">{nearbyItems.length} within 5mi</span>
                </div>
                <button onClick={() => setUserLocation(null)} className="text-white/40 hover:text-white" data-testid="button-close-nearby">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="overflow-y-auto flex-1">
                {nearbyItems.map(item => {
                  const grp = resolveGroupForItem(item);
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className="w-full text-left px-3 py-2.5 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                      data-testid={`nearby-item-${item.id}`}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                          style={{ backgroundColor: grp?.color || "#666" }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-white truncate">{item.title}</p>
                          <p className="text-[10px] text-white/40">{item.distance.toFixed(1)} mi away</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {!isLoading && filteredItems.length === 0 && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000] text-center bg-gray-900/90 border border-white/15 rounded-xl p-8 shadow-2xl">
            <MapPin className="mx-auto h-10 w-10 text-white/20 mb-2" />
            <p className="text-white/60 text-sm font-medium" data-testid="text-map-empty">{t("map.noResults")}</p>
            <p className="text-white/40 text-xs">{t("map.noResultsHint")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
