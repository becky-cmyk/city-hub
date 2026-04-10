import { db } from "../server/db";
import { cities, zones, placeImportJobs } from "../shared/schema";
import { eq, and } from "drizzle-orm";
import { runImportJob } from "../server/google-places";

const CATEGORIES = [
  "restaurants",
  "coffee shops",
  "bars and breweries",
  "gyms and fitness",
  "salons and barbers",
  "auto repair",
  "retail shops",
  "professional services",
  "medical and dental",
  "real estate offices",
];

const HUB_EXTRA_CATEGORIES: Record<string, string[]> = {
  "noda": [
    "art galleries",
    "tattoo shops",
    "music venues",
    "yoga studios",
    "boutiques and vintage shops",
    "bakeries and dessert shops",
    "pet stores and groomers",
    "photography studios",
    "event venues",
    "muralists and art studios",
  ],
};

const HUB_SEARCH_NAMES: Record<string, string> = {
  "uptown": "Uptown Charlotte NC",
  "noda": "NoDa Charlotte NC",
  "plaza-midwood": "Plaza Midwood Charlotte NC",
  "south-end": "South End Charlotte NC",
  "dilworth": "Dilworth Charlotte NC",
  "myers-park": "Myers Park Charlotte NC",
  "elizabeth": "Elizabeth Charlotte NC",
  "southpark": "SouthPark Charlotte NC",
  "cotswold": "Cotswold Charlotte NC",
  "university-city": "University City Charlotte NC",
  "steele-creek": "Steele Creek Charlotte NC",
  "ballantyne": "Ballantyne Charlotte NC",
  "loso": "LoSo Charlotte NC",
  "west-end": "West End Charlotte NC",
  "northlake": "Northlake Charlotte NC",
  "rock-hill": "Rock Hill SC",
  "lake-wylie": "Lake Wylie SC",
  "fort-mill": "Fort Mill SC",
  "tega-cay": "Tega Cay SC",
  "clover": "Clover SC",
  "york-town": "York SC",
  "gastonia": "Gastonia NC",
  "belmont": "Belmont NC",
  "mount-holly": "Mount Holly NC",
  "cramerton": "Cramerton NC",
  "lowell": "Lowell NC",
  "mcadenville": "McAdenville NC",
  "ranlo": "Ranlo NC",
  "huntersville": "Huntersville NC",
  "cornelius": "Cornelius NC",
  "davidson": "Davidson NC",
  "matthews": "Matthews NC",
  "mint-hill": "Mint Hill NC",
  "pineville": "Pineville NC",
  "mooresville": "Mooresville NC",
  "statesville": "Statesville NC",
  "troutman": "Troutman NC",
  "concord": "Concord NC",
  "kannapolis": "Kannapolis NC",
  "harrisburg": "Harrisburg NC",
  "midland": "Midland NC",
  "mount-pleasant": "Mount Pleasant NC",
  "indian-trail": "Indian Trail NC",
  "waxhaw": "Waxhaw NC",
  "weddington": "Weddington NC",
  "stallings": "Stallings NC",
  "monroe": "Monroe NC",
  "marvin": "Marvin NC",
  "wesley-chapel": "Wesley Chapel NC",
  "salisbury": "Salisbury NC",
  "china-grove": "China Grove NC",
  "albemarle": "Albemarle NC",
  "locust": "Locust NC",
  "chester": "Chester SC",
  "great-falls": "Great Falls SC",
  "indian-land": "Indian Land SC",
  "lancaster": "Lancaster SC",
  "denver": "Denver NC",
  "lincolnton": "Lincolnton NC",
  "wadesboro": "Wadesboro NC",
  "polkton": "Polkton NC",
  "peachland": "Peachland NC",
  "morven": "Morven NC",
  "lilesville": "Lilesville NC",
  "shelby": "Shelby NC",
  "kings-mountain": "Kings Mountain NC",
  "boiling-springs": "Boiling Springs NC",
  "lawndale": "Lawndale NC",
  "hickory": "Hickory NC",
  "newton": "Newton NC",
  "conover": "Conover NC",
  "maiden": "Maiden NC",
  "taylorsville": "Taylorsville NC",
  "hiddenite": "Hiddenite NC",
  "morganton": "Morganton NC",
  "valdese": "Valdese NC",
  "glen-alpine": "Glen Alpine NC",
  "lenoir": "Lenoir NC",
  "granite-falls": "Granite Falls NC",
  "hudson": "Hudson NC",
  "marion": "Marion NC",
  "old-fort": "Old Fort NC",
  "cheraw": "Cheraw SC",
  "chesterfield": "Chesterfield SC",
  "pageland": "Pageland SC",
};

