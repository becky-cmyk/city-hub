import { Router, Request, Response } from "express";
import { storage } from "./storage";
import { z } from "zod";
import { insertCmsContentItemSchema } from "@shared/schema";
import { onCmsContentReview, onCmsContentResolved } from "./admin-inbox";
import { queueTranslation, autoTranslateCmsContent } from "./services/auto-translate";
import { generateContentPackage } from "./content-studio-routes";
import { openai } from "./lib/openai";
import { CHARLOTTE_POLISH_SYSTEM } from "./ai/prompts/content-pipeline";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";

const cmsUploadDir = path.join(process.cwd(), "uploads", "cms-assets");
if (!fs.existsSync(cmsUploadDir)) fs.mkdirSync(cmsUploadDir, { recursive: true });

const cmsUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, cmsUploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".jpg";
      cb(null, `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml", "application/pdf", "video/mp4"];
    cb(null, allowed.includes(file.mimetype));
  },
});

const router = Router();

function p(val: any): string {
  if (Array.isArray(val)) return String(val[0]);
  return val ? String(val) : "";
}
function q(val: any): string | undefined {
  if (val === undefined || val === null) return undefined;
  if (Array.isArray(val)) return String(val[0]);
  return typeof val === "string" ? val : String(val);
}

function requireAdmin(req: Request, res: Response, next: Function) {
  if (!(req.session as any)?.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

function getAdminUserId(req: Request): string {
  return (req.session as any)?.userId || "system";
}

async function recordRevisions(
  contentItemId: string,
  oldItem: Record<string, any>,
  newData: Record<string, any>,
  actorUserId: string,
  actorType: "admin" | "editor" | "reviewer" | "system" = "admin",
  reason?: string
) {
  const trackFields = [
    "titleEn", "titleEs", "slug", "excerptEn", "excerptEs", "bodyEn", "bodyEs",
    "status", "publishAt", "unpublishAt", "publishedAt", "assignedEditorUserId",
    "assignedReviewerUserId", "zoneId", "categoryId", "seoTitleEn", "seoTitleEs",
    "seoDescriptionEn", "seoDescriptionEs", "canonicalUrl", "heroImageAssetId",
    "authorId", "visibility", "allowComments", "languagePrimary", "contentType",
  ];

  for (const field of trackFields) {
    if (field in newData) {
      const oldVal = oldItem[field];
      const newVal = newData[field];
      if (String(oldVal ?? "") !== String(newVal ?? "")) {
        await storage.createCmsRevision({
          contentItemId,
          actorType,
          actorUserId,
          fieldName: field,
          oldValue: oldVal != null ? String(oldVal) : null,
          newValue: newVal != null ? String(newVal) : null,
          reason: reason || null,
        });
      }
    }
  }
}

async function syncToLegacyArticle(cmsItem: any) {
  const legacyId = await storage.getCmsBridgeArticle(cmsItem.id);
  if (!legacyId) return;

  const updateData: any = {
    title: cmsItem.titleEn,
    slug: cmsItem.slug,
    excerpt: cmsItem.excerptEn,
    content: cmsItem.bodyEn,
    publishedAt: cmsItem.publishedAt,
    updatedAt: new Date(),
  };
  if (cmsItem.zoneId) updateData.zoneId = cmsItem.zoneId;
  if (cmsItem.categoryId) updateData.primaryCategoryId = cmsItem.categoryId;

  await storage.updateArticle(legacyId, updateData);
}

// ========================
// CMS Content Items
// ========================

router.get("/api/admin/cms/content", requireAdmin, async (req: Request, res: Response) => {
  try {
    const filters = {
      contentType: q(req.query.contentType),
      status: q(req.query.status),
      assignedTo: q(req.query.assignedTo),
      cityId: q(req.query.cityId),
      search: q(req.query.search),
      limit: q(req.query.limit) ? parseInt(q(req.query.limit)!) : undefined,
      offset: q(req.query.offset) ? parseInt(q(req.query.offset)!) : undefined,
    };
    const result = await storage.getCmsContentItems(filters);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/admin/cms/content/stats", requireAdmin, async (req: Request, res: Response) => {
  try {
    const cityId = q(req.query.cityId);
    const counts = await storage.getCmsStatusCounts(cityId);
    res.json(counts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/admin/cms/content/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const item = await storage.getCmsContentItemById(p(req.params.id));
    if (!item) return res.status(404).json({ error: "Not found" });
    res.json(item);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const createContentSchema = insertCmsContentItemSchema;

router.post("/api/admin/cms/content", requireAdmin, async (req: Request, res: Response) => {
  try {
    const data = createContentSchema.parse(req.body);
    const item = await storage.createCmsContentItem({
      ...data,
      createdByUserId: getAdminUserId(req),
    });

    await storage.createCmsWorkflowEvent({
      contentItemId: item.id,
      eventType: "submitted_for_review",
      note: "Content item created",
      actorUserId: getAdminUserId(req),
    });

    queueTranslation("cms_content", item.id);

    res.status(201).json(item);
  } catch (err: any) {
    if (err.name === "ZodError") return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: err.message });
  }
});

router.patch("/api/admin/cms/content/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = p(req.params.id);
    const existing = await storage.getCmsContentItemById(id);
    if (!existing) return res.status(404).json({ error: "Not found" });

    const updateData = { ...req.body };
    if (updateData.titleEn !== undefined) updateData.titleEs = null;
    if (updateData.bodyEn !== undefined) updateData.bodyEs = null;
    if (updateData.excerptEn !== undefined) updateData.excerptEs = null;
    if (updateData.seoTitleEn !== undefined) updateData.seoTitleEs = null;
    if (updateData.seoDescriptionEn !== undefined) updateData.seoDescriptionEs = null;
    await recordRevisions(id, existing, updateData, getAdminUserId(req));

    const updated = await storage.updateCmsContentItem(id, updateData);

    if (updated && (updated.contentType === "article")) {
      await syncToLegacyArticle(updated);
    }

    if (updated && (req.body.titleEn !== undefined || req.body.bodyEn !== undefined || req.body.excerptEn !== undefined || req.body.seoTitleEn !== undefined || req.body.seoDescriptionEn !== undefined)) {
      queueTranslation("cms_content", id);
    }

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/api/admin/cms/content/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = p(req.params.id);
    const item = await storage.getCmsContentItemById(id);
    if (!item) return res.status(404).json({ error: "Not found" });
    await storage.deleteCmsContentItem(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ========================
// Workflow Transitions
// ========================

router.post("/api/admin/cms/content/:id/transition", requireAdmin, async (req: Request, res: Response) => {
  try {
    const transitionSchema = z.object({
      action: z.enum(["submit_for_review", "approve", "reject", "publish", "unpublish", "archive", "schedule"]),
      note: z.string().optional(),
    });
    const id = p(req.params.id);
    const { action, note } = transitionSchema.parse(req.body);
    const item = await storage.getCmsContentItemById(id);
    if (!item) return res.status(404).json({ error: "Not found" });

    const userId = getAdminUserId(req);
    let newStatus: string;
    let eventType: string;

    switch (action) {
      case "submit_for_review":
        newStatus = "in_review";
        eventType = "submitted_for_review";
        break;
      case "approve":
        newStatus = item.publishAt && new Date(item.publishAt) > new Date() ? "scheduled" : "published";
        eventType = newStatus === "scheduled" ? "scheduled" : "approved";
        break;
      case "reject":
        newStatus = "draft";
        eventType = "rejected";
        break;
      case "publish":
        newStatus = "published";
        eventType = "published";
        break;
      case "unpublish":
        newStatus = "archived";
        eventType = "unpublished";
        break;
      case "archive":
        newStatus = "archived";
        eventType = "unpublished";
        break;
      case "schedule":
        newStatus = "scheduled";
        eventType = "scheduled";
        break;
      default:
        return res.status(400).json({ error: "Invalid action" });
    }

    await recordRevisions(id, item, { status: newStatus }, userId, "admin", note);

    const publishedAt = (newStatus === "published" && !item.publishedAt) ? new Date() : item.publishedAt;
    const updated = await storage.updateCmsContentItem(id, {
      status: newStatus as any,
      publishedAt,
    });

    await storage.createCmsWorkflowEvent({
      contentItemId: id,
      eventType: eventType as any,
      note: note || null,
      actorUserId: userId,
    });

    if (newStatus === "in_review") {
      onCmsContentReview({ id, title: item.titleEn || item.titleEs || "Untitled" }).catch(console.error);
    } else if (["published", "archived", "draft"].includes(newStatus) && item.status === "in_review") {
      onCmsContentResolved(id).catch(console.error);
    }

    if (newStatus === "published") {
      import("./services/article-observation").then(({ observeArticlePublished }) => {
        observeArticlePublished({
          title: item.titleEn || item.titleEs || "Untitled",
          summary: (item as any).summaryEn || (item as any).summaryEs || null,
          categoryName: (item as any).categoryName || undefined,
          cityName: "Charlotte",
        }).catch(e => console.error("[ArticleObservation] Failed:", e.message));
      }).catch(e => console.error("[ArticleObservation] Import failed:", e instanceof Error ? e.message : e));
    }

    if (action === "approve") {
      import("./services/automation-triggers").then(({ enqueueAutomationTrigger }) => {
        enqueueAutomationTrigger({
          triggerEvent: "story_approved",
          entityType: "cms_content",
          entityId: id,
          cityId: item.cityId || undefined,
          payload: { title: item.titleEn || item.titleEs || "Untitled", contentType: item.contentType, cityId: item.cityId },
        }).catch(err => console.error("[Automation] story_approved trigger error:", err));
      });
    }

    if (updated && updated.contentType === "article") {
      await syncToLegacyArticle(updated);
    }

    if (newStatus === "published") {
      import("./services/automation-triggers").then(({ enqueueAutomationTrigger }) => {
        enqueueAutomationTrigger({
          triggerEvent: "content_published",
          entityType: "cms_content",
          entityId: id,
          cityId: item.cityId || undefined,
          payload: { title: item.titleEn || item.titleEs || "Untitled", contentType: item.contentType, cityId: item.cityId },
        }).catch(err => console.error("[Automation] content_published trigger error:", err));
      });

      try {
        await autoTranslateCmsContent(id);
      } catch (translateErr) {
        console.error(`[CMS] Synchronous translation failed on publish for ${id}, will retry via background scanner:`, translateErr);
      }

      try {
        await generateContentPackage({
          metroId: item.cityId,
          sourceType: "cms_content",
          sourceId: item.id,
          sourceTitle: item.titleEn || item.titleEs || "Untitled",
          sourceExcerpt: item.excerptEn || item.bodyEn?.substring(0, 300) || null,
          sourceImageUrl: null,
          contentItemId: item.id,
        });
        console.log(`[CMS] Auto-generated content package for published item ${id}`);
      } catch (genErr) {
        console.error(`[CMS] Content package auto-generation failed for ${id}:`, genErr);
      }
    }

    res.json(updated);
  } catch (err: any) {
    if (err.name === "ZodError") return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: err.message });
  }
});

// ========================
// Revisions & Workflow Events
// ========================

router.get("/api/admin/cms/content/:id/revisions", requireAdmin, async (req: Request, res: Response) => {
  try {
    const revisions = await storage.getCmsRevisions(p(req.params.id));
    res.json(revisions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/admin/cms/content/:id/workflow-events", requireAdmin, async (req: Request, res: Response) => {
  try {
    const events = await storage.getCmsWorkflowEvents(p(req.params.id));
    res.json(events);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ========================
// Calendar
// ========================

router.get("/api/admin/cms/calendar", requireAdmin, async (req: Request, res: Response) => {
  try {
    const startStr = q(req.query.start);
    const endStr = q(req.query.end);
    if (!startStr || !endStr) return res.status(400).json({ error: "start and end query params required" });
    const start = new Date(startStr);
    const end = new Date(endStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return res.status(400).json({ error: "Invalid dates" });
    const items = await storage.getCmsCalendarItems(start, end);
    res.json(items);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ========================
// Content Relations
// ========================

router.get("/api/admin/cms/content/:id/relations", requireAdmin, async (req: Request, res: Response) => {
  try {
    const relations = await storage.getCmsContentRelations(p(req.params.id));
    res.json(relations);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/admin/cms/content/:id/relations", requireAdmin, async (req: Request, res: Response) => {
  try {
    const relSchema = z.object({
      relationType: z.enum(["presence", "event", "organization", "commerce", "zone", "category"]),
      relatedId: z.string(),
    });
    const data = relSchema.parse(req.body);
    const rel = await storage.createCmsContentRelation({
      contentItemId: p(req.params.id),
      ...data,
    });
    res.status(201).json(rel);
  } catch (err: any) {
    if (err.name === "ZodError") return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: err.message });
  }
});

router.delete("/api/admin/cms/relations/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    await storage.deleteCmsContentRelation(p(req.params.id));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ========================
// Tags
// ========================

router.get("/api/admin/cms/tags", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const tags = await storage.getAllCmsTags();
    res.json(tags);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/admin/cms/tags", requireAdmin, async (req: Request, res: Response) => {
  try {
    const tagSchema = z.object({ name: z.string().min(1), slug: z.string().min(1) });
    const data = tagSchema.parse(req.body);
    const tag = await storage.createCmsTag(data);
    res.status(201).json(tag);
  } catch (err: any) {
    if (err.name === "ZodError") return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: err.message });
  }
});

router.patch("/api/admin/cms/tags/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const tagSchema = z.object({ name: z.string().min(1).optional(), slug: z.string().min(1).optional() });
    const data = tagSchema.parse(req.body);
    const tag = await storage.updateCmsTag(p(req.params.id), data);
    if (!tag) return res.status(404).json({ error: "Not found" });
    res.json(tag);
  } catch (err: any) {
    if (err.name === "ZodError") return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: err.message });
  }
});

router.delete("/api/admin/cms/tags/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const ok = await storage.deleteCmsTag(p(req.params.id));
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/admin/cms/content/:id/tags", requireAdmin, async (req: Request, res: Response) => {
  try {
    const tagIds = await storage.getCmsContentTagIds(p(req.params.id));
    res.json(tagIds);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/api/admin/cms/content/:id/tags", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { tagIds } = z.object({ tagIds: z.array(z.string()) }).parse(req.body);
    await storage.setCmsContentTags(p(req.params.id), tagIds);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ========================
// Assets (Media Library)
// ========================

router.get("/api/admin/cms/assets", requireAdmin, async (req: Request, res: Response) => {
  try {
    const filters = {
      fileType: q(req.query.fileType),
      search: q(req.query.search),
      linkedBusinessId: q(req.query.linkedBusinessId),
      linkedCreatorId: q(req.query.linkedCreatorId),
      hubSlug: q(req.query.hubSlug),
      licenseType: q(req.query.licenseType),
      status: q(req.query.status),
      tag: q(req.query.tag),
      categoryId: q(req.query.categoryId),
    };
    const assets = await storage.getCmsAssets(filters);
    res.json(assets);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/admin/cms/assets/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const asset = await storage.getCmsAssetById(p(req.params.id));
    if (!asset) return res.status(404).json({ error: "Not found" });
    res.json(asset);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/admin/cms/assets", requireAdmin, cmsUpload.single("file"), async (req: Request, res: Response) => {
  try {
    const file = (req as any).file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const fileUrl = `/uploads/cms-assets/${file.filename}`;
    const mimeType = file.mimetype;
    let fileType: "image" | "video" | "pdf" | "other" = "image";
    if (mimeType.startsWith("video/")) fileType = "video";
    else if (mimeType === "application/pdf") fileType = "pdf";
    else if (!mimeType.startsWith("image/")) fileType = "other";

    const categoryIds = req.body.categoryIds ? (typeof req.body.categoryIds === "string" ? JSON.parse(req.body.categoryIds) : req.body.categoryIds) : [];
    const tags = req.body.tags ? (typeof req.body.tags === "string" ? JSON.parse(req.body.tags) : req.body.tags) : [];

    const asset = await storage.createCmsAsset({
      fileUrl,
      fileType,
      mimeType,
      altTextEn: req.body.altTextEn || file.originalname,
      altTextEs: req.body.altTextEs || null,
      captionEn: req.body.captionEn || null,
      captionEs: req.body.captionEs || null,
      uploadedByUserId: getAdminUserId(req),
      creditName: req.body.creditName || null,
      creditUrl: req.body.creditUrl || null,
      licenseType: req.body.licenseType || "owned",
      linkedBusinessId: req.body.linkedBusinessId || null,
      linkedCreatorId: req.body.linkedCreatorId || null,
      categoryIds,
      zoneId: req.body.zoneId || null,
      hubSlug: req.body.hubSlug || null,
      tags,
      status: req.body.status || "approved",
      priceInCents: req.body.priceInCents ? parseInt(req.body.priceInCents) : null,
      hubUseApproved: req.body.hubUseApproved === "true" || req.body.hubUseApproved === true,
    });
    res.status(201).json(asset);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/api/admin/cms/assets/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const asset = await storage.updateCmsAsset(p(req.params.id), req.body);
    if (!asset) return res.status(404).json({ error: "Not found" });
    res.json(asset);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ========================
// Article Backfill (Bridge)
// ========================

router.post("/api/admin/cms/backfill-articles", requireAdmin, async (req: Request, res: Response) => {
  try {
    const allArticles = await storage.getAllArticles();
    let backfilled = 0;
    let skipped = 0;

    for (const article of allArticles) {
      const existing = await storage.getCmsBridgeByLegacyId(article.id);
      if (existing) { skipped++; continue; }

      const city = await storage.getCityById(article.cityId);
      if (!city) { skipped++; continue; }

      const cmsItem = await storage.createCmsContentItem({
        contentType: "article",
        titleEn: article.title,
        titleEs: null,
        slug: article.slug,
        excerptEn: article.excerpt || null,
        excerptEs: null,
        bodyEn: article.content || null,
        bodyEs: null,
        status: article.publishedAt ? "published" : "draft",
        publishAt: null,
        unpublishAt: null,
        publishedAt: article.publishedAt || null,
        createdByUserId: null,
        assignedEditorUserId: null,
        assignedReviewerUserId: null,
        cityId: article.cityId,
        zoneId: article.zoneId || null,
        categoryId: article.primaryCategoryId || null,
        languagePrimary: "en",
        seoTitleEn: article.title,
        seoTitleEs: null,
        seoDescriptionEn: article.excerpt || null,
        seoDescriptionEs: null,
        canonicalUrl: null,
        heroImageAssetId: null,
        visibility: "public",
        allowComments: false,
      });

      await storage.createCmsBridgeArticle(cmsItem.id, article.id);
      backfilled++;
    }

    res.json({ backfilled, skipped, total: allArticles.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/cms/pages/:slug", async (req: Request, res: Response) => {
  try {
    const items = await storage.getCmsContentItems({
      contentType: "page",
      status: "published",
      search: undefined,
      limit: 100,
    });
    const page = items.items.find((item: any) => item.slug === req.params.slug);
    if (!page) return res.status(404).json({ error: "Page not found" });
    res.json(page);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ========================
// Charlotte Polish (Paste & Polish)
// ========================

router.post("/api/admin/cms/charlotte-polish", requireAdmin, async (req: Request, res: Response) => {
  try {
    const polishSchema = z.object({
      rawText: z.string().min(10, "Article text must be at least 10 characters"),
    });
    const { rawText } = polishSchema.parse(req.body);

    if (!openai) {
      return res.status(503).json({ error: "AI service not available" });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: CHARLOTTE_POLISH_SYSTEM },
        { role: "user", content: rawText },
      ],
      response_format: { type: "json_object" },
      max_tokens: 4096,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      return res.status(500).json({ error: "No response from AI" });
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content);
    } catch {
      return res.status(500).json({ error: "AI returned invalid JSON" });
    }

    if (!parsed.parsedTitle || typeof parsed.parsedTitle !== "string") {
      return res.status(422).json({ error: "AI could not parse the article title. Try adding a clear title on the first line." });
    }

    const rawFaqs = Array.isArray(parsed.faqPairs) ? parsed.faqPairs : [];
    const validFaqPairs = rawFaqs
      .filter((f: unknown): f is { question: string; answer: string } => {
        if (!f || typeof f !== "object") return false;
        const obj = f as Record<string, unknown>;
        return typeof obj.question === "string" && typeof obj.answer === "string" && (obj.question as string).trim() !== "" && (obj.answer as string).trim() !== "";
      })
      .map((f) => ({ question: f.question.trim(), answer: f.answer.trim() }));

    const rawTags = Array.isArray(parsed.tags) ? parsed.tags : [];
    const validTags = rawTags
      .filter((t: unknown): t is string => typeof t === "string" && t.trim() !== "")
      .map((t) => t.trim().toLowerCase());

    const titleLine = (parsed.parsedTitle as string).trim();
    const titleIdx = rawText.indexOf(titleLine);
    let resolvedBody: string;
    if (titleIdx !== -1) {
      const afterTitle = rawText.substring(titleIdx + titleLine.length);
      const bodyStart = afterTitle.indexOf("\n");
      resolvedBody = bodyStart !== -1 ? afterTitle.substring(bodyStart + 1) : afterTitle;
    } else {
      const firstNewline = rawText.indexOf("\n");
      resolvedBody = firstNewline !== -1 ? rawText.substring(firstNewline + 1) : rawText;
    }

    res.json({
      parsedTitle: (parsed.parsedTitle as string).trim(),
      body: resolvedBody,
      seoTitle: typeof parsed.seoTitle === "string" ? parsed.seoTitle.trim() : "",
      metaDescription: typeof parsed.metaDescription === "string" ? parsed.metaDescription.trim() : "",
      slug: (typeof parsed.slug === "string" ? parsed.slug : "").replace(/[^a-z0-9-]/g, "").substring(0, 80),
      excerpt: typeof parsed.excerpt === "string" ? parsed.excerpt.trim() : "",
      tags: validTags,
      faqPairs: validFaqPairs,
      isEvergreen: !!parsed.isEvergreen,
      evergreenReason: typeof parsed.evergreenReason === "string" ? parsed.evergreenReason.trim() : "",
    });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Charlotte Polish] Error:", message);
    res.status(500).json({ error: message });
  }
});

export default router;
