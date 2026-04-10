import { Router, type Request, type Response } from "express";
import { db } from "./db";
import { eq, and, desc, sql, count, gte, isNull, isNotNull } from "drizzle-orm";
import { MESSAGING_STRATEGIST_SYSTEM } from "./ai/prompts/platform-services";
import {
  pulseSignals, aiOutreachDrafts, aiContentDrafts, feedReviewPrompts,
  platformMessaging, insertPlatformMessagingSchema,
  businesses, crmContacts, rssItems, submissions, adminInboxItems,
  entityScores, entityContactVerification, intelligenceEventLog, zones,
  applicantProfiles, businessHiringProfiles, jobListings, skillCategories,
  applicantCredentials,
} from "@shared/schema";
import { INSPIRATION_QUOTES, PLATFORM_TAGLINES } from "@shared/inspirational-quotes";
import { runPulseScanner } from "./intelligence/pulse-scanner";
import { runContentGenerator } from "./intelligence/content-generator";
import { runOutreachDrafter } from "./intelligence/outreach-drafter";
import { runReviewSolicitor, getActiveReviewPrompts, dismissReviewPrompt, markReviewPromptResponded } from "./intelligence/review-solicitor";
import { getEmailPipelineStatus } from "./intelligence/email-lead-pipeline";
import { getResendClient } from "./resend-client";

const router = Router();

function requireAdmin(req: Request, res: Response): boolean {
  const session = req.session as any;
  if (!session?.userId) {
    res.status(401).json({ error: "Admin login required" });
    return false;
  }
  return true;
}

function getPublicUserId(req: Request): string | null {
  return (req.session as any)?.publicUserId || null;
}

router.get("/api/admin/charlotte/daily-report", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const outreachSentResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM ai_outreach_drafts
      WHERE status = 'sent' AND sent_at >= ${sevenDaysAgo}
    `);
    const outreachSent = Number(outreachSentResult.rows[0]?.count || 0);

    const claimedResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM businesses
      WHERE claimed_by_user_id IS NOT NULL AND claimed_at >= ${sevenDaysAgo}
    `);
    const claimedThisWeek = Number(claimedResult.rows[0]?.count || 0);

    const conversionRate = outreachSent > 0 ? Math.round((claimedThisWeek / outreachSent) * 100) : 0;

    const totalOutreachDrafts = await db.execute(sql`
      SELECT COUNT(*) as count FROM ai_outreach_drafts WHERE status = 'draft'
    `);
    const pendingDrafts = Number(totalOutreachDrafts.rows[0]?.count || 0);

    const salesPulse = {
      outreachSent,
      claimedThisWeek,
      conversionRate,
      pendingDrafts,
    };

    const hubSignalsResult = await db.execute(sql`
      SELECT z.name as zone_name, z.slug, COUNT(e.id) as activity_count
      FROM intelligence_event_log e
      JOIN zones z ON z.id = e.entity_id OR z.slug = e.entity_id
      WHERE e.created_at >= ${sevenDaysAgo}
      GROUP BY z.name, z.slug
      ORDER BY activity_count DESC
      LIMIT 10
    `);

    const topZonesByBusiness = await db.execute(sql`
      SELECT z.name as zone_name, z.slug, COUNT(b.id) as biz_count,
        COUNT(CASE WHEN b.claimed_by_user_id IS NOT NULL THEN 1 END) as claimed_count,
        COUNT(CASE WHEN b.created_at >= ${sevenDaysAgo} THEN 1 END) as new_count
      FROM businesses b
      JOIN zones z ON z.id = b.zone_id
      GROUP BY z.name, z.slug
      ORDER BY biz_count DESC
      LIMIT 10
    `);

    const hubSignals = {
      topZones: topZonesByBusiness.rows.map((r: any) => ({
        name: r.zone_name,
        slug: r.slug,
        totalBusinesses: Number(r.biz_count),
        claimed: Number(r.claimed_count),
        newThisWeek: Number(r.new_count),
      })),
    };

    const newBusinessesResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM businesses WHERE created_at >= ${twentyFourHoursAgo}
    `);
    const newCapturesResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM crm_contacts WHERE created_at >= ${twentyFourHoursAgo}
    `);
    const newRssResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM rss_items WHERE created_at >= ${twentyFourHoursAgo}
    `);
    const newSubmissionsResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM submissions WHERE created_at >= ${twentyFourHoursAgo}
    `);
    const seededReadyResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM businesses
      WHERE seed_source_type IS NOT NULL AND claimed_by_user_id IS NULL
    `);

    const newOpportunityActivity = {
      newBusinesses: Number(newBusinessesResult.rows[0]?.count || 0),
      newCaptures: Number(newCapturesResult.rows[0]?.count || 0),
      newRssItems: Number(newRssResult.rows[0]?.count || 0),
      newSubmissions: Number(newSubmissionsResult.rows[0]?.count || 0),
      seededReady: Number(seededReadyResult.rows[0]?.count || 0),
    };

    const topLeadsResult = await db.execute(sql`
      SELECT es.entity_id, es.prospect_fit_score, es.contact_ready_score, es.data_quality_score, es.bucket,
        b.name as business_name, b.phone as business_phone, b.owner_email, b.zone_id,
        ecv.detected_email, ecv.detected_phone,
        z.name as zone_name
      FROM entity_scores es
      LEFT JOIN businesses b ON b.id = es.entity_id
      LEFT JOIN entity_contact_verification ecv ON ecv.entity_id = es.entity_id
      LEFT JOIN zones z ON z.id = b.zone_id
      WHERE (b.owner_email IS NOT NULL OR ecv.detected_email IS NOT NULL OR ecv.detected_phone IS NOT NULL OR b.phone IS NOT NULL)
      ORDER BY es.prospect_fit_score DESC, es.contact_ready_score DESC
      LIMIT 10
    `);

    const topLeads = topLeadsResult.rows.map((r: any) => ({
      entityId: r.entity_id,
      name: r.business_name || "Unknown",
      zone: r.zone_name || "",
      prospectFitScore: Number(r.prospect_fit_score),
      contactReadyScore: Number(r.contact_ready_score),
      bucket: r.bucket,
      contactEmail: r.owner_email || r.detected_email || null,
      contactPhone: r.business_phone || r.detected_phone || null,
    }));

    const EXCEPTION_TYPES = [
      'presence_claim_confirm', 'presence_transfer_request',
      'billing_past_due', 'billing_founder_grace_expiring',
      'org_supporter_grace_expiring', 'email_bounce_attention',
      'email_complaint_attention', 'places_import_failed',
      'site_error_report', 'cms_content_review',
      'submission_business', 'submission_organization', 'submission_event',
      'submission_article_pitch', 'submission_press_release',
      'submission_shoutout', 'submission_media_mention',
    ];

    const exceptionCountResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM admin_inbox_items
      WHERE status IN ('open', 'in_progress')
        AND item_type IN ${sql.raw("('" + EXCEPTION_TYPES.join("','") + "')")}
    `);
    const exceptionCount = Number(exceptionCountResult.rows[0]?.count || 0);

    const exceptionItemsResult = await db.execute(sql`
      SELECT id, item_type, title, summary, priority, created_at FROM admin_inbox_items
      WHERE status IN ('open', 'in_progress')
        AND item_type IN ${sql.raw("('" + EXCEPTION_TYPES.join("','") + "')")}
      ORDER BY
        CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'med' THEN 2 ELSE 3 END,
        created_at DESC
      LIMIT 15
    `);

    const exceptions = {
      count: exceptionCount,
      items: exceptionItemsResult.rows.map((r: any) => ({
        id: r.id,
        type: r.item_type,
        title: r.title,
        summary: r.summary,
        priority: r.priority,
        createdAt: r.created_at,
      })),
    };

    const newSignalsResult = await db.execute(sql`
      SELECT signal_type, title, summary, entity_id, score, data_json
      FROM pulse_signals
      WHERE status = 'new'
      ORDER BY score DESC
      LIMIT 10
    `);

    const suggestedActions = (newSignalsResult.rows as any[]).map((s: any) => {
      let action = "";
      switch (s.signal_type) {
        case "UNCLAIMED_HIGH_DEMAND":
          action = `Contact ${s.data_json?.businessName || "business"} — high demand, unclaimed`;
          break;
        case "UPGRADE_READY":
          action = `Pitch upgrade to ${s.data_json?.businessName || "business"} — active on Verified tier`;
          break;
        case "DORMANT_CLAIMED":
          action = `Re-engage ${s.data_json?.businessName || "business"} — dormant 60+ days`;
          break;
        case "TRENDING_TOPIC":
          action = `Create content around trending topic: ${s.data_json?.tag || s.entity_id}`;
          break;
        case "CONTRIBUTOR_CANDIDATE":
          action = `Promote ${s.data_json?.displayName || "user"} to Contributor role`;
          break;
        default:
          action = s.summary || s.title;
      }
      return {
        signalType: s.signal_type,
        action,
        score: Number(s.score),
      };
    });

    let emailPipeline = null;
    try {
      emailPipeline = await getEmailPipelineStatus();
    } catch (epErr: any) {
      console.error("[Charlotte] Email pipeline status error:", epErr.message);
    }

    return res.json({
      generatedAt: now.toISOString(),
      salesPulse,
      hubSignals,
      newOpportunityActivity,
      topLeads,
      exceptions,
      suggestedActions,
      emailPipeline,
    });
  } catch (err: any) {
    console.error("[Charlotte] Daily report error:", err.message);
    return res.status(500).json({ error: "Failed to generate daily report" });
  }
});

