import { Router, type Request, type Response } from "express";
import { openai } from "./lib/openai";
import { PULSE_CAPTION_SYSTEM, CONTENT_MODERATION_SYSTEM } from "./ai/prompts/platform-services";
import { db } from "./db";
import { desc, eq, and, sql } from "drizzle-orm";
import { moderationQueue, posts, reposts, businesses, events, articles, publicUsers, getBusinessPostingPermissions, getUserPostingPermissions } from "@shared/schema";
import { z } from "zod";
import { storage } from "./storage";
import { queueTranslation } from "./services/auto-translate";
import { geoTagAndClassify } from "./services/geo-tagger";

const router = Router();

const MODERATION_TRUST_POLICY_DEFAULTS = {
  verifiedContributorAutoApproveEnabled: true,
  verifiedContributorAiReviewEnabled: true,
  trustScoreThreshold: 75,
  verifiedContributorBaseTrust: 70,
  autoApprovedTrust: 90,
  defaultTrust: 50,
};

let MODERATION_TRUST_POLICY = { ...MODERATION_TRUST_POLICY_DEFAULTS };

const SETTINGS_KEY = "moderation_trust_policy";

export async function loadModerationTrustPolicy(): Promise<void> {
  try {
    const saved = await storage.getPlatformSetting(SETTINGS_KEY);
    if (saved && typeof saved === "object") {
      MODERATION_TRUST_POLICY = { ...MODERATION_TRUST_POLICY_DEFAULTS, ...(saved as Partial<typeof MODERATION_TRUST_POLICY_DEFAULTS>) };
    }
  } catch {
    console.log("[Moderation] Using default trust policy (DB not ready or table missing)");
  }
}

export function getModerationTrustPolicy() {
  return { ...MODERATION_TRUST_POLICY };
}

export async function updateModerationTrustPolicy(updates: Partial<typeof MODERATION_TRUST_POLICY>) {
  MODERATION_TRUST_POLICY = { ...MODERATION_TRUST_POLICY, ...updates };
  await storage.setPlatformSetting(SETTINGS_KEY, MODERATION_TRUST_POLICY);
  return { ...MODERATION_TRUST_POLICY };
}

function getPublicUserId(req: Request): string | null {
  return (req.session as any)?.publicUserId || null;
}

function getAdminUserId(req: Request): string | null {
  return (req.session as any)?.userId || null;
}

