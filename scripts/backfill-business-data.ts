import { db } from "../server/db";
import { businesses, categories } from "../shared/schema";
import { eq, isNull, or, sql } from "drizzle-orm";
import { fetchPlaceDetails, mapGoogleTypesToCategories } from "../server/google-places";

async function backfill() {
  const allCategories = await db.select().from(categories);
  const catBySlug = new Map(allCategories.map(c => [c.slug, c.id]));

  const bizList = await db.select({
    id: businesses.id,
    name: businesses.name,
    googlePlaceId: businesses.googlePlaceId,
    categoryIds: businesses.categoryIds,
    googleRating: businesses.googleRating,
    googleReviewCount: businesses.googleReviewCount,
  }).from(businesses).where(
    sql`${businesses.googlePlaceId} IS NOT NULL`
  );

  console.log(`Found ${bizList.length} businesses with Google Place IDs`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const biz of bizList) {
    const needsCats = !biz.categoryIds || biz.categoryIds.length === 0;
    const needsRating = !biz.googleRating;
    const forceCategories = process.argv.includes("--force-categories");

    if (!needsCats && !needsRating && !forceCategories) {
      skipped++;
      continue;
    }

    try {
      console.log(`[${updated + skipped + errors + 1}/${bizList.length}] Fetching: ${biz.name}`);
      const details = await fetchPlaceDetails(biz.googlePlaceId!);

      const updates: any = {};

      if (needsCats && details.types && details.types.length > 0) {
        const { l2Slugs } = mapGoogleTypesToCategories(details.types);
        const resolvedIds = l2Slugs.map(s => catBySlug.get(s)).filter(Boolean) as string[];
        if (resolvedIds.length > 0) {
          updates.categoryIds = resolvedIds;
        }
      }

      if (details.rating != null) {
        updates.googleRating = details.rating.toString();
      }
      if (details.user_ratings_total != null) {
        updates.googleReviewCount = details.user_ratings_total;
      }

      if (Object.keys(updates).length > 0) {
        await db.update(businesses).set(updates).where(eq(businesses.id, biz.id));
        const catCount = updates.categoryIds?.length || 0;
        console.log(`  -> Updated: ${catCount} categories, rating=${updates.googleRating || 'N/A'}, reviews=${updates.googleReviewCount || 'N/A'}`);
        updated++;
      } else {
        console.log(`  -> No new data from Google`);
        skipped++;
      }

      await new Promise(r => setTimeout(r, 300));
    } catch (err: any) {
      console.error(`  -> ERROR: ${err.message}`);
      errors++;
      if (err.message.includes("Daily details limit")) {
        console.error("Hit daily limit, stopping.");
        break;
      }
    }
  }

  console.log(`\nDone: ${updated} updated, ${skipped} skipped, ${errors} errors`);
  process.exit(0);
}

backfill().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
