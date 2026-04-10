import { db } from "../db";
import { metroSources, rssItems } from "@shared/schema";
import { eq, and, gte, sql, count } from "drizzle-orm";

const LOW_TRUST_THRESHOLD = 30;

export function isLowTrust(trustScore: number): boolean {
  return trustScore < LOW_TRUST_THRESHOLD;
}

export interface TrustScoreFactors {
  categoryMappingRate: number;
  geoAccuracyRate: number;
  duplicationRate: number;
  filterHitRate: number;
  totalItems: number;
  computedScore: number;
  adminOverride: number | null;
  finalScore: number;
}

export async function computeSourceTrustScore(sourceId: string, adminOverride?: number | null): Promise<TrustScoreFactors> {
  const lookbackDate = new Date();
  lookbackDate.setDate(lookbackDate.getDate() - 30);

  const [totalResult] = await db
    .select({ total: count() })
    .from(rssItems)
    .where(
      and(
        eq(rssItems.metroSourceId, sourceId),
        gte(rssItems.createdAt, lookbackDate)
      )
    );
  const totalItems = totalResult?.total || 0;

  if (totalItems === 0) {
    const baseScore = 50;
    const finalScore = adminOverride != null ? adminOverride : baseScore;
    return {
      categoryMappingRate: 1,
      geoAccuracyRate: 1,
      duplicationRate: 0,
      filterHitRate: 0,
      totalItems: 0,
      computedScore: baseScore,
      adminOverride: adminOverride ?? null,
      finalScore,
    };
  }

  const [catResult] = await db
    .select({ total: count() })
    .from(rssItems)
    .where(
      and(
        eq(rssItems.metroSourceId, sourceId),
        gte(rssItems.createdAt, lookbackDate),
        sql`${rssItems.categoryCoreSlug} IS NOT NULL`
      )
    );
  const categoryMappingRate = (catResult?.total || 0) / totalItems;

  const [geoResult] = await db
    .select({ total: count() })
    .from(rssItems)
    .where(
      and(
        eq(rssItems.metroSourceId, sourceId),
        gte(rssItems.createdAt, lookbackDate),
        sql`${rssItems.geoPrimarySlug} IS NOT NULL`
      )
    );
  const geoAccuracyRate = (geoResult?.total || 0) / totalItems;

  const [dupResult] = await db
    .select({ total: count() })
    .from(rssItems)
    .where(
      and(
        eq(rssItems.metroSourceId, sourceId),
        gte(rssItems.createdAt, lookbackDate),
        sql`(${rssItems.integrityFlags}::jsonb ? 'duplicate_candidate' OR ${rssItems.integrityFlags}::jsonb ? 'ai_duplicate_candidate')`
      )
    );
  const duplicationRate = (dupResult?.total || 0) / totalItems;

  const [filterResult] = await db
    .select({ total: count() })
    .from(rssItems)
    .where(
      and(
        eq(rssItems.metroSourceId, sourceId),
        gte(rssItems.createdAt, lookbackDate),
        sql`${rssItems.reviewStatus} IN ('SKIPPED', 'FLAGGED')`
      )
    );
  const filterHitRate = (filterResult?.total || 0) / totalItems;

  const categoryScore = categoryMappingRate * 25;
  const geoScore = geoAccuracyRate * 25;
  const dupPenalty = duplicationRate * 25;
  const filterPenalty = filterHitRate * 25;

  const computedScore = Math.round(
    Math.max(0, Math.min(100, categoryScore + geoScore + (25 - dupPenalty) + (25 - filterPenalty)))
  );

  const finalScore = adminOverride != null ? adminOverride : computedScore;

  return {
    categoryMappingRate,
    geoAccuracyRate,
    duplicationRate,
    filterHitRate,
    totalItems,
    computedScore,
    adminOverride: adminOverride ?? null,
    finalScore,
  };
}

export async function updateAllSourceTrustScores(): Promise<{ updated: number; errors: number }> {
  let updated = 0;
  let errors = 0;

  try {
    const sources = await db
      .select({ id: metroSources.id, trustOverride: metroSources.trustOverride })
      .from(metroSources)
      .where(eq(metroSources.enabled, true));

    for (const source of sources) {
      try {
        const factors = await computeSourceTrustScore(source.id, source.trustOverride);
        await db
          .update(metroSources)
          .set({
            trustScore: factors.finalScore,
            updatedAt: new Date(),
          })
          .where(eq(metroSources.id, source.id));
        updated++;
      } catch (err: unknown) {
        errors++;
        console.error(`[SourceTrust] Error computing trust for source ${source.id}:`, err instanceof Error ? err.message : err);
      }
    }
  } catch (err: unknown) {
    console.error("[SourceTrust] Fatal error:", err instanceof Error ? err.message : err);
  }

  console.log(`[SourceTrust] Updated ${updated} sources, ${errors} errors`);
  return { updated, errors };
}
