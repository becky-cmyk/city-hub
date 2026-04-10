import { storage } from "./storage";
import { runImportJob } from "./google-places";

const CATEGORIES = [
  "Restaurants",
  "Coffee Shops",
  "Hair Salons",
  "Barber Shops",
  "Auto Repair",
  "Dentists",
  "Gyms",
  "Fitness Centers",
  "Veterinarians",
  "Dry Cleaners",
  "Pharmacies",
  "Day Care",
];

const TARGET_ZIPS = [
  "28202", "28203", "28205", "28206", "28207", "28209", "28210", "28211",
  "28212", "28213", "28216", "28217", "28226", "28227", "28262", "28269",
  "28270", "28273", "28277", "28278",
  "28078", "28031", "28036", "28105", "28134", "28173",
  "28025", "28027", "28075",
  "28052", "28012", "28120",
  "28115", "28117",
  "29708", "29715", "29730",
];

const BATCH_DELAY_MS = 2000;

export async function seedPlacesImport(): Promise<{
  totalJobs: number;
  completed: number;
  failed: number;
  totalImported: number;
}> {
  console.log("[SEED-PLACES] Starting Google Places import for key categories...");

  const stats = {
    totalJobs: 0,
    completed: 0,
    failed: 0,
    totalImported: 0,
  };

  for (const category of CATEGORIES) {
    for (const zip of TARGET_ZIPS) {
      const queryText = `${category} near ${zip}`;
      stats.totalJobs++;

      try {
        const job = await storage.createPlaceImportJob({
          mode: "text_search",
          areaMode: "zip",
          zipCode: zip,
          queryText,
          categoryKeyword: category,
          status: "queued",
          requestedCount: 20,
          autoPublish: true,
          importedCount: 0,
        });

        console.log(`[SEED-PLACES] Job ${stats.totalJobs}: "${queryText}" (id: ${job.id})`);

        const summary = await runImportJob(job.id);
        stats.completed++;
        stats.totalImported += summary.imported;

        console.log(`[SEED-PLACES]   → Found: ${summary.totalFound}, Imported: ${summary.imported}, Skipped: ${summary.skipped}, Failed: ${summary.failed}`);

        await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
      } catch (err: any) {
        stats.failed++;
        if (err.message.includes("Daily text search limit") || err.message.includes("Daily details limit")) {
          console.log(`[SEED-PLACES] Daily API limit reached after ${stats.totalJobs} jobs. Stopping.`);
          console.log(`[SEED-PLACES] Resume tomorrow to continue importing remaining categories/zips.`);
          break;
        }
        console.error(`[SEED-PLACES]   → Failed: ${err.message}`);
      }
    }

    const limitHit = stats.failed > 0 &&
      stats.totalJobs === stats.completed + stats.failed;
    if (stats.failed > 0) {
      const lastJob = await storage.listPlaceImportJobs();
      const lastFailed = lastJob.find(j => j.status === "failed" && j.errorText?.includes("Daily"));
      if (lastFailed) break;
    }
  }

  console.log(`[SEED-PLACES] Complete. Jobs: ${stats.totalJobs}, Completed: ${stats.completed}, Failed: ${stats.failed}, Total Imported: ${stats.totalImported}`);
  return stats;
}
