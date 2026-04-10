import { Router, type Request, type Response } from "express";
import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";
import { socialPosts, insertSocialPostSchema } from "@shared/schema";
import { generateSocialPosts, generateFromContent } from "./intelligence/social-content-generator";
import { z } from "zod";

const router = Router();

function requireAdmin(req: Request, res: Response): boolean {
  const session = req.session as any;
  if (!session?.userId) {
    res.status(401).json({ error: "Admin login required" });
    return false;
  }
  return true;
}

const validStatuses = ["draft", "approved", "published", "rejected"] as const;
const validPlatforms = ["youtube", "facebook", "instagram", "tiktok", "all"] as const;

const patchSchema = z.object({
  status: z.enum(validStatuses).optional(),
  caption: z.string().min(1).optional(),
  hashtags: z.array(z.string()).optional(),
  platform: z.enum(validPlatforms).optional(),
  imageUrl: z.string().nullable().optional(),
  videoUrl: z.string().nullable().optional(),
  scheduledAt: z.string().nullable().optional(),
  externalUrl: z.string().nullable().optional(),
});

router.get("/api/admin/social/posts", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { status, platform, metroId, limit: limitStr } = req.query;
  const limit = Math.min(parseInt(limitStr as string) || 50, 200);

  try {
    const conditions: any[] = [];
    if (metroId) conditions.push(eq(socialPosts.metroId, metroId as string));
    if (status) {
      if (!validStatuses.includes(status as any)) return res.status(400).json({ error: "Invalid status" });
      conditions.push(eq(socialPosts.status, status as any));
    }
    if (platform) {
      if (!validPlatforms.includes(platform as any)) return res.status(400).json({ error: "Invalid platform" });
      conditions.push(eq(socialPosts.platform, platform as any));
    }

    const rows = await db.select().from(socialPosts)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(socialPosts.createdAt))
      .limit(limit);

    return res.json(rows);
  } catch (err: any) {
    console.error("[Social] List error:", err.message);
    return res.status(500).json({ error: "Failed to fetch social posts" });
  }
});

router.post("/api/admin/social/posts", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const parsed = insertSocialPostSchema.parse(req.body);
    const [row] = await db.insert(socialPosts).values({
      ...parsed,
      createdBy: "admin",
    }).returning();
    return res.json(row);
  } catch (err: any) {
    console.error("[Social] Create error:", err.message);
    return res.status(400).json({ error: err.message || "Invalid data" });
  }
});

router.patch("/api/admin/social/posts/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const parsed = patchSchema.parse(req.body);
    const updates: any = {};

    if (parsed.status) updates.status = parsed.status;
    if (parsed.caption !== undefined) updates.caption = parsed.caption;
    if (parsed.hashtags !== undefined) updates.hashtags = parsed.hashtags;
    if (parsed.platform) updates.platform = parsed.platform;
    if (parsed.imageUrl !== undefined) updates.imageUrl = parsed.imageUrl;
    if (parsed.videoUrl !== undefined) updates.videoUrl = parsed.videoUrl;
    if (parsed.scheduledAt !== undefined) updates.scheduledAt = parsed.scheduledAt ? new Date(parsed.scheduledAt) : null;
    if (parsed.externalUrl !== undefined) updates.externalUrl = parsed.externalUrl;
    if (parsed.status === "published") updates.publishedAt = new Date();

    await db.update(socialPosts)
      .set(updates)
      .where(eq(socialPosts.id, req.params.id));
    return res.json({ ok: true });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid data", details: err.errors });
    }
    console.error("[Social] Update error:", err.message);
    return res.status(500).json({ error: "Failed to update social post" });
  }
});

router.delete("/api/admin/social/posts/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    await db.delete(socialPosts).where(eq(socialPosts.id, req.params.id));
    return res.json({ ok: true });
  } catch (err: any) {
    console.error("[Social] Delete error:", err.message);
    return res.status(500).json({ error: "Failed to delete social post" });
  }
});

router.post("/api/admin/social/generate", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const metroId = req.body?.metroId;
    const count = await generateSocialPosts(metroId);
    return res.json({ generated: count });
  } catch (err: any) {
    console.error("[Social] Generate error:", err.message);
    return res.status(500).json({ error: "Social content generation failed" });
  }
});

router.post("/api/admin/social/from-content", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { metroId, sourceType, sourceId, platform } = req.body;

  if (!metroId || !sourceType || !sourceId) {
    return res.status(400).json({ error: "metroId, sourceType, and sourceId are required" });
  }

  if (platform && !validPlatforms.includes(platform)) {
    return res.status(400).json({ error: "Invalid platform" });
  }

  try {
    const result = await generateFromContent(metroId, sourceType, sourceId);
    if (!result) {
      return res.status(404).json({ error: "Content not found or generation failed" });
    }

    const [row] = await db.insert(socialPosts).values({
      metroId,
      sourceType,
      sourceId,
      platform: platform || "all",
      caption: result.caption,
      hashtags: result.hashtags,
      imageUrl: result.imageUrl,
      status: "draft",
      createdBy: "charlotte",
    }).returning();

    return res.json(row);
  } catch (err: any) {
    console.error("[Social] From-content error:", err.message);
    return res.status(500).json({ error: "Failed to generate from content" });
  }
});

export default router;