router.post("/api/admin/charlotte/run-pulse-scan", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const result = await runPulseScanner();
    return res.json(result);
  } catch (err: any) {
    console.error("[Charlotte] Pulse scan error:", err.message);
    return res.status(500).json({ error: "Scan failed" });
  }
});

router.post("/api/admin/charlotte/run-content-gen", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const count = await runContentGenerator();
    return res.json({ draftsCreated: count });
  } catch (err: any) {
    console.error("[Charlotte] Content gen error:", err.message);
    return res.status(500).json({ error: "Content generation failed" });
  }
});

router.post("/api/admin/charlotte/run-outreach", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const count = await runOutreachDrafter();
    return res.json({ draftsCreated: count });
  } catch (err: any) {
    console.error("[Charlotte] Outreach error:", err.message);
    return res.status(500).json({ error: "Outreach drafting failed" });
  }
});

router.post("/api/admin/charlotte/run-review-solicitor", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { metroId } = req.body;
  if (!metroId) return res.status(400).json({ error: "metroId required" });
  try {
    const count = await runReviewSolicitor(metroId);
    return res.json({ promptsCreated: count });
  } catch (err: any) {
    console.error("[Charlotte] Review solicitor error:", err.message);
    return res.status(500).json({ error: "Review solicitor failed" });
  }
});

router.post("/api/admin/charlotte/run-all", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const scanResult = await runPulseScanner();
    const contentCount = await runContentGenerator();
    const outreachCount = await runOutreachDrafter();
    return res.json({
      scan: scanResult,
      contentDrafts: contentCount,
      outreachDrafts: outreachCount,
    });
  } catch (err: any) {
    console.error("[Charlotte] Run-all error:", err.message);
    return res.status(500).json({ error: "Charlotte run failed" });
  }
});

router.get("/api/admin/charlotte/signals", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { metroId, status, type, limit: limitStr } = req.query;
  const limit = Math.min(parseInt(limitStr as string) || 50, 100);

  try {
    let query = db.select().from(pulseSignals).orderBy(desc(pulseSignals.createdAt)).limit(limit);

    const conditions = [];
    if (metroId) conditions.push(eq(pulseSignals.metroId, metroId as string));
    if (status) conditions.push(eq(pulseSignals.status, status as any));
    if (type) conditions.push(eq(pulseSignals.signalType, type as any));

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const signals = await query;
    return res.json(signals);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch signals" });
  }
});

router.patch("/api/admin/charlotte/signals/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { status } = req.body;
  if (!["reviewed", "actioned", "dismissed"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }
  try {
    await db.update(pulseSignals)
      .set({ status, reviewedAt: new Date() })
      .where(eq(pulseSignals.id, req.params.id));
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to update signal" });
  }
});

