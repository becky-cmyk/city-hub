import type { Express, Request, Response, NextFunction } from "express";
import { db } from "./db";
import { presenceOwnerAccounts, businesses, zones, businessFaqs, businessExpertQa, shopItems, MICROSITE_TIER_CONFIG, DEFAULT_MICROSITE_BLOCKS, MICROSITE_TEMPLATES, MICROSITE_BLOCK_TYPES, type MicrositeBlock, type MicrositeBlockType, type MicrositeTemplate } from "@shared/schema";
import { eq, and, asc, desc } from "drizzle-orm";
import { pool } from "./db";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { openai } from "./lib/openai";
import { MICROSITE_CONTENT_WRITER_SYSTEM, MICROSITE_BLOCK_REGEN_SYSTEM } from "./ai/prompts/platform-services";
import { queueTranslation } from "./services/auto-translate";

type TierKey = keyof typeof MICROSITE_TIER_CONFIG;

function getTierConfig(tier: string) {
  const key = (tier || "VERIFIED") as TierKey;
  return MICROSITE_TIER_CONFIG[key] || MICROSITE_TIER_CONFIG.VERIFIED;
}

async function requireOwner(req: Request, res: Response, next: NextFunction) {
  if ((req.session as any).ownerAccountId) {
    return next();
  }
  const { isAdminSession: isAdminReq } = await import("./admin-check");
  if (await isAdminReq(req)) return next();
  return res.status(401).json({ message: "Unauthorized" });
}

