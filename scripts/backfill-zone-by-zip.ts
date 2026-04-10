import { db } from "../server/db";
import { businesses, zones, cities } from "../shared/schema";
import { eq, and, sql } from "drizzle-orm";

const CHARLOTTE_ZIP_ZONE_MAP: Record<string, string> = {
  "28202": "uptown", "28203": "south-end", "28204": "elizabeth",
  "28205": "plaza-midwood", "28206": "noda", "28207": "myers-park",
  "28208": "seversville", "28209": "dilworth", "28210": "southpark",
  "28211": "southpark", "28212": "eastway", "28213": "university-city",
  "28214": "northlake", "28215": "eastway", "28216": "northlake",
  "28217": "steele-creek", "28226": "providence", "28227": "east-forest",
  "28244": "uptown", "28246": "uptown", "28262": "university-city",
  "28269": "northlake", "28270": "providence", "28273": "steele-creek",
  "28274": "myers-park", "28277": "ballantyne", "28278": "steele-creek",
  "28036": "davidson", "28031": "cornelius", "28078": "huntersville",
  "28105": "matthews", "28134": "pineville", "28173": "waxhaw",
  "28104": "indian-trail", "28079": "indian-trail",
  "28025": "concord", "28027": "concord", "28075": "harrisburg",
  "28052": "gastonia", "28054": "gastonia", "28056": "gastonia",
  "28012": "belmont", "28120": "mount-holly",
  "28098": "lake-wylie", "28106": "mint-hill",
  "28174": "monroe", "28110": "monroe", "28117": "mooresville",
  "28115": "mooresville", "28150": "mount-pleasant",
  "28023": "cornelius", "28035": "huntersville",
  "28037": "denver", "28164": "lincolnton",
  "29708": "fort-mill", "29715": "fort-mill",
  "29707": "fort-mill", "29036": "fort-mill",
  "29720": "rock-hill", "29732": "rock-hill",
  "29710": "indian-land", "29745": "york-town",
  "29614": "tega-cay",
};

async function backfillZoneByZip() {
  const isDryRun = process.argv.includes("--dry-run");
  const citySlug = process.argv.find(a => a.startsWith("--city="))?.split("=")[1] || "charlotte";

  const [city] = await db.select().from(cities).where(eq(cities.slug, citySlug)).limit(1);
  if (!city) {
    console.error(`City "${citySlug}" not found. Use --city=<slug> to specify.`);
    process.exit(1);
  }
  console.log(`Scoped to city: ${city.name} (${city.id})`);

  const allZones = await db.select().from(zones).where(eq(zones.cityId, city.id));
  const zoneBySlug = new Map(allZones.map(z => [z.slug, z]));
  const zoneById = new Map(allZones.map(z => [z.id, z]));

  const allBiz = await db.select({
    id: businesses.id,
    name: businesses.name,
    zip: businesses.zip,
    zoneId: businesses.zoneId,
    address: businesses.address,
  }).from(businesses).where(eq(businesses.cityId, city.id));

  console.log(`Found ${allBiz.length} total businesses`);

  let corrected = 0;
  let alreadyCorrect = 0;
  let noZip = 0;
  let unmappedZips: { name: string; zip: string; id: string }[] = [];

  for (const biz of allBiz) {
    let zip = biz.zip;

    if (!zip && biz.address) {
      const match = biz.address.match(/\b(\d{5})(?:-\d{4})?\b/);
      if (match) zip = match[1];
    }

    if (!zip) {
      noZip++;
      continue;
    }

    const expectedZoneSlug = CHARLOTTE_ZIP_ZONE_MAP[zip];

    if (!expectedZoneSlug) {
      unmappedZips.push({ name: biz.name, zip, id: biz.id });
      continue;
    }

    const expectedZone = zoneBySlug.get(expectedZoneSlug);
    if (!expectedZone) {
      console.warn(`[WARN] Zone slug "${expectedZoneSlug}" from ZIP map not found in database for business "${biz.name}" (${biz.id})`);
      continue;
    }

    if (biz.zoneId === expectedZone.id) {
      alreadyCorrect++;
      continue;
    }

    const currentZone = zoneById.get(biz.zoneId);
    const currentSlug = currentZone?.slug || "unknown";

    if (isDryRun) {
      console.log(`[DRY-RUN] Would correct: "${biz.name}" ZIP=${zip} from zone "${currentSlug}" → "${expectedZoneSlug}"`);
    } else {
      await db.update(businesses).set({
        zoneId: expectedZone.id,
        needsZoneReview: false,
      }).where(eq(businesses.id, biz.id));
      console.log(`[CORRECTED] "${biz.name}" ZIP=${zip}: "${currentSlug}" → "${expectedZoneSlug}"`);
    }
    corrected++;
  }

  console.log(`\n=== BACKFILL SUMMARY ===`);
  console.log(`Total businesses: ${allBiz.length}`);
  console.log(`Already correct: ${alreadyCorrect}`);
  console.log(`Corrected: ${corrected}${isDryRun ? " (dry-run)" : ""}`);
  console.log(`No ZIP available: ${noZip}`);
  console.log(`Unmapped ZIPs: ${unmappedZips.length}`);

  if (unmappedZips.length > 0) {
    console.log(`\n=== BUSINESSES WITH UNMAPPED ZIPS (manual review needed) ===`);
    const uniqueZips = [...new Set(unmappedZips.map(b => b.zip))].sort();
    console.log(`Unique unmapped ZIP codes: ${uniqueZips.join(", ")}`);
    for (const biz of unmappedZips) {
      console.log(`  - "${biz.name}" ZIP=${biz.zip} ID=${biz.id}`);
    }

    if (!isDryRun) {
      const unmappedIds = unmappedZips.map(b => b.id);
      for (const id of unmappedIds) {
        await db.update(businesses).set({ needsZoneReview: true }).where(eq(businesses.id, id));
      }
      console.log(`\nFlagged ${unmappedIds.length} businesses with needsZoneReview=true`);
    }
  }

  process.exit(0);
}

backfillZoneByZip().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
