import { db } from "../db";
import { crmContacts, articles, cities, businesses } from "@shared/schema";
import { eq } from "drizzle-orm";
import { openai } from "../lib/openai";
import { buildCityBranding } from "@shared/city-branding";
import { storage } from "../storage";
import { buildCaptureStorySystem, buildStoryRevisionSystem } from "../ai/prompts/outreach";
import { sendTemplatedEmail } from "../resend-client";
import { createInboxItemIfNotOpen } from "../admin-inbox";
import crypto from "crypto";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function generateApprovalToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildApprovalEmailHtml(params: {
  contactName: string;
  companyName: string;
  articleTitle: string;
  articleExcerpt: string;
  articleBody: string;
  approvalUrl: string;
  brandShort: string;
}): string {
  const bodyHtml = params.articleBody
    .split(/\n\n|\n/)
    .filter(p => p.trim())
    .map(p => `<p style="margin: 0 0 16px 0; line-height: 1.6; color: #374151;">${escapeHtml(p.trim())}</p>`)
    .join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb;">
  <div style="max-width: 640px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 32px; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 600;">${escapeHtml(params.brandShort)}</h1>
        <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Community Spotlight Preview</p>
      </div>
      <div style="padding: 32px;">
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #1f2937;">Hi ${escapeHtml(params.contactName)},</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #374151; line-height: 1.6;">
          We wrote a community spotlight about <strong>${escapeHtml(params.companyName)}</strong> for our Pulse feed. We'd love for you to take a quick look and let us know if everything looks good before we publish it.
        </p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; margin: 24px 0;">
          <h2 style="margin: 0 0 12px 0; font-size: 20px; color: #1f2937;">${escapeHtml(params.articleTitle)}</h2>
          <p style="margin: 0 0 16px 0; font-size: 14px; color: #6b7280; font-style: italic;">${escapeHtml(params.articleExcerpt)}</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;">
          ${bodyHtml}
        </div>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${params.approvalUrl}" style="display: inline-block; background: #6366f1; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Review & Approve</a>
        </div>
        <p style="margin: 0; font-size: 14px; color: #9ca3af; text-align: center;">
          Click the button above to approve or suggest any corrections before publishing.
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export async function generateStoryForCapture(captureId: string): Promise<{ articleId: string; title: string } | null> {
  const [capture] = await db.select().from(crmContacts).where(eq(crmContacts.id, captureId)).limit(1);
  if (!capture) return null;

  const companyName = capture.company || capture.name;
  const notes = capture.notes || "";
  const jobTitle = capture.jobTitle || "";
  const connectionSource = capture.connectionSource || "";
  const ownerName = capture.name || "";
  const website = capture.website || "";
  const address = capture.address || "";

  if (!companyName || companyName.trim().length === 0) return null;

  let enrichmentData = "";
  if (capture.linkedBusinessId) {
    try {
      const [biz] = await db.select().from(businesses).where(eq(businesses.id, capture.linkedBusinessId)).limit(1);
      if (biz) {
        const parts = [
          biz.description ? `Business description: ${biz.description}` : "",
          biz.websiteUrl ? `Website: ${biz.websiteUrl}` : "",
          biz.address ? `Location: ${[biz.address, biz.city, biz.state, biz.zip].filter(Boolean).join(", ")}` : "",
          biz.phone ? `Phone: ${biz.phone}` : "",
        ].filter(Boolean);
        if (parts.length > 0) enrichmentData = parts.join("\n");
      }
    } catch {}
  }

  const aiExtracted = capture.aiExtracted || {};
  const aiParts = [
    aiExtracted.tagline ? `Tagline: ${aiExtracted.tagline}` : "",
    aiExtracted.services ? `Services: ${aiExtracted.services}` : "",
    aiExtracted.adDescription ? `Ad description: ${aiExtracted.adDescription}` : "",
  ].filter(Boolean).join("\n");

  const cityList = await storage.getAllCities();
  let city = cityList[0];
  if (capture.capturedWithHubId) {
    const hubCity = cityList.find(c => c.id === capture.capturedWithHubId);
    if (hubCity) city = hubCity;
  }
  if (!city) return null;

  const [cityRecord] = await db.select().from(cities).where(eq(cities.id, city.id)).limit(1);
  const branding = cityRecord ? buildCityBranding(cityRecord) : { brandShort: "Metro Hub", aiGuideName: "Charlotte" };

  let title = `Meet ${companyName} — A New Voice in the ${branding.brandShort} Community`;
  let excerpt = `We recently connected with ${companyName} and wanted to share their story with the community.`;
  let body = `${companyName} is making moves in the local scene. Stay tuned for more details about what they bring to our community.`;

  if (openai) {
    try {
      const prompt = [
        `Business/Company: ${companyName}`,
        ownerName && ownerName !== companyName ? `Owner/Contact: ${ownerName}` : "",
        jobTitle ? `Role/Title: ${jobTitle}` : "",
        connectionSource ? `How we connected: ${connectionSource}` : "",
        website ? `Website: ${website}` : "",
        address ? `Address: ${address}` : "",
        notes ? `Notes from meeting: ${notes}` : "",
        enrichmentData ? `\nAdditional business data:\n${enrichmentData}` : "",
        aiParts ? `\nExtracted details:\n${aiParts}` : "",
        capture.audioTranscription ? `Voice notes: ${capture.audioTranscription}` : "",
      ].filter(Boolean).join("\n");

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: buildCaptureStorySystem(branding.aiGuideName, branding.brandShort),
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 2000,
        temperature: 0.7,
      });

      const raw = completion.choices[0]?.message?.content;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.title) title = parsed.title;
        if (parsed.excerpt) excerpt = parsed.excerpt;
        if (parsed.body) body = parsed.body;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[StoryGenerator] OpenAI error:", msg);
    }
  }

  const slug = slugify(title) + "-" + Date.now();
  const approvalToken = generateApprovalToken();

  const article = await storage.createArticle({
    cityId: city.id,
    title,
    slug,
    excerpt,
    content: body,
    imageUrl: null,
    publishedAt: null,
    isFeatured: false,
    isSponsored: false,
    priorityRank: 0,
  });

  await db.update(crmContacts).set({
    linkedArticleId: article.id,
    storyApprovalToken: approvalToken,
    outreachStatus: "STORY_CREATED",
    updatedAt: new Date(),
  }).where(eq(crmContacts.id, captureId));

  console.log(`[StoryGenerator] Draft story created for capture ${captureId}: "${title}" (article ${article.id})`);

  const baseUrl = process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : process.env.REPL_SLUG
      ? `https://${process.env.REPL_SLUG}.replit.app`
      : "http://localhost:5000";

  if (capture.email) {
    const approvalUrl = `${baseUrl}/article-approval/${approvalToken}`;
    try {
      const emailHtml = buildApprovalEmailHtml({
        contactName: ownerName || companyName,
        companyName,
        articleTitle: title,
        articleExcerpt: excerpt,
        articleBody: body,
        approvalUrl,
        brandShort: branding.brandShort,
      });

      const sent = await sendTemplatedEmail(
        capture.email,
        `Your Community Spotlight is Ready for Review — ${branding.brandShort}`,
        emailHtml
      );

      if (sent) {
        await db.update(crmContacts).set({
          outreachStatus: "STORY_SENT",
          outreachEmailSentAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(crmContacts.id, captureId));
        console.log(`[StoryGenerator] Approval email sent to ${capture.email} for capture ${captureId}`);
      } else {
        try {
          await createInboxItemIfNotOpen({
            itemType: "story_review",
            title: `Approval email failed to send: ${companyName}`,
            summary: `Article "${title}" was generated but the approval email to ${capture.email} could not be sent. Review and send manually.`,
            priority: "high",
            relatedId: article.id,
            tags: ["story", "email-failed", "manual-review"],
          });
        } catch {}
        console.warn(`[StoryGenerator] Email send failed for capture ${captureId} — routed to inbox`);
      }
    } catch (emailErr: unknown) {
      const msg = emailErr instanceof Error ? emailErr.message : "Unknown error";
      console.error("[StoryGenerator] Email send error:", msg);
      try {
        await createInboxItemIfNotOpen({
          itemType: "story_review",
          title: `Approval email error: ${companyName}`,
          summary: `Article "${title}" was generated but email sending threw an error: ${msg}. Review and send manually.`,
          priority: "high",
          relatedId: article.id,
          tags: ["story", "email-error", "manual-review"],
        });
      } catch {}
    }
  } else {
    try {
      await createInboxItemIfNotOpen({
        itemType: "story_review",
        title: `Draft story needs manual handling: ${companyName}`,
        summary: `Article "${title}" was auto-generated but the contact has no email address. Review and publish manually or add an email to send for approval.`,
        priority: "medium",
        relatedId: article.id,
        tags: ["story", "no-email", "manual-review"],
      });
    } catch {}
    console.log(`[StoryGenerator] No email for capture ${captureId} — draft routed to inbox`);
  }

  return { articleId: article.id, title };
}

