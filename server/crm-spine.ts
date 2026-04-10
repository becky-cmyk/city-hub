import type { Express, Request, Response } from "express";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";
import { z } from "zod";
import {
  businesses,
  regions,
  regionMembers,
  presenceRegionAssignment,
  presenceOwnerAssignment,
  crmPresence,
  crmTasks,
  crmActivity,
  presenceSubscriptions,
  orgSupporters,
  presenceAuditLog,
  users,
  derivePublicLabel,
  PLAN_PRICING,
  GRACE_PERIOD_DAYS,
  ORG_SUPPORTER_REQUIRED,
  CLAIM_STATUS_MAPPING,
  insertRegionSchema,
  insertCrmTaskSchema,
  insertCrmActivitySchema,
} from "@shared/schema";
import { logPresenceFieldChange, logPresenceChanges } from "./audit";

export function registerCrmSpineRoutes(
  app: Express,
  requireAdmin: (req: Request, res: Response, next: Function) => void,
) {

  // ==========================================
  // ADMIN USERS LIST (for assignment dropdowns)
  // ==========================================

  app.get("/api/admin/users", requireAdmin, async (_req, res) => {
    try {
      const rows = await db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
      }).from(users).orderBy(users.name);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ==========================================
  // REGIONS CRUD
  // ==========================================

  app.get("/api/admin/regions", requireAdmin, async (_req, res) => {
    try {
      const rows = await db.select().from(regions).orderBy(regions.name);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/regions", requireAdmin, async (req, res) => {
    try {
      const parsed = insertRegionSchema.parse(req.body);
      const [row] = await db.insert(regions).values(parsed).returning();
      res.json(row);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: err.errors });
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/regions/:id", requireAdmin, async (req, res) => {
    try {
      const [row] = await db.update(regions)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(regions.id, req.params.id as string))
        .returning();
      res.json(row);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/regions/:id", requireAdmin, async (req, res) => {
    try {
      await db.delete(regions).where(eq(regions.id, req.params.id as string));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Region Members
  app.get("/api/admin/regions/:regionId/members", requireAdmin, async (req, res) => {
    try {
      const rows = await db.select({
        id: regionMembers.id,
        regionId: regionMembers.regionId,
        userId: regionMembers.userId,
        role: regionMembers.role,
        createdAt: regionMembers.createdAt,
        userName: users.name,
        userEmail: users.email,
      })
        .from(regionMembers)
        .leftJoin(users, eq(regionMembers.userId, users.id))
        .where(eq(regionMembers.regionId, req.params.regionId as string));
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  const addMemberSchema = z.object({
    userId: z.string().min(1),
    role: z.enum(["admin", "manager", "rep", "viewer"]),
  });

  app.post("/api/admin/regions/:regionId/members", requireAdmin, async (req, res) => {
    try {
      const parsed = addMemberSchema.parse(req.body);
      const [row] = await db.insert(regionMembers).values({
        regionId: req.params.regionId as string,
        ...parsed,
      }).returning();
      res.json(row);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: err.errors });
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/region-members/:id", requireAdmin, async (req, res) => {
    try {
      await db.delete(regionMembers).where(eq(regionMembers.id, req.params.id as string));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ==========================================
  // CRM PRESENCE (spine)
  // ==========================================

  app.get("/api/admin/crm-presences", requireAdmin, async (req, res) => {
    try {
      const rows = await db.select({
        crm: crmPresence,
        business: {
          id: businesses.id,
          name: businesses.name,
          slug: businesses.slug,
          claimStatus: businesses.claimStatus,
          charlotteVerificationStatus: businesses.charlotteVerificationStatus,
          micrositeTier: businesses.micrositeTier,
          listingTier: businesses.listingTier,
          presenceType: businesses.presenceType,
          ownerEmail: businesses.ownerEmail,
          phone: businesses.phone,
          address: businesses.address,
        },
      })
        .from(crmPresence)
        .innerJoin(businesses, eq(crmPresence.presenceId, businesses.id))
        .orderBy(desc(crmPresence.updatedAt));

      const enriched = rows.map(r => ({
        ...r.crm,
        business: r.business,
        publicLabel: derivePublicLabel(r.business.claimStatus, r.business.micrositeTier),
        claimLabel: CLAIM_STATUS_MAPPING[r.business.claimStatus as keyof typeof CLAIM_STATUS_MAPPING] || r.business.claimStatus,
      }));

      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/crm-presences/:presenceId", requireAdmin, async (req, res) => {
    try {
      const presenceId = req.params.presenceId as string;
      const existing = await db.select().from(crmPresence).where(eq(crmPresence.presenceId, presenceId));

      if (existing.length === 0) {
        const [row] = await db.insert(crmPresence).values({
          presenceId,
          ...req.body,
        }).returning();
        return res.json(row);
      }

      const old = existing[0];
      const [row] = await db.update(crmPresence)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(crmPresence.presenceId, presenceId))
        .returning();

      const adminId = (req.session as any).userId;
      if (req.body.stage && req.body.stage !== old.stage) {
        await logPresenceFieldChange(
          { presenceId, actorType: "admin", actorUserId: adminId },
          "crm_stage", old.stage, req.body.stage,
        );
      }
      if (req.body.ownerUserId && req.body.ownerUserId !== old.ownerUserId) {
        await logPresenceFieldChange(
          { presenceId, actorType: "admin", actorUserId: adminId },
          "crm_owner", old.ownerUserId, req.body.ownerUserId,
        );
      }

      res.json(row);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ==========================================
  // CRM TASKS
  // ==========================================

  app.get("/api/admin/crm-tasks/:presenceId", requireAdmin, async (req, res) => {
    try {
      const rows = await db.select().from(crmTasks)
        .where(eq(crmTasks.presenceId, req.params.presenceId as string))
        .orderBy(desc(crmTasks.createdAt));
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/crm-tasks", requireAdmin, async (req, res) => {
    try {
      const adminId = (req.session as any).userId;
      const parsed = insertCrmTaskSchema.parse({ ...req.body, createdByUserId: adminId });
      const [row] = await db.insert(crmTasks).values(parsed).returning();
      res.json(row);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: err.errors });
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/crm-tasks/:id", requireAdmin, async (req, res) => {
    try {
      const [row] = await db.update(crmTasks)
        .set(req.body)
        .where(eq(crmTasks.id, req.params.id as string))
        .returning();
      res.json(row);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ==========================================
  // CRM ACTIVITY LOG
  // ==========================================

  app.get("/api/admin/crm-activity/:presenceId", requireAdmin, async (req, res) => {
    try {
      const rows = await db.select().from(crmActivity)
        .where(eq(crmActivity.presenceId, req.params.presenceId as string))
        .orderBy(desc(crmActivity.createdAt));
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/crm-activity", requireAdmin, async (req, res) => {
    try {
      const adminId = (req.session as any).userId;
      const parsed = insertCrmActivitySchema.parse({ ...req.body, createdByUserId: adminId });
      const [row] = await db.insert(crmActivity).values(parsed).returning();
      res.json(row);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: err.errors });
      res.status(500).json({ message: err.message });
    }
  });

  // ==========================================
  // PRESENCE SPINE (claim, verification, tier)
  // ==========================================

  app.get("/api/admin/presence-spine/:presenceId", requireAdmin, async (req, res) => {
    try {
      const presenceId = req.params.presenceId as string;

      const [biz] = await db.select().from(businesses).where(eq(businesses.id, presenceId));
      if (!biz) return res.status(404).json({ message: "Presence not found" });

      const [crm] = await db.select().from(crmPresence).where(eq(crmPresence.presenceId, presenceId));
      const [regionAssign] = await db.select().from(presenceRegionAssignment).where(eq(presenceRegionAssignment.presenceId, presenceId));
      const [ownerAssign] = await db.select().from(presenceOwnerAssignment).where(eq(presenceOwnerAssignment.presenceId, presenceId));

      let regionName = null;
      if (regionAssign) {
        const [r] = await db.select().from(regions).where(eq(regions.id, regionAssign.primaryRegionId));
        regionName = r?.name;
      }

      let ownerName = null;
      if (ownerAssign) {
        const [u] = await db.select().from(users).where(eq(users.id, ownerAssign.ownerUserId));
        ownerName = u?.name || u?.email;
      }

      const subs = await db.select().from(presenceSubscriptions)
        .where(eq(presenceSubscriptions.presenceId, presenceId))
        .orderBy(desc(presenceSubscriptions.createdAt))
        .limit(1);

      const supporters = await db.select().from(orgSupporters)
        .where(eq(orgSupporters.orgPresenceId, presenceId));

      const activeSupporters = supporters.filter(s => s.status === "active").length;

      res.json({
        presenceId: biz.id,
        name: biz.name,
        claimStatus: biz.claimStatus,
        claimLabel: CLAIM_STATUS_MAPPING[biz.claimStatus as keyof typeof CLAIM_STATUS_MAPPING] || biz.claimStatus,
        charlotteVerificationStatus: biz.charlotteVerificationStatus,
        charlotteVerifiedAt: biz.charlotteVerifiedAt,
        micrositeTier: biz.micrositeTier,
        listingTier: biz.listingTier,
        publicLabel: derivePublicLabel(biz.claimStatus, biz.micrositeTier),
        presenceType: biz.presenceType,
        crm: crm || null,
        region: regionAssign ? { ...regionAssign, regionName } : null,
        owner: ownerAssign ? { ...ownerAssign, ownerName } : null,
        subscription: subs[0] || null,
        supporters: {
          total: supporters.length,
          active: activeSupporters,
          required: ORG_SUPPORTER_REQUIRED,
          list: supporters,
        },
        supporterGraceStartedAt: biz.supporterGraceStartedAt,
        supporterGraceEndAt: biz.supporterGraceEndAt,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ==========================================
  // CHARLOTTE VERIFICATION
  // ==========================================

  app.post("/api/admin/presence/:presenceId/charlotte-verify", requireAdmin, async (req, res) => {
    try {
      const presenceId = req.params.presenceId as string;
      const adminId = (req.session as any).userId;

      const [biz] = await db.select().from(businesses).where(eq(businesses.id, presenceId));
      if (!biz) return res.status(404).json({ message: "Presence not found" });

      const oldStatus = biz.charlotteVerificationStatus;
      const newStatus = "verified_by_charlotte";

      await db.update(businesses).set({
        charlotteVerificationStatus: newStatus,
        charlotteVerifiedAt: new Date(),
        charlotteVerifiedBy: adminId || "charlotte_ai",
        updatedAt: new Date(),
      }).where(eq(businesses.id, presenceId));

      await logPresenceFieldChange(
        { presenceId, actorType: "charlotte_ai", actorUserId: adminId, reason: "Charlotte walkthrough verified" },
        "charlotteVerificationStatus", oldStatus, newStatus,
      );

      await db.update(crmPresence).set({
        stage: "charlotte_verified",
        updatedAt: new Date(),
      }).where(eq(crmPresence.presenceId, presenceId));

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/presence/:presenceId/gift-charter", requireAdmin, async (req, res) => {
    try {
      const presenceId = req.params.presenceId as string;
      const adminId = (req.session as any).userId;

      const [biz] = await db.select().from(businesses).where(eq(businesses.id, presenceId));
      if (!biz) return res.status(404).json({ message: "Presence not found" });

      if (biz.claimStatus !== "CLAIMED") {
        return res.status(400).json({ message: "Cannot gift Enhanced to unclaimed presence. Must be claimed first." });
      }

      const oldTier = biz.micrositeTier;
      const now = new Date();
      const endAt = new Date(now);
      endAt.setFullYear(endAt.getFullYear() + 1);
      const graceEndAt = new Date(endAt);
      graceEndAt.setDate(graceEndAt.getDate() + GRACE_PERIOD_DAYS);

      await db.update(businesses).set({
        micrositeTier: "enhanced",
        micrositeEnabled: true,
        listingTier: "ENHANCED",
        updatedAt: now,
      }).where(eq(businesses.id, presenceId));

      await db.insert(presenceSubscriptions).values({
        presenceId,
        plan: "enhanced",
        priceTier: "founder",
        amountCents: PLAN_PRICING.enhanced.founderMonthly,
        status: "active",
        startAt: now,
        endAt,
        graceEndAt,
        founderLocked: true,
      });

      await logPresenceFieldChange(
        { presenceId, actorType: "charlotte_ai", actorUserId: adminId, reason: "Charlotte gifted Enhanced" },
        "micrositeTier", oldTier, "enhanced",
      );

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ==========================================
  // ASSIGN REGION / OWNER
  // ==========================================

  app.post("/api/admin/presence/:presenceId/assign-region", requireAdmin, async (req, res) => {
    try {
      const presenceId = req.params.presenceId as string;
      const adminId = (req.session as any).userId;
      const { regionId } = req.body;

      const existing = await db.select().from(presenceRegionAssignment)
        .where(eq(presenceRegionAssignment.presenceId, presenceId));

      if (existing.length > 0) {
        await logPresenceFieldChange(
          { presenceId, actorType: "admin", actorUserId: adminId },
          "primaryRegionId", existing[0].primaryRegionId, regionId,
        );
        const [row] = await db.update(presenceRegionAssignment)
          .set({ primaryRegionId: regionId, assignedAt: new Date(), assignedBy: adminId })
          .where(eq(presenceRegionAssignment.presenceId, presenceId))
          .returning();
        return res.json(row);
      }

      const [row] = await db.insert(presenceRegionAssignment).values({
        presenceId,
        primaryRegionId: regionId,
        assignedBy: adminId,
      }).returning();

      await logPresenceFieldChange(
        { presenceId, actorType: "admin", actorUserId: adminId },
        "primaryRegionId", null, regionId,
      );

      res.json(row);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/presence/:presenceId/assign-owner", requireAdmin, async (req, res) => {
    try {
      const presenceId = req.params.presenceId as string;
      const adminId = (req.session as any).userId;
      const { userId } = req.body;

      const existing = await db.select().from(presenceOwnerAssignment)
        .where(eq(presenceOwnerAssignment.presenceId, presenceId));

      if (existing.length > 0) {
        await logPresenceFieldChange(
          { presenceId, actorType: "admin", actorUserId: adminId },
          "ownerUserId", existing[0].ownerUserId, userId,
        );
        const [row] = await db.update(presenceOwnerAssignment)
          .set({ ownerUserId: userId, assignedAt: new Date(), assignedBy: adminId })
          .where(eq(presenceOwnerAssignment.presenceId, presenceId))
          .returning();
        return res.json(row);
      }

      const [row] = await db.insert(presenceOwnerAssignment).values({
        presenceId,
        ownerUserId: userId,
        assignedBy: adminId,
      }).returning();

      await logPresenceFieldChange(
        { presenceId, actorType: "admin", actorUserId: adminId },
        "ownerUserId", null, userId,
      );

      res.json(row);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ==========================================
  // AUDIT LOG
  // ==========================================

  app.get("/api/admin/presence-audit/:presenceId", requireAdmin, async (req, res) => {
    try {
      const rows = await db.select().from(presenceAuditLog)
        .where(eq(presenceAuditLog.presenceId, req.params.presenceId as string))
        .orderBy(desc(presenceAuditLog.changedAt));
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ==========================================
  // ORG SUPPORTERS
  // ==========================================

  app.get("/api/admin/org-supporters/:presenceId", requireAdmin, async (req, res) => {
    try {
      const rows = await db.select().from(orgSupporters)
        .where(eq(orgSupporters.orgPresenceId, req.params.presenceId as string))
        .orderBy(desc(orgSupporters.createdAt));
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/org-supporters", requireAdmin, async (req, res) => {
    try {
      const [row] = await db.insert(orgSupporters).values(req.body).returning();

      const presenceId = req.body.orgPresenceId;
      const adminId = (req.session as any).userId;
      await logPresenceFieldChange(
        { presenceId, actorType: "admin", actorUserId: adminId, reason: "Supporter added" },
        "org_supporter_added", null, req.body.supporterName || req.body.supporterPresenceId,
      );

      res.json(row);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ==========================================
  // SUBSCRIPTIONS
  // ==========================================

  app.get("/api/admin/presence-subscriptions/:presenceId", requireAdmin, async (req, res) => {
    try {
      const rows = await db.select().from(presenceSubscriptions)
        .where(eq(presenceSubscriptions.presenceId, req.params.presenceId as string))
        .orderBy(desc(presenceSubscriptions.createdAt));
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ==========================================
  // PRESENCE SPINE UPDATE (admin changes to tier/claim/verification)
  // ==========================================

  app.patch("/api/admin/presence-spine/:presenceId", requireAdmin, async (req, res) => {
    try {
      const presenceId = req.params.presenceId as string;
      const adminId = (req.session as any).userId;

      const [biz] = await db.select().from(businesses).where(eq(businesses.id, presenceId));
      if (!biz) return res.status(404).json({ message: "Presence not found" });

      const updates: Record<string, any> = {};
      const auditCtx = { presenceId, actorType: "admin" as const, actorUserId: adminId };

      if (req.body.micrositeTier && req.body.micrositeTier !== biz.micrositeTier) {
        await logPresenceFieldChange(auditCtx, "micrositeTier", biz.micrositeTier, req.body.micrositeTier);
        updates.micrositeTier = req.body.micrositeTier;
        if (req.body.micrositeTier === "enhanced" || req.body.micrositeTier === "charter") {
          updates.micrositeEnabled = true;
          updates.listingTier = "ENHANCED";
        } else {
          updates.micrositeEnabled = false;
          if (biz.listingTier === "ENHANCED" || biz.listingTier === "CHARTER") {
            updates.listingTier = "VERIFIED";
          }
        }
      }

      if (req.body.claimStatus && req.body.claimStatus !== biz.claimStatus) {
        await logPresenceFieldChange(auditCtx, "claimStatus", biz.claimStatus, req.body.claimStatus);
        updates.claimStatus = req.body.claimStatus;
        if (req.body.claimStatus === "CLAIMED") {
          updates.claimedAt = new Date();
        }
      }

      if (req.body.charlotteVerificationStatus && req.body.charlotteVerificationStatus !== biz.charlotteVerificationStatus) {
        await logPresenceFieldChange(auditCtx, "charlotteVerificationStatus", biz.charlotteVerificationStatus, req.body.charlotteVerificationStatus);
        updates.charlotteVerificationStatus = req.body.charlotteVerificationStatus;
        if (req.body.charlotteVerificationStatus === "verified_by_charlotte") {
          updates.charlotteVerifiedAt = new Date();
          updates.charlotteVerifiedBy = adminId;
        }
      }

      if (Object.keys(updates).length > 0) {
        updates.updatedAt = new Date();
        await db.update(businesses).set(updates).where(eq(businesses.id, presenceId));
      }

      const [updated] = await db.select().from(businesses).where(eq(businesses.id, presenceId));
      res.json({
        ...updated,
        publicLabel: derivePublicLabel(updated.claimStatus, updated.micrositeTier),
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
