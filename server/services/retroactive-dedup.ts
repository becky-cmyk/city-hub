import { db } from "../db";
import { rssItems } from "@shared/schema";
import { and, sql, eq } from "drizzle-orm";
import { titleWords, jaccardSimilarity } from "./text-similarity";

const JACCARD_THRESHOLD = 0.75;
const LOAD_BATCH_SIZE = 500;
const COMPARISON_WINDOW = 200;

interface DedupCluster {
  winnerId: string;
  loserIds: string[];
}

export interface ConsolidationStats {
  totalScanned: number;
  clustersFound: number;
  itemsSuppressed: number;
  windowsProcessed: number;
  totalWindows: number;
}

let lastRunStats: ConsolidationStats | null = null;
let dedupRunning = false;

export function getDedupRunState(): { running: boolean; stats: ConsolidationStats | null } {
  return { running: dedupRunning, stats: lastRunStats };
}

interface LightItem {
  id: string;
  words: Set<string>;
  hasArticleBody: boolean;
  hasCmsLink: boolean;
  publishedAt: Date | null;
  bodyLength: number;
}

function compareWinner(a: LightItem, b: LightItem): number {
  if (a.hasArticleBody !== b.hasArticleBody) return a.hasArticleBody ? -1 : 1;
  if (a.hasCmsLink !== b.hasCmsLink) return a.hasCmsLink ? -1 : 1;
  const aTime = a.publishedAt?.getTime() ?? 0;
  const bTime = b.publishedAt?.getTime() ?? 0;
  if (aTime !== bTime) return bTime - aTime;
  return b.bodyLength - a.bodyLength;
}

class UnionFind {
  private parent = new Map<string, string>();
  private rankMap = new Map<string, number>();

  add(x: string): void {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rankMap.set(x, 0);
    }
  }

  find(x: string): string {
    let root = x;
    while (this.parent.get(root) !== root) root = this.parent.get(root)!;
    let curr = x;
    while (curr !== root) {
      const next = this.parent.get(curr)!;
      this.parent.set(curr, root);
      curr = next;
    }
    return root;
  }

  union(x: string, y: string): void {
    const rx = this.find(x);
    const ry = this.find(y);
    if (rx === ry) return;
    const rankX = this.rankMap.get(rx) ?? 0;
    const rankY = this.rankMap.get(ry) ?? 0;
    if (rankX < rankY) this.parent.set(rx, ry);
    else if (rankX > rankY) this.parent.set(ry, rx);
    else { this.parent.set(ry, rx); this.rankMap.set(rx, rankX + 1); }
  }

  groups(): Map<string, string[]> {
    const result = new Map<string, string[]>();
    for (const id of this.parent.keys()) {
      const root = this.find(id);
      if (!result.has(root)) result.set(root, []);
      result.get(root)!.push(id);
    }
    return result;
  }
}

async function loadAllCandidates(cityId?: string | null): Promise<LightItem[]> {
  const conditions = [
    sql`${rssItems.reviewStatus} = 'APPROVED'`,
    sql`(${rssItems.publishStatus} IS NULL OR ${rssItems.publishStatus} NOT IN ('ARCHIVED', 'SUPPRESSED'))`,
    sql`${rssItems.pulseEligible} = true`,
    sql`${rssItems.suppressionReason} IS NULL`,
  ];

  if (cityId) {
    conditions.push(eq(rssItems.cityId, cityId));
  }

  const allCandidates: LightItem[] = [];
  let lastId: string | null = null;

  while (true) {
    const cursorConditions = [...conditions];
    if (lastId) {
      cursorConditions.push(sql`${rssItems.id} > ${lastId}`);
    }

    const batch = await db.select({
      id: rssItems.id,
      title: rssItems.title,
      localArticleBody: rssItems.localArticleBody,
      cmsContentItemId: rssItems.cmsContentItemId,
      publishedAt: rssItems.publishedAt,
    }).from(rssItems).where(
      and(...cursorConditions)
    ).orderBy(sql`${rssItems.id} ASC`).limit(LOAD_BATCH_SIZE);

    if (batch.length === 0) break;

    for (const item of batch) {
      allCandidates.push({
        id: item.id,
        words: titleWords(item.title),
        hasArticleBody: !!item.localArticleBody && item.localArticleBody.length > 0,
        hasCmsLink: !!item.cmsContentItemId,
        publishedAt: item.publishedAt,
        bodyLength: item.localArticleBody?.length || 0,
      });
    }

    lastId = batch[batch.length - 1].id;
    if (batch.length < LOAD_BATCH_SIZE) break;
  }

  return allCandidates;
}

function buildComparisonBlocks(items: LightItem[]): string[][] {
  const wordIndex = new Map<string, string[]>();
  for (const item of items) {
    for (const word of item.words) {
      if (!wordIndex.has(word)) wordIndex.set(word, []);
      wordIndex.get(word)!.push(item.id);
    }
  }

  const seen = new Set<string>();
  const blocks: string[][] = [];
  for (const ids of wordIndex.values()) {
    if (ids.length < 2) continue;
    const key = ids.sort().join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    blocks.push(ids);
  }

  return blocks;
}