const BATCH_PAUSE_MS = 5000;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const args = process.argv.slice(2);
  const hubSlug = args.find((a) => !a.startsWith("--"));
  const isDryRun = args.includes("--dry-run");
  const resultsPerCategory = parseInt(args.find((a) => a.startsWith("--count="))?.split("=")[1] || "10");

  if (!hubSlug) {
    console.log("Usage: npx tsx scripts/seed-hub-businesses.ts <hub-slug> [--dry-run] [--count=10]");
    console.log("");
    console.log("Available hub slugs:");
    const slugs = Object.keys(HUB_SEARCH_NAMES).sort();
    for (let i = 0; i < slugs.length; i += 5) {
      console.log("  " + slugs.slice(i, i + 5).join(", "));
    }
    process.exit(0);
  }

  const searchName = HUB_SEARCH_NAMES[hubSlug];
  if (!searchName) {
    console.error(`[SeedHub] Unknown hub slug: "${hubSlug}"`);
    console.log("Run without arguments to see available slugs.");
    process.exit(1);
  }

  const extraCats = HUB_EXTRA_CATEGORIES[hubSlug] || [];
  const allCategories = [...CATEGORIES, ...extraCats];

  console.log(`[SeedHub] Hub: ${hubSlug} → "${searchName}"`);
  console.log(`[SeedHub] Categories: ${allCategories.length} (${CATEGORIES.length} base + ${extraCats.length} hub-specific), results per category: ${resultsPerCategory}`);

  if (isDryRun) {
    console.log(`\n[SeedHub] DRY RUN — showing queries that would be executed:\n`);
    for (let i = 0; i < allCategories.length; i++) {
      console.log(`  ${i + 1}. "${allCategories[i]} in ${searchName}"`);
    }
    console.log(`\n[SeedHub] Total: ${allCategories.length} Google Places text searches`);
    console.log(`[SeedHub] Estimated results: ${allCategories.length * resultsPerCategory} businesses (with dedup)`);
    process.exit(0);
  }

  const [charlotte] = await db
    .select()
    .from(cities)
    .where(eq(cities.slug, "charlotte"))
    .limit(1);

  if (!charlotte) {
    console.error("[SeedHub] Charlotte city not found in database. Aborting.");
    process.exit(1);
  }

  const zone = await db
    .select()
    .from(zones)
    .where(and(eq(zones.cityId, charlotte.id), eq(zones.slug, hubSlug)))
    .limit(1);

  if (zone.length > 0) {
    console.log(`[SeedHub] Zone found: ${zone[0].name} (${zone[0].id})`);
  } else {
    console.log(`[SeedHub] No zone with slug "${hubSlug}" — businesses will be assigned by ZIP matching`);
  }

  let totalImported = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (let i = 0; i < allCategories.length; i++) {
    const category = allCategories[i];
    const query = `${category} in ${searchName}`;
    console.log(`\n[SeedHub] ${i + 1}/${allCategories.length}: "${query}"`);

    try {
      const [job] = await db
        .insert(placeImportJobs)
        .values({
          mode: "text_search",
          areaMode: "clt_default",
          queryText: query,
          categoryKeyword: category,
          requestedCount: resultsPerCategory,
          autoPublish: false,
          status: "queued",
        })
        .returning();

      const summary = await runImportJob(job.id);
      console.log(`[SeedHub] Result: imported=${summary.imported}, skipped=${summary.skipped}, failed=${summary.failed}`);

      totalImported += summary.imported;
      totalSkipped += summary.skipped;
      totalFailed += summary.failed;
    } catch (err: any) {
      if (err.message.includes("Daily") && err.message.includes("limit")) {
        console.warn(`\n[SeedHub] Daily API limit reached. Stopping early.`);
        console.log(`[SeedHub] Re-run tomorrow to continue seeding this hub.`);
        break;
      }
      console.error(`[SeedHub] Error: ${err.message}`);
      totalFailed++;
    }

    await sleep(BATCH_PAUSE_MS);
  }

  console.log(`\n[SeedHub] === ${hubSlug.toUpperCase()} COMPLETE ===`);
  console.log(`[SeedHub] Imported: ${totalImported}`);
  console.log(`[SeedHub] Skipped (duplicates): ${totalSkipped}`);
  console.log(`[SeedHub] Failed: ${totalFailed}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("[SeedHub] Fatal error:", err);
  process.exit(1);
});
