const geocodeCache = new Map<string, { lat: number; lng: number; ts: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000;

export function toFiniteCoord(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

export function hasValidCoords(lat: unknown, lng: unknown): boolean {
  return toFiniteCoord(lat) !== null && toFiniteCoord(lng) !== null;
}

function getGoogleApiKey(): string | null {
  return process.env.GOOGLE_MAPS_API_KEY || process.env.googel_API_Places || process.env.GOOGLE_PLACES_API_KEY || null;
}

export async function geocodeAddress(address: string): Promise<{ latitude: string; longitude: string } | null> {
  if (!address || address.trim().length < 5) return null;

  const normalized = address.trim().toLowerCase();
  const cached = geocodeCache.get(normalized);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return { latitude: String(cached.lat), longitude: String(cached.lng) };
  }

  const apiKey = getGoogleApiKey();
  if (!apiKey) {
    console.warn("[Geocoding] No Google API key configured, skipping geocode");
    return null;
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    interface GeoResult { status: string; results: Array<{ geometry: { location: { lat: number; lng: number } } }> }
    const data: GeoResult = await resp.json();

    if (data.status === "OK" && data.results?.length > 0) {
      const loc = data.results[0].geometry.location;
      geocodeCache.set(normalized, { lat: loc.lat, lng: loc.lng, ts: Date.now() });

      if (geocodeCache.size > 5000) {
        const entries = [...geocodeCache.entries()];
        entries.sort((a, b) => a[1].ts - b[1].ts);
        for (let i = 0; i < 1000; i++) {
          geocodeCache.delete(entries[i][0]);
        }
      }

      return { latitude: String(loc.lat), longitude: String(loc.lng) };
    }

    if (data.status === "ZERO_RESULTS") return null;
    console.warn(`[Geocoding] API returned status: ${data.status} for address: ${address.substring(0, 60)}`);
    return null;
  } catch (err) {
    console.error("[Geocoding] Failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function geocodeFromParts(parts: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  locationName?: string | null;
}): Promise<{ latitude: string; longitude: string } | null> {
  const segments = [parts.address, parts.city, parts.state, parts.zip].filter(Boolean);
  if (segments.length >= 2) {
    const result = await geocodeAddress(segments.join(", "));
    if (result) return result;
  }

  if (parts.locationName && parts.city) {
    const result = await geocodeAddress(`${parts.locationName}, ${parts.city}, ${parts.state || ""}`);
    if (result) return result;
  }

  return null;
}

export async function getZoneCentroid(zoneId: string): Promise<{ latitude: string; longitude: string } | null> {
  try {
    const { pool } = await import("../db");
    const result = await pool.query(
      `SELECT r.center_lat, r.center_lng
       FROM zones z
       INNER JOIN regions r ON LOWER(r.name) = LOWER(z.name)
       WHERE z.id = $1 AND r.center_lat IS NOT NULL AND r.center_lng IS NOT NULL
       LIMIT 1`,
      [zoneId]
    );
    if (result.rows.length > 0) {
      return {
        latitude: String(result.rows[0].center_lat),
        longitude: String(result.rows[0].center_lng),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function getBusinessCoordinates(businessId: string): Promise<{ latitude: string; longitude: string } | null> {
  try {
    const { pool } = await import("../db");
    const result = await pool.query(
      `SELECT latitude, longitude FROM businesses WHERE id = $1 AND latitude IS NOT NULL AND longitude IS NOT NULL LIMIT 1`,
      [businessId]
    );
    if (result.rows.length > 0) {
      return {
        latitude: String(result.rows[0].latitude),
        longitude: String(result.rows[0].longitude),
      };
    }
    return null;
  } catch {
    return null;
  }
}