router.post("/api/moderation/submit-post", async (req: Request, res: Response) => {
  try {
    const userId = getPublicUserId(req);
    if (!userId) return res.status(401).json({ error: "Login required to submit content" });

    const schema = z.object({
      title: z.string().min(1).max(500),
      body: z.string().max(5000).optional(),
      coverImageUrl: z.string().max(2000).optional(),
      videoUrl: z.string().max(2000).optional(),
      postType: z.enum(["post", "event_tip", "business_update", "photo"]).default("post"),
      cityId: z.string().min(1),
      tagIds: z.array(z.string()).optional(),
      postAsBusinessId: z.string().optional(),
      promoted: z.boolean().optional(),
    });

    const data = schema.parse(req.body);

    const [user] = await db.select().from(publicUsers).where(eq(publicUsers.id, userId)).limit(1);
    if (!user) return res.status(401).json({ error: "User not found" });

    let permissions = getUserPostingPermissions(user.roleTier);
    let postAsBusinessId: string | null = null;

    if (data.postAsBusinessId) {
      const [biz] = await db.select().from(businesses).where(and(eq(businesses.id, data.postAsBusinessId), eq(businesses.claimedByUserId, userId))).limit(1);
      if (biz) {
        permissions = getBusinessPostingPermissions(biz.claimStatus, biz.listingTier);
        postAsBusinessId = biz.id;
        if (!permissions.canPost) {
          return res.status(403).json({ error: permissions.upgradeCta || "Posting not available for this listing tier" });
        }
      }
    }

    let mediaType: "image" | "video" | "reel" | "gallery" = data.coverImageUrl ? "image" : "image";
    let videoEmbedUrl: string | null = null;
    let videoThumbnailUrl: string | null = null;
    let videoUrlField: string | null = null;

    if (data.videoUrl) {
      const { processTikTokVideoFields, fetchTikTokOEmbed, isTikTokUrl } = await import("./services/tiktok-embed");
      const processed = processTikTokVideoFields({ videoUrl: data.videoUrl });
      videoEmbedUrl = processed.videoEmbedUrl;
      videoUrlField = processed.videoUrl;
      mediaType = "video";

      if (processed.isTikTok && isTikTokUrl(data.videoUrl)) {
        const oembed = await fetchTikTokOEmbed(data.videoUrl);
        if (oembed?.thumbnailUrl) {
          videoThumbnailUrl = oembed.thumbnailUrl;
        }
      }
    }

    const isVerifiedContributor = (user as Record<string, unknown>).isVerifiedContributor === true;
    const userTrustScore = Number((user as Record<string, unknown>).moderationTrustScore) || 0;
    const verifiedAutoApprove = MODERATION_TRUST_POLICY.verifiedContributorAutoApproveEnabled
      && isVerifiedContributor
      && userTrustScore >= MODERATION_TRUST_POLICY.trustScoreThreshold;
    const verifiedAiReview = !verifiedAutoApprove
      && MODERATION_TRUST_POLICY.verifiedContributorAiReviewEnabled
      && isVerifiedContributor;
    const autoApproved = !permissions.requiresModeration || verifiedAutoApprove;

    let postStatus: string;
    let baseTrust: number;
    if (autoApproved) {
      postStatus = "approved";
      baseTrust = MODERATION_TRUST_POLICY.autoApprovedTrust;
    } else if (verifiedAiReview) {
      postStatus = "pending";
      baseTrust = Math.max(MODERATION_TRUST_POLICY.verifiedContributorBaseTrust, userTrustScore);
    } else {
      postStatus = "pending";
      baseTrust = MODERATION_TRUST_POLICY.defaultTrust;
    }

    const [post] = await db.insert(posts).values({
      cityId: data.cityId,
      authorUserId: userId,
      businessId: postAsBusinessId,
      sourceType: postAsBusinessId ? "business" : "user",
      mediaType,
      title: data.title,
      body: data.body || "",
      coverImageUrl: data.coverImageUrl || videoThumbnailUrl || null,
      videoUrl: videoUrlField,
      videoEmbedUrl,
      videoThumbnailUrl,
      status: postStatus,
      trustScore: baseTrust,
      isPromoted: data.promoted && permissions.canPromote ? true : false,
    }).returning();

    if (post) {
      queueTranslation("post", post.id);
      geoTagAndClassify("post", post.id, data.cityId, {
        title: data.title,
        description: data.body || null,
        businessId: postAsBusinessId || null,
      }, { skipAi: true }).catch(err => console.error("[GeoTagger] Post tag failed:", err.message));
    }

    (async () => {
      try {
        const stats = await storage.getContributorSubmissionStats(userId);
        const current = stats || { totalSubmissions: 0, approvedSubmissions: 0, pendingSubmissions: 0, rejectedSubmissions: 0 };
        await storage.upsertContributorSubmissionStats(userId, {
          totalSubmissions: (current.totalSubmissions || 0) + 1,
          approvedSubmissions: autoApproved ? (current.approvedSubmissions || 0) + 1 : current.approvedSubmissions || 0,
          pendingSubmissions: !autoApproved ? (current.pendingSubmissions || 0) + 1 : current.pendingSubmissions || 0,
          lastSubmissionAt: new Date(),
        });
      } catch {}
    })();

    if (!autoApproved) {
      const modStatus = verifiedAiReview ? "ai_reviewed" : "pending";
      const [modItem] = await db.insert(moderationQueue).values({
        contentType: data.postType,
        contentId: post.id,
        submittedByUserId: userId,
        cityId: data.cityId,
        status: modStatus,
      }).returning();

      if (!verifiedAiReview) {
        triggerAiReview(modItem.id, data.title, data.body || "").catch(() => {});
      }

      return res.status(201).json({
        ok: true,
        message: "Submitted for review",
        postId: post.id,
        moderationId: modItem.id,
        autoApproved: false,
      });
    }

    return res.status(201).json({
      ok: true,
      message: "Published",
      postId: post.id,
      autoApproved: true,
    });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return res.status(400).json({ error: "Invalid submission data", details: err.errors });
    }
    console.error("[Moderation] Submit error:", err.message);
    return res.status(500).json({ error: "Failed to submit" });
  }
});

