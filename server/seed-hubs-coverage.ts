import { db } from "./db";
import { regions, zipGeos, hubZipCoverage } from "@shared/schema";
import { eq, and } from "drizzle-orm";

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
  return null;
}

async function findOrCreateHub(
  name: string,
  code: string,
  parentId: string,
): Promise<{ id: string; action: "created" | "skipped" }> {
  const existing = await db.select().from(regions)
    .where(and(eq(regions.code, code), eq(regions.regionType, "hub")))
    .limit(1);

  if (existing.length > 0) {
    return { id: existing[0].id, action: "skipped" };
  }

  const [row] = await db.insert(regions).values({
    name,
    regionType: "hub",
    code,
    parentRegionId: parentId,
    isActive: true,
  }).returning();
  return { id: row.id, action: "created" };
}

async function findOrCreateCounty(
  name: string,
  code: string,
  metroId: string,
): Promise<{ id: string; action: "created" | "skipped" }> {
  const existing = await db.select().from(regions)
    .where(and(eq(regions.code, code), eq(regions.regionType, "county")))
    .limit(1);

  if (existing.length > 0) {
    return { id: existing[0].id, action: "skipped" };
  }

  const [row] = await db.insert(regions).values({
    name,
    regionType: "county",
    code,
    parentRegionId: metroId,
    isActive: true,
  }).returning();
  return { id: row.id, action: "created" };
}

async function ensureHubCenter(hubId: string, searchQuery: string): Promise<{ lat: string; lng: string } | null> {
  const [hub] = await db.select().from(regions).where(eq(regions.id, hubId)).limit(1);
  if (hub?.centerLat && hub?.centerLng) {
    return { lat: hub.centerLat, lng: hub.centerLng };
  }

  try {
    const loc = await placesLookup(searchQuery);
    if (loc) {
      const lat = loc.lat.toString();
      const lng = loc.lng.toString();
      await db.update(regions).set({ centerLat: lat, centerLng: lng }).where(eq(regions.id, hubId));
      return { lat, lng };
    }
  } catch (e: any) {
    if (e.message === "DAILY_CAP_EXCEEDED") {
      console.warn(`[HubSeed] Daily cap hit during center lookup`);
    }
  }
  return null;
}

async function zipExists(zip: string): Promise<boolean> {
  const [z] = await db.select().from(zipGeos).where(eq(zipGeos.zip, zip)).limit(1);
  return !!z;
}

const NEIGHBORHOOD_HUBS = [
  { name: "Uptown", code: "UPTOWN", search: "Uptown, Charlotte NC", lifestyleTags: ["urban-living", "walkable", "nightlife", "young-professionals"] },
  { name: "NoDa", code: "NODA", search: "NoDa, Charlotte NC", lifestyleTags: ["arts-creative", "nightlife", "walkable", "young-professionals"] },
  { name: "Plaza Midwood", code: "PLAZAMIDWOOD", search: "Plaza Midwood, Charlotte NC", lifestyleTags: ["walkable", "nightlife", "arts-creative", "young-professionals"] },
  { name: "South End", code: "SOUTHEND", search: "South End, Charlotte NC", lifestyleTags: ["urban-living", "walkable", "nightlife", "young-professionals"] },
  { name: "Dilworth", code: "DILWORTH", search: "Dilworth, Charlotte NC", lifestyleTags: ["walkable", "family-friendly", "urban-living"] },
  { name: "Myers Park", code: "MYERSPARK", search: "Myers Park, Charlotte NC", lifestyleTags: ["family-friendly", "suburban"] },
  { name: "Elizabeth", code: "ELIZABETH", search: "Elizabeth, Charlotte NC", lifestyleTags: ["walkable", "urban-living", "young-professionals"] },
  { name: "SouthPark", code: "SOUTHPARK", search: "SouthPark, Charlotte NC", lifestyleTags: ["suburban", "family-friendly"] },
  { name: "Cotswold", code: "COTSWOLD", search: "Cotswold, Charlotte NC", lifestyleTags: ["suburban", "family-friendly", "walkable"] },
  { name: "University City", code: "UNICITY", search: "University City, Charlotte NC", lifestyleTags: ["suburban", "young-professionals"] },
  { name: "Steele Creek", code: "STEELECREEK", search: "Steele Creek, Charlotte NC", lifestyleTags: ["suburban", "family-friendly"] },
  { name: "Ballantyne", code: "BALLANTYNE", search: "Ballantyne, Charlotte NC", lifestyleTags: ["suburban", "family-friendly"] },
  { name: "LoSo", code: "LOSO", search: "LoSo, Charlotte NC", lifestyleTags: ["urban-living", "arts-creative", "young-professionals"] },
  { name: "West End", code: "WESTEND", search: "West End, Charlotte NC", lifestyleTags: ["urban-living", "arts-creative"] },
];

