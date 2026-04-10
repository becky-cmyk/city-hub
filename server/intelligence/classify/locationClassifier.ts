import { db } from "../../db";
import {
  businesses,
  sourceRawRows,
  entityContactVerification,
  entityLocationProfile,
} from "@shared/schema";
import { eq, sql } from "drizzle-orm";

type LocationType = "STOREFRONT" | "OFFICE" | "HOME_BASED" | "VIRTUAL" | "UNKNOWN";
type AddressQuality = "HIGH" | "MED" | "LOW" | "UNKNOWN";
type LandUseClass = "COMMERCIAL" | "RESIDENTIAL" | "MIXED" | "INDUSTRIAL" | "UNKNOWN";

interface ClassificationSignal {
  source: string;
  locationType: LocationType;
  confidence: number;
}

interface AddressTypeFlags {
  PO_BOX: boolean;
  SUITE: boolean;
  UNIT: boolean;
  RESIDENTIAL_HINT: boolean;
  COMMERCIAL_HINT: boolean;
}

const STOREFRONT_AMENITIES = new Set([
  "restaurant", "cafe", "bar", "pub", "fast_food", "food_court",
  "ice_cream", "biergarten", "pharmacy", "fuel", "car_repair",
  "car_wash", "bicycle_rental", "bank", "atm", "bureau_de_change",
  "marketplace", "post_office", "dentist", "doctors", "hospital",
  "clinic", "veterinary", "cinema", "theatre", "nightclub",
  "casino", "gym", "swimming_pool",
]);

const STOREFRONT_TOURISM = new Set([
  "hotel", "motel", "hostel", "guest_house", "attraction",
  "museum", "gallery", "theme_park", "zoo", "aquarium",
]);

const STOREFRONT_LEISURE = new Set([
  "fitness_centre", "sports_centre", "bowling_alley",
  "amusement_arcade", "escape_game", "miniature_golf",
]);

function classifyFromOsmTags(tags: Record<string, any>): ClassificationSignal | null {
  if (tags["shop"]) {
    return { source: "osm_shop", locationType: "STOREFRONT", confidence: 85 };
  }

  if (tags["amenity"]) {
    const amenity = tags["amenity"] as string;
    if (STOREFRONT_AMENITIES.has(amenity)) {
      return { source: `osm_amenity_${amenity}`, locationType: "STOREFRONT", confidence: 85 };
    }
    if (amenity === "place_of_worship" || amenity === "community_centre" || amenity === "library") {
      return { source: `osm_amenity_${amenity}`, locationType: "STOREFRONT", confidence: 75 };
    }
  }

  if (tags["office"]) {
    return { source: "osm_office", locationType: "OFFICE", confidence: 75 };
  }

  if (tags["tourism"]) {
    const tourism = tags["tourism"] as string;
    if (STOREFRONT_TOURISM.has(tourism)) {
      return { source: `osm_tourism_${tourism}`, locationType: "STOREFRONT", confidence: 75 };
    }
  }

  if (tags["leisure"]) {
    const leisure = tags["leisure"] as string;
    if (STOREFRONT_LEISURE.has(leisure)) {
      return { source: `osm_leisure_${leisure}`, locationType: "STOREFRONT", confidence: 75 };
    }
  }

  if (tags["craft"]) {
    return { source: "osm_craft", locationType: "STOREFRONT", confidence: 70 };
  }

  if (tags["healthcare"]) {
    return { source: "osm_healthcare", locationType: "OFFICE", confidence: 70 };
  }

  return null;
}

function getOsmPlaceClass(tags: Record<string, any>): string | null {
  for (const key of ["amenity", "shop", "office", "leisure", "tourism", "craft", "healthcare"]) {
    if (tags[key]) return `${key}=${tags[key]}`;
  }
  return null;
}