router.get("/api/admin/moderation/queue", async (req: Request, res: Response) => {
  try {
    const adminId = getAdminUserId(req);
    if (!adminId) return res.status(401).json({ error: "Admin required" });

    const statusFilter = req.query.status as string || "pending";
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    let items;
    if (statusFilter && statusFilter !== "all") {
      items = await db.select().from(moderationQueue)
        .where(sql`${moderationQueue.status} = ${statusFilter}`)
        .orderBy(desc(moderationQueue.submittedAt))
        .limit(limit).offset(offset);
    } else {
      items = await db.select().from(moderationQueue)
        .orderBy(desc(moderationQueue.submittedAt))
        .limit(limit).offset(offset);
    }

    const postIds = items.filter(i => ["post", "event_tip", "business_update", "photo"].includes(i.contentType)).map(i => i.contentId);
    let postMap: Record<string, any> = {};
    if (postIds.length > 0) {
      const postRows = await db.select().from(posts).where(
        sql`${posts.id} = ANY(${postIds})`
      );
      for (const p of postRows) {
        postMap[p.id] = p;
      }
    }

    const enriched = items.map(item => ({
      ...item,
      contentPreview: postMap[item.contentId] ? {
        title: postMap[item.contentId].title,
        body: postMap[item.contentId].body,
        coverImageUrl: postMap[item.contentId].coverImageUrl,
        submitterEmail: postMap[item.contentId].submitterEmail,
        authorUserId: postMap[item.contentId].authorUserId,
      } : null,
    }));

    const [countResult] = statusFilter && statusFilter !== "all"
      ? await db.select({ count: sql<number>`count(*)` }).from(moderationQueue).where(sql`${moderationQueue.status} = ${statusFilter}`)
      : await db.select({ count: sql<number>`count(*)` }).from(moderationQueue);

    return res.json({
      items: enriched,
      total: Number(countResult?.count || 0),
      limit,
      offset,
    });
  } catch (err: any) {
    console.error("[Moderation] Queue fetch error:", err.message);
    return res.status(500).json({ error: "Failed to fetch queue" });
  }
});

router.get("/api/admin/moderation/stats", async (req: Request, res: Response) => {
  try {
    const adminId = getAdminUserId(req);
    if (!adminId) return res.status(401).json({ error: "Admin required" });

    const [pending] = await db.select({ count: sql<number>`count(*)` }).from(moderationQueue).where(sql`${moderationQueue.status} = 'pending'`);
    const [aiReviewed] = await db.select({ count: sql<number>`count(*)` }).from(moderationQueue).where(sql`${moderationQueue.status} = 'ai_reviewed'`);
    const [approved] = await db.select({ count: sql<number>`count(*)` }).from(moderationQueue).where(sql`${moderationQueue.status} = 'approved'`);
    const [rejected] = await db.select({ count: sql<number>`count(*)` }).from(moderationQueue).where(sql`${moderationQueue.status} = 'rejected'`);

    return res.json({
      pending: Number(pending?.count || 0),
      aiReviewed: Number(aiReviewed?.count || 0),
      approved: Number(approved?.count || 0),
      rejected: Number(rejected?.count || 0),
    });
  } catch (err: any) {
    console.error("[Moderation] Stats error:", err.message);
    return res.status(500).json({ error: "Failed to fetch stats" });
  }
});

router.post("/api/admin/moderation/:id/approve", async (req: Request, res: Response) => {
  try {
    const adminId = getAdminUserId(req);
    if (!adminId) return res.status(401).json({ error: "Admin required" });

    const { id } = req.params;
    const { reviewNotes } = req.body || {};

    const [item] = await db.select().from(moderationQueue).where(sql`${moderationQueue.id} = ${id}`);
    if (!item) return res.status(404).json({ error: "Item not found" });

    await db.update(moderationQueue).set({
      status: "approved",
      reviewedByAdminId: adminId,
      reviewNotes: reviewNotes || null,
      reviewedAt: new Date(),
    }).where(sql`${moderationQueue.id} = ${id}`);

    if (["post", "event_tip", "business_update", "photo"].includes(item.contentType)) {
      await db.update(posts).set({
        status: "approved",
        reviewedByUserId: adminId,
        reviewedAt: new Date(),
        publishedAt: new Date(),
      }).where(sql`${posts.id} = ${item.contentId}`);
    }

    if (item.submittedByUserId) {
      (async () => {
        try {
          const stats = await storage.getContributorSubmissionStats(item.submittedByUserId!);
          const current = stats || { approvedSubmissions: 0, pendingSubmissions: 0 };
          await storage.upsertContributorSubmissionStats(item.submittedByUserId!, {
            approvedSubmissions: (current.approvedSubmissions || 0) + 1,
            pendingSubmissions: Math.max(0, (current.pendingSubmissions || 0) - 1),
          });
        } catch {}
      })();
    }

    return res.json({ ok: true, status: "approved" });
  } catch (err: any) {
    console.error("[Moderation] Approve error:", err.message);
    return res.status(500).json({ error: "Failed to approve" });
  }
});

