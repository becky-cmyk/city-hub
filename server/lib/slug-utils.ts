import { storage } from "../storage";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 100);
}

function extractStreetName(address: string | null | undefined): string | null {
  if (!address) return null;
  const match = address.match(/^\d+\s+(.+?)(?:,|\s+(?:suite|ste|apt|unit|#)\b)/i)
    || address.match(/^\d+\s+(.+?)(?:,)/i);
  if (!match) return null;
  const street = slugify(match[1].trim());
  return street && street.length >= 2 ? street : null;
}

function alphaRandom(len: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  let result = "";
  for (let i = 0; i < len; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export { slugify };

export async function generateBusinessSlug(
  name: string,
  cityId: string,
  options?: {
    hubSlug?: string | null;
    zoneId?: string | null;
    address?: string | null;
    cityName?: string | null;
  }
): Promise<string> {
  const baseSlug = slugify(name);
  if (!baseSlug) return alphaRandom(8);

  const existing = await storage.getBusinessBySlug(cityId, baseSlug);
  if (!existing) return baseSlug;

  let hubSlug = options?.hubSlug || null;

  if (!hubSlug && options?.zoneId) {
    try {
      const zone = await storage.getZoneById(options.zoneId);
      if (zone?.slug) hubSlug = zone.slug;
    } catch {}
  }

  if (hubSlug) {
    const withHub = `${baseSlug}-${hubSlug}`;
    const existingWithHub = await storage.getBusinessBySlug(cityId, withHub);
    if (!existingWithHub) return withHub;

    const street = extractStreetName(options?.address);
    if (street) {
      const withStreet = `${baseSlug}-${hubSlug}-${street}`;
      const existingWithStreet = await storage.getBusinessBySlug(cityId, withStreet);
      if (!existingWithStreet) return withStreet;
    }
  }

  if (options?.cityName) {
    const citySlugPart = slugify(options.cityName);
    if (citySlugPart) {
      const withCity = `${baseSlug}-${citySlugPart}`;
      const existingWithCity = await storage.getBusinessBySlug(cityId, withCity);
      if (!existingWithCity) return withCity;
    }
  }

  const suffix = alphaRandom(4);
  return `${baseSlug}-${hubSlug || "local"}-${suffix}`;
}

export async function generateEventSlug(
  title: string,
  cityId: string,
  options?: {
    startDate?: string | Date | null;
    venueName?: string | null;
    zoneName?: string | null;
  }
): Promise<string> {
  const baseSlug = slugify(title);
  if (!baseSlug) return `event-${alphaRandom(6)}`;

  const existing = await storage.getEventBySlug(cityId, baseSlug);
  if (!existing) return baseSlug;

  if (options?.startDate) {
    const d = typeof options.startDate === "string" ? new Date(options.startDate) : options.startDate;
    if (!isNaN(d.getTime())) {
      const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
      const dateSlug = `${baseSlug}-${monthNames[d.getMonth()]}-${d.getFullYear()}`;
      const existingDate = await storage.getEventBySlug(cityId, dateSlug);
      if (!existingDate) return dateSlug;
    }
  }

  if (options?.venueName) {
    const venueSlug = slugify(options.venueName);
    if (venueSlug) {
      const withVenue = `${baseSlug}-${venueSlug}`.substring(0, 120);
      const existingVenue = await storage.getEventBySlug(cityId, withVenue);
      if (!existingVenue) return withVenue;
    }
  }

  if (options?.zoneName) {
    const zoneSlugPart = slugify(options.zoneName);
    if (zoneSlugPart) {
      const withZone = `${baseSlug}-${zoneSlugPart}`;
      const existingZone = await storage.getEventBySlug(cityId, withZone);
      if (!existingZone) return withZone;
    }
  }

  for (let i = 0; i < 10; i++) {
    const suffix = alphaRandom(4);
    const candidate = `${baseSlug}-${suffix}`;
    const collision = await storage.getEventBySlug(cityId, candidate);
    if (!collision) return candidate;
  }
  return `${baseSlug}-${alphaRandom(6)}`;
}
