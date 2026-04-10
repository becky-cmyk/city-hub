import { Router, Request, Response, NextFunction } from "express";
import { db } from "./db";
import { pool } from "./db";
import { openai } from "./lib/openai";
import { buildContentStudioSystem, buildContentRegenSystem } from "./ai/prompts/platform-services";
import { sql, eq, desc, and, inArray } from "drizzle-orm";
import {
  contentPackages, contentDeliverables,
  businesses, events, articles, posts,
  cities, rssItems, cmsContentItems,
} from "@shared/schema";

const router = Router();

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!(req.session as any)?.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

export interface GeneratePackageParams {
  metroId: string;
  sourceType: string;
  sourceId: string;
  sourceTitle: string;
  sourceExcerpt?: string | null;
  sourceImageUrl?: string | null;
  createdBy?: string;
  scope?: string;
  personaName?: string;
  contentItemId?: string | null;
}

export async function generateContentPackage(params: GeneratePackageParams) {
  const { metroId, sourceType, sourceId, sourceTitle, sourceExcerpt, sourceImageUrl, createdBy, scope, personaName, contentItemId } = params;

  const city = await db.select({ name: cities.name }).from(cities).where(eq(cities.id, metroId)).limit(1);
  const cityName = city[0]?.name || "Charlotte";

  const [pkg] = await db.insert(contentPackages).values({
    metroId,
    sourceType,
    sourceId,
    sourceTitle,
    sourceExcerpt: sourceExcerpt || null,
    sourceImageUrl: sourceImageUrl || null,
    contentItemId: contentItemId || null,
    status: "draft",
    createdBy: createdBy || "charlotte",
  }).returning();

  const deliverables: Array<{
    type: "social_post" | "caption_variant" | "pulse_update" | "ad_copy" | "email_blurb" | "newsletter" | "video_script";
    platform: string | null;
    variant: string | null;
    content: string;
    hashtags: string[];
  }> = [];

  if (openai) {
    try {
      const sourceLabel = sourceType === "business" ? "local business"
        : sourceType === "event" ? "upcoming event"
        : sourceType === "article" ? "article/story"
        : sourceType === "cms_content" ? "CMS content item"
        : "community update";

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: buildContentStudioSystem(cityName),
          },
          {
            role: "user",
            content: `Generate a full content output package for this ${sourceLabel}:
Title: ${sourceTitle}
Description: ${sourceExcerpt || "No description"}
City: ${cityName}

Return JSON with this exact structure:
{
  "social_posts": [
    { "platform": "instagram", "variant": "short", "content": "Short Instagram caption (under 100 chars)" },
    { "platform": "instagram", "variant": "medium", "content": "Medium Instagram caption (100-300 chars)" },
    { "platform": "instagram", "variant": "long", "content": "Long Instagram caption (300-600 chars)" },
    { "platform": "tiktok", "variant": "short", "content": "TikTok caption (under 150 chars, punchy)" },
    { "platform": "twitter", "variant": "short", "content": "Twitter/X post (under 280 chars)" }
  ],
  "newsletter": {
    "subject_line": "Email subject line (under 60 chars)",
    "preview_text": "Preview/preheader text (under 100 chars)",
    "body": "Newsletter-ready formatted body paragraph (2-4 sentences)"
  },
  "pulse_snippets": [
    "1-2 sentence Pulse-ready snippet blurb",
    "Alternative Pulse snippet with a different angle"
  ],
  "video_script_prompt": "A short prompt or outline for a 30-60 second video script about this content (2-3 sentences describing what should be shown/said)",
  "hashtags": ["#tag1", "#tag2", "#tag3"]
}`,
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 1500,
        temperature: 0.8,
      });

      const content = completion.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        const baseHashtags = ["#CLT", "#Charlotte", "#CharlotteNC", "#QueenCity"];
        const allHashtags = Array.from(new Set([
          ...baseHashtags,
          ...(parsed.hashtags || []),
        ]));

        if (parsed.social_posts && Array.isArray(parsed.social_posts)) {
          for (const sp of parsed.social_posts) {
            deliverables.push({
              type: "social_post",
              platform: sp.platform || null,
              variant: sp.variant || null,
              content: sp.content,
              hashtags: allHashtags,
            });
          }
        }

        if (parsed.newsletter) {
          const nl = parsed.newsletter;
          const newsletterContent = `Subject: ${nl.subject_line || ""}\nPreview: ${nl.preview_text || ""}\n\n${nl.body || ""}`;
          deliverables.push({
            type: "newsletter",
            platform: null,
            variant: null,
            content: newsletterContent,
            hashtags: [],
          });
        }

        if (parsed.pulse_snippets && Array.isArray(parsed.pulse_snippets)) {
          parsed.pulse_snippets.forEach((snippet: string, idx: number) => {
            deliverables.push({
              type: "pulse_update",
              platform: null,
              variant: idx === 0 ? "A" : "B",
              content: snippet,
              hashtags: [],
            });
          });
        }

        if (parsed.video_script_prompt) {
          deliverables.push({
            type: "video_script",
            platform: null,
            variant: null,
            content: parsed.video_script_prompt,
            hashtags: [],
          });
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[ContentStudio] AI generation error:", msg);
    }
  }

  if (deliverables.length === 0) {
    const fallbackHashtags = ["#CLT", "#Charlotte", "#CharlotteNC", "#QueenCity"];
    deliverables.push(
      { type: "social_post", platform: "instagram", variant: "short", content: `${sourceTitle} -- worth checking out in ${cityName}.`, hashtags: fallbackHashtags },
      { type: "social_post", platform: "instagram", variant: "medium", content: `Check out ${sourceTitle} in ${cityName}! Your next local discovery is waiting.`, hashtags: fallbackHashtags },
      { type: "social_post", platform: "tiktok", variant: "short", content: `${sourceTitle} just dropped in ${cityName}`, hashtags: fallbackHashtags },
      { type: "social_post", platform: "twitter", variant: "short", content: `${cityName} has something new: ${sourceTitle}`, hashtags: fallbackHashtags },
      { type: "newsletter", platform: null, variant: null, content: `Subject: ${sourceTitle} in ${cityName}\nPreview: Something new is happening locally.\n\nNew on CLT Metro Hub: ${sourceTitle}. Discover what ${cityName} has to offer this week.`, hashtags: [] },
      { type: "pulse_update", platform: null, variant: "A", content: `New on CLT Metro Hub: ${sourceTitle}. Discover what ${cityName} has to offer.`, hashtags: [] },
      { type: "pulse_update", platform: null, variant: "B", content: `${sourceTitle} is live in ${cityName}. See what the buzz is about.`, hashtags: [] },
      { type: "video_script", platform: null, variant: null, content: `Create a 30-second spotlight on ${sourceTitle} in ${cityName}. Open with a neighborhood establishing shot, then showcase the main subject with a local voice-over.`, hashtags: [] },
    );
  }

  const insertedDeliverables = [];
  for (const d of deliverables) {
    const [row] = await db.insert(contentDeliverables).values({
      packageId: pkg.id,
      type: d.type,
      platform: d.platform,
      variant: d.variant,
      content: d.content,
      hashtags: d.hashtags,
      imageUrl: sourceImageUrl || null,
      status: "draft",
      ...(scope ? { scope } : {}),
      ...(personaName ? { personaName } : {}),
    }).returning();
    insertedDeliverables.push(row);
  }

  return { package: pkg, deliverables: insertedDeliverables };
}