router.post("/api/admin/moderation/:id/reject", async (req: Request, res: Response) => {
  try {
    const adminId = getAdminUserId(req);
    if (!adminId) return res.status(401).json({ error: "Admin required" });

    const { id } = req.params;
    const { reviewNotes } = req.body || {};

    const [item] = await db.select().from(moderationQueue).where(sql`${moderationQueue.id} = ${id}`);
    if (!item) return res.status(404).json({ error: "Item not found" });

    await db.update(moderationQueue).set({
      status: "rejected",
      reviewedByAdminId: adminId,
      reviewNotes: reviewNotes || null,
      reviewedAt: new Date(),
    }).where(sql`${moderationQueue.id} = ${id}`);

    if (["post", "event_tip", "business_update", "photo"].includes(item.contentType)) {
      await db.update(posts).set({
        status: "rejected",
        reviewedByUserId: adminId,
        reviewedAt: new Date(),
        moderationNotes: reviewNotes || null,
      }).where(sql`${posts.id} = ${item.contentId}`);
    }

    if (item.submittedByUserId) {
      (async () => {
        try {
          const stats = await storage.getContributorSubmissionStats(item.submittedByUserId!);
          const current = stats || { rejectedSubmissions: 0, pendingSubmissions: 0 };
          await storage.upsertContributorSubmissionStats(item.submittedByUserId!, {
            rejectedSubmissions: (current.rejectedSubmissions || 0) + 1,
            pendingSubmissions: Math.max(0, (current.pendingSubmissions || 0) - 1),
          });
        } catch {}
      })();
    }

    return res.json({ ok: true, status: "rejected" });
  } catch (err: any) {
    console.error("[Moderation] Reject error:", err.message);
    return res.status(500).json({ error: "Failed to reject" });
  }
});

router.post("/api/reposts", async (req: Request, res: Response) => {
  try {
    const userId = getPublicUserId(req);
    if (!userId) return res.status(401).json({ error: "Login required to repost" });

    const schema = z.object({
      originalContentType: z.enum(["business", "event", "article", "post", "reel", "shop_item", "shop_drop"]),
      originalContentId: z.string().min(1),
      caption: z.string().max(280).optional(),
      cityId: z.string().min(1),
    });

    const data = schema.parse(req.body);

    const [repost] = await db.insert(reposts).values({
      userId,
      originalContentType: data.originalContentType,
      originalContentId: data.originalContentId,
      caption: data.caption || null,
    }).returning();

    const [modItem] = await db.insert(moderationQueue).values({
      contentType: "repost",
      contentId: repost.id,
      submittedByUserId: userId,
      cityId: data.cityId,
      status: "pending",
    }).returning();

    autoApproveRepostIfOriginalApproved(modItem.id, repost.id, data.originalContentType, data.originalContentId).catch(() => {});

    return res.status(201).json({
      ok: true,
      message: "Repost submitted for review",
      repostId: repost.id,
      moderationId: modItem.id,
    });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return res.status(400).json({ error: "Invalid repost data", details: err.errors });
    }
    console.error("[Repost] Submit error:", err.message);
    return res.status(500).json({ error: "Failed to create repost" });
  }
});

