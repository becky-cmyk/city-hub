import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";

interface GeoZone {
  zoneId: string | null;
  zoneName: string | null;
  zoneSlug: string | null;
  hubSlug: string | null;
  hubName: string | null;
}

interface HubContextState {
  activeZoneId: string | null;
  activeZoneName: string | null;
  isInDifferentZone: boolean;
  detectedZone: GeoZone | null;
  homeZoneId: string | null;
  homeZoneName: string | null;
  isDetecting: boolean;
  dismissed: boolean;
  tempZoneActive: boolean;
  switchToDetectedZone: () => void;
  switchBackToHomeZone: () => void;
  dismissBanner: () => void;
  requestLocation: () => void;
}

export function useHubContext(citySlug: string): HubContextState {
  const { user } = useAuth();

  // State for detected geolocation zone
  const [detectedZone, setDetectedZone] = useState<GeoZone | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [tempZoneActive, setTempZoneActive] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("hub_banner_dismissed") === "true";
  });

  // Derive home zone from user's HOME hub
  const homeHub = user?.hubs?.find((h: any) => h.hubType === "HOME");
  const homeZone: GeoZone = {
    zoneId: homeHub?.zoneId ? String(homeHub.zoneId) : null,
    zoneName: (homeHub?.neighborhood || null) as string | null,
    zoneSlug: null,
  };

  // Determine active zone: temp zone if active, otherwise home zone
  const activeZoneId = tempZoneActive
    ? detectedZone?.zoneId || null
    : homeZone.zoneId;
  const activeZoneName = tempZoneActive
    ? detectedZone?.zoneName || null
    : homeZone.zoneName;

  // Check if user is in a different zone than home
  const isInDifferentZone =
    !tempZoneActive &&
    homeZone.zoneId !== null &&
    detectedZone?.zoneId !== null &&
    detectedZone?.zoneId !== homeZone.zoneId;

  // Resolve geolocation to a zone
  const resolveGeoToZone = useCallback(
    async (lat: number, lng: number) => {
      try {
        const params = new URLSearchParams({
          lat: lat.toString(),
          lng: lng.toString(),
          citySlug,
        });
        const response = await fetch(
          `/api/zones/geo-resolve?${params.toString()}`
        );
        if (!response.ok) return;

        const data = await response.json();
        setDetectedZone({
          zoneId: data.nearestZoneId ? String(data.nearestZoneId) : null,
          zoneName: data.nearestZoneName || null,
          zoneSlug: data.nearestZoneSlug || null,
          hubSlug: data.hubSlug || null,
          hubName: data.hubName || null,
        });
      } catch (error) {
        // Silently handle errors - geolocation is optional
        console.debug("Failed to resolve geolocation to zone:", error);
      }
    },
    [citySlug]
  );

  // Request geolocation with error handling
  const requestLocation = useCallback(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      return;
    }

    setIsDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        try {
          localStorage.setItem("hub_user_coords", JSON.stringify({ lat: latitude, lng: longitude, ts: Date.now() }));
        } catch {}
        resolveGeoToZone(latitude, longitude);
        setIsDetecting(false);
      },
      () => {
        setIsDetecting(false);
      },
      {
        timeout: 5000,
        enableHighAccuracy: false,
      }
    );
  }, [resolveGeoToZone]);

  // Auto-request geolocation on mount (only once, persisted across sessions)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const alreadyChecked = localStorage.getItem("hub_geo_checked") === "true";
    if (!alreadyChecked) {
      localStorage.setItem("hub_geo_checked", "true");
      requestLocation();
    }
  }, [requestLocation]);

  const switchToDetectedZone = () => {
    setTempZoneActive(true);
  };

  const switchBackToHomeZone = () => {
    setTempZoneActive(false);
  };

  const dismissBanner = () => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("hub_banner_dismissed", "true");
    }
  };

  return {
    activeZoneId,
    activeZoneName,
    isInDifferentZone: dismissed ? false : isInDifferentZone,
    detectedZone,
    homeZoneId: homeZone.zoneId,
    homeZoneName: homeZone.zoneName,
    isDetecting,
    dismissed,
    tempZoneActive,
    switchToDetectedZone,
    switchBackToHomeZone,
    dismissBanner,
    requestLocation,
  };
}
