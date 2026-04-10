export interface AffiliateConfig {
  platform: string;
  affiliateId: string | null;
  enabled: boolean;
}

export function buildUberRideLink(lat: number, lng: number, destinationName: string, affiliateId?: string | null): string {
  const params = new URLSearchParams({
    action: "setPickup",
    "dropoff[latitude]": lat.toString(),
    "dropoff[longitude]": lng.toString(),
    "dropoff[nickname]": destinationName,
  });
  if (affiliateId) params.set("client_id", affiliateId);
  return `https://m.uber.com/ul/?${params.toString()}`;
}

export function buildLyftRideLink(lat: number, lng: number, affiliateId?: string | null): string {
  const params = new URLSearchParams({
    id: "lyft",
    "destination[latitude]": lat.toString(),
    "destination[longitude]": lng.toString(),
  });
  if (affiliateId) params.set("partner", affiliateId);
  return `https://lyft.com/ride?${params.toString()}`;
}

export function wrapAffiliateLink(platform: string, rawUrl: string, affiliateId?: string | null): string {
  if (!affiliateId || !rawUrl) return rawUrl;
  try {
    const url = new URL(rawUrl);
    url.searchParams.set("utm_source", affiliateId);
    url.searchParams.set("utm_medium", "referral");
    url.searchParams.set("utm_campaign", "clt_metro_hub");
    return url.toString();
  } catch {
    return rawUrl;
  }
}

export function getAffiliateId(configs: AffiliateConfig[], platform: string): string | null {
  const config = configs.find(c => c.platform === platform && c.enabled);
  return config?.affiliateId || null;
}
