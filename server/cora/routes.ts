import { Router, Request, Response, NextFunction } from "express";
import { handleCoraRequest } from "./service";
import { suggestSources, generateFromApprovedSources } from "./contentBridge";
import { selectContentSources } from "./sourceSelector";
import { resolveHat } from "./hats";
import { createPlan, approvePlan, rejectPlan, getPlan, listPlans } from "./planService";
import { buildFromPlan, listBuildLogs, getBuildLog } from "./buildService";
import { revertBuild } from "./revertService";
import { createOutreachDraft, approveOutreach, archiveOutreach, updateOutreach, getOutreach, listOutreach } from "./outreachService";
import { createUiProposal, approveProposal, revertProposal, updateProposal, getProposal, listProposals } from "./uiProposalService";
import { createVoiceProfile, getVoiceProfile, listVoiceProfiles, updateVoiceProfile, activateVoiceProfile, archiveVoiceProfile, seedDefaultVoiceProfiles, createVoiceProfileSchema, updateVoiceProfileSchema } from "./ai_voice_service";
import { createCallCampaign, getCallCampaign, listCallCampaigns, updateCallCampaign, transitionCampaignStatus, archiveCallCampaign, createCallTask, listCallTasks, updateCallTask, createCampaignSchema, updateCampaignSchema, transitionCampaignSchema, createCallTaskSchema, updateCallTaskSchema } from "./ai_call_campaign_service";
import { createAnswerFlow, getAnswerFlow, listAnswerFlows, updateAnswerFlow, approveAnswerFlow, rejectAnswerFlow, archiveAnswerFlow, createAnswerFlowSchema, updateAnswerFlowSchema } from "./ai_answer_flow_service";
import { createOutboundFlow, getOutboundFlow, listOutboundFlows, updateOutboundFlow, approveOutboundFlow, rejectOutboundFlow, archiveOutboundFlow, createOutboundFlowSchema, updateOutboundFlowSchema } from "./ai_outbound_flow_service";
import { getVoiceProvider, isVoiceProviderConfigured } from "./ai_voice_provider";
import { generateSnapshot, getSnapshot, listSnapshots } from "./operatorSnapshotService";
import { createOpportunity, getOpportunity, listOpportunities, updateOpportunity, approveOpportunity, archiveOpportunity } from "./opportunityService";
import { createBlocker, getBlocker, listBlockers, updateBlocker, resolveBlocker, ignoreBlocker } from "./blockerService";
import { createNextAction, getNextAction, listNextActions, updateNextAction, completeNextAction, skipNextAction } from "./nextActionService";
import { getMetroReadiness, getAllMetroReadiness } from "./metroReadinessService";
import { db } from "../db";
import { coraKnowledge, coraQuestions, coraSuggestions, insertCoraOpportunitySchema, insertCoraBlockerSchema, insertCoraNextActionSchema } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

export function registerCoraRoutes(app: Router, adminMiddleware: (req: Request, res: Response, next: NextFunction) => void) {
  const router = Router();
  router.use("/api/cora", adminMiddleware);
  buildCoraRouter(router);
  app.use(router);
}

function buildCoraRouter(router: Router) {

router.post("/api/cora/request", async (req, res) => {
  try {
    const { input, scope, metroId, approvedSources, conversation_mode } = req.body;
    if (!input || typeof input !== "string") {
      return res.status(400).json({ error: "input is required" });
    }
    const result = await handleCoraRequest({ input, scope, metroId, approvedSources, conversation_mode });
    return res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[Cora /request]", msg);
    return res.status(500).json({ error: msg });
  }
});

router.get("/api/cora/sources", async (req, res) => {
  try {
    const metroId = req.query.metroId as string;
    const count = Math.min(Number(req.query.count) || 3, 10);
    if (!metroId) {
      return res.status(400).json({ error: "metroId required" });
    }
    const sources = await selectContentSources({ metroId, count });
    return res.json({ sources });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[Cora /sources]", msg);
    return res.status(500).json({ error: msg });
  }
});

router.post("/api/cora/resolve-hat", async (req, res) => {
  try {
    const { input } = req.body;
    if (!input || typeof input !== "string") {
      return res.status(400).json({ error: "input is required" });
    }
    return res.json(resolveHat(input));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
});

router.post("/api/cora/plans", async (req, res) => {
  try {
    const plan = await createPlan(req.body);
    return res.json(plan);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: msg });
  }
});

