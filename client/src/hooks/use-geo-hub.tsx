import { useState, useEffect } from "react";

interface GeoHub {
  name: string;
  code: string;
  slug: string;
  centerLat: string;
  centerLng: string;
  description: string | null;
}

interface GeoHubResult {
  nearestHub: GeoHub | null;
  county: string | null;
  distanceMiles: number | null;
  isLocating: boolean;
  permissionDenied: boolean;
}

export function useGeoHub(citySlug: string): GeoHubResult {
  const sessionKey = `cch_geo_hub:${citySlug}`;
  const [result, setResult] = useState<GeoHubResult>({
    nearestHub: null,
    county: null,
    distanceMiles: null,
    isLocating: true,
    permissionDenied: false,
  });

  useEffect(() => {
    const cached = sessionStorage.getItem(sessionKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setResult({ ...parsed, isLocating: false });
        return;
      } catch {}
    }

    if (!navigator.geolocation) {
      setResult(prev => ({ ...prev, isLocating: false }));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await fetch(`/api/cities/${citySlug}/nearest-hub?lat=${latitude}&lng=${longitude}`);
          if (!res.ok) throw new Error("API error");
          const data = await res.json();
          const final = {
            nearestHub: data.hub || null,
            county: data.county || null,
            distanceMiles: data.distanceMiles ?? null,
            isLocating: false,
            permissionDenied: false,
          };
          sessionStorage.setItem(sessionKey, JSON.stringify(final));
          setResult(final);
        } catch {
          setResult(prev => ({ ...prev, isLocating: false }));
        }
      },
      () => {
        setResult(prev => ({ ...prev, isLocating: false, permissionDenied: true }));
      },
      { timeout: 8000, maximumAge: 300000 }
    );
  }, [citySlug]);

  return result;
}
