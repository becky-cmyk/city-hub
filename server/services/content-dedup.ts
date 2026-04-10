import { db } from "../db";
import { rssItems } from "@shared/schema";
import { eq, and, gte, sql, ne } from "drizzle-orm";
import { titleWords, jaccardSimilarity } from "./text-similarity";

const SOFT_DUPLICATE_THRESHOLD = 0.75;
const AI_SLUG_NEAR_MATCH_THRESHOLD = 0.8;
const PUBLISH_WINDOW_HOURS = 24;

export interface DedupResult {
  isDuplicate: boolean;
  duplicateType: "hard_url" | "hard_external_id" | "soft_title" | "ai_slug" | "ai_slug_near" | null;
  existingItemId: string | null;
  flags: string[];
}

export async function checkDuplicate(
  url: string,
  externalId: string,
  metroSourceId: string,
  title: string,
  publishedAt: Date | null,
): Promise<DedupResult> {
  if (url && url.trim().length > 0) {
    const urlMatch = await db
      .select({ id: rssItems.id })
      .from(rssItems)
      .where(eq(rssItems.url, url))
      .limit(1);

    if (urlMatch.length > 0) {
      return {
        isDuplicate: true,
        duplicateType: "hard_url",
        existingItemId: urlMatch[0].id,
        flags: [],
      };
    }
  }

  const externalIdMatch = await db
    .select({ id: rssItems.id })
    .from(rssItems)
    .where(
      and(
        eq(rssItems.externalId, externalId),
        ne(rssItems.metroSourceId, metroSourceId)
      )
    )
    .limit(1);

  if (externalIdMatch.length > 0) {
    return {
      isDuplicate: true,
      duplicateType: "hard_external_id",
      existingItemId: externalIdMatch[0].id,
      flags: [],
    };
  }

  const windowStart = new Date();
  windowStart.setHours(windowStart.getHours() - PUBLISH_WINDOW_HOURS);

  const recentItems = await db
    .select({ id: rssItems.id, title: rssItems.title, publishedAt: rssItems.publishedAt })
    .from(rssItems)
    .where(
      sql`COALESCE(${rssItems.publishedAt}, ${rssItems.createdAt}) >= ${windowStart}`
    )
    .limit(500);

  const incomingWords = titleWords(title);
  if (incomingWords.size > 0) {
    for (const existing of recentItems) {
      const existingWords = titleWords(existing.title);
      const similarity = jaccardSimilarity(incomingWords, existingWords);
      if (similarity >= SOFT_DUPLICATE_THRESHOLD) {
        if (publishedAt && existing.publishedAt) {
          const timeDiff = Math.abs(publishedAt.getTime() - existing.publishedAt.getTime());
          if (timeDiff <= PUBLISH_WINDOW_HOURS * 60 * 60 * 1000) {
            return {
              isDuplicate: false,
              duplicateType: "soft_title",
              existingItemId: existing.id,
              flags: ["duplicate_candidate"],
            };
          }
        } else {
          return {
            isDuplicate: false,
            duplicateType: "soft_title",
            existingItemId: existing.id,
            flags: ["duplicate_candidate"],
          };
        }
      }
    }
  }

  return {
    isDuplicate: false,
    duplicateType: null,
    existingItemId: null,
    flags: [],
  };
}

export async function checkAiSlugDuplicate(
  localArticleSlug: string,
  currentItemId: string,
): Promise<DedupResult> {
  const slugMatch = await db
    .select({ id: rssItems.id, localArticleSlug: rssItems.localArticleSlug })
    .from(rssItems)
    .where(
      and(
        eq(rssItems.localArticleSlug, localArticleSlug),
        ne(rssItems.id, currentItemId),
        sql`${rssItems.localArticleSlug} IS NOT NULL`
      )
    )
    .limit(1);

  if (slugMatch.length > 0) {
    return {
      isDuplicate: false,
      duplicateType: "ai_slug",
      existingItemId: slugMatch[0].id,
      flags: ["ai_duplicate_candidate"],
    };
  }

  const slugPrefix = localArticleSlug.replace(/-[a-f0-9]{8}$/, "");
  const nearMatches = await db
    .select({ id: rssItems.id, localArticleSlug: rssItems.localArticleSlug })
    .from(rssItems)
    .where(
      and(
        sql`${rssItems.localArticleSlug} IS NOT NULL`,
        ne(rssItems.id, currentItemId),
        sql`${rssItems.localArticleSlug} LIKE ${slugPrefix + '%'}`
      )
    )
    .limit(10);

  if (nearMatches.length > 0) {
    const slugWords = titleWords(localArticleSlug.replace(/-/g, " "));
    for (const match of nearMatches) {
      if (!match.localArticleSlug) continue;
      const matchWords = titleWords(match.localArticleSlug.replace(/-/g, " "));
      const similarity = jaccardSimilarity(slugWords, matchWords);
      if (similarity >= AI_SLUG_NEAR_MATCH_THRESHOLD) {
        return {
          isDuplicate: false,
          duplicateType: "ai_slug_near",
          existingItemId: match.id,
          flags: ["ai_duplicate_candidate"],
        };
      }
    }
  }

  return {
    isDuplicate: false,
    duplicateType: null,
    existingItemId: null,
    flags: [],
  };
}