router.get("/api/admin/charlotte/signals/summary", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { metroId } = req.query;
  try {
    const conditions = [eq(pulseSignals.status, "new" as any)];
    if (metroId) conditions.push(eq(pulseSignals.metroId, metroId as string));

    const summary = await db.execute(sql`
      SELECT signal_type, COUNT(*) as count
      FROM pulse_signals
      WHERE status = 'new'
      ${metroId ? sql`AND metro_id = ${metroId as string}` : sql``}
      GROUP BY signal_type
      ORDER BY count DESC
    `);
    return res.json(summary.rows);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to get summary" });
  }
});

router.get("/api/admin/charlotte/outreach", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { status, limit: limitStr } = req.query;
  const limit = Math.min(parseInt(limitStr as string) || 50, 100);

  try {
    const conditions = [];
    if (status) conditions.push(eq(aiOutreachDrafts.status, status as any));

    const drafts = await db.select().from(aiOutreachDrafts)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(aiOutreachDrafts.createdAt))
      .limit(limit);
    return res.json(drafts);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch outreach" });
  }
});

router.patch("/api/admin/charlotte/outreach/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { status, subject, body } = req.body;

  try {
    const updates: any = {};
    if (status) updates.status = status;
    if (subject) updates.subject = subject;
    if (body) updates.body = body;
    if (status === "sent") updates.sentAt = new Date();

    await db.update(aiOutreachDrafts)
      .set(updates)
      .where(eq(aiOutreachDrafts.id, req.params.id));
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to update outreach" });
  }
});

router.get("/api/admin/charlotte/content", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { status, limit: limitStr } = req.query;
  const limit = Math.min(parseInt(limitStr as string) || 50, 100);

  try {
    const conditions = [];
    if (status) conditions.push(eq(aiContentDrafts.status, status as any));

    const drafts = await db.select().from(aiContentDrafts)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(aiContentDrafts.createdAt))
      .limit(limit);
    return res.json(drafts);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch content" });
  }
});

router.patch("/api/admin/charlotte/content/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { status, title, body } = req.body;

  try {
    const updates: any = {};
    if (status) updates.status = status;
    if (title) updates.title = title;
    if (body) updates.body = body;
    if (status === "approved" || status === "rejected") updates.reviewedAt = new Date();

    await db.update(aiContentDrafts)
      .set(updates)
      .where(eq(aiContentDrafts.id, req.params.id));
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to update content" });
  }
});

router.get("/api/feed/review-prompts", async (req, res) => {
  const userId = getPublicUserId(req);
  if (!userId) return res.json([]);

  const { metroId } = req.query;
  if (!metroId) return res.json([]);

  try {
    const prompts = await getActiveReviewPrompts(userId, metroId as string);
    return res.json(prompts);
  } catch (err: any) {
    return res.json([]);
  }
});

router.post("/api/feed/review-prompts/:id/dismiss", async (req, res) => {
  const userId = getPublicUserId(req);
  if (!userId) return res.status(401).json({ error: "Login required" });

  try {
    await dismissReviewPrompt(req.params.id, userId);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to dismiss" });
  }
});

router.post("/api/feed/review-prompts/:id/responded", async (req, res) => {
  const userId = getPublicUserId(req);
  if (!userId) return res.status(401).json({ error: "Login required" });

  try {
    await markReviewPromptResponded(req.params.id, userId);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to mark responded" });
  }
});

router.get("/api/admin/charlotte/capability-summary", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const lastScanResult = await db.select()
      .from(pulseSignals)
      .orderBy(desc(pulseSignals.createdAt))
      .limit(1);

    const lastScanTimestamp = lastScanResult.length > 0 ? lastScanResult[0].createdAt : null;

    const knowledgeDomains = [
      { name: "Platform Features", description: "Pulse Feed, Business Directory, Events Calendar, Articles, Digital Cards, Marketplace, Neighborhood Hubs, Curated Lists" },
      { name: "Coverage Area", description: "19 counties (NC & SC), 140+ communities, Charlotte metro neighborhoods" },
      { name: "Pricing & Tiers", description: "$1 Verification, Hub Presence ($499/$99), Expanded Hub Presence ($699/$299)" },
      { name: "Handles & Identity", description: "@identity for every user and business on the platform" },
      { name: "Tiered Permissions", description: "What each presence tier can do — posting frequency, features, visibility" },
      { name: "Pulse Intelligence", description: "Charlotte scans activity, surfaces opportunities, generates outreach" },
      { name: "Inspirational Quotes", description: `${INSPIRATION_QUOTES.length} curated quotes from business leaders & community builders` },
      { name: "Platform Taglines", description: `${PLATFORM_TAGLINES.length} rotating taglines for brand messaging` },
      { name: "Bilingual Support", description: "Natively bilingual in English and Spanish — all features, all pages" },
      { name: "Community Storytelling", description: "Story interview system, Tell Your Story, article generation" },
    ];

    return res.json({
      knowledgeDomains,
      lastScanTimestamp,
      quotesCount: INSPIRATION_QUOTES.length,
      taglinesCount: PLATFORM_TAGLINES.length,
    });
  } catch (err: any) {
    console.error("[Charlotte] Capability summary error:", err.message);
    return res.status(500).json({ error: "Failed to get capability summary" });
  }
});

router.post("/api/admin/charlotte/orchestrate", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { input, metroId } = req.body;
  if (!input || typeof input !== "string") return res.status(400).json({ error: "input string required" });
  try {
    const { orchestrate, getOrchestratorSummary } = await import("./charlotte-orchestrator");
    const result = await orchestrate({
      input,
      metroId: metroId || undefined,
      userId: (req.session as Record<string, unknown>)?.userId as string,
      source: "api",
    });
    return res.json({
      summary: getOrchestratorSummary(result),
      command: result.command,
      routing: result.routing,
      logId: result.logId,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[Charlotte] Orchestrate error:", msg);
    return res.status(500).json({ error: "Orchestration failed" });
  }
});

// ── Platform Messaging CRUD ──

router.get("/api/admin/messaging", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const rows = await db.select().from(platformMessaging).orderBy(desc(platformMessaging.createdAt));
    return res.json(rows);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch messaging" });
  }
});