export async function reviseStoryWithCorrections(
  captureId: string,
  correctionNotes: string
): Promise<{ success: boolean; revised: boolean; message: string }> {
  const [capture] = await db.select().from(crmContacts).where(eq(crmContacts.id, captureId)).limit(1);
  if (!capture || !capture.linkedArticleId) {
    return { success: false, revised: false, message: "No linked article found" };
  }

  const [article] = await db.select().from(articles).where(eq(articles.id, capture.linkedArticleId)).limit(1);
  if (!article) {
    return { success: false, revised: false, message: "Article not found" };
  }

  const cityList = await storage.getAllCities();
  let city = cityList[0];
  if (capture.capturedWithHubId) {
    const hubCity = cityList.find(c => c.id === capture.capturedWithHubId);
    if (hubCity) city = hubCity;
  }

  const [cityRecord] = city ? await db.select().from(cities).where(eq(cities.id, city.id)).limit(1) : [null];
  const branding = cityRecord ? buildCityBranding(cityRecord) : { brandShort: "Metro Hub", aiGuideName: "Charlotte" };

  if (!openai) {
    await db.update(crmContacts).set({
      outreachStatus: "CORRECTIONS_REQUESTED",
      storyCorrectionsNotes: correctionNotes,
      storyApprovalToken: null,
      updatedAt: new Date(),
    }).where(eq(crmContacts.id, captureId));

    await createInboxItemIfNotOpen({
      itemType: "story_review",
      title: `Story corrections requested: ${capture.company || capture.name}`,
      summary: `Owner feedback: ${correctionNotes}`,
      priority: "high",
      relatedId: article.id,
      tags: ["story", "corrections", "manual-review"],
    });
    return { success: true, revised: false, message: "Corrections received and routed to admin for review" };
  }

  try {
    const prompt = [
      `Original article title: ${article.title}`,
      `Original article content:\n${article.content}`,
      `\nOwner's requested corrections:\n${correctionNotes}`,
    ].join("\n\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: buildStoryRevisionSystem(branding.aiGuideName, branding.brandShort),
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 2000,
      temperature: 0.5,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      throw new Error("No response from AI");
    }

    const parsed = JSON.parse(raw);

    if (!parsed.revisable) {
      await db.update(crmContacts).set({
        outreachStatus: "CORRECTIONS_REQUESTED",
        storyCorrectionsNotes: correctionNotes,
        storyApprovalToken: null,
        updatedAt: new Date(),
      }).where(eq(crmContacts.id, captureId));

      await createInboxItemIfNotOpen({
        itemType: "story_review",
        title: `Story corrections need manual review: ${capture.company || capture.name}`,
        summary: `Charlotte couldn't apply the corrections automatically. Reason: ${parsed.revisionNotes || "Unreasonable request"}. Owner feedback: ${correctionNotes}`,
        priority: "high",
        relatedId: article.id,
        tags: ["story", "corrections", "manual-review"],
      });

      return { success: true, revised: false, message: "Corrections require manual review — routed to admin" };
    }

    await db.update(articles).set({
      title: parsed.title || article.title,
      excerpt: parsed.excerpt || article.excerpt,
      content: parsed.body || article.content,
      publishedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(articles.id, article.id));

    await db.update(crmContacts).set({
      outreachStatus: "APPROVED",
      storyCorrectionsNotes: correctionNotes,
      storyApprovalToken: null,
      updatedAt: new Date(),
    }).where(eq(crmContacts.id, captureId));

    console.log(`[StoryGenerator] Revised and published article for capture ${captureId}: ${parsed.revisionNotes || "corrections applied"}`);
    return { success: true, revised: true, message: "Article revised and published" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[StoryGenerator] Revision error:", msg);

    await db.update(crmContacts).set({
      outreachStatus: "CORRECTIONS_REQUESTED",
      storyCorrectionsNotes: correctionNotes,
      storyApprovalToken: null,
      updatedAt: new Date(),
    }).where(eq(crmContacts.id, captureId));

    await createInboxItemIfNotOpen({
      itemType: "story_review",
      title: `Story revision failed: ${capture.company || capture.name}`,
      summary: `AI revision failed: ${msg}. Owner feedback: ${correctionNotes}`,
      priority: "high",
      relatedId: article.id,
      tags: ["story", "corrections", "error"],
    });

    return { success: true, revised: false, message: "Corrections received — we'll review and update your article shortly" };
  }
}
