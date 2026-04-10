import { db } from "../db";
import { aiOutboundFlows } from "@shared/schema";
import { eq, desc, and, SQL } from "drizzle-orm";
import { z } from "zod";

const VALID_FLOW_TRANSITIONS: Record<string, string[]> = {
  draft: ["approved"],
  approved: ["active", "draft"],
  active: ["archived"],
  archived: [],
};

export const createOutboundFlowSchema = z.object({
  name: z.string().min(1, "name is required"),
  description: z.string().optional(),
  scope: z.string().optional(),
  metroId: z.string().optional(),
  voiceProfileId: z.string().optional(),
  opener: z.string().optional(),
  qualification: z.string().optional(),
  valueProp: z.string().optional(),
  objectionHandling: z.string().optional(),
  cta: z.string().optional(),
  close: z.string().optional(),
  voicemailVersion: z.string().optional(),
  smsFollowUp: z.string().optional(),
});

export const updateOutboundFlowSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  opener: z.string().optional(),
  qualification: z.string().optional(),
  valueProp: z.string().optional(),
  objectionHandling: z.string().optional(),
  cta: z.string().optional(),
  close: z.string().optional(),
  voicemailVersion: z.string().optional(),
  smsFollowUp: z.string().optional(),
  voiceProfileId: z.string().optional(),
}).refine(obj => Object.values(obj).some(v => v !== undefined), { message: "At least one field is required" });

export async function createOutboundFlow(data: z.infer<typeof createOutboundFlowSchema>) {
  const [flow] = await db.insert(aiOutboundFlows).values({
    name: data.name,
    description: data.description || null,
    scope: data.scope || "metro",
    metroId: data.metroId || null,
    voiceProfileId: data.voiceProfileId || null,
    opener: data.opener || "",
    qualification: data.qualification || "",
    valueProp: data.valueProp || "",
    objectionHandling: data.objectionHandling || "",
    cta: data.cta || "",
    close: data.close || "",
    voicemailVersion: data.voicemailVersion || null,
    smsFollowUp: data.smsFollowUp || null,
    status: "draft",
    createdBy: "cora",
  }).returning();
  return flow;
}

export async function getOutboundFlow(id: string) {
  const [flow] = await db.select().from(aiOutboundFlows).where(eq(aiOutboundFlows.id, id)).limit(1);
  return flow || null;
}

export async function listOutboundFlows(filters?: { status?: string; scope?: string; limit?: number }) {
  const conditions: SQL[] = [];
  if (filters?.status) conditions.push(eq(aiOutboundFlows.status, filters.status as any));
  if (filters?.scope) conditions.push(eq(aiOutboundFlows.scope, filters.scope));

  const query = conditions.length > 0
    ? db.select().from(aiOutboundFlows).where(and(...conditions))
    : db.select().from(aiOutboundFlows);

  return query.orderBy(desc(aiOutboundFlows.createdAt)).limit(filters?.limit || 50);
}

export async function updateOutboundFlow(id: string, updates: z.infer<typeof updateOutboundFlowSchema>) {
  const [existing] = await db.select().from(aiOutboundFlows).where(eq(aiOutboundFlows.id, id)).limit(1);
  if (!existing) throw new Error("Outbound flow not found");
  if (existing.status !== "draft") throw new Error("Can only edit outbound flows in draft status");

  const setFields: Record<string, unknown> = { updatedAt: new Date() };
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) setFields[key] = value;
  }

  const [updated] = await db.update(aiOutboundFlows)
    .set(setFields)
    .where(eq(aiOutboundFlows.id, id))
    .returning();
  return updated;
}

export async function approveOutboundFlow(id: string) {
  const [existing] = await db.select().from(aiOutboundFlows).where(eq(aiOutboundFlows.id, id)).limit(1);
  if (!existing) throw new Error("Outbound flow not found");
  const allowed = VALID_FLOW_TRANSITIONS[existing.status] || [];
  if (!allowed.includes("approved")) throw new Error(`Cannot approve flow in status: ${existing.status}`);

  const [updated] = await db.update(aiOutboundFlows)
    .set({ status: "approved", updatedAt: new Date() })
    .where(eq(aiOutboundFlows.id, id))
    .returning();
  return updated;
}

export async function rejectOutboundFlow(id: string) {
  const [existing] = await db.select().from(aiOutboundFlows).where(eq(aiOutboundFlows.id, id)).limit(1);
  if (!existing) throw new Error("Outbound flow not found");
  const allowed = VALID_FLOW_TRANSITIONS[existing.status] || [];
  if (!allowed.includes("draft")) throw new Error(`Cannot reject flow in status: ${existing.status}. Only approved flows can be rejected.`);

  const [updated] = await db.update(aiOutboundFlows)
    .set({ status: "draft", updatedAt: new Date() })
    .where(eq(aiOutboundFlows.id, id))
    .returning();
  return updated;
}

export async function archiveOutboundFlow(id: string) {
  const [existing] = await db.select().from(aiOutboundFlows).where(eq(aiOutboundFlows.id, id)).limit(1);
  if (!existing) throw new Error("Outbound flow not found");
  const allowed = VALID_FLOW_TRANSITIONS[existing.status] || [];
  if (!allowed.includes("archived")) throw new Error(`Cannot archive flow in status: ${existing.status}. Must be active first.`);

  const [updated] = await db.update(aiOutboundFlows)
    .set({ status: "archived", updatedAt: new Date() })
    .where(eq(aiOutboundFlows.id, id))
    .returning();
  return updated;
}