function analyzeAddress(address: string | null): {
  flags: AddressTypeFlags;
  signal: ClassificationSignal | null;
  quality: AddressQuality;
} {
  const flags: AddressTypeFlags = {
    PO_BOX: false,
    SUITE: false,
    UNIT: false,
    RESIDENTIAL_HINT: false,
    COMMERCIAL_HINT: false,
  };

  if (!address) {
    return { flags, signal: null, quality: "UNKNOWN" };
  }

  const upper = address.toUpperCase();

  if (/P\.?\s*O\.?\s*BOX/i.test(upper) || /PO\s+BOX/i.test(upper)) {
    flags.PO_BOX = true;
  }

  if (/\bSUITE\b|\bSTE\b|\b#\d+/i.test(upper)) {
    flags.SUITE = true;
    flags.COMMERCIAL_HINT = true;
  }

  if (/\bUNIT\b/i.test(upper)) {
    flags.UNIT = true;
  }

  if (/\bAPT\b|\bAPARTMENT\b|\bLOT\b|\bTRAILER\b/i.test(upper)) {
    flags.RESIDENTIAL_HINT = true;
  }

  if (/\bPLAZA\b|\bCENTER\b|\bCENTRE\b|\bMALL\b|\bTOWER\b|\bCOMPLEX\b/i.test(upper)) {
    flags.COMMERCIAL_HINT = true;
  }

  let signal: ClassificationSignal | null = null;

  if (flags.PO_BOX) {
    signal = { source: "address_po_box", locationType: "HOME_BASED", confidence: 70 };
  } else if (flags.RESIDENTIAL_HINT && !flags.COMMERCIAL_HINT) {
    signal = { source: "address_residential", locationType: "HOME_BASED", confidence: 65 };
  } else if (flags.COMMERCIAL_HINT) {
    signal = { source: "address_commercial", locationType: "OFFICE", confidence: 55 };
  }

  let quality: AddressQuality = "UNKNOWN";
  if (flags.PO_BOX) {
    quality = "LOW";
  } else if (address.length > 10 && /\d/.test(address)) {
    quality = flags.RESIDENTIAL_HINT ? "MED" : "HIGH";
  } else {
    quality = "MED";
  }

  return { flags, signal, quality };
}

function classifyFromWebsiteCues(verification: any): ClassificationSignal | null {
  if (!verification) return null;

  const textsToCheck: string[] = [];
  if (verification.pageTitle) textsToCheck.push(verification.pageTitle);
  if (verification.detectedName) textsToCheck.push(verification.detectedName);
  if (verification.notes) textsToCheck.push(verification.notes);

  const combined = textsToCheck.join(" ").toLowerCase();

  const virtualKeywords = ["virtual", "online only", "remote", "we come to you", "mobile service"];
  const homeKeywords = ["home-based", "home based", "by appointment only"];

  for (const kw of virtualKeywords) {
    if (combined.includes(kw)) {
      return { source: `website_cue_${kw.replace(/\s+/g, "_")}`, locationType: "VIRTUAL", confidence: 60 };
    }
  }

  for (const kw of homeKeywords) {
    if (combined.includes(kw)) {
      return { source: `website_cue_${kw.replace(/\s+/g, "_")}`, locationType: "HOME_BASED", confidence: 50 };
    }
  }

  if (verification.schemaOrgJson) {
    const schema = verification.schemaOrgJson;
    if (schema["@type"] === "VirtualLocation" || schema.location?.["@type"] === "VirtualLocation") {
      return { source: "schema_virtual_location", locationType: "VIRTUAL", confidence: 70 };
    }
  }

  return null;
}

function resolveClassification(signals: ClassificationSignal[]): {
  locationType: LocationType;
  confidence: number;
} {
  if (signals.length === 0) {
    return { locationType: "UNKNOWN", confidence: 0 };
  }

  signals.sort((a, b) => b.confidence - a.confidence);
  let best = signals[0];
  let finalConfidence = best.confidence;

  const agreeing = signals.filter(s => s.locationType === best.locationType && s !== best);
  if (agreeing.length > 0) {
    finalConfidence = Math.min(finalConfidence + 10, 100);
  }

  return {
    locationType: best.locationType,
    confidence: finalConfidence,
  };
}

