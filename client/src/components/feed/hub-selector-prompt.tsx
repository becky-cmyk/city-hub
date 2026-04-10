import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Navigation, Search, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

interface HubWithCoords {
  id: string;
  slug: string;
  label: string;
  code: string | null;
  countyName: string | null;
  centerLat: string | null;
  centerLng: string | null;
}

interface HubSelectorPromptProps {
  citySlug: string;
  onHubSelected: (slug: string | undefined) => void;
  onDismiss: () => void;
}

const POPULAR_HUBS = [
  "uptown", "noda", "southend", "plazamidwood", "dilworth",
  "southpark", "ballantyne", "huntersville", "matthews", "concord",
];

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findNearestHub(lat: number, lng: number, hubs: HubWithCoords[]): HubWithCoords | null {
  let nearest: HubWithCoords | null = null;
  let minDist = Infinity;
  for (const hub of hubs) {
    if (!hub.centerLat || !hub.centerLng) continue;
    const dist = haversineDistance(lat, lng, parseFloat(hub.centerLat), parseFloat(hub.centerLng));
    if (dist < minDist) {
      minDist = dist;
      nearest = hub;
    }
  }
  return nearest;
}

export function HubSelectorPrompt({ citySlug, onHubSelected, onDismiss }: HubSelectorPromptProps) {
  const [search, setSearch] = useState("");
  const [detecting, setDetecting] = useState(false);
  const { t } = useI18n();

  const { data } = useQuery<{ flat: HubWithCoords[] }>({
    queryKey: [`/api/feed/neighborhoods?citySlug=${citySlug}`],
  });

  const allHubs = data?.flat || [];

  const popular = POPULAR_HUBS
    .map(slug => allHubs.find(h => h.slug === slug))
    .filter(Boolean) as HubWithCoords[];

  const filtered = search
    ? allHubs.filter(h => h.label.toLowerCase().includes(search.toLowerCase()) || (h.countyName && h.countyName.toLowerCase().includes(search.toLowerCase())))
    : [];

  const handleSelectHub = useCallback((slug: string) => {
    localStorage.setItem("clt_hub_preference", slug);
    onHubSelected(slug);
  }, [onHubSelected]);

  const handleSkip = useCallback(() => {
    localStorage.setItem("clt_hub_preference", "__metro__");
    onDismiss();
  }, [onDismiss]);

  const handleUseLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const nearest = findNearestHub(pos.coords.latitude, pos.coords.longitude, allHubs);
        setDetecting(false);
        if (nearest) {
          handleSelectHub(nearest.slug);
        }
      },
      () => {
        setDetecting(false);
      },
      { timeout: 10000 }
    );
  }, [allHubs, handleSelectHub]);

  return (
    <>
      <div className="fixed inset-0 z-[70] bg-black/60" />
      <div className="fixed inset-x-0 bottom-0 z-[70] sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-md sm:w-full" data-testid="hub-selector-prompt">
        <div className="rounded-t-2xl sm:rounded-2xl bg-gray-900 border border-white/10 shadow-2xl max-h-[85vh] flex flex-col">
          <div className="p-5 pb-3 flex-shrink-0">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold text-white" data-testid="text-hub-prompt-title">
                {t("hubPrompt.title")}
              </h2>
              <button
                onClick={handleSkip}
                className="rounded-full p-1.5 text-white/40 transition-colors"
                data-testid="hub-prompt-close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-white/60" data-testid="text-hub-prompt-subtitle">
              {t("hubPrompt.subtitle")}
            </p>
          </div>

          <div className="px-5 pb-3 flex-shrink-0">
            <Button
              variant="outline"
              className="w-full border-purple-500/40 text-purple-300 font-semibold"
              onClick={handleUseLocation}
              disabled={detecting}
              data-testid="hub-prompt-use-location"
            >
              {detecting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Navigation className="h-4 w-4 mr-2" />
              )}
              {detecting ? t("hubPrompt.detecting") : t("hubPrompt.useLocation")}
            </Button>
          </div>

          <div className="px-5 pb-2 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
              <input
                type="text"
                placeholder={t("hubPrompt.searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg bg-white/5 border border-white/10 px-8 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-purple-500/50"
                data-testid="hub-prompt-search"
              />
              {search && (
                <button className="absolute right-2.5 top-1/2 -translate-y-1/2" onClick={() => setSearch("")} data-testid="hub-prompt-search-clear">
                  <X className="h-3.5 w-3.5 text-white/40" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-3 min-h-0">
            {search ? (
              <div className="space-y-1">
                {filtered.length === 0 && (
                  <p className="text-sm text-white/40 text-center py-4">{t("hubPrompt.noResults")}</p>
                )}
                {filtered.map((hub) => (
                  <button
                    key={hub.id}
                    className="w-full text-left rounded-lg px-3 py-2.5 text-sm font-medium text-white/80 transition-colors hover-elevate flex items-center gap-2"
                    onClick={() => handleSelectHub(hub.slug)}
                    data-testid={`hub-prompt-option-${hub.slug}`}
                  >
                    <MapPin className="h-3.5 w-3.5 text-purple-400 flex-shrink-0" />
                    <span>{hub.label}</span>
                    {hub.countyName && <span className="text-[10px] text-white/30 ml-auto">{hub.countyName}</span>}
                  </button>
                ))}
              </div>
            ) : (
              <>
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/30 mb-2 mt-1">
                  {t("hubPrompt.popularHubs")}
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {popular.map((hub) => (
                    <button
                      key={hub.id}
                      className="rounded-lg bg-white/5 px-3 py-2.5 text-sm font-medium text-white/80 text-left transition-colors hover-elevate flex items-center gap-2"
                      onClick={() => handleSelectHub(hub.slug)}
                      data-testid={`hub-prompt-option-${hub.slug}`}
                    >
                      <MapPin className="h-3.5 w-3.5 text-purple-400 flex-shrink-0" />
                      {hub.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="p-5 pt-2 border-t border-white/10 flex-shrink-0">
            <button
              className="w-full text-center text-sm text-white/50 font-medium py-2"
              onClick={handleSkip}
              data-testid="hub-prompt-skip"
            >
              {t("hubPrompt.skip")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