router.get("/api/reposts/user/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;

    const userReposts = await db.select().from(reposts)
      .where(sql`${reposts.userId} = ${userId}`)
      .orderBy(desc(reposts.createdAt))
      .limit(limit).offset(offset);

    const approvedRepostIds = new Set<string>();
    if (userReposts.length > 0) {
      const modItems = await db.select().from(moderationQueue)
        .where(and(
          sql`${moderationQueue.contentType} = 'repost'`,
          sql`${moderationQueue.contentId} = ANY(${userReposts.map(r => r.id)})`,
          sql`${moderationQueue.status} = 'approved'`
        ));
      for (const m of modItems) {
        approvedRepostIds.add(m.contentId);
      }
    }

    const approvedReposts = userReposts.filter(r => approvedRepostIds.has(r.id));

    return res.json({ reposts: approvedReposts, total: approvedReposts.length });
  } catch (err: any) {
    console.error("[Repost] Fetch error:", err.message);
    return res.status(500).json({ error: "Failed to fetch reposts" });
  }
});

async function autoApproveRepostIfOriginalApproved(
  moderationId: string,
  repostId: string,
  originalContentType: string,
  originalContentId: string
) {
  try {
    let isOriginalApproved = false;

    if (["business"].includes(originalContentType)) {
      const [biz] = await db.select().from(businesses).where(eq(businesses.id, originalContentId));
      isOriginalApproved = !!biz;
    } else if (["event"].includes(originalContentType)) {
      const [evt] = await db.select().from(events).where(eq(events.id, originalContentId));
      isOriginalApproved = !!evt;
    } else if (["article"].includes(originalContentType)) {
      const [art] = await db.select().from(articles).where(eq(articles.id, originalContentId));
      isOriginalApproved = !!art;
    } else if (["post", "reel"].includes(originalContentType)) {
      const [post] = await db.select().from(posts).where(and(
        eq(posts.id, originalContentId),
        sql`${posts.status} IN ('approved', 'published')`
      ));
      isOriginalApproved = !!post;
    } else {
      isOriginalApproved = true;
    }

    if (isOriginalApproved) {
      await db.update(moderationQueue).set({
        status: "approved",
        aiRecommendation: "approve",
        aiReasoning: "Auto-approved: repost of already-approved content",
        reviewedAt: new Date(),
      }).where(sql`${moderationQueue.id} = ${moderationId}`);
      console.log(`[Repost] Auto-approved repost ${repostId} of ${originalContentType}:${originalContentId}`);
    } else {
      triggerAiReview(moderationId, `Repost of ${originalContentType}`, "User reposted existing content").catch(() => {});
    }
  } catch (err: any) {
    console.error("[Repost] Auto-approve check failed:", err.message);
  }
}

router.post("/api/admin/pulse/create-post", async (req: Request, res: Response) => {
  try {
    const adminId = getAdminUserId(req);
    if (!adminId) return res.status(401).json({ error: "Admin required" });

    const schema = z.object({
      title: z.string().min(1).max(500),
      body: z.string().max(5000).optional(),
      coverImageUrl: z.string().max(2000).optional(),
      videoUrl: z.string().max(2000).optional(),
      postType: z.enum(["post", "event_tip", "business_update", "photo"]).default("post"),
      cityId: z.string().min(1),
      businessId: z.string().optional(),
      publishImmediately: z.boolean().default(true),
    });

    const data = schema.parse(req.body);

    let mediaType: "image" | "video" | "reel" | "gallery" = data.coverImageUrl ? "image" : "image";
    let videoEmbedUrl: string | null = null;
    let videoThumbnailUrl: string | null = null;
    let videoUrlField: string | null = null;

    if (data.videoUrl) {
      const { processTikTokVideoFields, fetchTikTokOEmbed, isTikTokUrl } = await import("./services/tiktok-embed");
      const processed = processTikTokVideoFields({ videoUrl: data.videoUrl });
      videoEmbedUrl = processed.videoEmbedUrl;
      videoUrlField = processed.videoUrl || data.videoUrl;
      mediaType = "video";

      if (processed.isTikTok && isTikTokUrl(data.videoUrl)) {
        const oembed = await fetchTikTokOEmbed(data.videoUrl);
        if (oembed?.thumbnailUrl) {
          videoThumbnailUrl = oembed.thumbnailUrl;
        }
      }

      if (!videoEmbedUrl && /youtube\.com|youtu\.be/i.test(data.videoUrl)) {
        const ytMatch = data.videoUrl.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        if (ytMatch) {
          videoEmbedUrl = `https://www.youtube.com/embed/${ytMatch[1]}`;
        }
      }
    }

    const status = data.publishImmediately ? "published" : "draft";
    const [post] = await db.insert(posts).values({
      cityId: data.cityId,
      authorUserId: adminId,
      businessId: data.businessId || null,
      sourceType: "staff",
      mediaType,
      title: data.title,
      body: data.body || "",
      coverImageUrl: data.coverImageUrl || videoThumbnailUrl || null,
      videoUrl: videoUrlField,
      videoEmbedUrl,
      videoThumbnailUrl,
      status,
      trustScore: 80,
      publishedAt: data.publishImmediately ? new Date() : null,
    }).returning();

    if (post) {
      queueTranslation("post", post.id);
      geoTagAndClassify("post", post.id, data.cityId, {
        title: data.title,
        description: data.body || null,
        businessId: data.businessId || null,
      }, { skipAi: true }).catch(err => console.error("[GeoTagger] Admin post tag failed:", err.message));
    }

    return res.json({ ok: true, post });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return res.status(400).json({ error: "Invalid data", details: err.errors });
    }
    console.error("[Admin Pulse] Create post error:", err.message);
    return res.status(500).json({ error: "Failed to create post" });
  }
});