router.get("/api/cora/plans", async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const scope = req.query.scope as string | undefined;
    const limit = Number(req.query.limit) || 50;
    const plans = await listPlans({ status, scope, limit });
    return res.json(plans);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
});

router.get("/api/cora/plans/:id", async (req, res) => {
  try {
    const plan = await getPlan(req.params.id);
    if (!plan) return res.status(404).json({ error: "Plan not found" });
    return res.json(plan);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
});

router.post("/api/cora/plans/:id/approve", async (req, res) => {
  try {
    const planTags = await getPlan(req.params.id).then(p => (p.tags as string[]) || []);
    const planJson = await getPlan(req.params.id).then(p => (p.planJson || {}) as Record<string, unknown>);

    let metroCreated = null;
    if (planTags.includes("metro-launch") && planJson.targetCity) {
      const { createMetroFromTemplate } = await import("../metro/metroCloneService");
      const { db } = await import("../db");
      const { metroTemplates } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");

      const [defaultTemplate] = await db.select().from(metroTemplates).where(eq(metroTemplates.status, "active")).limit(1);
      if (defaultTemplate) {
        const result = await createMetroFromTemplate({
          templateId: defaultTemplate.id,
          newMetroName: planJson.targetCity as string,
        });
        metroCreated = { metroId: result.metro.id, cityId: result.city.id, slug: result.metro.slug, planId: req.params.id };
      }
    }

    const plan = await approvePlan(req.params.id);
    return res.json(metroCreated ? { ...plan, metroCreated } : plan);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: msg });
  }
});

router.post("/api/cora/plans/:id/reject", async (req, res) => {
  try {
    const plan = await rejectPlan(req.params.id);
    return res.json(plan);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: msg });
  }
});

router.post("/api/cora/plans/:id/build", async (req, res) => {
  try {
    const result = await buildFromPlan(req.params.id);
    return res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: msg });
  }
});

router.get("/api/cora/builds", async (req, res) => {
  try {
    const planId = req.query.planId as string | undefined;
    const limit = Number(req.query.limit) || 50;
    const logs = await listBuildLogs({ planId, limit });
    return res.json(logs);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
});

router.get("/api/cora/builds/:id", async (req, res) => {
  try {
    const log = await getBuildLog(req.params.id);
    if (!log) return res.status(404).json({ error: "Build log not found" });
    return res.json(log);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
});

router.post("/api/cora/builds/:id/revert", async (req, res) => {
  try {
    const result = await revertBuild(req.params.id);
    return res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: msg });
  }
});

router.post("/api/cora/outreach", async (req, res) => {
  try {
    const { input, scope, metroId, type, targetType } = req.body;
    if (!input || typeof input !== "string") {
      return res.status(400).json({ error: "input is required" });
    }
    const asset = await createOutreachDraft({ input, scope, metroId, type, targetType });
    return res.json(asset);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
});

router.get("/api/cora/outreach", async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const type = req.query.type as string | undefined;
    const targetType = req.query.targetType as string | undefined;
    const limit = Number(req.query.limit) || 50;
    const assets = await listOutreach({ status, type, targetType, limit });
    return res.json(assets);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
});

router.get("/api/cora/outreach/:id", async (req, res) => {
  try {
    const asset = await getOutreach(req.params.id);
    if (!asset) return res.status(404).json({ error: "Outreach asset not found" });
    return res.json(asset);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
});

router.post("/api/cora/outreach/:id/approve", async (req, res) => {
  try {
    const asset = await approveOutreach(req.params.id);
    return res.json(asset);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: msg });
  }
});

router.post("/api/cora/outreach/:id/archive", async (req, res) => {
  try {
    const asset = await archiveOutreach(req.params.id);
    return res.json(asset);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: msg });
  }
});

router.patch("/api/cora/outreach/:id", async (req, res) => {
  try {
    const { title, subjectLine, body } = req.body;
    const asset = await updateOutreach(req.params.id, { title, subjectLine, body });
    return res.json(asset);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: msg });
  }
});

router.post("/api/cora/proposals", async (req, res) => {
  try {
    const { input, scope, metroId } = req.body;
    if (!input || typeof input !== "string") {
      return res.status(400).json({ error: "input is required" });
    }
    const proposal = await createUiProposal({ input, scope, metroId });
    return res.json(proposal);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
});

router.get("/api/cora/proposals", async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const changeType = req.query.changeType as string | undefined;
    const limit = Number(req.query.limit) || 50;
    const proposals = await listProposals({ status, changeType, limit });
    return res.json(proposals);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
});

