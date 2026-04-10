import { db } from "../db";
import { coraOpportunities } from "@shared/schema";
import { eq, desc, and, SQL } from "drizzle-orm";

interface CreateOpportunityParams {
  title: string;
  description?: string;
  scope?: string;
  metroId?: string;
  priority?: "low" | "medium" | "high" | "critical";
  estimatedValue?: string;
  recommendedNextSteps?: string[];
  hat?: string;
}

export async function createOpportunity(params: CreateOpportunityParams) {
  if (!params.title) throw new Error("title is required");

  const [opp] = await db.insert(coraOpportunities).values({
    title: params.title,
    description: params.description || null,
    scope: params.scope || "metro",
    metroId: params.metroId || null,
    priority: params.priority || "medium",
    estimatedValue: params.estimatedValue || null,
    recommendedNextSteps: params.recommendedNextSteps || [],
    hat: params.hat || "operator",
  }).returning();

  return opp;
}

export async function getOpportunity(id: string) {
  const [opp] = await db.select().from(coraOpportunities).where(eq(coraOpportunities.id, id)).limit(1);
  return opp || null;
}

export async function listOpportunities(filters?: { status?: string; priority?: string; scope?: string; limit?: number }) {
  const conditions: SQL[] = [];
  if (filters?.status) {
    conditions.push(eq(coraOpportunities.status, filters.status as "identified" | "reviewed" | "approved" | "archived"));
  }
  if (filters?.priority) {
    conditions.push(eq(coraOpportunities.priority, filters.priority as "low" | "medium" | "high" | "critical"));
  }
  if (filters?.scope) {
    conditions.push(eq(coraOpportunities.scope, filters.scope));
  }

  const query = conditions.length > 0
    ? db.select().from(coraOpportunities).where(and(...conditions))
    : db.select().from(coraOpportunities);

  return query.orderBy(desc(coraOpportunities.createdAt)).limit(filters?.limit || 50);
}

export async function updateOpportunity(id: string, updates: { title?: string; description?: string; priority?: string; estimatedValue?: string; recommendedNextSteps?: string[] }) {
  const setFields: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.title !== undefined) setFields.title = updates.title;
  if (updates.description !== undefined) setFields.description = updates.description;
  if (updates.priority !== undefined) setFields.priority = updates.priority;
  if (updates.estimatedValue !== undefined) setFields.estimatedValue = updates.estimatedValue;
  if (updates.recommendedNextSteps !== undefined) setFields.recommendedNextSteps = updates.recommendedNextSteps;

  const [updated] = await db.update(coraOpportunities)
    .set(setFields)
    .where(eq(coraOpportunities.id, id))
    .returning();

  if (!updated) throw new Error("Opportunity not found");
  return updated;
}

export async function approveOpportunity(id: string) {
  const [updated] = await db.update(coraOpportunities)
    .set({ status: "approved", updatedAt: new Date() })
    .where(eq(coraOpportunities.id, id))
    .returning();
  if (!updated) throw new Error("Opportunity not found");
  return updated;
}

export async function archiveOpportunity(id: string) {
  const [updated] = await db.update(coraOpportunities)
    .set({ status: "archived", updatedAt: new Date() })
    .where(eq(coraOpportunities.id, id))
    .returning();
  if (!updated) throw new Error("Opportunity not found");
  return updated;
}