const TOWN_HUBS = [
  { name: "Rock Hill", code: "ROCKHILL", parentCode: "YORK", search: "Rock Hill, SC", lifestyleTags: ["suburban", "family-friendly"] },
  { name: "Lake Wylie", code: "LAKEWYLIE", parentCode: "YORK", search: "Lake Wylie, SC", lifestyleTags: ["waterfront", "suburban", "family-friendly"] },
  { name: "Fort Mill", code: "FORTMILL", parentCode: "YORK", search: "Fort Mill, SC", lifestyleTags: ["suburban", "family-friendly"] },
  { name: "Tega Cay", code: "TEGACAY", parentCode: "YORK", search: "Tega Cay, SC", lifestyleTags: ["waterfront", "suburban", "family-friendly"] },
  { name: "Clover", code: "CLOVER", parentCode: "YORK", search: "Clover, SC", lifestyleTags: ["suburban", "family-friendly"] },
  { name: "York", code: "YORK_TOWN", parentCode: "YORK", search: "York, SC", lifestyleTags: ["suburban"] },
  { name: "Gastonia", code: "GASTONIA", parentCode: "GASTON", search: "Gastonia, NC", lifestyleTags: ["suburban"] },
  { name: "Belmont", code: "BELMONT", parentCode: "GASTON", search: "Belmont, NC", lifestyleTags: ["walkable", "arts-creative", "waterfront"] },
  { name: "Mount Holly", code: "MOUNTHOLLY", parentCode: "GASTON", search: "Mount Holly, NC", lifestyleTags: ["suburban", "waterfront"] },
  { name: "Cramerton", code: "CRAMERTON", parentCode: "GASTON", search: "Cramerton, NC", lifestyleTags: ["suburban", "waterfront"] },
  { name: "Lowell", code: "LOWELL", parentCode: "GASTON", search: "Lowell, NC", lifestyleTags: ["suburban"] },
  { name: "McAdenville", code: "MCADENVILLE", parentCode: "GASTON", search: "McAdenville, NC", lifestyleTags: ["suburban"] },
  { name: "Ranlo", code: "RANLO", parentCode: "GASTON", search: "Ranlo, NC", lifestyleTags: ["suburban"] },
  { name: "Huntersville", code: "HUNTERSVILLE", parentCode: "MECK", search: "Huntersville, NC", lifestyleTags: ["suburban", "family-friendly", "waterfront"] },
  { name: "Cornelius", code: "CORNELIUS", parentCode: "MECK", search: "Cornelius, NC", lifestyleTags: ["waterfront", "suburban", "family-friendly"] },
  { name: "Davidson", code: "DAVIDSON", parentCode: "MECK", search: "Davidson, NC", lifestyleTags: ["walkable", "waterfront", "family-friendly"] },
  { name: "Matthews", code: "MATTHEWS", parentCode: "MECK", search: "Matthews, NC", lifestyleTags: ["suburban", "family-friendly"] },
  { name: "Mint Hill", code: "MINTHILL", parentCode: "MECK", search: "Mint Hill, NC", lifestyleTags: ["suburban", "family-friendly"] },
  { name: "Pineville", code: "PINEVILLE", parentCode: "MECK", search: "Pineville, NC", lifestyleTags: ["suburban"] },
  { name: "Northlake", code: "NORTHLAKE", parentCode: "MECK", search: "Northlake, Charlotte NC", lifestyleTags: ["suburban"] },
  { name: "Mooresville", code: "MOORESVILLE", parentCode: "IREDELL", search: "Mooresville, NC", lifestyleTags: ["waterfront", "suburban", "family-friendly"] },
  { name: "Statesville", code: "STATESVILLE", parentCode: "IREDELL", search: "Statesville, NC", lifestyleTags: ["suburban"] },
  { name: "Troutman", code: "TROUTMAN", parentCode: "IREDELL", search: "Troutman, NC", lifestyleTags: ["suburban"] },
  { name: "Concord", code: "CONCORD", parentCode: "CAB", search: "Concord, NC", lifestyleTags: ["suburban", "family-friendly"] },
  { name: "Kannapolis", code: "KANNAPOLIS", parentCode: "CAB", search: "Kannapolis, NC", lifestyleTags: ["suburban"] },
  { name: "Harrisburg", code: "HARRISBURG", parentCode: "CAB", search: "Harrisburg, NC", lifestyleTags: ["suburban", "family-friendly"] },
  { name: "Midland", code: "MIDLAND", parentCode: "CAB", search: "Midland, NC", lifestyleTags: ["suburban"] },
  { name: "Mount Pleasant", code: "MOUNTPLEASANT", parentCode: "CAB", search: "Mount Pleasant, NC 28124", lifestyleTags: ["suburban"] },
  { name: "Indian Trail", code: "INDIANTRAIL", parentCode: "UNION", search: "Indian Trail, NC", lifestyleTags: ["suburban", "family-friendly"] },
  { name: "Waxhaw", code: "WAXHAW", parentCode: "UNION", search: "Waxhaw, NC", lifestyleTags: ["suburban", "family-friendly"] },
  { name: "Weddington", code: "WEDDINGTON", parentCode: "UNION", search: "Weddington, NC", lifestyleTags: ["suburban", "family-friendly"] },
  { name: "Stallings", code: "STALLINGS", parentCode: "UNION", search: "Stallings, NC", lifestyleTags: ["suburban", "family-friendly"] },
  { name: "Monroe", code: "MONROE", parentCode: "UNION", search: "Monroe, NC", lifestyleTags: ["suburban"] },
  { name: "Marvin", code: "MARVIN", parentCode: "UNION", search: "Marvin, NC", lifestyleTags: ["suburban", "family-friendly"] },
  { name: "Wesley Chapel", code: "WESLEYCHAPEL", parentCode: "UNION", search: "Wesley Chapel, NC", lifestyleTags: ["suburban", "family-friendly"] },
  { name: "Salisbury", code: "SALISBURY", parentCode: "ROWAN", search: "Salisbury, NC", lifestyleTags: ["suburban", "arts-creative"] },
  { name: "China Grove", code: "CHINAGROVE", parentCode: "ROWAN", search: "China Grove, NC", lifestyleTags: ["suburban"] },
  { name: "Albemarle", code: "ALBEMARLE", parentCode: "STANLY", search: "Albemarle, NC", lifestyleTags: ["suburban"] },
  { name: "Locust", code: "LOCUST", parentCode: "STANLY", search: "Locust, NC", lifestyleTags: ["suburban"] },
  { name: "Chester", code: "CHESTER_TOWN", parentCode: "CHESTER", search: "Chester, SC", lifestyleTags: ["suburban"] },
  { name: "Great Falls", code: "GREATFALLS", parentCode: "CHESTER", search: "Great Falls, SC", lifestyleTags: ["suburban"] },
  { name: "Indian Land", code: "INDIANLAND", parentCode: "LANCASTER", search: "Indian Land, SC", lifestyleTags: ["suburban", "family-friendly"] },
  { name: "Lancaster", code: "LANCASTER_TOWN", parentCode: "LANCASTER", search: "Lancaster, SC", lifestyleTags: ["suburban"] },
  { name: "Denver", code: "DENVER", parentCode: "LINCOLN", search: "Denver, NC", lifestyleTags: ["waterfront", "suburban", "family-friendly"] },
  { name: "Lincolnton", code: "LINCOLNTON", parentCode: "LINCOLN", search: "Lincolnton, NC", lifestyleTags: ["suburban"] },
  { name: "Wadesboro", code: "WADESBORO", parentCode: "ANSON", search: "Wadesboro, NC", lifestyleTags: ["suburban"] },
  { name: "Polkton", code: "POLKTON", parentCode: "ANSON", search: "Polkton, NC", lifestyleTags: ["suburban"] },
  { name: "Peachland", code: "PEACHLAND", parentCode: "ANSON", search: "Peachland, NC", lifestyleTags: ["suburban"] },
  { name: "Morven", code: "MORVEN", parentCode: "ANSON", search: "Morven, NC", lifestyleTags: ["suburban"] },
  { name: "Lilesville", code: "LILESVILLE", parentCode: "ANSON", search: "Lilesville, NC", lifestyleTags: ["suburban"] },
  { name: "Shelby", code: "SHELBY", parentCode: "CLEVELAND", search: "Shelby, NC", lifestyleTags: ["suburban"] },
  { name: "Kings Mountain", code: "KINGSMOUNTAIN", parentCode: "CLEVELAND", search: "Kings Mountain, NC", lifestyleTags: ["suburban"] },
  { name: "Boiling Springs", code: "BOILINGSPRINGS", parentCode: "CLEVELAND", search: "Boiling Springs, NC", lifestyleTags: ["suburban"] },
  { name: "Lawndale", code: "LAWNDALE", parentCode: "CLEVELAND", search: "Lawndale, NC", lifestyleTags: ["suburban"] },
  { name: "Hickory", code: "HICKORY", parentCode: "CATAWBA", search: "Hickory, NC", lifestyleTags: ["suburban", "arts-creative"] },
  { name: "Newton", code: "NEWTON", parentCode: "CATAWBA", search: "Newton, NC", lifestyleTags: ["suburban"] },
  { name: "Conover", code: "CONOVER", parentCode: "CATAWBA", search: "Conover, NC", lifestyleTags: ["suburban"] },
  { name: "Maiden", code: "MAIDEN", parentCode: "CATAWBA", search: "Maiden, NC", lifestyleTags: ["suburban"] },
  { name: "Taylorsville", code: "TAYLORSVILLE", parentCode: "ALEXANDER", search: "Taylorsville, NC", lifestyleTags: ["suburban"] },
  { name: "Hiddenite", code: "HIDDENITE", parentCode: "ALEXANDER", search: "Hiddenite, NC", lifestyleTags: ["suburban"] },
  { name: "Morganton", code: "MORGANTON", parentCode: "BURKE", search: "Morganton, NC", lifestyleTags: ["suburban"] },
  { name: "Valdese", code: "VALDESE", parentCode: "BURKE", search: "Valdese, NC", lifestyleTags: ["suburban"] },
  { name: "Glen Alpine", code: "GLENALPINE", parentCode: "BURKE", search: "Glen Alpine, NC", lifestyleTags: ["suburban"] },
  { name: "Lenoir", code: "LENOIR", parentCode: "CALDWELL", search: "Lenoir, NC", lifestyleTags: ["suburban"] },
  { name: "Granite Falls", code: "GRANITEFALLS", parentCode: "CALDWELL", search: "Granite Falls, NC", lifestyleTags: ["suburban"] },
  { name: "Hudson", code: "HUDSON", parentCode: "CALDWELL", search: "Hudson, NC", lifestyleTags: ["suburban"] },
  { name: "Marion", code: "MARION", parentCode: "MCDOWELL", search: "Marion, NC", lifestyleTags: ["suburban"] },
  { name: "Old Fort", code: "OLDFORT", parentCode: "MCDOWELL", search: "Old Fort, NC", lifestyleTags: ["suburban"] },
  { name: "Cheraw", code: "CHERAW", parentCode: "CHESTERFIELD", search: "Cheraw, SC", lifestyleTags: ["suburban"] },
  { name: "Chesterfield", code: "CHESTERFIELD_TOWN", parentCode: "CHESTERFIELD", search: "Chesterfield, SC", lifestyleTags: ["suburban"] },
  { name: "Pageland", code: "PAGELAND", parentCode: "CHESTERFIELD", search: "Pageland, SC", lifestyleTags: ["suburban"] },
];

