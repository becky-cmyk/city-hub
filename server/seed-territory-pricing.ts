import { db } from "./db";
import { territories, cities } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const TIER_PRICES: Record<number, number> = {
  1: 100000,
  2: 175000,
  3: 250000,
  4: 350000,
  5: 500000,
  6: 750000,
  7: 1000000,
};

interface HubPricingData {
  county: string;
  name: string;
  code: string;
  zips: string[];
  population: number;
  businesses: number;
  participation: number;
  revenueAt299: number;
  tier: number;
}

const TERRITORY_DATA: HubPricingData[] = [
  { county: "Cabarrus", name: "Concord", code: "CONCORD", zips: ["28025","28027"], population: 105000, businesses: 2000, participation: 100, revenueAt299: 2990000, tier: 6 },
  { county: "Cabarrus", name: "Harrisburg", code: "HARRISBURG", zips: ["28075"], population: 18000, businesses: 320, participation: 16, revenueAt299: 478400, tier: 3 },
  { county: "Cabarrus", name: "Kannapolis", code: "KANNAPOLIS", zips: ["28081","28083"], population: 55000, businesses: 900, participation: 45, revenueAt299: 1345500, tier: 5 },
  { county: "Cabarrus", name: "Midland", code: "MIDLAND", zips: ["28107"], population: 15000, businesses: 250, participation: 12, revenueAt299: 358800, tier: 2 },
  { county: "Cabarrus", name: "Mount Pleasant", code: "MOUNTPLEASANT", zips: ["28124"], population: 10000, businesses: 150, participation: 8, revenueAt299: 239200, tier: 2 },
  { county: "Chester SC", name: "Chester", code: "CHESTER_TOWN", zips: ["29706"], population: 5200, businesses: 110, participation: 6, revenueAt299: 179400, tier: 1 },
  { county: "Chester SC", name: "Great Falls", code: "GREATFALLS", zips: ["29055"], population: 2000, businesses: 40, participation: 2, revenueAt299: 59800, tier: 1 },
  { county: "Gaston", name: "Belmont", code: "BELMONT", zips: ["28012"], population: 13000, businesses: 300, participation: 15, revenueAt299: 448500, tier: 2 },
  { county: "Gaston", name: "Cramerton", code: "CRAMERTON", zips: ["28032"], population: 5000, businesses: 100, participation: 5, revenueAt299: 149500, tier: 1 },
  { county: "Gaston", name: "Gastonia", code: "GASTONIA", zips: ["28052","28054","28056"], population: 80000, businesses: 1600, participation: 80, revenueAt299: 2392000, tier: 6 },
  { county: "Gaston", name: "Lowell", code: "LOWELL", zips: ["28098"], population: 4000, businesses: 80, participation: 4, revenueAt299: 119600, tier: 1 },
  { county: "Gaston", name: "McAdenville", code: "MCADENVILLE", zips: ["28101"], population: 900, businesses: 40, participation: 2, revenueAt299: 59800, tier: 1 },
  { county: "Gaston", name: "Mount Holly", code: "MOUNTHOLLY", zips: ["28120"], population: 18000, businesses: 350, participation: 18, revenueAt299: 538200, tier: 3 },
  { county: "Gaston", name: "Ranlo", code: "RANLO", zips: ["28054"], population: 3500, businesses: 70, participation: 4, revenueAt299: 119600, tier: 1 },
  { county: "Iredell", name: "Mooresville", code: "MOORESVILLE", zips: ["28115","28117"], population: 55000, businesses: 1100, participation: 55, revenueAt299: 1644500, tier: 5 },
  { county: "Iredell", name: "Statesville", code: "STATESVILLE", zips: ["28625","28677","28687"], population: 29000, businesses: 650, participation: 32, revenueAt299: 956800, tier: 4 },
  { county: "Iredell", name: "Troutman", code: "TROUTMAN", zips: ["28166"], population: 3800, businesses: 90, participation: 4, revenueAt299: 119600, tier: 1 },
  { county: "Lancaster SC", name: "Indian Land", code: "INDIANLAND", zips: ["29707"], population: 35000, businesses: 650, participation: 32, revenueAt299: 956800, tier: 4 },
  { county: "Lancaster SC", name: "Lancaster", code: "LANCASTER_TOWN", zips: ["29720"], population: 9000, businesses: 220, participation: 11, revenueAt299: 328900, tier: 2 },
  { county: "Lincoln", name: "Denver", code: "DENVER", zips: ["28037"], population: 28000, businesses: 450, participation: 22, revenueAt299: 657800, tier: 3 },
  { county: "Lincoln", name: "Lincolnton", code: "LINCOLNTON", zips: ["28092"], population: 11000, businesses: 250, participation: 12, revenueAt299: 358800, tier: 2 },
  { county: "Mecklenburg", name: "Ballantyne", code: "BALLANTYNE", zips: ["28277"], population: 85000, businesses: 1600, participation: 80, revenueAt299: 2392000, tier: 6 },
  { county: "Mecklenburg", name: "Cornelius", code: "CORNELIUS", zips: ["28031"], population: 32000, businesses: 600, participation: 30, revenueAt299: 897000, tier: 4 },
  { county: "Mecklenburg", name: "Davidson", code: "DAVIDSON", zips: ["28035","28036"], population: 15000, businesses: 350, participation: 18, revenueAt299: 538200, tier: 3 },
  { county: "Mecklenburg", name: "Huntersville", code: "HUNTERSVILLE", zips: ["28078"], population: 61000, businesses: 1100, participation: 55, revenueAt299: 1644500, tier: 5 },
  { county: "Mecklenburg", name: "Matthews", code: "MATTHEWS", zips: ["28104","28105"], population: 30000, businesses: 650, participation: 32, revenueAt299: 956800, tier: 4 },
  { county: "Mecklenburg", name: "Mint Hill", code: "MINTHILL", zips: ["28227"], population: 27000, businesses: 500, participation: 25, revenueAt299: 747500, tier: 3 },
  { county: "Mecklenburg", name: "Northlake", code: "NORTHLAKE", zips: ["28216"], population: 75000, businesses: 1000, participation: 50, revenueAt299: 1495000, tier: 5 },
  { county: "Mecklenburg", name: "Pineville", code: "PINEVILLE", zips: ["28134"], population: 11000, businesses: 300, participation: 15, revenueAt299: 448500, tier: 2 },
  { county: "Mecklenburg", name: "University City", code: "UNICITY", zips: ["28213","28262"], population: 70000, businesses: 1300, participation: 65, revenueAt299: 1943500, tier: 6 },
  { county: "Mecklenburg", name: "Uptown Charlotte", code: "UPTOWN", zips: ["28202","28203"], population: 45000, businesses: 2300, participation: 115, revenueAt299: 3438500, tier: 7 },
  { county: "Rowan", name: "China Grove", code: "CHINAGROVE", zips: ["28023"], population: 4500, businesses: 100, participation: 5, revenueAt299: 149500, tier: 1 },
  { county: "Rowan", name: "Salisbury", code: "SALISBURY", zips: ["28144","28146","28147"], population: 36000, businesses: 700, participation: 35, revenueAt299: 1046500, tier: 4 },
  { county: "Stanly", name: "Albemarle", code: "ALBEMARLE", zips: ["28001","28002"], population: 16000, businesses: 350, participation: 18, revenueAt299: 538200, tier: 3 },
  { county: "Stanly", name: "Locust", code: "LOCUST", zips: ["28097"], population: 4000, businesses: 100, participation: 5, revenueAt299: 149500, tier: 1 },
  { county: "Union", name: "Indian Trail", code: "INDIANTRAIL", zips: ["28079"], population: 42000, businesses: 700, participation: 35, revenueAt299: 1046500, tier: 4 },
  { county: "Union", name: "Marvin", code: "MARVIN", zips: ["28173"], population: 7000, businesses: 120, participation: 6, revenueAt299: 179400, tier: 1 },
  { county: "Union", name: "Monroe", code: "MONROE", zips: ["28110","28112"], population: 36000, businesses: 750, participation: 38, revenueAt299: 1136200, tier: 4 },
  { county: "Union", name: "Stallings", code: "STALLINGS", zips: ["28104"], population: 17000, businesses: 300, participation: 15, revenueAt299: 448500, tier: 2 },
  { county: "Union", name: "Waxhaw", code: "WAXHAW", zips: ["28173"], population: 23000, businesses: 450, participation: 22, revenueAt299: 657800, tier: 3 },
  { county: "Union", name: "Weddington", code: "WEDDINGTON", zips: ["28104"], population: 14000, businesses: 250, participation: 12, revenueAt299: 358800, tier: 2 },
  { county: "Union", name: "Wesley Chapel", code: "WESLEYCHAPEL", zips: ["28104"], population: 9000, businesses: 150, participation: 8, revenueAt299: 239200, tier: 2 },
  { county: "York SC", name: "Clover", code: "CLOVER", zips: ["29710"], population: 7000, businesses: 200, participation: 10, revenueAt299: 299000, tier: 2 },
  { county: "York SC", name: "Fort Mill", code: "FORTMILL", zips: ["29715","29708"], population: 28000, businesses: 700, participation: 35, revenueAt299: 1046500, tier: 4 },
  { county: "York SC", name: "Lake Wylie", code: "LAKEWYLIE", zips: ["29710"], population: 18000, businesses: 350, participation: 18, revenueAt299: 538200, tier: 3 },
  { county: "York SC", name: "Rock Hill", code: "ROCKHILL", zips: ["29730","29732","29733"], population: 75000, businesses: 1400, participation: 70, revenueAt299: 2093000, tier: 6 },
  { county: "York SC", name: "Tega Cay", code: "TEGACAY", zips: ["29708"], population: 12000, businesses: 250, participation: 12, revenueAt299: 358800, tier: 2 },
  { county: "York SC", name: "York", code: "YORK_TOWN", zips: ["29745"], population: 8000, businesses: 180, participation: 9, revenueAt299: 269100, tier: 2 },
  { county: "Anson", name: "Wadesboro", code: "WADESBORO", zips: ["28170"], population: 5300, businesses: 120, participation: 6, revenueAt299: 179400, tier: 1 },
  { county: "Anson", name: "Polkton", code: "POLKTON", zips: ["28135"], population: 3300, businesses: 70, participation: 4, revenueAt299: 119600, tier: 1 },
  { county: "Anson", name: "Peachland", code: "PEACHLAND", zips: ["28133"], population: 400, businesses: 20, participation: 1, revenueAt299: 29900, tier: 1 },
  { county: "Anson", name: "Morven", code: "MORVEN", zips: ["28119"], population: 500, businesses: 25, participation: 1, revenueAt299: 29900, tier: 1 },
  { county: "Anson", name: "Lilesville", code: "LILESVILLE", zips: ["28091"], population: 500, businesses: 25, participation: 1, revenueAt299: 29900, tier: 1 },
  { county: "Cleveland", name: "Shelby", code: "SHELBY", zips: ["28150","28152"], population: 21000, businesses: 550, participation: 28, revenueAt299: 837200, tier: 4 },
  { county: "Cleveland", name: "Kings Mountain", code: "KINGSMOUNTAIN", zips: ["28086"], population: 11000, businesses: 260, participation: 13, revenueAt299: 388700, tier: 2 },
  { county: "Cleveland", name: "Boiling Springs", code: "BOILINGSPRINGS", zips: ["28017"], population: 4500, businesses: 120, participation: 6, revenueAt299: 179400, tier: 1 },
  { county: "Cleveland", name: "Lawndale", code: "LAWNDALE", zips: ["28090"], population: 600, businesses: 25, participation: 1, revenueAt299: 29900, tier: 1 },
  { county: "Catawba", name: "Hickory", code: "HICKORY", zips: ["28601","28602"], population: 43000, businesses: 950, participation: 48, revenueAt299: 1435200, tier: 5 },
  { county: "Catawba", name: "Newton", code: "NEWTON", zips: ["28658"], population: 13000, businesses: 250, participation: 12, revenueAt299: 358800, tier: 2 },
  { county: "Catawba", name: "Conover", code: "CONOVER", zips: ["28613"], population: 8500, businesses: 200, participation: 10, revenueAt299: 299000, tier: 2 },
  { county: "Catawba", name: "Maiden", code: "MAIDEN", zips: ["28650"], population: 3500, businesses: 90, participation: 4, revenueAt299: 119600, tier: 1 },
  { county: "Alexander", name: "Taylorsville", code: "TAYLORSVILLE", zips: ["28681"], population: 2300, businesses: 80, participation: 4, revenueAt299: 119600, tier: 1 },
  { county: "Alexander", name: "Hiddenite", code: "HIDDENITE", zips: ["28636"], population: 300, businesses: 20, participation: 1, revenueAt299: 29900, tier: 1 },
  { county: "Burke", name: "Morganton", code: "MORGANTON", zips: ["28655"], population: 17000, businesses: 400, participation: 20, revenueAt299: 598000, tier: 3 },
  { county: "Burke", name: "Valdese", code: "VALDESE", zips: ["28690"], population: 4500, businesses: 120, participation: 6, revenueAt299: 179400, tier: 1 },
  { county: "Burke", name: "Glen Alpine", code: "GLENALPINE", zips: ["28628"], population: 1500, businesses: 40, participation: 2, revenueAt299: 59800, tier: 1 },
  { county: "Caldwell", name: "Lenoir", code: "LENOIR", zips: ["28645"], population: 18000, businesses: 450, participation: 22, revenueAt299: 657800, tier: 3 },
  { county: "Caldwell", name: "Granite Falls", code: "GRANITEFALLS", zips: ["28630"], population: 4900, businesses: 130, participation: 6, revenueAt299: 179400, tier: 1 },
  { county: "Caldwell", name: "Hudson", code: "HUDSON", zips: ["28638"], population: 3700, businesses: 110, participation: 6, revenueAt299: 179400, tier: 1 },
  { county: "McDowell", name: "Marion", code: "MARION", zips: ["28752"], population: 8000, businesses: 220, participation: 11, revenueAt299: 328900, tier: 2 },
  { county: "McDowell", name: "Old Fort", code: "OLDFORT", zips: ["28762"], population: 1000, businesses: 40, participation: 2, revenueAt299: 59800, tier: 1 },
  { county: "Chesterfield SC", name: "Cheraw", code: "CHERAW", zips: ["29520"], population: 5600, businesses: 180, participation: 9, revenueAt299: 269100, tier: 2 },
  { county: "Chesterfield SC", name: "Chesterfield", code: "CHESTERFIELD_TOWN", zips: ["29709"], population: 1400, businesses: 50, participation: 2, revenueAt299: 59800, tier: 1 },
  { county: "Chesterfield SC", name: "Pageland", code: "PAGELAND", zips: ["29728"], population: 2800, businesses: 80, participation: 4, revenueAt299: 119600, tier: 1 },
];