router.get("/api/cora/proposals/:id", async (req, res) => {
  try {
    const proposal = await getProposal(req.params.id);
    if (!proposal) return res.status(404).json({ error: "UI proposal not found" });
    return res.json(proposal);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
});

router.post("/api/cora/proposals/:id/approve", async (req, res) => {
  try {
    const proposal = await approveProposal(req.params.id);
    return res.json(proposal);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: msg });
  }
});

router.post("/api/cora/proposals/:id/revert", async (req, res) => {
  try {
    const proposal = await revertProposal(req.params.id);
    return res.json(proposal);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: msg });
  }
});

router.patch("/api/cora/proposals/:id", async (req, res) => {
  try {
    const { name, description, previewConfig, codeSnippet } = req.body;
    const proposal = await updateProposal(req.params.id, { name, description, previewConfig, codeSnippet });
    return res.json(proposal);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: msg });
  }
});

router.get("/api/cora/knowledge", async (_req, res) => {
  try {
    const rows = await db.select().from(coraKnowledge).orderBy(desc(coraKnowledge.updatedAt)).limit(50);
    return res.json(rows);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
});

router.patch("/api/cora/knowledge/:id", async (req, res) => {
  try {
    const { value, confidenceLevel, needsReview } = req.body;
    const setFields: Record<string, unknown> = { updatedAt: new Date() };
    if (value !== undefined) setFields.value = value;
    if (confidenceLevel !== undefined) setFields.confidenceLevel = confidenceLevel;
    if (needsReview !== undefined) setFields.needsReview = needsReview;

    const [updated] = await db.update(coraKnowledge)
      .set(setFields)
      .where(eq(coraKnowledge.id, req.params.id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Knowledge entry not found" });
    return res.json(updated);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: msg });
  }
});

router.get("/api/cora/questions", async (_req, res) => {
  try {
    const rows = await db.select().from(coraQuestions).orderBy(desc(coraQuestions.createdAt)).limit(50);
    return res.json(rows);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
});

router.patch("/api/cora/questions/:id", async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: "status is required" });

    const [updated] = await db.update(coraQuestions)
      .set({ status })
      .where(eq(coraQuestions.id, req.params.id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Question not found" });
    return res.json(updated);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: msg });
  }
});