export async function runRetroactiveDedup(cityId?: string | null): Promise<ConsolidationStats> {
  if (dedupRunning) {
    console.log("[RetroDedup] Skipping: another run is already in progress");
    return { totalScanned: 0, clustersFound: 0, itemsSuppressed: 0, windowsProcessed: 0, totalWindows: 0 };
  }

  dedupRunning = true;
  const stats: ConsolidationStats = { totalScanned: 0, clustersFound: 0, itemsSuppressed: 0, windowsProcessed: 0, totalWindows: 0 };
  lastRunStats = { ...stats };

  try {
    const allCandidates = await loadAllCandidates(cityId);
    stats.totalScanned = allCandidates.length;
    lastRunStats = { ...stats };

    if (allCandidates.length === 0) return stats;

    const itemMap = new Map<string, LightItem>();
    for (const item of allCandidates) itemMap.set(item.id, item);

    const blocks = buildComparisonBlocks(allCandidates);
    stats.totalWindows = Math.ceil(blocks.length / COMPARISON_WINDOW);
    lastRunStats = { ...stats };

    const uf = new UnionFind();
    for (const item of allCandidates) uf.add(item.id);

    for (let wi = 0; wi < blocks.length; wi += COMPARISON_WINDOW) {
      const windowEnd = Math.min(wi + COMPARISON_WINDOW, blocks.length);
      const windowBlocks = blocks.slice(wi, windowEnd);

      for (const block of windowBlocks) {
        const blockItems = block.map(id => itemMap.get(id)!).filter(Boolean);
        for (let i = 0; i < blockItems.length; i++) {
          for (let j = i + 1; j < blockItems.length; j++) {
            const sim = jaccardSimilarity(blockItems[i].words, blockItems[j].words);
            if (sim >= JACCARD_THRESHOLD) {
              uf.union(blockItems[i].id, blockItems[j].id);
            }
          }
        }
      }

      stats.windowsProcessed++;
      lastRunStats = { ...stats };
    }

    const groups = uf.groups();
    for (const members of groups.values()) {
      if (members.length < 2) continue;
      const groupItems = members.map(id => itemMap.get(id)!).filter(Boolean);
      groupItems.sort(compareWinner);

      stats.clustersFound++;
      const winnerId = groupItems[0].id;

      for (let i = 1; i < groupItems.length; i++) {
        try {
          await db.update(rssItems).set({
            pulseEligible: false,
            suppressionReason: "duplicate_consolidated",
            dedupMeta: { originalItemId: winnerId, matchType: "retroactive_consolidation" },
            updatedAt: new Date(),
          }).where(eq(rssItems.id, groupItems[i].id));
          stats.itemsSuppressed++;
          lastRunStats = { ...stats };
        } catch (err: unknown) {
          console.error(`[RetroDedup] Failed to suppress ${groupItems[i].id}:`, err instanceof Error ? err.message : err);
        }
      }
    }

    console.log(`[RetroDedup] Complete: ${stats.totalScanned} scanned, ${stats.clustersFound} clusters, ${stats.itemsSuppressed} suppressed, ${stats.windowsProcessed} windows`);
  } finally {
    dedupRunning = false;
  }

  return stats;
}

export async function getDedupStats(cityId?: string | null): Promise<{
  totalItems: number;
  duplicateClusters: number;
  suppressedItems: number;
  retroactiveSuppressed: number;
  ingestionSuppressed: number;
}> {
  const cityCondition = cityId ? eq(rssItems.cityId, cityId) : sql`true`;

  const [totalResult, retroactiveResult, ingestionResult] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(rssItems).where(
      and(
        sql`${rssItems.reviewStatus} = 'APPROVED'`,
        cityCondition,
      )
    ),
    db.select({ count: sql<number>`count(*)` }).from(rssItems).where(
      and(
        sql`${rssItems.suppressionReason} = 'duplicate_consolidated'`,
        sql`${rssItems.dedupMeta}->>'matchType' = 'retroactive_consolidation'`,
        cityCondition,
      )
    ),
    db.select({ count: sql<number>`count(*)` }).from(rssItems).where(
      and(
        sql`${rssItems.suppressionReason} = 'soft_title_auto_suppressed'`,
        cityCondition,
      )
    ),
  ]);

  const clusterResult = await db.select({
    count: sql<number>`count(DISTINCT (${rssItems.dedupMeta}->>'originalItemId'))`,
  }).from(rssItems).where(
    and(
      sql`${rssItems.dedupMeta}->>'matchType' = 'retroactive_consolidation'`,
      sql`${rssItems.dedupMeta}->>'originalItemId' IS NOT NULL`,
      cityCondition,
    )
  );

  const retroactive = Number(retroactiveResult[0]?.count ?? 0);
  const ingestion = Number(ingestionResult[0]?.count ?? 0);

  return {
    totalItems: Number(totalResult[0]?.count ?? 0),
    duplicateClusters: Number(clusterResult[0]?.count ?? 0),
    suppressedItems: retroactive + ingestion,
    retroactiveSuppressed: retroactive,
    ingestionSuppressed: ingestion,
  };
}
