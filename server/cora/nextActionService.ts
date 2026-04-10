import { db } from "../db";
import { coraNextActions } from "@shared/schema";
import { eq, desc, and, SQL } from "drizzle-orm";

interface CreateNextActionParams {
  title: string;
  description?: string;
  scope?: string;
  metroId?: string;
  urgency?: "today" | "this_week" | "later";
  hat?: string;
  linkedBlockerId?: string;
  linkedOpportunityId?: string;
}

export async function createNextAction(params: CreateNextActionParams) {
  if (!params.title) throw new Error("title is required");

  const [action] = await db.insert(coraNextActions).values({
    title: params.title,
    description: params.description || null,
    scope: params.scope || "metro",
    metroId: params.metroId || null,
    urgency: params.urgency || "this_week",
    hat: params.hat || "operator",
    linkedBlockerId: params.linkedBlockerId || null,
    linkedOpportunityId: params.linkedOpportunityId || null,
  }).returning();

  return action;
}

export async function getNextAction(id: string) {
  const [action] = await db.select().from(coraNextActions).where(eq(coraNextActions.id, id)).limit(1);
  return action || null;
}

export async function listNextActions(filters?: { status?: string; urgency?: string; hat?: string; scope?: string; limit?: number }) {
  const conditions: SQL[] = [];
  if (filters?.status) {
    conditions.push(eq(coraNextActions.status, filters.status as "pending" | "done" | "skipped"));
  }
  if (filters?.urgency) {
    conditions.push(eq(coraNextActions.urgency, filters.urgency as "today" | "this_week" | "later"));
  }
  if (filters?.hat) {
    conditions.push(eq(coraNextActions.hat, filters.hat));
  }
  if (filters?.scope) {
    conditions.push(eq(coraNextActions.scope, filters.scope));
  }

  const query = conditions.length > 0
    ? db.select().from(coraNextActions).where(and(...conditions))
    : db.select().from(coraNextActions);

  return query.orderBy(desc(coraNextActions.createdAt)).limit(filters?.limit || 50);
}

export async function updateNextAction(id: string, updates: { title?: string; description?: string; urgency?: string; hat?: string }) {
  const setFields: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.title !== undefined) setFields.title = updates.title;
  if (updates.description !== undefined) setFields.description = updates.description;
  if (updates.urgency !== undefined) setFields.urgency = updates.urgency;
  if (updates.hat !== undefined) setFields.hat = updates.hat;

  const [updated] = await db.update(coraNextActions)
    .set(setFields)
    .where(eq(coraNextActions.id, id))
    .returning();

  if (!updated) throw new Error("Next action not found");
  return updated;
}

export async function completeNextAction(id: string) {
  const [updated] = await db.update(coraNextActions)
    .set({ status: "done", updatedAt: new Date() })
    .where(eq(coraNextActions.id, id))
    .returning();
  if (!updated) throw new Error("Next action not found");
  return updated;
}

export async function skipNextAction(id: string) {
  const [updated] = await db.update(coraNextActions)
    .set({ status: "skipped", updatedAt: new Date() })
    .where(eq(coraNextActions.id, id))
    .returning();
  if (!updated) throw new Error("Next action not found");
  return updated;
}
