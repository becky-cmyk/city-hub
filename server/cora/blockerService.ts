import { db } from "../db";
import { coraBlockers } from "@shared/schema";
import { eq, desc, and, SQL } from "drizzle-orm";

interface CreateBlockerParams {
  title: string;
  description?: string;
  scope?: string;
  metroId?: string;
  severity?: "low" | "medium" | "high" | "critical";
  linkedPlanId?: string;
  linkedOpportunityId?: string;
}

export async function createBlocker(params: CreateBlockerParams) {
  if (!params.title) throw new Error("title is required");

  const [blocker] = await db.insert(coraBlockers).values({
    title: params.title,
    description: params.description || null,
    scope: params.scope || "metro",
    metroId: params.metroId || null,
    severity: params.severity || "medium",
    linkedPlanId: params.linkedPlanId || null,
    linkedOpportunityId: params.linkedOpportunityId || null,
  }).returning();

  return blocker;
}

export async function getBlocker(id: string) {
  const [blocker] = await db.select().from(coraBlockers).where(eq(coraBlockers.id, id)).limit(1);
  return blocker || null;
}

export async function listBlockers(filters?: { status?: string; severity?: string; scope?: string; metroId?: string; limit?: number }) {
  const conditions: SQL[] = [];
  if (filters?.status) {
    conditions.push(eq(coraBlockers.status, filters.status as "open" | "resolved" | "ignored"));
  }
  if (filters?.severity) {
    conditions.push(eq(coraBlockers.severity, filters.severity as "low" | "medium" | "high" | "critical"));
  }
  if (filters?.scope) {
    conditions.push(eq(coraBlockers.scope, filters.scope));
  }
  if (filters?.metroId) {
    conditions.push(eq(coraBlockers.metroId, filters.metroId));
  }

  const query = conditions.length > 0
    ? db.select().from(coraBlockers).where(and(...conditions))
    : db.select().from(coraBlockers);

  return query.orderBy(desc(coraBlockers.createdAt)).limit(filters?.limit || 50);
}

export async function updateBlocker(id: string, updates: { title?: string; description?: string; severity?: string; linkedPlanId?: string; linkedOpportunityId?: string }) {
  const setFields: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.title !== undefined) setFields.title = updates.title;
  if (updates.description !== undefined) setFields.description = updates.description;
  if (updates.severity !== undefined) setFields.severity = updates.severity;
  if (updates.linkedPlanId !== undefined) setFields.linkedPlanId = updates.linkedPlanId;
  if (updates.linkedOpportunityId !== undefined) setFields.linkedOpportunityId = updates.linkedOpportunityId;

  const [updated] = await db.update(coraBlockers)
    .set(setFields)
    .where(eq(coraBlockers.id, id))
    .returning();

  if (!updated) throw new Error("Blocker not found");
  return updated;
}

export async function resolveBlocker(id: string) {
  const [updated] = await db.update(coraBlockers)
    .set({ status: "resolved", resolvedAt: new Date(), updatedAt: new Date() })
    .where(eq(coraBlockers.id, id))
    .returning();
  if (!updated) throw new Error("Blocker not found");
  return updated;
}

export async function ignoreBlocker(id: string) {
  const [updated] = await db.update(coraBlockers)
    .set({ status: "ignored", updatedAt: new Date() })
    .where(eq(coraBlockers.id, id))
    .returning();
  if (!updated) throw new Error("Blocker not found");
  return updated;
}