router.post("/api/admin/messaging", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const parsed = insertPlatformMessagingSchema.parse(req.body);
    const [row] = await db.insert(platformMessaging).values(parsed).returning();
    return res.json(row);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || "Invalid data" });
  }
});

router.patch("/api/admin/messaging/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { status, text, author, pageContexts, category } = req.body;
  try {
    const updates: any = {};
    if (status) updates.status = status;
    if (text !== undefined) updates.text = text;
    if (author !== undefined) updates.author = author;
    if (pageContexts !== undefined) updates.pageContexts = pageContexts;
    if (category) updates.category = category;

    await db.update(platformMessaging)
      .set(updates)
      .where(eq(platformMessaging.id, req.params.id));
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to update messaging" });
  }
});

router.delete("/api/admin/messaging/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    await db.delete(platformMessaging).where(eq(platformMessaging.id, req.params.id));
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to delete messaging" });
  }
});

router.post("/api/admin/messaging/suggest-variations", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { openai } = await import("./lib/openai");
    if (!openai) {
      return res.status(503).json({ error: "OpenAI not configured" });
    }

    const existingQuotes = INSPIRATION_QUOTES.slice(0, 10).map(q => `"${q.text}" — ${q.author}`).join("\n");
    const existingTaglines = PLATFORM_TAGLINES.slice(0, 5).join("\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: MESSAGING_STRATEGIST_SYSTEM
        },
        {
          role: "user",
          content: `Here are some existing quotes on our platform:\n${existingQuotes}\n\nAnd existing taglines:\n${existingTaglines}\n\nGenerate 5 new variations: 2 taglines (short, punchy platform taglines), 2 quotes (attributed inspirational quotes about community/business/storytelling), and 1 CTA (call-to-action text for selling pages). Return as a JSON object with key "variations" containing an array of objects: { category: "tagline"|"quote"|"cta", text: string, author?: string, pageContexts: string[] } where pageContexts are from: activate, pricing, claim, hub-screens, tell-your-story, charlotte-chat. Example: { "variations": [{ "category": "tagline", "text": "...", "pageContexts": ["activate"] }] }`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return res.status(500).json({ error: "No response from AI" });
    }

    const parsed = JSON.parse(content);
    const variations = parsed.variations || parsed.items || parsed.messages || [];

    const inserted = [];
    for (const v of variations) {
      if (!v.text || !v.category) continue;
      const [row] = await db.insert(platformMessaging).values({
        category: v.category,
        text: v.text,
        author: v.author || null,
        pageContexts: v.pageContexts || [],
        status: "suggested",
        suggestedBy: "charlotte",
      }).returning();
      inserted.push(row);
    }

    return res.json({ generated: inserted.length, items: inserted });
  } catch (err: any) {
    console.error("[Messaging] Suggest variations error:", err.message);
    return res.status(500).json({ error: "Failed to generate variations" });
  }
});

