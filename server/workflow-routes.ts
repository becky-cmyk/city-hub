import type { Express, Request, Response, NextFunction } from "express";
import { workflowEngine, hashSessionSecret, generateSessionSecret, VALID_EVENT_TYPES } from "./workflow-engine";
import { storage } from "./storage";
import { z } from "zod";
import rateLimit from "express-rate-limit";

const workflowStartLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many workflow requests, please try again later" },
});

const workflowMutateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});

const ALLOWED_SESSION_UPDATE_KEYS = new Set([
  "contactEmail",
  "contactPhone",
  "contactName",
  "businessName",
  "entityId",
  "entityType",
  "presenceType",
  "matchedBusinessId",
  "identityRole",
]);

async function validateSessionOwnership(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { id } = req.params;
  if (!z.string().uuid().safeParse(id).success) {
    res.status(400).json({ error: "Invalid session ID" });
    return;
  }
  const secret = req.headers["x-workflow-secret"] as string | undefined;
  if (!secret) {
    res.status(401).json({ error: "Session secret required" });
    return;
  }
  const session = await storage.getWorkflowSession(id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  if (!session.sessionSecretHash) {
    next();
    return;
  }
  const providedHash = hashSessionSecret(secret);
  if (providedHash !== session.sessionSecretHash) {
    res.status(403).json({ error: "Invalid session secret" });
    return;
  }
  next();
}

function sanitizeSessionUpdates(
  raw: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  const sanitized: Record<string, unknown> = {};
  for (const key of Object.keys(raw)) {
    if (ALLOWED_SESSION_UPDATE_KEYS.has(key)) {
      sanitized[key] = raw[key];
    }
  }
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

export function registerWorkflowRoutes(
  app: Express,
  requireAdmin: (req: Request, res: Response, next: () => void) => void
): void {
  app.post("/api/workflow/start", workflowStartLimiter, async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        cityId: z.string().uuid(),
        source: z.enum(["activate", "claim", "story", "crown", "qr", "cta", "event", "job", "publication"]),
        contactEmail: z.string().email().optional(),
        contactPhone: z.string().max(30).optional(),
        contactName: z.string().max(200).optional(),
        businessName: z.string().max(300).optional(),
        entityId: z.string().uuid().optional(),
        entityType: z.string().max(50).optional(),
        presenceType: z.string().max(50).optional(),
        chatSessionId: z.string().uuid().optional(),
        sessionData: z.record(z.unknown()).optional(),
        existingSessionSecret: z.string().max(200).optional(),
        listingSlug: z.string().max(300).optional(),
        crownCategoryId: z.string().uuid().optional(),
        qrCodeId: z.string().max(100).optional(),
        eventId: z.string().uuid().optional(),
        jobId: z.string().uuid().optional(),
        ctaRef: z.string().max(200).optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const result = await workflowEngine.startSession(parsed.data);
      const response: Record<string, unknown> = {
        sessionId: result.session.id,
        currentStep: result.entryStep,
        status: result.session.status,
        resumed: result.resumed,
      };
      if (result.sessionSecret) {
        response.sessionSecret = result.sessionSecret;
      }
      res.json(response);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to start workflow";
      console.error("[WORKFLOW] Start error:", message);
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/workflow/:id/advance", workflowMutateLimiter, validateSessionOwnership, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!z.string().uuid().safeParse(id).success) {
        return res.status(400).json({ error: "Invalid session ID" });
      }

      const schema = z.object({
        toStep: z.enum([
          "entry", "match", "account_check", "verification", "attach_ownership",
          "identity_router", "basic_activation", "story_builder", "capability_activation",
          "hub_category_setup", "trust_signals", "trusted_network_check", "first_action", "complete",
        ]),
        eventData: z.record(z.unknown()).optional(),
        sessionUpdates: z.record(z.unknown()).optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const result = await workflowEngine.advanceStep(
        id,
        parsed.data.toStep,
        parsed.data.eventData,
        sanitizeSessionUpdates(parsed.data.sessionUpdates as Record<string, unknown> | undefined)
      );

      if (parsed.data.toStep === "complete") {
        workflowEngine.generateRecommendations(id).catch((err) => {
          console.error("[WORKFLOW] Recommendation generation on advance failed:", (err as Error).message);
        });
      }

      res.json({
        sessionId: result.session.id,
        currentStep: result.session.currentStep,
        status: result.session.status,
        eventId: result.event.id,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to advance step";
      console.error("[WORKFLOW] Advance error:", message);
      res.status(400).json({ error: message });
    }
  });

  app.post("/api/workflow/:id/skip", workflowMutateLimiter, validateSessionOwnership, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!z.string().uuid().safeParse(id).success) {
        return res.status(400).json({ error: "Invalid session ID" });
      }

      const schema = z.object({
        toStep: z.enum([
          "entry", "match", "account_check", "verification", "attach_ownership",
          "identity_router", "basic_activation", "story_builder", "capability_activation",
          "hub_category_setup", "trust_signals", "trusted_network_check", "first_action", "complete",
        ]),
        reason: z.string().max(500).default("User skipped via form"),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const { session, event } = await workflowEngine.skipToStep(id, parsed.data.toStep, parsed.data.reason);

      if (parsed.data.toStep === "complete") {
        workflowEngine.generateRecommendations(id).catch((err) => {
          console.error("[WORKFLOW] Recommendation generation failed:", (err as Error).message);
        });
      }

      res.json({ session: { id: session.id, currentStep: session.currentStep, status: session.status }, event });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to skip step";
      console.error("[WORKFLOW] Skip error:", message);
      res.status(400).json({ error: message });
    }
  });

  app.get("/api/workflow/:id", workflowMutateLimiter, validateSessionOwnership, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!z.string().uuid().safeParse(id).success) {
        return res.status(400).json({ error: "Invalid session ID" });
      }

      const result = await workflowEngine.getSessionWithEvents(id);
      if (!result) {
        return res.status(404).json({ error: "Session not found" });
      }

      res.json({
        session: {
          id: result.session.id,
          source: result.session.source,
          currentStep: result.session.currentStep,
          status: result.session.status,
          businessName: result.session.businessName,
          contactName: result.session.contactName,
          contactEmail: result.session.contactEmail,
          contactPhone: result.session.contactPhone,
          identityRole: result.session.identityRole,
          presenceType: result.session.presenceType,
          matchedBusinessId: result.session.matchedBusinessId,
          entityId: result.session.entityId,
          createdAt: result.session.createdAt,
          updatedAt: result.session.updatedAt,
        },
        events: result.events,
        nextStep: result.nextStep,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to get session";
      console.error("[WORKFLOW] Get error:", message);
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/workflow/:id/match-business", workflowMutateLimiter, validateSessionOwnership, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!z.string().uuid().safeParse(id).success) {
        return res.status(400).json({ error: "Invalid session ID" });
      }

      const schema = z.object({
        name: z.string().min(1).max(300),
        city: z.string().min(1).max(200),
        websiteOrSocial: z.string().max(500).optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const result = await workflowEngine.matchOrCreateBusiness(id, parsed.data);
      res.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to match business";
      console.error("[WORKFLOW] Match error:", message);
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/workflow/:id/identity", workflowMutateLimiter, validateSessionOwnership, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!z.string().uuid().safeParse(id).success) {
        return res.status(400).json({ error: "Invalid session ID" });
      }

      const schema = z.object({
        role: z.enum([
          "owner", "manager", "employee", "marketing_rep",
          "executive_director", "board_member", "volunteer",
          "host", "organizer", "creator", "contributor",
        ]),
        presenceType: z.enum(["commerce", "organization"]).optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }

      await workflowEngine.setIdentityRole(id, parsed.data.role, parsed.data.presenceType);
      const session = await storage.getWorkflowSession(id);
      res.json({ identityRole: session?.identityRole, presenceType: session?.presenceType });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to set identity";
      console.error("[WORKFLOW] Identity error:", message);
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/workflow/:id/event", workflowMutateLimiter, validateSessionOwnership, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!z.string().uuid().safeParse(id).success) {
        return res.status(400).json({ error: "Invalid session ID" });
      }
      const { eventType, eventData } = req.body;
      if (!eventType || typeof eventType !== "string") {
        return res.status(400).json({ error: "eventType is required" });
      }
      if (!(VALID_EVENT_TYPES as readonly string[]).includes(eventType)) {
        return res.status(400).json({ error: `Invalid eventType. Must be one of: ${VALID_EVENT_TYPES.join(", ")}` });
      }
      const event = await workflowEngine.recordEvent(id, eventType as typeof VALID_EVENT_TYPES[number], eventData || {});
      res.json({ eventId: event.id });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to record event";
      console.error("[WORKFLOW] Event error:", message);
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/workflow/:id/pause", workflowMutateLimiter, validateSessionOwnership, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!z.string().uuid().safeParse(id).success) {
        return res.status(400).json({ error: "Invalid session ID" });
      }

      const session = await workflowEngine.pauseSession(id, req.body.reason);
      res.json({ sessionId: session.id, status: session.status });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to pause session";
      res.status(400).json({ error: message });
    }
  });

  app.post("/api/workflow/:id/resume", workflowMutateLimiter, validateSessionOwnership, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!z.string().uuid().safeParse(id).success) {
        return res.status(400).json({ error: "Invalid session ID" });
      }

      const session = await workflowEngine.resumeSession(id);
      res.json({ sessionId: session.id, status: session.status, currentStep: session.currentStep });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to resume session";
      res.status(400).json({ error: message });
    }
  });

  app.get("/api/admin/workflow-sessions", requireAdmin, async (req: Request, res: Response) => {
    try {
      const cityId = (req.query.cityId as string) || "";
      if (!cityId || !z.string().uuid().safeParse(cityId).success) {
        return res.status(400).json({ error: "Valid cityId is required" });
      }

      const user = (req as Record<string, unknown>).user as { role?: string; cityId?: string } | undefined;
      if (user?.role !== "SUPER_ADMIN" && user?.cityId && user.cityId !== cityId) {
        return res.status(403).json({ error: "Not authorized for this city" });
      }

      const filters = {
        source: req.query.source as string | undefined,
        status: req.query.status as string | undefined,
        presenceType: req.query.presenceType as string | undefined,
        limit: Math.min(req.query.limit ? parseInt(req.query.limit as string, 10) : 50, 100),
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
      };

      const result = await storage.getWorkflowSessionsByCity(cityId, filters);
      res.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to list sessions";
      console.error("[WORKFLOW] List error:", message);
      res.status(500).json({ error: message });
    }
  });

  app.get("/api/admin/workflow-sessions/:id/events", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!z.string().uuid().safeParse(id).success) {
        return res.status(400).json({ error: "Invalid session ID" });
      }

      const session = await storage.getWorkflowSession(id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      const user = (req as Record<string, unknown>).user as { role?: string; cityId?: string } | undefined;
      if (user?.role !== "SUPER_ADMIN" && user?.cityId && user.cityId !== session.cityId) {
        return res.status(403).json({ error: "Not authorized for this session" });
      }

      const events = await storage.getWorkflowEvents(id);
      res.json({ events });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to get events";
      console.error("[WORKFLOW] Events error:", message);
      res.status(500).json({ error: message });
    }
  });

  app.get("/api/workflow/:id/recommendations", validateSessionOwnership, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!z.string().uuid().safeParse(id).success) {
        return res.status(400).json({ error: "Invalid session ID" });
      }
      const session = await storage.getWorkflowSession(id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      const recommendations = await storage.getWorkflowActionRecommendations(id);
      res.json({ recommendations });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to get recommendations";
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/workflow/:id/recommendations/:recId/dismiss", workflowMutateLimiter, validateSessionOwnership, async (req: Request, res: Response) => {
    try {
      const { id, recId } = req.params;
      if (!z.string().uuid().safeParse(id).success || !z.string().uuid().safeParse(recId).success) {
        return res.status(400).json({ error: "Invalid ID" });
      }
      const recs = await storage.getWorkflowActionRecommendations(id);
      const belongs = recs.some((r) => r.id === recId);
      if (!belongs) {
        return res.status(404).json({ error: "Recommendation not found for this session" });
      }
      await storage.dismissWorkflowActionRecommendation(recId);
      res.json({ dismissed: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to dismiss";
      res.status(500).json({ error: message });
    }
  });

  app.get("/api/workflow/:id/follow-ups", validateSessionOwnership, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!z.string().uuid().safeParse(id).success) {
        return res.status(400).json({ error: "Invalid session ID" });
      }
      const followUps = await storage.getWorkflowFollowUps(id);
      res.json({ followUps });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to get follow-ups";
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/workflow/:id/follow-ups", workflowMutateLimiter, validateSessionOwnership, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!z.string().uuid().safeParse(id).success) {
        return res.status(400).json({ error: "Invalid session ID" });
      }
      const body = z.object({
        channel: z.enum(["email", "sms", "internal_task", "voice"]),
        message: z.string().min(1).max(2000),
        delayMs: z.number().int().min(0).max(30 * 24 * 60 * 60 * 1000).default(0),
      }).parse(req.body);

      await workflowEngine.scheduleFollowUp(id, body.channel, body.message, body.delayMs);
      res.json({ scheduled: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to schedule follow-up";
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/workflow/:id/generate-recommendations", workflowMutateLimiter, validateSessionOwnership, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!z.string().uuid().safeParse(id).success) {
        return res.status(400).json({ error: "Invalid session ID" });
      }
      await workflowEngine.generateRecommendations(id);
      const recommendations = await storage.getWorkflowActionRecommendations(id);
      res.json({ recommendations });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to generate recommendations";
      res.status(500).json({ error: message });
    }
  });
}