router.get("/api/cora/suggestions", async (_req, res) => {
  try {
    const rows = await db.select().from(coraSuggestions).orderBy(desc(coraSuggestions.createdAt)).limit(50);
    return res.json(rows);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
});

router.patch("/api/cora/suggestions/:id", async (req, res) => {
  try {
    const { approved, executed } = req.body;
    const setFields: Record<string, unknown> = {};
    if (approved !== undefined) setFields.approved = approved;
    if (executed !== undefined) setFields.executed = executed;
    if (Object.keys(setFields).length === 0) return res.status(400).json({ error: "No fields to update" });

    const [updated] = await db.update(coraSuggestions)
      .set(setFields)
      .where(eq(coraSuggestions.id, req.params.id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Suggestion not found" });
    return res.json(updated);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: msg });
  }
});

router.post("/api/cora/test", async (req, res) => {
  try {
    const { input, scope, metroId } = req.body;
    if (!input || typeof input !== "string") {
      return res.status(400).json({ error: "input is required" });
    }
    const result = await handleCoraRequest({ input, scope: scope || "metro", metroId });
    return res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
});

router.post("/api/cora/test/platform", async (req, res) => {
  try {
    const { input } = req.body;
    if (!input || typeof input !== "string") {
      return res.status(400).json({ error: "input is required" });
    }
    const result = await handleCoraRequest({ input, scope: "platform" });
    return res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
});

router.post("/api/cora/test/generate", async (req, res) => {
  try {
    const { sources, metroId, scope } = req.body;
    if (!sources || !Array.isArray(sources) || sources.length === 0) {
      return res.status(400).json({ error: "sources array is required" });
    }
    if (!metroId) {
      return res.status(400).json({ error: "metroId is required" });
    }
    const hat = resolveHat("generate content");
    const outputs = await generateFromApprovedSources({
      sources,
      metroId,
      scope: scope || "metro",
      persona: "cora",
    });
    return res.json({
      hat,
      message: `Generated content for ${outputs.length} source(s). All outputs saved as drafts.`,
      outputs,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
});

router.post("/api/cora/voice/profiles", async (req, res) => {
  try {
    const parsed = createVoiceProfileSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
    const profile = await createVoiceProfile(parsed.data);
    return res.json(profile);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: msg });
  }
});

router.get("/api/cora/voice/profiles", async (req, res) => {
  try {
    const persona = req.query.persona as string | undefined;
    const status = req.query.status as string | undefined;
    const profiles = await listVoiceProfiles({ persona, status });
    return res.json(profiles);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
});

router.post("/api/cora/operator/snapshots", async (req, res) => {
  try {
    const { scope, metroId } = req.body;
    const snapshot = await generateSnapshot({ scope, metroId });
    return res.json(snapshot);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
});

router.get("/api/cora/voice/profiles/:id", async (req, res) => {
  try {
    const profile = await getVoiceProfile(req.params.id);
    if (!profile) return res.status(404).json({ error: "Voice profile not found" });
    return res.json(profile);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
});

router.get("/api/cora/operator/snapshots", async (req, res) => {
  try {
    const scope = req.query.scope as string | undefined;
    const limit = Number(req.query.limit) || 20;
    const snapshots = await listSnapshots({ scope, limit });
    return res.json(snapshots);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
});

router.patch("/api/cora/voice/profiles/:id", async (req, res) => {
  try {
    const parsed = updateVoiceProfileSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
    const profile = await updateVoiceProfile(req.params.id, parsed.data);
    return res.json(profile);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: msg });
  }
});

router.post("/api/cora/voice/profiles/:id/activate", async (req, res) => {
  try {
    const profile = await activateVoiceProfile(req.params.id);
    return res.json(profile);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: msg });
  }
});

router.post("/api/cora/voice/profiles/:id/archive", async (req, res) => {
  try {
    const profile = await archiveVoiceProfile(req.params.id);
    return res.json(profile);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: msg });
  }
});

router.post("/api/cora/voice/profiles/seed", async (_req, res) => {
  try {
    await seedDefaultVoiceProfiles();
    return res.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: msg });
  }
});

router.get("/api/cora/operator/snapshots/:id", async (req, res) => {
  try {
    const snapshot = await getSnapshot(req.params.id);
    if (!snapshot) return res.status(404).json({ error: "Snapshot not found" });
    return res.json(snapshot);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
});

router.post("/api/cora/voice/campaigns", async (req, res) => {
  try {
    const parsed = createCampaignSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
    const campaign = await createCallCampaign(parsed.data);
    return res.json(campaign);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: msg });
  }
});

router.post("/api/cora/operator/opportunities", async (req, res) => {
  try {
    const parsed = insertCoraOpportunitySchema.parse(req.body);
    const opp = await createOpportunity(parsed);
    return res.json(opp);
  } catch (err: unknown) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: msg });
  }
});

router.get("/api/cora/voice/campaigns", async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const campaignType = req.query.campaignType as string | undefined;
    const campaigns = await listCallCampaigns({ status, campaignType });
    return res.json(campaigns);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
});

router.get("/api/cora/operator/opportunities", async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const priority = req.query.priority as string | undefined;
    const scope = req.query.scope as string | undefined;
    const limit = Number(req.query.limit) || 50;
    const opps = await listOpportunities({ status, priority, scope, limit });
    return res.json(opps);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
});

router.get("/api/cora/voice/campaigns/:id", async (req, res) => {
  try {
    const campaign = await getCallCampaign(req.params.id);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    return res.json(campaign);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
});

router.get("/api/cora/operator/opportunities/:id", async (req, res) => {
  try {
    const opp = await getOpportunity(req.params.id);
    if (!opp) return res.status(404).json({ error: "Opportunity not found" });
    return res.json(opp);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
});

router.patch("/api/cora/voice/campaigns/:id", async (req, res) => {
  try {
    const parsed = updateCampaignSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
    const campaign = await updateCallCampaign(req.params.id, parsed.data);
    return res.json(campaign);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: msg });
  }
});

router.patch("/api/cora/operator/opportunities/:id", async (req, res) => {
  try {
    const opp = await updateOpportunity(req.params.id, req.body);
    return res.json(opp);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: msg });
  }
});

