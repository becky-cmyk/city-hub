import { db } from "../server/db";
import { cities, zones, metroSources } from "../shared/schema";
import { eq, and } from "drizzle-orm";

const INDIANAPOLIS_ZIPS = [
  "46201", "46202", "46203", "46204", "46205",
  "46206", "46207", "46208", "46209", "46210",
  "46211", "46214", "46216", "46217", "46218",
  "46219", "46220", "46221", "46222", "46224",
  "46225", "46226", "46227", "46228", "46229",
  "46231", "46234", "46235", "46236", "46237",
  "46239", "46240", "46241", "46250", "46254",
  "46256", "46259", "46260",
];

async function seedMetroSources() {
  console.log("[SEED] Starting metro sources seed...");

  const existingCities = await db.select().from(cities);
  let charlotteCity = existingCities.find((c) => c.slug === "charlotte");
  let indyCity = existingCities.find((c) => c.slug === "indianapolis");

  if (!charlotteCity) {
    console.log("[SEED] Charlotte city not found — creating...");
    const [created] = await db
      .insert(cities)
      .values({
        name: "Charlotte",
        slug: "charlotte",
        cityCode: "CLT",
        brandName: "CLT Metro Hub",
        aiGuideName: "Charlotte",
        isActive: true,
      })
      .returning();
    charlotteCity = created;
  }
  console.log(`[SEED] Charlotte city ID: ${charlotteCity.id}`);

  if (!indyCity) {
    const indyByName = existingCities.find((c) => c.name === "Indianapolis");
    if (indyByName) {
      indyCity = indyByName;
      console.log(`[SEED] Indianapolis found by name (slug: ${indyByName.slug}), ID: ${indyCity.id}`);
    } else {
      console.log("[SEED] Indianapolis city not found — creating as inactive (use Metro Management to activate)...");
      const [created] = await db
        .insert(cities)
        .values({
          name: "Indianapolis",
          slug: "indianapolis",
          cityCode: "IND",
          brandName: "Indy City Hub",
          aiGuideName: "Indy",
          isActive: false,
        })
        .returning();
      indyCity = created;
      console.log(`[SEED] Created Indianapolis city ID: ${indyCity.id}`);
    }
  } else {
    console.log(`[SEED] Indianapolis already exists, ID: ${indyCity.id}`);
  }

  const existingIndyZones = await db
    .select()
    .from(zones)
    .where(eq(zones.cityId, indyCity.id));

  if (existingIndyZones.length === 0) {
    console.log("[SEED] Seeding Indianapolis ZIP zones...");
    for (const zip of INDIANAPOLIS_ZIPS) {
      await db.insert(zones).values({
        cityId: indyCity.id,
        name: `Indianapolis ${zip}`,
        slug: `indy-${zip}`,
        type: "ZIP",
        county: "Marion",
        stateCode: "IN",
        zipCodes: [zip],
        isActive: true,
      });
    }
    console.log(`[SEED] Seeded ${INDIANAPOLIS_ZIPS.length} Indianapolis ZIP zones`);
  } else {
    console.log(`[SEED] Indianapolis already has ${existingIndyZones.length} zones, skipping ZIP seed`);
  }

  const existingSources = await db.select().from(metroSources);
  const existingSourceKeys = new Set(
    existingSources.map((s) => `${s.cityId}:${s.sourceType}`)
  );

  const sourcesToCreate = [
    {
      cityId: charlotteCity.id,
      name: "Charlotte Open Data",
      sourceType: "SOCRATA" as const,
      baseUrl: "https://data.charlottenc.gov",
      datasetId: null,
      layerUrl: null,
      paramsJson: {},
      pullFrequency: "DAILY" as const,
      enabled: false,
    },
    {
      cityId: charlotteCity.id,
      name: "Mecklenburg County GIS",
      sourceType: "ARCGIS" as const,
      baseUrl: null,
      datasetId: null,
      layerUrl: "https://maps.mecknc.gov/agsadaptor/rest/services",
      paramsJson: {},
      pullFrequency: "WEEKLY" as const,
      enabled: false,
    },
    {
      cityId: charlotteCity.id,
      name: "Charlotte ACS Demographics",
      sourceType: "CENSUS" as const,
      baseUrl: "https://api.census.gov",
      datasetId: null,
      layerUrl: null,
      paramsJson: {
        dataset: "acs/acs5",
        year: 2022,
        getFields: "B01003_001E,B16001_001E,B16001_002E,B16001_003E",
        forGeo: "zip code tabulation area:*",
        inGeo: "state:37",
      },
      pullFrequency: "MONTHLY" as const,
      enabled: true,
    },
    {
      cityId: charlotteCity.id,
      name: "Charlotte Employment",
      sourceType: "BLS" as const,
      baseUrl: "https://api.bls.gov",
      datasetId: null,
      layerUrl: null,
      paramsJson: {
        seriesId: "LAUCN371190000000003",
        startYear: 2022,
        endYear: 2024,
      },
      pullFrequency: "MONTHLY" as const,
      enabled: false,
    },
    {
      cityId: indyCity.id,
      name: "Indianapolis Open Data",
      sourceType: "SOCRATA" as const,
      baseUrl: "https://data.indy.gov",
      datasetId: null,
      layerUrl: null,
      paramsJson: {},
      pullFrequency: "DAILY" as const,
      enabled: false,
    },
    {
      cityId: indyCity.id,
      name: "Marion County GIS",
      sourceType: "ARCGIS" as const,
      baseUrl: null,
      datasetId: null,
      layerUrl: "https://maps.indy.gov/arcgis/rest/services",
      paramsJson: {},
      pullFrequency: "WEEKLY" as const,
      enabled: false,
    },
    {
      cityId: indyCity.id,
      name: "Indianapolis ACS Demographics",
      sourceType: "CENSUS" as const,
      baseUrl: "https://api.census.gov",
      datasetId: null,
      layerUrl: null,
      paramsJson: {
        dataset: "acs/acs5",
        year: 2022,
        getFields: "B01003_001E,B16001_001E,B16001_002E,B16001_003E",
        forGeo: "zip code tabulation area:*",
        inGeo: "state:18",
      },
      pullFrequency: "MONTHLY" as const,
      enabled: true,
    },
    {
      cityId: indyCity.id,
      name: "Indianapolis Employment",
      sourceType: "BLS" as const,
      baseUrl: "https://api.bls.gov",
      datasetId: null,
      layerUrl: null,
      paramsJson: {
        seriesId: "LAUCN180970000000003",
        startYear: 2022,
        endYear: 2024,
      },
      pullFrequency: "MONTHLY" as const,
      enabled: false,
    },
  ];

  let created = 0;
  let skipped = 0;

  for (const source of sourcesToCreate) {
    const key = `${source.cityId}:${source.sourceType}`;
    if (existingSourceKeys.has(key)) {
      console.log(`[SEED] Skipping ${source.name} — already exists for city`);
      skipped++;
      continue;
    }
    await db.insert(metroSources).values(source);
    console.log(`[SEED] Created source: ${source.name} (${source.sourceType}, enabled=${source.enabled})`);
    created++;
  }

  console.log(`\n[SEED] Done! Created ${created} sources, skipped ${skipped}`);

  const finalSources = await db.select().from(metroSources);
  console.log(`[SEED] Total metro_sources in DB: ${finalSources.length}`);

  const finalIndyZones = await db
    .select()
    .from(zones)
    .where(eq(zones.cityId, indyCity.id));
  console.log(`[SEED] Total Indianapolis zones: ${finalIndyZones.length}`);

  process.exit(0);
}

seedMetroSources().catch((err) => {
  console.error("[SEED] Fatal error:", err);
  process.exit(1);
});
