import type { Express, Request, Response, NextFunction } from "express";
import { db, pool } from "./db";
import { z } from "zod";
import crypto from "crypto";
import {
  giveaways, giveawayPrizes, giveawaySponsors, giveawayEntries,
  giveawayBonusActions, giveawayBonusCompletions, giveawayDraws,
  giveawayWinners, giveawayNotifications, giveawayAnalytics, cities,
  insertGiveawaySchema, insertGiveawayPrizeSchema, insertGiveawaySponsorSchema,
  insertGiveawayEntrySchema, insertGiveawayBonusActionSchema,
} from "@shared/schema";
import { eq, and, desc, asc, sql, count, inArray } from "drizzle-orm";
import { sendTerritoryEmail } from "./services/territory-email";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function seededShuffle<T>(arr: T[], seed: string): T[] {
  const result = [...arr];
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  for (let i = result.length - 1; i > 0; i--) {
    h = ((h << 5) - h + i) | 0;
    const j = Math.abs(h) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

type AuthMiddleware = (req: Request, res: Response, next: NextFunction) => void;

interface CharlotteEmailOptions {
  template: "verify" | "winner" | "claim_reminder" | "entry_confirmation" | "results" | "alternate_notification" | "draw_summary";
  recipientName: string;
  giveawayTitle: string;
  actionUrl?: string;
  actionLabel?: string;
  prizeName?: string;
  claimDeadline?: string;
  winnersHtml?: string;
}

function buildCharlotteEmail(opts: CharlotteEmailOptions): string {
  const { template, recipientName, giveawayTitle, actionUrl, actionLabel, prizeName, claimDeadline, winnersHtml } = opts;

  const headerGradient = "linear-gradient(135deg, #5B1D8F 0%, #7B2FBF 100%)";
  const accentColor = "#F2C230";
  const darkBg = "#1a1a2e";

  let headline = "";
  let bodyLines: string[] = [];

  switch (template) {
    case "verify":
      headline = "Verify Your Entry";
      bodyLines = [
        `Hey ${recipientName},`,
        `Charlotte here! Thanks for entering <strong>${giveawayTitle}</strong>. Just one more step -- verify your email to lock in your entry.`,
        `Once verified, you're officially in the running. Good luck!`,
      ];
      break;
    case "winner":
      headline = "You're a Winner!";
      bodyLines = [
        `Congratulations, ${recipientName}!`,
        `Charlotte is thrilled to let you know -- you've been selected as a winner in <strong>${giveawayTitle}</strong>${prizeName ? ` and won <strong>${prizeName}</strong>` : ""}!`,
        claimDeadline ? `Please claim your prize by <strong>${claimDeadline}</strong> by clicking the button below.` : `Please claim your prize by clicking the button below.`,
      ];
      break;
    case "claim_reminder":
      headline = "Don't Forget Your Prize!";
      bodyLines = [
        `Hey ${recipientName},`,
        `Charlotte here with a friendly nudge -- you won${prizeName ? ` <strong>${prizeName}</strong> in` : " a prize in"} <strong>${giveawayTitle}</strong> but haven't claimed it yet.`,
        claimDeadline ? `Your claim window closes <strong>${claimDeadline}</strong>. Don't let it slip away!` : `Claim it before the window closes!`,
      ];
      break;
    case "entry_confirmation":
      headline = "You're In!";
      bodyLines = [
        `Hey ${recipientName},`,
        `Charlotte here -- your entry for <strong>${giveawayTitle}</strong> is confirmed! You're officially in the draw.`,
        `Share with friends for bonus entries and keep an eye on your inbox for results. Fingers crossed!`,
      ];
      break;
    case "results":
      headline = "Results Are In!";
      bodyLines = [
        `Hey ${recipientName},`,
        `The drawing for <strong>${giveawayTitle}</strong> has been completed!`,
        winnersHtml || `Check out the results page to see who won.`,
      ];
      break;
    case "alternate_notification":
      headline = "You're an Alternate Winner!";
      bodyLines = [
        `Hey ${recipientName},`,
        `Charlotte here with some exciting news -- you've been selected as an alternate winner in <strong>${giveawayTitle}</strong>!`,
        `If any of the primary winners don't claim their prize within the claim window, you'll be next in line.`,
        `We'll notify you right away if your prize becomes available. Stay tuned!`,
      ];
      break;
    case "draw_summary":
      headline = "Draw Complete - Admin Summary";
      bodyLines = [
        `Hey ${recipientName},`,
        `Charlotte here with the draw summary for <strong>${giveawayTitle}</strong>.`,
        winnersHtml || `The draw has been completed and winners have been notified.`,
        `All winners have been sent claim instructions. Remember to monitor claim responses and follow up as needed.`,
      ];
      break;
  }

  const bodyHtml = bodyLines.map(l => `<p style="color: #555; line-height: 1.7; margin: 0 0 16px; font-size: 15px;">${l}</p>`).join("\n          ");

  const buttonHtml = actionUrl ? `
          <p style="text-align: center; margin: 24px 0 16px;">
            <a href="${actionUrl}" style="display: inline-block; padding: 16px 40px; background: ${accentColor}; color: ${darkBg}; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px;">${actionLabel || "Take Action"}</a>
          </p>` : "";

  return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e5e5; border-radius: 12px; overflow: hidden;">
        <div style="background: ${headerGradient}; padding: 32px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">${headline}</h1>
          <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 13px;">from Charlotte, your city guide</p>
        </div>
        <div style="padding: 32px;">
          ${bodyHtml}${buttonHtml}
        </div>
        <div style="padding: 16px 32px; text-align: center; color: #aaa; font-size: 11px; background: #f9f7fc; border-top: 1px solid #f0ecf5;">
          <p style="margin: 0;">Powered by CityMetroHub</p>
        </div>
      </div>`;
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 200) + "-" + crypto.randomBytes(3).toString("hex");
}

function generateReferralCode(): string {
  return crypto.randomBytes(6).toString("base64url").substring(0, 10);
}

export function registerGiveawayRoutes(app: Express, requireAdmin: AuthMiddleware) {

  app.get("/api/admin/giveaways/summary", requireAdmin, async (req: Request, res: Response) => {
    try {
      const cityId = req.query.cityId as string;
      if (!cityId) return res.status(400).json({ message: "cityId required" });

      const allGws = await db.select().from(giveaways).where(eq(giveaways.cityId, cityId));
      const gwIds = allGws.map(g => g.id);

      let totalEntries = 0;
      let totalWinners = 0;
      let totalDraws = 0;
      if (gwIds.length > 0) {
        const [ec] = await db.select({ count: count() }).from(giveawayEntries).where(inArray(giveawayEntries.giveawayId, gwIds));
        totalEntries = ec?.count || 0;
        const [wc] = await db.select({ count: count() }).from(giveawayWinners).where(inArray(giveawayWinners.giveawayId, gwIds));
        totalWinners = wc?.count || 0;
        const [dc] = await db.select({ count: count() }).from(giveawayDraws).where(inArray(giveawayDraws.giveawayId, gwIds));
        totalDraws = dc?.count || 0;
      }

      const byStatus: Record<string, number> = {};
      for (const gw of allGws) {
        byStatus[gw.status] = (byStatus[gw.status] || 0) + 1;
      }

      res.json({
        totalGiveaways: allGws.length,
        activeGiveaways: byStatus["active"] || 0,
        draftGiveaways: byStatus["draft"] || 0,
        completedGiveaways: byStatus["completed"] || 0,
        totalEntries,
        totalWinners,
        totalDraws,
        byStatus,
      });
    } catch (err: any) {
      console.error("[Giveaway] Summary error:", err.message);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/giveaways", requireAdmin, async (req: Request, res: Response) => {
    try {
      const cityId = req.query.cityId as string;
      if (!cityId) return res.status(400).json({ message: "cityId required" });

      const statusFilter = req.query.status as string | undefined;
      const conditions = [eq(giveaways.cityId, cityId)];
      if (statusFilter) {
        const validStatuses = ["draft", "scheduled", "active", "paused", "drawing", "completed", "cancelled"] as const;
        type GiveawayStatus = (typeof validStatuses)[number];
        if (validStatuses.includes(statusFilter as GiveawayStatus)) {
          conditions.push(eq(giveaways.status, statusFilter as GiveawayStatus));
        }
      }

      const rows = await db.select().from(giveaways)
        .where(and(...conditions))
        .orderBy(desc(giveaways.createdAt));

      const withCounts = await Promise.all(rows.map(async (gw) => {
        const [entryCount] = await db.select({ count: count() }).from(giveawayEntries)
          .where(eq(giveawayEntries.giveawayId, gw.id));
        const prizes = await db.select().from(giveawayPrizes)
          .where(eq(giveawayPrizes.giveawayId, gw.id))
          .orderBy(asc(giveawayPrizes.sortOrder));
        const sponsors = await db.select().from(giveawaySponsors)
          .where(eq(giveawaySponsors.giveawayId, gw.id));
        return {
          ...gw,
          entryCount: entryCount?.count || 0,
          prizeCount: prizes.length,
          sponsorCount: sponsors.length,
          prizes,
          sponsors,
        };
      }));

      res.json(withCounts);
    } catch (err: any) {
      console.error("[Giveaway] List error:", err.message);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/giveaways/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const [gw] = await db.select().from(giveaways).where(eq(giveaways.id, req.params.id));
      if (!gw) return res.status(404).json({ message: "Giveaway not found" });

      const prizes = await db.select().from(giveawayPrizes)
        .where(eq(giveawayPrizes.giveawayId, gw.id))
        .orderBy(asc(giveawayPrizes.sortOrder));
      const sponsors = await db.select().from(giveawaySponsors)
        .where(eq(giveawaySponsors.giveawayId, gw.id))
        .orderBy(asc(giveawaySponsors.sortOrder));
      const bonusActions = await db.select().from(giveawayBonusActions)
        .where(eq(giveawayBonusActions.giveawayId, gw.id))
        .orderBy(asc(giveawayBonusActions.sortOrder));
      const [entryCount] = await db.select({ count: count() }).from(giveawayEntries)
        .where(eq(giveawayEntries.giveawayId, gw.id));
      const draws = await db.select().from(giveawayDraws)
        .where(eq(giveawayDraws.giveawayId, gw.id))
        .orderBy(desc(giveawayDraws.createdAt));

      res.json({ ...gw, prizes, sponsors, bonusActions, entryCount: entryCount?.count || 0, draws });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/giveaways", requireAdmin, async (req: Request, res: Response) => {
    try {
      const slug = generateSlug(req.body.title || "giveaway");
      const parsed = insertGiveawaySchema.parse({ ...req.body, slug });
      const [created] = await db.insert(giveaways).values(parsed).returning();
      try {
        const { applyFullTagStack } = await import("./services/content-tagger");
        await applyFullTagStack("giveaway", created.id, { cityId: created.cityId, zoneId: created.zoneId, title: created.title });
      } catch (tagErr: unknown) {
        const msg = tagErr instanceof Error ? tagErr.message : String(tagErr);
        console.error(`[ContentTagger] Giveaway tagging failed for ${created.id}:`, msg);
      }
      res.status(201).json(created);
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: "Validation failed", errors: err.errors });
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/giveaways/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const [existing] = await db.select().from(giveaways).where(eq(giveaways.id, req.params.id));
      if (!existing) return res.status(404).json({ message: "Giveaway not found" });

      const updates: Record<string, any> = { updatedAt: new Date() };
      const allowedFields = [
        "title", "description", "heroImageUrl", "rulesText", "status", "drawMethod",
        "maxEntries", "maxEntriesPerUser", "requiresVerifiedEmail", "requiresZipcode",
        "allowedZipcodes", "startsAt", "endsAt", "drawAt", "isPublic", "isFeatured", "zoneId",
      ];
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
      }

      if (req.body.title && req.body.title !== existing.title) {
        updates.slug = generateSlug(req.body.title);
      }

      const [updated] = await db.update(giveaways).set(updates)
        .where(eq(giveaways.id, req.params.id)).returning();
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/giveaways/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const [existing] = await db.select().from(giveaways).where(eq(giveaways.id, req.params.id));
      if (!existing) return res.status(404).json({ message: "Giveaway not found" });
      if (existing.status === "active") return res.status(400).json({ message: "Cannot delete an active giveaway" });

      await db.delete(giveaways).where(eq(giveaways.id, req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/giveaways/:id/prizes", requireAdmin, async (req: Request, res: Response) => {
    try {
      const prizes = await db.select().from(giveawayPrizes)
        .where(eq(giveawayPrizes.giveawayId, req.params.id))
        .orderBy(giveawayPrizes.sortOrder);
      res.json(prizes);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/giveaways/:id/sponsors", requireAdmin, async (req: Request, res: Response) => {
    try {
      const sponsors = await db.select().from(giveawaySponsors)
        .where(eq(giveawaySponsors.giveawayId, req.params.id))
        .orderBy(giveawaySponsors.sortOrder);
      res.json(sponsors);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/giveaways/:id/bonus-actions", requireAdmin, async (req: Request, res: Response) => {
    try {
      const actions = await db.select().from(giveawayBonusActions)
        .where(eq(giveawayBonusActions.giveawayId, req.params.id))
        .orderBy(giveawayBonusActions.sortOrder);
      res.json(actions);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/giveaways/:id/prizes", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = insertGiveawayPrizeSchema.parse({ ...req.body, giveawayId: req.params.id });
      const [created] = await db.insert(giveawayPrizes).values(parsed).returning();
      res.status(201).json(created);
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: "Validation failed", errors: err.errors });
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/giveaways/:gwId/prizes/:prizeId", requireAdmin, async (req: Request, res: Response) => {
    try {
      const updates: Record<string, any> = {};
      const fields = ["name", "description", "imageUrl", "value", "quantity", "sortOrder", "sponsorId"];
      for (const f of fields) { if (req.body[f] !== undefined) updates[f] = req.body[f]; }

      const [updated] = await db.update(giveawayPrizes).set(updates)
        .where(and(eq(giveawayPrizes.id, req.params.prizeId), eq(giveawayPrizes.giveawayId, req.params.gwId))).returning();
      if (!updated) return res.status(404).json({ message: "Prize not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/giveaways/:gwId/prizes/:prizeId", requireAdmin, async (req: Request, res: Response) => {
    try {
      await db.delete(giveawayPrizes).where(and(eq(giveawayPrizes.id, req.params.prizeId), eq(giveawayPrizes.giveawayId, req.params.gwId)));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/giveaways/:id/sponsors", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = insertGiveawaySponsorSchema.parse({ ...req.body, giveawayId: req.params.id });
      const [created] = await db.insert(giveawaySponsors).values(parsed).returning();
      res.status(201).json(created);
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: "Validation failed", errors: err.errors });
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/giveaways/:gwId/sponsors/:sponsorId", requireAdmin, async (req: Request, res: Response) => {
    try {
      const updates: Record<string, any> = {};
      const fields = ["name", "logoUrl", "websiteUrl", "tier", "sortOrder", "businessId"];
      for (const f of fields) { if (req.body[f] !== undefined) updates[f] = req.body[f]; }

      const [updated] = await db.update(giveawaySponsors).set(updates)
        .where(and(eq(giveawaySponsors.id, req.params.sponsorId), eq(giveawaySponsors.giveawayId, req.params.gwId))).returning();
      if (!updated) return res.status(404).json({ message: "Sponsor not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/giveaways/:gwId/sponsors/:sponsorId", requireAdmin, async (req: Request, res: Response) => {
    try {
      await db.delete(giveawaySponsors).where(and(eq(giveawaySponsors.id, req.params.sponsorId), eq(giveawaySponsors.giveawayId, req.params.gwId)));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/giveaways/:id/bonus-actions", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = insertGiveawayBonusActionSchema.parse({ ...req.body, giveawayId: req.params.id });
      const [created] = await db.insert(giveawayBonusActions).values(parsed).returning();
      res.status(201).json(created);
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: "Validation failed", errors: err.errors });
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/giveaways/:gwId/bonus-actions/:actionId", requireAdmin, async (req: Request, res: Response) => {
    try {
      const updates: Record<string, any> = {};
      const fields = ["label", "description", "bonusType", "bonusAmount", "actionUrl", "isActive", "sortOrder"];
      for (const f of fields) { if (req.body[f] !== undefined) updates[f] = req.body[f]; }

      const [updated] = await db.update(giveawayBonusActions).set(updates)
        .where(and(eq(giveawayBonusActions.id, req.params.actionId), eq(giveawayBonusActions.giveawayId, req.params.gwId))).returning();
      if (!updated) return res.status(404).json({ message: "Bonus action not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/giveaways/:gwId/bonus-actions/:actionId", requireAdmin, async (req: Request, res: Response) => {
    try {
      await db.delete(giveawayBonusActions).where(and(eq(giveawayBonusActions.id, req.params.actionId), eq(giveawayBonusActions.giveawayId, req.params.gwId)));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/giveaways/:id/entries", requireAdmin, async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const offset = (page - 1) * limit;

      const [totalResult] = await db.select({ count: count() }).from(giveawayEntries)
        .where(eq(giveawayEntries.giveawayId, req.params.id));

      const entries = await db.select().from(giveawayEntries)
        .where(eq(giveawayEntries.giveawayId, req.params.id))
        .orderBy(desc(giveawayEntries.createdAt))
        .limit(limit)
        .offset(offset);

      res.json({
        data: entries,
        total: totalResult?.count || 0,
        page,
        pageSize: limit,
        totalPages: Math.ceil((Number(totalResult?.count) || 0) / limit),
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/giveaways/:gwId/entries/:entryId/disqualify", requireAdmin, async (req: Request, res: Response) => {
    try {
      const [updated] = await db.update(giveawayEntries)
        .set({ isDisqualified: true })
        .where(and(eq(giveawayEntries.id, req.params.entryId), eq(giveawayEntries.giveawayId, req.params.gwId)))
        .returning();
      if (!updated) return res.status(404).json({ message: "Entry not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/giveaways/:gwId/entries/:entryId/reinstate", requireAdmin, async (req: Request, res: Response) => {
    try {
      const [updated] = await db.update(giveawayEntries)
        .set({ isDisqualified: false })
        .where(and(eq(giveawayEntries.id, req.params.entryId), eq(giveawayEntries.giveawayId, req.params.gwId)))
        .returning();
      if (!updated) return res.status(404).json({ message: "Entry not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/giveaways/:id/draw", requireAdmin, async (req: Request, res: Response) => {
    try {
      const [gw] = await db.select().from(giveaways).where(eq(giveaways.id, req.params.id));
      if (!gw) return res.status(404).json({ message: "Giveaway not found" });
      if (!["active", "drawing"].includes(gw.status)) {
        return res.status(400).json({ message: "Giveaway must be active or in drawing state" });
      }

      const winnerCount = parseInt(req.body.winnerCount as string) || 1;
      const prizeId = req.body.prizeId as string | undefined;

      const eligibleConditions = [
        eq(giveawayEntries.giveawayId, gw.id),
        eq(giveawayEntries.isDisqualified, false),
      ];
      if (gw.requiresVerifiedEmail) {
        eligibleConditions.push(eq(giveawayEntries.isVerified, true));
      }
      const eligibleEntries = await db.select().from(giveawayEntries)
        .where(and(...eligibleConditions));

      const existingWinnerEntries = await db.select({ entryId: giveawayWinners.entryId })
        .from(giveawayWinners)
        .where(eq(giveawayWinners.giveawayId, gw.id));
      const existingWinnerIds = new Set(existingWinnerEntries.map(w => w.entryId));

      const entryPool = eligibleEntries.filter(e => !existingWinnerIds.has(e.id));
      if (entryPool.length === 0) {
        return res.status(400).json({ message: "No eligible entries remaining" });
      }

      const drawMethod = gw.drawMethod || "random";

      if (drawMethod === "manual") {
        const manualWinnerEntryIds = req.body.entryIds as string[] | undefined;
        if (!manualWinnerEntryIds || !Array.isArray(manualWinnerEntryIds) || manualWinnerEntryIds.length === 0) {
          return res.status(400).json({ message: "Manual draw requires entryIds array" });
        }
      }

      const expandedPool: typeof entryPool = [];
      if (drawMethod === "weighted") {
        for (const entry of entryPool) {
          for (let i = 0; i < entry.totalEntries; i++) {
            expandedPool.push(entry);
          }
        }
      } else {
        expandedPool.push(...entryPool);
      }

      const seed = crypto.randomBytes(16).toString("hex");

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const [existingDrawCount] = await db.select({ count: count() }).from(giveawayDraws)
          .where(eq(giveawayDraws.giveawayId, gw.id));

        const [draw] = await db.insert(giveawayDraws).values({
          giveawayId: gw.id,
          drawMethod,
          drawNumber: (Number(existingDrawCount?.count) || 0) + 1,
          totalEligible: entryPool.length,
          winnersSelected: 0,
          executedBy: ((req.session ?? {}) as Record<string, string>).userId || "admin",
          seed,
        }).returning();

        const selectedWinners: string[] = [];
        const selectedEntryIds = new Set<string>();

        if (drawMethod === "manual") {
          const manualIds = req.body.entryIds as string[];
          const validPoolIds = new Set(entryPool.map(e => e.id));
          for (const eid of manualIds) {
            if (validPoolIds.has(eid)) selectedWinners.push(eid);
          }
        } else {
          const shuffled = seededShuffle(expandedPool, seed);
          for (const entry of shuffled) {
            if (selectedWinners.length >= winnerCount) break;
            if (selectedEntryIds.has(entry.id)) continue;
            selectedEntryIds.add(entry.id);
            selectedWinners.push(entry.id);
          }
        }

        const claimDeadline = new Date(Date.now() + 48 * 3600000);

        const winnerRecords = [];
        for (const entryId of selectedWinners) {
          const claimToken = crypto.randomBytes(20).toString("hex");
          const [winner] = await db.insert(giveawayWinners).values({
            drawId: draw.id,
            giveawayId: gw.id,
            entryId,
            prizeId: prizeId || null,
            status: "pending",
            claimDeadline,
            claimToken,
          }).returning();
          winnerRecords.push(winner);
        }

        await db.update(giveawayDraws).set({ winnersSelected: selectedWinners.length })
          .where(eq(giveawayDraws.id, draw.id));

        await db.update(giveaways).set({ status: "drawing", updatedAt: new Date() })
          .where(eq(giveaways.id, gw.id));

        await client.query("COMMIT");

        const winnerDetails = await Promise.all(winnerRecords.map(async (w) => {
          const [entry] = await db.select().from(giveawayEntries).where(eq(giveawayEntries.id, w.entryId));
          return { ...w, entry };
        }));

        res.json({ draw, winners: winnerDetails, seed });

        const totalEntries = await db.select({ count: sql<number>`count(*)::int` })
          .from(giveawayEntries)
          .where(and(eq(giveawayEntries.giveawayId, gw.id), eq(giveawayEntries.isVerified, true)));
        const entryCount = totalEntries[0]?.count || 0;

        const winnersListHtml = winnerDetails.map(w => {
          const name = w.entry?.name || "Unknown";
          const email = w.entry?.email || "";
          return `<li><strong>${name}</strong> (${email})</li>`;
        }).join("");
        const summaryStatsHtml = `<p><strong>${winnerRecords.length}</strong> winner(s) selected from <strong>${entryCount}</strong> verified entries.</p><ul>${winnersListHtml}</ul>`;

        const summaryHtml = buildCharlotteEmail({
          template: "draw_summary",
          recipientName: "Admin",
          giveawayTitle: gw.title,
          actionUrl: `https://${process.env.REPLIT_DOMAINS?.split(",")[0] || "localhost:5000"}/admin/giveaways`,
          actionLabel: "View Admin Dashboard",
          winnersHtml: summaryStatsHtml,
        });

        sendTerritoryEmail({
          cityId: gw.cityId,
          to: "admin@citycorehub.com",
          subject: `Draw Complete: ${gw.title} - ${winnerRecords.length} Winner(s)`,
          html: summaryHtml,
          metadata: { giveawayId: gw.id, drawId: draw.id, type: "draw_summary" },
        }).catch(err => console.error("[Giveaway] Draw summary email error:", err.message));
      } catch (txErr) {
        await client.query("ROLLBACK");
        throw txErr;
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.error("[Giveaway] Draw error:", err.message);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/giveaways/:id/winners", requireAdmin, async (req: Request, res: Response) => {
    try {
      const winners = await db.select().from(giveawayWinners)
        .where(eq(giveawayWinners.giveawayId, req.params.id))
        .orderBy(desc(giveawayWinners.createdAt));

      const withEntries = await Promise.all(winners.map(async (w) => {
        const [entry] = await db.select().from(giveawayEntries).where(eq(giveawayEntries.id, w.entryId));
        let prize = null;
        if (w.prizeId) {
          const [p] = await db.select().from(giveawayPrizes).where(eq(giveawayPrizes.id, w.prizeId));
          prize = p || null;
        }
        return { ...w, entry, prize };
      }));

      res.json(withEntries);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/giveaways/:gwId/winners/:winnerId/notify", requireAdmin, async (req: Request, res: Response) => {
    try {
      const [winner] = await db.select().from(giveawayWinners)
        .where(eq(giveawayWinners.id, req.params.winnerId));
      if (!winner) return res.status(404).json({ message: "Winner not found" });

      const [entry] = await db.select().from(giveawayEntries)
        .where(eq(giveawayEntries.id, winner.entryId));
      if (!entry) return res.status(404).json({ message: "Entry not found" });

      const [gw] = await db.select().from(giveaways).where(eq(giveaways.id, winner.giveawayId));
      if (!gw) return res.status(404).json({ message: "Giveaway not found" });

      let prizeName = "a prize";
      if (winner.prizeId) {
        const [prize] = await db.select().from(giveawayPrizes).where(eq(giveawayPrizes.id, winner.prizeId));
        if (prize) prizeName = prize.name;
      }

      const protocol = req.headers["x-forwarded-proto"] || "https";
      const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:5000";
      const claimUrl = `${protocol}://${host}/giveaway/claim/${winner.claimToken}`;

      const claimDeadline = new Date(Date.now() + 48 * 3600000).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
      const subject = `You won! - ${gw.title}`;
      const html = buildCharlotteEmail({
        template: "winner",
        recipientName: entry.name,
        giveawayTitle: gw.title,
        prizeName,
        actionUrl: claimUrl,
        actionLabel: "Claim Your Prize",
        claimDeadline,
      });

      await sendTerritoryEmail({
        cityId: gw.cityId,
        to: entry.email,
        subject,
        html,
        metadata: { giveawayId: gw.id, winnerId: winner.id },
      });

      await db.update(giveawayWinners)
        .set({ status: "notified", notifiedAt: new Date() })
        .where(eq(giveawayWinners.id, winner.id));

      await db.insert(giveawayNotifications).values({
        giveawayId: gw.id,
        winnerId: winner.id,
        channel: "email",
        recipientEmail: entry.email,
        subject,
        status: "sent",
        sentAt: new Date(),
      });

      res.json({ success: true });
    } catch (err: any) {
      console.error("[Giveaway] Notify winner error:", err.message);
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/giveaways/:gwId/winners/:winnerId/status", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { status } = req.body;
      const validStatuses = ["pending", "notified", "claimed", "expired", "disqualified"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
      }

      const updates: Record<string, any> = { status };
      if (status === "claimed") updates.claimedAt = new Date();

      const [updated] = await db.update(giveawayWinners).set(updates)
        .where(and(eq(giveawayWinners.id, req.params.winnerId), eq(giveawayWinners.giveawayId, req.params.gwId))).returning();
      if (!updated) return res.status(404).json({ message: "Winner not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/giveaways/:id/draws", requireAdmin, async (req: Request, res: Response) => {
    try {
      const draws = await db.select().from(giveawayDraws)
        .where(eq(giveawayDraws.giveawayId, req.params.id))
        .orderBy(desc(giveawayDraws.createdAt));
      res.json(draws);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/giveaways/:id/analytics", requireAdmin, async (req: Request, res: Response) => {
    try {
      const [gw] = await db.select().from(giveaways).where(eq(giveaways.id, req.params.id));
      if (!gw) return res.status(404).json({ message: "Giveaway not found" });

      const [entryStats] = await db.select({
        totalEntries: count(),
        totalBonus: sql<number>`COALESCE(SUM(${giveawayEntries.bonusEntries}), 0)`,
      }).from(giveawayEntries).where(eq(giveawayEntries.giveawayId, gw.id));

      const methodBreakdown = await db.select({
        method: giveawayEntries.entryMethod,
        count: count(),
      }).from(giveawayEntries)
        .where(eq(giveawayEntries.giveawayId, gw.id))
        .groupBy(giveawayEntries.entryMethod);

      const [winnerStats] = await db.select({
        total: count(),
        claimed: sql<number>`COUNT(*) FILTER (WHERE ${giveawayWinners.status} = 'claimed')`,
        notified: sql<number>`COUNT(*) FILTER (WHERE ${giveawayWinners.status} = 'notified')`,
        pending: sql<number>`COUNT(*) FILTER (WHERE ${giveawayWinners.status} = 'pending')`,
      }).from(giveawayWinners).where(eq(giveawayWinners.giveawayId, gw.id));

      const [referralCount] = await db.select({ count: count() }).from(giveawayEntries)
        .where(and(eq(giveawayEntries.giveawayId, gw.id), sql`${giveawayEntries.referredBy} IS NOT NULL`));

      const dailyAnalytics = await db.select().from(giveawayAnalytics)
        .where(eq(giveawayAnalytics.giveawayId, gw.id))
        .orderBy(desc(giveawayAnalytics.date))
        .limit(30);

      res.json({
        entries: {
          total: entryStats?.totalEntries || 0,
          bonusTotal: entryStats?.totalBonus || 0,
          byMethod: methodBreakdown,
        },
        winners: winnerStats || { total: 0, claimed: 0, notified: 0, pending: 0 },
        referrals: referralCount?.count || 0,
        daily: dailyAnalytics,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/giveaways/:id/notifications", requireAdmin, async (req: Request, res: Response) => {
    try {
      const notifications = await db.select().from(giveawayNotifications)
        .where(eq(giveawayNotifications.giveawayId, req.params.id))
        .orderBy(desc(giveawayNotifications.createdAt));
      res.json(notifications);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/giveaways/:id/complete", requireAdmin, async (req: Request, res: Response) => {
    try {
      const [gw] = await db.select().from(giveaways).where(eq(giveaways.id, req.params.id));
      if (!gw) return res.status(404).json({ message: "Giveaway not found" });

      const [updated] = await db.update(giveaways)
        .set({ status: "completed", updatedAt: new Date() })
        .where(eq(giveaways.id, req.params.id))
        .returning();
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/giveaways/active", async (req: Request, res: Response) => {
    try {
      const cityId = req.query.cityId as string;
      if (!cityId) return res.status(400).json({ message: "cityId required" });

      const now = new Date();
      const active = await db.select().from(giveaways)
        .where(and(
          eq(giveaways.cityId, cityId),
          eq(giveaways.status, "active"),
          eq(giveaways.isPublic, true),
        ))
        .orderBy(desc(giveaways.isFeatured), asc(giveaways.endsAt));

      const withPrizes = await Promise.all(active.map(async (gw) => {
        const prizes = await db.select().from(giveawayPrizes)
          .where(eq(giveawayPrizes.giveawayId, gw.id))
          .orderBy(asc(giveawayPrizes.sortOrder));
        const sponsors = await db.select().from(giveawaySponsors)
          .where(eq(giveawaySponsors.giveawayId, gw.id))
          .orderBy(asc(giveawaySponsors.sortOrder));
        const [entryCount] = await db.select({ count: count() }).from(giveawayEntries)
          .where(eq(giveawayEntries.giveawayId, gw.id));
        return {
          id: gw.id,
          title: gw.title,
          slug: gw.slug,
          description: gw.description,
          heroImageUrl: gw.heroImageUrl,
          endsAt: gw.endsAt,
          isFeatured: gw.isFeatured,
          prizes,
          sponsors: sponsors.map(s => ({ id: s.id, name: s.name, logoUrl: s.logoUrl, websiteUrl: s.websiteUrl, tier: s.tier })),
          entryCount: entryCount?.count || 0,
        };
      }));

      res.json(withPrizes);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/giveaways/:slug", async (req: Request, res: Response) => {
    try {
      const [gw] = await db.select().from(giveaways)
        .where(and(eq(giveaways.slug, req.params.slug), eq(giveaways.isPublic, true)));
      if (!gw) return res.status(404).json({ message: "Giveaway not found" });

      const prizes = await db.select().from(giveawayPrizes)
        .where(eq(giveawayPrizes.giveawayId, gw.id))
        .orderBy(asc(giveawayPrizes.sortOrder));
      const sponsors = await db.select().from(giveawaySponsors)
        .where(eq(giveawaySponsors.giveawayId, gw.id))
        .orderBy(asc(giveawaySponsors.sortOrder));
      const bonusActions = await db.select().from(giveawayBonusActions)
        .where(and(eq(giveawayBonusActions.giveawayId, gw.id), eq(giveawayBonusActions.isActive, true)))
        .orderBy(asc(giveawayBonusActions.sortOrder));
      const [entryCount] = await db.select({ count: count() }).from(giveawayEntries)
        .where(eq(giveawayEntries.giveawayId, gw.id));

      let winners: any[] = [];
      if (gw.status === "completed" || gw.status === "drawing") {
        const winnerRows = await db.select().from(giveawayWinners)
          .where(and(eq(giveawayWinners.giveawayId, gw.id), eq(giveawayWinners.status, "claimed")));
        winners = await Promise.all(winnerRows.map(async (w) => {
          const [entry] = await db.select({ name: giveawayEntries.name }).from(giveawayEntries)
            .where(eq(giveawayEntries.id, w.entryId));
          let prize = null;
          if (w.prizeId) {
            const [p] = await db.select({ name: giveawayPrizes.name }).from(giveawayPrizes)
              .where(eq(giveawayPrizes.id, w.prizeId));
            prize = p?.name || null;
          }
          return { name: entry?.name || "Winner", prize };
        }));
      }

      res.json({
        id: gw.id,
        title: gw.title,
        slug: gw.slug,
        description: gw.description,
        heroImageUrl: gw.heroImageUrl,
        rulesText: gw.rulesText,
        status: gw.status,
        startsAt: gw.startsAt,
        endsAt: gw.endsAt,
        drawAt: gw.drawAt,
        isFeatured: gw.isFeatured,
        requiresVerifiedEmail: gw.requiresVerifiedEmail,
        requiresZipcode: gw.requiresZipcode,
        maxEntriesPerUser: gw.maxEntriesPerUser,
        prizes,
        sponsors: sponsors.map(s => ({ id: s.id, name: s.name, logoUrl: s.logoUrl, websiteUrl: s.websiteUrl, tier: s.tier })),
        bonusActions: bonusActions.map(a => ({
          id: a.id, bonusType: a.bonusType, label: a.label, description: a.description,
          bonusAmount: a.bonusAmount, actionUrl: a.actionUrl,
        })),
        entryCount: entryCount?.count || 0,
        winners,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/giveaways/:slug/enter", async (req: Request, res: Response) => {
    try {
      const [gw] = await db.select().from(giveaways)
        .where(and(eq(giveaways.slug, req.params.slug), eq(giveaways.status, "active")));
      if (!gw) return res.status(404).json({ message: "Giveaway not found or not active" });

      const now = new Date();
      if (gw.startsAt && now < new Date(gw.startsAt)) {
        return res.status(400).json({ message: "Giveaway has not started yet" });
      }
      if (gw.endsAt && now > new Date(gw.endsAt)) {
        return res.status(400).json({ message: "Giveaway has ended" });
      }

      const entrySchema = z.object({
        email: z.string().email(),
        name: z.string().min(1).max(255),
        phone: z.string().optional(),
        zipcode: z.string().optional(),
        referralCode: z.string().optional(),
      });

      const parsed = entrySchema.parse(req.body);
      const email = normalizeEmail(parsed.email);

      if (gw.requiresZipcode && !parsed.zipcode) {
        return res.status(400).json({ message: "Zipcode is required for this giveaway" });
      }
      if (gw.allowedZipcodes && gw.allowedZipcodes.length > 0 && parsed.zipcode) {
        if (!gw.allowedZipcodes.includes(parsed.zipcode)) {
          return res.status(400).json({ message: "Your zipcode is not eligible for this giveaway" });
        }
      }

      const existingEntries = await db.select({ count: count() }).from(giveawayEntries)
        .where(and(eq(giveawayEntries.giveawayId, gw.id), eq(giveawayEntries.email, email)));
      const existingCount = Number(existingEntries[0]?.count) || 0;

      if (existingCount >= gw.maxEntriesPerUser) {
        return res.status(400).json({ message: "You have reached the maximum entries for this giveaway" });
      }

      if (gw.maxEntries) {
        const [totalEntries] = await db.select({ count: count() }).from(giveawayEntries)
          .where(eq(giveawayEntries.giveawayId, gw.id));
        if ((Number(totalEntries?.count) || 0) >= gw.maxEntries) {
          return res.status(400).json({ message: "This giveaway has reached its maximum number of entries" });
        }
      }

      let referredBy: string | null = null;
      let entryMethod: "form" | "referral" = "form";
      if (parsed.referralCode) {
        const [referrer] = await db.select().from(giveawayEntries)
          .where(and(
            eq(giveawayEntries.giveawayId, gw.id),
            eq(giveawayEntries.referralCode, parsed.referralCode),
          ));
        if (referrer) {
          referredBy = referrer.id;
          entryMethod = "referral";
        }
      }

      const newReferralCode = generateReferralCode();
      const ipAddress = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || null;

      const verificationToken = gw.requiresVerifiedEmail ? crypto.randomBytes(20).toString("hex") : null;

      const [entry] = await db.insert(giveawayEntries).values({
        giveawayId: gw.id,
        userId: ((req.session ?? {}) as Record<string, string>).publicUserId || null,
        email,
        name: parsed.name,
        phone: parsed.phone || null,
        zipcode: parsed.zipcode || null,
        entryMethod,
        referralCode: newReferralCode,
        referredBy,
        bonusEntries: 0,
        totalEntries: 1,
        ipAddress,
        userAgent: req.headers["user-agent"] || null,
        isVerified: !gw.requiresVerifiedEmail,
        isDisqualified: false,
        verificationToken,
      }).returning();

      if (referredBy) {
        const referralBonusActions = await db.select().from(giveawayBonusActions)
          .where(and(
            eq(giveawayBonusActions.giveawayId, gw.id),
            eq(giveawayBonusActions.bonusType, "refer_friend"),
            eq(giveawayBonusActions.isActive, true),
          ));

        if (referralBonusActions.length > 0) {
          const bonus = referralBonusActions[0];
          await db.update(giveawayEntries)
            .set({
              bonusEntries: sql`${giveawayEntries.bonusEntries} + ${bonus.bonusAmount}`,
              totalEntries: sql`${giveawayEntries.totalEntries} + ${bonus.bonusAmount}`,
            })
            .where(eq(giveawayEntries.id, referredBy));
        }
      }

      if (gw.requiresVerifiedEmail && verificationToken) {
        const protocol = req.headers["x-forwarded-proto"] || "https";
        const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:5000";
        const verifyUrl = `${protocol}://${host}/api/giveaways/verify/${verificationToken}`;

        const verifyHtml = buildCharlotteEmail({
          template: "verify",
          recipientName: parsed.name,
          giveawayTitle: gw.title,
          actionUrl: verifyUrl,
          actionLabel: "Verify My Entry",
        });

        sendTerritoryEmail({
          cityId: gw.cityId,
          to: email,
          subject: `Verify your entry - ${gw.title}`,
          html: verifyHtml,
          metadata: { giveawayId: gw.id, entryId: entry.id, type: "verification" },
        }).catch(err => console.error("[Giveaway] Verify email error:", err.message));
      }

      res.status(201).json({
        success: true,
        entryId: entry.id,
        referralCode: newReferralCode,
        requiresVerification: gw.requiresVerifiedEmail,
      });
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: "Please provide a valid name and email" });
      console.error("[Giveaway] Entry error:", err.message);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/giveaways/:slug/bonus/:actionId", async (req: Request, res: Response) => {
    try {
      const { entryId } = req.body;
      if (!entryId) return res.status(400).json({ message: "entryId required" });

      const [gw] = await db.select().from(giveaways)
        .where(and(eq(giveaways.slug, req.params.slug), eq(giveaways.status, "active")));
      if (!gw) return res.status(404).json({ message: "Giveaway not found or not active" });

      const [entry] = await db.select().from(giveawayEntries)
        .where(and(eq(giveawayEntries.id, entryId), eq(giveawayEntries.giveawayId, gw.id)));
      if (!entry) return res.status(404).json({ message: "Entry not found for this giveaway" });

      const [action] = await db.select().from(giveawayBonusActions)
        .where(and(
          eq(giveawayBonusActions.id, req.params.actionId),
          eq(giveawayBonusActions.giveawayId, gw.id),
          eq(giveawayBonusActions.isActive, true),
        ));
      if (!action) return res.status(404).json({ message: "Bonus action not found for this giveaway" });

      const [existing] = await db.select().from(giveawayBonusCompletions)
        .where(and(
          eq(giveawayBonusCompletions.entryId, entryId),
          eq(giveawayBonusCompletions.bonusActionId, action.id),
        ));
      if (existing) return res.status(400).json({ message: "Bonus action already completed" });

      await db.insert(giveawayBonusCompletions).values({
        entryId,
        bonusActionId: action.id,
      });

      await db.update(giveawayEntries)
        .set({
          bonusEntries: sql`${giveawayEntries.bonusEntries} + ${action.bonusAmount}`,
          totalEntries: sql`${giveawayEntries.totalEntries} + ${action.bonusAmount}`,
        })
        .where(eq(giveawayEntries.id, entryId));

      res.json({ success: true, bonusAdded: action.bonusAmount });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/giveaways/:slug/check-entry", async (req: Request, res: Response) => {
    try {
      const rawEmail = req.query.email as string;
      if (!rawEmail) return res.status(400).json({ message: "email required" });
      const email = normalizeEmail(rawEmail);

      const [gw] = await db.select().from(giveaways)
        .where(eq(giveaways.slug, req.params.slug));
      if (!gw) return res.status(404).json({ message: "Giveaway not found" });

      const [entry] = await db.select().from(giveawayEntries)
        .where(and(eq(giveawayEntries.giveawayId, gw.id), eq(giveawayEntries.email, email)));

      if (!entry) return res.json({ entered: false });

      const completedBonuses = await db.select({ bonusActionId: giveawayBonusCompletions.bonusActionId })
        .from(giveawayBonusCompletions)
        .where(eq(giveawayBonusCompletions.entryId, entry.id));

      res.json({
        entered: true,
        entryId: entry.id,
        referralCode: entry.referralCode,
        totalEntries: entry.totalEntries,
        bonusEntries: entry.bonusEntries,
        completedBonusIds: completedBonuses.map(b => b.bonusActionId),
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/giveaways/:slug/winners", async (req: Request, res: Response) => {
    try {
      const [gw] = await db.select().from(giveaways)
        .where(and(eq(giveaways.slug, req.params.slug), eq(giveaways.isPublic, true)));
      if (!gw) return res.status(404).json({ message: "Giveaway not found" });

      const winners = await db.select().from(giveawayWinners)
        .where(and(
          eq(giveawayWinners.giveawayId, gw.id),
          inArray(giveawayWinners.status, ["claimed", "notified"]),
        ));

      const publicWinners = await Promise.all(winners.map(async (w) => {
        const [entry] = await db.select({ name: giveawayEntries.name }).from(giveawayEntries)
          .where(eq(giveawayEntries.id, w.entryId));
        let prizeName = null;
        if (w.prizeId) {
          const [p] = await db.select({ name: giveawayPrizes.name }).from(giveawayPrizes)
            .where(eq(giveawayPrizes.id, w.prizeId));
          prizeName = p?.name || null;
        }
        const fullName = entry?.name || "Winner";
        const perms = (w.claimPermissions || {}) as { allowName?: boolean; allowPhoto?: boolean; allowReview?: boolean; allowSocialShare?: boolean };
        const showFullName = !!perms.allowName;
        const parts = fullName.trim().split(/\s+/);
        const maskedName = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
        const displayName = showFullName ? fullName : maskedName;

        return {
          name: displayName,
          showFullName,
          prize: prizeName,
          claimedAt: w.claimedAt,
          quote: perms.allowReview || perms.allowSocialShare ? w.quote : null,
          photoUrl: perms.allowPhoto ? w.photoUrl : null,
          reviewText: perms.allowReview ? w.reviewText : null,
          businessMention: perms.allowSocialShare ? w.businessMention || null : null,
        };
      }));

      res.json(publicWinners);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/giveaways/claim/:token", async (req: Request, res: Response) => {
    try {
      const [winner] = await db.select().from(giveawayWinners)
        .where(eq(giveawayWinners.claimToken, req.params.token));
      if (!winner) return res.status(404).json({ message: "Invalid claim token" });

      if (winner.status === "claimed") return res.status(400).json({ message: "Prize already claimed" });
      if (winner.status === "expired" || winner.status === "disqualified") {
        return res.status(400).json({ message: "This prize is no longer available" });
      }
      if (winner.claimDeadline && new Date() > new Date(winner.claimDeadline)) {
        await db.update(giveawayWinners).set({ status: "expired" }).where(eq(giveawayWinners.id, winner.id));
        return res.status(400).json({ message: "Claim deadline has passed" });
      }

      const { quote, reviewText, businessMention, socialHandle, photoUrl, permissions, confirmEmail, confirmPhone } = req.body || {};
      const updateData: Record<string, unknown> = { status: "claimed", claimedAt: new Date() };
      if (quote) updateData.quote = String(quote).substring(0, 2000);
      if (reviewText) updateData.reviewText = String(reviewText).substring(0, 5000);
      if (businessMention) updateData.businessMention = String(businessMention).substring(0, 500);
      if (photoUrl) updateData.photoUrl = String(photoUrl).substring(0, 2000);
      if (permissions && typeof permissions === "object") {
        updateData.claimPermissions = {
          allowName: !!permissions.allowName,
          allowPhoto: !!permissions.allowPhoto,
          allowReview: !!permissions.allowReview,
          allowSocialShare: !!permissions.allowSocialShare,
          socialHandle: socialHandle ? String(socialHandle).substring(0, 200) : undefined,
          confirmEmail: confirmEmail ? String(confirmEmail).substring(0, 500) : undefined,
          confirmPhone: confirmPhone ? String(confirmPhone).substring(0, 50) : undefined,
        };
      }

      const [updated] = await db.update(giveawayWinners)
        .set(updateData)
        .where(eq(giveawayWinners.id, winner.id))
        .returning();

      res.json({ success: true, winner: updated });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/giveaways/verify/:token", async (req: Request, res: Response) => {
    try {
      const [entry] = await db.select().from(giveawayEntries)
        .where(eq(giveawayEntries.verificationToken, req.params.token));

      if (!entry) {
        return res.redirect(`/giveaway/verify?status=invalid`);
      }

      const [gw] = await db.select().from(giveaways).where(eq(giveaways.id, entry.giveawayId));
      const [city] = gw ? await db.select().from(cities).where(eq(cities.id, gw.cityId)) : [null];
      const citySlug = city?.slug || "charlotte";
      const gwSlug = gw?.slug || "";
      const gwTitle = encodeURIComponent(gw?.title || "");
      const entrantName = encodeURIComponent(entry.name);

      if (entry.isVerified) {
        return res.redirect(`/${citySlug}/enter-to-win/verify?status=already&giveaway=${gwSlug}&title=${gwTitle}&name=${entrantName}`);
      }

      await db.update(giveawayEntries)
        .set({ isVerified: true, verificationToken: null })
        .where(eq(giveawayEntries.id, entry.id));

      if (gw) {
        const confirmHtml = buildCharlotteEmail({
          template: "entry_confirmation",
          recipientName: entry.name,
          giveawayTitle: gw.title,
        });
        sendTerritoryEmail({
          cityId: gw.cityId,
          to: entry.email,
          subject: `You're in! - ${gw.title}`,
          html: confirmHtml,
          metadata: { giveawayId: gw.id, entryId: entry.id, type: "confirmation" },
        }).catch(err => console.error("[Giveaway] Confirmation email error:", err.message));
      }

      res.redirect(`/${citySlug}/enter-to-win/verify?status=success&giveaway=${gwSlug}&title=${gwTitle}&name=${entrantName}`);
    } catch (err: any) {
      console.error("[Giveaway] Verify error:", err.message);
      res.redirect(`/giveaway/verify?status=invalid`);
    }
  });

  app.get("/api/giveaways/claim/:token", async (req: Request, res: Response) => {
    try {
      const [winner] = await db.select().from(giveawayWinners)
        .where(eq(giveawayWinners.claimToken, req.params.token));
      if (!winner) return res.status(404).json({ message: "Invalid claim token" });

      const [entry] = await db.select().from(giveawayEntries)
        .where(eq(giveawayEntries.id, winner.entryId));
      const [gw] = await db.select().from(giveaways)
        .where(eq(giveaways.id, winner.giveawayId));

      let prize = null;
      if (winner.prizeId) {
        const [p] = await db.select().from(giveawayPrizes).where(eq(giveawayPrizes.id, winner.prizeId));
        prize = p || null;
      }

      const isExpired = winner.claimDeadline && new Date() > new Date(winner.claimDeadline);
      if (isExpired && winner.status !== "expired") {
        await db.update(giveawayWinners).set({ status: "expired" }).where(eq(giveawayWinners.id, winner.id));
      }

      res.json({
        status: isExpired ? "expired" : winner.status,
        claimDeadline: winner.claimDeadline,
        claimedAt: winner.claimedAt,
        giveaway: gw ? { title: gw.title, slug: gw.slug, heroImageUrl: gw.heroImageUrl } : null,
        prize: prize ? { name: prize.name, description: prize.description, imageUrl: prize.imageUrl, value: prize.value } : null,
        winner: { name: entry?.name || "Winner" },
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/giveaways/:id/email-preview/:templateType", requireAdmin, async (req: Request, res: Response) => {
    try {
      const [gw] = await db.select().from(giveaways).where(eq(giveaways.id, req.params.id));
      if (!gw) return res.status(404).json({ message: "Giveaway not found" });

      const validTemplates = ["verify", "winner", "claim_reminder", "entry_confirmation", "results", "alternate_notification", "draw_summary"] as const;
      type TemplateType = (typeof validTemplates)[number];
      const template = req.params.templateType as TemplateType;
      if (!validTemplates.includes(template)) {
        return res.status(400).json({ message: `Invalid template. Must be one of: ${validTemplates.join(", ")}` });
      }

      const html = buildCharlotteEmail({
        template,
        recipientName: "Sample Recipient",
        giveawayTitle: gw.title,
        actionUrl: "https://example.com/action",
        actionLabel: template === "verify" ? "Verify My Entry" : template === "winner" ? "Claim Your Prize" : template === "claim_reminder" ? "Claim Now" : template === "draw_summary" ? "View Admin Dashboard" : "View Results",
        prizeName: "Grand Prize Package",
        claimDeadline: new Date(Date.now() + 48 * 3600000).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }),
      });

      res.json({ html, template, giveawayTitle: gw.title });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/giveaways/:id/track-view", async (req: Request, res: Response) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [existing] = await db.select().from(giveawayAnalytics)
        .where(and(
          eq(giveawayAnalytics.giveawayId, req.params.id),
          eq(giveawayAnalytics.date, today),
        ));

      if (existing) {
        await db.update(giveawayAnalytics)
          .set({ pageViews: sql`${giveawayAnalytics.pageViews} + 1` })
          .where(eq(giveawayAnalytics.id, existing.id));
      } else {
        await db.insert(giveawayAnalytics).values({
          giveawayId: req.params.id,
          date: today,
          pageViews: 1,
        });
      }

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  async function processClaimExpirations() {
    try {
      const expired = await db.select().from(giveawayWinners)
        .where(and(
          eq(giveawayWinners.status, "notified"),
          sql`claim_deadline IS NOT NULL AND claim_deadline < NOW()`
        ));

      for (const winner of expired) {
        await db.update(giveawayWinners)
          .set({ status: "expired" })
          .where(eq(giveawayWinners.id, winner.id));

        const [entry] = await db.select().from(giveawayEntries)
          .where(eq(giveawayEntries.id, winner.entryId));
        const [gw] = await db.select().from(giveaways)
          .where(eq(giveaways.id, winner.giveawayId));

        if (entry && gw) {
          console.log(`[Giveaway] Claim expired: ${entry.name} for ${gw.title}`);
        }
      }

      if (expired.length > 0) {
        console.log(`[Giveaway] Expired ${expired.length} unclaimed prizes`);
      }

      const notifiedWinners = await db.select().from(giveawayWinners)
        .where(and(
          eq(giveawayWinners.status, "notified"),
          sql`claim_deadline IS NOT NULL AND claim_deadline > NOW()`
        ));

      for (const winner of notifiedWinners) {
        if (!winner.claimDeadline) continue;
        const hoursLeft = (new Date(winner.claimDeadline).getTime() - Date.now()) / 3600000;

        const [entry] = await db.select().from(giveawayEntries)
          .where(eq(giveawayEntries.id, winner.entryId));
        const [gw] = await db.select().from(giveaways)
          .where(eq(giveaways.id, winner.giveawayId));
        if (!entry || !gw) continue;

        const existingReminders = await db.select().from(giveawayNotifications)
          .where(and(
            eq(giveawayNotifications.winnerId, winner.id),
            sql`metadata->>'type' LIKE 'claim_reminder%'`
          ));
        const sentTypes = new Set(existingReminders.map(r => {
          const meta = r.metadata as Record<string, string>;
          return meta?.type || "";
        }));

        let reminderType: string | null = null;
        let subject = "";

        if (hoursLeft <= 4 && !sentTypes.has("claim_reminder_final")) {
          reminderType = "claim_reminder_final";
          subject = `Final notice: Claim your prize before it expires - ${gw.title}`;
        } else if (hoursLeft <= 24 && !sentTypes.has("claim_reminder_24h")) {
          reminderType = "claim_reminder_24h";
          subject = `Reminder: You have 24 hours to claim your prize - ${gw.title}`;
        }

        if (reminderType) {
          const host = process.env.REPLIT_DOMAINS?.split(",")[0] || "localhost:5000";
          const protocol = host.includes("localhost") ? "http" : "https";
          const claimUrl = `${protocol}://${host}/giveaway/claim/${winner.claimToken}`;
          const deadlineStr = new Date(winner.claimDeadline).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

          const reminderHtml = buildCharlotteEmail({
            template: "claim_reminder",
            recipientName: entry.name,
            giveawayTitle: gw.title,
            actionUrl: claimUrl,
            actionLabel: "Claim Now",
            claimDeadline: deadlineStr,
          });

          await db.insert(giveawayNotifications).values({
            giveawayId: gw.id,
            winnerId: winner.id,
            channel: "email",
            recipient: entry.email,
            subject,
            body: reminderHtml,
            status: "sent",
            metadata: { type: reminderType },
          });

          sendTerritoryEmail({
            cityId: gw.cityId,
            to: entry.email,
            subject,
            html: reminderHtml,
            metadata: { giveawayId: gw.id, winnerId: winner.id, type: reminderType },
          }).catch(err => console.error("[Giveaway] Reminder email error:", err.message));
        }
      }

      for (const w of expired) {
        const [gw] = await db.select().from(giveaways).where(eq(giveaways.id, w.giveawayId));
        const [draw] = w.drawId ? await db.select().from(giveawayDraws).where(eq(giveawayDraws.id, w.drawId)) : [null];
        if (!gw || !draw) continue;

        const alternates = await db.select().from(giveawayWinners)
          .where(and(
            eq(giveawayWinners.drawId, draw.id),
            eq(giveawayWinners.status, "alternate")
          ))
          .orderBy(giveawayWinners.createdAt)
          .limit(1);

        if (alternates.length > 0) {
          const alt = alternates[0];
          const [altEntry] = await db.select().from(giveawayEntries)
            .where(eq(giveawayEntries.id, alt.entryId));
          if (!altEntry) continue;

          const newDeadline = new Date(Date.now() + 48 * 3600000);
          await db.update(giveawayWinners)
            .set({ status: "notified", claimDeadline: newDeadline, notifiedAt: new Date() })
            .where(eq(giveawayWinners.id, alt.id));

          const host = process.env.REPLIT_DOMAINS?.split(",")[0] || "localhost:5000";
          const protocol = host.includes("localhost") ? "http" : "https";
          const claimUrl = `${protocol}://${host}/giveaway/claim/${alt.claimToken}`;
          const deadlineStr = newDeadline.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

          const altHtml = buildCharlotteEmail({
            template: "alternate_notification",
            recipientName: altEntry.name,
            giveawayTitle: gw.title,
            actionUrl: claimUrl,
            actionLabel: "Claim Your Prize",
            claimDeadline: deadlineStr,
          });

          sendTerritoryEmail({
            cityId: gw.cityId,
            to: altEntry.email,
            subject: `You've been selected! - ${gw.title}`,
            html: altHtml,
            metadata: { giveawayId: gw.id, winnerId: alt.id, type: "alternate_notification" },
          }).catch(err => console.error("[Giveaway] Alternate notification error:", err.message));

          console.log(`[Giveaway] Promoted alternate ${alt.id} for expired winner ${w.id}`);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Giveaway] Claim expiry check error:", msg);
    }
  }

  setInterval(processClaimExpirations, 60 * 60 * 1000);
  setTimeout(processClaimExpirations, 30000);
  console.log("[GiveawayScheduler] Claim expiry checker started (hourly)");
}
