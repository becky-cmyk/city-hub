import { Router, type Request, type Response } from "express";
import { db } from "./db";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";
import {
  outreachTokens, outreachResponses, businesses, crmContacts, cities,
  zones, emailTemplates,
} from "@shared/schema";

import { sendTerritoryEmail } from "./services/territory-email";
import { buildCityBranding } from "@shared/city-branding";
import {
  buildVersionAHtml, buildVersionBHtml,
  SUBJECT_A, SUBJECT_B,
} from "./services/outreach-email-builder";
import { createInboxItemIfNotOpen } from "./admin-inbox";

const router = Router();
const BASE_URL = process.env.APP_PUBLIC_URL || "https://cltcityhub.com";

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function isTokenExpired(record: { expiresAt: Date | null }): boolean {
  return !!record.expiresAt && new Date() > new Date(record.expiresAt);
}

function requireAdminOrOperator(req: Request, res: Response): boolean {
  const session = req.session as Record<string, unknown>;
  if (!session?.userId && !session?.operatorId) {
    res.status(401).json({ error: "Login required" });
    return false;
  }
  return true;
}

const sendOutreachSchema = z.object({
  businessId: z.string().min(1),
  contactId: z.string().optional(),
  variant: z.enum(["A", "B"]).default("A"),
  recipientEmail: z.string().email(),
  recipientName: z.string().min(1),
  businessName: z.string().min(1),
  batchId: z.string().optional(),
});

router.post("/api/outreach/send", async (req: Request, res: Response) => {
  if (!requireAdminOrOperator(req, res)) return;
  try {
    const body = sendOutreachSchema.parse(req.body);
    const token = generateToken();

    const [biz] = await db.select().from(businesses).where(eq(businesses.id, body.businessId)).limit(1);
    if (!biz) return res.status(404).json({ error: "Business not found" });

    const cityId = biz.cityId;
    const [cityRecord] = cityId ? await db.select().from(cities).where(eq(cities.id, cityId)).limit(1) : [null];
    const branding = cityRecord ? buildCityBranding(cityRecord) : { brandShort: "CLT Hub" };
    const citySlug = cityRecord?.slug || "charlotte";

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const [tokenRecord] = await db.insert(outreachTokens).values({
      token,
      businessId: body.businessId,
      contactId: body.contactId || null,
      variant: body.variant,
      campaign: "story_outreach",
      batchId: body.batchId || null,
      cityId,
      sentAt: new Date(),
      expiresAt,
    }).returning();

    const trackingParams = new URLSearchParams({
      campaign: "story_outreach",
      variant: body.variant,
      lead_id: body.businessId,
      ...(body.batchId ? { batch_id: body.batchId } : {}),
    });
    const yesUrl = `${BASE_URL}/outreach/r/${token}?cta=yes&${trackingParams.toString()}`;
    const noUrl = `${BASE_URL}/outreach/r/${token}?cta=no&${trackingParams.toString()}`;

    const firstName = body.recipientName.split(" ")[0] || body.recipientName;
    const params = {
      recipientFirstName: firstName,
      businessName: body.businessName,
      yesUrl,
      noUrl,
      brandShort: branding.brandShort,
    };

    const templateKey = body.variant === "A" ? "story_outreach_a" : "story_outreach_b";
    const [libraryTemplate] = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.templateKey, templateKey))
      .limit(1);

    let subject: string;
    let html: string;
    if (libraryTemplate && libraryTemplate.status === "active") {
      const mergeTags: Record<string, string> = {
        "{{recipientFirstName}}": firstName,
        "{{businessName}}": body.businessName,
        "{{yesUrl}}": yesUrl,
        "{{noUrl}}": noUrl,
        "{{brandShort}}": branding.brandShort,
      };
      const applyMerge = (tpl: string) =>
        Object.entries(mergeTags).reduce((s, [k, v]) => s.split(k).join(v), tpl);
      subject = applyMerge(libraryTemplate.subject);
      html = applyMerge(libraryTemplate.htmlBody);
    } else {
      subject = body.variant === "A" ? SUBJECT_A : SUBJECT_B;
      html = body.variant === "A" ? buildVersionAHtml(params) : buildVersionBHtml(params);
    }

    const emailResult = await sendTerritoryEmail({
      cityId: cityId || undefined,
      to: body.recipientEmail,
      subject,
      html,
      metadata: {
        type: "story_outreach",
        variant: body.variant,
        businessId: body.businessId,
        contactId: body.contactId || undefined,
        tokenId: tokenRecord.id,
      },
    });

    if (emailResult.success) {
      if (body.contactId) {
        await db.update(crmContacts).set({
          outreachStatus: "INVITE_SENT",
          outreachEmailSentAt: new Date(),
          lastContactedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(crmContacts.id, body.contactId));
      }
      await db.update(businesses).set({
        claimStatus: "CLAIM_SENT",
      }).where(eq(businesses.id, body.businessId));
    }

    res.json({
      success: emailResult.success,
      tokenId: tokenRecord.id,
      variant: body.variant,
      error: emailResult.error,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Outreach] Send error:", msg);
    res.status(400).json({ error: msg });
  }
});

