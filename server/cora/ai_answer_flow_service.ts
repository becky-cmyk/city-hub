import { db } from "../db";
import { aiAnswerFlows } from "@shared/schema";
import { eq, desc, and, SQL } from "drizzle-orm";
import { z } from "zod";

const VALID_FLOW_TRANSITIONS: Record<string, string[]> = {
  draft: ["approved"],
  approved: ["active", "draft"],
  active: ["archived"],
  archived: [],
};

export const createAnswerFlowSchema = z.object({
  name: z.string().min(1, "name is required"),
  description: z.string().optional(),
  scope: z.string().optional(),
  metroId: z.string().optional(),
  voiceProfileId: z.string().optional(),
  greeting: z.string().optional(),
  fallbackMessage: z.string().optional(),
  escalationRules: z.array(z.object({ condition: z.string(), action: z.string() })).optional(),
  captureFields: z.array(z.string()).optional(),
  faqResponses: z.array(z.object({ question: z.string(), answer: z.string() })).optional(),
});

export const updateAnswerFlowSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  greeting: z.string().optional(),
  fallbackMessage: z.string().optional(),
  escalationRules: z.array(z.object({ condition: z.string(), action: z.string() })).optional(),
  captureFields: z.array(z.string()).optional(),
  faqResponses: z.array(z.object({ question: z.string(), answer: z.string() })).optional(),
  voiceProfileId: z.string().optional(),
}).refine(obj => Object.values(obj).some(v => v !== undefined), { message: "At least one field is required" });

export async function createAnswerFlow(data: z.infer<typeof createAnswerFlowSchema>) {
  const [flow] = await db.insert(aiAnswerFlows).values({
    name: data.name,
    description: data.description || null,
    scope: data.scope || "metro",
    metroId: data.metroId || null,
    voiceProfileId: data.voiceProfileId || null,
    greeting: data.greeting || "Thank you for calling.",
    fallbackMessage: data.fallbackMessage || "Let me connect you with someone who can help.",
    escalationRules: data.escalationRules || [],
    captureFields: data.captureFields || ["name", "phone", "reason"],
    faqResponses: data.faqResponses || [],
    status: "draft",
    createdBy: "cora",
  }).returning();
  return flow;
}

export async function getAnswerFlow(id: string) {
  const [flow] = await db.select().from(aiAnswerFlows).where(eq(aiAnswerFlows.id, id)).limit(1);
  return flow || null;
}

export async function listAnswerFlows(filters?: { status?: string; scope?: string; limit?: number }) {
  const conditions: SQL[] = [];
  if (filters?.status) conditions.push(eq(aiAnswerFlows.status, filters.status as any));
  if (filters?.scope) conditions.push(eq(aiAnswerFlows.scope, filters.scope));

  const query = conditions.length > 0
    ? db.select().from(aiAnswerFlows).where(and(...conditions))
    : db.select().from(aiAnswerFlows);

  return query.orderBy(desc(aiAnswerFlows.createdAt)).limit(filters?.limit || 50);
}

export async function updateAnswerFlow(id: string, updates: z.infer<typeof updateAnswerFlowSchema>) {
  const [existing] = await db.select().from(aiAnswerFlows).where(eq(aiAnswerFlows.id, id)).limit(1);
  if (!existing) throw new Error("Answer flow not found");
  if (existing.status !== "draft") throw new Error("Can only edit answer flows in draft status");

  const setFields: Record<string, unknown> = { updatedAt: new Date() };
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) setFields[key] = value;
  }

  const [updated] = await db.update(aiAnswerFlows)
    .set(setFields)
    .where(eq(aiAnswerFlows.id, id))
    .returning();
  return updated;
}

export async function approveAnswerFlow(id: string) {
  const [existing] = await db.select().from(aiAnswerFlows).where(eq(aiAnswerFlows.id, id)).limit(1);
  if (!existing) throw new Error("Answer flow not found");
  const allowed = VALID_FLOW_TRANSITIONS[existing.status] || [];
  if (!allowed.includes("approved")) throw new Error(`Cannot approve flow in status: ${existing.status}`);

  const [updated] = await db.update(aiAnswerFlows)
    .set({ status: "approved", updatedAt: new Date() })
    .where(eq(aiAnswerFlows.id, id))
    .returning();
  return updated;
}

export async function rejectAnswerFlow(id: string) {
  const [existing] = await db.select().from(aiAnswerFlows).where(eq(aiAnswerFlows.id, id)).limit(1);
  if (!existing) throw new Error("Answer flow not found");
  const allowed = VALID_FLOW_TRANSITIONS[existing.status] || [];
  if (!allowed.includes("draft")) throw new Error(`Cannot reject flow in status: ${existing.status}. Only approved flows can be rejected.`);

  const [updated] = await db.update(aiAnswerFlows)
    .set({ status: "draft", updatedAt: new Date() })
    .where(eq(aiAnswerFlows.id, id))
    .returning();
  return updated;
}

export async function archiveAnswerFlow(id: string) {
  const [existing] = await db.select().from(aiAnswerFlows).where(eq(aiAnswerFlows.id, id)).limit(1);
  if (!existing) throw new Error("Answer flow not found");
  const allowed = VALID_FLOW_TRANSITIONS[existing.status] || [];
  if (!allowed.includes("archived")) throw new Error(`Cannot archive flow in status: ${existing.status}. Must be active first.`);

  const [updated] = await db.update(aiAnswerFlows)
    .set({ status: "archived", updatedAt: new Date() })
    .where(eq(aiAnswerFlows.id, id))
    .returning();
  return updated;
}
