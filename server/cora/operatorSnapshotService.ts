import { db } from "../db";
import {
  coraOperatorSnapshots, metroProjects, coraPlans, outreachAssets,
  coraBlockers, coraOpportunities, coraNextActions, contentFeeds,
} from "@shared/schema";
import { eq, desc, sql, and, SQL, count } from "drizzle-orm";

interface SnapshotSummary {
  totalMetros: number;
  activeMetros: number;
  comingSoonMetros: number;
  totalPlans: number;
  approvedPlans: number;
  totalOutreach: number;
  sentOutreach: number;
  totalContent: number;
  openBlockers: number;
  activeOpportunities: number;
  pendingActions: number;
}

async function buildSummary(): Promise<SnapshotSummary> {
  const metros = await db.select().from(metroProjects);
  const plans = await db.select().from(coraPlans);
  const outreach = await db.select().from(outreachAssets);

  let totalContent = 0;
  try {
    const [contentCount] = await db.select({ c: count() }).from(contentFeeds);
    totalContent = contentCount?.c || 0;
  } catch { totalContent = 0; }

  let openBlockers = 0;
  try {
    const [bc] = await db.select({ c: count() }).from(coraBlockers).where(eq(coraBlockers.status, "open"));
    openBlockers = bc?.c || 0;
  } catch { openBlockers = 0; }

  let activeOpportunities = 0;
  try {
    const [oc] = await db.select({ c: count() }).from(coraOpportunities).where(
      sql`${coraOpportunities.status} IN ('identified', 'reviewed')`
    );
    activeOpportunities = oc?.c || 0;
  } catch { activeOpportunities = 0; }

  let pendingActions = 0;
  try {
    const [ac] = await db.select({ c: count() }).from(coraNextActions).where(eq(coraNextActions.status, "pending"));
    pendingActions = ac?.c || 0;
  } catch { pendingActions = 0; }

  return {
    totalMetros: metros.length,
    activeMetros: metros.filter(m => m.status === "active" || m.status === "soft_open").length,
    comingSoonMetros: metros.filter(m => m.status === "coming_soon").length,
    totalPlans: plans.length,
    approvedPlans: plans.filter(p => p.status === "approved").length,
    totalOutreach: outreach.length,
    sentOutreach: outreach.filter(o => o.status === "sent").length,
    totalContent,
    openBlockers,
    activeOpportunities,
    pendingActions,
  };
}

export async function generateSnapshot(params?: { scope?: string; metroId?: string }) {
  const summary = await buildSummary();

  const [snapshot] = await db.insert(coraOperatorSnapshots).values({
    scope: params?.scope || "platform",
    metroId: params?.metroId || null,
    summaryJson: summary,
    metroReadiness: {},
    generatedBy: "manual",
  }).returning();

  return snapshot;
}

export async function getSnapshot(id: string) {
  const [snapshot] = await db.select().from(coraOperatorSnapshots).where(eq(coraOperatorSnapshots.id, id)).limit(1);
  return snapshot || null;
}

export async function listSnapshots(filters?: { scope?: string; limit?: number }) {
  const conditions: SQL[] = [];
  if (filters?.scope) {
    conditions.push(eq(coraOperatorSnapshots.scope, filters.scope));
  }

  const query = conditions.length > 0
    ? db.select().from(coraOperatorSnapshots).where(and(...conditions))
    : db.select().from(coraOperatorSnapshots);

  return query.orderBy(desc(coraOperatorSnapshots.createdAt)).limit(filters?.limit || 20);
}
