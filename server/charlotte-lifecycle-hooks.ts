import { db } from "./db";
import { eq } from "drizzle-orm";
import { charlotteFlowSessions, businesses } from "@shared/schema";
import type { CharlotteFlowSession } from "@shared/schema";
import { createInboxItemIfNotOpen } from "./admin-inbox";

export type OnboardingStage = "verify" | "story" | "align" | "recommend" | "close" | "downsell" | "complete";

export interface OnboardingState {
  currentStage: OnboardingStage;
  verified: boolean;
  storyCreated: boolean;
  storyApproved: boolean;
  goalsCaptured: boolean;
  recommendationGiven: boolean;
  setupTriggered: boolean;
  goals?: { visibility?: boolean; localAudience?: boolean; authority?: boolean; participation?: boolean; leads?: boolean; other?: string };
  verificationLink?: string;
  proposalId?: string;
  escalatedToBecky?: boolean;
  escalatedAt?: string;
  completedStages: string[];
  lastHookResult?: { hook: string; success: boolean; message: string; timestamp: string };
}

export interface HookResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  nextStage?: OnboardingStage;
}

const STAGE_ORDER: OnboardingStage[] = ["verify", "story", "align", "recommend", "close", "complete"];

const MIN_CONFIDENCE_FOR_ACTION = 0.5;

export function createDefaultOnboardingState(): OnboardingState {
  return {
    currentStage: "verify",
    verified: false,
    storyCreated: false,
    storyApproved: false,
    goalsCaptured: false,
    recommendationGiven: false,
    setupTriggered: false,
    completedStages: [],
  };
}

export function getOnboardingState(session: CharlotteFlowSession): OnboardingState {
  const raw = session.onboardingState as OnboardingState | null;
  if (raw && raw.currentStage) return raw;
  return createDefaultOnboardingState();
}

export function canAdvanceToStage(current: OnboardingState, target: OnboardingStage): { allowed: boolean; reason?: string } {
  if (target === "downsell") return { allowed: true };

  const currentIdx = STAGE_ORDER.indexOf(current.currentStage);
  const targetIdx = STAGE_ORDER.indexOf(target);

  if (targetIdx < 0) return { allowed: false, reason: `Unknown stage: ${target}` };

  if (targetIdx > currentIdx + 1) {
    return { allowed: false, reason: `Cannot skip from ${current.currentStage} to ${target}. Next stage is ${STAGE_ORDER[currentIdx + 1]}` };
  }

  if (target === "story" && !current.verified) {
    return { allowed: false, reason: "Verification must be completed before the story step" };
  }

  if (target === "align" && !current.storyCreated) {
    return { allowed: false, reason: "Story must be created before the align step" };
  }

  if (target === "recommend" && !current.goalsCaptured) {
    return { allowed: false, reason: "Goals must be captured before the recommend step" };
  }

  if (target === "close" && !current.recommendationGiven) {
    return { allowed: false, reason: "Recommendation must be given before the close step" };
  }

  return { allowed: true };
}

async function updateOnboardingState(sessionId: string, state: OnboardingState): Promise<void> {
  await db
    .update(charlotteFlowSessions)
    .set({ onboardingState: state, updatedAt: new Date() })
    .where(eq(charlotteFlowSessions.id, sessionId));
}

function hookResult(hook: string, success: boolean, message: string, data?: Record<string, unknown>): { hook: string; success: boolean; message: string; timestamp: string } {
  return { hook, success, message, timestamp: new Date().toISOString() };
}

