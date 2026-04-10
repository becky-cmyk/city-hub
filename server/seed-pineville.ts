import { storage } from "./storage";
import { runImportJob } from "./google-places";
import { pool, db } from "./db";
import { crownHubActivations, crownHubConfig, CROWN_CATEGORIES_LAUNCH } from "@shared/schema";
import type { CrownHubConfig } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { discoverCandidatesForCategory } from "./crown-routes";

const PINEVILLE_ZIP = "28134";

const CROWN_RELEVANT_CATEGORIES = [
  "Restaurants",
  "Coffee Shops",
  "Bars",
  "Breweries",
  "Hair Salons",
  "Barber Shops",
  "Gyms",
  "Fitness Centers",
  "Food Trucks",
  "Boutiques",
  "Wine Bars",
  "Cocktail Lounges",
];

const BATCH_DELAY_MS = 2000;

export async function seedPinevillePlaces(): Promise<{
  totalJobs: number;
  completed: number;
  failed: number;
  totalImported: number;
  failedCategories: string[];
}> {
  console.log("[SEED-PINEVILLE] Starting Google Places import for Pineville (ZIP 28134)...");

  const stats = {
    totalJobs: 0,
    completed: 0,
    failed: 0,
    totalImported: 0,
    failedCategories: [] as string[],
  };

  for (const category of CROWN_RELEVANT_CATEGORIES) {
    const queryText = `${category} near ${PINEVILLE_ZIP}`;
    stats.totalJobs++;

    try {
      const job = await storage.createPlaceImportJob({
        mode: "text_search",
        areaMode: "zip",
        zipCode: PINEVILLE_ZIP,
        queryText,
        categoryKeyword: category,
        status: "queued",
        requestedCount: 20,
        autoPublish: true,
        importedCount: 0,
      });

      console.log(`[SEED-PINEVILLE] Job ${stats.totalJobs}/${CROWN_RELEVANT_CATEGORIES.length}: "${queryText}" (id: ${job.id})`);

      const summary = await runImportJob(job.id);
      stats.completed++;
      stats.totalImported += summary.imported;

      console.log(`[SEED-PINEVILLE]   → Found: ${summary.totalFound}, Imported: ${summary.imported}, Skipped: ${summary.skipped}, Failed: ${summary.failed}`);

      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    } catch (err: unknown) {
      stats.failed++;
      stats.failedCategories.push(category);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Daily text search limit") || msg.includes("Daily details limit")) {
        console.log(`[SEED-PINEVILLE] Daily API limit reached after ${stats.totalJobs} jobs. Stopping.`);
        break;
      }
      console.error(`[SEED-PINEVILLE]   → Failed: ${msg}`);
    }
  }

  console.log(`[SEED-PINEVILLE] Complete. Jobs: ${stats.totalJobs}, Completed: ${stats.completed}, Failed: ${stats.failed}, Total Imported: ${stats.totalImported}`);
  return stats;
}

interface CategoryScanResult {
  category_name: string;
  category_slug: string;
  hub_name: string;
  hub_id: string;
  total_businesses_found: number;
  total_qualified: number;
  category_status: "READY" | "NOT_READY" | "MANUAL_REVIEW";
  viability_minimum: number;
  candidates: Array<{
    business_id: string;
    business_name: string;
    crown_candidate_score: number;
    ready_for_voting_campaign: boolean;
    [key: string]: unknown;
  }>;
  scan_error?: string;
}

interface PinevilleScanOutput {
  hubId: string | null;
  hubName: string;
  scanTriggered: boolean;
  result: {
    activation: typeof crownHubActivations.$inferSelect | null;
    hub_ready: boolean;
    summary: {
      hub_name: string;
      hub_id: string;
      total_businesses_detected: number;
      total_qualified_businesses: number;
      categories_scanned: number;
      categories_ready: number;
      categories_not_ready: number;
      ready_categories: string[];
      categories_needing_more: Array<{ name: string; current: number; needed: number }>;
      category_errors: Array<{ slug: string; error: string }>;
      hub_crown_status: string;
    };
    category_results: CategoryScanResult[];
  } | null;
  error?: string;
}

