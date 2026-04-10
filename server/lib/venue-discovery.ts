import { db } from "../db";
import { businesses, zones, categories, listingsToClaimQueue } from "@shared/schema";
import { eq, ilike, and, sql } from "drizzle-orm";
import { storage } from "../storage";
import { generateBusinessSlug } from "./slug-utils";
import {
  textSearchPlaces,
  fetchPlaceDetails,
  matchZoneForAddress,
  googlePlacePhotoUrl,
  mapGoogleTypesToCategories,
  aiFallbackCategorize,
  isVenueScreenLikelyFromGoogleTypes,
} from "../google-places";
import { queueTranslation } from "../services/auto-translate";

function extractZipFromAddress(address: string): string | null {
  const match = address.match(/\b(\d{5})(?:-\d{4})?\b/);
  return match ? match[1] : null;
}

function parseHours(weekdayText?: string[]): Record<string, string> | undefined {
  if (!weekdayText || weekdayText.length === 0) return undefined;
  const hours: Record<string, string> = {};
  for (const line of weekdayText) {
    const parts = line.split(": ");
    if (parts.length >= 2) hours[parts[0].trim()] = parts.slice(1).join(": ").trim();
  }
  return hours;
}

function normalizeForMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function fuzzyMatch(a: string, b: string): boolean {
  const na = normalizeForMatch(a);
  const nb = normalizeForMatch(b);
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  if (na.length > 5 && nb.length > 5) {
    const shorter = na.length <= nb.length ? na : nb;
    const longer = na.length > nb.length ? na : nb;
    if (longer.startsWith(shorter) || longer.endsWith(shorter)) return true;
  }
  return false;
}

export interface ResolveVenueResult {
  businessId: string;
  created: boolean;
  name: string;
}

