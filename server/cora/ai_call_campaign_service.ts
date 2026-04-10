import { db } from "../db";
import { aiCallCampaigns, aiCallTasks } from "@shared/schema";
import { eq, desc, and, SQL } from "drizzle-orm";
import { z } from "zod";

const VALID_CAMPAIGN_TRANSITIONS: Record<string, string[]> = {
  draft: ["approved", "cancelled"],
  approved: ["active", "cancelled"],
  active: ["paused", "completed", "cancelled"],
  paused: ["active", "cancelled"],
  completed: ["archived"],
  cancelled: ["archived"],
  archived: [],
};

const EDITABLE_STATUSES = ["draft"];

export const createCampaignSchema = z.object({
  name: z.string().min(1, "name is required"),
  description: z.string().optional(),
  campaignType: z.string().optional(),
  scope: z.string().optional(),
  metroId: z.string().optional(),
  voiceProfileId: z.string().optional(),
  targetAudience: z.string().optional(),
  scriptId: z.string().optional(),
  scheduledStart: z.string().datetime().optional(),
  scheduledEnd: z.string().datetime().optional(),
});

export const updateCampaignSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  targetAudience: z.string().optional(),
  voiceProfileId: z.string().optional(),
  scriptId: z.string().optional(),
}).refine(obj => Object.values(obj).some(v => v !== undefined), { message: "At least one field is required" });

export const transitionCampaignSchema = z.object({
  status: z.enum(["approved", "active", "paused", "completed", "cancelled", "archived"]),
});

export const createCallTaskSchema = z.object({
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional(),
  notes: z.string().optional(),
  priority: z.number().int().min(0).max(10).optional(),
  scheduledAt: z.string().datetime().optional(),
});

export const updateCallTaskSchema = z.object({
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["pending", "scheduled", "in_progress", "completed", "failed", "cancelled"]).optional(),
  outcome: z.string().optional(),
}).refine(obj => Object.values(obj).some(v => v !== undefined), { message: "At least one field is required" });

export async function createCallCampaign(data: z.infer<typeof createCampaignSchema>) {
  const [campaign] = await db.insert(aiCallCampaigns).values({
    name: data.name,
    description: data.description || null,
    campaignType: data.campaignType || "outbound_prospecting",
    scope: data.scope || "metro",
    metroId: data.metroId || null,
    voiceProfileId: data.voiceProfileId || null,
    targetAudience: data.targetAudience || null,
    scriptId: data.scriptId || null,
    status: "draft",
    scheduledStart: data.scheduledStart ? new Date(data.scheduledStart) : null,
    scheduledEnd: data.scheduledEnd ? new Date(data.scheduledEnd) : null,
    createdBy: "cora",
  }).returning();
  return campaign;
}

export async function getCallCampaign(id: string) {
  const [campaign] = await db.select().from(aiCallCampaigns).where(eq(aiCallCampaigns.id, id)).limit(1);
  return campaign || null;
}

export async function listCallCampaigns(filters?: { status?: string; campaignType?: string; limit?: number }) {
  const conditions: SQL[] = [];
  if (filters?.status) conditions.push(eq(aiCallCampaigns.status, filters.status as any));
  if (filters?.campaignType) conditions.push(eq(aiCallCampaigns.campaignType, filters.campaignType));

  const query = conditions.length > 0
    ? db.select().from(aiCallCampaigns).where(and(...conditions))
    : db.select().from(aiCallCampaigns);

  return query.orderBy(desc(aiCallCampaigns.createdAt)).limit(filters?.limit || 50);
}

export async function updateCallCampaign(id: string, updates: z.infer<typeof updateCampaignSchema>) {
  const [existing] = await db.select().from(aiCallCampaigns).where(eq(aiCallCampaigns.id, id)).limit(1);
  if (!existing) throw new Error("Call campaign not found");
  if (!EDITABLE_STATUSES.includes(existing.status)) throw new Error("Can only edit campaigns in draft status");

  const setFields: Record<string, unknown> = { updatedAt: new Date() };
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) setFields[key] = value;
  }

  const [updated] = await db.update(aiCallCampaigns)
    .set(setFields)
    .where(eq(aiCallCampaigns.id, id))
    .returning();
  return updated;
}

export async function transitionCampaignStatus(id: string, newStatus: string) {
  const [existing] = await db.select().from(aiCallCampaigns).where(eq(aiCallCampaigns.id, id)).limit(1);
  if (!existing) throw new Error("Call campaign not found");

  const allowed = VALID_CAMPAIGN_TRANSITIONS[existing.status] || [];
  if (!allowed.includes(newStatus)) {
    throw new Error(`Cannot transition from ${existing.status} to ${newStatus}`);
  }

  const [updated] = await db.update(aiCallCampaigns)
    .set({ status: newStatus as any, updatedAt: new Date() })
    .where(eq(aiCallCampaigns.id, id))
    .returning();
  return updated;
}

export async function archiveCallCampaign(id: string) {
  const [existing] = await db.select().from(aiCallCampaigns).where(eq(aiCallCampaigns.id, id)).limit(1);
  if (!existing) throw new Error("Call campaign not found");
  const allowed = VALID_CAMPAIGN_TRANSITIONS[existing.status] || [];
  if (!allowed.includes("archived")) {
    throw new Error(`Cannot archive campaign in status: ${existing.status}. Must be completed or cancelled first.`);
  }

  const [updated] = await db.update(aiCallCampaigns)
    .set({ status: "archived", updatedAt: new Date() })
    .where(eq(aiCallCampaigns.id, id))
    .returning();
  return updated;
}

export async function createCallTask(data: z.infer<typeof createCallTaskSchema> & { campaignId: string }) {
  const [task] = await db.insert(aiCallTasks).values({
    campaignId: data.campaignId,
    contactName: data.contactName || null,
    contactPhone: data.contactPhone || null,
    contactEmail: data.contactEmail || null,
    notes: data.notes || null,
    priority: data.priority || 0,
    status: "pending",
    scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
  }).returning();
  return task;
}

export async function listCallTasks(campaignId: string) {
  return db.select().from(aiCallTasks)
    .where(eq(aiCallTasks.campaignId, campaignId))
    .orderBy(desc(aiCallTasks.priority))
    .limit(100);
}

export async function updateCallTask(id: string, updates: z.infer<typeof updateCallTaskSchema>) {
  const setFields: Record<string, unknown> = { updatedAt: new Date() };
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) setFields[key] = value;
  }
  if (updates.status === "completed") setFields.completedAt = new Date();

  const [updated] = await db.update(aiCallTasks)
    .set(setFields)
    .where(eq(aiCallTasks.id, id))
    .returning();
  if (!updated) throw new Error("Call task not found");
  return updated;
}