export async function executeVerifyHook(
  sessionId: string,
  options: { businessId?: string; entityName?: string; contactEmail?: string; metroId?: string; confidence?: number }
): Promise<HookResult> {
  const [session] = await db.select().from(charlotteFlowSessions).where(eq(charlotteFlowSessions.id, sessionId)).limit(1);
  if (!session) return { success: false, message: "Session not found" };

  const state = getOnboardingState(session);

  if ((options.confidence ?? 1) < MIN_CONFIDENCE_FOR_ACTION) {
    return { success: false, message: "Confidence too low to trigger verification. Please confirm the business details first." };
  }

  try {
    let verificationLink: string | null = null;
    const baseUrl = process.env.APP_PUBLIC_URL || "https://cltcityhub.com";

    if (options.businessId) {
      const [biz] = await db.select().from(businesses).where(eq(businesses.id, options.businessId)).limit(1);

      if (biz && biz.claimStatus === "CLAIMED" && biz.isVerified) {
        state.verified = true;
        state.completedStages = [...new Set([...state.completedStages, "verify"])];
        state.currentStage = "story";
        state.lastHookResult = hookResult("verify", true, "Business already verified");
        await updateOnboardingState(sessionId, state);
        return { success: true, message: "This business is already verified and active in the hub.", nextStage: "story" };
      }

      verificationLink = `${baseUrl}/activate?presenceId=${options.businessId}`;

      if (biz && biz.claimStatus === "UNCLAIMED") {
        verificationLink = `${baseUrl}/activate?claim=${options.businessId}`;
      }
    } else if (options.entityName) {
      const encodedName = encodeURIComponent(options.entityName);
      verificationLink = `${baseUrl}/activate?name=${encodedName}`;
    } else {
      verificationLink = `${baseUrl}/activate`;
    }

    state.verificationLink = verificationLink;
    state.lastHookResult = hookResult("verify", true, "Verification link generated");
    await updateOnboardingState(sessionId, state);

    return {
      success: true,
      message: `Verification activates your business in the hub so you can participate in the community ecosystem. The $1 verification contributes directly to our community fund and helps prevent spam. Here's your verification link.`,
      data: { verificationLink, businessId: options.businessId || null },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[LifecycleHooks] Verify hook error:", msg);
    state.lastHookResult = hookResult("verify", false, msg);
    await updateOnboardingState(sessionId, state);
    return { success: false, message: `Verification could not be triggered: ${msg}` };
  }
}

export async function markVerifyComplete(sessionId: string): Promise<HookResult> {
  const [session] = await db.select().from(charlotteFlowSessions).where(eq(charlotteFlowSessions.id, sessionId)).limit(1);
  if (!session) return { success: false, message: "Session not found" };

  const state = getOnboardingState(session);
  state.verified = true;
  state.completedStages = [...new Set([...state.completedStages, "verify"])];
  state.currentStage = "story";
  state.lastHookResult = hookResult("verify_complete", true, "Verification confirmed");
  await updateOnboardingState(sessionId, state);

  return { success: true, message: "Verification complete. Let's work on your story next.", nextStage: "story" };
}

export async function executeStoryHook(
  sessionId: string,
  options: { businessId?: string; contactId?: string; mode?: "interview" | "generate"; confidence?: number }
): Promise<HookResult> {
  const [session] = await db.select().from(charlotteFlowSessions).where(eq(charlotteFlowSessions.id, sessionId)).limit(1);
  if (!session) return { success: false, message: "Session not found" };

  const state = getOnboardingState(session);

  if ((options.confidence ?? 1) < MIN_CONFIDENCE_FOR_ACTION) {
    return { success: false, message: "Confidence too low to trigger story generation." };
  }

  try {
    if (options.mode === "generate" && options.contactId) {
      const { generateStoryForCapture } = await import("./services/capture-story-generator");
      const result = await generateStoryForCapture(options.contactId);

      if (result) {
        state.storyCreated = true;
        state.completedStages = [...new Set([...state.completedStages, "story_created"])];
        state.lastHookResult = hookResult("story_generate", true, `Story created: ${result.title}`);
        await updateOnboardingState(sessionId, state);

        return {
          success: true,
          message: `Your story draft has been created: "${result.title}". Take a look and let me know if anything needs adjusting.`,
          data: { articleId: result.articleId, title: result.title },
        };
      }

      return { success: false, message: "Could not generate a story — we may need more information about the business." };
    }

    if (session.flowType === "story-interview" || options.mode === "interview") {
      state.lastHookResult = hookResult("story_interview", true, "Story interview flow active");
      await updateOnboardingState(sessionId, state);

      return {
        success: true,
        message: "The story interview is active. I'll gather your story through our conversation and shape it into a community spotlight.",
        data: { flowType: "story-interview", sessionId },
      };
    }

    if (options.businessId) {
      const { generateStoryArticle } = await import("./charlotte-flows");
      const { openai } = await import("./lib/openai");

      if (openai) {
        const result = await generateStoryArticle(sessionId, openai);
        state.storyCreated = true;
        state.completedStages = [...new Set([...state.completedStages, "story_created"])];
        state.lastHookResult = hookResult("story_generate", true, `Story generated: ${result.title}`);
        await updateOnboardingState(sessionId, state);

        return {
          success: true,
          message: `Here's a preview of your story: "${result.title}". What would you change? Any details we missed or personal story you'd like to add?`,
          data: { title: result.title, articleId: result.articleId },
        };
      }
    }

    return { success: false, message: "Story generation is not available right now. Let me gather your story through our conversation instead." };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[LifecycleHooks] Story hook error:", msg);
    state.lastHookResult = hookResult("story", false, msg);
    await updateOnboardingState(sessionId, state);
    return { success: false, message: `Story step encountered an issue: ${msg}` };
  }
}

export async function markStoryApproved(sessionId: string): Promise<HookResult> {
  const [session] = await db.select().from(charlotteFlowSessions).where(eq(charlotteFlowSessions.id, sessionId)).limit(1);
  if (!session) return { success: false, message: "Session not found" };

  const state = getOnboardingState(session);
  state.storyCreated = true;
  state.storyApproved = true;
  state.completedStages = [...new Set([...state.completedStages, "story"])];
  state.currentStage = "align";
  state.lastHookResult = hookResult("story_approved", true, "Story approved by user");
  await updateOnboardingState(sessionId, state);

  return { success: true, message: "Great — your story is approved! Now let me understand what you're looking to get out of being part of the hub.", nextStage: "align" };
}

export async function executeAlignHook(
  sessionId: string,
  goals: { visibility?: boolean; localAudience?: boolean; authority?: boolean; participation?: boolean; leads?: boolean; other?: string },
  options: { businessId?: string; confidence?: number }
): Promise<HookResult> {
  const [session] = await db.select().from(charlotteFlowSessions).where(eq(charlotteFlowSessions.id, sessionId)).limit(1);
  if (!session) return { success: false, message: "Session not found" };

  const state = getOnboardingState(session);

  const activeGoals = Object.entries(goals).filter(([, v]) => v === true || (typeof v === "string" && v.length > 0));
  if (activeGoals.length === 0) {
    return { success: false, message: "Please share at least one goal so I can recommend the right path for you." };
  }

  try {
    state.goals = goals;
    state.goalsCaptured = true;
    state.completedStages = [...new Set([...state.completedStages, "align"])];
    state.currentStage = "recommend";
    state.lastHookResult = hookResult("align", true, `Goals captured: ${activeGoals.map(([k]) => k).join(", ")}`);
    await updateOnboardingState(sessionId, state);

    if (options.businessId) {
      await db.update(businesses).set({
        opportunityProfile: {
          ...(await getExistingProfile(options.businessId)),
          onboardingGoals: goals,
          goalsUpdatedAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      }).where(eq(businesses.id, options.businessId));
    }

    const goalLabels: string[] = [];
    if (goals.visibility) goalLabels.push("more local visibility");
    if (goals.localAudience) goalLabels.push("reaching a local audience");
    if (goals.authority) goalLabels.push("building authority");
    if (goals.participation) goalLabels.push("community participation");
    if (goals.leads) goalLabels.push("generating leads");
    if (goals.other) goalLabels.push(goals.other);

    return {
      success: true,
      message: `Got it — it sounds like you're looking for ${goalLabels.join(", ")}. Your goals line up well with what the hub is built for. Based on what you've told me, here's what I'd recommend.`,
      data: { goals, goalLabels },
      nextStage: "recommend",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[LifecycleHooks] Align hook error:", msg);
    return { success: false, message: `Could not capture goals: ${msg}` };
  }
}

async function getExistingProfile(businessId: string): Promise<Record<string, unknown>> {
  const [biz] = await db.select({ opportunityProfile: businesses.opportunityProfile }).from(businesses).where(eq(businesses.id, businessId)).limit(1);
  return (biz?.opportunityProfile as Record<string, unknown>) || {};
}

export async function executeRecommendHook(
  sessionId: string,
  options: { businessId?: string; metroId?: string; templateKeys?: string[]; confidence?: number; requireConfirmation?: boolean }
): Promise<HookResult> {
  const [session] = await db.select().from(charlotteFlowSessions).where(eq(charlotteFlowSessions.id, sessionId)).limit(1);
  if (!session) return { success: false, message: "Session not found" };

  const state = getOnboardingState(session);

  if ((options.confidence ?? 1) < MIN_CONFIDENCE_FOR_ACTION) {
    return { success: false, message: "I need a bit more information before I can make a confident recommendation." };
  }

  try {
    if (!options.businessId) {
      state.recommendationGiven = true;
      state.completedStages = [...new Set([...state.completedStages, "recommend"])];
      state.currentStage = "close";
      state.lastHookResult = hookResult("recommend", true, "Generic recommendation given (no business ID)");
      await updateOnboardingState(sessionId, state);

      return {
        success: true,
        message: "Based on your goals, here's the path I'd recommend. This gives you a business portal inside the hub, with distribution already built in across digital, print, TV, and real-world locations.",
        nextStage: "close",
      };
    }

    const { buildProposal } = await import("./charlotte-proposal-engine");
    const { inferSalesLifecycleStage } = await import("./charlotte-orchestrator");

    const lifecycle = await inferSalesLifecycleStage(options.businessId, options.metroId);

    const entity = {
      entityType: "business" as const,
      entityId: options.businessId,
      name: session.businessName || "Business",
      confidence: "HIGH" as const,
    };

    const templateKeys = (options.templateKeys || lifecycle?.suggestedNextActions || []) as any[];
    const validTemplateKeys = templateKeys.filter((k: string) =>
      ["CLAIM_LISTING", "STORY_DRAFT", "BECKY_OUTREACH", "CROWN_CANDIDATE", "FOLLOWUP_EMAIL",
       "LISTING_UPGRADE", "TV_VENUE_SCREEN", "CONTENT_ARTICLE", "EVENT_PROMOTION", "SEARCH_RECOMMENDATION"].includes(k)
    );

    const proposal = await buildProposal(entity, validTemplateKeys.length > 0 ? validTemplateKeys : [], {
      metroId: options.metroId,
      source: "onboarding_recommend",
      directive: `Onboarding recommendation for session ${sessionId}`,
    });

    state.recommendationGiven = true;
    state.proposalId = proposal.id || undefined;
    state.completedStages = [...new Set([...state.completedStages, "recommend"])];
    state.currentStage = "close";
    state.lastHookResult = hookResult("recommend", true, `Proposal created with ${proposal.items.length} actions`);
    await updateOnboardingState(sessionId, state);

    const requireConfirmation = options.requireConfirmation !== false;

    return {
      success: true,
      message: `Based on your goals, I've put together a recommendation with ${proposal.items.length} actions. This is your business portal inside the hub, with distribution already built in.${requireConfirmation ? " Shall I walk you through the setup?" : ""}`,
      data: {
        proposalId: proposal.id,
        itemCount: proposal.items.length,
        items: proposal.items.map(i => ({ template: i.templateKey, entity: i.entityName, status: i.status })),
        requiresConfirmation: requireConfirmation,
      },
      nextStage: "close",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[LifecycleHooks] Recommend hook error:", msg);
    state.lastHookResult = hookResult("recommend", false, msg);
    await updateOnboardingState(sessionId, state);
    return { success: false, message: `Recommendation generation encountered an issue: ${msg}` };
  }
}

export async function executeCloseHook(
  sessionId: string,
  options: { businessId?: string; metroId?: string; confidence?: number }
): Promise<HookResult> {
  const [session] = await db.select().from(charlotteFlowSessions).where(eq(charlotteFlowSessions.id, sessionId)).limit(1);
  if (!session) return { success: false, message: "Session not found" };

  const state = getOnboardingState(session);

  try {
    const checklist: { step: string; status: "complete" | "pending" | "not_started" }[] = [];

    checklist.push({ step: "Verify your business", status: state.verified ? "complete" : "pending" });
    checklist.push({ step: "Create your story", status: state.storyCreated ? "complete" : (state.verified ? "pending" : "not_started") });
    checklist.push({ step: "Approve your story", status: state.storyApproved ? "complete" : (state.storyCreated ? "pending" : "not_started") });
    checklist.push({ step: "Set your goals", status: state.goalsCaptured ? "complete" : "not_started" });
    checklist.push({ step: "Review recommendations", status: state.recommendationGiven ? "complete" : "not_started" });
    checklist.push({ step: "Activate your presence", status: "pending" });

    const baseUrl = process.env.APP_PUBLIC_URL || "https://cltcityhub.com";
    let pricingLink: string | null = null;

    if (options.businessId) {
      pricingLink = `${baseUrl}/activate?presenceId=${options.businessId}&step=pricing`;
    } else {
      pricingLink = `${baseUrl}/activate`;
    }

    state.setupTriggered = true;
    state.completedStages = [...new Set([...state.completedStages, "close"])];
    state.currentStage = "complete";
    state.lastHookResult = hookResult("close", true, "Setup triggered, checklist generated");
    await updateOnboardingState(sessionId, state);

    await db
      .update(charlotteFlowSessions)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(charlotteFlowSessions.id, sessionId));

    return {
      success: true,
      message: "Here's your onboarding checklist. Let me walk you through the setup — it's straightforward from here.",
      data: {
        checklist,
        pricingLink,
        proposalId: state.proposalId,
        completedStages: state.completedStages,
      },
      nextStage: "complete",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[LifecycleHooks] Close hook error:", msg);
    return { success: false, message: `Close step encountered an issue: ${msg}` };
  }
}

export async function executeDownsellHook(
  sessionId: string,
  options: { businessId?: string; contactEmail?: string; contactName?: string; reason?: string; metroId?: string }
): Promise<HookResult> {
  const [session] = await db.select().from(charlotteFlowSessions).where(eq(charlotteFlowSessions.id, sessionId)).limit(1);
  if (!session) return { success: false, message: "Session not found" };

  const state = getOnboardingState(session);

  try {
    const contactName = options.contactName || session.contactName || "there";
    const reason = options.reason || "User expressed hesitation or requested help";

    try {
      await createInboxItemIfNotOpen({
        itemType: "pipeline_needs_review",
        relatedTable: "charlotte_flow_sessions",
        relatedId: sessionId,
        title: `Becky Handoff: ${session.businessName || contactName}`,
        summary: `Charlotte onboarding hesitation detected. ${reason}. Business: ${session.businessName || "Unknown"}. Contact: ${contactName}. Stage: ${state.currentStage}.`,
        priority: "high",
        tags: ["BeckyHandoff", "Onboarding", "Hesitation"],
      });
    } catch (inboxErr: unknown) {
      console.error("[LifecycleHooks] Inbox creation error:", (inboxErr as Error).message);
    }

    if (options.contactEmail) {
      try {
        const { sendBeckyIntroEmail } = await import("./services/becky-outreach");

        const crmContactId = await findOrCreateContact(options.contactEmail, contactName, session.businessName, options.metroId);
        if (crmContactId) {
          await sendBeckyIntroEmail(crmContactId);
        }
      } catch (emailErr: unknown) {
        console.error("[LifecycleHooks] Becky outreach error:", (emailErr as Error).message);
      }
    }

    const bookingUrl = process.env.DEFAULT_BOOKING_URL || "";
    let schedulingNote = "";
    if (bookingUrl) {
      schedulingNote = ` You can also schedule a time that works for you: ${bookingUrl}`;
    }

    state.escalatedToBecky = true;
    state.escalatedAt = new Date().toISOString();
    state.currentStage = "downsell";
    state.lastHookResult = hookResult("downsell", true, "Escalated to Becky");
    await updateOnboardingState(sessionId, state);

    return {
      success: true,
      message: `No problem at all — I've connected you with Becky, who can walk you through everything personally. She'll reach out shortly.${schedulingNote}`,
      data: { escalatedToBecky: true, bookingUrl: bookingUrl || null },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[LifecycleHooks] Downsell hook error:", msg);
    return { success: false, message: `Handoff encountered an issue: ${msg}` };
  }
}

async function findOrCreateContact(email: string, name: string, company?: string | null, metroId?: string): Promise<string | null> {
  try {
    const { crmContacts } = await import("@shared/schema");
    const [existing] = await db.select({ id: crmContacts.id }).from(crmContacts).where(eq(crmContacts.email, email)).limit(1);
    if (existing) return existing.id;

    const { storage } = await import("./storage");
    const contact = await storage.createCrmContact({
      name,
      email,
      company: company || undefined,
      connectionSource: "charlotte_onboarding",
      status: "inbox",
      capturedWithHubId: metroId || undefined,
    } as any);
    return contact?.id || null;
  } catch (err: unknown) {
    console.error("[LifecycleHooks] Contact find/create error:", (err as Error).message);
    return null;
  }
}

export async function executeFollowUpHook(
  sessionId: string,
  options: { businessId?: string; contactEmail?: string; contactName?: string; metroId?: string; reason?: string }
): Promise<HookResult> {
  const [session] = await db.select().from(charlotteFlowSessions).where(eq(charlotteFlowSessions.id, sessionId)).limit(1);
  if (!session) return { success: false, message: "Session not found" };

  const state = getOnboardingState(session);

  try {
    const pendingSteps: string[] = [];
    if (!state.verified) pendingSteps.push("verification");
    if (!state.storyApproved) pendingSteps.push("story approval");
    if (!state.goalsCaptured) pendingSteps.push("goals");
    if (!state.recommendationGiven) pendingSteps.push("recommendation review");

    if (pendingSteps.length === 0) {
      return { success: true, message: "All onboarding steps are complete — no follow-up needed." };
    }

    try {
      const { storage } = await import("./storage");
      const rules = await storage.getActiveAutomationRules();

      const onboardingRule = rules.find((r: any) => r.triggerEvent === "onboarding_incomplete");

      if (onboardingRule) {
        await storage.createAutomationQueueItem({
          ruleId: onboardingRule.id,
          entityType: "charlotte_flow_session",
          entityId: sessionId,
          scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000),
          payload: {
            businessId: options.businessId,
            email: options.contactEmail,
            name: options.contactName || session.contactName,
            pendingSteps,
            reason: options.reason || "Onboarding incomplete",
          },
        } as any);
      }
    } catch (autoErr: unknown) {
      console.error("[LifecycleHooks] Automation queue error:", (autoErr as Error).message);
    }

    try {
      await createInboxItemIfNotOpen({
        itemType: "pipeline_needs_review",
        relatedTable: "charlotte_flow_sessions",
        relatedId: sessionId,
        title: `Follow-up needed: ${session.businessName || session.contactName || "Unknown"}`,
        summary: `Onboarding incomplete. Pending: ${pendingSteps.join(", ")}. Current stage: ${state.currentStage}.`,
        priority: pendingSteps.length >= 3 ? "high" : "med",
        tags: ["FollowUp", "Onboarding", "Charlotte"],
      });
    } catch (inboxErr: unknown) {
      console.error("[LifecycleHooks] Follow-up inbox error:", (inboxErr as Error).message);
    }

    state.lastHookResult = hookResult("followup", true, `Follow-up created for ${pendingSteps.length} pending steps`);
    await updateOnboardingState(sessionId, state);

    return {
      success: true,
      message: `Follow-up tasks created for pending steps: ${pendingSteps.join(", ")}.`,
      data: { pendingSteps, sessionId },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[LifecycleHooks] Follow-up hook error:", msg);
    return { success: false, message: `Follow-up creation failed: ${msg}` };
  }
}

export async function executeExpoItemHook(
  itemId: string,
  options: { metroId: string; operatorUserId: string; generateStory?: boolean; queueOutreach?: boolean; scheduleFollowUp?: boolean }
): Promise<HookResult> {
  try {
    const { pool } = await import("./db");

    const itemResult = await pool.query(`SELECT * FROM capture_session_items WHERE id = $1`, [itemId]);
    if (itemResult.rows.length === 0) return { success: false, message: "Capture item not found" };
    const item = itemResult.rows[0];

    const results: string[] = [];

    if (item.contact_id && options.generateStory) {
      try {
        const { generateStoryForCapture } = await import("./services/capture-story-generator");
        const storyResult = await generateStoryForCapture(item.contact_id);
        if (storyResult) {
          results.push(`Story created: ${storyResult.title}`);
        }
      } catch (storyErr: unknown) {
        console.error("[LifecycleHooks] Expo story error:", (storyErr as Error).message);
      }
    }

    if (item.contact_id && options.queueOutreach) {
      try {
        const { sendBeckyIntroEmail } = await import("./services/becky-outreach");
        const emailResult = await sendBeckyIntroEmail(item.contact_id);
        if (emailResult.success) {
          results.push("Outreach email sent");
        }
      } catch (outreachErr: unknown) {
        console.error("[LifecycleHooks] Expo outreach error:", (outreachErr as Error).message);
      }
    }

    if (options.scheduleFollowUp && (item.contact_id || item.business_id)) {
      try {
        const { storage } = await import("./storage");
        const rules = await storage.getActiveAutomationRules();
        const followUpRule = rules.find((r: any) => r.triggerEvent === "capture_followup" || r.triggerEvent === "booking_no_response");

        if (followUpRule) {
          await storage.createAutomationQueueItem({
            ruleId: followUpRule.id,
            entityType: item.business_id ? "business" : "lead",
            entityId: item.business_id || item.contact_id,
            scheduledFor: new Date(Date.now() + 48 * 60 * 60 * 1000),
            payload: {
              captureItemId: itemId,
              name: item.input_name,
              company: item.input_company,
              email: item.input_email,
            },
          } as any);
          results.push("Follow-up scheduled");
        }
      } catch (schedErr: unknown) {
        console.error("[LifecycleHooks] Expo follow-up scheduling error:", (schedErr as Error).message);
      }
    }

    if (item.confidence === "LOW" || item.processing_status === "low_confidence") {
      try {
        await createInboxItemIfNotOpen({
          itemType: "pipeline_needs_review",
          relatedTable: "capture_session_items",
          relatedId: itemId,
          title: `Low-confidence capture: ${item.input_name || item.input_company || "Unknown"}`,
          summary: `Capture item needs manual review. Name: ${item.input_name || "N/A"}, Company: ${item.input_company || "N/A"}, Confidence: ${item.confidence || "LOW"}.`,
          priority: "med",
          tags: ["CaptureReview", "LowConfidence", "Expo"],
        });
        results.push("Routed to inbox for review");
      } catch (inboxErr: unknown) {
        console.error("[LifecycleHooks] Expo inbox routing error:", (inboxErr as Error).message);
      }
    }

    return {
      success: true,
      message: results.length > 0 ? results.join("; ") : "No actions taken for this item",
      data: { itemId, actionsExecuted: results },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[LifecycleHooks] Expo item hook error:", msg);
    return { success: false, message: `Expo item processing failed: ${msg}` };
  }
}

export function detectHesitation(message: string): boolean {
  const lower = message.toLowerCase();
  const hesitationPatterns = [
    "not sure", "i'm not sure", "let me think", "need to think",
    "too expensive", "can't afford", "not ready", "maybe later",
    "talk to someone", "speak to a person", "human", "real person",
    "help me", "need help", "confused", "don't understand",
    "i'll pass", "no thanks", "not interested",
    "can I talk to", "is there someone", "call me",
    "hold on", "wait", "slow down", "too fast",
  ];
  return hesitationPatterns.some(p => lower.includes(p));
}

export function detectGoalsFromMessage(message: string): { visibility?: boolean; localAudience?: boolean; authority?: boolean; participation?: boolean; leads?: boolean; other?: string } {
  const lower = message.toLowerCase();
  const goals: { visibility?: boolean; localAudience?: boolean; authority?: boolean; participation?: boolean; leads?: boolean; other?: string } = {};

  if (/visib|seen|exposure|noticed|awareness|discover/.test(lower)) goals.visibility = true;
  if (/local|neighborhood|communit|nearby|area|reach/.test(lower)) goals.localAudience = true;
  if (/authorit|expert|trust|credib|reputation|known for/.test(lower)) goals.authority = true;
  if (/participat|join|member|involved|connect|network/.test(lower)) goals.participation = true;
  if (/lead|customer|client|traffic|sale|revenue|booking|referral/.test(lower)) goals.leads = true;

  return goals;
}

export async function executeStageHook(
  sessionId: string,
  stage: OnboardingStage,
  options: Record<string, unknown> = {}
): Promise<HookResult> {
  const [session] = await db.select().from(charlotteFlowSessions).where(eq(charlotteFlowSessions.id, sessionId)).limit(1);
  if (!session) return { success: false, message: "Session not found" };

  const state = getOnboardingState(session);

  if (stage !== "downsell") {
    const check = canAdvanceToStage(state, stage);
    if (!check.allowed) {
      const forceOverride = options.forceOverride === true;
      if (!forceOverride) {
        return { success: false, message: check.reason || "Cannot advance to this stage" };
      }
      console.log(`[LifecycleHooks] Force override: advancing from ${state.currentStage} to ${stage}`);
    }
  }

  switch (stage) {
    case "verify":
      return executeVerifyHook(sessionId, options as any);
    case "story":
      return executeStoryHook(sessionId, options as any);
    case "align":
      return executeAlignHook(sessionId, options.goals as any || {}, options as any);
    case "recommend":
      return executeRecommendHook(sessionId, options as any);
    case "close":
      return executeCloseHook(sessionId, options as any);
    case "downsell":
      return executeDownsellHook(sessionId, options as any);
    case "complete":
      return { success: true, message: "Onboarding complete — all stages finished", data: { stage: "complete" } };
    default:
      return { success: false, message: `Unknown stage: ${stage}` };
  }
}

export function getOnboardingSummary(state: OnboardingState): string {
  const parts: string[] = [];
  parts.push(`Stage: ${state.currentStage}`);
  parts.push(`Verified: ${state.verified ? "yes" : "no"}`);
  parts.push(`Story: ${state.storyApproved ? "approved" : state.storyCreated ? "created" : "pending"}`);
  parts.push(`Goals: ${state.goalsCaptured ? "captured" : "pending"}`);
  parts.push(`Recommendation: ${state.recommendationGiven ? "given" : "pending"}`);
  if (state.escalatedToBecky) parts.push("Escalated to Becky");
  return parts.join(" | ");
}