export async function runPinevilleCrownScan(): Promise<PinevilleScanOutput> {
  console.log("[SEED-PINEVILLE] Running Crown hub readiness scan for Pineville...");

  const hubResult = await pool.query(
    `SELECT r.id, r.name, r.city_id, r.center_lat, r.center_lng
     FROM regions r
     WHERE r.code = 'PINEVILLE'
       AND r.region_type = 'hub'
       AND r.is_active = true
     LIMIT 1`
  );

  if (hubResult.rows.length === 0) {
    console.error("[SEED-PINEVILLE] Pineville hub not found in regions table");
    return { hubId: null, hubName: "Pineville", scanTriggered: false, result: null, error: "Pineville hub not found in regions table" };
  }

  const hub = hubResult.rows[0];
  console.log(`[SEED-PINEVILLE] Found Pineville hub: id=${hub.id}, name=${hub.name}, cityId=${hub.city_id}`);

  const seasonYear = 2026;

  const [existingConfig] = await db.select().from(crownHubConfig)
    .where(and(eq(crownHubConfig.cityId, hub.city_id), eq(crownHubConfig.seasonYear, seasonYear)));

  let config: CrownHubConfig;
  if (!existingConfig) {
    const [created] = await db.insert(crownHubConfig).values({ cityId: hub.city_id, seasonYear }).returning();
    config = created;
  } else {
    config = existingConfig;
  }

  const [existingActivation] = await db.select().from(crownHubActivations)
    .where(and(eq(crownHubActivations.hubId, hub.id), eq(crownHubActivations.seasonYear, seasonYear)));

  if (existingActivation && !["INACTIVE", "SCANNING", "READY_FOR_ACTIVATION"].includes(existingActivation.status)) {
    console.log(`[SEED-PINEVILLE] Hub is in ${existingActivation.status} state, cannot re-scan`);
    return {
      hubId: hub.id,
      hubName: hub.name,
      scanTriggered: false,
      result: null,
      error: `Hub is in ${existingActivation.status} state, cannot re-scan`,
    };
  }

  if (!existingActivation) {
    await db.insert(crownHubActivations).values({
      hubId: hub.id, cityId: hub.city_id, seasonYear, status: "SCANNING",
    });
  } else {
    await db.update(crownHubActivations)
      .set({ status: "SCANNING", updatedAt: new Date() })
      .where(eq(crownHubActivations.id, existingActivation.id));
  }

  try {
    const dbCats = await pool.query(
      "SELECT name, slug FROM crown_categories WHERE city_id = $1 AND is_active = true ORDER BY sort_order",
      [hub.city_id]
    );
    const categories: { name: string; slug: string }[] = dbCats.rows.length > 0
      ? dbCats.rows
      : CROWN_CATEGORIES_LAUNCH.map((c) => ({ name: c.name, slug: c.slug }));

    const results: CategoryScanResult[] = [];
    const categoryErrors: { slug: string; error: string }[] = [];
    const hubLat = hub.center_lat ? parseFloat(hub.center_lat) : null;
    const hubLng = hub.center_lng ? parseFloat(hub.center_lng) : null;
    const radius = config.scanRadiusMiles;

    for (const cat of categories) {
      try {
        const result = await discoverCandidatesForCategory(
          hub.id, hub.name, hubLat, hubLng, radius,
          cat.slug, cat.name, hub.city_id
        );
        results.push(result as CategoryScanResult);
      } catch (catErr: unknown) {
        const catMsg = catErr instanceof Error ? catErr.message : String(catErr);
        console.error(`[SEED-PINEVILLE] Category "${cat.name}" scan failed: ${catMsg}`);
        categoryErrors.push({ slug: cat.slug, error: catMsg });
        results.push({
          category_name: cat.name,
          category_slug: cat.slug,
          hub_name: hub.name,
          hub_id: hub.id,
          total_businesses_found: 0,
          total_qualified: 0,
          category_status: "NOT_READY",
          viability_minimum: 5,
          candidates: [],
          scan_error: catMsg,
        });
      }
    }

    function getCategoryMinimum(categorySlug: string): number {
      const thresholds = config.categoryThresholds || {};
      return thresholds[categorySlug] ?? config.defaultCategoryMinimum;
    }

    const categoriesReady = results.filter((r) => {
      if (r.scan_error) return false;
      return r.total_qualified >= getCategoryMinimum(r.category_slug);
    });
    const totalQualified = results.reduce((s, r) => s + r.total_qualified, 0);
    const readyCatNames = categoriesReady.map((r) => r.category_name);
    const topBizIds = results
      .flatMap((r) => (r.candidates || []).filter((c) => c.ready_for_voting_campaign))
      .sort((a, b) => b.crown_candidate_score - a.crown_candidate_score)
      .slice(0, 20)
      .map((c) => c.business_id);

    const hubReady = categoriesReady.length >= config.minCategoriesForLaunch
      && totalQualified >= config.minQualifiedBusinesses;
    const newStatus = hubReady ? "READY_FOR_ACTIVATION" : "INACTIVE";

    await db.update(crownHubActivations)
      .set({
        status: newStatus,
        categoriesScanned: results.length,
        categoriesReady: categoriesReady.length,
        totalQualifiedBusinesses: totalQualified,
        readyCategoryNames: readyCatNames,
        recommendedBusinessIds: topBizIds,
        scanResults: { categories: results, errors: categoryErrors } as Record<string, unknown>,
        lastScannedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(crownHubActivations.hubId, hub.id), eq(crownHubActivations.seasonYear, seasonYear)));

    if (hubReady) {
      try {
        await pool.query(`
          INSERT INTO pulse_signals (id, metro_id, signal_type, entity_type, entity_id, title, summary, data_json, score, status, created_at)
          VALUES (gen_random_uuid(), $1, 'CROWN_HUB_READY', 'hub', $2, $3, $4,
            $5::jsonb, 80, 'new', NOW())
          ON CONFLICT DO NOTHING
        `, [
          hub.city_id,
          hub.id,
          `Crown Program: Pineville is ready`,
          `Hub "Pineville" has ${categoriesReady.length} ready categories and ${totalQualified} qualified businesses. Recommended for Crown activation.`,
          JSON.stringify({
            hub_name: "Pineville",
            ready_categories: readyCatNames,
            qualified_business_count: totalQualified,
            recommended_launch_categories: readyCatNames.slice(0, 5),
            recommended_businesses_to_invite: topBizIds.slice(0, 10),
          }),
        ]);
      } catch (_) {}
    }

    const [updated] = await db.select().from(crownHubActivations)
      .where(and(eq(crownHubActivations.hubId, hub.id), eq(crownHubActivations.seasonYear, seasonYear)));

    const scanResult = {
      activation: updated || null,
      hub_ready: hubReady,
      summary: {
        hub_name: hub.name,
        hub_id: hub.id,
        total_businesses_detected: results.reduce((s, r) => s + r.total_businesses_found, 0),
        total_qualified_businesses: totalQualified,
        categories_scanned: results.length,
        categories_ready: categoriesReady.length,
        categories_not_ready: results.length - categoriesReady.length,
        ready_categories: readyCatNames,
        categories_needing_more: results
          .filter((r) => {
            if (r.scan_error) return false;
            const threshold = getCategoryMinimum(r.category_slug);
            return r.total_qualified < threshold && r.total_qualified > 0;
          })
          .map((r) => ({
            name: r.category_name,
            current: r.total_qualified,
            needed: getCategoryMinimum(r.category_slug) - r.total_qualified,
          })),
        category_errors: categoryErrors,
        hub_crown_status: newStatus,
      },
      category_results: results,
    };

    console.log(`[SEED-PINEVILLE] Crown scan complete. Status: ${newStatus}, Categories ready: ${categoriesReady.length}/${results.length}, Total qualified: ${totalQualified}`);
    if (categoryErrors.length > 0) {
      console.log(`[SEED-PINEVILLE] ${categoryErrors.length} categories had scan errors`);
    }
    if (!hubReady) {
      console.log(`[SEED-PINEVILLE] Pineville needs ${config.minCategoriesForLaunch} ready categories (has ${categoriesReady.length}) and ${config.minQualifiedBusinesses} qualified businesses (has ${totalQualified})`);
    }

    return {
      hubId: hub.id,
      hubName: hub.name,
      scanTriggered: true,
      result: scanResult,
    };
  } catch (scanErr: unknown) {
    const errMsg = scanErr instanceof Error ? scanErr.message : String(scanErr);
    console.error(`[SEED-PINEVILLE] Crown scan failed: ${errMsg}`);

    await db.update(crownHubActivations)
      .set({
        status: "INACTIVE",
        scanResults: { error: errMsg, failed_at: new Date().toISOString() } as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(and(eq(crownHubActivations.hubId, hub.id), eq(crownHubActivations.seasonYear, seasonYear)));

    return {
      hubId: hub.id,
      hubName: hub.name,
      scanTriggered: true,
      result: null,
      error: `Scan failed: ${errMsg}`,
    };
  }
}