router.get("/outreach/r/:token", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const cta = req.query.cta as string;

    const [record] = await db.select().from(outreachTokens).where(eq(outreachTokens.token, token)).limit(1);
    if (!record) return res.redirect(`${BASE_URL}/not-found`);

    if (isTokenExpired(record)) return res.redirect(`${BASE_URL}/not-found`);

    const [biz] = await db.select().from(businesses).where(eq(businesses.id, record.businessId)).limit(1);
    const citySlug = record.cityId
      ? await db.select({ slug: cities.slug }).from(cities).where(eq(cities.id, record.cityId)).limit(1).then(r => r[0]?.slug || "charlotte")
      : "charlotte";

    if (cta === "no") {
      await db.update(outreachTokens).set({
        clickedNo: true,
      }).where(eq(outreachTokens.id, record.id));

      return res.redirect(`${BASE_URL}/${citySlug}/respond/${token}/decline`);
    }

    await db.update(outreachTokens).set({
      clickedYes: true,
      status: "clicked",
    }).where(eq(outreachTokens.id, record.id));

    return res.redirect(`${BASE_URL}/${citySlug}/respond/${token}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Outreach] Redirect error:", msg);
    res.redirect(`${BASE_URL}/not-found`);
  }
});

router.get("/api/respond/:token", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const [record] = await db.select().from(outreachTokens).where(eq(outreachTokens.token, token)).limit(1);
    if (!record || isTokenExpired(record)) return res.status(404).json({ error: "Invalid or expired link" });
    if (record.status === "responded") return res.status(400).json({ error: "Already responded", alreadyResponded: true });

    const [biz] = await db.select().from(businesses).where(eq(businesses.id, record.businessId)).limit(1);
    if (!biz) return res.status(404).json({ error: "Business not found" });

    let contactData: Record<string, unknown> = {};
    if (record.contactId) {
      const [contact] = await db.select().from(crmContacts).where(eq(crmContacts.id, record.contactId)).limit(1);
      if (contact) {
        contactData = {
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          jobTitle: contact.jobTitle,
        };
      }
    }

    res.json({
      businessName: biz.name,
      businessPhone: biz.phone,
      businessAddress: biz.address,
      variant: record.variant,
      contact: contactData,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

const responseFormSchema = z.object({
  name: z.string().min(1),
  businessPhone: z.string().optional(),
  personalPhone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  zip: z.string().optional(),
  bestContactMethod: z.enum(["email", "text", "phone"]).optional(),
  role: z.enum(["owner", "manager", "teammate"]).optional(),
  submitterIsContact: z.boolean().default(true),
  contactPersonName: z.string().optional(),
  contactPersonEmail: z.string().optional(),
  contactPersonPhone: z.string().optional(),
  storyInterest: z.string().optional(),
  consentTerms: z.boolean(),
  consentContact: z.boolean(),
  consentPublish: z.boolean(),
});

router.post("/api/respond/:token", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const [record] = await db.select().from(outreachTokens).where(eq(outreachTokens.token, token)).limit(1);
    if (!record || isTokenExpired(record)) return res.status(404).json({ error: "Invalid or expired link" });
    if (record.status === "responded") return res.status(400).json({ error: "Already responded" });

    const body = responseFormSchema.parse(req.body);
    if (!body.consentTerms || !body.consentContact) {
      return res.status(400).json({ error: "Consent is required" });
    }

    const [response] = await db.insert(outreachResponses).values({
      tokenId: record.id,
      businessId: record.businessId,
      contactId: record.contactId || null,
      name: body.name,
      businessPhone: body.businessPhone || null,
      personalPhone: body.personalPhone || null,
      email: body.email || null,
      zip: body.zip || null,
      bestContactMethod: body.bestContactMethod || null,
      role: body.role || null,
      submitterIsContact: body.submitterIsContact,
      contactPersonName: body.contactPersonName || null,
      contactPersonEmail: body.contactPersonEmail || null,
      contactPersonPhone: body.contactPersonPhone || null,
      storyInterest: body.storyInterest || null,
      consentTerms: body.consentTerms,
      consentContact: body.consentContact,
      consentPublish: body.consentPublish,
    }).returning();

    await db.update(outreachTokens).set({
      status: "responded",
      respondedAt: new Date(),
    }).where(eq(outreachTokens.id, record.id));

    const bizUpdates: Record<string, unknown> = {};
    if (body.businessPhone) bizUpdates.phone = body.businessPhone;
    if (body.zip) {
      bizUpdates.zip = body.zip;
      const [zoneMatch] = await db.select({ id: zones.id })
        .from(zones)
        .where(sql`${body.zip} = ANY(${zones.zipCodes})`)
        .limit(1);
      if (zoneMatch) bizUpdates.zoneId = zoneMatch.id;
    }
    if (Object.keys(bizUpdates).length > 0) {
      await db.update(businesses).set(bizUpdates).where(eq(businesses.id, record.businessId));
    }

    if (record.contactId) {
      const contactUpdates: Record<string, unknown> = {
        updatedAt: new Date(),
        outreachStatus: "RESPONDED",
      };
      if (body.email && body.email !== "") contactUpdates.email = body.email;
      if (body.personalPhone) contactUpdates.phone = body.personalPhone;
      if (body.name) contactUpdates.name = body.name;
      if (body.role) contactUpdates.jobTitle = body.role;
      await db.update(crmContacts).set(contactUpdates).where(eq(crmContacts.id, record.contactId));
    }

    const [biz] = await db.select().from(businesses).where(eq(businesses.id, record.businessId)).limit(1);

    await createInboxItemIfNotOpen({
      itemType: "new_lead",
      relatedTable: "outreach_responses",
      relatedId: response.id,
      title: `Hot Lead: ${biz?.name || body.name} responded to outreach`,
      summary: `${body.name} (${body.role || "unknown role"}) responded to story outreach for ${biz?.name || "Unknown"}. Contact method: ${body.bestContactMethod || "not specified"}.`,
      priority: "high",
      tags: ["Outreach", "Hot Lead", `Variant ${record.variant}`],
      links: [
        { label: "View Business", urlOrRoute: `/admin?section=presence-spine&id=${record.businessId}` },
      ],
    });

    res.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Outreach] Response submit error:", msg);
    res.status(400).json({ error: msg });
  }
});

router.get("/api/respond/:token/decline", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const [record] = await db.select().from(outreachTokens).where(eq(outreachTokens.token, token)).limit(1);
    if (!record || isTokenExpired(record)) return res.status(404).json({ error: "Invalid or expired link" });

    if (record.status !== "declined") {
      await db.update(outreachTokens).set({
        declinedAt: new Date(),
        status: "declined",
      }).where(eq(outreachTokens.id, record.id));

      if (record.contactId) {
        await db.update(crmContacts).set({
          outreachStatus: "DECLINED",
          updatedAt: new Date(),
        }).where(eq(crmContacts.id, record.contactId));
      }

      await db.update(businesses).set({
        claimStatus: "UNCLAIMED",
        presenceStatus: "ARCHIVED",
      }).where(eq(businesses.id, record.businessId));
    }

    const [biz] = await db.select().from(businesses).where(eq(businesses.id, record.businessId)).limit(1);

    res.json({
      declined: true,
      businessName: biz?.name || "your business",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

export default router;