function buildStoryInviteHtml(recipientName: string, bizName: string, storyUrl: string) {
  const logoUrl = "https://cltcityhub.com/icons/clt-logo.png";
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f1f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1f9;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(91,29,143,0.08);">

  <!-- Header with CLT skyline logo -->
  <tr><td style="background:linear-gradient(135deg,#5B1D8F 0%,#7B2FBF 50%,#9B4DCA 100%);padding:40px 32px 32px;text-align:center;">
    <img src="${logoUrl}" alt="City Metro Hub" width="120" height="120" style="display:block;margin:0 auto 16px;" />
    <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;letter-spacing:-0.3px;">We'd Love to Feature Your Story</h1>
  </td></tr>

  <!-- Spanish toggle -->
  <tr><td style="background:#f9f7fc;padding:12px 32px;border-bottom:1px solid #f0ecf5;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-size:13px;color:#7B2FBF;">
        <a href="#spanish" style="color:#7B2FBF;text-decoration:none;font-weight:600;">Necesitas esto en espa&#241;ol? <span style="font-size:11px;">&#8595; Lee abajo</span></a>
      </td>
    </tr></table>
  </td></tr>

  <!-- English content -->
  <tr><td style="padding:32px 32px 8px;">
    <p style="color:#1a1a2e;font-size:17px;margin:0 0 18px;font-weight:500;">Hi ${recipientName},</p>
    <p style="color:#444;line-height:1.75;margin:0 0 18px;font-size:15px;">
      I'm reaching out because we're starting to highlight the people, organizations, and community voices that make Charlotte what it is.
    </p>
    <p style="color:#444;line-height:1.75;margin:0 0 18px;font-size:15px;">
      City Metro Hub is gathering local stories &mdash; the ones behind the work people do here, the things they've built, and what makes this community special. Your name came up as someone we'd love to include.
    </p>
    <p style="color:#444;line-height:1.75;margin:0 0 18px;font-size:15px;">
      Instead of filling out a form, we simply have a short conversation. It takes about five minutes.
    </p>
    <p style="color:#444;line-height:1.75;margin:0 0 8px;font-size:15px;">
      We'll ask things like:
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 18px;">
      <tr><td style="padding:4px 0 4px 16px;color:#444;font-size:15px;line-height:1.6;">&bull; What inspired you to get started</td></tr>
      <tr><td style="padding:4px 0 4px 16px;color:#444;font-size:15px;line-height:1.6;">&bull; What makes what you do meaningful</td></tr>
      <tr><td style="padding:4px 0 4px 16px;color:#444;font-size:15px;line-height:1.6;">&bull; What you love about being part of the Charlotte community</td></tr>
    </table>
    <p style="color:#444;line-height:1.75;margin:0 0 24px;font-size:15px;">
      From that conversation we shape it into a short feature that helps the community discover you.
    </p>
  </td></tr>

  <!-- CTA button -->
  <tr><td style="padding:0 32px 28px;text-align:center;">
    <a href="${storyUrl}" style="background:linear-gradient(135deg,#5B1D8F 0%,#7B2FBF 100%);color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:10px;font-weight:700;font-size:17px;display:inline-block;letter-spacing:0.3px;">Tell Your Story</a>
  </td></tr>

  <!-- Warm closing -->
  <tr><td style="padding:0 32px 24px;">
    <p style="color:#1a1a2e;font-size:15px;line-height:1.6;margin:0 0 18px;">Thanks for being part of the community.</p>
    <p style="color:#1a1a2e;font-size:15px;margin:0 0 2px;">&mdash; Charlotte</p>
    <p style="color:#777;font-size:14px;margin:0 0 2px;">Neighborhood Story Editor</p>
    <p style="color:#777;font-size:14px;margin:0;">City Metro Hub</p>
  </td></tr>

  <!-- Divider -->
  <tr><td style="padding:0 32px;"><hr style="border:none;border-top:2px solid #f0ecf5;margin:0;" /></td></tr>

  <!-- Spanish version -->
  <tr><td style="padding:28px 32px 8px;" id="spanish">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#f9f7fc,#f3eef9);border:1px solid #e8e0f0;border-radius:12px;">
      <tr><td style="padding:24px 24px 8px;">
        <p style="color:#5B1D8F;font-size:16px;font-weight:700;margin:0 0 4px;">Versi&#243;n en Espa&#241;ol</p>
        <p style="color:#777;font-size:12px;margin:0 0 16px;">Spanish version below</p>
      </td></tr>
      <tr><td style="padding:0 24px;">
        <p style="color:#1a1a2e;font-size:16px;margin:0 0 14px;font-weight:500;">Hola ${recipientName},</p>
        <p style="color:#444;line-height:1.75;margin:0 0 14px;font-size:14px;">
          Me comunico porque estamos comenzando a destacar a las personas, organizaciones y voces comunitarias que hacen de Charlotte lo que es.
        </p>
        <p style="color:#444;line-height:1.75;margin:0 0 14px;font-size:14px;">
          City Metro Hub est&#225; recopilando historias locales &mdash; las que hay detr&#225;s del trabajo que la gente hace aqu&#237;, lo que han construido y lo que hace especial a esta comunidad. Su nombre surgi&#243; como alguien que nos encantar&#237;a incluir.
        </p>
        <p style="color:#444;line-height:1.75;margin:0 0 14px;font-size:14px;">
          En lugar de llenar un formulario, simplemente tenemos una breve conversaci&#243;n. Toma unos cinco minutos.
        </p>
        <p style="color:#444;line-height:1.75;margin:0 0 8px;font-size:14px;">
          Le preguntaremos cosas como:
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px;">
          <tr><td style="padding:3px 0 3px 16px;color:#444;font-size:14px;line-height:1.6;">&bull; Qu&#233; lo inspir&#243; a comenzar</td></tr>
          <tr><td style="padding:3px 0 3px 16px;color:#444;font-size:14px;line-height:1.6;">&bull; Qu&#233; hace que lo que hace sea significativo</td></tr>
          <tr><td style="padding:3px 0 3px 16px;color:#444;font-size:14px;line-height:1.6;">&bull; Qu&#233; le encanta de ser parte de la comunidad de Charlotte</td></tr>
        </table>
        <p style="color:#444;line-height:1.75;margin:0 0 14px;font-size:14px;">
          A partir de esa conversaci&#243;n, la convertimos en una breve historia que ayuda a la comunidad a descubrirlo.
        </p>
      </td></tr>
      <tr><td style="padding:8px 24px 8px;text-align:center;">
        <a href="${storyUrl}" style="background:linear-gradient(135deg,#5B1D8F 0%,#7B2FBF 100%);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:10px;font-weight:700;font-size:15px;display:inline-block;">Cuenta Tu Historia</a>
      </td></tr>
      <tr><td style="padding:16px 24px 20px;">
        <p style="color:#444;line-height:1.7;font-size:14px;margin:0 0 14px;">Gracias por ser parte de la comunidad.</p>
        <p style="color:#1a1a2e;font-size:14px;margin:0 0 2px;">&mdash; Charlotte</p>
        <p style="color:#777;font-size:13px;margin:0 0 2px;">Editora de Historias del Vecindario</p>
        <p style="color:#777;font-size:13px;margin:0;">City Metro Hub</p>
      </td></tr>
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:24px 32px;text-align:center;background:#f9f7fc;border-top:1px solid #f0ecf5;">
    <img src="${logoUrl}" alt="City Metro Hub" width="48" height="48" style="display:block;margin:0 auto 8px;opacity:0.7;" />
    <p style="color:#999;font-size:12px;margin:0 0 4px;">City Metro Hub &bull; Charlotte, NC</p>
    <p style="color:#bbb;font-size:11px;margin:0;">Your local community platform &bull; <a href="https://cltcityhub.com" style="color:#7B2FBF;text-decoration:none;">cltcityhub.com</a></p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

router.post("/api/admin/charlotte/send-story-invite", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { email, name, businessName, citySlug } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const recipientName = name || "Friend";
    const bizName = businessName || "your business";
    const slug = citySlug || "charlotte";
    const baseUrl = process.env.APP_PUBLIC_URL || "https://cltcityhub.com";
    const storyUrl = `${baseUrl}/${slug}/tell-your-story`;

    const subject = `We'd Love to Feature Your Story`;
    const html = buildStoryInviteHtml(recipientName, bizName, storyUrl);

    try {
      const { client, fromEmail } = await getResendClient();
      const storyFrom = "Charlotte at City Metro Hub <hello@cltcityhub.com>";
      await client.emails.send({
        from: storyFrom,
        to: [email],
        subject,
        html,
      });
      console.log(`[Charlotte] Story invite sent to ${email}`);
      return res.json({ sent: true, to: email, subject });
    } catch (sendErr: any) {
      console.error("[Charlotte] Story invite send error:", sendErr.message);
      console.log(`[EMAIL-FALLBACK] Story Invite To: ${email}, Subject: ${subject}`);
      console.log(`[EMAIL-FALLBACK] Story URL: ${storyUrl}`);
      return res.json({ sent: false, fallback: true, to: email, storyUrl, message: "Email logged to console (Resend unavailable)" });
    }
  } catch (err: any) {
    console.error("[Charlotte] Story invite error:", err.message);
    return res.status(500).json({ error: "Failed to send story invite" });
  }
});