router.get("/api/admin/content-studio/sources", requireAdmin, async (req, res) => {
  const metroId = req.query.metroId as string;
  const sourceType = (req.query.type as string) || "all";
  const limit = Math.min(Number(req.query.limit) || 30, 100);

  if (!metroId) return res.status(400).json({ error: "metroId required" });

  const sources: Array<{
    sourceType: string;
    sourceId: string;
    title: string;
    excerpt: string;
    imageUrl: string | null;
    createdAt: string;
  }> = [];

  if (sourceType === "all" || sourceType === "article") {
    const rows = await db.select({
      id: articles.id,
      title: articles.title,
      excerpt: articles.excerpt,
      imageUrl: articles.imageUrl,
      createdAt: articles.createdAt,
    })
      .from(articles)
      .where(eq(articles.cityId, metroId))
      .orderBy(desc(articles.createdAt))
      .limit(limit);
    for (const r of rows) {
      sources.push({
        sourceType: "article",
        sourceId: r.id,
        title: r.title,
        excerpt: r.excerpt?.substring(0, 200) || "",
        imageUrl: r.imageUrl || null,
        createdAt: r.createdAt?.toISOString() || new Date().toISOString(),
      });
    }
  }

  if (sourceType === "all" || sourceType === "event") {
    const rows = await db.select({
      id: events.id,
      title: events.title,
      description: events.description,
      imageUrl: events.imageUrl,
      createdAt: events.createdAt,
    })
      .from(events)
      .where(eq(events.cityId, metroId))
      .orderBy(desc(events.createdAt))
      .limit(limit);
    for (const r of rows) {
      sources.push({
        sourceType: "event",
        sourceId: r.id,
        title: r.title,
        excerpt: r.description?.substring(0, 200) || "",
        imageUrl: r.imageUrl || null,
        createdAt: r.createdAt?.toISOString() || new Date().toISOString(),
      });
    }
  }

  if (sourceType === "all" || sourceType === "business") {
    const rows = await db.select({
      id: businesses.id,
      name: businesses.name,
      description: businesses.description,
      imageUrl: businesses.imageUrl,
      createdAt: businesses.createdAt,
    })
      .from(businesses)
      .where(eq(businesses.cityId, metroId))
      .orderBy(desc(businesses.createdAt))
      .limit(limit);
    for (const r of rows) {
      sources.push({
        sourceType: "business",
        sourceId: r.id,
        title: r.name,
        excerpt: r.description?.substring(0, 200) || "",
        imageUrl: r.imageUrl || null,
        createdAt: r.createdAt?.toISOString() || new Date().toISOString(),
      });
    }
  }

  if (sourceType === "all" || sourceType === "post") {
    const rows = await db.select({
      id: posts.id,
      title: posts.title,
      body: posts.body,
      coverImageUrl: posts.coverImageUrl,
      createdAt: posts.createdAt,
    })
      .from(posts)
      .where(and(eq(posts.cityId, metroId), eq(posts.status, "approved")))
      .orderBy(desc(posts.createdAt))
      .limit(limit);
    for (const r of rows) {
      sources.push({
        sourceType: "post",
        sourceId: r.id,
        title: r.title || "Untitled Post",
        excerpt: r.body?.substring(0, 200) || "",
        imageUrl: r.coverImageUrl || null,
        createdAt: r.createdAt?.toISOString() || new Date().toISOString(),
      });
    }
  }

  if (sourceType === "all" || sourceType === "cms_content") {
    const rows = await db.select({
      id: cmsContentItems.id,
      titleEn: cmsContentItems.titleEn,
      excerptEn: cmsContentItems.excerptEn,
      heroImageAssetId: cmsContentItems.heroImageAssetId,
      contentType: cmsContentItems.contentType,
      status: cmsContentItems.status,
      createdAt: cmsContentItems.createdAt,
    })
      .from(cmsContentItems)
      .where(and(
        eq(cmsContentItems.cityId, metroId),
        eq(cmsContentItems.status, "published"),
      ))
      .orderBy(desc(cmsContentItems.createdAt))
      .limit(limit);
    for (const r of rows) {
      sources.push({
        sourceType: "cms_content",
        sourceId: r.id,
        title: r.titleEn,
        excerpt: r.excerptEn?.substring(0, 200) || "",
        imageUrl: null,
        createdAt: r.createdAt?.toISOString() || new Date().toISOString(),
      });
    }
  }

  sources.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(sources.slice(0, limit));
});