type CoverageEntry = { hubCode: string; zips: string[]; confidence: "high" | "med" | "low" };

const COVERAGE_MAP: CoverageEntry[] = [
  { hubCode: "UPTOWN", zips: ["28202", "28203", "28204"], confidence: "med" },
  { hubCode: "NODA", zips: ["28205", "28206"], confidence: "med" },
  { hubCode: "PLAZAMIDWOOD", zips: ["28205"], confidence: "med" },
  { hubCode: "SOUTHEND", zips: ["28203", "28209"], confidence: "med" },
  { hubCode: "DILWORTH", zips: ["28203", "28209"], confidence: "med" },
  { hubCode: "MYERSPARK", zips: ["28207", "28209", "28211"], confidence: "low" },
  { hubCode: "ELIZABETH", zips: ["28204"], confidence: "med" },
  { hubCode: "SOUTHPARK", zips: ["28211", "28209", "28226"], confidence: "low" },
  { hubCode: "COTSWOLD", zips: ["28211"], confidence: "med" },
  { hubCode: "UNICITY", zips: ["28262", "28213", "28269"], confidence: "low" },
  { hubCode: "STEELECREEK", zips: ["28273", "28278"], confidence: "low" },
  { hubCode: "BALLANTYNE", zips: ["28277", "28226"], confidence: "med" },
  { hubCode: "LOSO", zips: ["28217", "28209"], confidence: "low" },
  { hubCode: "WESTEND", zips: ["28208", "28216"], confidence: "low" },
  { hubCode: "ROCKHILL", zips: ["29730", "29732", "29733"], confidence: "high" },
  { hubCode: "LAKEWYLIE", zips: ["29710"], confidence: "high" },
  { hubCode: "FORTMILL", zips: ["29715", "29708"], confidence: "high" },
  { hubCode: "TEGACAY", zips: ["29708"], confidence: "high" },
  { hubCode: "GASTONIA", zips: ["28052", "28054", "28056"], confidence: "high" },
  { hubCode: "BELMONT", zips: ["28012"], confidence: "high" },
  { hubCode: "MOUNTHOLLY", zips: ["28120"], confidence: "high" },
  { hubCode: "HUNTERSVILLE", zips: ["28078"], confidence: "high" },
  { hubCode: "CORNELIUS", zips: ["28031"], confidence: "high" },
  { hubCode: "DAVIDSON", zips: ["28035", "28036"], confidence: "high" },
  { hubCode: "MATTHEWS", zips: ["28104", "28105"], confidence: "high" },
  { hubCode: "MINTHILL", zips: ["28227"], confidence: "high" },
  { hubCode: "PINEVILLE", zips: ["28134"], confidence: "high" },
  { hubCode: "MOORESVILLE", zips: ["28115", "28117"], confidence: "high" },
  { hubCode: "STATESVILLE", zips: ["28625", "28677"], confidence: "high" },
  { hubCode: "CONCORD", zips: ["28025", "28027"], confidence: "high" },
  { hubCode: "KANNAPOLIS", zips: ["28081", "28083"], confidence: "high" },
  { hubCode: "HARRISBURG", zips: ["28075"], confidence: "high" },
  { hubCode: "INDIANTRAIL", zips: ["28079"], confidence: "high" },
  { hubCode: "WAXHAW", zips: ["28173"], confidence: "high" },
  { hubCode: "WEDDINGTON", zips: ["28104"], confidence: "med" },
  { hubCode: "STALLINGS", zips: ["28104"], confidence: "med" },
  { hubCode: "MONROE", zips: ["28110", "28112"], confidence: "high" },
  { hubCode: "SALISBURY", zips: ["28144", "28146", "28147"], confidence: "high" },
  { hubCode: "ALBEMARLE", zips: ["28001", "28002"], confidence: "high" },
  { hubCode: "LOCUST", zips: ["28097"], confidence: "high" },
  { hubCode: "CHINAGROVE", zips: ["28023"], confidence: "high" },
  { hubCode: "MIDLAND", zips: ["28107"], confidence: "high" },
  { hubCode: "MOUNTPLEASANT", zips: ["28124"], confidence: "high" },
  { hubCode: "CRAMERTON", zips: ["28032"], confidence: "high" },
  { hubCode: "LOWELL", zips: ["28098"], confidence: "high" },
  { hubCode: "MCADENVILLE", zips: ["28101"], confidence: "high" },
  { hubCode: "RANLO", zips: ["28054"], confidence: "high" },
  { hubCode: "TROUTMAN", zips: ["28166"], confidence: "high" },
  { hubCode: "NORTHLAKE", zips: ["28216"], confidence: "high" },
  { hubCode: "MARVIN", zips: ["28173"], confidence: "high" },
  { hubCode: "WESLEYCHAPEL", zips: ["28104"], confidence: "med" },
  { hubCode: "CLOVER", zips: ["29710"], confidence: "high" },
  { hubCode: "YORK_TOWN", zips: ["29745"], confidence: "high" },
  { hubCode: "CHESTER_TOWN", zips: ["29706"], confidence: "high" },
  { hubCode: "GREATFALLS", zips: ["29055"], confidence: "high" },
  { hubCode: "INDIANLAND", zips: ["29707"], confidence: "high" },
  { hubCode: "LANCASTER_TOWN", zips: ["29720"], confidence: "high" },
  { hubCode: "DENVER", zips: ["28037"], confidence: "high" },
  { hubCode: "LINCOLNTON", zips: ["28092"], confidence: "high" },
  { hubCode: "WADESBORO", zips: ["28170"], confidence: "high" },
  { hubCode: "POLKTON", zips: ["28135"], confidence: "high" },
  { hubCode: "PEACHLAND", zips: ["28133"], confidence: "high" },
  { hubCode: "MORVEN", zips: ["28119"], confidence: "high" },
  { hubCode: "LILESVILLE", zips: ["28091"], confidence: "high" },
  { hubCode: "SHELBY", zips: ["28150", "28152"], confidence: "high" },
  { hubCode: "KINGSMOUNTAIN", zips: ["28086"], confidence: "high" },
  { hubCode: "BOILINGSPRINGS", zips: ["28017"], confidence: "high" },
  { hubCode: "LAWNDALE", zips: ["28090"], confidence: "high" },
  { hubCode: "HICKORY", zips: ["28601", "28602"], confidence: "high" },
  { hubCode: "NEWTON", zips: ["28658"], confidence: "high" },
  { hubCode: "CONOVER", zips: ["28613"], confidence: "high" },
  { hubCode: "MAIDEN", zips: ["28650"], confidence: "high" },
  { hubCode: "TAYLORSVILLE", zips: ["28681"], confidence: "high" },
  { hubCode: "HIDDENITE", zips: ["28636"], confidence: "high" },
  { hubCode: "MORGANTON", zips: ["28655"], confidence: "high" },
  { hubCode: "VALDESE", zips: ["28690"], confidence: "high" },
  { hubCode: "GLENALPINE", zips: ["28628"], confidence: "high" },
  { hubCode: "LENOIR", zips: ["28645"], confidence: "high" },
  { hubCode: "GRANITEFALLS", zips: ["28630"], confidence: "high" },
  { hubCode: "HUDSON", zips: ["28638"], confidence: "high" },
  { hubCode: "MARION", zips: ["28752"], confidence: "high" },
  { hubCode: "OLDFORT", zips: ["28762"], confidence: "high" },
  { hubCode: "CHERAW", zips: ["29520"], confidence: "high" },
  { hubCode: "CHESTERFIELD_TOWN", zips: ["29709"], confidence: "high" },
  { hubCode: "PAGELAND", zips: ["29728"], confidence: "high" },
];

