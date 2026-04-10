import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { getResendClient } from "./resend-client";
import { db } from "./db";
import { subscribers, insertEmailTemplateSchema, insertEmailCampaignSchema } from "@shared/schema";
import { z } from "zod";
import { onEmailBounce, onEmailComplaint } from "./admin-inbox";
import { generateDigestPreview, sendWeeklyDigest, buildDigestContent, buildDigestHtml } from "./digest-scheduler";
import { clearTranslationCache, buildSpanishUrl } from "./email-translate-routes";
import { recordPlatformMessage } from "./message-center-routes";

const createTemplateSchema = insertEmailTemplateSchema.pick({
  templateKey: true,
  classification: true,
  name: true,
  subject: true,
  htmlBody: true,
}).extend({
  preheader: z.string().optional(),
  textBody: z.string().optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  brandId: z.string().optional(),
});

const updateTemplateSchema = createTemplateSchema.partial();

const createCampaignSchema = insertEmailCampaignSchema.pick({
  templateId: true,
  classification: true,
  audienceType: true,
}).extend({
  audienceFilterJson: z.any().optional(),
  selectedContentJson: z.any().optional(),
  subjectOverride: z.string().optional(),
  preheaderOverride: z.string().optional(),
  htmlOverride: z.string().optional(),
  scheduledAt: z.string().optional(),
  status: z.enum(["draft", "scheduled", "sending", "sent", "canceled"]).optional(),
});