router.post("/api/admin/content-studio/generate", requireAdmin, async (req, res) => {
  const { metroId, sourceType, sourceId, sourceTitle, sourceExcerpt, sourceImageUrl, contentItemId } = req.body;
  if (!metroId || !sourceType || !sourceId || !sourceTitle) {
    return res.status(400).json({ error: "metroId, sourceType, sourceId, and sourceTitle are required" });
  }

  try {
    const result = await generateContentPackage({
      metroId, sourceType, sourceId, sourceTitle, sourceExcerpt, sourceImageUrl, contentItemId,
    });
    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[ContentStudio] generate error:", msg);
    res.status(500).json({ error: msg });
  }
});

router.post("/api/admin/content-studio/generate-for-cms/:contentItemId", requireAdmin, async (req, res) => {
  const { contentItemId } = req.params;

  try {
    const [item] = await db.select().from(cmsContentItems).where(eq(cmsContentItems.id, contentItemId)).limit(1);
    if (!item) return res.status(404).json({ error: "CMS content item not found" });

    const result = await generateContentPackage({
      metroId: item.cityId,
      sourceType: "cms_content",
      sourceId: item.id,
      sourceTitle: item.titleEn,
      sourceExcerpt: item.excerptEn || item.bodyEn?.substring(0, 300) || null,
      sourceImageUrl: null,
      contentItemId: item.id,
    });
    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[ContentStudio] generate-for-cms error:", msg);
    res.status(500).json({ error: msg });
  }
});

router.get("/api/admin/content-studio/packages", requireAdmin, async (req, res) => {
  const metroId = req.query.metroId as string;
  if (!metroId) return res.status(400).json({ error: "metroId required" });

  const statusFilter = req.query.status as string | undefined;
  const limit = Math.min(Number(req.query.limit) || 50, 200);

  let conditions = [eq(contentPackages.metroId, metroId)];
  if (statusFilter) {
    conditions.push(eq(contentPackages.status, statusFilter as "draft" | "review" | "approved" | "published" | "archived"));
  }

  const pkgs = await db.select()
    .from(contentPackages)
    .where(and(...conditions))
    .orderBy(desc(contentPackages.createdAt))
    .limit(limit);

  const pkgIds = pkgs.map(p => p.id);
  let allDeliverables: Array<typeof contentDeliverables.$inferSelect> = [];
  if (pkgIds.length > 0) {
    allDeliverables = await db.select()
      .from(contentDeliverables)
      .where(inArray(contentDeliverables.packageId, pkgIds))
      .orderBy(contentDeliverables.type);
  }

  const deliverablesByPkg = new Map<string, typeof allDeliverables>();
  for (const d of allDeliverables) {
    const arr = deliverablesByPkg.get(d.packageId) || [];
    arr.push(d);
    deliverablesByPkg.set(d.packageId, arr);
  }

  const result = pkgs.map(pkg => ({
    ...pkg,
    deliverables: deliverablesByPkg.get(pkg.id) || [],
  }));

  res.json(result);
});