function determineLandUseClass(
  locationType: LocationType,
  flags: AddressTypeFlags
): LandUseClass {
  if (locationType === "STOREFRONT") return "COMMERCIAL";
  if (locationType === "OFFICE") {
    if (flags.COMMERCIAL_HINT) return "COMMERCIAL";
    return "MIXED";
  }
  if (locationType === "HOME_BASED") return "RESIDENTIAL";
  if (locationType === "VIRTUAL") return "UNKNOWN";
  return "UNKNOWN";
}

export async function classifyEntityLocation(entityId: string): Promise<void> {
  const [biz] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, entityId))
    .limit(1);

  if (!biz) return;

  const signals: ClassificationSignal[] = [];
  let osmPlaceClass: string | null = null;

  if (biz.seedSourceExternalId) {
    const rawRows = await db
      .select({ payloadJson: sourceRawRows.payloadJson })
      .from(sourceRawRows)
      .where(eq(sourceRawRows.externalId, biz.seedSourceExternalId))
      .limit(1);

    if (rawRows.length > 0 && rawRows[0].payloadJson) {
      const payload = rawRows[0].payloadJson as Record<string, any>;
      const osmTags = payload._osmTags || payload;

      const osmSignal = classifyFromOsmTags(osmTags);
      if (osmSignal) signals.push(osmSignal);

      osmPlaceClass = getOsmPlaceClass(osmTags);
    }
  }

  const addressAnalysis = analyzeAddress(biz.address);
  if (addressAnalysis.signal) signals.push(addressAnalysis.signal);

  const [verification] = await db
    .select()
    .from(entityContactVerification)
    .where(eq(entityContactVerification.entityId, entityId))
    .limit(1);

  const websiteSignal = classifyFromWebsiteCues(verification);
  if (websiteSignal) signals.push(websiteSignal);

  const { locationType, confidence } = resolveClassification(signals);
  const landUseClass = determineLandUseClass(locationType, addressAnalysis.flags);
  const hasPhysicalAddress = !!(biz.address && biz.address.length > 5 && !addressAnalysis.flags.PO_BOX);

  const now = new Date();

  const existing = await db
    .select({ id: entityLocationProfile.id })
    .from(entityLocationProfile)
    .where(eq(entityLocationProfile.entityId, entityId))
    .limit(1);

  const values = {
    metroId: biz.cityId,
    entityId,
    locationType: locationType as any,
    hasPhysicalAddress,
    addressQuality: addressAnalysis.quality as any,
    addressTypeFlagsJson: addressAnalysis.flags,
    landUseClass: landUseClass as any,
    osmPlaceClass,
    confidenceScore: confidence,
    computedAt: now,
    updatedAt: now,
  };

  if (existing.length > 0) {
    await db
      .update(entityLocationProfile)
      .set(values)
      .where(eq(entityLocationProfile.id, existing[0].id));
  } else {
    await db.insert(entityLocationProfile).values(values);
  }
}

export async function classifyAllLocations(metroId?: string): Promise<{ classified: number; errors: number }> {
  let query = db.select({ id: businesses.id }).from(businesses);

  let bizIds: { id: string }[];
  if (metroId) {
    bizIds = await query.where(eq(businesses.cityId, metroId));
  } else {
    bizIds = await query;
  }

  let classified = 0;
  let errors = 0;

  for (const { id } of bizIds) {
    try {
      await classifyEntityLocation(id);
      classified++;
    } catch (err) {
      errors++;
      console.error(`[LocationClassifier] Error classifying entity ${id}:`, err);
    }
  }

  console.log(`[LocationClassifier] Batch complete: ${classified} classified, ${errors} errors`);
  return { classified, errors };
}