router.post("/api/admin/pulse/ai-caption", async (req: Request, res: Response) => {
  try {
    const adminId = getAdminUserId(req);
    if (!adminId) return res.status(401).json({ error: "Admin required" });

    const { videoUrl, context } = req.body;
    if (!videoUrl) return res.status(400).json({ error: "videoUrl required" });

    let videoInfo = "";
    const { isTikTokUrl, fetchTikTokOEmbed } = await import("./services/tiktok-embed");
    if (isTikTokUrl(videoUrl)) {
      const oembed = await fetchTikTokOEmbed(videoUrl);
      if (oembed) {
        videoInfo = `TikTok video by @${oembed.authorName || "unknown"}: "${oembed.title || ""}"`;
      }
    }

    if (!openai) {
      return res.status(503).json({ error: "AI not configured" });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: PULSE_CAPTION_SYSTEM
        },
        {
          role: "user",
          content: `Generate a caption for this video being shared on our local Pulse feed.\n\nVideo info: ${videoInfo || "No metadata available"}\nVideo URL: ${videoUrl}\n${context ? `Additional context: ${context}` : ""}`
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 300,
    });

    let result: any = {};
    try {
      result = JSON.parse(response.choices[0]?.message?.content || "{}");
    } catch {
      const raw = response.choices[0]?.message?.content || "";
      result = { title: raw.slice(0, 60), body: raw, hashtags: [] };
    }
    return res.json({ ok: true, ...result });
  } catch (err: any) {
    console.error("[Admin Pulse] AI caption error:", err.message);
    return res.status(500).json({ error: "AI caption generation failed" });
  }
});

router.get("/api/admin/pulse/posts", async (req: Request, res: Response) => {
  try {
    const adminId = getAdminUserId(req);
    if (!adminId) return res.status(401).json({ error: "Admin required" });

    const cityId = req.query.cityId as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    let query = db.select().from(posts).orderBy(desc(posts.createdAt)).limit(limit);
    if (cityId) {
      query = query.where(eq(posts.cityId, cityId)) as any;
    }

    const items = await query;
    return res.json(items);
  } catch (err: any) {
    console.error("[Admin Pulse] List posts error:", err.message);
    return res.status(500).json({ error: "Failed to fetch posts" });
  }
});

async function triggerAiReview(moderationId: string, title: string, body: string) {
  try {
    if (!openai) {
      console.log("[Moderation AI] No OpenAI key, skipping AI review");
      return;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: CONTENT_MODERATION_SYSTEM
        },
        {
          role: "user",
          content: `Title: ${title}\nContent: ${body || "(no body)"}`
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 200,
    });

    const result = JSON.parse(response.choices[0]?.message?.content || "{}");
    const recommendation = ["approve", "reject", "flag"].includes(result.recommendation) ? result.recommendation : "flag";

    await db.update(moderationQueue).set({
      status: "ai_reviewed",
      aiRecommendation: recommendation as any,
      aiReasoning: result.reasoning || "No reasoning provided",
    }).where(sql`${moderationQueue.id} = ${moderationId}`);

    console.log(`[Moderation AI] Reviewed ${moderationId}: ${recommendation}`);
  } catch (err: any) {
    console.error("[Moderation AI] Review failed:", err.message);
  }
}

export default router;