interface SeedHubsResult {
  hubsCreated: Array<{ name: string; code: string; id: string; action: string; center: string | null }>;
  coverageMappings: { inserted: number; skipped: number };
  missingZips: string[];
  capsRemaining: { textsearch: number; textsearchLimit: number };
}

export async function seedHubsAndCoverage(): Promise<SeedHubsResult> {
  const result: SeedHubsResult = {
    hubsCreated: [],
    coverageMappings: { inserted: 0, skipped: 0 },
    missingZips: [],
    capsRemaining: { textsearch: DAILY_TEXTSEARCH_LIMIT, textsearchLimit: DAILY_TEXTSEARCH_LIMIT },
  };

  const metroRow = await db.select().from(regions)
    .where(and(eq(regions.code, "CLT-METRO"), eq(regions.regionType, "metro")))
    .limit(1);
  if (metroRow.length === 0) throw new Error("Charlotte Metro region not found");
  const metroId = metroRow[0].id;

  const meck = await findOrCreateCounty("Mecklenburg", "MECK", metroId);
  console.log(`[HubSeed] Mecklenburg county: ${meck.id} (${meck.action})`);

  const york = await findOrCreateCounty("York", "YORK", metroId);
  console.log(`[HubSeed] York county: ${york.id} (${york.action})`);

  const gaston = await findOrCreateCounty("Gaston", "GASTON", metroId);
  console.log(`[HubSeed] Gaston county: ${gaston.id} (${gaston.action})`);

  const iredell = await findOrCreateCounty("Iredell", "IREDELL", metroId);
  console.log(`[HubSeed] Iredell county: ${iredell.id} (${iredell.action})`);

  const cab = await findOrCreateCounty("Cabarrus", "CAB", metroId);
  console.log(`[HubSeed] Cabarrus county: ${cab.id} (${cab.action})`);

  const union = await findOrCreateCounty("Union", "UNION", metroId);
  console.log(`[HubSeed] Union county: ${union.id} (${union.action})`);

  const rowan = await findOrCreateCounty("Rowan", "ROWAN", metroId);
  console.log(`[HubSeed] Rowan county: ${rowan.id} (${rowan.action})`);

  const stanly = await findOrCreateCounty("Stanly", "STANLY", metroId);
  console.log(`[HubSeed] Stanly county: ${stanly.id} (${stanly.action})`);

  const chester = await findOrCreateCounty("Chester", "CHESTER", metroId);
  console.log(`[HubSeed] Chester county: ${chester.id} (${chester.action})`);

  const lancaster = await findOrCreateCounty("Lancaster", "LANCASTER", metroId);
  console.log(`[HubSeed] Lancaster county: ${lancaster.id} (${lancaster.action})`);

  const lincoln = await findOrCreateCounty("Lincoln", "LINCOLN", metroId);
  console.log(`[HubSeed] Lincoln county: ${lincoln.id} (${lincoln.action})`);

  const anson = await findOrCreateCounty("Anson", "ANSON", metroId);
  console.log(`[HubSeed] Anson county: ${anson.id} (${anson.action})`);

  const cleveland = await findOrCreateCounty("Cleveland", "CLEVELAND", metroId);
  console.log(`[HubSeed] Cleveland county: ${cleveland.id} (${cleveland.action})`);

  const catawba = await findOrCreateCounty("Catawba", "CATAWBA", metroId);
  console.log(`[HubSeed] Catawba county: ${catawba.id} (${catawba.action})`);

  const alexander = await findOrCreateCounty("Alexander", "ALEXANDER", metroId);
  console.log(`[HubSeed] Alexander county: ${alexander.id} (${alexander.action})`);

  const burke = await findOrCreateCounty("Burke", "BURKE", metroId);
  console.log(`[HubSeed] Burke county: ${burke.id} (${burke.action})`);

  const caldwell = await findOrCreateCounty("Caldwell", "CALDWELL", metroId);
  console.log(`[HubSeed] Caldwell county: ${caldwell.id} (${caldwell.action})`);

  const mcdowell = await findOrCreateCounty("McDowell", "MCDOWELL", metroId);
  console.log(`[HubSeed] McDowell county: ${mcdowell.id} (${mcdowell.action})`);

  const chesterfield = await findOrCreateCounty("Chesterfield", "CHESTERFIELD", metroId);
  console.log(`[HubSeed] Chesterfield county: ${chesterfield.id} (${chesterfield.action})`);

  const parentMap: Record<string, string> = {
    MECK: meck.id,
    YORK: york.id,
    GASTON: gaston.id,
    IREDELL: iredell.id,
    CAB: cab.id,
    UNION: union.id,
    ROWAN: rowan.id,
    STANLY: stanly.id,
    CHESTER: chester.id,
    LANCASTER: lancaster.id,
    LINCOLN: lincoln.id,
    ANSON: anson.id,
    CLEVELAND: cleveland.id,
    CATAWBA: catawba.id,
    ALEXANDER: alexander.id,
    BURKE: burke.id,
    CALDWELL: caldwell.id,
    MCDOWELL: mcdowell.id,
    CHESTERFIELD: chesterfield.id,
  };

  const hubIdMap: Record<string, string> = {};

  for (const hub of NEIGHBORHOOD_HUBS) {
    const { id, action } = await findOrCreateHub(hub.name, hub.code, meck.id);
    hubIdMap[hub.code] = id;

    let center: string | null = null;
    const loc = await ensureHubCenter(id, hub.search);
    if (loc) center = `${loc.lat}, ${loc.lng}`;

    if (hub.lifestyleTags && hub.lifestyleTags.length > 0) {
      await db.update(regions).set({ lifestyleTags: hub.lifestyleTags }).where(eq(regions.id, id));
    }

    result.hubsCreated.push({ name: hub.name, code: hub.code, id, action, center });
    console.log(`[HubSeed] ${action} hub ${hub.name} (${hub.code}): ${id} center=${center || "none"}`);
  }

  for (const hub of TOWN_HUBS) {
    const parentId = parentMap[hub.parentCode];
    const { id, action } = await findOrCreateHub(hub.name, hub.code, parentId);
    hubIdMap[hub.code] = id;

    let center: string | null = null;
    const loc = await ensureHubCenter(id, hub.search);
    if (loc) center = `${loc.lat}, ${loc.lng}`;

    if (hub.lifestyleTags && hub.lifestyleTags.length > 0) {
      await db.update(regions).set({ lifestyleTags: hub.lifestyleTags }).where(eq(regions.id, id));
    }

    result.hubsCreated.push({ name: hub.name, code: hub.code, id, action, center });
    console.log(`[HubSeed] ${action} hub ${hub.name} (${hub.code}): ${id} center=${center || "none"}`);
  }

  const ZIP_GEO_FALLBACKS: Record<string, [string, string]> = {
    "28017": ["35.2471", "-81.6673"], "28023": ["35.5654", "-80.5832"],
    "28037": ["35.4330", "-81.0297"], "28086": ["35.2451", "-81.3412"],
    "28090": ["35.4169", "-81.5466"], "28091": ["35.0231", "-79.8948"],
    "28092": ["35.4737", "-81.2539"], "28097": ["35.2570", "-80.4221"],
    "28098": ["35.2680", "-81.0931"], "28101": ["35.2586", "-81.0746"],
    "28107": ["35.2291", "-80.5019"], "28119": ["34.8619", "-80.0071"],
    "28124": ["35.3941", "-80.4313"], "28133": ["35.0059", "-80.2671"],
    "28135": ["35.0064", "-80.2020"], "28150": ["35.2924", "-81.5456"],
    "28152": ["35.2454", "-81.5150"], "28166": ["35.6989", "-80.8882"],
    "28170": ["34.9663", "-80.0766"], "28601": ["35.7330", "-81.3412"],
    "28602": ["35.7651", "-81.2834"], "28613": ["35.7294", "-81.2178"],
    "28628": ["35.7276", "-81.7778"], "28630": ["35.8010", "-81.4302"],
    "28636": ["35.8110", "-81.0957"], "28638": ["35.8427", "-81.4912"],
    "28645": ["35.9140", "-81.5390"], "28650": ["35.5770", "-81.1771"],
    "28655": ["35.7454", "-81.6849"], "28658": ["35.6697", "-81.2215"],
    "28681": ["35.9221", "-81.1762"], "28687": ["35.8050", "-80.9100"],
    "28690": ["35.7407", "-81.5611"], "28752": ["35.6842", "-82.0093"],
    "28762": ["35.6280", "-82.1753"], "29055": ["34.5711", "-80.9036"],
    "29520": ["34.6978", "-79.8832"], "29706": ["34.7046", "-81.2143"],
    "29707": ["34.7959", "-80.7696"], "29709": ["34.7363", "-80.0880"],
    "29720": ["34.7201", "-80.7714"], "29728": ["34.7735", "-80.3915"],
  };

  const allCoverageZips = new Set<string>();
  for (const entry of COVERAGE_MAP) {
    for (const z of entry.zips) allCoverageZips.add(z);
  }
  let zipsSeeded = 0;
  for (const zip of allCoverageZips) {
    const exists = await zipExists(zip);
    if (!exists) {
      const fallback = ZIP_GEO_FALLBACKS[zip];
      let lat = fallback?.[0] || "35.2271";
      let lng = fallback?.[1] || "-80.8431";
      if (!fallback) {
        try {
          const loc = await placesLookup(`${zip}`);
          if (loc) { lat = loc.lat.toString(); lng = loc.lng.toString(); }
        } catch {}
      }
      try {
        await db.insert(zipGeos).values({
          zip,
          city: "Charlotte Metro",
          state: zip.startsWith("29") ? "SC" : "NC",
          lat,
          lng,
          radiusMeters: 3500,
        }).onConflictDoNothing();
        zipsSeeded++;
        console.log(`[HubSeed] Seeded zip_geo ${zip} (${lat}, ${lng})`);
      } catch (e: any) {
        console.error(`[HubSeed] zip_geo insert error ${zip}: ${e.message}`);
      }
    }
  }
  if (zipsSeeded > 0) console.log(`[HubSeed] Seeded ${zipsSeeded} new zip_geos entries`);

  const missingZipSet = new Set<string>();

  for (const entry of COVERAGE_MAP) {
    const hubId = hubIdMap[entry.hubCode];
    if (!hubId) {
      console.error(`[HubSeed] Hub code ${entry.hubCode} not found in hubIdMap`);
      continue;
    }

    for (const zip of entry.zips) {
      const exists = await zipExists(zip);
      if (!exists) {
        missingZipSet.add(zip);
        console.warn(`[HubSeed] ZIP ${zip} missing from zip_geos, skipping coverage for ${entry.hubCode}`);
        continue;
      }

      try {
        await db.insert(hubZipCoverage).values({
          hubRegionId: hubId,
          zip,
          confidence: entry.confidence,
          notes: "Seeded default; review/edit as needed",
        }).onConflictDoNothing();
        result.coverageMappings.inserted++;
      } catch (e: any) {
        console.error(`[HubSeed] Coverage insert error ${entry.hubCode}→${zip}: ${e.message}`);
        result.coverageMappings.skipped++;
      }
    }
  }

  result.missingZips = Array.from(missingZipSet).sort();
  result.capsRemaining = {
    textsearch: DAILY_TEXTSEARCH_LIMIT - textsearchCount,
    textsearchLimit: DAILY_TEXTSEARCH_LIMIT,
  };

  return result;
}

const isDirectRun = process.argv[1]?.includes("seed-hubs-coverage");
if (isDirectRun) {
  seedHubsAndCoverage().then((result) => {
    console.log("\n========== HUB SEED RESULT ==========");
    console.log(JSON.stringify(result, null, 2));
    console.log("======================================\n");
    process.exit(0);
  }).catch((err) => {
    console.error("Hub seed failed:", err);
    process.exit(1);
  });
}