export function registerEmailRoutes(app: Express, requireAdmin: any) {
  // ===== EMAIL TEMPLATES =====
  app.get("/api/admin/email-templates", requireAdmin, async (req: Request, res: Response) => {
    try {
      const templates = await storage.getEmailTemplates({
        status: req.query.status as string | undefined,
        templateKey: req.query.templateKey as string | undefined,
      });
      res.json(templates);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/email-templates/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const template = await storage.getEmailTemplateById(id);
      if (!template) return res.status(404).json({ message: "Not found" });
      res.json(template);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/email-templates", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = createTemplateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
      const data = { ...parsed.data, createdByUserId: (req.session as any).userId, updatedByUserId: (req.session as any).userId };
      const template = await storage.createEmailTemplate(data);
      res.json(template);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/admin/email-templates/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const existing = await storage.getEmailTemplateById(id);
      if (!existing) return res.status(404).json({ message: "Not found" });

      const parsed = updateTemplateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
      const data: any = { ...parsed.data, updatedByUserId: (req.session as any).userId };

      const trackFields = ["subject", "htmlBody", "textBody", "preheader", "name"];
      for (const field of trackFields) {
        if (data[field] !== undefined && data[field] !== (existing as any)[field]) {
          await storage.createEmailTemplateRevision({
            templateId: id,
            actorUserId: (req.session as any).userId,
            fieldName: field,
            oldValue: (existing as any)[field] || "",
            newValue: data[field],
          });
        }
      }

      const template = await storage.updateEmailTemplate(id, data);
      if (existing.templateKey) clearTranslationCache(existing.templateKey);
      res.json(template);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/admin/email-templates/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await storage.deleteEmailTemplate(req.params.id as string);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/email-templates/:id/revisions", requireAdmin, async (req: Request, res: Response) => {
    try {
      const revisions = await storage.getEmailTemplateRevisions(req.params.id as string);
      res.json(revisions);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/email-templates/:id/test-send", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { toEmail } = req.body;
      if (!toEmail) return res.status(400).json({ message: "toEmail required" });

      const template = await storage.getEmailTemplateById(req.params.id as string);
      if (!template) return res.status(404).json({ message: "Not found" });

      const { client, fromEmail } = await getResendClient();
      const result = await client.emails.send({
        from: fromEmail,
        to: [toEmail],
        subject: `[TEST] ${template.subject}`,
        html: template.htmlBody,
        text: template.textBody || undefined,
      });

      res.json({ success: true, messageId: (result as any)?.data?.id });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ===== EMAIL CAMPAIGNS =====
  app.get("/api/admin/email-campaigns", requireAdmin, async (req: Request, res: Response) => {
    try {
      const campaigns = await storage.getEmailCampaigns({
        status: req.query.status as string | undefined,
        classification: req.query.classification as string | undefined,
      });
      res.json(campaigns);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/email-campaigns/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const campaign = await storage.getEmailCampaignById(id);
      if (!campaign) return res.status(404).json({ message: "Not found" });
      const stats = await storage.getCampaignRecipientStats(id);
      res.json({ ...campaign, recipientStats: stats });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/email-campaigns", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = createCampaignSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
      const { scheduledAt, ...rest } = parsed.data;
      const data: any = { ...rest, createdByUserId: (req.session as any).userId };
      if (scheduledAt) data.scheduledAt = new Date(scheduledAt);
      const campaign = await storage.createEmailCampaign(data);
      res.json(campaign);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/admin/email-campaigns/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = createCampaignSchema.partial().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
      const { scheduledAt, ...rest } = parsed.data;
      const updateData: any = { ...rest };
      if (scheduledAt !== undefined) updateData.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
      const campaign = await storage.updateEmailCampaign(req.params.id as string, updateData);
      if (!campaign) return res.status(404).json({ message: "Not found" });
      res.json(campaign);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/email-campaigns/:id/recipients", requireAdmin, async (req: Request, res: Response) => {
    try {
      const recipients = await storage.getCampaignRecipients(req.params.id as string);
      res.json(recipients);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/email-campaigns/:id/populate-audience", requireAdmin, async (req: Request, res: Response) => {
    try {
      const campaignId = req.params.id as string;
      const campaign = await storage.getEmailCampaignById(campaignId);
      if (!campaign) return res.status(404).json({ message: "Not found" });

      let emails: { email: string; userId?: string; presenceId?: string; vendorId?: string; mergeData?: any }[] = [];

      if (campaign.audienceType === "subscribers") {
        const subs = await db.select().from(subscribers);
        for (const s of subs) {
          if (s.email) emails.push({ email: s.email, mergeData: { name: (s as any).name || "" } });
        }
      }

      const suppressed = new Set<string>();
      const suppressions = await storage.getEmailSuppressions();
      suppressions.forEach(s => suppressed.add(s.email.toLowerCase()));
      const unsubs = await storage.getEmailUnsubscribes();
      unsubs.forEach(u => suppressed.add(u.email.toLowerCase()));

      const filtered = emails.filter(e => !suppressed.has(e.email.toLowerCase()));

      const recipients = await storage.createCampaignRecipientsBatch(
        filtered.map(e => ({
          campaignId,
          email: e.email,
          userId: e.userId,
          presenceId: e.presenceId,
          vendorId: e.vendorId,
          mergeData: e.mergeData,
        }))
      );

      res.json({ added: recipients.length, suppressed: emails.length - filtered.length });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/email-campaigns/:id/send", requireAdmin, async (req: Request, res: Response) => {
    try {
      const campaignId = req.params.id as string;
      const sessionUserId = (req.session as Record<string, unknown>).userId as string | undefined;
      let campaignCityId: string | undefined;
      if (sessionUserId) {
        const adminUser = await storage.getUserById(sessionUserId);
        if (adminUser?.cityId) campaignCityId = adminUser.cityId;
      }
      const campaign = await storage.getEmailCampaignById(campaignId);
      if (!campaign) return res.status(404).json({ message: "Not found" });
      if (campaign.status === "sent" || campaign.status === "sending") {
        return res.status(400).json({ message: "Campaign already sent or sending" });
      }

      const template = await storage.getEmailTemplateById(campaign.templateId);
      if (!template) return res.status(400).json({ message: "Template not found" });

      const recipients = await storage.getCampaignRecipients(campaignId);
      const queued = recipients.filter(r => r.status === "queued");
      if (queued.length === 0) return res.status(400).json({ message: "No queued recipients" });

      await storage.updateEmailCampaign(campaignId, { status: "sending" } as any);

      const { client, fromEmail } = await getResendClient();
      const subject = campaign.subjectOverride || template.subject;
      const html = campaign.htmlOverride || template.htmlBody;

      let sentCount = 0;
      let failCount = 0;

      for (const recipient of queued) {
        try {
          let personalizedHtml = html;
          let personalizedSubject = subject;
          if (recipient.mergeData && typeof recipient.mergeData === "object") {
            const merge = recipient.mergeData as Record<string, string>;
            for (const [key, value] of Object.entries(merge)) {
              const tag = `{{${key}}}`;
              personalizedHtml = personalizedHtml.replaceAll(tag, value || "");
              personalizedSubject = personalizedSubject.replaceAll(tag, value || "");
            }
          }

          if (personalizedHtml.includes("{{spanishUrl}}")) {
            const bizId = recipient.presenceId || recipient.userId || "";
            const baseUrl = process.env.APP_PUBLIC_URL || `https://${req.get("host")}`;
            if (bizId) {
              const spanishUrlValue = buildSpanishUrl(template.templateKey, bizId, baseUrl);
              personalizedHtml = personalizedHtml.replaceAll("{{spanishUrl}}", spanishUrlValue);
            } else {
              personalizedHtml = personalizedHtml.replaceAll("{{spanishUrl}}", "");
              personalizedHtml = personalizedHtml.replace(/<a[^>]*href=""[^>]*>.*?Ver en Espa[^<]*<\/a>/gi, "");
            }
          }

          const result = await client.emails.send({
            from: fromEmail,
            to: [recipient.email],
            subject: personalizedSubject,
            html: personalizedHtml,
          });

          const messageId = (result as any)?.data?.id;
          await storage.updateCampaignRecipientStatus(recipient.id, "sent", messageId);
          sentCount++;
          try {
            await recordPlatformMessage({
              cityId: campaignCityId,
              sourceEngine: "outreach",
              channel: "email",
              status: "sent",
              recipientAddress: recipient.email,
              subject: personalizedSubject,
              bodyPreview: personalizedHtml.replace(/<[^>]*>/g, "").substring(0, 300),
              campaignId,
              templateId: campaign.templateId,
              sentAt: new Date(),
            });
          } catch {}

        } catch (err: any) {
          await storage.updateCampaignRecipientStatus(recipient.id, "bounced");
          failCount++;
          try {
            await recordPlatformMessage({
              cityId: campaignCityId,
              sourceEngine: "outreach",
              channel: "email",
              status: "failed",
              recipientAddress: recipient.email,
              subject: personalizedSubject,
              bodyPreview: `[FAILED] ${err.message || "Send error"}`,
              campaignId,
              templateId: campaign.templateId,
              sentAt: new Date(),
            });
          } catch {}
        }
      }

      await storage.updateEmailCampaign(campaignId, { status: "sent", sentAt: new Date() } as any);
      res.json({ sent: sentCount, failed: failCount });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ===== AUTO-PULL CMS CONTENT FOR WEEKLY/WEEKEND =====
  app.get("/api/admin/email-auto-pull", requireAdmin, async (req: Request, res: Response) => {
    try {
      const type = req.query.type as string;
      const cityId = req.query.cityId as string;

      const recentArticles = await storage.getArticlesByCityId(cityId || "", {});
      const latestArticles = recentArticles.slice(0, 5);

      const recentEvents = await storage.getEventsByCityId(cityId || "", {
        weekend: type === "weekend" ? true : undefined,
      });
      const liveEvents = recentEvents.slice(0, 8);

      const attractions = await storage.getAttractionsByCityId(cityId || "", {});
      const topAttractions = attractions.slice(0, 3);

      res.json({
        articles: latestArticles.map(a => ({
          id: a.id,
          title: a.title,
          excerpt: a.excerpt,
          slug: a.slug,
          imageUrl: a.imageUrl,
        })),
        events: liveEvents.map(e => ({
          id: e.id,
          title: e.title,
          startDateTime: e.startDateTime,
          slug: e.slug,
          imageUrl: e.imageUrl,
        })),
        attractions: topAttractions.map(a => ({
          id: a.id,
          name: a.name,
          slug: a.slug,
          imageUrl: a.imageUrl,
          attractionType: a.attractionType,
        })),
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ===== SUPPRESSION & UNSUBSCRIBES =====
  app.get("/api/admin/email-suppressions", requireAdmin, async (req: Request, res: Response) => {
    try {
      const suppressions = await storage.getEmailSuppressions();
      res.json(suppressions);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/email-suppressions", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { email, suppressionType, reason } = req.body;
      const suppression = await storage.addEmailSuppression({ email, suppressionType: suppressionType || "manual", reason });
      res.json(suppression);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/admin/email-suppressions/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await storage.removeEmailSuppression(req.params.id as string);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/email-unsubscribes", requireAdmin, async (req: Request, res: Response) => {
    try {
      const unsubs = await storage.getEmailUnsubscribes();
      res.json(unsubs);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/admin/email-unsubscribes/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await storage.removeEmailUnsubscribe(req.params.id as string);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ===== PUBLIC UNSUBSCRIBE ENDPOINT =====
  app.get("/unsubscribe", async (req: Request, res: Response) => {
    try {
      const email = req.query.email as string;
      if (!email) return res.status(400).send("Missing email");
      await storage.addEmailUnsubscribe({ email, source: "email_link" });
      res.send(`
        <html><body style="font-family:sans-serif;text-align:center;padding:40px;">
        <h2>You've been unsubscribed</h2>
        <p>You will no longer receive marketing emails from CLT Metro Hub.</p>
        </body></html>
      `);
    } catch (e: any) {
      res.status(500).send("Error processing unsubscribe");
    }
  });

  // ===== WEEKLY DIGEST =====
  app.get("/api/admin/digest/preview", requireAdmin, async (req: Request, res: Response) => {
    try {
      const citySlug = (req.query.citySlug as string) || "charlotte";
      const city = await storage.getCityBySlug(citySlug);
      if (!city) return res.status(404).json({ message: "City not found" });

      const baseUrl = process.env.APP_PUBLIC_URL || `https://${req.get("host")}`;
      const preview = await generateDigestPreview(city.id, citySlug, baseUrl);
      res.json(preview);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/digest/preview-html", requireAdmin, async (req: Request, res: Response) => {
    try {
      const citySlug = (req.query.citySlug as string) || "charlotte";
      const locale = (req.query.locale as string) === "es" ? "es" : "en";
      const city = await storage.getCityBySlug(citySlug);
      if (!city) return res.status(404).json({ message: "City not found" });

      const baseUrl = process.env.APP_PUBLIC_URL || `https://${req.get("host")}`;
      const content = await buildDigestContent(city.id);
      const html = buildDigestHtml(content, baseUrl, citySlug, locale);
      res.type("text/html").send(html);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/digest/send", requireAdmin, async (req: Request, res: Response) => {
    try {
      const citySlug = (req.body.citySlug as string) || "charlotte";
      const city = await storage.getCityBySlug(citySlug);
      if (!city) return res.status(404).json({ message: "City not found" });

      const baseUrl = process.env.APP_PUBLIC_URL || `https://${req.get("host")}`;
      const result = await sendWeeklyDigest(city.id, citySlug, baseUrl);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/digest/test-send", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { toEmail, locale } = req.body;
      if (!toEmail) return res.status(400).json({ message: "toEmail required" });

      const citySlug = (req.body.citySlug as string) || "charlotte";
      const city = await storage.getCityBySlug(citySlug);
      if (!city) return res.status(404).json({ message: "City not found" });

      const baseUrl = process.env.APP_PUBLIC_URL || `https://${req.get("host")}`;
      const content = await buildDigestContent(city.id);
      const lang = locale === "es" ? "es" : "en";
      const html = buildDigestHtml(content, baseUrl, citySlug, lang)
        .replaceAll("{{email}}", encodeURIComponent(toEmail));
      const subject = lang === "es" ? "Charlotte Esta Semana [TEST]" : "Charlotte This Week [TEST]";

      const { client, fromEmail } = await getResendClient();
      const result = await client.emails.send({
        from: fromEmail,
        to: [toEmail],
        subject,
        html,
      });

      res.json({ success: true, messageId: (result as any)?.data?.id });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/digest/history", requireAdmin, async (req: Request, res: Response) => {
    try {
      const citySlug = (req.query.citySlug as string) || "charlotte";
      const city = await storage.getCityBySlug(citySlug);
      if (!city) return res.status(404).json({ message: "City not found" });

      const digests = await storage.getDigestsByCityId(city.id);
      res.json(digests);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/digest/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const digest = await storage.getDigestById(req.params.id as string);
      if (!digest) return res.status(404).json({ message: "Not found" });
      res.json(digest);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ===== RESEND WEBHOOK =====
  app.post("/api/webhooks/resend", async (req: Request, res: Response) => {
    try {
      const event = req.body;
      const eventType = event.type;
      const data = event.data;

      await storage.createEmailEvent({
        provider: "resend",
        providerMessageId: data?.email_id,
        eventType,
        email: data?.to?.[0] || data?.email,
        payloadJson: event,
      });

      if (eventType === "email.bounced") {
        const email = data?.to?.[0] || data?.email;
        if (email) {
          await storage.addEmailSuppression({ email, suppressionType: "bounce", reason: "Resend bounce webhook" });
          onEmailBounce(email).catch(console.error);
        }
      } else if (eventType === "email.complained") {
        const email = data?.to?.[0] || data?.email;
        if (email) {
          await storage.addEmailSuppression({ email, suppressionType: "complaint", reason: "Resend complaint webhook" });
          onEmailComplaint(email).catch(console.error);
        }
      }

      res.json({ received: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });
}
