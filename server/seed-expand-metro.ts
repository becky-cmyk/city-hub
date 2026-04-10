import { db } from "./db";
import { regions, zipGeos } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { createInboxItemIfNotOpen } from "./admin-inbox";

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

async function placesLookup(query: string): Promise<{ lat: number; lng: number } | null> {
  if (!GOOGLE_API_KEY) throw new Error("No Google API key found");
  if (textsearchCount >= DAILY_TEXTSEARCH_LIMIT) throw new Error("DAILY_CAP_EXCEEDED");

  await waitForRpm();
  textsearchCount++;

  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}`;
  const resp = await fetch(url);
  const data = await resp.json() as any;

  if (data.status === "OK" && data.results?.length > 0) {
    const loc = data.results[0].geometry?.location;
    if (loc) return { lat: loc.lat, lng: loc.lng };
  }
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    console.error(`[Expand] Google API error: ${data.status} - ${data.error_message || ""}`);
  }
  return null;
}

async function findOrCreateRegion(
  name: string,
  code: string,
  regionType: "county" | "hub",
  parentId: string
): Promise<{ id: string; action: "created" | "skipped" }> {
  const existing = await db.select().from(regions)
    .where(and(eq(regions.code, code), eq(regions.regionType, regionType)))
    .limit(1);

  if (existing.length > 0) {
    console.log(`[Expand] ${regionType} ${name} (${code}) already exists: ${existing[0].id}`);
    return { id: existing[0].id, action: "skipped" };
  }

  const [row] = await db.insert(regions).values({
    name,
    regionType,
    code,
    parentRegionId: parentId,
    isActive: true,
  }).returning();
  console.log(`[Expand] Created ${regionType} ${name} (${code}): ${row.id}`);
  return { id: row.id, action: "created" };
}

const EXPANSION_ZIPS = [
  { zip: "29730", state: "SC" },
  { zip: "29732", state: "SC" },
  { zip: "29733", state: "SC" },
  { zip: "29745", state: "SC" },
  { zip: "29710", state: "SC" },
  { zip: "28012", state: "NC" },
  { zip: "28052", state: "NC" },
  { zip: "28054", state: "NC" },
  { zip: "28056", state: "NC" },
  { zip: "28032", state: "NC" },
  { zip: "28202", state: "NC" },
  { zip: "28203", state: "NC" },
  { zip: "28204", state: "NC" },
  { zip: "28205", state: "NC" },
  { zip: "28206", state: "NC" },
  { zip: "28207", state: "NC" },
  { zip: "28209", state: "NC" },
];

const HUB_DEFS = [
  { name: "Rock Hill", code: "ROCKHILL", parentCode: "YORK", searchQuery: "Rock Hill, SC" },
  { name: "Lake Wylie", code: "LAKEWYLIE", parentCode: "YORK", searchQuery: "Lake Wylie, SC" },
  { name: "Gastonia", code: "GASTONIA", parentCode: "GASTON", searchQuery: "Gastonia, NC" },
  { name: "Belmont", code: "BELMONT", parentCode: "GASTON", searchQuery: "Belmont, NC" },
];

interface ExpandResult {
  yorkCounty: { id: string; action: string };
  hubs: Array<{ name: string; code: string; id: string; action: string; centerLat?: string; centerLng?: string }>;
  zipsAttempted: number;
  zipsInserted: number;
  zipsSkipped: number;
  zipsFailed: string[];
  capsRemaining: { textsearch: number; textsearchLimit: number };
  capExceeded: boolean;
}

export async function expandMetroCoverage(): Promise<ExpandResult> {
  const result: ExpandResult = {
    yorkCounty: { id: "", action: "" },
    hubs: [],
    zipsAttempted: EXPANSION_ZIPS.length,
    zipsInserted: 0,
    zipsSkipped: 0,
    zipsFailed: [],
    capsRemaining: { textsearch: DAILY_TEXTSEARCH_LIMIT, textsearchLimit: DAILY_TEXTSEARCH_LIMIT },
    capExceeded: false,
  };

  const metroRow = await db.select().from(regions)
    .where(and(eq(regions.code, "CLT-METRO"), eq(regions.regionType, "metro")))
    .limit(1);
  if (metroRow.length === 0) throw new Error("Charlotte Metro region not found — run initial seed first");
  const metroId = metroRow[0].id;
  console.log(`[Expand] Metro region: ${metroId}`);

  const yorkResult = await findOrCreateRegion("York County", "YORK", "county", metroId);
  result.yorkCounty = yorkResult;

  const gastonRow = await db.select().from(regions)
    .where(and(eq(regions.code, "GASTON"), eq(regions.regionType, "county")))
    .limit(1);
  if (gastonRow.length === 0) throw new Error("Gaston County not found — run initial seed first");
  const gastonId = gastonRow[0].id;

  const parentMap: Record<string, string> = {
    YORK: yorkResult.id,
    GASTON: gastonId,
  };

  for (const hub of HUB_DEFS) {
    const parentId = parentMap[hub.parentCode];
    const hubResult = await findOrCreateRegion(hub.name, hub.code, "hub", parentId);

    let centerLat: string | undefined;
    let centerLng: string | undefined;

    const existingHub = await db.select().from(regions).where(eq(regions.id, hubResult.id)).limit(1);
    if (!existingHub[0].centerLat || !existingHub[0].centerLng) {
      try {
        const loc = await placesLookup(hub.searchQuery);
        if (loc) {
          centerLat = loc.lat.toString();
          centerLng = loc.lng.toString();
          await db.update(regions).set({ centerLat, centerLng }).where(eq(regions.id, hubResult.id));
          console.log(`[Expand] Hub ${hub.name} center: ${centerLat}, ${centerLng}`);
        } else {
          console.warn(`[Expand] Hub ${hub.name} center lookup returned no results`);
        }
      } catch (e: any) {
        if (e.message === "DAILY_CAP_EXCEEDED") {
          console.warn(`[Expand] Daily cap hit during hub center lookup for ${hub.name}`);
        } else {
          console.error(`[Expand] Hub center lookup error for ${hub.name}: ${e.message}`);
        }
      }
    } else {
      centerLat = existingHub[0].centerLat;
      centerLng = existingHub[0].centerLng;
      console.log(`[Expand] Hub ${hub.name} already has center: ${centerLat}, ${centerLng}`);
    }

    result.hubs.push({
      name: hub.name,
      code: hub.code,
      id: hubResult.id,
      action: hubResult.action,
      centerLat,
      centerLng,
    });
  }

  for (let i = 0; i < EXPANSION_ZIPS.length; i++) {
    const { zip, state } = EXPANSION_ZIPS[i];

    const existing = await db.select().from(zipGeos).where(eq(zipGeos.zip, zip)).limit(1);
    if (existing.length > 0) {
      result.zipsSkipped++;
      console.log(`[Expand] ZIP ${zip} already exists, skipping`);
      continue;
    }

    try {
      const loc = await placesLookup(`${zip} ${state} postal code`);
      if (!loc) {
        result.zipsFailed.push(zip);
        console.error(`[Expand] ZIP ${zip} lookup returned no results`);
        try {
          await createInboxItemIfNotOpen({
            itemType: "places_import_failed",
            relatedTable: "zip_geos",
            relatedId: zip,
            title: `Metro ZIP seed failed: ${zip}`,
            summary: `Google Places lookup returned no results for ZIP ${zip} (${state})`,
            priority: "low",
          });
        } catch (_) {}
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
      console.log(`[Expand] ZIP ${zip} inserted: lat=${loc.lat}, lng=${loc.lng}`);
    } catch (e: any) {
      if (e.message === "DAILY_CAP_EXCEEDED") {
        result.capExceeded = true;
        console.error(`[Expand] Daily cap exceeded at ZIP ${zip}`);
        break;
      }
      result.zipsFailed.push(zip);
      console.error(`[Expand] ZIP ${zip} error: ${e.message}`);
      try {
        await createInboxItemIfNotOpen({
          itemType: "places_import_failed",
          relatedTable: "zip_geos",
          relatedId: zip,
          title: `Metro ZIP seed failed: ${zip}`,
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

const isDirectRun = process.argv[1]?.includes("seed-expand-metro");
if (isDirectRun) {
  expandMetroCoverage().then((result) => {
    console.log("\n========== EXPAND RESULT ==========");
    console.log(JSON.stringify(result, null, 2));
    console.log("====================================\n");
    process.exit(0);
  }).catch((err) => {
    console.error("Expand failed:", err);
    process.exit(1);
  });
}