export function registerOwnerRoutes(app: Express) {
  app.post("/api/owner/register", async (req: Request, res: Response) => {
    try {
      const { email, password, entityId, displayName } = req.body;

      if (!email || !password || !entityId) {
        return res.status(400).json({ message: "Email, password, and entity ID are required" });
      }

      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }

      const [biz] = await db.select().from(businesses).where(eq(businesses.id, entityId)).limit(1);
      if (!biz) {
        return res.status(404).json({ message: "Entity not found" });
      }

      if (!biz.emailVerifiedAt) {
        return res.status(403).json({ message: "Email must be verified through the Activate flow before creating an owner account" });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const bizEmail = (biz.ownerEmail || "").toLowerCase().trim();
      if (normalizedEmail !== bizEmail) {
        return res.status(403).json({ message: "Email must match the verified email used during activation" });
      }

      const [existing] = await db.select().from(presenceOwnerAccounts).where(eq(presenceOwnerAccounts.email, normalizedEmail)).limit(1);
      if (existing) {
        return res.status(409).json({ message: "An account with this email already exists. Please sign in instead." });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const [account] = await db.insert(presenceOwnerAccounts).values({
        email: normalizedEmail,
        passwordHash,
        entityId,
        displayName: displayName || biz.name || "",
      }).returning();

      (req.session as any).ownerAccountId = account.id;
      (req.session as any).ownerEntityId = account.entityId;

      res.json({
        id: account.id,
        email: account.email,
        entityId: account.entityId,
        displayName: account.displayName,
      });
    } catch (err: any) {
      console.error("Owner register error:", err);
      if (err.code === "23505") {
        return res.status(409).json({ message: "An account with this email already exists" });
      }
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/owner/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const [account] = await db.select().from(presenceOwnerAccounts).where(eq(presenceOwnerAccounts.email, normalizedEmail)).limit(1);

      if (!account) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const valid = await bcrypt.compare(password, account.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      await db.update(presenceOwnerAccounts).set({
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(presenceOwnerAccounts.id, account.id));

      (req.session as any).ownerAccountId = account.id;
      (req.session as any).ownerEntityId = account.entityId;

      res.json({
        id: account.id,
        email: account.email,
        entityId: account.entityId,
        displayName: account.displayName,
      });
    } catch (err: any) {
      console.error("Owner login error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/owner/logout", (req: Request, res: Response) => {
    delete (req.session as any).ownerAccountId;
    delete (req.session as any).ownerEntityId;
    res.json({ ok: true });
  });

  app.get("/api/owner/me", requireOwner, async (req: Request, res: Response) => {
    try {
      const accountId = (req.session as any).ownerAccountId;
      const [account] = await db.select().from(presenceOwnerAccounts).where(eq(presenceOwnerAccounts.id, accountId)).limit(1);

      if (!account) {
        delete (req.session as any).ownerAccountId;
        return res.status(401).json({ message: "Account not found" });
      }

      const [biz] = await db.select().from(businesses).where(eq(businesses.id, account.entityId)).limit(1);

      let zoneName = "";
      if (biz?.zoneId) {
        const [zone] = await db.select().from(zones).where(eq(zones.id, biz.zoneId)).limit(1);
        zoneName = zone?.name || "";
      }

      res.json({
        account: {
          id: account.id,
          email: account.email,
          personalEmail: account.personalEmail,
          displayName: account.displayName,
          activeProfile: account.activeProfile || "business",
          createdAt: account.createdAt,
        },
        presence: biz ? {
          id: biz.id,
          name: biz.name,
          phone: biz.phone,
          address: biz.address,
          description: biz.description,
          websiteUrl: biz.websiteUrl,
          listingTier: biz.listingTier,
          isVerified: biz.isVerified,
          presenceStatus2: biz.presenceStatus2,
          presenceType: biz.presenceType,
          zoneId: biz.zoneId,
          zoneName,
          ownerEmail: biz.ownerEmail,
          slug: biz.slug,
          imageUrl: biz.imageUrl,
          micrositeTagline: biz.micrositeTagline,
        } : null,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/owner/presence", requireOwner, async (req: Request, res: Response) => {
    try {
      const entityId = (req.session as any).ownerEntityId;
      const { phone, description, websiteUrl, micrositeTagline, nearestTransitStopId,
              categoryIds, galleryImages, languagesSpoken, licensesAndCerts, awardsAndHonors,
              micrositeLogo, micrositeFont } = req.body;

      const [biz] = await db.select().from(businesses).where(eq(businesses.id, entityId)).limit(1);
      if (!biz) return res.status(404).json({ message: "Presence not found" });

      const config = getTierConfig(biz.listingTier);

      if (categoryIds && Array.isArray(categoryIds) && categoryIds.length > config.maxL2) {
        return res.status(400).json({ message: `Your ${config.displayName} tier allows up to ${config.maxL2} categories. Upgrade for more.` });
      }
      if (galleryImages && Array.isArray(galleryImages) && galleryImages.length > config.maxGalleryPhotos) {
        return res.status(400).json({ message: `Your ${config.displayName} tier allows up to ${config.maxGalleryPhotos} gallery photos. Upgrade for more.` });
      }

      const updates: Record<string, any> = {};
      if (phone !== undefined) updates.phone = phone;
      if (description !== undefined) updates.description = description;
      if (websiteUrl !== undefined) updates.websiteUrl = websiteUrl;
      if (micrositeTagline !== undefined) updates.micrositeTagline = micrositeTagline;
      if (nearestTransitStopId !== undefined) updates.nearestTransitStopId = nearestTransitStopId || null;
      if (categoryIds !== undefined) updates.categoryIds = categoryIds;
      if (galleryImages !== undefined) updates.galleryImages = galleryImages;
      if (languagesSpoken !== undefined) updates.languagesSpoken = languagesSpoken;
      if (licensesAndCerts !== undefined) updates.licensesAndCerts = licensesAndCerts;
      if (awardsAndHonors !== undefined) updates.awardsAndHonors = awardsAndHonors;
      if (biz.listingTier === "ENHANCED" || biz.listingTier === "ENTERPRISE") {
        if (micrositeLogo !== undefined) updates.micrositeLogo = micrositeLogo || null;
        if (micrositeFont !== undefined) updates.micrositeFont = micrositeFont || null;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No fields to update" });
      }

      const [updated] = await db.update(businesses).set(updates).where(eq(businesses.id, entityId)).returning();

      if (description !== undefined) {
        queueTranslation("business", entityId);
      }

      res.json({ id: updated.id, name: updated.name });
    } catch (err: any) {
      console.error("Owner presence update error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/owner/account", requireOwner, async (req: Request, res: Response) => {
    try {
      const accountId = (req.session as any).ownerAccountId;
      const { personalEmail, displayName, activeProfile } = req.body;

      const updates: Record<string, any> = { updatedAt: new Date() };
      if (personalEmail !== undefined) updates.personalEmail = personalEmail || null;
      if (displayName !== undefined) updates.displayName = displayName;
      if (activeProfile !== undefined && (activeProfile === "business" || activeProfile === "personal")) {
        updates.activeProfile = activeProfile;
      }

      const [updated] = await db.update(presenceOwnerAccounts).set(updates).where(eq(presenceOwnerAccounts.id, accountId)).returning();

      res.json({
        id: updated.id,
        email: updated.email,
        personalEmail: updated.personalEmail,
        displayName: updated.displayName,
        activeProfile: updated.activeProfile,
      });
    } catch (err: any) {
      console.error("Owner account update error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/owner/check-email/:email", async (req: Request, res: Response) => {
    try {
      const normalizedEmail = (req.params.email as string).toLowerCase().trim();
      const [existing] = await db.select({ id: presenceOwnerAccounts.id }).from(presenceOwnerAccounts).where(eq(presenceOwnerAccounts.email, normalizedEmail)).limit(1);
      res.json({ exists: !!existing });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/owner/presence/faqs", requireOwner, async (req: Request, res: Response) => {
    try {
      const entityId = (req.session as any).ownerEntityId;
      const items = await db.select().from(businessFaqs).where(eq(businessFaqs.businessId, entityId)).orderBy(asc(businessFaqs.sortOrder));
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/owner/presence/faqs", requireOwner, async (req: Request, res: Response) => {
    try {
      const entityId = (req.session as any).ownerEntityId;
      const [biz] = await db.select().from(businesses).where(eq(businesses.id, entityId)).limit(1);
      if (!biz) return res.status(404).json({ message: "Presence not found" });

      const config = getTierConfig(biz.listingTier);
      if (!config.canFaq) {
        return res.status(403).json({ message: "FAQ is available on Charter and Enhanced tiers. Upgrade to add FAQs." });
      }

      const existing = await db.select().from(businessFaqs).where(eq(businessFaqs.businessId, entityId));
      if (existing.length >= config.maxFaqItems) {
        return res.status(400).json({ message: `Your ${config.displayName} tier allows up to ${config.maxFaqItems} FAQs.` });
      }

      const { question, answer, sortOrder } = req.body;
      if (!question || !answer) return res.status(400).json({ message: "Question and answer are required" });

      const [created] = await db.insert(businessFaqs).values({
        businessId: entityId,
        question,
        answer,
        sortOrder: sortOrder ?? existing.length,
      }).returning();
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/owner/presence/faqs/:id", requireOwner, async (req: Request, res: Response) => {
    try {
      const entityId = (req.session as any).ownerEntityId;
      const { question, answer, sortOrder } = req.body;
      const updates: Record<string, any> = {};
      if (question !== undefined) updates.question = question;
      if (answer !== undefined) updates.answer = answer;
      if (sortOrder !== undefined) updates.sortOrder = sortOrder;

      const [updated] = await db.update(businessFaqs).set(updates)
        .where(and(eq(businessFaqs.id, req.params.id), eq(businessFaqs.businessId, entityId)))
        .returning();
      if (!updated) return res.status(404).json({ message: "FAQ not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/owner/presence/faqs/:id", requireOwner, async (req: Request, res: Response) => {
    try {
      const entityId = (req.session as any).ownerEntityId;
      const [deleted] = await db.delete(businessFaqs)
        .where(and(eq(businessFaqs.id, req.params.id), eq(businessFaqs.businessId, entityId)))
        .returning();
      if (!deleted) return res.status(404).json({ message: "FAQ not found" });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/owner/presence/qa", requireOwner, async (req: Request, res: Response) => {
    try {
      const entityId = (req.session as any).ownerEntityId;
      const items = await db.select().from(businessExpertQa).where(eq(businessExpertQa.businessId, entityId)).orderBy(asc(businessExpertQa.sortOrder));
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/owner/presence/qa", requireOwner, async (req: Request, res: Response) => {
    try {
      const entityId = (req.session as any).ownerEntityId;
      const [biz] = await db.select().from(businesses).where(eq(businesses.id, entityId)).limit(1);
      if (!biz) return res.status(404).json({ message: "Presence not found" });

      const config = getTierConfig(biz.listingTier);
      if (!config.canExpertQa) {
        return res.status(403).json({ message: "Expert Q&A is available on Enhanced tier only. Upgrade to enable." });
      }

      const existing = await db.select().from(businessExpertQa).where(eq(businessExpertQa.businessId, entityId));
      if (existing.length >= config.maxExpertQaItems) {
        return res.status(400).json({ message: `Your ${config.displayName} tier allows up to ${config.maxExpertQaItems} Q&A items.` });
      }

      const { question, answer, askedByName, sortOrder } = req.body;
      if (!question) return res.status(400).json({ message: "Question is required" });

      const [created] = await db.insert(businessExpertQa).values({
        businessId: entityId,
        question,
        answer: answer || null,
        askedByName: askedByName || null,
        answeredAt: answer ? new Date() : null,
        isPublished: false,
        sortOrder: sortOrder ?? existing.length,
      }).returning();
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/owner/presence/qa/:id", requireOwner, async (req: Request, res: Response) => {
    try {
      const entityId = (req.session as any).ownerEntityId;
      const { question, answer, isPublished, sortOrder } = req.body;
      const updates: Record<string, any> = {};
      if (question !== undefined) updates.question = question;
      if (answer !== undefined) {
        updates.answer = answer;
        updates.answeredAt = new Date();
      }
      if (isPublished !== undefined) updates.isPublished = isPublished;
      if (sortOrder !== undefined) updates.sortOrder = sortOrder;

      const [updated] = await db.update(businessExpertQa).set(updates)
        .where(and(eq(businessExpertQa.id, req.params.id), eq(businessExpertQa.businessId, entityId)))
        .returning();
      if (!updated) return res.status(404).json({ message: "Q&A item not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/owner/presence/qa/:id", requireOwner, async (req: Request, res: Response) => {
    try {
      const entityId = (req.session as any).ownerEntityId;
      const [deleted] = await db.delete(businessExpertQa)
        .where(and(eq(businessExpertQa.id, req.params.id), eq(businessExpertQa.businessId, entityId)))
        .returning();
      if (!deleted) return res.status(404).json({ message: "Q&A item not found" });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  const micrositeBlockSchema = z.object({
    id: z.string(),
    type: z.enum(MICROSITE_BLOCK_TYPES as unknown as [string, ...string[]]),
    enabled: z.boolean(),
    sortOrder: z.number(),
    content: z.record(z.any()),
  });

  const micrositeBlocksPayloadSchema = z.object({
    blocks: z.array(micrositeBlockSchema),
  });

  const micrositeTemplatePayloadSchema = z.object({
    template: z.enum(MICROSITE_TEMPLATES as unknown as [string, ...string[]]),
  });

  const generateSitePayloadSchema = z.object({
    prompt: z.string().optional(),
    auto: z.boolean().optional(),
  });

  const regenerateBlockPayloadSchema = z.object({
    blockId: z.string(),
    prompt: z.string().optional(),
  });

  async function verifyOwnerPresence(req: Request, res: Response): Promise<{ biz: any; config: any } | null> {
    const entityId = (req.session as any).ownerEntityId;
    const presenceId = req.params.id;
    const { isAdminSession: isAdminReq } = await import("./admin-check");
    const adminBypass = await isAdminReq(req);
    if (!adminBypass && entityId !== presenceId) {
      res.status(403).json({ message: "You can only manage your own presence" });
      return null;
    }
    const [biz] = await db.select().from(businesses).where(eq(businesses.id, presenceId)).limit(1);
    if (!biz) {
      res.status(404).json({ message: "Presence not found" });
      return null;
    }
    const config = getTierConfig(biz.listingTier);
    return { biz, config };
  }

  app.get("/api/owner/presence/:id/blocks", requireOwner, async (req: Request, res: Response) => {
    try {
      const result = await verifyOwnerPresence(req, res);
      if (!result) return;
      const { biz, config } = result;

      if (!config.hasMicrosite) {
        return res.status(403).json({ message: "Microsite features require Charter or Enhanced tier." });
      }

      let blocks: MicrositeBlock[] = biz.micrositeBlocks as MicrositeBlock[] || null;
      if (!blocks || blocks.length === 0) {
        blocks = JSON.parse(JSON.stringify(DEFAULT_MICROSITE_BLOCKS));
        if (biz.name) {
          const heroBlock = blocks.find(b => b.type === "hero");
          if (heroBlock) {
            heroBlock.content.headline = { en: biz.name, es: biz.name };
            if (biz.micrositeTagline) {
              heroBlock.content.subheadline = { en: biz.micrositeTagline, es: biz.micrositeTagline };
            }
            if (biz.imageUrl) {
              heroBlock.content.backgroundImage = biz.imageUrl;
            }
          }
          const aboutBlock = blocks.find(b => b.type === "about");
          if (aboutBlock && biz.description) {
            aboutBlock.content.body = { en: biz.description, es: "" };
          }
        }
      }

      res.json({
        template: biz.micrositeTemplate || "modern",
        blocks,
      });
    } catch (err: any) {
      console.error("Get blocks error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/owner/presence/:id/blocks", requireOwner, async (req: Request, res: Response) => {
    try {
      const result = await verifyOwnerPresence(req, res);
      if (!result) return;
      const { biz, config } = result;

      if (!config.hasMicrosite) {
        return res.status(403).json({ message: "Microsite features require Charter or Enhanced tier." });
      }

      const parsed = micrositeBlocksPayloadSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid block data", errors: parsed.error.flatten() });
      }

      const [updated] = await db.update(businesses).set({
        micrositeBlocks: parsed.data.blocks as MicrositeBlock[],
        micrositeEnabled: true,
        updatedAt: new Date(),
      }).where(eq(businesses.id, biz.id)).returning();

      res.json({ id: updated.id, blocks: updated.micrositeBlocks });
    } catch (err: any) {
      console.error("Save blocks error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/owner/presence/:id/template", requireOwner, async (req: Request, res: Response) => {
    try {
      const result = await verifyOwnerPresence(req, res);
      if (!result) return;
      const { biz, config } = result;

      if (!config.hasMicrosite) {
        return res.status(403).json({ message: "Microsite features require Charter or Enhanced tier." });
      }

      if (biz.listingTier !== "ENHANCED" && biz.listingTier !== "ENTERPRISE") {
        return res.status(403).json({ message: "Template switching requires Enhanced tier or above." });
      }

      const parsed = micrositeTemplatePayloadSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid template", errors: parsed.error.flatten() });
      }

      const [updated] = await db.update(businesses).set({
        micrositeTemplate: parsed.data.template,
        updatedAt: new Date(),
      }).where(eq(businesses.id, biz.id)).returning();

      res.json({ id: updated.id, template: updated.micrositeTemplate });
    } catch (err: any) {
      console.error("Change template error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  function buildSiteGenerationPrompt(biz: any, userPrompt?: string): string {
    const bizContext = [
      `Business name: ${biz.name}`,
      biz.description ? `Description: ${biz.description}` : null,
      biz.micrositeTagline ? `Tagline: ${biz.micrositeTagline}` : null,
      biz.address ? `Address: ${biz.address}, ${biz.city || ""}, ${biz.state || ""}` : null,
      biz.phone ? `Phone: ${biz.phone}` : null,
      biz.websiteUrl ? `Website: ${biz.websiteUrl}` : null,
      biz.hoursOfOperation ? `Hours: ${JSON.stringify(biz.hoursOfOperation)}` : null,
      biz.presenceType === "organization" ? "This is a nonprofit/community organization" : null,
      biz.missionStatement ? `Mission: ${biz.missionStatement}` : null,
    ].filter(Boolean).join("\n");

    const customPrompt = userPrompt ? `\n\nAdditional context from the owner: "${userPrompt}"` : "";

    return `Generate website content for a business microsite. Use the following business information to create compelling, professional content for each section block.

BUSINESS INFO:
${bizContext}
${customPrompt}

Generate content for ALL of the following block types. For each block, provide content that is specific to this business. Be professional, engaging, and authentic — never use superlatives like "best" or "#1". Write in a warm, inviting tone.

Return a JSON object with this exact structure (no markdown fences):
{
  "template": "modern",
  "blocks": [
    {
      "id": "hero-1",
      "type": "hero",
      "enabled": true,
      "sortOrder": 0,
      "content": {
        "headline": {"en": "...", "es": "..."},
        "subheadline": {"en": "...", "es": "..."},
        "ctaText": {"en": "Get in Touch", "es": "Contáctenos"},
        "ctaLink": "#contact"
      }
    },
    {
      "id": "about-1",
      "type": "about",
      "enabled": true,
      "sortOrder": 1,
      "content": {
        "headline": {"en": "About Us", "es": "Sobre Nosotros"},
        "body": {"en": "2-3 paragraphs about the business...", "es": "Spanish translation..."}
      }
    },
    {
      "id": "services-1",
      "type": "services",
      "enabled": true,
      "sortOrder": 2,
      "content": {
        "headline": {"en": "Our Services", "es": "Nuestros Servicios"},
        "items": [
          {"title": {"en": "...", "es": "..."}, "description": {"en": "...", "es": "..."}}
        ]
      }
    },
    {
      "id": "testimonials-1",
      "type": "testimonials",
      "enabled": true,
      "sortOrder": 3,
      "content": {
        "headline": {"en": "What People Say", "es": "Lo Que Dicen"},
        "items": [
          {"quote": {"en": "...", "es": "..."}, "author": "Name", "role": "Customer"}
        ]
      }
    },
    {
      "id": "faq-1",
      "type": "faq",
      "enabled": true,
      "sortOrder": 4,
      "content": {
        "headline": {"en": "Frequently Asked Questions", "es": "Preguntas Frecuentes"},
        "items": [
          {"question": {"en": "...", "es": "..."}, "answer": {"en": "...", "es": "..."}}
        ]
      }
    },
    {
      "id": "hours-1",
      "type": "hours",
      "enabled": true,
      "sortOrder": 5,
      "content": {
        "headline": {"en": "Hours & Location", "es": "Horario y Ubicación"}
      }
    },
    {
      "id": "cta-1",
      "type": "cta",
      "enabled": true,
      "sortOrder": 6,
      "content": {
        "headline": {"en": "Ready to connect?", "es": "¿Listo para conectarse?"},
        "subheadline": {"en": "...", "es": "..."},
        "ctaText": {"en": "Contact Us", "es": "Contáctenos"},
        "ctaLink": "#contact"
      }
    },
    {
      "id": "contact-1",
      "type": "contact",
      "enabled": true,
      "sortOrder": 7,
      "content": {
        "headline": {"en": "Contact Us", "es": "Contáctenos"}
      }
    },
    {
      "id": "gallery-1",
      "type": "gallery",
      "enabled": false,
      "sortOrder": 8,
      "content": {
        "headline": {"en": "Gallery", "es": "Galería"},
        "items": []
      }
    },
    {
      "id": "events-1",
      "type": "events",
      "enabled": false,
      "sortOrder": 9,
      "content": {
        "headline": {"en": "Upcoming Events", "es": "Próximos Eventos"}
      }
    },
    {
      "id": "reviews-1",
      "type": "reviews",
      "enabled": true,
      "sortOrder": 10,
      "content": {
        "headline": {"en": "Reviews", "es": "Reseñas"}
      }
    },
    {
      "id": "team-1",
      "type": "team",
      "enabled": false,
      "sortOrder": 11,
      "content": {
        "headline": {"en": "Meet Our Team", "es": "Conozca Nuestro Equipo"},
        "items": []
      }
    }
  ]
}

Generate 3-5 relevant services, 2-3 sample testimonials, and 3-5 FAQ items appropriate for this type of business. Make all content relevant and specific to "${biz.name}". Include Spanish translations for all bilingual text fields.`;
  }

  function buildBlockRegenerationPrompt(biz: any, block: MicrositeBlock, userPrompt?: string): string {
    const bizContext = [
      `Business name: ${biz.name}`,
      biz.description ? `Description: ${biz.description}` : null,
      biz.micrositeTagline ? `Tagline: ${biz.micrositeTagline}` : null,
    ].filter(Boolean).join("\n");

    const customPrompt = userPrompt ? `\nAdditional instructions: "${userPrompt}"` : "";

    return `Regenerate the content for a "${block.type}" block on a business microsite.

BUSINESS INFO:
${bizContext}
${customPrompt}

Current block content:
${JSON.stringify(block.content, null, 2)}

Generate improved, fresh content for this "${block.type}" block. Keep the same structure but write new, compelling copy. Include bilingual en/es text where applicable.

Return ONLY a JSON object with the new "content" field (no markdown fences):
${block.type === "services" ? '{"headline": {"en": "...", "es": "..."}, "items": [{"title": {"en": "...", "es": "..."}, "description": {"en": "...", "es": "..."}}]}' : ''}
${block.type === "faq" ? '{"headline": {"en": "...", "es": "..."}, "items": [{"question": {"en": "...", "es": "..."}, "answer": {"en": "...", "es": "..."}}]}' : ''}
${block.type === "testimonials" ? '{"headline": {"en": "...", "es": "..."}, "items": [{"quote": {"en": "...", "es": "..."}, "author": "Name", "role": "Customer"}]}' : ''}
${block.type === "hero" ? '{"headline": {"en": "...", "es": "..."}, "subheadline": {"en": "...", "es": "..."}, "ctaText": {"en": "...", "es": "..."}, "ctaLink": "#contact"}' : ''}
${block.type === "about" ? '{"headline": {"en": "...", "es": "..."}, "body": {"en": "...", "es": "..."}}' : ''}
${block.type === "cta" ? '{"headline": {"en": "...", "es": "..."}, "subheadline": {"en": "...", "es": "..."}, "ctaText": {"en": "...", "es": "..."}, "ctaLink": "#contact"}' : ''}
${!["services", "faq", "testimonials", "hero", "about", "cta"].includes(block.type) ? '{"headline": {"en": "...", "es": "..."}}' : ''}`;
  }

  app.post("/api/owner/presence/:id/generate-site", requireOwner, async (req: Request, res: Response) => {
    try {
      const result = await verifyOwnerPresence(req, res);
      if (!result) return;
      const { biz, config } = result;

      if (!config.hasMicrosite) {
        return res.status(403).json({ message: "AI site generation requires Charter or Enhanced tier." });
      }

      const parsed = generateSitePayloadSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request", errors: parsed.error.flatten() });
      }

      if (!openai) return res.status(503).json({ message: "OpenAI not configured" });
      const prompt = buildSiteGenerationPrompt(biz, parsed.data.prompt);

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: MICROSITE_CONTENT_WRITER_SYSTEM,
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 4096,
        temperature: 0.7,
      });

      const text = response.choices[0]?.message?.content || "{}";
      let generated: any;
      try {
        generated = JSON.parse(text);
      } catch {
        return res.status(500).json({ message: "AI returned invalid JSON. Please try again." });
      }

      if (!generated.blocks || !Array.isArray(generated.blocks)) {
        return res.status(500).json({ message: "AI response missing blocks array. Please try again." });
      }

      const blocks = generated.blocks as MicrositeBlock[];
      const template = generated.template || "modern";

      const [updated] = await db.update(businesses).set({
        micrositeBlocks: blocks,
        micrositeTemplate: template,
        micrositeEnabled: true,
        updatedAt: new Date(),
      }).where(eq(businesses.id, biz.id)).returning();

      res.json({
        template,
        blocks,
        generatedAt: new Date().toISOString(),
        aiPrompt: parsed.data.prompt || "auto",
      });
    } catch (err: any) {
      console.error("Generate site error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/owner/presence/:id/regenerate-block", requireOwner, async (req: Request, res: Response) => {
    try {
      const result = await verifyOwnerPresence(req, res);
      if (!result) return;
      const { biz, config } = result;

      if (!config.hasMicrosite) {
        return res.status(403).json({ message: "AI block regeneration requires Charter or Enhanced tier." });
      }

      const parsed = regenerateBlockPayloadSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request", errors: parsed.error.flatten() });
      }

      const currentBlocks: MicrositeBlock[] = (biz.micrositeBlocks as MicrositeBlock[]) || [];
      const targetBlock = currentBlocks.find(b => b.id === parsed.data.blockId);
      if (!targetBlock) {
        return res.status(404).json({ message: "Block not found" });
      }

      if (!openai) return res.status(503).json({ message: "OpenAI not configured" });
      const prompt = buildBlockRegenerationPrompt(biz, targetBlock, parsed.data.prompt);

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: MICROSITE_BLOCK_REGEN_SYSTEM,
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 2048,
        temperature: 0.8,
      });

      const text = response.choices[0]?.message?.content || "{}";
      let newContent: any;
      try {
        newContent = JSON.parse(text);
      } catch {
        return res.status(500).json({ message: "AI returned invalid JSON. Please try again." });
      }

      const updatedBlocks = currentBlocks.map(b =>
        b.id === parsed.data.blockId ? { ...b, content: newContent } : b
      );

      const [updated] = await db.update(businesses).set({
        micrositeBlocks: updatedBlocks,
        updatedAt: new Date(),
      }).where(eq(businesses.id, biz.id)).returning();

      res.json({
        blockId: parsed.data.blockId,
        content: newContent,
        blocks: updatedBlocks,
      });
    } catch (err: any) {
      console.error("Regenerate block error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  async function requireNonprofit(req: Request, res: Response): Promise<any | null> {
    const entityId = (req.session as any).ownerEntityId;
    if (!entityId) { res.status(401).json({ message: "Unauthorized" }); return null; }
    const [biz] = await db.select().from(businesses).where(eq(businesses.id, entityId)).limit(1);
    if (!biz) { res.status(404).json({ message: "Business not found" }); return null; }
    if (!biz.isNonprofit) { res.status(403).json({ message: "Only nonprofits can access this feature" }); return null; }
    return biz;
  }

  app.get("/api/owner/volunteer-opportunities", requireOwner, async (req: Request, res: Response) => {
    try {
      const biz = await requireNonprofit(req, res);
      if (!biz) return;
      const result = await pool.query(
        `SELECT * FROM jobs WHERE business_id = $1 AND employment_type = 'VOLUNTEER' ORDER BY created_at DESC`,
        [biz.id]
      );
      res.json(result.rows);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/owner/volunteer-opportunities", requireOwner, async (req: Request, res: Response) => {
    try {
      const biz = await requireNonprofit(req, res);
      if (!biz) return;
      const { title, description, locationText, scheduleCommitment, skillsHelpful, contactUrl, remoteType } = req.body;
      if (!title) return res.status(400).json({ message: "Title is required" });

      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 120) + "-" + Date.now().toString(36);
      const result = await pool.query(
        `INSERT INTO jobs (id, city_id, title, slug, employer, employment_type, location_text, remote_type,
          description, posted_at, seed_source_type, seed_source_external_id, business_id, job_status,
          schedule_commitment, skills_helpful, contact_url)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, 'VOLUNTEER', $5, $6, $7, NOW(),
          'nonprofit_volunteer', gen_random_uuid(), $8, 'active', $9, $10, $11)
        RETURNING *`,
        [biz.cityId, title, slug, biz.name, locationText || null, remoteType || null,
         description || null, biz.id, scheduleCommitment || null, skillsHelpful || null, contactUrl || null]
      );
      res.status(201).json(result.rows[0]);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/owner/volunteer-opportunities/:id", requireOwner, async (req: Request, res: Response) => {
    try {
      const biz = await requireNonprofit(req, res);
      if (!biz) return;
      const { rows: [existing] } = await pool.query("SELECT * FROM jobs WHERE id = $1 AND business_id = $2 AND employment_type = 'VOLUNTEER'", [req.params.id, biz.id]);
      if (!existing) return res.status(404).json({ message: "Volunteer opportunity not found" });

      const allowed = ["title", "description", "location_text", "remote_type", "schedule_commitment", "skills_helpful", "contact_url", "job_status"];
      const sets: string[] = [];
      const vals: unknown[] = [];
      let idx = 1;
      for (const [key, val] of Object.entries(req.body)) {
        const dbKey = key.replace(/[A-Z]/g, (l: string) => "_" + l.toLowerCase());
        if (allowed.includes(dbKey)) {
          sets.push(`${dbKey} = $${idx}`);
          vals.push(val);
          idx++;
        }
      }
      if (sets.length === 0) return res.status(400).json({ message: "No valid fields to update" });
      sets.push(`updated_at = NOW()`);
      vals.push(req.params.id);
      vals.push(biz.id);
      const { rows: [updated] } = await pool.query(
        `UPDATE jobs SET ${sets.join(", ")} WHERE id = $${idx} AND business_id = $${idx + 1} AND employment_type = 'VOLUNTEER' RETURNING *`, vals
      );
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/owner/volunteer-opportunities/:id", requireOwner, async (req: Request, res: Response) => {
    try {
      const biz = await requireNonprofit(req, res);
      if (!biz) return;
      await pool.query("DELETE FROM jobs WHERE id = $1 AND business_id = $2 AND employment_type = 'VOLUNTEER'", [req.params.id, biz.id]);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/owner/wishlist-items", requireOwner, async (req: Request, res: Response) => {
    try {
      const biz = await requireNonprofit(req, res);
      if (!biz) return;
      const items = await db.select().from(shopItems)
        .where(and(eq(shopItems.businessId, biz.id), eq(shopItems.type, "wishlist")))
        .orderBy(desc(shopItems.createdAt));
      res.json(items);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/owner/wishlist-items", requireOwner, async (req: Request, res: Response) => {
    try {
      const biz = await requireNonprofit(req, res);
      if (!biz) return;
      const { title, description, quantityNeeded, urgency, imageUrl, externalUrl, category } = req.body;
      if (!title) return res.status(400).json({ message: "Title is required" });
      if (urgency && !["low", "medium", "high"].includes(urgency)) {
        return res.status(400).json({ message: "Urgency must be low, medium, or high" });
      }

      const [item] = await db.insert(shopItems).values({
        businessId: biz.id,
        cityId: biz.cityId,
        title,
        description: description || null,
        price: 0,
        type: "wishlist",
        status: "active",
        quantityNeeded: quantityNeeded || null,
        urgency: urgency || "medium",
        imageUrl: imageUrl || null,
        externalUrl: externalUrl || null,
        category: category || "Wishlist",
      }).returning();
      try {
        const { applyFullTagStack } = await import("./services/content-tagger");
        await applyFullTagStack("shop_item", item.id, { cityId: biz.cityId, zoneId: biz.zoneId, categoryIds: biz.categoryIds, title });
      } catch (tagErr: unknown) {
        const msg = tagErr instanceof Error ? tagErr.message : String(tagErr);
        console.error(`[ContentTagger] Shop item tagging failed for ${item.id}:`, msg);
      }
      res.status(201).json(item);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/owner/wishlist-items/:id", requireOwner, async (req: Request, res: Response) => {
    try {
      const biz = await requireNonprofit(req, res);
      if (!biz) return;
      const [existing] = await db.select().from(shopItems)
        .where(and(eq(shopItems.id, req.params.id), eq(shopItems.businessId, biz.id), eq(shopItems.type, "wishlist")));
      if (!existing) return res.status(404).json({ message: "Wishlist item not found" });

      const updates: Record<string, any> = { updatedAt: new Date() };
      if (req.body.title !== undefined) updates.title = req.body.title;
      if (req.body.description !== undefined) updates.description = req.body.description;
      if (req.body.quantityNeeded !== undefined) updates.quantityNeeded = req.body.quantityNeeded;
      if (req.body.urgency !== undefined) updates.urgency = req.body.urgency;
      if (req.body.imageUrl !== undefined) updates.imageUrl = req.body.imageUrl;
      if (req.body.externalUrl !== undefined) updates.externalUrl = req.body.externalUrl;
      if (req.body.status !== undefined) updates.status = req.body.status;
      if (req.body.category !== undefined) updates.category = req.body.category;

      const [updated] = await db.update(shopItems).set(updates)
        .where(and(eq(shopItems.id, req.params.id), eq(shopItems.businessId, biz.id)))
        .returning();
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/owner/wishlist-items/:id", requireOwner, async (req: Request, res: Response) => {
    try {
      const biz = await requireNonprofit(req, res);
      if (!biz) return;
      const [deleted] = await db.delete(shopItems)
        .where(and(eq(shopItems.id, req.params.id), eq(shopItems.businessId, biz.id), eq(shopItems.type, "wishlist")))
        .returning();
      if (!deleted) return res.status(404).json({ message: "Wishlist item not found" });
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });
}
