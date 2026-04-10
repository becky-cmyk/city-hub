import { storage } from "./storage";
import crypto from "crypto";
import type { WorkflowSession, InsertWorkflowSession, WorkflowEvent, InsertWorkflowFollowUp } from "@shared/schema";

export function generateSessionSecret(): { secret: string; hash: string } {
  const secret = crypto.randomBytes(24).toString("hex");
  const hash = crypto.createHash("sha256").update(secret).digest("hex");
  return { secret, hash };
}

export function hashSessionSecret(secret: string): string {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

type WorkflowStep =
  | "entry" | "match" | "account_check" | "verification" | "attach_ownership"
  | "identity_router" | "basic_activation" | "story_builder" | "capability_activation"
  | "hub_category_setup" | "trust_signals" | "trusted_network_check" | "first_action"
  | "complete";

type WorkflowSource =
  | "activate" | "claim" | "story" | "crown" | "qr" | "cta" | "event" | "job" | "publication";

export const VALID_EVENT_TYPES = [
  "step_advance", "step_skip", "match_found", "match_created", "user_matched", "identity_set",
  "verification_sent", "verification_passed", "error", "pause", "resume", "abandon",
] as const;

type WorkflowEventType = typeof VALID_EVENT_TYPES[number];

export const VALID_IDENTITY_ROLES = [
  "owner", "manager", "employee", "marketing_rep",
  "executive_director", "board_member", "volunteer",
  "host", "organizer", "creator", "contributor",
] as const;

export const VALID_PRESENCE_TYPES = ["commerce", "organization"] as const;

export const IDENTITY_ROLE_CAPABILITIES: Record<string, string[]> = {
  owner: ["MARKETPLACE", "EVENTS", "COMMUNITY", "JOBS"],
  manager: ["MARKETPLACE", "EVENTS", "COMMUNITY", "JOBS"],
  employee: ["COMMUNITY"],
  marketing_rep: ["MARKETPLACE", "COMMUNITY"],
  executive_director: ["EVENTS", "COMMUNITY", "PROVIDER"],
  board_member: ["COMMUNITY"],
  volunteer: ["COMMUNITY"],
  host: ["EVENTS", "COMMUNITY"],
  organizer: ["EVENTS", "COMMUNITY"],
  creator: ["CREATOR", "COMMUNITY"],
  contributor: ["COMMUNITY"],
};

const STEP_ORDER: WorkflowStep[] = [
  "entry", "match", "account_check", "verification", "attach_ownership",
  "identity_router", "basic_activation", "story_builder", "capability_activation",
  "hub_category_setup", "trust_signals", "trusted_network_check", "first_action",
  "complete",
];

const SOURCE_ENTRY_STEPS: Record<string, WorkflowStep> = {
  activate: "entry",
  claim: "match",
  story: "entry",
  crown: "identity_router",
  qr: "entry",
  cta: "entry",
  event: "entry",
  job: "entry",
  publication: "entry",
};

const SOURCE_SKIP_STEPS: Record<string, WorkflowStep[]> = {
  activate: ["entry", "match"],
  claim: ["entry"],
  story: ["entry", "match"],
  crown: ["entry", "match", "account_check", "verification", "attach_ownership"],
  qr: ["entry", "match"],
  cta: ["entry", "match"],
  event: ["entry", "match"],
  job: ["entry", "match"],
  publication: ["entry", "match"],
};

const BASE_OPTIONAL_STEPS = new Set<WorkflowStep>([
  "account_check",
  "attach_ownership",
  "story_builder",
  "hub_category_setup",
  "trust_signals",
  "trusted_network_check",
  "first_action",
]);

const ROLE_REQUIRED_STEPS: Record<string, WorkflowStep[]> = {
  owner: ["verification", "identity_router", "basic_activation", "story_builder"],
  manager: ["verification", "identity_router", "basic_activation", "story_builder"],
  employee: ["identity_router", "basic_activation"],
  marketing_rep: ["identity_router", "basic_activation", "story_builder"],
  executive_director: ["verification", "identity_router", "basic_activation", "story_builder"],
  board_member: ["identity_router", "basic_activation"],
  volunteer: ["identity_router", "basic_activation"],
  host: ["identity_router", "basic_activation"],
  organizer: ["identity_router", "basic_activation"],
  creator: ["identity_router", "basic_activation", "story_builder"],
  contributor: ["identity_router", "basic_activation"],
};

const PRESENCE_REQUIRED_STEPS: Record<string, WorkflowStep[]> = {
  commerce: ["verification", "basic_activation", "hub_category_setup"],
  organization: ["verification", "basic_activation"],
};

function getOptionalSteps(identityRole?: string | null, presenceType?: string | null): Set<WorkflowStep> {
  const optional = new Set(BASE_OPTIONAL_STEPS);

  const roleRequired = identityRole ? (ROLE_REQUIRED_STEPS[identityRole] || []) : [];
  const presenceRequired = presenceType ? (PRESENCE_REQUIRED_STEPS[presenceType] || []) : [];

  for (const step of roleRequired) {
    optional.delete(step as WorkflowStep);
  }
  for (const step of presenceRequired) {
    optional.delete(step as WorkflowStep);
  }

  return optional;
}

function isValidTransition(from: WorkflowStep, to: WorkflowStep, source: WorkflowSource): boolean {
  const fromIdx = STEP_ORDER.indexOf(from);
  const toIdx = STEP_ORDER.indexOf(to);
  if (fromIdx < 0 || toIdx < 0) return false;
  if (toIdx <= fromIdx) return false;

  const skippable = SOURCE_SKIP_STEPS[source] || [];
  for (let i = fromIdx + 1; i < toIdx; i++) {
    if (!skippable.includes(STEP_ORDER[i])) return false;
  }
  return true;
}

function getNextStep(
  current: WorkflowStep,
  source: WorkflowSource,
  identityRole?: string | null,
  presenceType?: string | null
): WorkflowStep | null {
  const idx = STEP_ORDER.indexOf(current);
  if (idx < 0 || idx >= STEP_ORDER.length - 1) return null;

  const skippable = SOURCE_SKIP_STEPS[source] || [];
  const optionalSteps = getOptionalSteps(identityRole, presenceType);
  for (let i = idx + 1; i < STEP_ORDER.length; i++) {
    const step = STEP_ORDER[i];
    if (skippable.includes(step) || optionalSteps.has(step)) continue;
    return step;
  }
  return null;
}

export class WorkflowEngine {
  async startSession(params: {
    cityId: string;
    source: WorkflowSource;
    contactEmail?: string;
    contactPhone?: string;
    contactName?: string;
    businessName?: string;
    entityId?: string;
    entityType?: string;
    presenceType?: string;
    chatSessionId?: string;
    sessionData?: Record<string, unknown>;
    existingSessionSecret?: string;
    internalResume?: boolean;
    listingSlug?: string;
    crownCategoryId?: string;
    qrCodeId?: string;
    eventId?: string;
    jobId?: string;
    ctaRef?: string;
  }): Promise<{ session: WorkflowSession; entryStep: WorkflowStep; resumed: boolean; sessionSecret?: string }> {
    const resumeContext = {
      entityId: params.entityId,
      contactEmail: params.contactEmail,
      businessName: params.businessName,
    };

    const hasContext = resumeContext.entityId || resumeContext.contactEmail || resumeContext.businessName;
    if (hasContext) {
      const existing = await storage.findResumableWorkflowSession(
        params.cityId,
        params.source,
        resumeContext
      );
      if (existing) {
        const isAuthorized =
          params.internalResume === true ||
          (params.existingSessionSecret && existing.sessionSecretHash &&
            hashSessionSecret(params.existingSessionSecret) === existing.sessionSecretHash);

        if (isAuthorized) {
          const { secret: resumeSecret, hash: resumeHash } = generateSessionSecret();
          const updateData: Record<string, unknown> = { sessionSecretHash: resumeHash };
          if (existing.status === "paused") {
            updateData.status = "active";
            await storage.addWorkflowEvent({
              sessionId: existing.id,
              fromStep: existing.currentStep as WorkflowEvent["fromStep"],
              toStep: existing.currentStep as WorkflowEvent["toStep"],
              eventType: "resume",
              eventData: { resumeSource: "start_endpoint" },
            });
          }
          await storage.updateWorkflowSession(existing.id, updateData);
          const refreshed = await storage.getWorkflowSession(existing.id);
          return {
            session: refreshed || existing,
            entryStep: (refreshed || existing).currentStep as WorkflowStep,
            resumed: true,
            sessionSecret: resumeSecret,
          };
        }
      }
    }

    const entryStep = SOURCE_ENTRY_STEPS[params.source] || "entry";
    const { secret, hash } = generateSessionSecret();

    const session = await storage.createWorkflowSession({
      cityId: params.cityId,
      source: params.source as InsertWorkflowSession["source"],
      currentStep: entryStep as InsertWorkflowSession["currentStep"],
      status: "active",
      contactEmail: params.contactEmail || null,
      contactPhone: params.contactPhone || null,
      contactName: params.contactName || null,
      businessName: params.businessName || null,
      entityId: params.entityId || null,
      entityType: params.entityType || null,
      presenceType: params.presenceType || null,
      chatSessionId: params.chatSessionId || null,
      sessionSecretHash: hash,
      sessionData: {
        ...params.sessionData || {},
        ...(params.listingSlug ? { listingSlug: params.listingSlug } : {}),
        ...(params.crownCategoryId ? { crownCategoryId: params.crownCategoryId } : {}),
        ...(params.qrCodeId ? { qrCodeId: params.qrCodeId } : {}),
        ...(params.eventId ? { eventId: params.eventId } : {}),
        ...(params.jobId ? { jobId: params.jobId } : {}),
        ...(params.ctaRef ? { ctaRef: params.ctaRef } : {}),
      },
    });

    await storage.addWorkflowEvent({
      sessionId: session.id,
      fromStep: null,
      toStep: entryStep as WorkflowEvent["toStep"],
      eventType: "step_advance",
      eventData: { source: params.source },
    });

    return { session, entryStep, resumed: false, sessionSecret: secret };
  }

  async advanceStep(
    sessionId: string,
    toStep: WorkflowStep,
    eventData?: Record<string, unknown>,
    sessionUpdates?: Partial<InsertWorkflowSession>
  ): Promise<{ session: WorkflowSession; event: WorkflowEvent }> {
    const session = await storage.getWorkflowSession(sessionId);
    if (!session) throw new Error("Workflow session not found");
    if (session.status !== "active") throw new Error(`Session is ${session.status}, cannot advance`);

    const fromStep = session.currentStep as WorkflowStep;
    const source = session.source as WorkflowSource;

    if (!isValidTransition(fromStep, toStep, source)) {
      throw new Error(`Invalid transition from ${fromStep} to ${toStep} for source ${source}`);
    }

    const updates: Partial<InsertWorkflowSession> = {
      ...sessionUpdates,
      currentStep: toStep as InsertWorkflowSession["currentStep"],
    };
    if (toStep === "complete") {
      updates.status = "completed";
    }

    const updatedSession = await storage.updateWorkflowSession(sessionId, updates);
    if (!updatedSession) throw new Error("Failed to update session");

    const event = await storage.addWorkflowEvent({
      sessionId,
      fromStep: fromStep as WorkflowEvent["fromStep"],
      toStep: toStep as WorkflowEvent["toStep"],
      eventType: "step_advance",
      eventData: eventData || null,
    });

    return { session: updatedSession, event };
  }

  async skipToStep(
    sessionId: string,
    toStep: WorkflowStep,
    reason: string
  ): Promise<{ session: WorkflowSession; event: WorkflowEvent }> {
    const session = await storage.getWorkflowSession(sessionId);
    if (!session) throw new Error("Workflow session not found");

    const fromStep = session.currentStep as WorkflowStep;
    const fromIdx = STEP_ORDER.indexOf(fromStep);
    const toIdx = STEP_ORDER.indexOf(toStep);

    if (toIdx <= fromIdx) {
      throw new Error(`Cannot skip backward from ${fromStep} to ${toStep}`);
    }

    const optionalSteps = getOptionalSteps(session.identityRole, session.presenceType);
    for (let i = fromIdx + 1; i < toIdx; i++) {
      const intermediateStep = STEP_ORDER[i];
      const sourceSkips = SOURCE_SKIP_STEPS[session.source] || [];
      if (!optionalSteps.has(intermediateStep) && !sourceSkips.includes(intermediateStep)) {
        throw new Error(`Cannot skip required step ${intermediateStep}`);
      }
    }

    const updatedSession = await storage.updateWorkflowSession(sessionId, {
      currentStep: toStep as InsertWorkflowSession["currentStep"],
      status: toStep === "complete" ? "completed" : undefined,
    });
    if (!updatedSession) throw new Error("Failed to update session");

    const event = await storage.addWorkflowEvent({
      sessionId,
      fromStep: fromStep as WorkflowEvent["fromStep"],
      toStep: toStep as WorkflowEvent["toStep"],
      eventType: "step_skip",
      eventData: { reason, skippedSteps: STEP_ORDER.slice(fromIdx + 1, toIdx) },
    });

    return { session: updatedSession, event };
  }

  async recordEvent(
    sessionId: string,
    eventType: WorkflowEventType,
    eventData?: Record<string, unknown>
  ): Promise<WorkflowEvent> {
    const session = await storage.getWorkflowSession(sessionId);
    if (!session) throw new Error("Workflow session not found");

    return storage.addWorkflowEvent({
      sessionId,
      fromStep: session.currentStep as WorkflowEvent["fromStep"],
      toStep: session.currentStep as WorkflowEvent["toStep"],
      eventType: eventType as WorkflowEvent["eventType"],
      eventData: eventData || null,
    });
  }

  async matchOrCreateBusiness(
    sessionId: string,
    params: { name: string; city: string; websiteOrSocial?: string }
  ): Promise<{ matched: boolean; businessId: string; businessName: string }> {
    const session = await storage.getWorkflowSession(sessionId);
    if (!session) throw new Error("Workflow session not found");

    if (session.contactEmail) {
      const existingUser = await storage.getUserByEmail(session.contactEmail);
      if (existingUser) {
        await storage.updateWorkflowSession(sessionId, {
          entityId: String(existingUser.id),
          entityType: "user",
        });
        await storage.addWorkflowEvent({
          sessionId,
          fromStep: session.currentStep as WorkflowEvent["fromStep"],
          toStep: session.currentStep as WorkflowEvent["toStep"],
          eventType: "user_matched",
          eventData: { userId: existingUser.id, email: session.contactEmail },
        });
      }
    }

    const matches = await storage.searchBusinessesFuzzy(params.name, params.city, params.websiteOrSocial);

    if (matches.length > 0) {
      const best = matches[0];
      await storage.updateWorkflowSession(sessionId, {
        matchedBusinessId: best.id,
        businessName: best.name,
      });

      await storage.addWorkflowEvent({
        sessionId,
        fromStep: session.currentStep as WorkflowEvent["fromStep"],
        toStep: session.currentStep as WorkflowEvent["toStep"],
        eventType: "match_found",
        eventData: { businessId: best.id, businessName: best.name, matchCount: matches.length },
      });

      return { matched: true, businessId: best.id, businessName: best.name };
    }

    const slug = params.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 80)
      + "-" + Date.now().toString(36);

    const zones = await storage.getZonesByCityId(session.cityId);
    const defaultZoneId = zones[0]?.id;
    if (!defaultZoneId) throw new Error("No zones found for city");

    const draft = await storage.createBusiness({
      cityId: session.cityId,
      zoneId: defaultZoneId,
      name: params.name,
      slug,
      presenceType: (session.presenceType as "commerce" | "organization") || "commerce",
      presenceStatus2: "DRAFT",
      listingTier: "FREE",
      ownerEmail: session.contactEmail || null,
      phone: session.contactPhone || null,
      websiteUrl: params.websiteOrSocial || null,
    } as Parameters<typeof storage.createBusiness>[0]);

    await storage.updateWorkflowSession(sessionId, {
      matchedBusinessId: draft.id,
      businessName: draft.name,
      entityId: draft.id,
      entityType: "business",
    });

    await storage.addWorkflowEvent({
      sessionId,
      fromStep: session.currentStep as WorkflowEvent["fromStep"],
      toStep: session.currentStep as WorkflowEvent["toStep"],
      eventType: "match_created",
      eventData: { businessId: draft.id, businessName: draft.name, slug: draft.slug },
    });

    return { matched: false, businessId: draft.id, businessName: draft.name };
  }

  async setIdentityRole(
    sessionId: string,
    role: string,
    presenceType?: string
  ): Promise<WorkflowEvent> {
    const validRole = VALID_IDENTITY_ROLES.includes(role as typeof VALID_IDENTITY_ROLES[number])
      ? role
      : "contributor";

    const validPresenceType = presenceType && VALID_PRESENCE_TYPES.includes(presenceType as typeof VALID_PRESENCE_TYPES[number])
      ? presenceType
      : undefined;

    await storage.updateWorkflowSession(sessionId, {
      identityRole: validRole,
      presenceType: validPresenceType || undefined,
    });

    const session = await storage.getWorkflowSession(sessionId);

    const capabilityFlags = IDENTITY_ROLE_CAPABILITIES[validRole] || ["COMMUNITY"];
    if (session?.matchedBusinessId) {
      this.provisionCapabilityFlags(session.matchedBusinessId, capabilityFlags, session.cityId).catch(
        (err) => console.error("[WORKFLOW] capability provision:", err)
      );
    }

    return storage.addWorkflowEvent({
      sessionId,
      fromStep: session?.currentStep as WorkflowEvent["fromStep"],
      toStep: session?.currentStep as WorkflowEvent["toStep"],
      eventType: "identity_set",
      eventData: { role: validRole, presenceType: validPresenceType, originalRole: role, capabilityFlags },
    });
  }

  private async provisionCapabilityFlags(
    presenceId: string,
    capabilities: string[],
    cityId: string
  ): Promise<void> {
    const { pool } = await import("./db");

    const hubResult = await pool.query(
      `SELECT id FROM hub_entitlements WHERE presence_id = $1 AND status = 'ACTIVE' LIMIT 1`,
      [presenceId]
    );
    let hubEntitlementId = hubResult.rows[0]?.id;

    if (!hubEntitlementId) {
      const zones = await storage.getZonesByCityId(cityId);
      const defaultHubId = zones[0]?.id;
      if (!defaultHubId) return;

      const insertResult = await pool.query(
        `INSERT INTO hub_entitlements (presence_id, hub_id, city_id, is_base_hub, status)
         VALUES ($1, $2, $3, TRUE, 'ACTIVE')
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [presenceId, defaultHubId, cityId]
      );
      hubEntitlementId = insertResult.rows[0]?.id;
      if (!hubEntitlementId) {
        const refetch = await pool.query(
          `SELECT id FROM hub_entitlements WHERE presence_id = $1 LIMIT 1`,
          [presenceId]
        );
        hubEntitlementId = refetch.rows[0]?.id;
      }
    }

    if (!hubEntitlementId) return;

    for (const cap of capabilities) {
      await pool.query(
        `INSERT INTO capability_entitlements (presence_id, hub_entitlement_id, capability_type, status)
         VALUES ($1, $2, $3::capability_type, 'ACTIVE')
         ON CONFLICT DO NOTHING`,
        [presenceId, hubEntitlementId, cap]
      );
    }
  }

  async pauseSession(sessionId: string, reason?: string): Promise<WorkflowSession> {
    const session = await storage.getWorkflowSession(sessionId);
    if (!session) throw new Error("Workflow session not found");

    await storage.addWorkflowEvent({
      sessionId,
      fromStep: session.currentStep as WorkflowEvent["fromStep"],
      toStep: session.currentStep as WorkflowEvent["toStep"],
      eventType: "pause",
      eventData: reason ? { reason } : null,
    });

    const updated = await storage.updateWorkflowSession(sessionId, { status: "paused" });
    return updated!;
  }

  async resumeSession(sessionId: string): Promise<WorkflowSession> {
    const session = await storage.getWorkflowSession(sessionId);
    if (!session) throw new Error("Workflow session not found");
    if (session.status !== "paused") throw new Error("Session is not paused");

    await storage.addWorkflowEvent({
      sessionId,
      fromStep: session.currentStep as WorkflowEvent["fromStep"],
      toStep: session.currentStep as WorkflowEvent["toStep"],
      eventType: "resume",
      eventData: null,
    });

    const updated = await storage.updateWorkflowSession(sessionId, { status: "active" });
    return updated!;
  }

  async abandonSession(sessionId: string, reason?: string): Promise<WorkflowSession> {
    const session = await storage.getWorkflowSession(sessionId);
    if (!session) throw new Error("Workflow session not found");

    await storage.addWorkflowEvent({
      sessionId,
      fromStep: session.currentStep as WorkflowEvent["fromStep"],
      toStep: session.currentStep as WorkflowEvent["toStep"],
      eventType: "abandon",
      eventData: reason ? { reason } : null,
    });

    const updated = await storage.updateWorkflowSession(sessionId, { status: "abandoned" });
    return updated!;
  }

  async getSessionWithEvents(sessionId: string): Promise<{
    session: WorkflowSession;
    events: WorkflowEvent[];
    nextStep: WorkflowStep | null;
  } | null> {
    const session = await storage.getWorkflowSession(sessionId);
    if (!session) return null;

    const events = await storage.getWorkflowEvents(sessionId);
    const nextStep = session.status === "active"
      ? getNextStep(session.currentStep as WorkflowStep, session.source as WorkflowSource, session.identityRole, session.presenceType)
      : null;

    return { session, events, nextStep };
  }

  getStepOrder(): WorkflowStep[] {
    return [...STEP_ORDER];
  }

  getValidIdentityRoles(): readonly string[] {
    return VALID_IDENTITY_ROLES;
  }

  getValidPresenceTypes(): readonly string[] {
    return VALID_PRESENCE_TYPES;
  }

  async safeAdvance(
    sessionId: string,
    targetStep: WorkflowStep,
    eventData?: Record<string, unknown>,
    sessionUpdates?: Partial<InsertWorkflowSession>
  ): Promise<{ advanced: boolean; session: WorkflowSession }> {
    try {
      const session = await storage.getWorkflowSession(sessionId);
      if (!session || session.status !== "active") {
        return { advanced: false, session: session! };
      }
      const currentIdx = STEP_ORDER.indexOf(session.currentStep as WorkflowStep);
      const targetIdx = STEP_ORDER.indexOf(targetStep);
      if (targetIdx <= currentIdx) {
        return { advanced: false, session };
      }
      const result = await this.advanceStep(sessionId, targetStep, eventData, sessionUpdates);
      return { advanced: true, session: result.session };
    } catch (err) {
      console.error(`[WORKFLOW] safeAdvance to ${targetStep} failed:`, (err as Error).message);
      const session = await storage.getWorkflowSession(sessionId);
      return { advanced: false, session: session! };
    }
  }

  async advanceThroughSteps(
    sessionId: string,
    targetStep: WorkflowStep,
    eventData?: Record<string, unknown>,
    sessionUpdates?: Partial<InsertWorkflowSession>
  ): Promise<{ advanced: boolean; session: WorkflowSession }> {
    try {
      let session = await storage.getWorkflowSession(sessionId);
      if (!session || session.status !== "active") {
        return { advanced: false, session: session! };
      }
      const currentIdx = STEP_ORDER.indexOf(session.currentStep as WorkflowStep);
      const targetIdx = STEP_ORDER.indexOf(targetStep);
      if (targetIdx <= currentIdx) {
        return { advanced: false, session };
      }

      const source = session.source as WorkflowSource;
      const sourceSkips = SOURCE_SKIP_STEPS[source] || [];
      const optionalSteps = getOptionalSteps(session.identityRole, session.presenceType);

      for (let i = currentIdx + 1; i <= targetIdx; i++) {
        const step = STEP_ORDER[i];
        if (i < targetIdx && (optionalSteps.has(step) || sourceSkips.includes(step))) {
          continue;
        }

        const finalUpdates = i === targetIdx ? sessionUpdates : undefined;
        const updates: Partial<InsertWorkflowSession> = {
          ...finalUpdates,
          currentStep: step as InsertWorkflowSession["currentStep"],
        };
        if (step === "complete") {
          updates.status = "completed";
        }

        const updated = await storage.updateWorkflowSession(sessionId, updates);
        if (!updated) throw new Error("Failed to update session");

        const isSkip = i < targetIdx || (session.currentStep as WorkflowStep) !== STEP_ORDER[i - 1];
        await storage.addWorkflowEvent({
          sessionId,
          fromStep: session.currentStep as WorkflowEvent["fromStep"],
          toStep: step as WorkflowEvent["toStep"],
          eventType: isSkip ? "step_skip" : "step_advance",
          eventData: i === targetIdx ? (eventData || null) : { reason: "auto-advance through steps" },
        });

        session = updated;
      }

      return { advanced: true, session };
    } catch (err) {
      console.error(`[WORKFLOW] advanceThroughSteps to ${targetStep} failed:`, (err as Error).message);
      const session = await storage.getWorkflowSession(sessionId);
      return { advanced: false, session: session! };
    }
  }

  async generateRecommendations(sessionId: string): Promise<void> {
    const session = await storage.getWorkflowSession(sessionId);
    if (!session) return;

    const existingRecs = await storage.getWorkflowActionRecommendations(sessionId);
    const existingActiveTypes = new Set(
      existingRecs.filter((r) => !r.dismissed).map((r) => r.actionType)
    );

    const step = session.currentStep as WorkflowStep;
    const recs: Array<{ actionType: string; label: string; description: string; targetUrl: string; priority: number }> = [];

    if (step === "complete" || session.status === "completed") {
      if (session.matchedBusinessId) {
        recs.push({
          actionType: "create_event",
          label: "Create Your First Event",
          description: "Events drive visibility and engagement in your neighborhood.",
          targetUrl: `/charlotte/tell-your-story?intent=event`,
          priority: 1,
        });
        recs.push({
          actionType: "upgrade_tier",
          label: "Explore Listing Upgrades",
          description: "Stand out with enhanced features and priority placement.",
          targetUrl: `/activate?businessId=${session.matchedBusinessId}`,
          priority: 2,
        });
      }
      recs.push({
        actionType: "share_story",
        label: "Share Your Story",
        description: "Tell your neighborhood story and get featured.",
        targetUrl: `/charlotte/tell-your-story`,
        priority: 3,
      });
    } else {
      if (STEP_ORDER.indexOf(step) < STEP_ORDER.indexOf("story_builder")) {
        recs.push({
          actionType: "finish_story",
          label: "Finish Your Story",
          description: "Complete your neighborhood story to unlock features.",
          targetUrl: `/charlotte/tell-your-story`,
          priority: 1,
        });
      }
      if (STEP_ORDER.indexOf(step) < STEP_ORDER.indexOf("verification")) {
        recs.push({
          actionType: "get_verified",
          label: "Get Verified",
          description: "Verify your identity to claim your presence.",
          targetUrl: `/charlotte/tell-your-story`,
          priority: 1,
        });
      }
      if (STEP_ORDER.indexOf(step) >= STEP_ORDER.indexOf("basic_activation") && session.matchedBusinessId) {
        recs.push({
          actionType: "complete_profile",
          label: "Complete Your Profile",
          description: "Add photos, hours, and details to your listing.",
          targetUrl: `/activate?businessId=${session.matchedBusinessId}`,
          priority: 2,
        });
      }
    }

    const deduped = recs.filter((r) => !existingActiveTypes.has(r.actionType));
    const sorted = deduped.sort((a, b) => a.priority - b.priority).slice(0, 3);
    for (const rec of sorted) {
      await storage.createWorkflowActionRecommendation({
        sessionId,
        actionType: rec.actionType,
        label: rec.label,
        description: rec.description,
        targetUrl: rec.targetUrl,
        priority: rec.priority,
        dismissed: false,
      });
    }
  }

  async scheduleFollowUp(
    sessionId: string,
    channel: "email" | "sms" | "internal_task" | "voice",
    message: string,
    delayMs: number
  ): Promise<void> {
    await storage.createWorkflowFollowUp({
      sessionId,
      channel,
      message,
      scheduledAt: new Date(Date.now() + delayMs),
      completedAt: null,
      status: "pending",
    });
  }
}

export const workflowEngine = new WorkflowEngine();
