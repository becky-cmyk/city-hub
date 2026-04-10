import { Router, type Request, type Response } from "express";
import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";
import { likes, follows, intelligenceEventLog } from "@shared/schema";
import { z } from "zod";

const router = Router();

function getPublicUserId(req: Request): string | null {
  return (req.session as any)?.publicUserId || null;
}

router.post("/api/engagement/like", async (req: Request, res: Response) => {
  try {
    const userId = getPublicUserId(req);
    if (!userId) return res.status(401).json({ error: "Login required" });

    const { contentType, contentId } = req.body;
    if (!contentType || !contentId) return res.status(400).json({ error: "contentType and contentId required" });

    const validTypes = ["business", "event", "article", "post", "reel", "marketplace_listing", "marketplace", "shop_item", "shop_drop", "repost"];
    if (!validTypes.includes(contentType)) return res.status(400).json({ error: "Invalid contentType" });

    await db.insert(likes).values({ userId, contentType, contentId }).onConflictDoNothing();

    return res.json({ liked: true });
  } catch (err: any) {
    console.error("[Like] Error:", err.message);
    return res.status(500).json({ error: "Failed to like" });
  }
});

router.delete("/api/engagement/like", async (req: Request, res: Response) => {
  try {
    const userId = getPublicUserId(req);
    if (!userId) return res.status(401).json({ error: "Login required" });

    const { contentType, contentId } = req.body;
    if (!contentType || !contentId) return res.status(400).json({ error: "contentType and contentId required" });

    await db.delete(likes).where(
      and(eq(likes.userId, userId), eq(likes.contentType, contentType), eq(likes.contentId, contentId))
    );

    return res.json({ liked: false });
  } catch (err: any) {
    console.error("[Unlike] Error:", err.message);
    return res.status(500).json({ error: "Failed to unlike" });
  }
});

router.get("/api/engagement/likes", async (req: Request, res: Response) => {
  try {
    const userId = getPublicUserId(req);
    if (!userId) return res.json({ likes: [] });

    const contentIds = (req.query.contentIds as string || "").split(",").filter(Boolean);
    const contentType = req.query.contentType as string;

    if (!contentType || contentIds.length === 0) return res.json({ likes: [] });

    const userLikes = await db.select({ contentId: likes.contentId })
      .from(likes)
      .where(and(eq(likes.userId, userId), eq(likes.contentType, contentType)));

    const likedIds = new Set(userLikes.map(l => l.contentId));
    const result = contentIds.map(id => ({ contentId: id, liked: likedIds.has(id) }));

    return res.json({ likes: result });
  } catch (err: any) {
    console.error("[Get Likes] Error:", err.message);
    return res.json({ likes: [] });
  }
});

router.post("/api/engagement/follow", async (req: Request, res: Response) => {
  try {
    const userId = getPublicUserId(req);
    if (!userId) return res.status(401).json({ error: "Login required" });

    const { followType, followId } = req.body;
    if (!followType || !followId) return res.status(400).json({ error: "followType and followId required" });

    const validTypes = ["tag", "business", "org", "author"];
    if (!validTypes.includes(followType)) return res.status(400).json({ error: "Invalid followType" });

    await db.insert(follows).values({ userId, followType, followId }).onConflictDoNothing();

    return res.json({ following: true });
  } catch (err: any) {
    console.error("[Follow] Error:", err.message);
    return res.status(500).json({ error: "Failed to follow" });
  }
});

router.delete("/api/engagement/follow", async (req: Request, res: Response) => {
  try {
    const userId = getPublicUserId(req);
    if (!userId) return res.status(401).json({ error: "Login required" });

    const { followType, followId } = req.body;
    if (!followType || !followId) return res.status(400).json({ error: "followType and followId required" });

    await db.delete(follows).where(
      and(eq(follows.userId, userId), eq(follows.followType, followType), eq(follows.followId, followId))
    );

    return res.json({ following: false });
  } catch (err: any) {
    console.error("[Unfollow] Error:", err.message);
    return res.status(500).json({ error: "Failed to unfollow" });
  }
});

router.get("/api/engagement/follows", async (req: Request, res: Response) => {
  try {
    const userId = getPublicUserId(req);
    if (!userId) return res.json({ follows: [] });

    const followType = req.query.followType as string;
    if (!followType) return res.json({ follows: [] });

    const userFollows = await db.select({ followId: follows.followId })
      .from(follows)
      .where(and(eq(follows.userId, userId), eq(follows.followType, followType)));

    return res.json({ follows: userFollows.map(f => f.followId) });
  } catch (err: any) {
    console.error("[Get Follows] Error:", err.message);
    return res.json({ follows: [] });
  }
});

router.get("/api/admin/engagement/stats", async (req: Request, res: Response) => {
  try {
    const [likeCount] = await db.select({ count: sql<number>`count(*)::int` }).from(likes);
    const [followCount] = await db.select({ count: sql<number>`count(*)::int` }).from(follows);

    return res.json({
      totalLikes: likeCount?.count || 0,
      totalFollows: followCount?.count || 0,
    });
  } catch (err: any) {
    return res.json({ totalLikes: 0, totalFollows: 0 });
  }
});

const feedEventSchema = z.object({
  events: z.array(z.object({
    eventType: z.enum(["FEED_CARD_VIEW", "FEED_CARD_TAP", "FEED_CARD_LIKE", "FEED_CARD_SAVE", "FEED_CARD_SHARE", "PROFILE_VIEW"]),
    contentType: z.string(),
    contentId: z.string(),
    cityId: z.string(),
  })).max(50),
});

router.post("/api/log/feed-events", async (req: Request, res: Response) => {
  try {
    const parsed = feedEventSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid events" });

    const userId = getPublicUserId(req);
    const events = parsed.data.events;

    if (events.length > 0) {
      const rows = events.map(e => {
        const entityType = ["business", "enhanced_listing"].includes(e.contentType) ? "BUSINESS" as const : "BUSINESS" as const;
        return {
          metroId: e.cityId,
          entityType,
          entityId: e.contentId,
          eventType: e.eventType as any,
          metadataJson: { contentType: e.contentType, userId: userId || "anonymous" },
        };
      });

      await db.insert(intelligenceEventLog).values(rows).onConflictDoNothing();
    }

    return res.json({ ok: true, logged: events.length });
  } catch (err: any) {
    return res.json({ ok: true, logged: 0 });
  }
});

export default router;
