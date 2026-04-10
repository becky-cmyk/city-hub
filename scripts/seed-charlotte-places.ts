import { db } from "../server/db";
import { cities, placeImportJobs } from "../shared/schema";
import { eq } from "drizzle-orm";
import { runImportJob } from "../server/google-places";

const NEIGHBORHOODS = [
  "Uptown Charlotte",
  "NoDa Charlotte",
  "South End Charlotte",
  "Plaza Midwood Charlotte",
  "Dilworth Charlotte",
  "Myers Park Charlotte",
  "University City Charlotte",
  "Ballantyne Charlotte",
  "Huntersville NC",
  "Matthews NC",
  "Gastonia NC",
  "Rock Hill SC",
  "Concord NC",
  "Mooresville NC",
];

const CATEGORIES = [
  "restaurants",
  "coffee shops",
  "bars and breweries",
  "gyms and fitness",
  "salons and barbers",
];

const BATCH_PAUSE_MS = 5000;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log("[SeedCharlotte] Starting Charlotte business seeding...");

  const [charlotte] = await db
    .select()
    .from(cities)
    .where(eq(cities.slug, "charlotte"))
    .limit(1);

  if (!charlotte) {
    console.error("[SeedCharlotte] Charlotte city not found in database. Aborting.");
    process.exit(1);
  }

  console.log(`[SeedCharlotte] City: ${charlotte.name} (${charlotte.id})`);
  console.log(`[SeedCharlotte] ${NEIGHBORHOODS.length} neighborhoods x ${CATEGORIES.length} categories = ${NEIGHBORHOODS.length * CATEGORIES.length} batches`);

  let totalImported = 0;
  let totalSkipped = 0;
  let totalFailed = 0;
  let batchNum = 0;

  for (const neighborhood of NEIGHBORHOODS) {
    for (const category of CATEGORIES) {
      batchNum++;
      const query = `${category} in ${neighborhood}`;
      console.log(`\n[SeedCharlotte] Batch ${batchNum}: "${query}"`);

      try {
        const [job] = await db
          .insert(placeImportJobs)
          .values({
            mode: "text_search",
            areaMode: "clt_default",
            queryText: query,
            categoryKeyword: category,
            requestedCount: 10,
            autoPublish: false,
            status: "queued",
          })
          .returning();

        const summary = await runImportJob(job.id);
        console.log(`[SeedCharlotte] Result: imported=${summary.imported}, skipped=${summary.skipped}, failed=${summary.failed}`);

        totalImported += summary.imported;
        totalSkipped += summary.skipped;
        totalFailed += summary.failed;
      } catch (err: any) {
        if (err.message.includes("Daily") && err.message.includes("limit")) {
          console.warn(`[SeedCharlotte] Daily API limit reached. Stopping.`);
          console.log(`[SeedCharlotte] Run again tomorrow to continue seeding.`);
          break;
        }
        console.error(`[SeedCharlotte] Batch error: ${err.message}`);
        totalFailed++;
      }

      await sleep(BATCH_PAUSE_MS);
    }
  }

  console.log(`\n[SeedCharlotte] === COMPLETE ===`);
  console.log(`[SeedCharlotte] Total imported: ${totalImported}`);
  console.log(`[SeedCharlotte] Total skipped: ${totalSkipped}`);
  console.log(`[SeedCharlotte] Total failed: ${totalFailed}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("[SeedCharlotte] Fatal error:", err);
  process.exit(1);
});
