import { db } from "../db";
import {
  metroProjects, metroLaunchProjects, coraPlans, contentFeeds,
  outreachAssets, coraBlockers, coraOpportunities, metroLaunchChecklist,
} from "@shared/schema";
import { eq, and, count, sql } from "drizzle-orm";

interface MetroReadiness {
  metroId: string;
  metroName: string;
  metroStatus: string;
  contentReady: boolean;
  pricingReady: boolean;
  outreachReady: boolean;
  operatorReady: boolean;
  comingSoonReady: boolean;
  readinessPercent: number;
  topBlockers: { id: string; title: string; severity: string }[];
  topOpportunities: { id: string; title: string; priority: string }[];
}

export async function getMetroReadiness(metroId: string): Promise<MetroReadiness> {
  const [metro] = await db.select().from(metroProjects).where(eq(metroProjects.id, metroId)).limit(1);
  if (!metro) throw new Error("Metro not found");

  let contentReady = false;
  try {
    const [cc] = await db.select({ c: count() }).from(contentFeeds).where(eq(contentFeeds.cityId, metro.cityId || ""));
    contentReady = (cc?.c || 0) >= 3;
  } catch { contentReady = false; }

  const plans = await db.select().from(coraPlans).where(eq(coraPlans.metroId, metroId));
  const pricingPlan = plans.find(p => {
    const tags = (p.tags as string[]) || [];
    return tags.includes("pricing") || p.title.toLowerCase().includes("pricing");
  });
  const pricingReady = !!pricingPlan && pricingPlan.status === "approved";

  let outreachReady = false;
  try {
    const outreach = await db.select().from(outreachAssets).where(
      and(eq(outreachAssets.metroId, metroId), eq(outreachAssets.status, "approved"))
    );
    outreachReady = outreach.length >= 1;
  } catch { outreachReady = false; }

  let operatorReady = false;
  try {
    const checklist = await db.select().from(metroLaunchChecklist).where(
      and(eq(metroLaunchChecklist.metroId, metroId), eq(metroLaunchChecklist.itemKey, "operator_identified"))
    );
    operatorReady = checklist.length > 0 && checklist[0].status === "complete";
  } catch { operatorReady = false; }

  const comingSoonReady = !!metro.comingSoonConfig;

  const flags = [contentReady, pricingReady, outreachReady, operatorReady, comingSoonReady];
  const readinessPercent = Math.round((flags.filter(Boolean).length / flags.length) * 100);

  let topBlockers: { id: string; title: string; severity: string }[] = [];
  try {
    const blockers = await db.select({ id: coraBlockers.id, title: coraBlockers.title, severity: coraBlockers.severity })
      .from(coraBlockers)
      .where(and(eq(coraBlockers.metroId, metroId), eq(coraBlockers.status, "open")))
      .limit(3);
    topBlockers = blockers;
  } catch {}

  let topOpportunities: { id: string; title: string; priority: string }[] = [];
  try {
    const opps = await db.select({ id: coraOpportunities.id, title: coraOpportunities.title, priority: coraOpportunities.priority })
      .from(coraOpportunities)
      .where(and(eq(coraOpportunities.metroId, metroId), sql`${coraOpportunities.status} IN ('identified', 'reviewed')`))
      .limit(3);
    topOpportunities = opps;
  } catch {}

  return {
    metroId: metro.id,
    metroName: metro.name,
    metroStatus: metro.status,
    contentReady,
    pricingReady,
    outreachReady,
    operatorReady,
    comingSoonReady,
    readinessPercent,
    topBlockers,
    topOpportunities,
  };
}

export async function getAllMetroReadiness(): Promise<MetroReadiness[]> {
  const metros = await db.select().from(metroProjects);
  const results = await Promise.all(
    metros.map(async (m) => {
      try {
        return await getMetroReadiness(m.id);
      } catch {
        return {
          metroId: m.id,
          metroName: m.name,
          metroStatus: m.status,
          contentReady: false,
          pricingReady: false,
          outreachReady: false,
          operatorReady: false,
          comingSoonReady: false,
          readinessPercent: 0,
          topBlockers: [],
          topOpportunities: [],
        };
      }
    })
  );
  return results;
}
