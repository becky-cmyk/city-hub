import { db } from "../db";
import { coraBuildLogs, coraSnapshots, coraPlans } from "@shared/schema";
import { eq } from "drizzle-orm";
import { openai } from "../lib/openai";
import { CORA_REVERT_SYSTEM } from "../ai/prompts/platform-services";

export async function revertBuild(buildLogId: string) {
  const [buildLog] = await db.select().from(coraBuildLogs).where(eq(coraBuildLogs.id, buildLogId)).limit(1);
  if (!buildLog) throw new Error("Build log not found");

  const snapshots = await db.select().from(coraSnapshots).where(eq(coraSnapshots.buildLogId, buildLogId));
  if (snapshots.length === 0) throw new Error("No snapshot found for this build — cannot generate revert instructions");

  const snapshot = snapshots[0];
  const snapshotData = snapshot.snapshotData as Record<string, unknown>;

  const [plan] = await db.select().from(coraPlans).where(eq(coraPlans.id, buildLog.planId)).limit(1);

  let revertSummary = [
    `Revert instructions for build: ${buildLog.id}`,
    `Original plan: ${plan?.title || buildLog.planId}`,
    `Build type: ${buildLog.buildType}`,
    `Changes made: ${buildLog.changesSummary}`,
    `Files modified: ${JSON.stringify(buildLog.filesModified || [])}`,
    "",
    "To revert:",
    "1. Review the changes summary above",
    "2. Undo each file modification listed",
    "3. If database changes were made, restore from the snapshot reference below",
    "",
    `Snapshot type: ${snapshot.snapshotType}`,
    `Snapshot reference: ${JSON.stringify(snapshotData)}`,
  ].join("\n");

  let revertSteps = [
    `Review original build changes: ${buildLog.changesSummary}`,
    `Check files: ${JSON.stringify(buildLog.filesModified || [])}`,
    `Snapshot type: ${snapshot.snapshotType}`,
    "Manually undo each change or use checkpoint rollback",
    "Verify application state after revert",
  ];

  if (openai) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: CORA_REVERT_SYSTEM,
          },
          {
            role: "user",
            content: `Build ID: ${buildLog.id}\nPlan: ${plan?.title || "Unknown"}\nBuild Type: ${buildLog.buildType}\nChanges Summary: ${buildLog.changesSummary}\nFiles Modified: ${JSON.stringify(buildLog.filesModified || [])}\nSnapshot Type: ${snapshot.snapshotType}\nSnapshot Data: ${JSON.stringify(snapshotData)}`,
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 800,
        temperature: 0.5,
      });

      const raw = completion.choices[0]?.message?.content;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.revert_summary) revertSummary = parsed.revert_summary;
        if (Array.isArray(parsed.revert_prompt_or_steps)) revertSteps = parsed.revert_prompt_or_steps;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[Cora RevertService] AI generation error:", msg);
    }
  }

  return {
    buildLogId: buildLog.id,
    planId: buildLog.planId,
    planTitle: plan?.title || "Unknown",
    revertSummary,
    revertSteps,
    snapshot: {
      id: snapshot.id,
      type: snapshot.snapshotType,
      data: snapshotData,
    },
    autoApplied: false,
  };
}
