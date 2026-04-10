import type { Express, Request, Response, NextFunction } from "express";
import { db } from "./db";
import { businesses, verificationCodes, submissions, zones, categories, shoppingCenters, cities, presenceOwnerAccounts } from "@shared/schema";
import {
  activateCommerceBasicsSchema,
  activateOrgBasicsSchema,
  activateVerifyCodeSchema,
  activateRegionalSchema,
} from "@shared/schema";
import { eq, and, isNull, gt, sql, ilike } from "drizzle-orm";
import { getResendClient } from "./resend-client";
import { getTwilioClient, getTwilioFromPhoneNumber } from "./twilio-client";
import { sendTerritoryEmail } from "./services/territory-email";
import { sendTerritorySms } from "./services/territory-sms";
import { getStripe } from "./stripe/webhook";
import { storage } from "./storage";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { openai } from "./lib/openai";
import { createInboxItemIfNotOpen } from "./admin-inbox";
import { geoTagAndClassify } from "./services/geo-tagger";
import { queueTranslation } from "./services/auto-translate";
import { generateBusinessSlug } from "./lib/slug-utils";
import { workflowEngine } from "./workflow-engine";

const CITY_SLUG_ALIASES: Record<string, string> = {
  clt: "charlotte",
};
function resolveCitySlug(slug: string): string {
  return CITY_SLUG_ALIASES[slug] || slug;
}

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 80);
}

const MOBILE_HOME_BASED_CATEGORY_SLUGS = [
  "mobile-home-based", "mobile-food-trucks", "mobile-services",
  "home-based-business", "side-hustle-freelance",
];

const FREE_EMAIL_DOMAINS = [
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com",
  "icloud.com", "mail.com", "protonmail.com", "zoho.com", "yandex.com",
];

function detectEmailDomainType(email: string): "freeProvider" | "businessDomain" {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return "freeProvider";
  return FREE_EMAIL_DOMAINS.includes(domain) ? "freeProvider" : "businessDomain";
}