export async function resolveOrCreateVenuePresence(
  venueName: string,
  address: string | null,
  city: string,
  state: string,
  cityId: string,
): Promise<ResolveVenueResult | null> {
  try {
    const trimmedName = venueName.trim();
    if (trimmedName.length < 3) {
      console.log(`[VenueDiscovery] Skipping venue with too-short name: "${venueName}"`);
      return null;
    }

    const existingByName = await db
      .select()
      .from(businesses)
      .where(and(eq(businesses.cityId, cityId), ilike(businesses.name, venueName)))
      .limit(5);

    for (const biz of existingByName) {
      if (fuzzyMatch(biz.name, venueName)) {
        await backfillMissingGeoFields(biz, address);
        return { businessId: biz.id, created: false, name: biz.name };
      }
    }

    const fuzzyRows = await db
      .select()
      .from(businesses)
      .where(and(eq(businesses.cityId, cityId), ilike(businesses.name, `%${venueName.substring(0, 20)}%`)))
      .limit(10);

    for (const biz of fuzzyRows) {
      if (fuzzyMatch(biz.name, venueName)) {
        await backfillMissingGeoFields(biz, address);
        return { businessId: biz.id, created: false, name: biz.name };
      }
    }

    let searchQuery = venueName;
    if (city) searchQuery += ` ${city}`;
    if (state) searchQuery += ` ${state}`;

    let placeResults;
    try {
      placeResults = await textSearchPlaces(searchQuery, 3, { skipDailyLimit: false });
    } catch (searchErr: unknown) {
      console.warn(`[VenueDiscovery] Google Places search failed for "${venueName}":`, searchErr instanceof Error ? searchErr.message : searchErr);
      return null;
    }

    if (!placeResults || placeResults.length === 0) {
      console.log(`[VenueDiscovery] No Google Places results for "${venueName}"`);
      return null;
    }

    const bestMatch = placeResults.find(p => fuzzyMatch(p.name, venueName)) || placeResults[0];

    const existingByPlaceId = await db
      .select()
      .from(businesses)
      .where(eq(businesses.googlePlaceId, bestMatch.place_id))
      .limit(1);

    if (existingByPlaceId.length > 0) {
      const existing = existingByPlaceId[0];
      await backfillMissingGeoFields(existing, bestMatch.formatted_address || address);
      return { businessId: existing.id, created: false, name: existing.name };
    }

    let details;
    try {
      details = await fetchPlaceDetails(bestMatch.place_id, { skipDailyLimit: false });
    } catch (detailsErr: unknown) {
      console.warn(`[VenueDiscovery] Google Places details failed for "${venueName}":`, detailsErr instanceof Error ? detailsErr.message : detailsErr);
      return null;
    }

    const formattedAddress = details.formatted_address || bestMatch.formatted_address || address || "";
    const extractedZip = formattedAddress ? extractZipFromAddress(formattedAddress) : null;

    const matchedZoneId = formattedAddress
      ? await matchZoneForAddress(formattedAddress, cityId)
      : null;

    const allZones = await storage.getZonesByCityId(cityId);
    const defaultZone = allZones[0];

    if (!defaultZone) {
      console.warn(`[VenueDiscovery] No zones found for city ${cityId}, cannot create presence`);
      return null;
    }

    const assignedZoneId = matchedZoneId || defaultZone.id;
    const needsZoneReview = !matchedZoneId;

    const matchedZone = allZones.find((z: Record<string, unknown>) => z.id === assignedZoneId) as Record<string, unknown> | undefined;
    const derivedCounty = matchedZone?.county as string | null || null;

    if (needsZoneReview) {
      console.warn(`[VenueDiscovery] No ZIP-zone match for "${details.name || venueName}" ZIP=${extractedZip || "none"} — assigned fallback zone, flagged for review`);
    }

    let photoImageUrl: string | null = null;
    let photoAttr: string | null = null;
    if (details.photos && details.photos.length > 0) {
      const firstPhoto = details.photos[0];
      photoImageUrl = googlePlacePhotoUrl(firstPhoto.photo_reference, 800);
      if (firstPhoto.html_attributions && firstPhoto.html_attributions.length > 0) {
        photoAttr = firstPhoto.html_attributions.join("; ");
      }
    }

    let resolvedCategoryIds: string[] = [];
    let venueScreenLikely = false;
    if (details.types && details.types.length > 0) {
      let { l2Slugs } = mapGoogleTypesToCategories(details.types);
      if (l2Slugs.length === 0) {
        l2Slugs = await aiFallbackCategorize(details.name || venueName, details.types);
      }
      if (l2Slugs.length > 0) {
        const allCategories = await db.select().from(categories);
        resolvedCategoryIds = allCategories
          .filter((c: Record<string, unknown>) => l2Slugs.includes(c.slug as string))
          .map((c: Record<string, unknown>) => c.id as string);
      }
      venueScreenLikely = isVenueScreenLikelyFromGoogleTypes(details.types);
    }

    const slug = await generateBusinessSlug(details.name || venueName, cityId, {
      zoneId: assignedZoneId,
      address: formattedAddress,
      cityName: city || null,
    });

    const presence = await storage.createBusiness({
      cityId,
      zoneId: assignedZoneId,
      name: details.name || venueName,
      slug,
      description: null,
      address: formattedAddress || null,
      city: city || "Charlotte",
      state: state || "NC",
      zip: extractedZip || null,
      phone: details.formatted_phone_number || null,
      websiteUrl: details.website || null,
      hoursOfOperation: parseHours(details.opening_hours?.weekday_text) || null,
      googlePlaceId: bestMatch.place_id,
      googleRating: details.rating?.toString() || null,
      googleReviewCount: details.user_ratings_total || null,
      latitude: details.geometry?.location.lat?.toString() || null,
      longitude: details.geometry?.location.lng?.toString() || null,
      claimStatus: "UNCLAIMED",
      micrositeTier: "none",
      listingTier: "FREE",
      presenceStatus: "ACTIVE",
      presenceStatus2: "DRAFT",
      categoryIds: resolvedCategoryIds,
      tagIds: [],
      venueScreenLikely,
      needsZoneReview,
      seedSourceType: "venue_discovery",
      ...(photoImageUrl ? { imageUrl: photoImageUrl, photoAttribution: photoAttr } : {}),
    });

    queueTranslation("business", presence.id);

    try {
      await storage.createPresencePlacesSource({
        presenceId: presence.id,
        placeId: bestMatch.place_id,
      });
    } catch (ppsErr: unknown) {
      console.warn(`[VenueDiscovery] Failed to create places source for "${venueName}":`, ppsErr instanceof Error ? ppsErr.message : ppsErr);
    }

    try {
      await db.insert(listingsToClaimQueue).values({
        presenceId: presence.id,
        source: "google_places",
        status: "ready",
        notes: `Auto-discovered from venue extraction: "${venueName}"`,
      });
    } catch (claimErr: unknown) {
      console.warn(`[VenueDiscovery] Failed to enqueue claim for "${venueName}":`, claimErr instanceof Error ? claimErr.message : claimErr);
    }

    console.log(`[VenueDiscovery] Created presence "${details.name || venueName}" (${presence.id}) zone=${matchedZone?.slug || "default"} zip=${extractedZip || "none"} county=${derivedCounty || "none"}`);

    return { businessId: presence.id, created: true, name: details.name || venueName };
  } catch (error: unknown) {
    console.error(`[VenueDiscovery] Error resolving venue "${venueName}":`, error instanceof Error ? error.message : error);
    return null;
  }
}