router.get("/api/admin/charlotte/workforce-snapshot", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const [apCount] = await db.select({ count: sql<number>`count(*)::int` }).from(applicantProfiles);
    const [ahCount] = await db.select({ count: sql<number>`count(*)::int` }).from(businessHiringProfiles).where(eq(businessHiringProfiles.hiringStatus, "ACTIVELY_HIRING"));
    const [jlCount] = await db.select({ count: sql<number>`count(*)::int` }).from(jobListings);
    const [catCount] = await db.select({ count: sql<number>`count(*)::int` }).from(skillCategories);
    const [pcCount] = await db.select({ count: sql<number>`count(*)::int` }).from(applicantCredentials).where(eq(applicantCredentials.verificationStatus, "PENDING"));

    const recentHiring = await db.select({
      businessName: businesses.name,
      hiringStatus: businessHiringProfiles.hiringStatus,
      typicalRoles: businessHiringProfiles.typicalRoles,
    }).from(businessHiringProfiles)
      .innerJoin(businesses, eq(businessHiringProfiles.businessId, businesses.id))
      .where(eq(businessHiringProfiles.hiringStatus, "ACTIVELY_HIRING"))
      .orderBy(desc(businessHiringProfiles.updatedAt))
      .limit(5);

    res.json({
      summary: `Workforce: ${apCount.count} applicant profiles, ${ahCount.count} actively hiring businesses, ${jlCount.count} job listings, ${catCount.count} skill categories, ${pcCount.count} pending credentials.`,
      applicantProfiles: apCount.count,
      activelyHiring: ahCount.count,
      jobListings: jlCount.count,
      skillCategories: catCount.count,
      pendingCredentials: pcCount.count,
      recentHiringBusinesses: recentHiring,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Charlotte] Workforce snapshot error:", message);
    res.status(500).json({ error: "Failed to fetch workforce snapshot" });
  }
});

router.get("/api/admin/charlotte/workforce-skills-distribution", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const topSkills = await db.execute(sql`
      SELECT sc.name as category_name, COUNT(DISTINCT aps.id)::int as applicant_count
      FROM applicant_skills aps
      JOIN skills s ON aps.skill_id = s.id
      JOIN skill_subcategories ss ON s.subcategory_id = ss.id
      JOIN skill_categories sc ON ss.category_id = sc.id
      GROUP BY sc.name
      ORDER BY applicant_count DESC
      LIMIT 15
    `);

    const topSpecificSkills = await db.execute(sql`
      SELECT s.name as skill_name, COUNT(DISTINCT aps.id)::int as count
      FROM applicant_skills aps
      JOIN skills s ON aps.skill_id = s.id
      GROUP BY s.name
      ORDER BY count DESC
      LIMIT 20
    `);

    res.json({
      categoryDistribution: topSkills.rows,
      topSkills: topSpecificSkills.rows,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Charlotte] Workforce skills distribution error:", message);
    res.status(500).json({ error: "Failed to fetch skills distribution" });
  }
});

