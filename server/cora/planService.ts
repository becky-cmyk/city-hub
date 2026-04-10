import { db } from "../db";
import { coraPlans } from "@shared/schema";
import { eq, desc, and, SQL } from "drizzle-orm";

interface PlanJson {
  goal: string;
  steps: string[];
  impact: string;
  risks: string;
  confidence: string;
  dependencies?: string[];
}

interface CreatePlanParams {
  title: string;
  description?: string;
  hat: string;
  scope: "platform" | "metro";
  metroId?: string;
  tags?: string[];
  planJson: PlanJson;
}

function validatePlanJson(pj: unknown): pj is PlanJson {
  if (!pj || typeof pj !== "object") return false;
  const obj = pj as Record<string, unknown>;
  return (
    typeof obj.goal === "string" &&
    Array.isArray(obj.steps) &&
    obj.steps.length > 0 &&
    typeof obj.impact === "string" &&
    typeof obj.risks === "string" &&
    typeof obj.confidence === "string"
  );
}

export async function createPlan(params: CreatePlanParams) {
  if (!validatePlanJson(params.planJson)) {
    throw new Error("plan_json must include goal, steps[], impact, risks, and confidence");
  }

  const [plan] = await db.insert(coraPlans).values({
    title: params.title,
    description: params.description || null,
    hat: params.hat,
    scope: params.scope,
    metroId: params.metroId || null,
    tags: params.tags || [],
    planJson: params.planJson,
    status: "draft",
  }).returning();

  return plan;
}

export async function approvePlan(planId: string) {
  const existing = await db.select().from(coraPlans).where(eq(coraPlans.id, planId)).limit(1);
  if (!existing[0]) throw new Error("Plan not found");
  if (existing[0].status !== "draft") throw new Error(`Cannot approve plan in status: ${existing[0].status}`);

  const [updated] = await db.update(coraPlans)
    .set({ status: "approved", updatedAt: new Date() })
    .where(eq(coraPlans.id, planId))
    .returning();

  return updated;
}

export async function rejectPlan(planId: string) {
  const existing = await db.select().from(coraPlans).where(eq(coraPlans.id, planId)).limit(1);
  if (!existing[0]) throw new Error("Plan not found");
  if (existing[0].status !== "draft") throw new Error(`Cannot reject plan in status: ${existing[0].status}`);

  const [updated] = await db.update(coraPlans)
    .set({ status: "rejected", updatedAt: new Date() })
    .where(eq(coraPlans.id, planId))
    .returning();

  return updated;
}

export async function getPlan(planId: string) {
  const [plan] = await db.select().from(coraPlans).where(eq(coraPlans.id, planId)).limit(1);
  return plan || null;
}

export async function listPlans(filters?: { status?: string; scope?: string; limit?: number }) {
  const conditions: SQL[] = [];
  if (filters?.status) {
    conditions.push(eq(coraPlans.status, filters.status as "draft" | "approved" | "rejected" | "built"));
  }
  if (filters?.scope) {
    conditions.push(eq(coraPlans.scope, filters.scope));
  }

  const query = conditions.length > 0
    ? db.select().from(coraPlans).where(and(...conditions))
    : db.select().from(coraPlans);

  return query.orderBy(desc(coraPlans.createdAt)).limit(filters?.limit || 50);
}
