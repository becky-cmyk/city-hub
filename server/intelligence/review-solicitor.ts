import { db } from "../db";
import { sql, eq, and, gt, lt, count } from "drizzle-orm";
import {
  intelligenceEventLog, feedReviewPrompts, businesses, publicUsers,
} from "@shared/schema";

export async function runReviewSolicitor(metroId: string): Promise<number> {
  console.log(`[ReviewSolicitor] Scanning ${metroId} for review prompt candidates...`);

  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const candidates = await db.execute(sql`
    SELECT DISTINCT ON (e.metadata_json->>'userId', e.entity_id)
      e.metadata_json->>'userId' as user_id,
      e.entity_id as business_id,
      e.event_type as trigger_event,
      e.created_at as interaction_at
    FROM intelligence_event_log e
    JOIN businesses b ON b.id = e.entity_id
    JOIN public_users pu ON pu.id = (e.metadata_json->>'userId')
    WHERE e.metro_id = ${metroId}
      AND e.event_type IN ('PROFILE_VIEW', 'FEED_CARD_SAVE', 'FEED_CARD_LIKE')
      AND e.created_at BETWEEN ${sevenDaysAgo} AND ${twoDaysAgo}
      AND e.metadata_json->>'userId' != 'anonymous'
      AND NOT EXISTS (
        SELECT 1 FROM feed_review_prompts frp
        WHERE frp.user_id = (e.metadata_json->>'userId')
          AND frp.business_id = e.entity_id
          AND frp.prompted_at > ${thirtyDaysAgo}
      )
      AND NOT EXISTS (
        SELECT 1 FROM feed_review_prompts frp2
        WHERE frp2.user_id = (e.metadata_json->>'userId')
          AND frp2.prompted_at > ${oneDayAgo}
      )
    ORDER BY e.metadata_json->>'userId', e.entity_id, e.created_at DESC
    LIMIT 50
  `);

  let created = 0;
  const fourteenDaysFromNow = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  for (const row of candidates.rows) {
    const r = row as any;
    try {
      await db.insert(feedReviewPrompts).values({
        userId: r.user_id,
        businessId: r.business_id,
        metroId,
        triggerEventType: r.trigger_event,
        dismissed: false,
        expiresAt: fourteenDaysFromNow,
      });
      created++;
    } catch (err: any) {
      // skip duplicates
    }
  }

  console.log(`[ReviewSolicitor] Created ${created} review prompts for ${metroId}`);
  return created;
}

export async function getActiveReviewPrompts(userId: string, metroId: string, limit = 2) {
  const now = new Date();
  const prompts = await db.execute(sql`
    SELECT frp.id, frp.business_id, frp.trigger_event_type, frp.prompted_at,
      b.name as business_name, b.logo_url, b.handle as business_handle,
      b.primary_photo_url
    FROM feed_review_prompts frp
    JOIN businesses b ON b.id = frp.business_id
    WHERE frp.user_id = ${userId}
      AND frp.metro_id = ${metroId}
      AND frp.responded_at IS NULL
      AND frp.dismissed = false
      AND (frp.expires_at IS NULL OR frp.expires_at > ${now})
    ORDER BY frp.prompted_at DESC
    LIMIT ${limit}
  `);
  return prompts.rows;
}

export async function dismissReviewPrompt(promptId: string, userId: string) {
  await db.update(feedReviewPrompts)
    .set({ dismissed: true })
    .where(and(
      eq(feedReviewPrompts.id, promptId),
      eq(feedReviewPrompts.userId, userId),
    ));
}

export async function markReviewPromptResponded(promptId: string, userId: string) {
  await db.update(feedReviewPrompts)
    .set({ respondedAt: new Date() })
    .where(and(
      eq(feedReviewPrompts.id, promptId),
      eq(feedReviewPrompts.userId, userId),
    ));
}