router.post("/api/cora/voice/campaigns/:id/transition", async (req, res) => {
  try {
    const parsed = transitionCampaignSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
    const campaign = await transitionCampaignStatus(req.params.id, parsed.data.status);
    return res.json(campaign);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: msg });
  }
});

router.post("/api/cora/operator/opportunities/:id/approve", async (req, res) => {
  try {
    const opp = await approveOpportunity(req.params.id);
    return res.json(opp);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: msg });
  }
});

router.post("/api/cora/voice/campaigns/:id/archive", async (req, res) => {
  try {
    const campaign = await archiveCallCampaign(req.params.id);
    return res.json(campaign);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: msg });
  }
});

router.post("/api/cora/operator/opportunities/:id/archive", async (req, res) => {
  try {
    const opp = await archiveOpportunity(req.params.id);
    return res.json(opp);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: msg });
  }
});

router.post("/api/cora/voice/campaigns/:id/tasks", async (req, res) => {
  try {
    const parsed = createCallTaskSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
    const task = await createCallTask({ ...parsed.data, campaignId: req.params.id });
    return res.json(task);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: msg });
  }
});

router.post("/api/cora/operator/blockers", async (req, res) => {
  try {
    const parsed = insertCoraBlockerSchema.parse(req.body);
    const blocker = await createBlocker(parsed);
    return res.json(blocker);
  } catch (err: unknown) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: msg });
  }
});

router.get("/api/cora/voice/campaigns/:id/tasks", async (req, res) => {
  try {
    const tasks = await listCallTasks(req.params.id);
    return res.json(tasks);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
});

router.patch("/api/cora/voice/tasks/:id", async (req, res) => {
  try {
    const parsed = updateCallTaskSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
    const task = await updateCallTask(req.params.id, parsed.data);
    return res.json(task);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: msg });
  }
});

router.post("/api/cora/voice/answer-flows", async (req, res) => {
  try {
    const parsed = createAnswerFlowSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
    const flow = await createAnswerFlow(parsed.data);
    return res.json(flow);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: msg });
  }
});

router.get("/api/cora/voice/answer-flows", async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const flows = await listAnswerFlows({ status });
    return res.json(flows);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
});

router.get("/api/cora/operator/blockers", async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const severity = req.query.severity as string | undefined;
    const scope = req.query.scope as string | undefined;
    const metroId = req.query.metroId as string | undefined;
    const limit = Number(req.query.limit) || 50;
    const blockers = await listBlockers({ status, severity, scope, metroId, limit });
    return res.json(blockers);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
});

router.get("/api/cora/voice/answer-flows/:id", async (req, res) => {
  try {
    const flow = await getAnswerFlow(req.params.id);
    if (!flow) return res.status(404).json({ error: "Answer flow not found" });
    return res.json(flow);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
});

router.get("/api/cora/operator/blockers/:id", async (req, res) => {
  try {
    const blocker = await getBlocker(req.params.id);
    if (!blocker) return res.status(404).json({ error: "Blocker not found" });
    return res.json(blocker);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
});

router.patch("/api/cora/voice/answer-flows/:id", async (req, res) => {
  try {
    const parsed = updateAnswerFlowSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
    const flow = await updateAnswerFlow(req.params.id, parsed.data);
    return res.json(flow);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: msg });
  }
});

router.patch("/api/cora/operator/blockers/:id", async (req, res) => {
  try {
    const blocker = await updateBlocker(req.params.id, req.body);
    return res.json(blocker);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: msg });
  }
});

router.post("/api/cora/voice/answer-flows/:id/approve", async (req, res) => {
  try {
    const flow = await approveAnswerFlow(req.params.id);
    return res.json(flow);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: msg });
  }
});

router.post("/api/cora/operator/blockers/:id/resolve", async (req, res) => {
  try {
    const blocker = await resolveBlocker(req.params.id);
    return res.json(blocker);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: msg });
  }
});

router.post("/api/cora/voice/answer-flows/:id/reject", async (req, res) => {
  try {
    const flow = await rejectAnswerFlow(req.params.id);
    return res.json(flow);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: msg });
  }
});

router.post("/api/cora/operator/blockers/:id/ignore", async (req, res) => {
  try {
    const blocker = await ignoreBlocker(req.params.id);
    return res.json(blocker);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: msg });
  }
});

router.post("/api/cora/voice/answer-flows/:id/archive", async (req, res) => {
  try {
    const flow = await archiveAnswerFlow(req.params.id);
    return res.json(flow);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: msg });
  }
});

