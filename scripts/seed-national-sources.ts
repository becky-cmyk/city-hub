import { db } from "../server/db";
import { cities, metroSources } from "../shared/schema";
import { eq, and } from "drizzle-orm";

const CHARLOTTE_CITY_ID = "b0d970f5-cfd6-475b-8739-cfd5352094c4";

async function seedNationalSources() {
  console.log("[SEED-NATIONAL] Starting national seeding sources...");

  const [charlotte] = await db
    .select()
    .from(cities)
    .where(eq(cities.id, CHARLOTTE_CITY_ID))
    .limit(1);

  if (!charlotte) {
    console.error("[SEED-NATIONAL] Charlotte city not found!");
    process.exit(1);
  }
  console.log(`[SEED-NATIONAL] Charlotte city found: ${charlotte.name} (${charlotte.id})`);

  const existing = await db
    .select()
    .from(metroSources)
    .where(eq(metroSources.cityId, CHARLOTTE_CITY_ID));

  const existingKeys = new Set(
    existing.map((s) => `${s.cityId}:${s.sourceType}:${s.name}`)
  );

  const sources = [
    {
      cityId: CHARLOTTE_CITY_ID,
      name: "Charlotte OSM Businesses",
      sourceType: "OSM_OVERPASS" as const,
      baseUrl: "https://overpass-api.de/api/interpreter",
      datasetId: null,
      layerUrl: null,
      paramsJson: {
        bbox: { south: 35.05, west: -81.01, north: 35.40, east: -80.65 },
        tags: ["amenity", "shop", "office"],
        limit: 10,
      },
      pullFrequency: "WEEKLY" as const,
      enabled: true,
    },
    {
      cityId: CHARLOTTE_CITY_ID,
      name: "Charlotte IRS Nonprofits",
      sourceType: "IRS_EO" as const,
      baseUrl: "https://www.irs.gov/pub/irs-soi/eo1.csv",
      datasetId: null,
      layerUrl: null,
      paramsJson: {
        stateCode: "NC",
        zipPrefixes: ["282"],
        limit: 10,
      },
      pullFrequency: "MONTHLY" as const,
      enabled: true,
    },
    {
      cityId: CHARLOTTE_CITY_ID,
      name: "Charlotte Eventbrite Events",
      sourceType: "EVENTBRITE" as const,
      baseUrl: "https://www.eventbriteapi.com",
      datasetId: null,
      layerUrl: null,
      paramsJson: {
        location: "Charlotte",
        latitude: 35.2271,
        longitude: -80.8431,
        withinMiles: 25,
        limit: 10,
      },
      pullFrequency: "DAILY" as const,
      enabled: false,
    },
    {
      cityId: CHARLOTTE_CITY_ID,
      name: "Charlotte USAJOBS",
      sourceType: "USAJOBS" as const,
      baseUrl: "https://data.usajobs.gov",
      datasetId: null,
      layerUrl: null,
      paramsJson: {
        locationName: "Charlotte, North Carolina",
        radius: 25,
        limit: 10,
      },
      pullFrequency: "DAILY" as const,
      enabled: false,
    },
  ];

  let created = 0;
  let skipped = 0;

  for (const source of sources) {
    const key = `${source.cityId}:${source.sourceType}:${source.name}`;
    if (existingKeys.has(key)) {
      console.log(`[SEED-NATIONAL] Skipping ${source.name} — already exists`);
      skipped++;
      continue;
    }
    await db.insert(metroSources).values(source);
    console.log(`[SEED-NATIONAL] Created: ${source.name} (${source.sourceType}, enabled=${source.enabled})`);
    created++;
  }

  console.log(`\n[SEED-NATIONAL] Done! Created ${created}, skipped ${skipped}`);
  process.exit(0);
}

seedNationalSources().catch((err) => {
  console.error("[SEED-NATIONAL] Fatal error:", err);
  process.exit(1);
});