function extractDomain(url: string): string | null {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export function registerActivateRoutes(app: Express): void {
  app.post("/api/activate/create-draft", async (req: Request, res: Response) => {
    try {
      const { presenceType } = req.body;
      const isOrg = presenceType === "organization";

      const schema = isOrg ? activateOrgBasicsSchema : activateCommerceBasicsSchema;
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten().fieldErrors });
      }

      const data = parsed.data as any;
      const { name, neighborhoodId, phone, email, primaryCategoryL2, claimantRole } = data;
      const websiteUrl = data.websiteUrl;
      const googleProfileUrl = data.googleProfileUrl;
      const shortDescription = data.shortDescription;
      const commercialCenterName = data.commercialCenterName;
      const missionStatement = data.missionStatement;
      const executiveDirectorName = data.executiveDirectorName;
      const executiveDirectorTitle = data.executiveDirectorTitle;
      const executiveDirectorPhone = data.executiveDirectorPhone;
      const executiveDirectorEmail = data.executiveDirectorEmail;
      const boardChairName = data.boardChairName;
      const boardChairPhone = data.boardChairPhone;
      const boardChairEmail = data.boardChairEmail;

      const zone = await db.select().from(zones).where(eq(zones.id, neighborhoodId)).limit(1);
      if (!zone.length) {
        return res.status(404).json({ message: "Neighborhood not found" });
      }

      const cityId = zone[0].cityId;
      const cityRecord = await storage.getCityById(cityId);
      let slug = await generateBusinessSlug(name, cityId, {
        zoneId: neighborhoodId,
        hubSlug: zone[0].slug,
        cityName: cityRecord?.name || null,
      });

      const emailDomainType = detectEmailDomainType(email);
      const websiteDomain = websiteUrl ? extractDomain(websiteUrl) : null;
      const emailDomain = email.split("@")[1]?.toLowerCase();
      const domainMatched = websiteDomain && emailDomain ? websiteDomain === emailDomain : false;

      const nearestTransitStopId = data.nearestTransitStopId;
      const isNonprofit = data.isNonprofit ?? false;
      const isCommunityServing = data.isCommunityServing ?? false;
      const languagesSpoken = data.languagesSpoken || ["English"];

      // Look up the category name for display
      const [categoryRecord] = await db.select().from(categories).where(eq(categories.id, primaryCategoryL2)).limit(1);
      const categoryName = categoryRecord?.name || "Local Business";

      // Search for existing match in our DB
      let existingMatch = null;
      try {
        const cityRecord = await db.select().from(cities).where(eq(cities.id, cityId)).limit(1);
        const cityName = cityRecord[0]?.brandName || "Charlotte";
        const matches = await storage.searchBusinessesFuzzy(name, cityName, websiteUrl || undefined);
        if (matches.length === 1) {
          existingMatch = matches[0];
        } else if (matches.length > 1 && websiteUrl) {
          const exactUrlMatch = matches.find((m: any) => m.websiteUrl && extractDomain(m.websiteUrl) === websiteDomain);
          if (exactUrlMatch) existingMatch = exactUrlMatch;
        }
      } catch (searchErr) {
        console.log("[ACTIVATE] Fuzzy search error (non-fatal):", (searchErr as Error).message);
      }

      // Generate a professional AI description
      let aiDescription = "";
      let aiTagline = "";
      const isOrgType = presenceType === "organization";
      try {
        if (!openai) throw new Error("OpenAI not configured");
        const websiteContext = websiteUrl ? `Their website is: ${websiteUrl}.` : "";
        const descContext = isOrgType && missionStatement
          ? `Their mission: ${missionStatement}.`
          : shortDescription ? `About them: ${shortDescription}.` : "";
        const typeLabel = isOrgType ? "organization" : "business";
        const aiResp = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          temperature: 0.7,
          max_tokens: 250,
          messages: [
            {
              role: "system",
              content: "You write short, warm, professional directory descriptions for local businesses and organizations. Output valid JSON only."
            },
            {
              role: "user",
              content: `Write a directory listing for "${name}", a ${typeLabel} in the ${categoryName} category, located in the ${zone[0].name} neighborhood of Charlotte, NC. ${websiteContext} ${descContext} Return JSON: {"description": "2-3 sentence factual directory description that sounds like it was written by a local editor who knows the community. Avoid generic filler. Make it sound established and welcoming.", "tagline": "A catchy 3-6 word tagline for this ${typeLabel}."}`
            }
          ],
          response_format: { type: "json_object" },
        });
        const aiContent = aiResp.choices[0]?.message?.content;
        if (aiContent) {
          const parsed2 = JSON.parse(aiContent);
          aiDescription = parsed2.description || "";
          aiTagline = parsed2.tagline || "";
        }
      } catch (aiErr) {
        console.log("[ACTIVATE] AI description generation skipped:", (aiErr as Error).message);
        aiDescription = isOrgType && missionStatement
          ? missionStatement
          : shortDescription || `Discover ${name}, proudly serving the Charlotte community.`;
      }

      // If existing match found — this is a claim activation
      if (existingMatch && existingMatch.claimStatus === "UNCLAIMED") {
        await db.update(businesses).set({
          ownerEmail: email,
          claimStatus: "PENDING",
          draftContactPhone: phone,
          claimantRole: claimantRole || null,
          presenceStatus2: "DRAFT",
          description: aiDescription || existingMatch.description,
          micrositeTagline: aiTagline || existingMatch.micrositeTagline,
          languagesSpoken,
          ...(isOrgType ? {
            missionStatement: missionStatement || null,
            executiveDirectorName: executiveDirectorName || null,
            executiveDirectorTitle: executiveDirectorTitle || null,
            executiveDirectorPhone: executiveDirectorPhone || null,
            executiveDirectorEmail: executiveDirectorEmail || null,
            boardChairName: boardChairName || null,
            boardChairPhone: boardChairPhone || null,
            boardChairEmail: boardChairEmail || null,
            isNonprofit,
            isCommunityServing,
          } : {}),
        }).where(eq(businesses.id, existingMatch.id));

        queueTranslation("business", existingMatch.id);

        const matchZone = await db.select().from(zones).where(eq(zones.id, existingMatch.zoneId)).limit(1);

        createInboxItemIfNotOpen({
          itemType: "new_activation",
          relatedTable: "businesses",
          relatedId: existingMatch.id,
          title: `New Activation (Claim): ${existingMatch.name}`,
          summary: `${presenceType === "organization" ? "Organization" : "Commerce"} claim started by ${email} in ${matchZone[0]?.name || zone[0].name}. Category: ${categoryName}.`,
          tags: ["Activation", presenceType === "organization" ? "Organization" : "Commerce", "Claim"],
          links: [{ label: "Review Presence", urlOrRoute: `/admin/businesses?openBiz=${existingMatch.id}` }],
        }).catch(err => console.error("[INBOX] Failed to create activation inbox item:", err));

        workflowEngine.startSession({
          cityId,
          source: "activate",
          contactEmail: email,
          contactPhone: phone,
          businessName: existingMatch.name,
          entityId: existingMatch.id,
          entityType: "business",
          presenceType,
          sessionData: { isClaim: true, categoryName },
        }).catch(err => console.error("[WORKFLOW] activate claim session:", err));

        return res.json({
          entityId: existingMatch.id,
          slug: existingMatch.slug,
          foundPresence: {
            name: existingMatch.name,
            description: aiDescription || existingMatch.description,
            tagline: aiTagline || existingMatch.micrositeTagline,
            neighborhood: matchZone[0]?.name || zone[0].name,
            category: categoryName,
            phone: existingMatch.phone || phone,
            websiteUrl: existingMatch.websiteUrl || websiteUrl,
            isClaim: true,
          },
        });
      }

      const isMobileHomeBased = categoryRecord && MOBILE_HOME_BASED_CATEGORY_SLUGS.includes(categoryRecord.slug);
      const parentCatRecord = categoryRecord?.parentCategoryId
        ? await db.select().from(categories).where(eq(categories.id, categoryRecord.parentCategoryId)).limit(1)
        : [];
      const isMobileParent = parentCatRecord.length > 0 && MOBILE_HOME_BASED_CATEGORY_SLUGS.includes(parentCatRecord[0].slug);

      // No existing match — create new draft
      const [draft] = await db.insert(businesses).values({
        cityId,
        zoneId: neighborhoodId,
        name,
        slug,
        phone,
        ownerEmail: email,
        websiteUrl: websiteUrl || null,
        googleProfileUrl: googleProfileUrl || null,
        description: aiDescription || shortDescription || null,
        missionStatement: missionStatement || null,
        micrositeTagline: aiTagline || null,
        presenceType: presenceType === "organization" ? "organization" : "commerce",
        categoryIds: [primaryCategoryL2],
        listingTier: "VERIFIED",
        presenceStatus2: "DRAFT",
        emailDomainType,
        websiteDomain,
        domainMatched,
        draftContactPhone: phone,
        executiveDirectorName: executiveDirectorName || null,
        executiveDirectorTitle: executiveDirectorTitle || null,
        executiveDirectorPhone: executiveDirectorPhone || null,
        executiveDirectorEmail: executiveDirectorEmail || null,
        boardChairName: boardChairName || null,
        boardChairPhone: boardChairPhone || null,
        boardChairEmail: boardChairEmail || null,
        claimantRole: claimantRole || null,
        nearestTransitStopId: nearestTransitStopId || null,
        isNonprofit,
        isCommunityServing,
        languagesSpoken,
        isServiceArea: isMobileHomeBased || isMobileParent,
      }).returning();

      queueTranslation("business", draft.id);
      geoTagAndClassify("business", draft.id, cityId, {
        title: name,
        description: aiDescription || shortDescription || null,
        address: null,
        zip: null,
        categoryIds: [primaryCategoryL2],
      }, { existingZoneId: neighborhoodId }).catch(err => console.error("[GeoTagger] Activate biz:", err.message));

      if (commercialCenterName && commercialCenterName.trim()) {
        const centerSlug = commercialCenterName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        let sc = await db.select().from(shoppingCenters).where(eq(shoppingCenters.slug, centerSlug)).limit(1);
        let centerId: string;
        if (sc.length > 0) {
          centerId = sc[0].id;
        } else {
          const [newCenter] = await db.insert(shoppingCenters).values({
            name: commercialCenterName.trim(),
            slug: centerSlug,
            cityId,
            zoneId: neighborhoodId,
          }).returning();
          centerId = newCenter.id;
        }
        await db.update(businesses).set({ shoppingCenterId: centerId }).where(eq(businesses.id, draft.id));
      }

      createInboxItemIfNotOpen({
        itemType: "new_activation",
        relatedTable: "businesses",
        relatedId: draft.id,
        title: `New Activation: ${name}`,
        summary: `New ${presenceType === "organization" ? "organization" : "commerce"} presence created by ${email} in ${zone[0].name}. Category: ${categoryName}.`,
        tags: ["Activation", presenceType === "organization" ? "Organization" : "Commerce"],
        links: [{ label: "Review Presence", urlOrRoute: `/admin/businesses?openBiz=${draft.id}` }],
      }).catch(err => console.error("[INBOX] Failed to create activation inbox item:", err));

      workflowEngine.startSession({
        cityId,
        source: "activate",
        contactEmail: email,
        contactPhone: phone,
        businessName: name,
        entityId: draft.id,
        entityType: "business",
        presenceType,
        sessionData: { isClaim: false, categoryName },
      }).catch(err => console.error("[WORKFLOW] activate new session:", err));

      res.json({
        entityId: draft.id,
        slug: draft.slug,
        foundPresence: {
          name,
          description: aiDescription || shortDescription || `Discover ${name}, proudly serving the Charlotte community.`,
          tagline: aiTagline || "",
          neighborhood: zone[0].name,
          category: categoryName,
          phone,
          websiteUrl: websiteUrl || null,
          isClaim: false,
        },
      });
    } catch (err: any) {
      console.error("Error creating draft:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/activate/send-code", async (req: Request, res: Response) => {
    try {
      const { entityId, type, target } = req.body;
      if (!entityId || !type || !target) {
        return res.status(400).json({ message: "entityId, type, and target are required" });
      }
      if (!["EMAIL", "SMS"].includes(type)) {
        return res.status(400).json({ message: "type must be EMAIL or SMS" });
      }

      const code = generateCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await db.insert(verificationCodes).values({
        entityId,
        code,
        type,
        target,
        expiresAt,
      });

      const [entity] = await db.select({ cityId: businesses.cityId }).from(businesses).where(eq(businesses.id, entityId));
      const entityCityId = entity?.cityId || undefined;

      if (type === "EMAIL") {
        const result = await sendTerritoryEmail({
          cityId: entityCityId,
          to: target,
          subject: "CLT Metro Hub - Verification Code",
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #5B1D8F; margin-bottom: 16px;">Verify Your Presence</h2>
              <p style="color: #333; font-size: 16px;">Your verification code is:</p>
              <div style="background: #f4f0ff; border: 2px solid #5B1D8F; border-radius: 12px; padding: 20px; text-align: center; margin: 16px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #5B1D8F;">${code}</span>
              </div>
              <p style="color: #666; font-size: 14px;">This code expires in 10 minutes.</p>
              <p style="color: #999; font-size: 12px; margin-top: 24px;">CLT Metro Hub — Built by Neighborhood</p>
            </div>
          `,
          metadata: { type: "verification_code", entityId },
        });
        if (!result.success) {
          console.error("Email send error:", result.error);
          return res.status(500).json({ message: "Failed to send verification email. Please try again." });
        }
      } else {
        const result = await sendTerritorySms({
          cityId: entityCityId,
          to: target,
          body: `CLT Metro Hub verification code: ${code}. Expires in 10 minutes.`,
          metadata: { type: "verification_code", entityId },
        });
        if (!result.success) {
          console.error("SMS send error:", result.error);
          return res.status(500).json({ message: "Failed to send SMS. Please check the phone number and try again." });
        }
      }

      res.json({ success: true, message: `Verification code sent via ${type.toLowerCase()}` });
    } catch (err: any) {
      console.error("Error sending code:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/activate/verify-code", async (req: Request, res: Response) => {
    try {
      const parsed = activateVerifyCodeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten().fieldErrors });
      }

      const { entityId, code, type } = parsed.data;

      const [match] = await db.select()
        .from(verificationCodes)
        .where(
          and(
            eq(verificationCodes.entityId, entityId),
            eq(verificationCodes.code, code),
            eq(verificationCodes.type, type),
            isNull(verificationCodes.usedAt),
            gt(verificationCodes.expiresAt, new Date()),
          )
        )
        .limit(1);

      if (!match) {
        return res.status(400).json({ message: "Invalid or expired code. Please request a new one." });
      }

      await db.update(verificationCodes)
        .set({ usedAt: new Date() })
        .where(eq(verificationCodes.id, match.id));

      const updateData: any = {};
      if (type === "EMAIL") {
        updateData.emailVerifiedAt = new Date();
      } else {
        updateData.phoneVerifiedAt = new Date();
      }

      const [biz] = await db.select().from(businesses).where(eq(businesses.id, entityId)).limit(1);
      if (biz) {
        const hasEmail = type === "EMAIL" || biz.emailVerifiedAt;
        const hasSms = type === "SMS" || biz.phoneVerifiedAt;
        if (hasEmail && hasSms) {
          updateData.verificationMethodUsed = "BOTH";
        } else if (hasEmail) {
          updateData.verificationMethodUsed = "EMAIL";
        } else {
          updateData.verificationMethodUsed = "SMS";
        }
        updateData.presenceStatus2 = "PENDING_VERIFICATION";
      }

      await db.update(businesses)
        .set(updateData)
        .where(eq(businesses.id, entityId));

      res.json({
        success: true,
        verified: type.toLowerCase(),
        emailVerified: type === "EMAIL" || !!biz?.emailVerifiedAt,
        phoneVerified: type === "SMS" || !!biz?.phoneVerifiedAt,
      });
    } catch (err: any) {
      console.error("Error verifying code:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/activate/verification-checkout", async (req: Request, res: Response) => {
    try {
      const { entityId, citySlug, operatorId: rawOperatorId } = req.body;
      if (!entityId || !citySlug) {
        return res.status(400).json({ message: "entityId and citySlug required" });
      }

      let operatorId: string | undefined;
      if (rawOperatorId) {
        const { operators } = await import("@shared/schema");
        const [op] = await db.select({ id: operators.id, status: operators.status }).from(operators).where(eq(operators.id, rawOperatorId));
        if (op && op.status === "ACTIVE") operatorId = op.id;
      }

      const [biz] = await db.select().from(businesses).where(eq(businesses.id, entityId)).limit(1);
      if (!biz) {
        return res.status(404).json({ message: "Presence not found" });
      }

      const stripe = getStripe();
      const email = biz.ownerEmail || "";
      const appUrl = process.env.APP_PUBLIC_URL || `https://${req.get("host")}`;

      let stripeCustomerId: string;
      const city = await storage.getCityBySlug(resolveCitySlug(citySlug));
      if (!city) {
        return res.status(404).json({ message: "City not found" });
      }

      const existing = await storage.getStripeCustomerByEmail(email, city.id);
      if (existing) {
        stripeCustomerId = existing.stripeCustomerId;
      } else {
        const customer = await stripe.customers.create({
          email,
          metadata: { city_id: city.id, city_slug: citySlug, entity_id: entityId },
        });
        await storage.createStripeCustomer({ cityId: city.id, email, stripeCustomerId: customer.id });
        stripeCustomerId = customer.id;
      }

      const priceId = process.env.STRIPE_PRICE_VERIFICATION;
      if (!priceId) {
        return res.status(400).json({ message: "Stripe verification price not configured. Set STRIPE_PRICE_VERIFICATION env var." });
      }

      const ref = req.body.ref || undefined;
      const verificationMeta: Record<string, string> = {
        city_id: city.id,
        city_slug: citySlug,
        subject_type: "BUSINESS",
        subject_id: entityId,
        product_type: "LISTING_TIER",
        tier: "VERIFIED",
        ...(operatorId ? { source_operator_id: operatorId } : {}),
        ...(ref ? { ambassador_ref: ref } : {}),
      };

      const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        mode: "payment",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${appUrl}/${citySlug}/activate?step=success&entityId=${entityId}`,
        cancel_url: `${appUrl}/${citySlug}/activate?step=payment&entityId=${entityId}`,
        metadata: verificationMeta,
      });

      await db.update(businesses)
        .set({ stripeVerificationSessionId: session.id })
        .where(eq(businesses.id, entityId));

      res.json({ url: session.url });
    } catch (err: any) {
      console.error("Error creating verification checkout:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/activate/verify-payment", async (req: Request, res: Response) => {
    try {
      const { entityId } = req.body;
      if (!entityId) {
        return res.status(400).json({ message: "entityId required" });
      }

      const [biz] = await db.select().from(businesses).where(eq(businesses.id, entityId)).limit(1);
      if (!biz) {
        return res.status(404).json({ message: "Presence not found" });
      }

      if (!biz.stripeVerificationSessionId) {
        return res.json({ paid: false });
      }

      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(biz.stripeVerificationSessionId);

      if (session.payment_status === "paid") {
        const emailCode = generateCode();
        const emailExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await db.insert(verificationCodes).values({
          entityId,
          code: emailCode,
          type: "EMAIL",
          target: biz.ownerEmail || biz.email || "",
          expiresAt: emailExpiry,
        });

        await db.update(businesses)
          .set({
            isVerified: true,
            verifiedAt: new Date(),
            presenceStatus2: "VERIFIED",
            listingTier: "VERIFIED",
          })
          .where(eq(businesses.id, entityId));

        const ownerEmail = biz.ownerEmail || biz.email || "";
        if (ownerEmail) {
          try {
            const { client, fromEmail } = await getResendClient();
            const appUrl = process.env.APP_PUBLIC_URL || `https://${req.get("host")}`;
            const verifyLink = `${appUrl}/api/activate/confirm-email?entityId=${entityId}&code=${emailCode}`;
            await client.emails.send({
              from: fromEmail,
              to: ownerEmail,
              subject: "CLT Metro Hub — Confirm Your Email",
              html: `
                <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
                  <h2 style="color: #5B1D8F; margin-bottom: 16px;">Welcome to CLT Metro Hub!</h2>
                  <p style="color: #333; font-size: 16px;">Your $1 verification payment was successful. Please confirm your email address to complete your account setup.</p>
                  <div style="text-align: center; margin: 24px 0;">
                    <a href="${verifyLink}" style="display: inline-block; background: #5B1D8F; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">Confirm Email Address</a>
                  </div>
                  <p style="color: #666; font-size: 14px;">Or enter this code manually: <strong style="letter-spacing: 4px; color: #5B1D8F;">${emailCode}</strong></p>
                  <p style="color: #999; font-size: 12px; margin-top: 24px;">This link expires in 24 hours.<br/>CLT Metro Hub — Built by Neighborhood</p>
                </div>
              `,
            });
            console.log(`[VERIFY] Post-payment email verification sent to ${ownerEmail}`);
          } catch (emailErr) {
            console.error("[VERIFY] Failed to send post-payment verification email:", emailErr);
          }
        }

        let ownerAccountCreated = false;
        if (ownerEmail) {
          try {
            const normalizedEmail = ownerEmail.toLowerCase().trim();
            const [existing] = await db.select().from(presenceOwnerAccounts).where(eq(presenceOwnerAccounts.email, normalizedEmail)).limit(1);
            if (!existing) {
              const tempPassword = crypto.randomBytes(24).toString("hex");
              const passwordHash = await bcrypt.hash(tempPassword, 12);
              const [account] = await db.insert(presenceOwnerAccounts).values({
                email: normalizedEmail,
                passwordHash,
                entityId,
                displayName: biz.name || "",
              }).returning();
              if (account) {
                (req.session as any).ownerAccountId = account.id;
                (req.session as any).ownerEntityId = entityId;
                ownerAccountCreated = true;
                console.log(`[VERIFY] Auto-created owner account for ${normalizedEmail}`);
              }
            } else {
              (req.session as any).ownerAccountId = existing.id;
              (req.session as any).ownerEntityId = entityId;
              ownerAccountCreated = true;
            }
          } catch (ownerErr) {
            console.error("[VERIFY] Failed to auto-create owner account:", ownerErr);
          }
        }

        createInboxItemIfNotOpen({
          itemType: "new_activation",
          relatedTable: "businesses",
          relatedId: entityId,
          title: `Activation Verified: ${biz.name}`,
          summary: `${biz.presenceType === "organization" ? "Organization" : "Commerce"} "${biz.name}" completed $1 verification payment. Owner account ${ownerAccountCreated ? "auto-created" : "pending"}.`,
          priority: "med",
          tags: ["Activation", "Verified", biz.presenceType === "organization" ? "Organization" : "Commerce"],
          links: [{ label: "Review Presence", urlOrRoute: `/admin/businesses?openBiz=${entityId}` }],
        }).catch(err => console.error("[INBOX] Failed to create verification inbox item:", err));

        return res.json({ paid: true, presenceType: biz.presenceType, isNonprofit: biz.isNonprofit, isCommunityServing: biz.isCommunityServing, slug: biz.slug, ownerAccountCreated });
      }

      res.json({ paid: false });
    } catch (err: any) {
      console.error("Error verifying payment:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/activate/confirm-email", async (req: Request, res: Response) => {
    try {
      const { entityId, code } = req.query;
      if (!entityId || !code) {
        return res.status(400).send("Invalid confirmation link.");
      }

      const [record] = await db.select()
        .from(verificationCodes)
        .where(
          and(
            eq(verificationCodes.entityId, entityId as string),
            eq(verificationCodes.code, code as string),
            eq(verificationCodes.type, "EMAIL"),
            isNull(verificationCodes.usedAt),
            gt(verificationCodes.expiresAt, new Date()),
          )
        )
        .limit(1);

      if (!record) {
        return res.status(400).send(`
          <html><body style="font-family:sans-serif;text-align:center;padding:60px;">
            <h2 style="color:#dc2626;">Link Expired or Invalid</h2>
            <p>This confirmation link has expired or has already been used.</p>
          </body></html>
        `);
      }

      await db.update(verificationCodes)
        .set({ usedAt: new Date() })
        .where(eq(verificationCodes.id, record.id));

      await db.update(businesses)
        .set({ emailVerifiedAt: new Date() })
        .where(eq(businesses.id, entityId as string));

      const [biz] = await db.select().from(businesses).where(eq(businesses.id, entityId as string)).limit(1);
      const citySlug = biz ? (await storage.getCityById(biz.cityId))?.slug || "charlotte" : "charlotte";

      res.send(`
        <html><body style="font-family:sans-serif;text-align:center;padding:60px;">
          <div style="max-width:480px;margin:0 auto;">
            <div style="font-size:48px;margin-bottom:16px;">✅</div>
            <h2 style="color:#5B1D8F;">Email Confirmed!</h2>
            <p style="color:#333;">Your email address has been verified. Your account is all set.</p>
            <a href="/${citySlug}" style="display:inline-block;margin-top:24px;background:#5B1D8F;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">Go to CLT Metro Hub</a>
          </div>
        </body></html>
      `);
    } catch (err: any) {
      console.error("Error confirming email:", err);
      res.status(500).send("Something went wrong. Please try again.");
    }
  });

  app.post("/api/activate/regional-request", async (req: Request, res: Response) => {
    try {
      const parsed = activateRegionalSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten().fieldErrors });
      }

      const { name, phone, email, commerceName, locationCount, notes, preferredContactMethod } = parsed.data;

      const city = await storage.getCityBySlug("charlotte");
      if (!city) {
        return res.status(404).json({ message: "City not found" });
      }

      await db.insert(submissions).values({
        cityId: city.id,
        type: "BUSINESS",
        submitterName: name,
        submitterEmail: email,
        status: "PENDING",
        payload: {
          commerceName,
          phone,
          locationCount,
          notes: notes || "",
          preferredContactMethod,
          isRegional: true,
        },
        notes: `Regional request: ${locationCount} locations. Contact via: ${preferredContactMethod}. ${notes || ""}`.trim(),
      });

      res.json({ success: true });
    } catch (err: any) {
      console.error("Error creating regional request:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/activate/neighborhoods-by-zip", async (req: Request, res: Response) => {
    try {
      const zip = req.query.zip as string;
      const citySlug = req.query.citySlug as string || "charlotte";
      if (!zip || !/^\d{5}$/.test(zip)) {
        return res.status(400).json({ message: "Valid 5-digit zip code required", zoneIds: [] });
      }

      const city = await storage.getCityBySlug(resolveCitySlug(citySlug));
      if (!city) {
        return res.status(404).json({ message: "City not found", zoneIds: [] });
      }

      const matchingZones = await db.select({ id: zones.id })
        .from(zones)
        .where(
          and(
            eq(zones.cityId, city.id),
            sql`${zip} = ANY(${zones.zipCodes})`
          )
        );

      res.json({ zoneIds: matchingZones.map(z => z.id) });
    } catch (err: any) {
      res.status(500).json({ message: err.message, zoneIds: [] });
    }
  });

  app.get("/api/activate/neighborhoods/:citySlug", async (req: Request, res: Response) => {
    try {
      const citySlug = req.params.citySlug as string;
      const city = await storage.getCityBySlug(resolveCitySlug(citySlug));
      if (!city) {
        return res.status(404).json({ message: "City not found" });
      }

      const allZones = await db.select({
        id: zones.id,
        name: zones.name,
        slug: zones.slug,
        type: zones.type,
      })
        .from(zones)
        .where(eq(zones.cityId, city.id))
        .orderBy(zones.name);

      const neighborhoodZones = allZones.filter(z => z.type === "NEIGHBORHOOD");
      const districtZones = allZones.filter(z => z.type === "DISTRICT");

      res.json({
        groups: [
          { label: "Charlotte Neighborhoods", items: neighborhoodZones },
          { label: "Towns & Cities", items: districtZones },
        ],
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/activate/categories-l2", async (req: Request, res: Response) => {
    try {
      const type = req.query.type as string | undefined;
      const allCats = await db.select().from(categories).orderBy(categories.sortOrder, categories.name);

      const l1s = allCats.filter(c => !c.parentCategoryId);
      const l2s = allCats.filter(c => c.parentCategoryId);

      if (type === "organization") {
        const orgL1Slugs = ["nonprofit-faith", "community", "civic", "senior", "youth"];
        const orgL1s = l1s.filter(c => orgL1Slugs.some(s => c.slug.includes(s)));
        if (orgL1s.length > 0) {
          const grouped = orgL1s.map(l1 => ({
            label: l1.name,
            children: l2s.filter(l2 => l2.parentCategoryId === l1.id).map(l2 => ({ id: l2.id, name: l2.name, sicCode: l2.sicCode || undefined })),
          })).filter(g => g.children.length > 0);
          if (grouped.length > 0) return res.json({ groups: grouped });
        }
      }

      const grouped = l1s.map(l1 => ({
        label: l1.name,
        children: l2s.filter(l2 => l2.parentCategoryId === l1.id).map(l2 => ({ id: l2.id, name: l2.name, sicCode: l2.sicCode || undefined })),
      })).filter(g => g.children.length > 0);

      res.json({ groups: grouped });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/activate/entity/:entityId", async (req: Request, res: Response) => {
    try {
      const entityId = req.params.entityId as string;
      const [biz] = await db.select().from(businesses).where(eq(businesses.id, entityId)).limit(1);
      if (!biz) {
        return res.status(404).json({ message: "Not found" });
      }
      res.json({
        id: biz.id,
        name: biz.name,
        presenceType: biz.presenceType,
        emailVerified: !!biz.emailVerifiedAt,
        phoneVerified: !!biz.phoneVerifiedAt,
        isVerified: biz.isVerified,
        presenceStatus2: biz.presenceStatus2,
        ownerEmail: biz.ownerEmail,
        phone: biz.phone || biz.draftContactPhone,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/activate/upgrade-checkout", async (req: Request, res: Response) => {
    try {
      const { entityId, tier, locations, citySlug } = req.body;

      if (!entityId || !tier || !citySlug) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      if (tier !== "ENHANCED") {
        return res.status(400).json({ message: "Invalid tier" });
      }

      const maxLocations = 5;
      if (locations && locations.length > maxLocations) {
        return res.status(400).json({ message: `Maximum ${maxLocations} locations allowed for Enhanced tier` });
      }

      const [biz] = await db.select().from(businesses).where(eq(businesses.id, entityId)).limit(1);
      if (!biz) {
        return res.status(404).json({ message: "Entity not found" });
      }

      const isMobileOrHomeBased = biz.isServiceArea;
      if (!locations || !locations[0]?.phone || !locations[0]?.neighborhoodId) {
        return res.status(400).json({ message: "At least one location with phone and neighborhood is required" });
      }
      if (!isMobileOrHomeBased && !locations[0]?.address) {
        return res.status(400).json({ message: "Address is required for this business type" });
      }

      const priceId = process.env.STRIPE_PRICE_ENHANCED;

      if (!priceId) {
        return res.json({ url: null, message: "Tier pricing not yet configured" });
      }

      const stripe = getStripe();
      const baseUrl = process.env.APP_PUBLIC_URL
        || (process.env.REPLIT_DOMAINS
          ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
          : process.env.REPLIT_DEV_DOMAIN
            ? `https://${process.env.REPLIT_DEV_DOMAIN}`
            : "http://localhost:5000");

      const city = await storage.getCityBySlug(resolveCitySlug(citySlug));
      if (!city) {
        return res.status(404).json({ message: "City not found" });
      }

      const email = biz.ownerEmail || "";
      let stripeCustomerId: string | undefined;
      if (email) {
        const existing = await storage.getStripeCustomerByEmail(email, city.id);
        if (existing) {
          stripeCustomerId = existing.stripeCustomerId;
        } else {
          const customer = await stripe.customers.create({
            email,
            metadata: { city_id: city.id, city_slug: citySlug, entity_id: entityId },
          });
          await storage.createStripeCustomer({ cityId: city.id, email, stripeCustomerId: customer.id });
          stripeCustomerId = customer.id;
        }
      }

      const ref = req.body.ref || undefined;
      const upgradeMeta: Record<string, string> = {
        city_id: city.id,
        city_slug: citySlug,
        subject_type: "BUSINESS",
        subject_id: entityId,
        product_type: "LISTING_TIER",
        tier,
        ...(ref ? { ambassador_ref: ref } : {}),
      };

      const session = await stripe.checkout.sessions.create({
        ...(stripeCustomerId ? { customer: stripeCustomerId } : {}),
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${baseUrl}/${citySlug}/activate?step=upgrade-success&entityId=${entityId}&tier=${tier}`,
        cancel_url: `${baseUrl}/${citySlug}/activate?step=locations&entityId=${entityId}`,
        metadata: upgradeMeta,
        subscription_data: { metadata: upgradeMeta },
      });

      await db.update(businesses).set({
        address: locations[0].address || biz.address,
        phone: locations[0].phone || biz.phone,
        zoneId: locations[0].neighborhoodId || biz.zoneId,
        stripeCheckoutSessionId: session.id,
      }).where(eq(businesses.id, entityId));

      res.json({ url: session.url });
    } catch (err: any) {
      console.error("Upgrade checkout error:", err);
      res.status(500).json({ message: err.message });
    }
  });
}