export async function seedTerritoryPricing(): Promise<{ created: number; updated: number; skipped: number }> {
  const [charlotte] = await db.select().from(cities).where(eq(cities.slug, "charlotte"));
  if (!charlotte) {
    console.log("[TerritoryPricing] No charlotte city found, skipping");
    return { created: 0, updated: 0, skipped: 0 };
  }

  const metroTerritory = await db.select().from(territories)
    .where(and(eq(territories.type, "METRO"), eq(territories.cityId, charlotte.id)));
  let metroId: string;
  if (metroTerritory.length > 0) {
    metroId = metroTerritory[0].id;
  } else {
    const [metro] = await db.insert(territories).values({
      type: "METRO",
      cityId: charlotte.id,
      code: "CLT_METRO",
      name: "Charlotte Metro",
      status: "ACTIVE",
      geoType: "CUSTOM",
      geoCodes: [],
    }).returning();
    metroId = metro.id;
    console.log("[TerritoryPricing] Created CLT_METRO parent territory");
  }

  let created = 0, updated = 0, skipped = 0;

  for (const hub of TERRITORY_DATA) {
    const price = TIER_PRICES[hub.tier];
    const existing = await db.select().from(territories).where(eq(territories.code, hub.code));

    if (existing.length > 0) {
      const t = existing[0];
      if (t.pricingTier !== hub.tier || t.territoryPrice !== price || t.population !== hub.population) {
        await db.update(territories).set({
          pricingTier: hub.tier,
          territoryPrice: price,
          population: hub.population,
          businessCount: hub.businesses,
          participationTarget: hub.participation,
          projectedRevenue: hub.revenueAt299,
          geoType: "TOWN",
          geoCodes: hub.zips,
          updatedAt: new Date(),
        }).where(eq(territories.id, t.id));
        updated++;
      } else {
        skipped++;
      }
    } else {
      await db.insert(territories).values({
        type: "MICRO",
        parentTerritoryId: metroId,
        cityId: charlotte.id,
        code: hub.code,
        name: hub.name,
        status: "ACTIVE",
        geoType: "TOWN",
        geoCodes: hub.zips,
        pricingTier: hub.tier,
        territoryPrice: price,
        population: hub.population,
        businessCount: hub.businesses,
        participationTarget: hub.participation,
        projectedRevenue: hub.revenueAt299,
        saleStatus: "AVAILABLE",
      });
      created++;
    }
  }

  console.log(`[TerritoryPricing] Done: ${created} created, ${updated} updated, ${skipped} skipped`);
  return { created, updated, skipped };
}
