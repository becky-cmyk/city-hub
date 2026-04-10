import { db } from "../db";
import { coraPlans, coraBuildLogs, coraSnapshots } from "@shared/schema";
import { eq } from "drizzle-orm";
import { openai } from "../lib/openai";
import { CORA_BUILD_SUMMARY_SYSTEM } from "../ai/prompts/platform-services";

function inferBuildType(tags: string[], hat: string): "ui" | "backend" | "content" | "config" {
  if (tags.includes("ui") || hat === "builder") return "ui";
  if (tags.includes("content") || hat === "editor" || hat === "cmo") return "content";
  if (tags.includes("backend") || hat === "cto" || hat === "debugger") return "backend";
  return "config";
}

export async function buildFromPlan(planId: string) {
  const [plan] = await db.select().from(coraPlans).where(eq(coraPlans.id, planId)).limit(1);
  if (!plan) throw new Error("Plan not found");
  if (plan.status !== "approved") throw new Error(`Cannot build from plan in status: ${plan.status}. Plan must be approved first.`);

  const planJson = plan.planJson as { goal: string; steps: string[]; impact: string; risks: string; confidence: string };
  const buildType = inferBuildType((plan.tags as string[]) || [], plan.hat);

  let changesSummary = `Build for plan: ${plan.title}\nGoal: ${planJson.goal}\nSteps: ${planJson.steps.join("; ")}`;
  let replitPrompt: string | null = null;
  let filesModified: string[] = [];

  if (openai) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: CORA_BUILD_SUMMARY_SYSTEM,
          },
          {
            role: "user",
            content: `Plan: ${plan.title}\nDescription: ${plan.description || "N/A"}\nGoal: ${planJson.goal}\nSteps: ${JSON.stringify(planJson.steps)}\nImpact: ${planJson.impact}\nRisks: ${planJson.risks}\nBuild Type: ${buildType}\nScope: ${plan.scope}`,
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 1000,
        temperature: 0.7,
      });

      const raw = completion.choices[0]?.message?.content;
      if (raw) {
        const parsed = JSON.parse(raw);
        changesSummary = parsed.changes_summary || changesSummary;
        replitPrompt = parsed.replit_prompt || null;
        filesModified = parsed.files_modified || [];
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[Cora BuildService] AI generation error:", msg);
    }
  }

  const [buildLog] = await db.insert(coraBuildLogs).values({
    planId: plan.id,
    buildType,
    changesSummary,
    filesModified,
    replitPrompt,
    resultSummary: "Build prepared — awaiting manual application",
  }).returning();

  const [snapshot] = await db.insert(coraSnapshots).values({
    buildLogId: buildLog.id,
    snapshotType: buildType === "ui" ? "files" : buildType === "backend" ? "files" : "config",
    snapshotData: {
      planId: plan.id,
      planTitle: plan.title,
      preBuildState: "snapshot_placeholder",
      timestamp: new Date().toISOString(),
    },
  }).returning();

  await db.update(coraPlans)
    .set({ status: "built", updatedAt: new Date() })
    .where(eq(coraPlans.id, planId));

  return {
    hat: plan.hat,
    buildLogId: buildLog.id,
    snapshotId: snapshot.id,
    build_summary: changesSummary,
    changesSummary,
    replit_prompt: replitPrompt,
    replitPrompt,
    filesModified,
    previewAvailable: true,
    options: ["Preview", "Apply", "Revert"],
  };
}

export async function listBuildLogs(filters?: { planId?: string; limit?: number }) {
  let query = db.select().from(coraBuildLogs);
  if (filters?.planId) {
    query = query.where(eq(coraBuildLogs.planId, filters.planId)) as typeof query;
  }
  return query.orderBy(coraBuildLogs.createdAt).limit(filters?.limit || 50);
}

export async function getBuildLog(buildLogId: string) {
  const [log] = await db.select().from(coraBuildLogs).where(eq(coraBuildLogs.id, buildLogId)).limit(1);
  return log || null;
}