router.patch("/api/admin/content-studio/deliverables/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { content, status, hashtags } = req.body;

  const updates: Record<string, unknown> = {};
  if (content !== undefined) updates.content = content;
  if (status !== undefined) updates.status = status;
  if (hashtags !== undefined) updates.hashtags = hashtags;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No update fields provided" });
  }

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (content !== undefined) {
    setClauses.push(`content = $${paramIdx++}`);
    values.push(content);
  }
  if (status !== undefined) {
    setClauses.push(`status = $${paramIdx++}`);
    values.push(status);
  }
  if (hashtags !== undefined) {
    setClauses.push(`hashtags = $${paramIdx++}`);
    values.push(hashtags);
  }

  values.push(id);
  const result = await pool.query(
    `UPDATE content_deliverables SET ${setClauses.join(", ")} WHERE id = $${paramIdx} RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "Deliverable not found" });
  }

  res.json(result.rows[0]);
});

router.patch("/api/admin/content-studio/packages/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) return res.status(400).json({ error: "status required" });

  const result = await pool.query(
    `UPDATE content_packages SET status = $1 WHERE id = $2 RETURNING *`,
    [status, id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "Package not found" });
  }

  res.json(result.rows[0]);
});

router.delete("/api/admin/content-studio/packages/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  await pool.query(`DELETE FROM content_deliverables WHERE package_id = $1`, [id]);
  await pool.query(`DELETE FROM content_packages WHERE id = $1`, [id]);
  res.json({ ok: true });
});

router.post("/api/admin/content-studio/packages/:id/regenerate", requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const [pkg] = await db.select().from(contentPackages).where(eq(contentPackages.id, id));
    if (!pkg) return res.status(404).json({ error: "Package not found" });

    await pool.query(`DELETE FROM content_deliverables WHERE package_id = $1`, [id]);
    await pool.query(`DELETE FROM content_packages WHERE id = $1`, [id]);

    const result = await generateContentPackage({
      metroId: pkg.metroId,
      sourceType: pkg.sourceType,
      sourceId: pkg.sourceId,
      sourceTitle: pkg.sourceTitle,
      sourceExcerpt: pkg.sourceExcerpt,
      sourceImageUrl: pkg.sourceImageUrl,
      contentItemId: pkg.contentItemId,
      createdBy: pkg.createdBy,
    });
    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[ContentStudio] regenerate error:", msg);
    res.status(500).json({ error: msg });
  }
});

router.post("/api/admin/content-studio/deliverables/:id/regenerate", requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const delResult = await pool.query(`SELECT * FROM content_deliverables WHERE id = $1`, [id]);
    if (delResult.rows.length === 0) return res.status(404).json({ error: "Deliverable not found" });
    const deliverable = delResult.rows[0];

    const [pkg] = await db.select().from(contentPackages).where(eq(contentPackages.id, deliverable.package_id));
    if (!pkg) return res.status(404).json({ error: "Package not found" });

    const city = await db.select({ name: cities.name }).from(cities).where(eq(cities.id, pkg.metroId)).limit(1);
    const cityName = city[0]?.name || "Charlotte";

    let newContent = deliverable.content;

    if (openai) {
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: buildContentRegenSystem(cityName),
            },
            {
              role: "user",
              content: `Regenerate this ${deliverable.type}${deliverable.platform ? ` for ${deliverable.platform}` : ""}${deliverable.variant ? ` (${deliverable.variant} variant)` : ""} about "${pkg.sourceTitle}" (${pkg.sourceExcerpt || "no description"}):

Current content: ${deliverable.content}

Write a fresh alternative with a different angle. Return only the content text.`,
            },
          ],
          max_tokens: 500,
          temperature: 0.9,
        });
        newContent = completion.choices[0]?.message?.content || deliverable.content;
      } catch (err: unknown) {
        console.error("[ContentStudio] single regenerate AI error:", err);
      }
    }

    const updateResult = await pool.query(
      `UPDATE content_deliverables SET content = $1, status = 'draft' WHERE id = $2 RETURNING *`,
      [newContent, id]
    );

    res.json(updateResult.rows[0]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[ContentStudio] single regenerate error:", msg);
    res.status(500).json({ error: msg });
  }
});

export default router;