router.post("/api/cora/operator/next-actions", async (req, res) => {
  try {
    const parsed = insertCoraNextActionSchema.parse(req.body);
    const action = await createNextAction(parsed);
    return res.json(action);
  } catch (err: unknown) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: msg });
  }
});

router.post("/api/cora/voice/outbound-flows", async (req, res) => {
  try {
    const parsed = createOutboundFlowSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
    const flow = await createOutboundFlow(parsed.data);
    return res.json(flow);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: msg });
  }
});

router.get("/api/cora/voice/outbound-flows", async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const flows = await listOutboundFlows({ status });
    return res.json(flows);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
});

router.get("/api/cora/operator/next-actions", async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const urgency = req.query.urgency as string | undefined;
    const hat = req.query.hat as string | undefined;
    const scope = req.query.scope as string | undefined;
    const limit = Number(req.query.limit) || 50;
    const actions = await listNextActions({ status, urgency, hat, scope, limit });
    return res.json(actions);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
});

router.get("/api/cora/voice/outbound-flows/:id", async (req, res) => {
  try {
    const flow = await getOutboundFlow(req.params.id);
    if (!flow) return res.status(404).json({ error: "Outbound flow not found" });
    return res.json(flow);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
});

router.get("/api/cora/operator/next-actions/:id", async (req, res) => {
  try {
    const action = await getNextAction(req.params.id);
    if (!action) return res.status(404).json({ error: "Next action not found" });
    return res.json(action);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
});

router.patch("/api/cora/voice/outbound-flows/:id", async (req, res) => {
  try {
    const parsed = updateOutboundFlowSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
    const flow = await updateOutboundFlow(req.params.id, parsed.data);
    return res.json(flow);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: msg });
  }
});

router.patch("/api/cora/operator/next-actions/:id", async (req, res) => {
  try {
    const action = await updateNextAction(req.params.id, req.body);
    return res.json(action);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: msg });
  }
});

router.post("/api/cora/voice/outbound-flows/:id/approve", async (req, res) => {
  try {
    const flow = await approveOutboundFlow(req.params.id);
    return res.json(flow);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: msg });
  }
});

router.post("/api/cora/operator/next-actions/:id/complete", async (req, res) => {
  try {
    const action = await completeNextAction(req.params.id);
    return res.json(action);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: msg });
  }
});

router.post("/api/cora/voice/outbound-flows/:id/reject", async (req, res) => {
  try {
    const flow = await rejectOutboundFlow(req.params.id);
    return res.json(flow);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: msg });
  }
});

router.post("/api/cora/operator/next-actions/:id/skip", async (req, res) => {
  try {
    const action = await skipNextAction(req.params.id);
    return res.json(action);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: msg });
  }
});

router.post("/api/cora/voice/outbound-flows/:id/archive", async (req, res) => {
  try {
    const flow = await archiveOutboundFlow(req.params.id);
    return res.json(flow);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).json({ error: msg });
  }
});

router.get("/api/cora/voice/provider/status", async (_req, res) => {
  try {
    const provider = getVoiceProvider();
    return res.json({
      provider: provider.name,
      configured: isVoiceProviderConfigured(),
      capabilities: {
        tts: isVoiceProviderConfigured(),
        stt: isVoiceProviderConfigured(),
        dialer: isVoiceProviderConfigured(),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
});

router.get("/api/cora/operator/readiness", async (_req, res) => {
  try {
    const readiness = await getAllMetroReadiness();
    return res.json(readiness);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
});

router.post("/api/cora/voice/preview-tts", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string") return res.status(400).json({ error: "text is required" });
    if (text.length > 1000) return res.status(400).json({ error: "text must be under 1000 characters" });

    const provider = getVoiceProvider();
    if (!provider.isConfigured()) {
      return res.json({
        preview: true,
        configured: false,
        text,
        message: "Voice provider not configured yet. This is a draft preview — TTS will be available when a provider is connected.",
        estimatedDurationMs: Math.ceil(text.split(/\s+/).length / 2.5) * 1000,
      });
    }

    const result = await provider.textToSpeech({ text });
    return res.json({
      preview: true,
      configured: true,
      format: result.format,
      durationMs: result.durationMs,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
});

router.get("/api/cora/operator/readiness/:metroId", async (req, res) => {
  try {
    const readiness = await getMetroReadiness(req.params.metroId);
    return res.json(readiness);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
});

}