async function backfillMissingGeoFields(biz: Record<string, unknown>, address: string | null): Promise<void> {
  try {
    const updates: Record<string, unknown> = {};
    const bizAddress = (address || biz.address) as string | null;

    if (!biz.zip && bizAddress) {
      const zip = extractZipFromAddress(bizAddress);
      if (zip) updates.zip = zip;
    }

    if (biz.needsZoneReview && bizAddress) {
      const newZoneId = await matchZoneForAddress(bizAddress, biz.cityId as string);
      if (newZoneId && newZoneId !== biz.zoneId) {
        updates.zoneId = newZoneId;
        updates.needsZoneReview = false;
      }
    }

    if (Object.keys(updates).length > 0) {
      updates.updatedAt = new Date();
      await db.update(businesses).set(updates).where(eq(businesses.id, biz.id as string));
      console.log(`[VenueDiscovery] Backfilled geo fields for "${biz.name}": ${Object.keys(updates).join(", ")}`);
    }
  } catch (err: unknown) {
    console.error(`[VenueDiscovery] Geo backfill error for "${biz.name}":`, err instanceof Error ? err.message : err);
  }
}

export async function backfillBusinessGeo(businessId: string): Promise<boolean> {
  try {
    const [biz] = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
    if (!biz) return false;

    const updates: Record<string, unknown> = {};
    let bizAddress = biz.address as string | null;
    const bizGooglePlaceId = biz.googlePlaceId as string | null;

    if ((!bizAddress || !biz.zip) && bizGooglePlaceId) {
      try {
        const details = await fetchPlaceDetails(bizGooglePlaceId, { skipDailyLimit: false });
        if (details) {
          if (!bizAddress && details.formatted_address) {
            bizAddress = details.formatted_address;
            updates.address = details.formatted_address;
          }
          if (!biz.zip && details.formatted_address) {
            const zip = extractZipFromAddress(details.formatted_address);
            if (zip) updates.zip = zip;
          }
          if (details.geometry?.location) {
            if (!biz.latitude) updates.latitude = String(details.geometry.location.lat);
            if (!biz.longitude) updates.longitude = String(details.geometry.location.lng);
          }
        }
      } catch (placeErr: unknown) {
        console.warn(`[VenueDiscovery] Google Place details fetch failed for ${businessId}:`, placeErr instanceof Error ? placeErr.message : placeErr);
      }
    }

    if (!biz.zip && !updates.zip && bizAddress) {
      const zip = extractZipFromAddress(bizAddress);
      if (zip) updates.zip = zip;
    }

    if (bizAddress) {
      const newZoneId = await matchZoneForAddress(bizAddress, biz.cityId);
      if (newZoneId && (biz.needsZoneReview || newZoneId !== biz.zoneId)) {
        updates.zoneId = newZoneId;
        updates.needsZoneReview = false;
      }
    }

    if (Object.keys(updates).length > 0) {
      updates.updatedAt = new Date();
      await db.update(businesses).set(updates).where(eq(businesses.id, businessId));
      return true;
    }
    return false;
  } catch (err: unknown) {
    console.error(`[VenueDiscovery] Geo backfill error for business ${businessId}:`, err instanceof Error ? err.message : err);
    return false;
  }
}
