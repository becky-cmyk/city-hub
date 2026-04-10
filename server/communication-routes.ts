import { type Express, type Request, type Response } from "express";
import { db } from "./db";
import {
  smsTemplates, voicePrompts, communicationSequences, sequenceSteps,
  commsLog, crmContacts,
} from "@shared/schema";
import { eq, and, desc, sql, count } from "drizzle-orm";
import { z } from "zod";

function requireAdminSession(req: Request, res: Response, next: Function) {
  const session = (req as Record<string, unknown>).session as Record<string, unknown> | undefined;
  if (!session?.userId) return res.status(401).json({ error: "Admin session required" });
  next();
}

export function registerCommunicationRoutes(app: Express, requireAdmin: Function) {

  app.get("/api/admin/comm/sms-templates", requireAdmin, requireAdminSession, async (_req: Request, res: Response) => {
    try {
      const templates = await db.select().from(smsTemplates).orderBy(desc(smsTemplates.createdAt));
      res.json(templates);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/admin/comm/sms-templates", requireAdmin, requireAdminSession, async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        name: z.string().min(1),
        body: z.string().min(1),
        category: z.enum(["INTRO", "FOLLOW_UP", "BOOKING_REMINDER", "CLAIM_PROMPT", "WELCOME", "CUSTOM"]).default("CUSTOM"),
        cityId: z.string().nullable().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid data", details: parsed.error.errors });

      const [template] = await db.insert(smsTemplates).values({
        name: parsed.data.name,
        body: parsed.data.body,
        category: parsed.data.category,
        charCount: parsed.data.body.length,
        cityId: parsed.data.cityId || null,
      }).returning();

      res.json(template);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: msg });
    }
  });

  app.patch("/api/admin/comm/sms-templates/:id", requireAdmin, requireAdminSession, async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        name: z.string().min(1).optional(),
        body: z.string().min(1).optional(),
        category: z.enum(["INTRO", "FOLLOW_UP", "BOOKING_REMINDER", "CLAIM_PROMPT", "WELCOME", "CUSTOM"]).optional(),
        isActive: z.boolean().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid data", details: parsed.error.errors });

      const [existing] = await db.select({ id: smsTemplates.id }).from(smsTemplates).where(eq(smsTemplates.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ error: "Template not found" });

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (parsed.data.name !== undefined) updates.name = parsed.data.name;
      if (parsed.data.body !== undefined) { updates.body = parsed.data.body; updates.charCount = parsed.data.body.length; }
      if (parsed.data.category !== undefined) updates.category = parsed.data.category;
      if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

      await db.update(smsTemplates).set(updates).where(eq(smsTemplates.id, req.params.id));
      res.json({ success: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: msg });
    }
  });

  app.delete("/api/admin/comm/sms-templates/:id", requireAdmin, requireAdminSession, async (req: Request, res: Response) => {
    try {
      const [existing] = await db.select({ id: smsTemplates.id }).from(smsTemplates).where(eq(smsTemplates.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ error: "Template not found" });
      await db.delete(smsTemplates).where(eq(smsTemplates.id, req.params.id));
      res.json({ success: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: msg });
    }
  });

  app.get("/api/admin/comm/voice-prompts", requireAdmin, requireAdminSession, async (_req: Request, res: Response) => {
    try {
      const prompts = await db.select().from(voicePrompts).orderBy(desc(voicePrompts.createdAt));
      res.json(prompts);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/admin/comm/voice-prompts", requireAdmin, requireAdminSession, async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        name: z.string().min(1),
        promptType: z.enum(["GREETING", "VOICEMAIL", "IVR_MENU", "ESCALATION", "FOLLOW_UP"]),
        scriptText: z.string().min(1),
        ssmlMarkup: z.string().nullable().optional(),
        voiceProfileId: z.string().nullable().optional(),
        callTrigger: z.enum(["INBOUND_CALL", "OUTBOUND_CAMPAIGN", "MISSED_CALL_CALLBACK", "SCHEDULED_FOLLOWUP", "MANUAL"]).default("MANUAL"),
        cityId: z.string().nullable().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid data", details: parsed.error.errors });

      const [prompt] = await db.insert(voicePrompts).values({
        name: parsed.data.name,
        promptType: parsed.data.promptType,
        scriptText: parsed.data.scriptText,
        ssmlMarkup: parsed.data.ssmlMarkup || null,
        voiceProfileId: parsed.data.voiceProfileId || null,
        callTrigger: parsed.data.callTrigger,
        cityId: parsed.data.cityId || null,
      }).returning();

      res.json(prompt);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: msg });
    }
  });

  app.patch("/api/admin/comm/voice-prompts/:id", requireAdmin, requireAdminSession, async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        name: z.string().min(1).optional(),
        scriptText: z.string().min(1).optional(),
        ssmlMarkup: z.string().nullable().optional(),
        isActive: z.boolean().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid data", details: parsed.error.errors });

      const [existing] = await db.select({ id: voicePrompts.id }).from(voicePrompts).where(eq(voicePrompts.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ error: "Voice prompt not found" });

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (parsed.data.name !== undefined) updates.name = parsed.data.name;
      if (parsed.data.scriptText !== undefined) updates.scriptText = parsed.data.scriptText;
      if (parsed.data.ssmlMarkup !== undefined) updates.ssmlMarkup = parsed.data.ssmlMarkup;
      if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

      await db.update(voicePrompts).set(updates).where(eq(voicePrompts.id, req.params.id));
      res.json({ success: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: msg });
    }
  });

  app.delete("/api/admin/comm/voice-prompts/:id", requireAdmin, requireAdminSession, async (req: Request, res: Response) => {
    try {
      const [existing] = await db.select({ id: voicePrompts.id }).from(voicePrompts).where(eq(voicePrompts.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ error: "Voice prompt not found" });
      await db.delete(voicePrompts).where(eq(voicePrompts.id, req.params.id));
      res.json({ success: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: msg });
    }
  });

  app.get("/api/admin/comm/sequences", requireAdmin, requireAdminSession, async (_req: Request, res: Response) => {
    try {
      const sequences = await db.select().from(communicationSequences).orderBy(desc(communicationSequences.createdAt));
      const allSteps = await db.select().from(sequenceSteps).orderBy(sequenceSteps.stepOrder);

      const stepsMap: Record<string, typeof allSteps> = {};
      for (const step of allSteps) {
        if (!stepsMap[step.sequenceId]) stepsMap[step.sequenceId] = [];
        stepsMap[step.sequenceId].push(step);
      }

      const result = sequences.map(seq => ({
        ...seq,
        steps: stepsMap[seq.id] || [],
      }));
      res.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/admin/comm/sequences", requireAdmin, requireAdminSession, async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        name: z.string().min(1),
        description: z.string().nullable().optional(),
        triggerEvent: z.string().default("CONTACT_CREATED"),
        cityId: z.string().nullable().optional(),
        steps: z.array(z.object({
          channel: z.enum(["EMAIL", "SMS", "VOICE"]),
          templateId: z.string().nullable().optional(),
          voicePromptId: z.string().nullable().optional(),
          delayMinutes: z.number().int().min(0).default(0),
          fallbackChannel: z.enum(["EMAIL", "SMS", "VOICE"]).nullable().optional(),
          conditionType: z.enum(["ALWAYS", "NO_RESPONSE", "NO_OPEN"]).default("ALWAYS"),
        })).default([]),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid data", details: parsed.error.errors });

      const [sequence] = await db.insert(communicationSequences).values({
        name: parsed.data.name,
        description: parsed.data.description || null,
        triggerEvent: parsed.data.triggerEvent,
        cityId: parsed.data.cityId || null,
      }).returning();

      if (parsed.data.steps.length > 0) {
        await db.insert(sequenceSteps).values(
          parsed.data.steps.map((step, idx) => ({
            sequenceId: sequence.id,
            stepOrder: idx + 1,
            channel: step.channel,
            templateId: step.templateId || null,
            voicePromptId: step.voicePromptId || null,
            delayMinutes: step.delayMinutes,
            fallbackChannel: step.fallbackChannel || null,
            conditionType: step.conditionType,
          }))
        );
      }

      const steps = await db.select().from(sequenceSteps).where(eq(sequenceSteps.sequenceId, sequence.id)).orderBy(sequenceSteps.stepOrder);
      res.json({ ...sequence, steps });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: msg });
    }
  });

  app.patch("/api/admin/comm/sequences/:id", requireAdmin, requireAdminSession, async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        name: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"]).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid data", details: parsed.error.errors });

      const [existing] = await db.select({ id: communicationSequences.id }).from(communicationSequences).where(eq(communicationSequences.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ error: "Sequence not found" });

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (parsed.data.name !== undefined) updates.name = parsed.data.name;
      if (parsed.data.description !== undefined) updates.description = parsed.data.description;
      if (parsed.data.status !== undefined) updates.status = parsed.data.status;

      await db.update(communicationSequences).set(updates).where(eq(communicationSequences.id, req.params.id));
      res.json({ success: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: msg });
    }
  });

  app.delete("/api/admin/comm/sequences/:id", requireAdmin, requireAdminSession, async (req: Request, res: Response) => {
    try {
      const [existing] = await db.select({ id: communicationSequences.id }).from(communicationSequences).where(eq(communicationSequences.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ error: "Sequence not found" });
      await db.delete(sequenceSteps).where(eq(sequenceSteps.sequenceId, req.params.id));
      await db.delete(communicationSequences).where(eq(communicationSequences.id, req.params.id));
      res.json({ success: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: msg });
    }
  });

  app.get("/api/admin/communications", requireAdmin, requireAdminSession, async (req: Request, res: Response) => {
    return res.redirect(307, "/api/admin/comm/channel-health");
  });

  app.get("/api/admin/comm/channel-health", requireAdmin, requireAdminSession, async (_req: Request, res: Response) => {
    try {
      const [smsTemplateCount] = await db.select({ total: count() }).from(smsTemplates).where(eq(smsTemplates.isActive, true));
      const [voicePromptCount] = await db.select({ total: count() }).from(voicePrompts).where(eq(voicePrompts.isActive, true));
      const [sequenceCount] = await db.select({ total: count() }).from(communicationSequences);

      const recentEmailsSent = await db.select({ total: count() }).from(commsLog)
        .where(and(eq(commsLog.channel, "EMAIL"), eq(commsLog.status, "SENT")));
      const recentSmsSent = await db.select({ total: count() }).from(commsLog)
        .where(and(eq(commsLog.channel, "SMS"), eq(commsLog.status, "SENT")));
      const recentFailed = await db.select({ total: count() }).from(commsLog)
        .where(eq(commsLog.status, "FAILED"));

      const contactsWithPhone = await db.select({ total: count() }).from(crmContacts)
        .where(sql`${crmContacts.phone} IS NOT NULL AND ${crmContacts.phone} != ''`);
      const contactsWithEmail = await db.select({ total: count() }).from(crmContacts)
        .where(sql`${crmContacts.email} IS NOT NULL AND ${crmContacts.email} != ''`);

      res.json({
        channels: {
          email: { enabled: true, recentSent: recentEmailsSent[0]?.total || 0, contactsReachable: contactsWithEmail[0]?.total || 0 },
          sms: { enabled: true, recentSent: recentSmsSent[0]?.total || 0, contactsReachable: contactsWithPhone[0]?.total || 0 },
          voice: { enabled: false, recentSent: 0, contactsReachable: contactsWithPhone[0]?.total || 0 },
        },
        templates: { sms: smsTemplateCount?.total || 0, voicePrompts: voicePromptCount?.total || 0 },
        sequences: sequenceCount?.total || 0,
        delivery: { failed: recentFailed[0]?.total || 0 },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/admin/comm/trigger-sequence", requireAdmin, requireAdminSession, async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        sequenceId: z.string().min(1),
        contactId: z.string().min(1),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid data", details: parsed.error.errors });

      const [sequence] = await db.select().from(communicationSequences).where(eq(communicationSequences.id, parsed.data.sequenceId)).limit(1);
      if (!sequence) return res.status(404).json({ error: "Sequence not found" });
      if (sequence.status !== "ACTIVE") return res.status(400).json({ error: "Sequence is not active" });

      const [contact] = await db.select({ id: crmContacts.id, preferredChannel: crmContacts.preferredChannel }).from(crmContacts).where(eq(crmContacts.id, parsed.data.contactId)).limit(1);
      if (!contact) return res.status(404).json({ error: "Contact not found" });

      const steps = await db.select().from(sequenceSteps).where(eq(sequenceSteps.sequenceId, parsed.data.sequenceId)).orderBy(sequenceSteps.stepOrder);

      res.json({
        triggered: true,
        sequenceId: sequence.id,
        sequenceName: sequence.name,
        contactId: contact.id,
        preferredChannel: contact.preferredChannel,
        stepsQueued: steps.length,
        note: "Sequence execution engine not yet implemented — steps are queued structurally",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: msg });
    }
  });
}

export function resolvePreferredChannel(email: string | null | undefined, phone: string | null | undefined): string {
  if (email) return "EMAIL";
  if (phone && phone.length >= 10) return "SMS";
  return "EMAIL";
}
