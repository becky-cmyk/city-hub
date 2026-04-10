import { Router, Request, Response, RequestHandler } from "express";
import { z } from "zod";
import { db } from "./db";
import { profileBadges, trustStatusHistory } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  computeTrustProfile,
  getTrustProfile,
  getTrustHistory,
  updateOperationalStatus,
  addContextLabel,
  removeContextLabel,
  runDecayDetection,
  recoverBusiness,
  computeAllTrustProfiles,
  checkNetworkEligibility,
  updateStoryTrustFields,
} from "./trust-service";

const updateStatusSchema = z.object({
  status: z.enum(["eligible", "qualified", "active", "needs_attention", "at_risk", "paused", "removed"]),
  reason: z.string().min(1, "reason is required"),
});

const addLabelSchema = z.object({
  label: z.string().min(1, "label is required"),
});

const recoverSchema = z.object({
  reason: z.string().min(1, "reason is required"),
});

const storyFieldsSchema = z.object({
  serviceClarity: z.number().min(0).max(100),
  localRelevance: z.number().min(0).max(100),
  communityInvolvement: z.number().min(0).max(100),
});

const computeAllSchema = z.object({
  cityId: z.string().optional(),
});

export function registerTrustRoutes(app: Router, requireAdmin: RequestHandler) {
  app.get("/api/businesses/:id/trust", async (req: Request, res: Response) => {
    try {
      const profile = await getTrustProfile(req.params.id);
      if (!profile) {
        return res.status(404).json({ error: "Trust profile not found" });
      }
      res.json(profile);
    } catch (err: any) {
      console.error("[Trust] GET profile error:", err);
      res.status(500).json({ error: "Failed to retrieve trust profile" });
    }
  });

  app.get("/api/businesses/:id/trust/eligibility", async (req: Request, res: Response) => {
    try {
      const result = await checkNetworkEligibility(req.params.id);
      res.json(result);
    } catch (err: any) {
      console.error("[Trust] GET eligibility error:", err);
      res.status(500).json({ error: "Failed to check network eligibility" });
    }
  });

  app.get("/api/admin/businesses/:id/trust", requireAdmin, async (req: Request, res: Response) => {
    try {
      const businessId = req.params.id;
      let profile = await getTrustProfile(businessId);

      if (!profile) {
        profile = await computeTrustProfile(businessId);
        if (!profile) {
          return res.status(404).json({ error: "Business not found" });
        }
      }

      const badges = await db.select().from(profileBadges)
        .where(and(eq(profileBadges.businessId, businessId), eq(profileBadges.enabled, true)))
        .orderBy(profileBadges.displayOrder);

      const history = await getTrustHistory(profile.id, 20);

      res.json({ profile, badges, history });
    } catch (err: any) {
      console.error("[Trust] GET admin trust summary error:", err);
      res.status(500).json({ error: "Failed to retrieve trust data" });
    }
  });

  app.post("/api/admin/businesses/:id/trust/compute", requireAdmin, async (req: Request, res: Response) => {
    try {
      const profile = await computeTrustProfile(req.params.id);
      if (!profile) {
        return res.status(404).json({ error: "Business not found" });
      }
      res.json(profile);
    } catch (err: any) {
      console.error("[Trust] POST compute error:", err);
      res.status(500).json({ error: "Failed to compute trust profile" });
    }
  });

  app.get("/api/admin/businesses/:id/trust/history", requireAdmin, async (req: Request, res: Response) => {
    try {
      const profile = await getTrustProfile(req.params.id);
      if (!profile) {
        return res.status(404).json({ error: "Trust profile not found" });
      }
      const limit = parseInt(req.query.limit as string) || 50;
      const history = await getTrustHistory(profile.id, limit);
      res.json(history);
    } catch (err: any) {
      console.error("[Trust] GET history error:", err);
      res.status(500).json({ error: "Failed to retrieve trust history" });
    }
  });

  app.patch("/api/admin/businesses/:id/trust/status", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = updateStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues.map(i => i.message).join(", ") });
      }
      const { status, reason } = parsed.data;
      const changedBy = (req.session as Record<string, string>).userId || "admin";
      const profile = await updateOperationalStatus(req.params.id, status, reason, changedBy);
      if (!profile) {
        return res.status(404).json({ error: "Trust profile not found" });
      }
      res.json(profile);
    } catch (err: any) {
      console.error("[Trust] PATCH status error:", err);
      res.status(500).json({ error: "Failed to update operational status" });
    }
  });

  app.post("/api/admin/businesses/:id/trust/status", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = updateStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues.map(i => i.message).join(", ") });
      }
      const { status, reason } = parsed.data;
      const changedBy = (req.session as Record<string, string>).userId || "admin";
      const profile = await updateOperationalStatus(req.params.id, status, reason, changedBy);
      if (!profile) {
        return res.status(404).json({ error: "Trust profile not found" });
      }
      res.json(profile);
    } catch (err: any) {
      console.error("[Trust] POST status error:", err);
      res.status(500).json({ error: "Failed to update operational status" });
    }
  });

  app.post("/api/admin/businesses/:id/trust/recompute", requireAdmin, async (req: Request, res: Response) => {
    try {
      const profile = await computeTrustProfile(req.params.id);
      if (!profile) {
        return res.status(404).json({ error: "Business not found" });
      }
      res.json(profile);
    } catch (err: any) {
      console.error("[Trust] POST recompute error:", err);
      res.status(500).json({ error: "Failed to recompute trust profile" });
    }
  });

  app.post("/api/admin/businesses/:id/trust/labels", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = addLabelSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues.map(i => i.message).join(", ") });
      }
      const profile = await addContextLabel(req.params.id, parsed.data.label);
      if (!profile) {
        return res.status(404).json({ error: "Trust profile not found" });
      }
      res.json(profile);
    } catch (err: any) {
      console.error("[Trust] POST label error:", err);
      res.status(500).json({ error: "Failed to add context label" });
    }
  });

  app.delete("/api/admin/businesses/:id/trust/labels/:label", requireAdmin, async (req: Request, res: Response) => {
    try {
      const profile = await removeContextLabel(req.params.id, decodeURIComponent(req.params.label));
      if (!profile) {
        return res.status(404).json({ error: "Trust profile not found" });
      }
      res.json(profile);
    } catch (err: any) {
      console.error("[Trust] DELETE label error:", err);
      res.status(500).json({ error: "Failed to remove context label" });
    }
  });

  app.post("/api/admin/businesses/:id/trust/recover", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = recoverSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues.map(i => i.message).join(", ") });
      }
      const changedBy = (req.session as Record<string, string>).userId || "admin";
      const profile = await recoverBusiness(req.params.id, parsed.data.reason, changedBy);
      if (!profile) {
        return res.status(404).json({ error: "Business not found" });
      }
      res.json(profile);
    } catch (err: any) {
      console.error("[Trust] POST recover error:", err);
      res.status(500).json({ error: "Failed to recover business" });
    }
  });

  app.post("/api/admin/businesses/:id/trust/story-fields", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = storyFieldsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues.map(i => i.message).join(", ") });
      }
      const profile = await updateStoryTrustFields(req.params.id, parsed.data);
      if (!profile) {
        return res.status(404).json({ error: "Business not found" });
      }
      res.json(profile);
    } catch (err: any) {
      console.error("[Trust] POST story-fields error:", err);
      res.status(500).json({ error: "Failed to update story trust fields" });
    }
  });

  app.post("/api/admin/trust/compute-all", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = computeAllSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues.map(i => i.message).join(", ") });
      }
      const result = await computeAllTrustProfiles(parsed.data.cityId);
      res.json(result);
    } catch (err: any) {
      console.error("[Trust] POST compute-all error:", err);
      res.status(500).json({ error: "Failed to compute trust profiles" });
    }
  });

  app.post("/api/admin/trust/decay-scan", requireAdmin, async (req: Request, res: Response) => {
    try {
      const result = await runDecayDetection();
      res.json(result);
    } catch (err: any) {
      console.error("[Trust] POST decay-scan error:", err);
      res.status(500).json({ error: "Failed to run decay scan" });
    }
  });
}
