import type { Express, Request, Response, NextFunction } from "express";
import { db } from "./db";
import { operators, operatorTerritories, territories, businesses, territoryListings, revenueTransactions, revenueSplits, crmPresence, crmActivity, presenceAuditLog, placeImportJobs, commsLog, entityScores, entityContactVerification, entityLocationProfile, entityOutreachRecommendation, entityAssetTags, regions, events, articles, adPlacements, adInventorySlots, zones } from "@shared/schema";
import { eq, and, inArray, desc, gte, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { getResendClient } from "./resend-client";
import { sendTerritoryEmail } from "./services/territory-email";
import { storage } from "./storage";
import { runImportJob, getDailyUsage, type ImportSummary } from "./google-places";
import { logPresenceFieldChange } from "./audit";
import { geoTagAndClassify } from "./services/geo-tagger";
import { queueTranslation } from "./services/auto-translate";

async function requireOperator(req: Request, res: Response, next: NextFunction) {
  const operatorId = (req.session as any).operatorId;
  if (!operatorId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    const [operator] = await db.select({ status: operators.status, pipelineStage: operators.pipelineStage })
      .from(operators).where(eq(operators.id, operatorId));
    if (!operator) {
      (req.session as any).operatorId = null;
      return res.status(401).json({ message: "Operator not found" });
    }
    if (operator.status === "SUSPENDED" || operator.status === "REVOKED") {
      console.warn(`[KILL_SWITCH] Blocked access for operator ${operatorId} — status: ${operator.status}`);
      try {
        const { logAudit } = await import("./services/audit-logger");
        logAudit({ actorOperatorId: operatorId, action: "KILL_SWITCH_BLOCKED", operatorId, metadata: { status: operator.status, path: req.path } });
      } catch {}
      return res.status(403).json({ message: "Your operator account has been suspended. Contact your administrator." });
    }
  } catch (err) {
    console.error("[KILL_SWITCH] Error checking operator status:", err);
  }
  next();
}

export function registerOperatorAuthRoutes(app: Express, requireAdmin: any) {

  app.post("/api/admin/operators/:id/invite", requireAdmin, async (req: Request, res: Response) => {
    try {
      const operator = await db.select().from(operators).where(eq(operators.id, req.params.id)).then(r => r[0]);
      if (!operator) return res.status(404).json({ message: "Operator not found" });

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await db.update(operators).set({
        inviteToken: token,
        inviteExpiresAt: expiresAt,
        pipelineStage: "ONBOARDING",
        updatedAt: new Date(),
      }).where(eq(operators.id, operator.id));

      const appUrl = process.env.APP_PUBLIC_URL || `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
      const inviteUrl = `${appUrl}/operator/register?token=${token}`;

      try {
        const emailResult = await sendTerritoryEmail({
          to: operator.email,
          subject: "You've been invited to City Metro Hub",
          html: `
            <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
              <h1 style="color: #1a1a2e; font-size: 24px;">Welcome to City Metro Hub</h1>
              <p>Hi ${operator.displayName},</p>
              <p>You've been invited to join City Metro Hub as a <strong>${operator.operatorType}</strong> operator.</p>
              <p>Click the button below to set up your account:</p>
              <a href="${inviteUrl}" style="display: inline-block; background: #1a1a2e; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 16px 0;">Set Up Your Account</a>
              <p style="color: #666; font-size: 14px;">This invite expires in 7 days.</p>
              <p style="color: #444; font-size: 14px; margin-top: 16px;"><strong>Tip:</strong> After setting up your account, bookmark <code>/capture</code> on your phone and add it to your home screen for quick access to your field tools.</p>
              <p style="color: #666; font-size: 12px;">If you didn't expect this invitation, you can safely ignore this email.</p>
            </div>
          `,
          metadata: { type: "operator_invite", operatorId: operator.id },
        });

        if (emailResult.success) {
          res.json({ message: "Invite sent", inviteUrl });
        } else {
          console.error("[OPERATOR] Email send failed:", emailResult.error);
          res.json({ message: "Invite created but email failed to send. Share the link manually.", inviteUrl });
        }
      } catch (err: any) {
        res.status(500).json({ message: err.message });
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/operator/invite/:token", async (req: Request, res: Response) => {
    try {
      const [operator] = await db.select().from(operators).where(eq(operators.inviteToken, req.params.token));
      if (!operator) return res.status(404).json({ message: "Invalid invite token" });
      if (operator.inviteExpiresAt && operator.inviteExpiresAt < new Date()) {
        return res.status(410).json({ message: "Invite has expired" });
      }
      if (operator.passwordHash) {
        return res.status(409).json({ message: "Account already set up. Please sign in." });
      }
      res.json({ email: operator.email, displayName: operator.displayName, operatorType: operator.operatorType });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/operator/register", async (req: Request, res: Response) => {
    try {
      const { token, password } = req.body;
      if (!token || !password) return res.status(400).json({ message: "Token and password are required" });
      if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });

      const [operator] = await db.select().from(operators).where(eq(operators.inviteToken, token));
      if (!operator) return res.status(404).json({ message: "Invalid invite token" });
      if (operator.inviteExpiresAt && operator.inviteExpiresAt < new Date()) {
        return res.status(410).json({ message: "Invite has expired" });
      }
      if (operator.passwordHash) {
        return res.status(409).json({ message: "Account already set up" });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      await db.update(operators).set({
        passwordHash,
        inviteToken: null,
        inviteExpiresAt: null,
        status: "ACTIVE",
        pipelineStage: "ACTIVE",
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(operators.id, operator.id));

      (req.session as any).operatorId = operator.id;

      res.json({
        id: operator.id,
        email: operator.email,
        displayName: operator.displayName,
        operatorType: operator.operatorType,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/operator/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ message: "Email and password are required" });

      const normalizedEmail = email.toLowerCase().trim();
      const [operator] = await db.select().from(operators).where(eq(operators.email, normalizedEmail));
      if (!operator || !operator.passwordHash) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const valid = await bcrypt.compare(password, operator.passwordHash);
      if (!valid) return res.status(401).json({ message: "Invalid email or password" });

      if (operator.status === "REVOKED") {
        return res.status(403).json({ message: "Your operator access has been revoked" });
      }

      await db.update(operators).set({ lastLoginAt: new Date(), updatedAt: new Date() }).where(eq(operators.id, operator.id));

      (req.session as any).operatorId = operator.id;
      (req.session as any).operatorName = operator.displayName;

      if (req.body.rememberMe) {
        req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
      } else {
        req.session.cookie.maxAge = 24 * 60 * 60 * 1000;
      }

      res.json({
        id: operator.id,
        email: operator.email,
        displayName: operator.displayName,
        operatorType: operator.operatorType,
        status: operator.status,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/operator/me", requireOperator, async (req: Request, res: Response) => {
    try {
      const operatorId = (req.session as any).operatorId;
      const [operator] = await db.select().from(operators).where(eq(operators.id, operatorId));
      if (!operator) {
        (req.session as any).operatorId = null;
        return res.status(401).json({ message: "Operator not found" });
      }

      const assignments = await db.select().from(operatorTerritories).where(eq(operatorTerritories.operatorId, operatorId));
      const territoryDetails = await Promise.all(
        assignments.map(async (a) => {
          const [t] = await db.select().from(territories).where(eq(territories.id, a.territoryId));
          return { ...a, territory: t };
        })
      );

      res.json({
        id: operator.id,
        email: operator.email,
        displayName: operator.displayName,
        operatorType: operator.operatorType,
        status: operator.status,
        territories: territoryDetails,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/operator/logout", (req: Request, res: Response) => {
    (req.session as any).operatorId = null;
    res.json({ message: "Logged out" });
  });

  app.get("/api/operator/businesses", requireOperator, async (req: Request, res: Response) => {
    try {
      const operatorId = (req.session as any).operatorId;
      const stageFilter = req.query.stage as string | undefined;
      const assignments = await db.select().from(operatorTerritories).where(eq(operatorTerritories.operatorId, operatorId));
      const territoryIds = assignments.map(a => a.territoryId);
      if (territoryIds.length === 0) return res.json({ data: [], assignedCount: 0 });

      const territoryRows = await db.select().from(territories).where(inArray(territories.id, territoryIds));
      const territoryMap = new Map(territoryRows.map(t => [t.id, t]));

      const listings = await db.select({
        listingId: territoryListings.id,
        businessId: territoryListings.businessId,
        territoryId: territoryListings.territoryId,
        businessName: businesses.name,
        businessSlug: businesses.slug,
        cityId: businesses.cityId,
        listingTier: businesses.listingTier,
        claimStatus: businesses.claimStatus,
        presenceStatus: businesses.presenceStatus,
        address: businesses.address,
        phone: businesses.phone,
        ownerEmail: businesses.ownerEmail,
        websiteUrl: businesses.websiteUrl,
      })
        .from(territoryListings)
        .innerJoin(businesses, eq(territoryListings.businessId, businesses.id))
        .where(inArray(territoryListings.territoryId, territoryIds));

      const businessIds = [...new Set(listings.map(l => l.businessId))];

      const crmRows = businessIds.length > 0
        ? await db.select().from(crmPresence).where(inArray(crmPresence.presenceId, businessIds))
        : [];
      const crmMap = new Map(crmRows.map(c => [c.presenceId, c]));

      let filteredListings = listings;
      if (stageFilter) {
        filteredListings = listings.filter(l => {
          const crm = crmMap.get(l.businessId);
          const currentStage = crm?.stage || "intake";
          return currentStage === stageFilter;
        });
      }

      const filteredBusinessIds = [...new Set(filteredListings.map(l => l.businessId))];

      let scoreMap = new Map<string, any>();
      let verificationMap = new Map<string, any>();
      let locationMap = new Map<string, any>();
      let outreachMap = new Map<string, any>();
      let tagMap = new Map<string, Array<{ tag: string; confidence: number }>>();

      if (stageFilter && filteredBusinessIds.length > 0) {
        const scoreRows = await db.select().from(entityScores).where(inArray(entityScores.entityId, filteredBusinessIds));
        scoreMap = new Map(scoreRows.map(s => [s.entityId, s]));

        const verificationRows = await db.select().from(entityContactVerification).where(inArray(entityContactVerification.entityId, filteredBusinessIds));
        verificationMap = new Map(verificationRows.map(v => [v.entityId, v]));

        const locationRows = await db.select().from(entityLocationProfile).where(inArray(entityLocationProfile.entityId, filteredBusinessIds));
        locationMap = new Map(locationRows.map(l => [l.entityId, l]));

        const outreachRows = await db.select().from(entityOutreachRecommendation).where(inArray(entityOutreachRecommendation.entityId, filteredBusinessIds));
        outreachMap = new Map(outreachRows.map(o => [o.entityId, o]));

        const tagRows = await db.select({ entityId: entityAssetTags.entityId, tag: entityAssetTags.tag, confidence: entityAssetTags.confidence }).from(entityAssetTags).where(inArray(entityAssetTags.entityId, filteredBusinessIds));
        for (const t of tagRows) {
          if (!tagMap.has(t.entityId)) tagMap.set(t.entityId, []);
          tagMap.get(t.entityId)!.push({ tag: t.tag, confidence: t.confidence });
        }
      }

      const { cities } = await import("@shared/schema");
      const cityIds = [...new Set(filteredListings.map(l => l.cityId))];
      const cityRows = cityIds.length > 0 ? await db.select({ id: cities.id, slug: cities.slug }).from(cities).where(inArray(cities.id, cityIds)) : [];
      const cityMap = new Map(cityRows.map(c => [c.id, c.slug]));

      const assignedCount = listings.filter(l => {
        const crm = crmMap.get(l.businessId);
        return (crm?.stage || "intake") === "assigned";
      }).length;

      const result = filteredListings.map(l => {
        const t = territoryMap.get(l.territoryId);
        const score = scoreMap.get(l.businessId);
        const verification = verificationMap.get(l.businessId);
        const locationProf = locationMap.get(l.businessId);
        const outreachRec = outreachMap.get(l.businessId);
        const crm = crmMap.get(l.businessId);

        return {
          id: l.businessId,
          name: l.businessName,
          slug: l.businessSlug,
          citySlug: cityMap.get(l.cityId) || null,
          listingTier: l.listingTier,
          claimStatus: l.claimStatus,
          presenceStatus: l.presenceStatus,
          address: l.address ?? null,
          phone: l.phone ?? null,
          ownerEmail: l.ownerEmail ?? null,
          websiteUrl: l.websiteUrl ?? null,
          territoryName: t?.name ?? null,
          territoryCode: t?.code ?? null,
          territoryType: t?.type ?? null,
          crmStage: crm?.stage ?? "intake",
          prospectFitScore: score?.prospectFitScore ?? null,
          contactReadyScore: score?.contactReadyScore ?? null,
          bucket: score?.bucket ?? null,
          pipelinePromotedAt: score?.pipelinePromotedAt ?? null,
          locationType: locationProf?.locationType ?? null,
          outreachMethod: outreachRec?.recommendedMethod ?? null,
          detectedPhone: verification?.detectedPhone ?? null,
          detectedEmail: verification?.detectedEmail ?? null,
          industryTags: tagMap.get(l.businessId) || [],
        };
      });

      if (stageFilter) {
        result.sort((a, b) => {
          const sa = a.prospectFitScore ?? -1;
          const sb = b.prospectFitScore ?? -1;
          if (sb !== sa) return sb - sa;
          return (a.name || "").localeCompare(b.name || "");
        });
      }

      res.json({ data: result, assignedCount });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/operator/revenue", requireOperator, async (req: Request, res: Response) => {
    try {
      const operatorId = (req.session as any).operatorId;
      const splits = await db.select().from(revenueSplits).where(eq(revenueSplits.operatorId, operatorId));
      const totalEarned = splits.reduce((sum, s) => sum + s.splitAmount, 0);
      const pending = splits.filter(s => s.status === "PENDING").reduce((sum, s) => sum + s.splitAmount, 0);
      const payable = splits.filter(s => s.status === "PAYABLE").reduce((sum, s) => sum + s.splitAmount, 0);
      const paid = splits.filter(s => s.status === "PAID").reduce((sum, s) => sum + s.splitAmount, 0);
      res.json({ totalEarned, pending, payable, paid });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/operator/revenue/splits", requireOperator, async (req: Request, res: Response) => {
    try {
      const operatorId = (req.session as any).operatorId;
      const splits = await db.select().from(revenueSplits)
        .where(eq(revenueSplits.operatorId, operatorId))
        .orderBy(desc(revenueSplits.createdAt));
      res.json(splits);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/operator/micro-operators", requireOperator, async (req: Request, res: Response) => {
    try {
      const operatorId = (req.session as any).operatorId;
      const [operator] = await db.select().from(operators).where(eq(operators.id, operatorId));
      if (!operator) return res.status(401).json({ message: "Operator not found" });
      if (operator.operatorType !== "METRO") {
        return res.status(403).json({ message: "Only METRO operators can view micro-operators" });
      }

      const assignments = await db.select().from(operatorTerritories).where(eq(operatorTerritories.operatorId, operatorId));
      const territoryIds = assignments.map(a => a.territoryId);
      if (territoryIds.length === 0) return res.json([]);

      const childTerritories = await db.select().from(territories)
        .where(inArray(territories.parentTerritoryId, territoryIds));
      const childIds = childTerritories.map(t => t.id);
      if (childIds.length === 0) return res.json([]);

      const childAssignments = await db.select({
        assignmentId: operatorTerritories.id,
        operatorId: operatorTerritories.operatorId,
        territoryId: operatorTerritories.territoryId,
        exclusivity: operatorTerritories.exclusivity,
        operatorDisplayName: operators.displayName,
        operatorEmail: operators.email,
        operatorType: operators.operatorType,
        operatorStatus: operators.status,
        territoryName: territories.name,
        territoryCode: territories.code,
        territoryType: territories.type,
      })
        .from(operatorTerritories)
        .innerJoin(operators, eq(operatorTerritories.operatorId, operators.id))
        .innerJoin(territories, eq(operatorTerritories.territoryId, territories.id))
        .where(inArray(operatorTerritories.territoryId, childIds));

      res.json(childAssignments);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/operator/activity", requireOperator, async (req: Request, res: Response) => {
    try {
      const operatorId = (req.session as any).operatorId;
      const assignments = await db.select().from(operatorTerritories).where(eq(operatorTerritories.operatorId, operatorId));
      const territoryIds = assignments.map(a => a.territoryId);
      if (territoryIds.length === 0) return res.json({ transactions: [], listings: [] });

      const recentTransactions = await db.select({
        transactionId: revenueTransactions.id,
        grossAmount: revenueTransactions.grossAmount,
        transactionType: revenueTransactions.transactionType,
        createdAt: revenueTransactions.createdAt,
        businessId: territoryListings.businessId,
        territoryId: territoryListings.territoryId,
      })
        .from(revenueTransactions)
        .innerJoin(territoryListings, eq(revenueTransactions.territoryListingId, territoryListings.id))
        .where(inArray(territoryListings.territoryId, territoryIds))
        .orderBy(desc(revenueTransactions.createdAt))
        .limit(50);

      const recentListings = await db.select()
        .from(territoryListings)
        .where(inArray(territoryListings.territoryId, territoryIds))
        .orderBy(desc(territoryListings.createdAt))
        .limit(50);

      res.json({ transactions: recentTransactions, listings: recentListings });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  async function verifyBusinessInOperatorTerritory(operatorId: string, businessId: string): Promise<boolean> {
    const assignments = await db.select().from(operatorTerritories).where(eq(operatorTerritories.operatorId, operatorId));
    const territoryIds = assignments.map(a => a.territoryId);
    if (territoryIds.length === 0) return false;

    const listing = await db.select({ id: territoryListings.id })
      .from(territoryListings)
      .where(and(
        eq(territoryListings.businessId, businessId),
        inArray(territoryListings.territoryId, territoryIds),
      ))
      .limit(1);

    return listing.length > 0;
  }

  const stageUpdateSchema = z.object({
    stage: z.enum([
      "intake", "assigned", "contacted", "engaged", "awaiting_info",
      "claimed_confirmed", "charlotte_verified", "offer_presented",
      "active", "renewal_due", "closed_lost",
    ]),
  });

  app.patch("/api/operator/businesses/:id/stage", requireOperator, async (req: Request, res: Response) => {
    try {
      const operatorId = (req.session as any).operatorId;
      const businessId = req.params.id;

      const inTerritory = await verifyBusinessInOperatorTerritory(operatorId, businessId);
      if (!inTerritory) {
        return res.status(403).json({ message: "Business is not in your territory" });
      }

      const parsed = stageUpdateSchema.parse(req.body);

      const existing = await db.select().from(crmPresence).where(eq(crmPresence.presenceId, businessId));

      if (existing.length === 0) {
        const [row] = await db.insert(crmPresence).values({
          presenceId: businessId,
          stage: parsed.stage,
        }).returning();

        await logPresenceFieldChange(
          { presenceId: businessId, actorType: "operator", actorUserId: operatorId },
          "crm_stage", "intake", parsed.stage,
        );

        return res.json(row);
      }

      const oldStage = existing[0].stage;
      const [row] = await db.update(crmPresence)
        .set({ stage: parsed.stage, updatedAt: new Date() })
        .where(eq(crmPresence.presenceId, businessId))
        .returning();

      if (oldStage !== parsed.stage) {
        await logPresenceFieldChange(
          { presenceId: businessId, actorType: "operator", actorUserId: operatorId },
          "crm_stage", oldStage, parsed.stage,
        );
      }

      res.json(row);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: err.errors });
      res.status(500).json({ message: err.message });
    }
  });

  const noteSchema = z.object({
    activityType: z.enum(["call", "email", "visit", "note"]),
    notes: z.string().min(1),
  });

  app.post("/api/operator/businesses/:id/notes", requireOperator, async (req: Request, res: Response) => {
    try {
      const operatorId = (req.session as any).operatorId;
      const businessId = req.params.id;

      const inTerritory = await verifyBusinessInOperatorTerritory(operatorId, businessId);
      if (!inTerritory) {
        return res.status(403).json({ message: "Business is not in your territory" });
      }

      const parsed = noteSchema.parse(req.body);

      const [row] = await db.insert(crmActivity).values({
        presenceId: businessId,
        activityType: parsed.activityType,
        notes: parsed.notes,
        createdByUserId: null,
      }).returning();

      await logPresenceFieldChange(
        { presenceId: businessId, actorType: "operator", actorUserId: operatorId, reason: `${parsed.activityType}: ${parsed.notes.substring(0, 200)}` },
        "crm_activity_added", null, parsed.activityType,
      );

      res.json(row);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: err.errors });
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/operator/businesses/:id/activity", requireOperator, async (req: Request, res: Response) => {
    try {
      const operatorId = (req.session as any).operatorId;
      const businessId = req.params.id;

      const inTerritory = await verifyBusinessInOperatorTerritory(operatorId, businessId);
      if (!inTerritory) {
        return res.status(403).json({ message: "Business is not in your territory" });
      }

      const activities = await db.select().from(crmActivity)
        .where(eq(crmActivity.presenceId, businessId))
        .orderBy(desc(crmActivity.createdAt));

      const auditTrail = await db.select().from(presenceAuditLog)
        .where(eq(presenceAuditLog.presenceId, businessId))
        .orderBy(desc(presenceAuditLog.changedAt));

      const [crm] = await db.select().from(crmPresence).where(eq(crmPresence.presenceId, businessId));

      res.json({
        crm: crm || null,
        activities,
        auditTrail,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  const OPERATOR_DAILY_IMPORT_LIMIT = 5;

  app.post("/api/operator/places/import", requireOperator, async (req: Request, res: Response) => {
    try {
      const operatorId = (req.session as any).operatorId;

      const assignments = await db.select().from(operatorTerritories).where(eq(operatorTerritories.operatorId, operatorId));
      const territoryIds = assignments.map(a => a.territoryId);
      if (territoryIds.length === 0) return res.status(403).json({ message: "No territories assigned" });

      const territoryRows = await db.select().from(territories).where(inArray(territories.id, territoryIds));

      const allGeoCodes = territoryRows.flatMap(t => (t.geoCodes as string[]) || []);
      if (allGeoCodes.length === 0) return res.status(400).json({ message: "Your territories have no geo codes (ZIP codes) configured" });

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayJobs = await db.select().from(placeImportJobs)
        .where(and(
          eq(placeImportJobs.createdByUserId, `operator:${operatorId}`),
          gte(placeImportJobs.createdAt, todayStart)
        ));
      if (todayJobs.length >= OPERATOR_DAILY_IMPORT_LIMIT) {
        return res.status(429).json({ message: `Daily import limit reached (${OPERATOR_DAILY_IMPORT_LIMIT} per day). Try again tomorrow.` });
      }

      const schema = z.object({
        queryText: z.string().min(1, "Search query is required"),
        zipCode: z.string().optional(),
        requestedCount: z.number().min(1).max(60).default(20),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });

      const data = parsed.data;

      let targetZip = data.zipCode;
      if (targetZip && !allGeoCodes.includes(targetZip)) {
        return res.status(403).json({ message: `ZIP ${targetZip} is not in your territory` });
      }
      if (!targetZip) {
        targetZip = allGeoCodes[0];
      }

      const zipGeo = await storage.getZipGeo(targetZip);
      let resolvedLat: string | null = null;
      let resolvedLng: string | null = null;
      let resolvedRadius = 5000;
      let resolvedAreaLabel = `Operator ZIP ${targetZip}`;

      if (zipGeo) {
        resolvedLat = zipGeo.lat;
        resolvedLng = zipGeo.lng;
        resolvedRadius = zipGeo.radiusMeters;
      }

      const matchedTerritory = territoryRows.find(t =>
        ((t.geoCodes as string[]) || []).includes(targetZip!)
      );

      const queryWithLocation = `${data.queryText} near ${targetZip}`;

      const job = await storage.createPlaceImportJob({
        createdByUserId: `operator:${operatorId}`,
        mode: "text_search",
        areaMode: "zip",
        hubRegionId: null,
        zipCode: targetZip,
        queryText: queryWithLocation,
        categoryKeyword: null,
        centerLat: resolvedLat,
        centerLng: resolvedLng,
        radiusMeters: resolvedRadius,
        resolvedAreaLabel,
        requestedCount: data.requestedCount,
        status: "queued",
        importedCount: 0,
      });

      const territoryIdForAssignment = matchedTerritory?.id || territoryIds[0];

      runImportJob(job.id)
        .then(async (summary: ImportSummary) => {
          console.log(`[Operator Places Import] Job ${job.id} completed for operator ${operatorId}:`, JSON.stringify(summary));
          try {
            const results = await storage.getPlaceImportResults(job.id);
            for (const result of results) {
              if ((result as any).status === "presence_created" && (result as any).createdPresenceId) {
                try {
                  await storage.createTerritoryListing({
                    businessId: (result as any).createdPresenceId,
                    territoryId: territoryIdForAssignment,
                    stripeSubscriptionId: null,
                  });
                } catch (tlErr: any) {
                  console.error(`[Operator Places Import] Failed to assign business ${(result as any).createdPresenceId} to territory:`, tlErr.message);
                }
              }
            }
          } catch (assignErr: any) {
            console.error(`[Operator Places Import] Territory assignment error for job ${job.id}:`, assignErr.message);
          }
        })
        .catch((err) => {
          console.error(`[Operator Places Import] Job ${job.id} failed:`, err.message);
        });

      res.status(201).json({
        ...job,
        availableGeoCodes: allGeoCodes,
        remainingImportsToday: OPERATOR_DAILY_IMPORT_LIMIT - todayJobs.length - 1,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/operator/places/jobs", requireOperator, async (req: Request, res: Response) => {
    try {
      const operatorId = (req.session as any).operatorId;
      const jobs = await db.select().from(placeImportJobs)
        .where(eq(placeImportJobs.createdByUserId, `operator:${operatorId}`))
        .orderBy(desc(placeImportJobs.createdAt))
        .limit(50);

      const usage = getDailyUsage();

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayCount = jobs.filter(j => j.createdAt >= todayStart).length;

      res.json({
        jobs,
        usage,
        remainingImportsToday: Math.max(0, OPERATOR_DAILY_IMPORT_LIMIT - todayCount),
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/operator/places/geo-codes", requireOperator, async (req: Request, res: Response) => {
    try {
      const operatorId = (req.session as any).operatorId;
      const assignments = await db.select().from(operatorTerritories).where(eq(operatorTerritories.operatorId, operatorId));
      const territoryIds = assignments.map(a => a.territoryId);
      if (territoryIds.length === 0) return res.json({ geoCodes: [], territories: [] });

      const territoryRows = await db.select().from(territories).where(inArray(territories.id, territoryIds));
      const allGeoCodes = [...new Set(territoryRows.flatMap(t => (t.geoCodes as string[]) || []))];

      res.json({
        geoCodes: allGeoCodes,
        territories: territoryRows.map(t => ({
          id: t.id,
          name: t.name,
          code: t.code,
          geoCodes: t.geoCodes,
        })),
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  const OPERATOR_DAILY_EMAIL_LIMIT = 20;

  app.get("/api/operator/outreach/templates", requireOperator, async (req: Request, res: Response) => {
    try {
      const templates = await storage.getEmailTemplates({ status: "active" });
      const outreachTemplates = templates.filter(
        t => t.templateKey === "prospecting" || t.templateKey === "claim_invite"
      );
      res.json(outreachTemplates);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  const outreachSendSchema = z.object({
    businessId: z.string().min(1),
    templateId: z.string().optional(),
    subject: z.string().min(1),
    body: z.string().min(1),
    recipientEmail: z.string().email(),
  });

  app.post("/api/operator/outreach/send", requireOperator, async (req: Request, res: Response) => {
    try {
      const operatorId = (req.session as any).operatorId;

      const parsed = outreachSendSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
      }

      const { businessId, templateId, subject, body, recipientEmail } = parsed.data;

      const inTerritory = await verifyBusinessInOperatorTerritory(operatorId, businessId);
      if (!inTerritory) {
        return res.status(403).json({ message: "Business is not in your territory" });
      }

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todaySent = await db.select({ id: commsLog.id })
        .from(commsLog)
        .where(and(
          eq(commsLog.operatorId, operatorId),
          eq(commsLog.channel, "EMAIL"),
          gte(commsLog.createdAt, todayStart),
        ));

      if (todaySent.length >= OPERATOR_DAILY_EMAIL_LIMIT) {
        return res.status(429).json({
          message: `Daily email limit reached (${OPERATOR_DAILY_EMAIL_LIMIT} per day). Try again tomorrow.`,
          dailySent: todaySent.length,
          dailyLimit: OPERATOR_DAILY_EMAIL_LIMIT,
        });
      }

      const assignments = await db.select().from(operatorTerritories).where(eq(operatorTerritories.operatorId, operatorId));
      const territoryId = assignments[0]?.territoryId;

      let finalSubject = subject;
      let finalBody = body;

      const [business] = await db.select().from(businesses).where(eq(businesses.id, businessId));
      if (business) {
        const mergeTags: Record<string, string> = {
          businessName: business.name || "",
          businessAddress: business.address || "",
          businessPhone: business.phone || "",
          businessEmail: business.ownerEmail || "",
        };
        for (const [key, value] of Object.entries(mergeTags)) {
          const tag = `{{${key}}}`;
          finalSubject = finalSubject.replaceAll(tag, value);
          finalBody = finalBody.replaceAll(tag, value);
        }
      }

      const htmlBody = `
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          ${finalBody}
        </div>
      `;

      const emailResult = await sendTerritoryEmail({
        to: recipientEmail,
        subject: finalSubject,
        html: htmlBody,
        territoryId: territoryId || undefined,
        operatorId,
        metadata: {
          type: "operator_outreach",
          operatorId,
          businessId,
          templateId: templateId || null,
        },
      });

      if (emailResult.success) {
        res.json({
          success: true,
          messageId: emailResult.messageId,
          dailySent: todaySent.length + 1,
          dailyLimit: OPERATOR_DAILY_EMAIL_LIMIT,
        });
      } else {
        res.status(500).json({
          message: "Failed to send email",
          error: emailResult.error,
        });
      }
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: err.errors });
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/operator/outreach/daily-count", requireOperator, async (req: Request, res: Response) => {
    try {
      const operatorId = (req.session as any).operatorId;
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todaySent = await db.select({ id: commsLog.id })
        .from(commsLog)
        .where(and(
          eq(commsLog.operatorId, operatorId),
          eq(commsLog.channel, "EMAIL"),
          gte(commsLog.createdAt, todayStart),
        ));
      res.json({
        dailySent: todaySent.length,
        dailyLimit: OPERATOR_DAILY_EMAIL_LIMIT,
        remaining: Math.max(0, OPERATOR_DAILY_EMAIL_LIMIT - todaySent.length),
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/operator/comms-log", requireOperator, async (req: Request, res: Response) => {
    try {
      const operatorId = (req.session as any).operatorId;
      const assignments = await db.select({ territoryId: operatorTerritories.territoryId })
        .from(operatorTerritories).where(eq(operatorTerritories.operatorId, operatorId));
      const territoryIds = assignments.map(a => a.territoryId);

      if (territoryIds.length === 0) return res.json([]);

      const { channel, limit: limitStr, offset: offsetStr } = req.query;
      const pageLimit = Math.min(parseInt(limitStr as string) || 50, 100);
      const pageOffset = parseInt(offsetStr as string) || 0;

      const conditions: any[] = [inArray(commsLog.territoryId, territoryIds)];
      if (channel && channel !== "ALL") {
        conditions.push(eq(commsLog.channel, channel as any));
      }

      const results = await db.select().from(commsLog)
        .where(and(...conditions))
        .orderBy(desc(commsLog.createdAt))
        .limit(pageLimit)
        .offset(pageOffset);

      res.json(results);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/operator/businesses/scored", requireOperator, async (req: Request, res: Response) => {
    try {
      const operatorId = (req.session as any).operatorId;
      const assignments = await db.select().from(operatorTerritories).where(eq(operatorTerritories.operatorId, operatorId));
      const territoryIds = assignments.map(a => a.territoryId);
      if (territoryIds.length === 0) return res.json([]);

      const territoryRows = await db.select().from(territories).where(inArray(territories.id, territoryIds));
      const territoryMap = new Map(territoryRows.map(t => [t.id, t]));

      const listings = await db.select({
        listingId: territoryListings.id,
        businessId: territoryListings.businessId,
        territoryId: territoryListings.territoryId,
      })
        .from(territoryListings)
        .where(inArray(territoryListings.territoryId, territoryIds));

      if (listings.length === 0) return res.json([]);

      const businessIds = [...new Set(listings.map(l => l.businessId))];
      const bizTerritoryMap = new Map(listings.map(l => [l.businessId, l.territoryId]));

      const bizRows = await db.select().from(businesses).where(inArray(businesses.id, businessIds));

      const scoreRows = await db.select().from(entityScores).where(inArray(entityScores.entityId, businessIds));
      const scoreMap = new Map(scoreRows.map(s => [s.entityId, s]));

      const verificationRows = await db.select().from(entityContactVerification).where(inArray(entityContactVerification.entityId, businessIds));
      const verificationMap = new Map(verificationRows.map(v => [v.entityId, v]));

      const locationRows = await db.select().from(entityLocationProfile).where(inArray(entityLocationProfile.entityId, businessIds));
      const locationMap = new Map(locationRows.map(l => [l.entityId, l]));

      const outreachRows = await db.select().from(entityOutreachRecommendation).where(inArray(entityOutreachRecommendation.entityId, businessIds));
      const outreachMap = new Map(outreachRows.map(o => [o.entityId, o]));

      const tagRows = await db.select({ entityId: entityAssetTags.entityId, tag: entityAssetTags.tag, confidence: entityAssetTags.confidence }).from(entityAssetTags).where(inArray(entityAssetTags.entityId, businessIds));
      const tagMap = new Map<string, Array<{ tag: string; confidence: number }>>();
      for (const t of tagRows) {
        if (!tagMap.has(t.entityId)) tagMap.set(t.entityId, []);
        tagMap.get(t.entityId)!.push({ tag: t.tag, confidence: t.confidence });
      }

      const { cities } = await import("@shared/schema");
      const cityIds = [...new Set(bizRows.map(b => b.cityId))];
      const cityRows = cityIds.length > 0 ? await db.select({ id: cities.id, slug: cities.slug }).from(cities).where(inArray(cities.id, cityIds)) : [];
      const cityMap = new Map(cityRows.map(c => [c.id, c.slug]));

      const result = bizRows.map(b => {
        const tId = bizTerritoryMap.get(b.id);
        const t = tId ? territoryMap.get(tId) : null;
        const score = scoreMap.get(b.id);
        const verification = verificationMap.get(b.id);
        const locationProf = locationMap.get(b.id);
        const outreachRec = outreachMap.get(b.id);

        const hasPhone = !!(b.phone || verification?.detectedPhone);
        const hasEmail = !!(b.ownerEmail || verification?.detectedEmail);
        const hasContactForm = !!verification?.detectedContactFormUrl;
        const hasWebsite = !!b.websiteUrl;
        const hasAddress = !!b.address;

        let recommendedContactStrategy = "VERIFY_LATER";
        if (outreachRec?.recommendedMethod && outreachRec.recommendedMethod !== "UNKNOWN") {
          recommendedContactStrategy = outreachRec.recommendedMethod;
        } else {
          if (hasPhone && hasAddress) recommendedContactStrategy = "PHONE_FIRST";
          else if (hasContactForm) recommendedContactStrategy = "WEBSITE_FORM";
          else if (hasAddress && !hasPhone && !hasEmail) recommendedContactStrategy = "WALK_IN";
          else if (hasEmail) recommendedContactStrategy = "MAILER";
          else {
            const socialJson = verification?.detectedSocialJson as Record<string, string> | null;
            const bizSocial = b.socialLinks as Record<string, string> | null;
            if ((socialJson && Object.keys(socialJson).length > 0) || (bizSocial && Object.keys(bizSocial).length > 0)) {
              recommendedContactStrategy = "SOCIAL_DM";
            } else if (hasAddress) {
              recommendedContactStrategy = "MAILER";
            }
          }
        }

        return {
          id: b.id,
          name: b.name,
          slug: b.slug,
          citySlug: cityMap.get(b.cityId) || null,
          address: b.address,
          phone: b.phone,
          ownerEmail: b.ownerEmail,
          websiteUrl: b.websiteUrl,
          listingTier: b.listingTier,
          claimStatus: b.claimStatus,
          presenceStatus: b.presenceStatus,
          territoryName: t?.name ?? null,
          territoryCode: t?.code ?? null,
          territoryType: t?.type ?? null,
          contactReadyScore: score?.contactReadyScore ?? null,
          dataQualityScore: score?.dataQualityScore ?? null,
          prospectFitScore: score?.prospectFitScore ?? null,
          bucket: score?.bucket ?? null,
          reasonsJson: score?.reasonsJson ?? null,
          hasPhone,
          hasEmail,
          hasContactForm,
          hasWebsite,
          hasAddress,
          detectedPhone: verification?.detectedPhone ?? null,
          detectedEmail: verification?.detectedEmail ?? null,
          detectedContactFormUrl: verification?.detectedContactFormUrl ?? null,
          crawlStatus: verification?.crawlStatus ?? null,
          confidenceScore: verification?.confidenceScore ?? null,
          recommendedContactStrategy,
          locationType: locationProf?.locationType ?? null,
          locationConfidence: locationProf?.confidenceScore ?? null,
          outreachMethod: outreachRec?.recommendedMethod ?? null,
          methodRankJson: outreachRec?.methodRankJson ?? null,
          industryTags: tagMap.get(b.id) || [],
        };
      });

      result.sort((a, b) => {
        const sa = a.prospectFitScore ?? -1;
        const sb = b.prospectFitScore ?? -1;
        if (sb !== sa) return sb - sa;
        return (a.name || "").localeCompare(b.name || "");
      });

      const pageLimit = Math.min(parseInt(req.query.limit as string) || 100, 100);
      const pageOffset = parseInt(req.query.offset as string) || 0;
      const paged = result.slice(pageOffset, pageOffset + pageLimit);

      res.json({ data: paged, total: result.length });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/operator/sales-pipeline", requireOperator, async (req: Request, res: Response) => {
    try {
      const operatorId = (req.session as any).operatorId;
      const assignments = await db.select().from(operatorTerritories).where(eq(operatorTerritories.operatorId, operatorId));
      const territoryIds = assignments.map(a => a.territoryId);
      if (territoryIds.length === 0) return res.json({ buckets: {}, counts: {} });

      const listings = await db.select({ businessId: territoryListings.businessId })
        .from(territoryListings)
        .where(inArray(territoryListings.territoryId, territoryIds));

      if (listings.length === 0) return res.json({ buckets: {}, counts: {} });

      const businessIds = [...new Set(listings.map(l => l.businessId))];

      const bucketRows = await db.execute(sql`
        SELECT
          esb.entity_id, esb.bucket, esb.priority_score, esb.reasons_json,
          b.name, b.phone, b.owner_email, b.website_url, b.address,
          b.claim_status, b.presence_status, b.listing_tier,
          ecv.detected_phone, ecv.detected_email, ecv.detected_contact_form_url, ecv.crawl_status,
          eor.recommended_method,
          es.prospect_fit_score, es.contact_ready_score,
          elp.location_type,
          (SELECT string_agg(eat.tag, ', ') FROM entity_asset_tags eat WHERE eat.entity_id = esb.entity_id) as industry_tags
        FROM entity_sales_buckets esb
        JOIN businesses b ON b.id = esb.entity_id
        LEFT JOIN entity_contact_verification ecv ON ecv.entity_id = esb.entity_id
        LEFT JOIN entity_outreach_recommendation eor ON eor.entity_id = esb.entity_id
        LEFT JOIN entity_scores es ON es.entity_id = esb.entity_id
        LEFT JOIN entity_location_profile elp ON elp.entity_id = esb.entity_id
        WHERE esb.entity_id = ANY(${businessIds})
        ORDER BY esb.priority_score DESC
      `);
      const rows = (bucketRows as any).rows ?? bucketRows;

      const bucketMap: Record<string, any[]> = {};
      for (const row of rows) {
        const bucket = row.bucket;
        if (!bucketMap[bucket]) bucketMap[bucket] = [];
        if (bucketMap[bucket].length < 25) {
          bucketMap[bucket].push({
            entityId: row.entity_id,
            name: row.name,
            phone: row.phone,
            ownerEmail: row.owner_email,
            websiteUrl: row.website_url,
            address: row.address,
            claimStatus: row.claim_status,
            presenceStatus: row.presence_status,
            listingTier: row.listing_tier,
            priorityScore: row.priority_score,
            reasonsJson: row.reasons_json,
            detectedPhone: row.detected_phone,
            detectedEmail: row.detected_email,
            detectedContactFormUrl: row.detected_contact_form_url,
            crawlStatus: row.crawl_status,
            recommendedMethod: row.recommended_method,
            prospectFitScore: row.prospect_fit_score,
            contactReadyScore: row.contact_ready_score,
            locationType: row.location_type,
            industryTags: row.industry_tags,
          });
        }
      }

      const bucketCounts: Record<string, number> = {};
      for (const row of rows) {
        bucketCounts[row.bucket] = (bucketCounts[row.bucket] || 0) + 1;
      }

      res.json({ buckets: bucketMap, counts: bucketCounts });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  async function getOperatorHubData(operatorId: string) {
    const assignments = await db.select().from(operatorTerritories).where(eq(operatorTerritories.operatorId, operatorId));
    const territoryIds = assignments.map(a => a.territoryId);
    if (territoryIds.length === 0) return { hubs: [], territoryIds: [], territoryMap: new Map() };

    const territoryRows = await db.select().from(territories).where(inArray(territories.id, territoryIds));
    const codes = territoryRows.map(t => t.code).filter(Boolean) as string[];

    let hubRegions: any[] = [];
    if (codes.length > 0) {
      hubRegions = await db.select().from(regions).where(and(eq(regions.regionType, "hub"), inArray(regions.code, codes)));
    }

    const hubMap = new Map(hubRegions.map(r => [r.code, r]));
    const territoryMap = new Map(territoryRows.map(t => [t.id, t]));

    const listings = await db.select({ territoryId: territoryListings.territoryId, businessId: territoryListings.businessId })
      .from(territoryListings).where(inArray(territoryListings.territoryId, territoryIds));
    const bizCountByTerritory = new Map<string, number>();
    for (const l of listings) {
      bizCountByTerritory.set(l.territoryId, (bizCountByTerritory.get(l.territoryId) || 0) + 1);
    }

    const hubs = territoryRows.map(t => {
      const region = t.code ? hubMap.get(t.code) : null;
      return {
        territoryId: t.id,
        territoryName: t.name,
        territoryCode: t.code,
        regionId: region?.id || null,
        regionName: region?.name || t.name,
        businessCount: bizCountByTerritory.get(t.id) || 0,
      };
    });

    return { hubs, territoryIds, territoryMap };
  }

  app.get("/api/operator/hubs", requireOperator, async (req: Request, res: Response) => {
    try {
      const operatorId = (req.session as any).operatorId;
      const { hubs } = await getOperatorHubData(operatorId);
      res.json(hubs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/operator/hub-business-stats", requireOperator, async (req: Request, res: Response) => {
    try {
      const operatorId = (req.session as any).operatorId;
      const selectedTerritoryId = req.query.territoryId as string | undefined;

      const assignments = await db.select().from(operatorTerritories).where(eq(operatorTerritories.operatorId, operatorId));
      let territoryIds = assignments.map(a => a.territoryId);
      if (selectedTerritoryId && territoryIds.includes(selectedTerritoryId)) {
        territoryIds = [selectedTerritoryId];
      }
      if (territoryIds.length === 0) return res.json({ total: 0, byTier: {}, health: {} });

      const listings = await db.select({
        businessId: territoryListings.businessId,
        listingTier: businesses.listingTier,
        claimStatus: businesses.claimStatus,
        imageUrl: businesses.imageUrl,
        createdAt: businesses.createdAt,
      }).from(territoryListings)
        .innerJoin(businesses, eq(territoryListings.businessId, businesses.id))
        .where(inArray(territoryListings.territoryId, territoryIds));

      const uniqueBiz = new Map<string, any>();
      for (const l of listings) {
        if (!uniqueBiz.has(l.businessId)) uniqueBiz.set(l.businessId, l);
      }
      const bizList = [...uniqueBiz.values()];

      const byTier: Record<string, number> = {};
      let unclaimed = 0, noPhoto = 0, recentCount = 0;
      const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      for (const b of bizList) {
        const tier = b.listingTier || "FREE";
        byTier[tier] = (byTier[tier] || 0) + 1;
        if (b.claimStatus !== "CLAIMED") unclaimed++;
        if (!b.imageUrl) noPhoto++;
        if (b.createdAt && new Date(b.createdAt) > thirtyDaysAgo) recentCount++;
      }

      res.json({
        total: bizList.length,
        byTier,
        health: { unclaimed, noPhoto, recentAdditions: recentCount },
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/operator/events", requireOperator, async (req: Request, res: Response) => {
    try {
      const operatorId = (req.session as any).operatorId;
      const selectedTerritoryId = req.query.territoryId as string | undefined;

      const assignments = await db.select().from(operatorTerritories).where(eq(operatorTerritories.operatorId, operatorId));
      let territoryIds = assignments.map(a => a.territoryId);
      if (selectedTerritoryId && territoryIds.includes(selectedTerritoryId)) {
        territoryIds = [selectedTerritoryId];
      }
      if (territoryIds.length === 0) return res.json([]);

      const territoryRows = await db.select().from(territories).where(inArray(territories.id, territoryIds));
      const allGeoCodes = territoryRows.flatMap(t => (t.geoCodes as string[]) || []);

      const allEvents = await db.select().from(events)
        .where(gte(events.startDateTime, new Date()))
        .orderBy(events.startDateTime)
        .limit(100);

      const filtered = allEvents.filter(e => {
        if (!e.zip) return false;
        return allGeoCodes.includes(e.zip);
      });

      res.json(filtered);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/operator/events", requireOperator, async (req: Request, res: Response) => {
    try {
      const operatorId = (req.session as any).operatorId;
      const { title, description, startDate, endDate, location, zip, cityId } = req.body;

      if (!title || !startDate) return res.status(400).json({ message: "Title and start date are required" });

      const assignments = await db.select().from(operatorTerritories).where(eq(operatorTerritories.operatorId, operatorId));
      const territoryIds = assignments.map(a => a.territoryId);
      if (territoryIds.length === 0) return res.status(403).json({ message: "No territories assigned" });

      const territoryRows = await db.select().from(territories).where(inArray(territories.id, territoryIds));
      const allGeoCodes = territoryRows.flatMap(t => (t.geoCodes as string[]) || []);
      if (zip && !allGeoCodes.includes(zip)) {
        return res.status(403).json({ message: "ZIP code is outside your territory" });
      }

      const codes = territoryRows.map(t => t.code).filter(Boolean) as string[];
      let hubRegionId: string | null = null;
      if (codes.length > 0) {
        const [hubRegion] = await db.select({ id: regions.id }).from(regions)
          .where(and(eq(regions.regionType, "hub"), inArray(regions.code, codes)));
        hubRegionId = hubRegion?.id || null;
      }

      const allCities = await storage.getAllCities();
      const resolvedCityId = cityId || allCities[0]?.id || "";

      const evtSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now();
      const [created] = await db.insert(events).values({
        title,
        slug: evtSlug,
        description: description || null,
        startDateTime: new Date(startDate),
        endDateTime: endDate ? new Date(endDate) : null,
        locationName: location || null,
        zip: zip || (allGeoCodes.length > 0 ? allGeoCodes[0] : null),
        cityId: resolvedCityId,
        zoneId: hubRegionId || "",
      }).returning();

      if (created) {
        geoTagAndClassify("event", created.id, resolvedCityId, {
          title,
          description: description || null,
          address: location || null,
          zip: zip || null,
          venue: location || null,
        }, { existingZoneId: hubRegionId || undefined }).catch(err => console.error("[GeoTagger] Operator event tag failed:", err.message));
        queueTranslation("event", created.id);
      }

      res.json(created);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/operator/articles", requireOperator, async (req: Request, res: Response) => {
    try {
      const operatorId = (req.session as any).operatorId;
      const selectedTerritoryId = req.query.territoryId as string | undefined;

      const assignments = await db.select().from(operatorTerritories).where(eq(operatorTerritories.operatorId, operatorId));
      let territoryIds = assignments.map(a => a.territoryId);
      if (selectedTerritoryId && territoryIds.includes(selectedTerritoryId)) {
        territoryIds = [selectedTerritoryId];
      }

      const territoryRows = await db.select().from(territories).where(inArray(territories.id, territoryIds));
      const codes = territoryRows.map(t => t.code).filter(Boolean) as string[];
      let hubRegionIds: string[] = [];
      if (codes.length > 0) {
        const hubRegions = await db.select({ id: regions.id }).from(regions)
          .where(and(eq(regions.regionType, "hub"), inArray(regions.code, codes)));
        hubRegionIds = hubRegions.map(r => r.id);
      }

      const allArticles = await db.select().from(articles).orderBy(desc(articles.createdAt)).limit(100);
      const filtered = allArticles.filter(a => {
        if (hubRegionIds.length === 0) return false;
        if (a.zoneId && hubRegionIds.includes(a.zoneId)) return true;
        return false;
      });

      res.json(filtered);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/operator/articles", requireOperator, async (req: Request, res: Response) => {
    try {
      const operatorId = (req.session as any).operatorId;
      const { title, body } = req.body;
      if (!title || !body) return res.status(400).json({ message: "Title and body are required" });

      const assignments = await db.select().from(operatorTerritories).where(eq(operatorTerritories.operatorId, operatorId));
      const territoryIds = assignments.map(a => a.territoryId);
      if (territoryIds.length === 0) return res.status(403).json({ message: "No territories assigned" });

      const territoryRows = await db.select().from(territories).where(inArray(territories.id, territoryIds));
      const codes = territoryRows.map(t => t.code).filter(Boolean) as string[];
      let hubRegionId: string | null = null;
      if (codes.length > 0) {
        const [hubRegion] = await db.select({ id: regions.id }).from(regions)
          .where(and(eq(regions.regionType, "hub"), inArray(regions.code, codes)));
        hubRegionId = hubRegion?.id || null;
      }

      const allCities = await storage.getAllCities();
      const cityId = allCities[0]?.id || "";

      const artSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now();
      const [created] = await db.insert(articles).values({
        title,
        slug: artSlug,
        content: body,
        cityId,
        zoneId: hubRegionId,
        publishedAt: null,
      }).returning();

      if (created) {
        geoTagAndClassify("article", created.id, cityId, {
          title,
          description: body || null,
        }, { existingZoneId: hubRegionId || undefined }).catch(err => console.error("[GeoTagger] Operator article tag failed:", err.message));
        queueTranslation("article", created.id);
      }

      res.json(created);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/operator/ads", requireOperator, async (req: Request, res: Response) => {
    try {
      const operatorId = (req.session as any).operatorId;
      const selectedTerritoryId = req.query.territoryId as string | undefined;

      const assignments = await db.select().from(operatorTerritories).where(eq(operatorTerritories.operatorId, operatorId));
      let territoryIds = assignments.map(a => a.territoryId);
      if (selectedTerritoryId && territoryIds.includes(selectedTerritoryId)) {
        territoryIds = [selectedTerritoryId];
      }

      const territoryRows = await db.select().from(territories).where(inArray(territories.id, territoryIds));
      const codes = territoryRows.map(t => t.code).filter(Boolean) as string[];
      let hubRegionIds: string[] = [];
      if (codes.length > 0) {
        const hubRegions = await db.select({ id: regions.id }).from(regions)
          .where(and(eq(regions.regionType, "hub"), inArray(regions.code, codes)));
        hubRegionIds = hubRegions.map(r => r.id);
      }

      const slots = hubRegionIds.length > 0
        ? await db.select().from(adInventorySlots).where(inArray(adInventorySlots.hubId, hubRegionIds))
        : [];

      const slotIds = slots.map(s => s.id);
      const placements = slotIds.length > 0
        ? await db.select().from(adPlacements).where(inArray(adPlacements.slotId, slotIds))
        : [];

      res.json({ placements, slots });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/operator/analytics", requireOperator, async (req: Request, res: Response) => {
    try {
      const operatorId = (req.session as any).operatorId;
      const selectedTerritoryId = req.query.territoryId as string | undefined;

      const assignments = await db.select().from(operatorTerritories).where(eq(operatorTerritories.operatorId, operatorId));
      let territoryIds = assignments.map(a => a.territoryId);
      if (selectedTerritoryId && territoryIds.includes(selectedTerritoryId)) {
        territoryIds = [selectedTerritoryId];
      }
      if (territoryIds.length === 0) return res.json({});

      const listings = await db.select({
        businessId: territoryListings.businessId,
        listingTier: businesses.listingTier,
        claimStatus: businesses.claimStatus,
        createdAt: businesses.createdAt,
      }).from(territoryListings)
        .innerJoin(businesses, eq(territoryListings.businessId, businesses.id))
        .where(inArray(territoryListings.territoryId, territoryIds));

      const uniqueBiz = new Map<string, any>();
      for (const l of listings) {
        if (!uniqueBiz.has(l.businessId)) uniqueBiz.set(l.businessId, l);
      }
      const bizList = [...uniqueBiz.values()];

      const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const newThisMonth = bizList.filter(b => b.createdAt && new Date(b.createdAt) > thirtyDaysAgo).length;
      const paidTiers = bizList.filter(b => b.listingTier && b.listingTier !== "FREE" && b.listingTier !== "VERIFIED").length;

      const splits = await db.select().from(revenueSplits).where(eq(revenueSplits.operatorId, operatorId));
      const totalRevenue = splits.reduce((sum, s) => sum + (s.splitAmount || 0), 0);
      const thisMonthRevenue = splits.filter(s => s.createdAt && new Date(s.createdAt) > thirtyDaysAgo)
        .reduce((sum, s) => sum + (s.splitAmount || 0), 0);

      const businessIds = [...uniqueBiz.keys()];
      let crmStats = { intake: 0, contacted: 0, engaged: 0, active: 0, total: 0 };
      if (businessIds.length > 0) {
        const crmRows = await db.select().from(crmPresence).where(inArray(crmPresence.presenceId, businessIds));
        for (const c of crmRows) {
          const stage = c.stage || "intake";
          if (stage in crmStats) (crmStats as any)[stage]++;
          crmStats.total++;
        }
      }

      const territoryRows = await db.select().from(territories).where(inArray(territories.id, territoryIds));
      const allGeoCodes = territoryRows.flatMap(t => (t.geoCodes as string[]) || []);
      const eventCount = allGeoCodes.length > 0
        ? (await db.select({ count: sql<number>`count(*)` }).from(events)
            .where(and(gte(events.startDateTime, new Date()), sql`${events.zip} = ANY(${sql`ARRAY[${sql.raw(allGeoCodes.map(c => `'${c}'`).join(","))}]`})`)))[0]?.count || 0
        : 0;

      res.json({
        businesses: { total: bizList.length, newThisMonth, paidTiers },
        revenue: { totalCents: totalRevenue, thisMonthCents: thisMonthRevenue },
        pipeline: crmStats,
        content: { events: Number(eventCount) },
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
