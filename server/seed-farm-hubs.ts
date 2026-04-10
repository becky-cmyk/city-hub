import { db } from "./db";
import { territories, cities, regions } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const FARM_MICRO_HUBS = [
  {
    name: "CLT Meat",
    code: "CLT_MEAT",
    slug: "clt-meat",
    description: "Discover locally raised meat in the Charlotte metro area. Find grass-fed beef, pastured pork, heritage poultry, and more from farms near you. Order in bulk, subscribe to monthly shares, or pick up at local markets.",
    linkedCategorySlugs: ["meat-producers", "farms"],
  },
  {
    name: "CLT Farm Boxes",
    code: "CLT_FARM_BOXES",
    slug: "clt-farm-boxes",
    description: "Find CSA subscriptions and farm box programs in Charlotte. Get seasonal produce, meat, eggs, and dairy delivered or available for pickup from local farms across the metro area.",
    linkedCategorySlugs: ["csa-farm-boxes", "farm-coops-buying-clubs"],
  },
  {
    name: "CLT Fresh Eggs",
    code: "CLT_FRESH_EGGS",
    slug: "clt-fresh-eggs",
    description: "Find farm-fresh eggs near Charlotte. Browse pasture-raised, free-range, and specialty eggs from local producers. Learn where to buy weekly eggs from farms in the greater Charlotte area.",
    linkedCategorySlugs: ["egg-producers", "farms"],
  },
  {
    name: "CLT Farmers Markets",
    code: "CLT_FARMERS_MARKETS",
    slug: "clt-farmers-markets",
    description: "Explore farmers markets across the Charlotte metro. Find market days, hours, locations, and vendors. From Saturday morning markets to weeknight pop-ups — shop local food year-round.",
    linkedCategorySlugs: ["farmers-markets", "farm-stores-stands"],
  },
  {
    name: "CLT Local Food",
    code: "CLT_LOCAL_FOOD",
    slug: "clt-local-food",
    description: "Your guide to locally sourced food in the Charlotte area. Discover farms, farm stores, specialty food producers, CSA programs, and farmers markets across the metro region.",
    linkedCategorySlugs: ["local-farms-food-sources", "local-food-specialty", "farm-stores-stands"],
  },
];

export async function seedFarmHubs() {
  const allCities = await db.select().from(cities);
  const charlotte = allCities.find((c) => c.slug === "charlotte");
  if (!charlotte) {
    console.log("[SEED] Charlotte city not found, skipping farm hub seed.");
    return;
  }

  const existing = await db.select().from(territories).where(eq(territories.type, "MICRO"));
  const existingCodes = new Set(existing.map((t) => t.code));

  let parentTerritory = existing.find(t => t.code === "CHARLOTTE_METRO");
  if (!parentTerritory) {
    const [metroT] = await db.select().from(territories).where(eq(territories.code, "CHARLOTTE_METRO"));
    parentTerritory = metroT || null;
  }
  const parentTerritoryId = parentTerritory?.id || null;

  const [metroRegion] = await db.select().from(regions).where(
    and(eq(regions.regionType, "metro"), eq(regions.code, "CLT-METRO"))
  );
  const parentRegionId = metroRegion?.id || null;

  for (const hub of FARM_MICRO_HUBS) {
    if (existingCodes.has(hub.code)) {
      console.log(`[SEED] Farm hub ${hub.code} already exists, skipping.`);
      continue;
    }

    const [territory] = await db
      .insert(territories)
      .values({
        type: "MICRO",
        parentTerritoryId: parentTerritoryId,
        cityId: charlotte.id,
        code: hub.code,
        name: hub.name,
        slug: hub.slug,
        status: "ACTIVE",
        geoType: "CUSTOM",
        geoCodes: hub.linkedCategorySlugs,
      })
      .returning();

    const existingRegion = await db.select().from(regions).where(
      and(eq(regions.code, hub.code), eq(regions.regionType, "hub"))
    );

    if (existingRegion.length === 0) {
      await db.insert(regions).values({
        name: hub.name,
        regionType: "hub",
        code: hub.code,
        parentRegionId: parentRegionId,
        description: hub.description,
        lifestyleTags: ["farm-hub"],
        isActive: true,
      });
    }

    console.log(`[SEED] Created farm micro hub: ${hub.name} (${hub.slug})`);
  }

  console.log("[SEED] Farm micro hubs seeded successfully.");
}
