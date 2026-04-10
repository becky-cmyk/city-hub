import { db } from "./db";
import { regions, zipGeos } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { createInboxItemIfNotOpen } from "./admin-inbox";

const SEED_ZIP_REGIONS = false;

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.googel_API_Places || process.env.GOOGLE_PLACES_API_KEY;

const RPM_LIMIT = parseInt(process.env.PLACES_IMPORT_RPM_LIMIT || "30");
const DAILY_TEXTSEARCH_LIMIT = parseInt(process.env.PLACES_IMPORT_DAILY_TEXTSEARCH_LIMIT || "500");

let textsearchCount = 0;
const rpmTimestamps: number[] = [];

function cleanRpm() {
  const cutoff = Date.now() - 60000;
  while (rpmTimestamps.length > 0 && rpmTimestamps[0] < cutoff) rpmTimestamps.shift();
}

async function waitForRpm() {
  const maxWait = Date.now() + 120000;
  while (Date.now() < maxWait) {
    cleanRpm();
    if (rpmTimestamps.length < RPM_LIMIT) {
      rpmTimestamps.push(Date.now());
      return;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("RPM throttle timeout");
}

interface SeedResult {
  metroRegionId: string;
  counties: Array<{ name: string; code: string; id: string; action: "created" | "skipped" }>;
  zipsAttempted: number;
  zipsInserted: number;
  zipsSkipped: number;
  zipsFailed: string[];
  capsRemaining: { textsearch: number; textsearchLimit: number };
  capExceeded: boolean;
  remainingZips: string[];
}

const COUNTIES = [
  { name: "Mecklenburg", code: "MECK" },
  { name: "Cabarrus", code: "CAB" },
  { name: "Union", code: "UNION" },
  { name: "Gaston", code: "GASTON" },
  { name: "Iredell", code: "IREDELL" },
  { name: "Lincoln", code: "LINCOLN" },
  { name: "Lancaster", code: "LANCASTER" },
  { name: "York", code: "YORK" },
];

const ZIP_LIST_RAW = [
  { zip: "28046", state: "NC" },
  { zip: "28126", state: "NC" },
  { zip: "28225", state: "NC" },
  { zip: "28211", state: "NC" },
  { zip: "28053", state: "NC" },
  { zip: "28055", state: "NC" },
  { zip: "28056", state: "NC" },
  { zip: "28227", state: "NC" },
  { zip: "28222", state: "NC" },
  { zip: "28221", state: "NC" },
  { zip: "28208", state: "NC" },
  { zip: "28210", state: "NC" },
  { zip: "28223", state: "NC" },
  { zip: "28220", state: "NC" },
  { zip: "28239", state: "NC" },
  { zip: "28036", state: "NC" },
  { zip: "28035", state: "NC" },
  { zip: "28082", state: "NC" },
  { zip: "28027", state: "NC" },
  { zip: "28110", state: "NC" },
  { zip: "28016", state: "NC" },
  { zip: "28024", state: "NC" },
  { zip: "28230", state: "NC" },
  { zip: "29717", state: "SC" },
  { zip: "29721", state: "SC" },
  { zip: "29722", state: "SC" },
  { zip: "29726", state: "SC" },
  { zip: "29727", state: "SC" },
  { zip: "29708", state: "SC" },
];

function dedupeZips(zips: typeof ZIP_LIST_RAW) {
  const seen = new Set<string>();
  return zips.filter((z) => {
    if (seen.has(z.zip)) return false;
    seen.add(z.zip);
    return true;
  });
}

async function lookupZipLatLng(zip: string, state: string): Promise<{ lat: number; lng: number } | null> {
  if (!GOOGLE_API_KEY) throw new Error("No Google API key found");
  if (textsearchCount >= DAILY_TEXTSEARCH_LIMIT) {
    throw new Error("DAILY_CAP_EXCEEDED");
  }

  await waitForRpm();
  textsearchCount++;

  const query = `${zip} ${state} postal code`;
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}`;
  const resp = await fetch(url);
  const data = await resp.json() as any;

  if (data.status === "OK" && data.results && data.results.length > 0) {
    const loc = data.results[0].geometry?.location;
    if (loc) return { lat: loc.lat, lng: loc.lng };
  }

  if (data.status === "ZERO_RESULTS") return null;
  if (data.status !== "OK") {
    console.error(`[ZIP Seed] Google API error for ${zip}: ${data.status} - ${data.error_message || ""}`);
    return null;
  }
  return null;
}

export async function seedMetroAndZips(): Promise<SeedResult> {
  const result: SeedResult = {
    metroRegionId: "",
    counties: [],
    zipsAttempted: 0,
    zipsInserted: 0,
    zipsSkipped: 0,
    zipsFailed: [],
    capsRemaining: { textsearch: DAILY_TEXTSEARCH_LIMIT, textsearchLimit: DAILY_TEXTSEARCH_LIMIT },
    capExceeded: false,
    remainingZips: [],
  };

  // 1) METRO REGION
  const existingMetro = await db.select().from(regions)
    .where(and(eq(regions.code, "CLT-METRO"), eq(regions.regionType, "metro")))
    .limit(1);

  let metroId: string;
  if (existingMetro.length > 0) {
    metroId = existingMetro[0].id;
    console.log(`[Seed] Metro region already exists: ${metroId}`);
  } else {
    const [metro] = await db.insert(regions).values({
      name: "Charlotte Metro",
      regionType: "metro",
      code: "CLT-METRO",
      isActive: true,
    }).returning();
    metroId = metro.id;
    console.log(`[Seed] Created metro region: ${metroId}`);
  }
  result.metroRegionId = metroId;

  // 2) COUNTY REGIONS
  for (const county of COUNTIES) {
    const existing = await db.select().from(regions)
      .where(and(eq(regions.code, county.code), eq(regions.regionType, "county")))
      .limit(1);

    if (existing.length > 0) {
      result.counties.push({ name: county.name, code: county.code, id: existing[0].id, action: "skipped" });
      console.log(`[Seed] County ${county.name} (${county.code}) already exists: ${existing[0].id}`);
    } else {
      const [row] = await db.insert(regions).values({
        name: county.name,
        regionType: "county",
        code: county.code,
        parentRegionId: metroId,
        isActive: true,
      }).returning();
      result.counties.push({ name: county.name, code: county.code, id: row.id, action: "created" });
      console.log(`[Seed] Created county ${county.name} (${county.code}): ${row.id}`);
    }
  }

  // 3) ZIP GEOS
  const uniqueZips = dedupeZips(ZIP_LIST_RAW);
  result.zipsAttempted = uniqueZips.length;

  for (let i = 0; i < uniqueZips.length; i++) {
    const { zip, state } = uniqueZips[i];

    const existing = await db.select().from(zipGeos).where(eq(zipGeos.zip, zip)).limit(1);
    if (existing.length > 0) {
      result.zipsSkipped++;
      console.log(`[Seed] ZIP ${zip} already exists, skipping`);
      continue;
    }

    try {
      const loc = await lookupZipLatLng(zip, state);
      if (!loc) {
        result.zipsFailed.push(zip);
        console.error(`[Seed] ZIP ${zip} lookup returned no results`);
        try {
          await createInboxItemIfNotOpen({
            itemType: "places_import_failed",
            relatedTable: "zip_geos",
            relatedId: zip,
            title: `ZIP seed failed: ${zip}`,
            summary: `Google Places lookup returned no results for ZIP ${zip} (${state})`,
            priority: "low",
          });
        } catch (e) {
          console.error(`[Seed] Failed to create inbox item for ZIP ${zip}`);
        }
        continue;
      }

      await db.insert(zipGeos).values({
        zip,
        city: "Charlotte Metro",
        state,
        lat: loc.lat.toString(),
        lng: loc.lng.toString(),
        radiusMeters: 3500,
      }).onConflictDoNothing();

      result.zipsInserted++;
      console.log(`[Seed] ZIP ${zip} inserted: lat=${loc.lat}, lng=${loc.lng}`);
    } catch (e: any) {
      if (e.message === "DAILY_CAP_EXCEEDED") {
        result.capExceeded = true;
        result.remainingZips = uniqueZips.slice(i).map((z) => z.zip);
        console.error(`[Seed] Daily cap exceeded at ZIP ${zip}. Remaining: ${result.remainingZips.join(", ")}`);
        break;
      }
      result.zipsFailed.push(zip);
      console.error(`[Seed] ZIP ${zip} error: ${e.message}`);
      try {
        await createInboxItemIfNotOpen({
          itemType: "places_import_failed",
          relatedTable: "zip_geos",
          relatedId: zip,
          title: `ZIP seed failed: ${zip}`,
          summary: `Error during ZIP lookup: ${e.message}`,
          priority: "low",
        });
      } catch (_) {}
    }
  }

  result.capsRemaining = {
    textsearch: DAILY_TEXTSEARCH_LIMIT - textsearchCount,
    textsearchLimit: DAILY_TEXTSEARCH_LIMIT,
  };

  return result;
}

const isDirectRun = process.argv[1]?.includes("seed-metro-zips");
if (isDirectRun) {
  seedMetroAndZips().then((result) => {
    console.log("\n========== SEED RESULT ==========");
    console.log(JSON.stringify(result, null, 2));
    console.log("=================================\n");
    process.exit(0);
  }).catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
}
