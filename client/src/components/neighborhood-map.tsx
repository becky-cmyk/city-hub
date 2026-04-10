import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Navigation } from "lucide-react";

const LIFESTYLE_FILTERS = [
  { key: "urban-living", label: "Urban Living", color: "#60a5fa" },
  { key: "family-friendly", label: "Family Friendly", color: "#34d399" },
  { key: "walkable", label: "Walkable Areas", color: "#fbbf24" },
  { key: "nightlife", label: "Nightlife Districts", color: "#c084fc" },
  { key: "suburban", label: "Suburbs", color: "#f97316" },
  { key: "waterfront", label: "Waterfront", color: "#22d3ee" },
  { key: "arts-creative", label: "Arts & Creative", color: "#fb7185" },
] as const;

export interface MapHub {
  name: string;
  code: string | null;
  slug: string | null;
  centerLat: string | null;
  centerLng: string | null;
  description: string | null;
  lifestyleTags: string[];
}

function createPinIcon(isHighlighted: boolean) {
  const color = isHighlighted ? "#34d399" : "#6b7280";
  const size = isHighlighted ? 32 : 24;
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
    html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="${size}" height="${size}"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`,
  });
}

function MapBoundsUpdater({ hubs }: { hubs: MapHub[] }) {
  const map = useMap();
  const hasSetBounds = useRef(false);

  useEffect(() => {
    if (hasSetBounds.current || hubs.length === 0) return;
    const validHubs = hubs.filter(h => h.centerLat && h.centerLng);
    if (validHubs.length === 0) return;

    const bounds = L.latLngBounds(
      validHubs.map(h => [parseFloat(h.centerLat!), parseFloat(h.centerLng!)] as [number, number])
    );
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 11 });
    hasSetBounds.current = true;
  }, [hubs, map]);

  return null;
}

interface NeighborhoodMapProps {
  hubs: MapHub[];
  citySlug: string;
  className?: string;
}

export function NeighborhoodMap({ hubs, citySlug, className = "" }: NeighborhoodMapProps) {
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());

  const toggleFilter = (key: string) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const validHubs = hubs.filter(h => h.centerLat && h.centerLng);

  const filteredHubs = activeFilters.size === 0
    ? validHubs
    : validHubs.filter(h =>
        h.lifestyleTags.some(tag => activeFilters.has(tag))
      );

  const center: [number, number] = [35.2271, -80.8431];

  return (
    <div className={className} data-testid="neighborhood-map-container">
      <div className="flex flex-wrap gap-2 mb-4" data-testid="lifestyle-filters">
        {LIFESTYLE_FILTERS.map(filter => {
          const isActive = activeFilters.has(filter.key);
          return (
            <button
              key={filter.key}
              onClick={() => toggleFilter(filter.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                isActive
                  ? "text-white border-transparent"
                  : "text-gray-400 border-gray-700 hover:border-gray-500"
              }`}
              style={isActive ? { backgroundColor: filter.color, borderColor: filter.color } : {}}
              data-testid={`filter-${filter.key}`}
            >
              {filter.label}
            </button>
          );
        })}
        {activeFilters.size > 0 && (
          <button
            onClick={() => setActiveFilters(new Set())}
            className="px-3 py-1.5 rounded-full text-xs font-medium text-white/50 border border-gray-700 hover:border-gray-500 transition-all"
            data-testid="filter-clear"
          >
            Clear All
          </button>
        )}
      </div>

      <div className="text-xs text-white/50 mb-2" data-testid="text-map-count">
        Showing {filteredHubs.length} of {validHubs.length} neighborhoods
      </div>

      <div className="rounded-xl overflow-hidden border border-gray-800" style={{ height: "480px" }}>
        <MapContainer
          center={center}
          zoom={9}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={true}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          <MapBoundsUpdater hubs={filteredHubs} />
          {filteredHubs.map(hub => (
            <Marker
              key={hub.code}
              position={[parseFloat(hub.centerLat!), parseFloat(hub.centerLng!)]}
              icon={createPinIcon(activeFilters.size > 0)}
            >
              <Popup className="neighborhood-popup" maxWidth={280} minWidth={240}>
                <div className="p-1">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-emerald-500 shrink-0" />
                    <h3 className="font-semibold text-sm text-white">{hub.name}</h3>
                  </div>
                  {hub.description && (
                    <p className="text-xs text-white/70 mb-2 line-clamp-3">{hub.description}</p>
                  )}
                  {hub.lifestyleTags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {hub.lifestyleTags.map(tag => {
                        const filter = LIFESTYLE_FILTERS.find(f => f.key === tag);
                        return (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
                            style={{ backgroundColor: filter?.color || "#6b7280" }}
                          >
                            {filter?.label || tag}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <a
                    href={`/${citySlug}/neighborhoods/${hub.slug}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                    data-testid={`popup-explore-${hub.code}`}
                  >
                    <Navigation className="w-3 h-3" />
                    Explore This Neighborhood
                  </a>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}

export { LIFESTYLE_FILTERS };