router.get("/api/admin/charlotte/workforce-hiring-demand", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const hiringByZone = await db.execute(sql`
      SELECT z.name as zone_name, COUNT(jl.id)::int as listing_count
      FROM job_listings jl
      JOIN zones z ON jl.zone_id = z.id
      WHERE jl.status = 'ACTIVE'
      GROUP BY z.name
      ORDER BY listing_count DESC
      LIMIT 10
    `);

    const activeHiringBusinesses = await db.select({
      businessName: businesses.name,
      hiringStatus: businessHiringProfiles.hiringStatus,
      typicalRoles: businessHiringProfiles.typicalRoles,
      industries: businessHiringProfiles.industries,
    }).from(businessHiringProfiles)
      .innerJoin(businesses, eq(businessHiringProfiles.businessId, businesses.id))
      .where(eq(businessHiringProfiles.hiringStatus, "ACTIVELY_HIRING"))
      .orderBy(desc(businessHiringProfiles.updatedAt))
      .limit(10);

    const [applicantAvailability] = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE availability_type = 'FULL_TIME')::int as full_time,
        COUNT(*) FILTER (WHERE availability_type = 'PART_TIME')::int as part_time,
        COUNT(*) FILTER (WHERE availability_type = 'CONTRACT')::int as contract,
        COUNT(*) FILTER (WHERE availability_type = 'SEASONAL')::int as seasonal,
        COUNT(*) FILTER (WHERE availability_type = 'FLEXIBLE')::int as flexible
      FROM applicant_profiles
    `);

    res.json({
      hiringByZone: hiringByZone.rows,
      activeHiringBusinesses,
      applicantAvailability: applicantAvailability || {},
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Charlotte] Workforce hiring demand error:", message);
    res.status(500).json({ error: "Failed to fetch hiring demand data" });
  }
});

router.get("/api/admin/charlotte/proposals", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { listProposals } = await import("./charlotte-proposal-engine");
    const proposals = await listProposals({
      metroId: req.query.metroId as string | undefined,
      status: req.query.status as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
    });
    res.json({ proposals });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Charlotte] List proposals error:", message);
    res.status(500).json({ error: "Failed to list proposals" });
  }
});

router.get("/api/admin/charlotte/proposals/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { getProposal } = await import("./charlotte-proposal-engine");
    const proposal = await getProposal(req.params.id);
    if (!proposal) return res.status(404).json({ error: "Proposal not found" });
    res.json({ proposal });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Charlotte] Get proposal error:", message);
    res.status(500).json({ error: "Failed to get proposal" });
  }
});

router.post("/api/admin/charlotte/proposals/evaluate", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { entityId, entityType, metroId } = req.body;
    if (!entityId || !entityType) return res.status(400).json({ error: "entityId and entityType required" });
    const validTypes = ["business", "contact", "event"];
    if (!validTypes.includes(entityType)) return res.status(400).json({ error: "entityType must be business, contact, or event" });

    const { evaluateOpportunities } = await import("./charlotte-proposal-engine");
    const result = await evaluateOpportunities(entityId, entityType, metroId);
    res.json({ opportunities: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Charlotte] Evaluate opportunities error:", message);
    res.status(500).json({ error: "Failed to evaluate opportunities" });
  }
});

router.post("/api/admin/charlotte/proposals/build", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { entity, templateKeys, metroId, directive } = req.body;
    if (!entity || !entity.entityId || !entity.entityType) {
      return res.status(400).json({ error: "entity with entityId and entityType required" });
    }
    const session = req.session as Record<string, unknown>;

    const { buildProposal } = await import("./charlotte-proposal-engine");
    const proposal = await buildProposal(entity, templateKeys || [], {
      metroId,
      userId: session.userId as string | undefined,
      directive,
      source: "admin_api",
    });
    res.json({ proposal });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Charlotte] Build proposal error:", message);
    res.status(500).json({ error: "Failed to build proposal" });
  }
});

router.post("/api/admin/charlotte/proposals/batch", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { directive, metroId, entityType, filters, templateKeys, limit } = req.body;
    if (!directive || !metroId || !entityType || !templateKeys || !Array.isArray(templateKeys)) {
      return res.status(400).json({ error: "directive, metroId, entityType, and templateKeys[] required" });
    }

    const { buildBatchProposal } = await import("./charlotte-proposal-engine");
    const proposal = await buildBatchProposal({
      directive,
      metroId,
      entityType,
      filters,
      templateKeys,
      limit,
    });
    res.json({ proposal });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Charlotte] Batch proposal error:", message);
    res.status(500).json({ error: "Failed to build batch proposal" });
  }
});

router.post("/api/admin/charlotte/proposals/:id/confirm", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { itemIds, action, confirmAll } = req.body;

    if (confirmAll) {
      const { confirmAllProposalItems } = await import("./charlotte-proposal-engine");
      const result = await confirmAllProposalItems(req.params.id);
      return res.json(result);
    }

    if (!itemIds || !Array.isArray(itemIds) || !action) {
      return res.status(400).json({ error: "itemIds[] and action (confirm|skip) required, or confirmAll: true" });
    }
    if (action !== "confirm" && action !== "skip") {
      return res.status(400).json({ error: "action must be confirm or skip" });
    }

    const { confirmProposalItems } = await import("./charlotte-proposal-engine");
    const result = await confirmProposalItems(req.params.id, itemIds, action);
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Charlotte] Confirm proposal items error:", message);
    res.status(500).json({ error: "Failed to confirm proposal items" });
  }
});

router.post("/api/admin/charlotte/proposals/:id/execute", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { executeProposal } = await import("./charlotte-proposal-engine");
    const result = await executeProposal(req.params.id);
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Charlotte] Execute proposal error:", message);
    res.status(500).json({ error: "Failed to execute proposal" });
  }
});

router.get("/api/admin/charlotte/action-templates", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { getAllActionTemplates } = await import("./charlotte-proposal-engine");
    res.json({ templates: getAllActionTemplates() });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Charlotte] List templates error:", message);
    res.status(500).json({ error: "Failed to list action templates" });
  }
});

router.post("/api/admin/charlotte/search", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { queryRecommendations } = await import("./charlotte-recommendation-connector");
    const { buildRecommendationConstraints } = await import("./charlotte-orchestrator");
    const { metroId, query, category, sortBy, minTrustLevel, onlyClaimed, onlyVerified, geo, limit } = req.body;
    if (!metroId) {
      res.status(400).json({ error: "metroId is required" });
      return;
    }
    const defaultConstraints = buildRecommendationConstraints(
      { mode: "search", intent: query || "", entities: [], targetEngines: [], geoContext: null, confidence: 1, requiresProposal: false, batchMode: false, rawClassification: { intent: "", desiredAction: "", entityReferences: [], mode: "search", confidence: 1, requiresProposal: false, batchMode: false, locationHint: metroId } },
      { steps: [{ engine: "presence-manager", action: "search", params: {}, order: 0 }], fallback: null }
    );
    const results = await queryRecommendations({
      metroId, query, category,
      sortBy: sortBy || defaultConstraints.sortPolicy,
      minTrustLevel: minTrustLevel || (defaultConstraints.enforceTrust && defaultConstraints.minTrustLevel ? defaultConstraints.minTrustLevel : undefined),
      onlyClaimed, onlyVerified, geo, limit,
    });
    res.json({ results, count: results.length, constraints: defaultConstraints });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Charlotte] Search error:", message);
    res.status(500).json({ error: "Search failed" });
  }
});

router.post("/api/admin/charlotte/concierge", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { queryConcierge } = await import("./charlotte-recommendation-connector");
    const { buildRecommendationConstraints } = await import("./charlotte-orchestrator");
    const { metroId, domain, query: searchText, geo, limit } = req.body;
    if (!metroId) {
      res.status(400).json({ error: "metroId is required" });
      return;
    }
    const defaultConstraints = buildRecommendationConstraints(
      { mode: "concierge", intent: searchText || "", entities: [], targetEngines: [], geoContext: null, confidence: 1, requiresProposal: false, batchMode: false, rawClassification: { intent: "", desiredAction: "", entityReferences: [], mode: "concierge", confidence: 1, requiresProposal: false, batchMode: false, locationHint: metroId } },
      { steps: [{ engine: "presence-manager", action: "concierge", params: {}, order: 0 }], fallback: null }
    );
    const result = await queryConcierge(metroId, domain || "general", searchText, geo, limit);
    res.json({ ...result, constraints: defaultConstraints });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Charlotte] Concierge error:", message);
    res.status(500).json({ error: "Concierge query failed" });
  }
});

router.get("/api/admin/charlotte/command-center/:metroId", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { getCommandCenterSummary } = await import("./charlotte-command-center");
    const summary = await getCommandCenterSummary(req.params.metroId);
    res.json(summary);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Charlotte] Command center error:", message);
    res.status(500).json({ error: "Command center query failed" });
  }
});

router.get("/api/admin/charlotte/command-center/:metroId/advertiser-opportunities", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { identifyAdvertiserOpportunities } = await import("./charlotte-command-center");
    const { minProspectFit, minContactReady, limit } = req.query;
    const opportunities = await identifyAdvertiserOpportunities(req.params.metroId, {
      minProspectFit: minProspectFit ? Number(minProspectFit) : undefined,
      minContactReady: minContactReady ? Number(minContactReady) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    res.json({ opportunities, count: opportunities.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Charlotte] Advertiser opportunities error:", message);
    res.status(500).json({ error: "Failed to identify opportunities" });
  }
});

router.get("/api/admin/charlotte/command-center/:metroId/crown-readiness", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { getCrownReadinessReport } = await import("./charlotte-command-center");
    const { minTrustLevel, limit } = req.query;
    const report = await getCrownReadinessReport(req.params.metroId, {
      minTrustLevel: minTrustLevel ? String(minTrustLevel) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    res.json({ report, count: report.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Charlotte] Crown readiness error:", message);
    res.status(500).json({ error: "Failed to get crown readiness report" });
  }
});

router.get("/api/admin/charlotte/command-center/:metroId/zone-activity", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { getZoneActivitySummary } = await import("./charlotte-command-center");
    const summary = await getZoneActivitySummary(req.params.metroId);
    res.json({ zones: summary, count: summary.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Charlotte] Zone activity error:", message);
    res.status(500).json({ error: "Failed to get zone activity" });
  }
});

router.get("/api/admin/charlotte/command-center/:metroId/orchestrator-activity", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { getRecentOrchestratorActivity } = await import("./charlotte-command-center");
    const { limit } = req.query;
    const activity = await getRecentOrchestratorActivity(req.params.metroId, limit ? Number(limit) : undefined);
    res.json({ activity, count: activity.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Charlotte] Orchestrator activity error:", message);
    res.status(500).json({ error: "Failed to get orchestrator activity" });
  }
});

router.get("/api/admin/charlotte/sales-lifecycle/:businessId", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { inferSalesLifecycleStage } = await import("./charlotte-orchestrator");
    const metroId = req.query.metroId ? String(req.query.metroId) : undefined;
    const lifecycle = await inferSalesLifecycleStage(req.params.businessId, metroId);
    if (!lifecycle) {
      res.status(404).json({ error: "Business not found or not in specified metro" });
      return;
    }
    res.json(lifecycle);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Charlotte] Sales lifecycle error:", message);
    res.status(500).json({ error: "Failed to infer lifecycle stage" });
  }
});

router.get("/api/admin/charlotte/ops-center", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { getCommandCenterOperationsOverview } = await import("./charlotte-ops-center");
    const overview = await getCommandCenterOperationsOverview();
    res.json(overview);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Charlotte] Ops center error:", message);
    res.status(500).json({ error: "Operations center query failed" });
  }
});

router.post("/api/admin/charlotte/ops-center/approve", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { approveAction } = await import("./charlotte-ops-center");
    const { actionId } = req.body;
    if (!actionId) { res.status(400).json({ error: "actionId required" }); return; }
    const result = await approveAction(actionId);
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Charlotte] Ops approve error:", message);
    res.status(500).json({ error: "Approve action failed" });
  }
});

router.post("/api/admin/charlotte/ops-center/reject", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { rejectAction } = await import("./charlotte-ops-center");
    const { actionId } = req.body;
    if (!actionId) { res.status(400).json({ error: "actionId required" }); return; }
    const result = await rejectAction(actionId);
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Charlotte] Ops reject error:", message);
    res.status(500).json({ error: "Reject action failed" });
  }
});

router.post("/api/admin/charlotte/ops-center/run-now", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { runActionNow } = await import("./charlotte-ops-center");
    const { actionId } = req.body;
    if (!actionId) { res.status(400).json({ error: "actionId required" }); return; }
    const result = await runActionNow(actionId);
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Charlotte] Ops run-now error:", message);
    res.status(500).json({ error: "Run action failed" });
  }
});

router.post("/api/admin/charlotte/ops-center/send-to-inbox", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { sendToInbox } = await import("./charlotte-ops-center");
    const { itemId, title } = req.body;
    if (!itemId) { res.status(400).json({ error: "itemId required" }); return; }
    const result = await sendToInbox(itemId, title);
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Charlotte] Ops send-to-inbox error:", message);
    res.status(500).json({ error: "Send to inbox failed" });
  }
});

router.get("/api/admin/charlotte/ops-center/capture-queue", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const status = (req.query.status as string) || "pending";
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const { pool: dbPool } = await import("./db");
    const result = await dbPool.query(
      `SELECT * FROM capture_action_queue WHERE status = $1 ORDER BY created_at DESC LIMIT $2`,
      [status, limit]
    );
    res.json({ items: result.rows, count: result.rows.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Charlotte] Capture queue fetch error:", message);
    res.status(500).json({ error: "Failed to fetch capture queue" });
  }
});

router.post("/api/admin/charlotte/ops-center/capture-queue/:id/execute", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { pool: dbPool } = await import("./db");
    const result = await dbPool.query(
      `UPDATE capture_action_queue SET status = 'in_progress' WHERE id = $1 AND status = 'pending' RETURNING *`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: "Queue item not found or already processed" });
      return;
    }
    await dbPool.query(
      `UPDATE capture_action_queue SET status = 'completed', resolved_at = NOW() WHERE id = $1`,
      [req.params.id]
    );
    res.json({ message: "Queue item executed", item: result.rows[0] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Charlotte] Capture queue execute error:", message);
    res.status(500).json({ error: "Failed to execute queue item" });
  }
});

router.post("/api/admin/charlotte/run-integration-tests", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Integration tests are disabled in production" });
  }
  if (!requireAdmin(req, res)) return;
  try {
    const { runCharlotteIntegrationTests } = await import("./tests/charlotte-integration");
    const results = await runCharlotteIntegrationTests();
    return res.json(results);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Charlotte] Integration test error:", message);
    return res.status(500).json({ error: "Integration tests failed to run", details: message });
  }
});

export default router;
