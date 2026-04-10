import { db } from "../db";
import { rssItems } from "@shared/schema";
import { eq, and, gte, sql } from "drizzle-orm";

const SOURCE_OVERREP_THRESHOLD = 0.4;
const CATEGORY_OVERREP_THRESHOLD = 0.5;
const GEO_OVERREP_THRESHOLD = 0.6;

export interface DiversityResult {
  totalItems: number;
  flaggedSource: number;
  flaggedCategory: number;
  flaggedGeo: number;
}

export async function runDiversityFlagPass(cityId: string): Promise<DiversityResult> {
  const result: DiversityResult = {
    totalItems: 0,
    flaggedSource: 0,
    flaggedCategory: 0,
    flaggedGeo: 0,
  };

  const windowStart = new Date();
  windowStart.setHours(windowStart.getHours() - 24);

  const recentItems = await db
    .select({
      id: rssItems.id,
      metroSourceId: rssItems.metroSourceId,
      categoryCoreSlug: rssItems.categoryCoreSlug,
      geoPrimarySlug: rssItems.geoPrimarySlug,
      integrityFlags: rssItems.integrityFlags,
    })
    .from(rssItems)
    .where(
      and(
        eq(rssItems.cityId, cityId),
        gte(rssItems.createdAt, windowStart),
        sql`${rssItems.publishStatus} = 'PUBLISHED'`,
        sql`${rssItems.policyStatus} = 'ALLOW'`
      )
    );

  result.totalItems = recentItems.length;
  if (recentItems.length === 0) return result;

  const sourceCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  const geoCounts = new Map<string, number>();

  for (const item of recentItems) {
    sourceCounts.set(item.metroSourceId, (sourceCounts.get(item.metroSourceId) || 0) + 1);
    if (item.categoryCoreSlug) {
      categoryCounts.set(item.categoryCoreSlug, (categoryCounts.get(item.categoryCoreSlug) || 0) + 1);
    }
    if (item.geoPrimarySlug) {
      geoCounts.set(item.geoPrimarySlug, (geoCounts.get(item.geoPrimarySlug) || 0) + 1);
    }
  }

  const overrepSources = new Set<string>();
  const overrepCategories = new Set<string>();
  const overrepGeos = new Set<string>();

  for (const [sourceId, cnt] of sourceCounts) {
    if (cnt / recentItems.length > SOURCE_OVERREP_THRESHOLD) {
      overrepSources.add(sourceId);
    }
  }
  for (const [cat, cnt] of categoryCounts) {
    if (cnt / recentItems.length > CATEGORY_OVERREP_THRESHOLD) {
      overrepCategories.add(cat);
    }
  }
  for (const [geo, cnt] of geoCounts) {
    if (cnt / recentItems.length > GEO_OVERREP_THRESHOLD) {
      overrepGeos.add(geo);
    }
  }

  for (const item of recentItems) {
    const existingFlags = (item.integrityFlags || []) as string[];
    const newFlags = [...existingFlags.filter(f =>
      f !== "OVERREPRESENTED_SOURCE" &&
      f !== "OVERREPRESENTED_CATEGORY" &&
      f !== "OVERREPRESENTED_GEO"
    )];

    let changed = false;

    if (overrepSources.has(item.metroSourceId)) {
      newFlags.push("OVERREPRESENTED_SOURCE");
      result.flaggedSource++;
      changed = true;
    }
    if (item.categoryCoreSlug && overrepCategories.has(item.categoryCoreSlug)) {
      newFlags.push("OVERREPRESENTED_CATEGORY");
      result.flaggedCategory++;
      changed = true;
    }
    if (item.geoPrimarySlug && overrepGeos.has(item.geoPrimarySlug)) {
      newFlags.push("OVERREPRESENTED_GEO");
      result.flaggedGeo++;
      changed = true;
    }

    const existingHadDiversityFlags = existingFlags.some(f =>
      f === "OVERREPRESENTED_SOURCE" ||
      f === "OVERREPRESENTED_CATEGORY" ||
      f === "OVERREPRESENTED_GEO"
    );

    if (changed || existingHadDiversityFlags) {
      await db
        .update(rssItems)
        .set({ integrityFlags: newFlags, updatedAt: new Date() })
        .where(eq(rssItems.id, item.id));
    }
  }

  console.log(`[Diversity] City ${cityId}: ${result.totalItems} items, flagged source=${result.flaggedSource}, category=${result.flaggedCategory}, geo=${result.flaggedGeo}`);
  return result;
}
