import { db } from "./db";
import { pool } from "./db";
import { eq, or, ilike, and } from "drizzle-orm";
import { businesses, crmContacts, events, charlotteFlowSessions } from "@shared/schema";
import { openai } from "./lib/openai";
import { createInboxItemIfNotOpen } from "./admin-inbox";
import { ORCHESTRATOR_INTENT_SYSTEM } from "./ai/prompts/platform-services";

export type OrchestratorMode = "operator" | "proposal" | "search" | "concierge" | "brainstorm";

export interface OrchestratorRequest {
  input: string;
  metroId?: string;
  userId?: string;
  source: "admin_chat" | "public_chat" | "api" | "scheduled";
  context?: Record<string, unknown>;
}

export interface ResolvedEntity {
  entityType: "business" | "contact" | "event" | "zone" | "content" | "unknown";
  entityId: string | null;
  name: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  matchDetails?: string;
}

export interface OrchestratorCommand {
  mode: OrchestratorMode;
  intent: string;
  entities: ResolvedEntity[];
  targetEngines: string[];
  geoContext: { zone?: string; zip?: string; neighborhood?: string } | null;
  confidence: number;
  requiresProposal: boolean;
  batchMode: boolean;
  rawClassification: IntentClassification;
}

export interface IntentClassification {
  mode: OrchestratorMode;
  intent: string;
  entityReferences: EntityReference[];
  desiredAction: string;
  locationHint: string | null;
  confidence: number;
  requiresProposal: boolean;
  batchMode: boolean;
}

export interface EntityReference {
  rawText: string;
  entityType: "business" | "contact" | "event" | "zone" | "content" | "unknown";
  identifiers: { name?: string; phone?: string; email?: string };
}

export interface RoutingPlan {
  steps: RoutingStep[];
  fallback: string | null;
}

export interface RoutingStep {
  engine: string;
  action: string;
  params: Record<string, unknown>;
  order: number;
}

export interface OrchestratorResult {
  command: OrchestratorCommand;
  routing: RoutingPlan;
  logId: string | null;
}


export async function classifyIntent(request: OrchestratorRequest): Promise<IntentClassification> {
  if (!openai) {
    return buildFallbackClassification(request.input);
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: ORCHESTRATOR_INTENT_SYSTEM },
        { role: "user", content: request.input },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return buildFallbackClassification(request.input);

    const parsed = JSON.parse(content) as IntentClassification;

    const validModes: OrchestratorMode[] = ["operator", "proposal", "search", "concierge", "brainstorm"];
    if (!validModes.includes(parsed.mode)) parsed.mode = "concierge";
    if (typeof parsed.confidence !== "number") parsed.confidence = 0.5;
    parsed.confidence = Math.max(0, Math.min(1, parsed.confidence));
    if (!Array.isArray(parsed.entityReferences)) parsed.entityReferences = [];
    if (typeof parsed.intent !== "string") parsed.intent = request.input.substring(0, 80);
    if (typeof parsed.desiredAction !== "string") parsed.desiredAction = parsed.intent;
    if (typeof parsed.locationHint !== "string" && parsed.locationHint !== null) parsed.locationHint = null;
    if (typeof parsed.requiresProposal !== "boolean") parsed.requiresProposal = parsed.mode === "proposal";
    if (typeof parsed.batchMode !== "boolean") parsed.batchMode = false;

    return parsed;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[Orchestrator] Intent classification error:", msg);
    return buildFallbackClassification(request.input);
  }
}

function buildFallbackClassification(input: string): IntentClassification {
  const lower = input.toLowerCase();

  let mode: OrchestratorMode = "concierge";
  if (/import|create|update|publish|delete|add|remove|set|change|upgrade|assign/.test(lower)) mode = "operator";
  else if (/find|search|show|list|who|where|look up|get/.test(lower)) mode = "search";
  else if (/idea|brainstorm|suggest|creative|strategy|content plan/.test(lower)) mode = "brainstorm";
  else if (/campaign|launch|bulk|all businesses|batch/.test(lower)) mode = "proposal";

  return {
    mode,
    intent: input.substring(0, 80),
    entityReferences: [],
    desiredAction: input,
    locationHint: null,
    confidence: 0.3,
    requiresProposal: mode === "proposal",
    batchMode: false,
  };
}

export async function resolveEntities(
  refs: EntityReference[],
  metroId?: string
): Promise<ResolvedEntity[]> {
  const resolved: ResolvedEntity[] = [];

  for (const ref of refs) {
    switch (ref.entityType) {
      case "business":
        resolved.push(await resolveBusinessEntity(ref, metroId));
        break;
      case "contact":
        resolved.push(await resolveContactEntity(ref, metroId));
        break;
      case "event":
        resolved.push(await resolveEventEntity(ref, metroId));
        break;
      case "zone":
        resolved.push(resolveZoneEntity(ref));
        break;
      default:
        resolved.push({
          entityType: ref.entityType,
          entityId: null,
          name: ref.rawText,
          confidence: "LOW",
        });
    }
  }

  return resolved;
}

async function resolveBusinessEntity(ref: EntityReference, metroId?: string): Promise<ResolvedEntity> {
  const { name, phone, email } = ref.identifiers;

  const cityScope = metroId ? eq(businesses.cityId, metroId) : undefined;

  if (name && (phone || email)) {
    const conditions = [ilike(businesses.name, `%${name}%`)];
    if (phone) conditions.push(eq(businesses.phone, phone));
    if (email) conditions.push(eq(businesses.ownerEmail, email));

    const whereClause = cityScope
      ? and(cityScope, conditions[0], or(...conditions.slice(1)))
      : and(conditions[0], or(...conditions.slice(1)));

    const exactMatches = await db
      .select({ id: businesses.id, name: businesses.name })
      .from(businesses)
      .where(whereClause)
      .limit(3);

    if (exactMatches.length === 1) {
      return {
        entityType: "business",
        entityId: exactMatches[0].id,
        name: exactMatches[0].name,
        confidence: "HIGH",
        matchDetails: `Matched by name + ${phone ? "phone" : "email"}`,
      };
    }
  }

  if (name) {
    const nameWhere = cityScope
      ? and(cityScope, ilike(businesses.name, `%${name}%`))
      : ilike(businesses.name, `%${name}%`);

    const fuzzyMatches = await db
      .select({ id: businesses.id, name: businesses.name })
      .from(businesses)
      .where(nameWhere)
      .limit(5);

    if (fuzzyMatches.length === 1) {
      return {
        entityType: "business",
        entityId: fuzzyMatches[0].id,
        name: fuzzyMatches[0].name,
        confidence: "MEDIUM",
        matchDetails: "Single name match",
      };
    }

    if (fuzzyMatches.length > 1) {
      const exactNameMatch = fuzzyMatches.find(
        (m) => m.name.toLowerCase() === name.toLowerCase()
      );
      if (exactNameMatch) {
        return {
          entityType: "business",
          entityId: exactNameMatch.id,
          name: exactNameMatch.name,
          confidence: "MEDIUM",
          matchDetails: `Exact name among ${fuzzyMatches.length} candidates`,
        };
      }

      return {
        entityType: "business",
        entityId: null,
        name: ref.rawText,
        confidence: "LOW",
        matchDetails: `${fuzzyMatches.length} possible matches: ${fuzzyMatches.map((m) => m.name).join(", ")}`,
      };
    }
  }

  if (phone) {
    const phoneWhere = cityScope
      ? and(cityScope, eq(businesses.phone, phone))
      : eq(businesses.phone, phone);

    const phoneMatch = await db
      .select({ id: businesses.id, name: businesses.name })
      .from(businesses)
      .where(phoneWhere)
      .limit(1);

    if (phoneMatch.length === 1) {
      return {
        entityType: "business",
        entityId: phoneMatch[0].id,
        name: phoneMatch[0].name,
        confidence: "HIGH",
        matchDetails: "Matched by phone",
      };
    }
  }

  return {
    entityType: "business",
    entityId: null,
    name: ref.rawText,
    confidence: "LOW",
  };
}

async function resolveContactEntity(ref: EntityReference, _metroId?: string): Promise<ResolvedEntity> {
  const { name, phone, email } = ref.identifiers;

  if (email) {
    const emailMatch = await db
      .select({ id: crmContacts.id, name: crmContacts.name })
      .from(crmContacts)
      .where(eq(crmContacts.email, email))
      .limit(1);

    if (emailMatch.length === 1) {
      return {
        entityType: "contact",
        entityId: emailMatch[0].id,
        name: emailMatch[0].name,
        confidence: "HIGH",
        matchDetails: "Matched by email",
      };
    }
  }

  if (phone) {
    const phoneMatch = await db
      .select({ id: crmContacts.id, name: crmContacts.name })
      .from(crmContacts)
      .where(eq(crmContacts.phone, phone))
      .limit(1);

    if (phoneMatch.length === 1) {
      return {
        entityType: "contact",
        entityId: phoneMatch[0].id,
        name: phoneMatch[0].name,
        confidence: "HIGH",
        matchDetails: "Matched by phone",
      };
    }
  }

  if (name) {
    const nameMatches = await db
      .select({ id: crmContacts.id, name: crmContacts.name })
      .from(crmContacts)
      .where(ilike(crmContacts.name, `%${name}%`))
      .limit(5);

    if (nameMatches.length === 1) {
      return {
        entityType: "contact",
        entityId: nameMatches[0].id,
        name: nameMatches[0].name,
        confidence: "MEDIUM",
        matchDetails: "Single name match",
      };
    }

    if (nameMatches.length > 1) {
      return {
        entityType: "contact",
        entityId: null,
        name: ref.rawText,
        confidence: "LOW",
        matchDetails: `${nameMatches.length} possible matches: ${nameMatches.map((m) => m.name).join(", ")}`,
      };
    }
  }

  return {
    entityType: "contact",
    entityId: null,
    name: ref.rawText,
    confidence: "LOW",
  };
}

async function resolveEventEntity(ref: EntityReference, metroId?: string): Promise<ResolvedEntity> {
  const { name } = ref.identifiers;

  if (!name) {
    return {
      entityType: "event",
      entityId: null,
      name: ref.rawText,
      confidence: "LOW",
    };
  }

  const cityScope = metroId ? eq(events.cityId, metroId) : undefined;
  const nameWhere = cityScope
    ? and(cityScope, ilike(events.title, `%${name}%`))
    : ilike(events.title, `%${name}%`);

  const matches = await db
    .select({ id: events.id, title: events.title })
    .from(events)
    .where(nameWhere)
    .limit(5);

  if (matches.length === 1) {
    return {
      entityType: "event",
      entityId: matches[0].id,
      name: matches[0].title,
      confidence: "MEDIUM",
      matchDetails: "Single title match",
    };
  }

  if (matches.length > 1) {
    const exactMatch = matches.find(
      (m) => m.title.toLowerCase() === name.toLowerCase()
    );
    if (exactMatch) {
      return {
        entityType: "event",
        entityId: exactMatch.id,
        name: exactMatch.title,
        confidence: "MEDIUM",
        matchDetails: `Exact title among ${matches.length} candidates`,
      };
    }

    return {
      entityType: "event",
      entityId: null,
      name: ref.rawText,
      confidence: "LOW",
      matchDetails: `${matches.length} possible matches: ${matches.map((m) => m.title).join(", ")}`,
    };
  }

  return {
    entityType: "event",
    entityId: null,
    name: ref.rawText,
    confidence: "LOW",
  };
}

function resolveZoneEntity(ref: EntityReference): ResolvedEntity {
  return {
    entityType: "zone",
    entityId: null,
    name: ref.identifiers.name || ref.rawText,
    confidence: "MEDIUM",
  };
}

const ENGINE_MAP: Record<string, string[]> = {
  "import": ["google-places"],
  "listing": ["presence-manager"],
  "tier": ["presence-manager", "entitlements"],
  "contact": ["crm"],
  "referral": ["crm"],
  "nudge": ["crm"],
  "engagement": ["crm"],
  "story": ["charlotte-flows"],
  "interview": ["charlotte-flows"],
  "content": ["content-pipeline", "cms"],
  "article": ["content-pipeline"],
  "draft": ["content-pipeline"],
  "outreach": ["outreach-drafter"],
  "campaign": ["outreach-drafter", "email-pipeline"],
  "email": ["email-pipeline", "resend"],
  "sms": ["communication-routes"],
  "pulse": ["pulse-scanner"],
  "signal": ["pulse-scanner"],
  "event": ["events"],
  "venue": ["tv-screens"],
  "tv": ["tv-screens"],
  "screen": ["tv-screens"],
  "radio": ["radio"],
  "music": ["music-library"],
  "podcast": ["podcast-directory"],
  "crown": ["crown"],
  "badge": ["trust-service"],
  "trust": ["trust-service"],
  "review": ["review-solicitor"],
  "marketplace": ["marketplace"],
  "job": ["jobs"],
  "microsite": ["microsite-builder"],
  "site": ["microsite-builder"],
  "seo": ["seo-service"],
  "billing": ["stripe", "entitlements"],
  "subscription": ["stripe", "entitlements"],
  "photo": ["media-assets"],
  "gallery": ["media-assets"],
  "speaker": ["speakers-bureau"],
  "expert": ["expert-directory"],
  "creator": ["creator-directory"],
  "card": ["digital-cards"],
  "automation": ["automation-actions"],
  "pipeline": ["prospect-pipeline"],
  "score": ["entity-scoring", "opportunity-scoring"],
  "report": ["intelligence-reports"],
};

export function routeCommand(command: OrchestratorCommand): RoutingPlan {
  const steps: RoutingStep[] = [];
  const intentLower = command.intent.toLowerCase();
  const actionLower = command.rawClassification.desiredAction.toLowerCase();
  const combinedText = `${intentLower} ${actionLower}`;

  const matchedEngines = new Set<string>();
  for (const [keyword, engines] of Object.entries(ENGINE_MAP)) {
    if (combinedText.includes(keyword)) {
      for (const engine of engines) matchedEngines.add(engine);
    }
  }

  for (const entity of command.entities) {
    if (entity.entityType === "business") matchedEngines.add("presence-manager");
    if (entity.entityType === "contact") matchedEngines.add("crm");
    if (entity.entityType === "event") matchedEngines.add("events");
    if (entity.entityType === "zone") matchedEngines.add("zone-lookup");
  }

  if (matchedEngines.size === 0) {
    if (command.mode === "search") matchedEngines.add("presence-manager");
    else if (command.mode === "brainstorm") matchedEngines.add("content-pipeline");
    else matchedEngines.add("general");
  }

  let order = 0;
  for (const engine of matchedEngines) {
    steps.push({
      engine,
      action: command.rawClassification.desiredAction,
      params: buildEngineParams(engine, command),
      order: order++,
    });
  }

  return {
    steps,
    fallback: command.confidence < 0.4 ? "admin_inbox" : null,
  };
}

function buildEngineParams(engine: string, command: OrchestratorCommand): Record<string, unknown> {
  const params: Record<string, unknown> = {};

  const businessEntity = command.entities.find((e) => e.entityType === "business");
  const contactEntity = command.entities.find((e) => e.entityType === "contact");

  if (businessEntity?.entityId) params.businessId = businessEntity.entityId;
  if (contactEntity?.entityId) params.contactId = contactEntity.entityId;
  if (command.geoContext?.zip) params.zipCode = command.geoContext.zip;
  if (command.geoContext?.zone) params.zone = command.geoContext.zone;
  if (command.geoContext?.neighborhood) params.neighborhood = command.geoContext.neighborhood;

  return params;
}

export async function orchestrate(request: OrchestratorRequest): Promise<OrchestratorResult> {
  const classification = await classifyIntent(request);

  const entities = await resolveEntities(
    classification.entityReferences,
    request.metroId
  );

  const lowConfidenceEntities = entities.filter((e) => e.confidence === "LOW" && e.entityType !== "unknown");
  for (const entity of lowConfidenceEntities) {
    try {
      await createInboxItemIfNotOpen({
        itemType: "pipeline_needs_review",
        relatedTable: "orchestrator_decisions",
        relatedId: `orch_${Date.now()}`,
        title: `Entity match review: ${entity.name}`,
        summary: `The orchestrator could not confidently match "${entity.name}" (${entity.entityType}). ${entity.matchDetails || "No match found."}`,
        priority: "low",
        tags: ["Orchestrator", "Entity Match"],
      });
    } catch (logErr: unknown) {
      const msg = logErr instanceof Error ? logErr.message : "Unknown";
      console.error("[Orchestrator] Failed to create inbox item for low-confidence entity:", msg);
    }
  }

  const geoContext = classification.locationHint
    ? parseGeoContext(classification.locationHint)
    : null;

  const command: OrchestratorCommand = {
    mode: classification.mode,
    intent: classification.intent,
    entities,
    targetEngines: [],
    geoContext,
    confidence: classification.confidence,
    requiresProposal: classification.requiresProposal,
    batchMode: classification.batchMode,
    rawClassification: classification,
  };

  const routing = routeCommand(command);
  command.targetEngines = routing.steps.map((s) => s.engine);

  let logId: string | null = null;
  try {
    logId = await logOrchestratorDecision(request, command, routing);
  } catch (logErr: unknown) {
    const msg = logErr instanceof Error ? logErr.message : "Unknown";
    console.error("[Orchestrator] Failed to log decision:", msg);
  }

  try {
    const { integrateOrchestratorDecision } = await import("./charlotte-ops-center");
    const routing_result = integrateOrchestratorDecision({
      id: logId || "unknown",
      confidence: command.confidence,
      intent: command.intent,
      mode: command.mode,
    });
    if (routing_result.queue === "review" && logId) {
      await createInboxItemIfNotOpen({
        itemType: "pipeline_needs_review",
        relatedTable: "orchestrator_decisions",
        relatedId: logId,
        title: `Ops review: ${command.intent}`,
        summary: `${routing_result.reason}. Confidence: ${(command.confidence * 100).toFixed(0)}%. Mode: ${command.mode}.`,
        priority: "med",
        tags: ["OpsCenter", "Orchestrator", "LowConfidence"],
      });
    }
  } catch (opsErr: unknown) {
    console.error("[Orchestrator] Ops center integration error:", (opsErr as Error).message);
  }

  if (routing.fallback === "admin_inbox" && logId) {
    try {
      await createInboxItemIfNotOpen({
        itemType: "pipeline_needs_review",
        relatedTable: "orchestrator_decisions",
        relatedId: logId,
        title: `Low confidence routing: ${command.intent}`,
        summary: `Orchestrator could not confidently route this request (${(command.confidence * 100).toFixed(0)}% confidence). Mode: ${command.mode}. Engines: ${command.targetEngines.join(", ") || "none"}.`,
        priority: "med",
        tags: ["Orchestrator", "RoutingFallback"],
      });
    } catch (fallbackErr: unknown) {
      console.error("[Orchestrator] Fallback inbox creation failed:", (fallbackErr as Error).message);
    }
  }

  return { command, routing, logId };
}

function parseGeoContext(hint: string): { zone?: string; zip?: string; neighborhood?: string } {
  const zipMatch = hint.match(/\b(\d{5})\b/);
  const result: { zone?: string; zip?: string; neighborhood?: string } = {};

  if (zipMatch) {
    result.zip = zipMatch[1];
  }

  const knownNeighborhoods = [
    "uptown", "south end", "noda", "plaza midwood", "dilworth", "myers park",
    "elizabeth", "southpark", "ballantyne", "university city", "pineville",
    "huntersville", "mooresville", "lake norman", "matthews", "mint hill",
    "indian trail", "waxhaw", "fort mill", "rock hill", "gastonia",
    "concord", "kannapolis", "belmont", "mount holly",
  ];

  const hintLower = hint.toLowerCase();
  for (const hood of knownNeighborhoods) {
    if (hintLower.includes(hood)) {
      result.neighborhood = hood.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      break;
    }
  }

  if (!result.zip && !result.neighborhood) {
    result.zone = hint;
  }

  return result;
}

async function logOrchestratorDecision(
  request: OrchestratorRequest,
  command: OrchestratorCommand,
  routing: RoutingPlan
): Promise<string> {
  const entitiesJson = command.entities.map((e) => ({
    type: e.entityType,
    name: e.name,
    id: e.entityId,
    confidence: e.confidence,
    matchDetails: e.matchDetails || null,
  }));

  const routingJson = routing.steps.map((s) => ({
    engine: s.engine,
    action: s.action,
    order: s.order,
  }));

  const result = await pool.query(
    `INSERT INTO orchestrator_decisions
      (metro_id, source, user_id, mode, intent, confidence, entity_count, entities, target_engines, requires_proposal, batch_mode, routing_steps, input_preview)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING id`,
    [
      request.metroId || null,
      request.source,
      request.userId || null,
      command.mode,
      command.intent,
      command.confidence,
      command.entities.length,
      JSON.stringify(entitiesJson),
      command.targetEngines,
      command.requiresProposal,
      command.batchMode,
      JSON.stringify(routingJson),
      request.input.substring(0, 500),
    ]
  );

  return result.rows[0].id;
}

export interface RecommendationConstraints {
  enforceGeo: boolean;
  enforceTrust: boolean;
  minTrustLevel?: string;
  geoContext?: { zone?: string; zip?: string; neighborhood?: string } | null;
  lifecycleStage?: SalesLifecycleStage;
  sortPolicy?: "trust" | "relevance" | "activity" | "rating";
}

export function buildRecommendationConstraints(command: OrchestratorCommand, routing: RoutingPlan): RecommendationConstraints {
  const constraints: RecommendationConstraints = {
    enforceGeo: true,
    enforceTrust: true,
    geoContext: command.geoContext,
    sortPolicy: "trust",
  };

  const hasPresenceEngine = routing.steps.some(s => s.engine === "presence-manager");
  if (hasPresenceEngine) {
    constraints.minTrustLevel = "T1";
  }

  if (command.mode === "search" || command.mode === "concierge") {
    constraints.enforceGeo = true;
    constraints.enforceTrust = true;
  }

  return constraints;
}

export async function executeWithConstraints(
  result: OrchestratorResult,
  metroId: string
): Promise<{
  searchResults?: { results: unknown[]; domain: string; summary: string; composed?: import("./services/charlotte/charlotte-response-composer").ComposedResponse };
  conciergeResults?: { response: unknown; summary: string; composed?: import("./services/charlotte/charlotte-response-composer").ComposedResponse };
  proposalResults?: { proposal: unknown; summary: string };
  constraints: RecommendationConstraints;
  lifecycleContext?: SalesLifecycleContext | null;
}> {
  const constraints = buildRecommendationConstraints(result.command, result.routing);

  const businessEntity = result.command.entities.find(e => e.entityType === "business");
  let lifecycleContext: SalesLifecycleContext | null = null;
  if (businessEntity?.entityId) {
    lifecycleContext = await inferSalesLifecycleStage(businessEntity.entityId, metroId);
    if (lifecycleContext) {
      constraints.lifecycleStage = lifecycleContext.stage;
      if (lifecycleContext.stage === "verify" || lifecycleContext.stage === "story") {
        constraints.sortPolicy = "trust";
        constraints.minTrustLevel = undefined;
      } else if (lifecycleContext.stage === "close" || lifecycleContext.stage === "recommend") {
        constraints.sortPolicy = "relevance";
      }
    }
  }

  const output: {
    searchResults?: { results: unknown[]; domain: string; summary: string; composed?: import("./services/charlotte/charlotte-response-composer").ComposedResponse };
    conciergeResults?: { response: unknown; summary: string; composed?: import("./services/charlotte/charlotte-response-composer").ComposedResponse };
    proposalResults?: { proposal: unknown; summary: string };
    constraints: RecommendationConstraints;
    lifecycleContext?: SalesLifecycleContext | null;
  } = { constraints, lifecycleContext };

  if (result.command.mode === "search") {
    output.searchResults = await handleSearchMode(result, { metroId, constraints });
  } else if (result.command.mode === "concierge") {
    output.conciergeResults = await handleConciergeMode(result, { metroId, constraints });
  } else if (result.command.mode === "proposal" || result.command.requiresProposal) {
    const proposalResult = await handleProposalMode(result, { metroId });
    output.proposalResults = { proposal: proposalResult.proposal, summary: proposalResult.summary };
  }

  return output;
}

export async function handleProposalMode(result: OrchestratorResult, options: { metroId?: string; userId?: string } = {}): Promise<{
  proposal: import("./charlotte-proposal-engine").Proposal | null;
  summary: string;
}> {
  try {
    const { buildProposalFromOrchestrator, getProposalSummary } = await import("./charlotte-proposal-engine");
    const proposal = await buildProposalFromOrchestrator(result, options);
    if (!proposal) {
      return { proposal: null, summary: "No actionable proposal could be generated from resolved entities" };
    }
    return { proposal, summary: getProposalSummary(proposal) };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown";
    console.error("[Orchestrator] Proposal mode error:", msg);
    return { proposal: null, summary: `Proposal generation failed: ${msg}` };
  }
}

export type SalesLifecycleStage =
  | "verify"
  | "story"
  | "align"
  | "recommend"
  | "close"
  | "downsell"
  | "handoff";

export interface SalesLifecycleContext {
  stage: SalesLifecycleStage;
  businessId: string;
  trustLevel: string | null;
  isVerified: boolean;
  isClaimed: boolean;
  hasStory: boolean;
  suggestedNextActions: string[];
}

export async function inferSalesLifecycleStage(businessId: string, metroId?: string): Promise<SalesLifecycleContext | null> {
  try {
    const { getTrustProfile } = await import("./trust-service");

    const conditions = [eq(businesses.id, businessId)];
    if (metroId) conditions.push(eq(businesses.cityId, metroId));

    const bizRows = await db
      .select({
        id: businesses.id,
        isVerified: businesses.isVerified,
        claimStatus: businesses.claimStatus,
        listingTier: businesses.listingTier,
      })
      .from(businesses)
      .where(and(...conditions))
      .limit(1);

    if (bizRows.length === 0) return null;
    const biz = bizRows[0];

    const profile = await getTrustProfile(businessId);
    const trustLevel = profile ? (profile.trustLevel as string) : null;
    const snapshot = profile?.signalSnapshot as Record<string, unknown> | null;
    const hasStory = !!(snapshot?.storyDepthScore && Number(snapshot.storyDepthScore) > 0);
    const isClaimed = biz.claimStatus === "CLAIMED";
    const isVerified = biz.isVerified;

    let stage: SalesLifecycleStage;
    const suggestedNextActions: string[] = [];

    if (!isVerified) {
      stage = "verify";
      suggestedNextActions.push("Complete business verification");
      if (!isClaimed) suggestedNextActions.push("Claim the listing first");
    } else if (!hasStory) {
      stage = "story";
      suggestedNextActions.push("Schedule a story interview");
      suggestedNextActions.push("Draft an origin story");
    } else if (biz.listingTier === "FREE" || biz.listingTier === "VERIFIED") {
      stage = "align";
      suggestedNextActions.push("Present upgrade options");
      suggestedNextActions.push("Review trust profile together");
    } else {
      const trustRank: Record<string, number> = { T0: 0, T1: 1, T2: 2, T3: 3, T4: 4, T5: 5 };
      const rank = trustRank[trustLevel || "T0"] || 0;

      if (rank >= 3) {
        stage = "close";
        suggestedNextActions.push("Propose Crown participation");
        suggestedNextActions.push("Recommend premium features");
      } else {
        stage = "recommend";
        suggestedNextActions.push("Suggest trust-building activities");
        suggestedNextActions.push("Share success stories from similar businesses");
      }
    }

    return { stage, businessId, trustLevel, isVerified, isClaimed, hasStory, suggestedNextActions };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown";
    console.error("[Orchestrator] Sales lifecycle inference error:", msg);
    return null;
  }
}

const CURATED_INTENT_PATTERN = /\b(best|top|recommend|who should i|where should i|find me|suggest|great|good|popular|favorite|trusted|highly rated)\b/i;
const EXACT_NAME_PATTERN = /^["'](.+)["']$/;

async function checkExactEntityMatch(name: string, metroId: string): Promise<boolean> {
  try {
    const { db } = await import("./db");
    const { businesses } = await import("@shared/schema");
    const { eq, and, ilike } = await import("drizzle-orm");
    const [match] = await db.select({ id: businesses.id })
      .from(businesses)
      .where(and(eq(businesses.cityId, metroId), ilike(businesses.name, name)))
      .limit(1);
    return !!match;
  } catch {
    return false;
  }
}

async function detectSearchIntent(intent: string, metroId: string): Promise<"exact_name" | "curated" | "general"> {
  const exactMatch = EXACT_NAME_PATTERN.exec(intent.trim());
  if (exactMatch) return "exact_name";

  if (CURATED_INTENT_PATTERN.test(intent)) return "curated";

  const words = intent.trim().split(/\s+/);
  const isProperNounLike = words.length >= 2 && words.length <= 5 &&
    words.every(w => /^[A-Z]/.test(w) || /^(the|of|and|at|in|on|&)$/i.test(w));
  if (isProperNounLike) return "exact_name";

  if (metroId && words.length <= 6 && !CURATED_INTENT_PATTERN.test(intent)) {
    const isKnownEntity = await checkExactEntityMatch(intent.trim(), metroId);
    if (isKnownEntity) return "exact_name";
  }

  return "general";
}

export async function processOnboardingMessage(
  sessionId: string,
  message: string,
  options: { businessId?: string; metroId?: string; contactEmail?: string; contactName?: string } = {}
): Promise<{
  hookResult: import("./charlotte-lifecycle-hooks").HookResult | null;
  currentState: import("./charlotte-lifecycle-hooks").OnboardingState;
  hesitationDetected: boolean;
  goalsDetected: Record<string, boolean | string | undefined>;
}> {
  const {
    getOnboardingState,
    executeStageHook,
    executeFollowUpHook,
    executeDownsellHook,
    detectHesitation,
    detectGoalsFromMessage,
    createDefaultOnboardingState,
  } = await import("./charlotte-lifecycle-hooks");

  const [session] = await db
    .select()
    .from(charlotteFlowSessions)
    .where(eq(charlotteFlowSessions.id, sessionId))
    .limit(1);

  if (!session) {
    return {
      hookResult: { success: false, message: "Session not found" },
      currentState: createDefaultOnboardingState(),
      hesitationDetected: false,
      goalsDetected: {},
    };
  }

  const currentState = getOnboardingState(session);
  const hesitationDetected = detectHesitation(message);

  if (hesitationDetected) {
    const hookResult = await executeDownsellHook(sessionId, {
      businessId: options.businessId,
      contactEmail: options.contactEmail,
      contactName: options.contactName,
      reason: `User message indicated hesitation: "${message.substring(0, 100)}"`,
      metroId: options.metroId,
    });
    const [refreshedAfterDownsell] = await db.select().from(charlotteFlowSessions).where(eq(charlotteFlowSessions.id, sessionId)).limit(1);
    const freshStateAfterDownsell = refreshedAfterDownsell ? getOnboardingState(refreshedAfterDownsell) : currentState;
    return { hookResult, currentState: freshStateAfterDownsell, hesitationDetected: true, goalsDetected: {} };
  }

  const goalsDetected = detectGoalsFromMessage(message);
  const hasGoals = Object.values(goalsDetected).some(v => v === true || (typeof v === "string" && v.length > 0));

  if (hasGoals && currentState.currentStage === "align" && !currentState.goalsCaptured) {
    const hookResult = await executeStageHook(sessionId, "align", {
      goals: goalsDetected,
      businessId: options.businessId,
    });
    const [refreshedAfterAlign] = await db.select().from(charlotteFlowSessions).where(eq(charlotteFlowSessions.id, sessionId)).limit(1);
    const freshStateAfterAlign = refreshedAfterAlign ? getOnboardingState(refreshedAfterAlign) : currentState;
    return { hookResult, currentState: freshStateAfterAlign, hesitationDetected: false, goalsDetected };
  }

  return { hookResult: null, currentState, hesitationDetected: false, goalsDetected };
}

export async function advanceOnboardingStage(
  sessionId: string,
  targetStage: import("./charlotte-lifecycle-hooks").OnboardingStage,
  options: Record<string, unknown> = {}
): Promise<import("./charlotte-lifecycle-hooks").HookResult> {
  const { executeStageHook } = await import("./charlotte-lifecycle-hooks");
  return executeStageHook(sessionId, targetStage, options);
}

export async function triggerOnboardingFollowUp(
  sessionId: string,
  options: { businessId?: string; contactEmail?: string; contactName?: string; metroId?: string } = {}
): Promise<import("./charlotte-lifecycle-hooks").HookResult> {
  const { executeFollowUpHook } = await import("./charlotte-lifecycle-hooks");
  return executeFollowUpHook(sessionId, options);
}

export async function handleSearchMode(
  result: OrchestratorResult,
  options: { metroId?: string; constraints?: RecommendationConstraints; userContext?: import("./services/charlotte/charlotte-response-composer").UserContext } = {}
): Promise<{
  results: unknown[];
  domain: string;
  summary: string;
  composed?: import("./services/charlotte/charlotte-response-composer").ComposedResponse;
}> {
  try {
    const { queryRecommendations, getDomainFromQuery, resolveLocationFromText, queryConcierge } = await import("./charlotte-recommendation-connector");
    const { composeCharlotteResponse, composeNoMetroFallback, composeErrorFallback } = await import("./services/charlotte/charlotte-response-composer");
    const metroId = options.metroId || result.command.rawClassification.locationHint || "";
    if (!metroId) {
      return { results: [], domain: "general", summary: "No metro context available for search", composed: composeNoMetroFallback() };
    }

    const constraints = options.constraints;
    const sortBy = constraints?.sortPolicy || "trust";
    const minTrustLevel = constraints?.minTrustLevel;

    const intent = result.command.intent;
    const searchIntent = await detectSearchIntent(intent, metroId);
    const domain = getDomainFromQuery(intent);
    const geo = (constraints?.enforceGeo !== false && result.command.geoContext)
      ? await resolveLocationFromText(
          result.command.geoContext.neighborhood || result.command.geoContext.zone || "",
          metroId
        )
      : undefined;

    console.log(`[Orchestrator] Search routing: intent="${intent}", searchIntent=${searchIntent}, domain=${domain}`);

    if (searchIntent === "exact_name") {
      const exactQuery = EXACT_NAME_PATTERN.exec(intent.trim())?.[1] || intent;
      let directResults = await queryRecommendations({
        metroId,
        query: exactQuery,
        geo: geo || undefined,
        sortBy: "relevance",
        limit: 5,
      });
      const exactMatches = directResults.filter(r => r.name.toLowerCase() === exactQuery.toLowerCase());
      if (exactMatches.length > 0) {
        directResults = exactMatches;
      }

      if (directResults.length === 0) {
        await flagRecommendationGap(intent, domain, metroId);
      }

      const composed = composeCharlotteResponse({
        intent,
        domain,
        results: directResults,
        geoContext: geo ? { zoneName: geo.zoneSlug } : null,
        confidence: result.command.confidence,
        userContext: options.userContext,
      });

      return {
        results: directResults,
        domain,
        summary: `Direct lookup: found ${directResults.length} results for "${exactQuery}"`,
        composed,
      };
    }

    const CONCIERGE_DOMAINS = new Set([
      "jobs", "events", "attractions", "things-to-do", "marketplace",
      "dining", "services", "shopping", "housing", "creators", "experts",
    ]);

    if (searchIntent === "curated" || CONCIERGE_DOMAINS.has(domain)) {
      const effectiveDomain = CONCIERGE_DOMAINS.has(domain) ? domain : "general";
      const conciergeResult = await queryConcierge(metroId, effectiveDomain, intent, geo || undefined);
      if (conciergeResult.results.length === 0) {
        await flagRecommendationGap(intent, effectiveDomain, metroId);
      }
      const composed = composeCharlotteResponse({
        intent,
        domain: effectiveDomain,
        results: conciergeResult.results,
        geoContext: conciergeResult.geoContext,
        confidence: result.command.confidence,
        userContext: options.userContext,
        broadened: conciergeResult.broadened,
        broadeningReason: conciergeResult.broadeningReason,
      });
      return {
        results: conciergeResult.results,
        domain: effectiveDomain,
        summary: `Found ${conciergeResult.results.length} ${effectiveDomain} results for "${intent}"${conciergeResult.broadened ? " (broadened)" : ""}`,
        composed,
      };
    }

    const recommendations = await queryRecommendations({
      metroId,
      query: intent,
      geo: geo || undefined,
      sortBy,
      minTrustLevel: (constraints?.enforceTrust && minTrustLevel) ? minTrustLevel as "T0" | "T1" | "T2" | "T3" | "T4" | "T5" : undefined,
      limit: 15,
    });

    if (recommendations.length === 0) {
      await flagRecommendationGap(intent, domain, metroId);
    }

    const composed = composeCharlotteResponse({
      intent,
      domain,
      results: recommendations,
      geoContext: geo ? { zoneName: geo.zoneSlug } : null,
      confidence: result.command.confidence,
      userContext: options.userContext,
    });

    return {
      results: recommendations,
      domain,
      summary: `Found ${recommendations.length} results for "${intent}" in ${domain} domain`,
      composed,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown";
    console.error("[Orchestrator] Search mode error:", msg);
    const { composeErrorFallback } = await import("./services/charlotte/charlotte-response-composer");
    return { results: [], domain: "general", summary: `Search failed: ${msg}`, composed: composeErrorFallback(msg) };
  }
}

export async function handleConciergeMode(
  result: OrchestratorResult,
  options: { metroId?: string; constraints?: RecommendationConstraints; userContext?: import("./services/charlotte/charlotte-response-composer").UserContext } = {}
): Promise<{
  response: unknown;
  summary: string;
  composed?: import("./services/charlotte/charlotte-response-composer").ComposedResponse;
}> {
  try {
    const { queryConcierge, getDomainFromQuery, resolveLocationFromText } = await import("./charlotte-recommendation-connector");
    const { composeCharlotteResponse, composeNoMetroFallback, composeErrorFallback } = await import("./services/charlotte/charlotte-response-composer");
    const metroId = options.metroId || "";
    if (!metroId) {
      return { response: null, summary: "No metro context available for concierge", composed: composeNoMetroFallback() };
    }

    const constraints = options.constraints;
    const domain = getDomainFromQuery(result.command.intent);
    const geo = (constraints?.enforceGeo !== false && result.command.geoContext)
      ? await resolveLocationFromText(
          result.command.geoContext.neighborhood || result.command.geoContext.zone || "",
          metroId
        )
      : undefined;

    const conciergeResult = await queryConcierge(metroId, domain, result.command.intent, geo || undefined);

    if (conciergeResult.results.length === 0) {
      await flagRecommendationGap(result.command.intent, domain, metroId);
    }

    const composed = composeCharlotteResponse({
      intent: result.command.intent,
      domain,
      results: conciergeResult.results,
      geoContext: conciergeResult.geoContext,
      confidence: result.command.confidence,
      userContext: options.userContext,
      broadened: conciergeResult.broadened,
      broadeningReason: conciergeResult.broadeningReason,
    });

    return {
      response: conciergeResult,
      summary: `Concierge: ${conciergeResult.results.length} ${domain} results with ${conciergeResult.followOnSuggestions.length} suggestions${conciergeResult.broadened ? " (broadened)" : ""}`,
      composed,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown";
    console.error("[Orchestrator] Concierge mode error:", msg);
    const { composeErrorFallback } = await import("./services/charlotte/charlotte-response-composer");
    return { response: null, summary: `Concierge failed: ${msg}`, composed: composeErrorFallback(msg) };
  }
}

async function flagRecommendationGap(
  query: string,
  domain: string,
  metroId: string,
): Promise<void> {
  try {
    await createInboxItemIfNotOpen({
      itemType: "recommendation_gap",
      relatedTable: "orchestrator_decisions",
      relatedId: `gap-${metroId}-${domain}`,
      title: `Coverage gap: no ${domain} results`,
      summary: `Charlotte search returned 0 results for "${query.slice(0, 200)}" in the ${domain} domain (metro: ${metroId}). This may indicate a content or listing gap that needs attention.`,
      priority: "low",
      tags: ["RecommendationGap", domain],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown";
    console.error("[Orchestrator] Recommendation gap inbox error:", msg);
  }
}

export function getOrchestratorSummary(result: OrchestratorResult): string {
  const { command, routing } = result;
  const parts = [
    `Mode: ${command.mode}`,
    `Intent: ${command.intent}`,
    `Confidence: ${(command.confidence * 100).toFixed(0)}%`,
    `Engines: ${command.targetEngines.join(", ")}`,
  ];

  if (command.entities.length > 0) {
    const entitySummary = command.entities
      .map((e) => `${e.name} (${e.entityType}, ${e.confidence})`)
      .join("; ");
    parts.push(`Entities: ${entitySummary}`);
  }

  if (command.geoContext) {
    const geo = [
      command.geoContext.neighborhood,
      command.geoContext.zip,
      command.geoContext.zone,
    ].filter(Boolean).join(", ");
    if (geo) parts.push(`Geo: ${geo}`);
  }

  if (command.requiresProposal) parts.push("Requires proposal review");
  if (command.batchMode) parts.push("Batch operation");

  return parts.join(" | ");
}

export interface EngagementContext {
  triggers: import("./charlotte-engagement-triggers").EngagementTrigger[];
  participationSuggestions: import("./charlotte-engagement-triggers").ParticipationSuggestion[];
  contentPrompt: import("./charlotte-content-prompter").ContentPrompt | null;
  upsellOpportunities: import("./charlotte-upsell-detector").UpsellOpportunity[];
}

async function evaluateEntityTriggers(
  businessId: string,
  metroId: string
): Promise<import("./charlotte-engagement-triggers").EngagementTrigger[]> {
  const triggers: import("./charlotte-engagement-triggers").EngagementTrigger[] = [];

  try {
    const [biz] = await db
      .select({
        id: businesses.id,
        name: businesses.name,
        listingTier: businesses.listingTier,
        listingType: businesses.listingType,
        claimStatus: businesses.claimStatus,
        isVerified: businesses.isVerified,
        updatedAt: businesses.updatedAt,
        venueScreenLikely: businesses.venueScreenLikely,
        claimedAt: businesses.claimedAt,
      })
      .from(businesses)
      .where(and(eq(businesses.id, businessId), eq(businesses.cityId, metroId)))
      .limit(1);

    if (!biz || biz.claimStatus !== "CLAIMED") return triggers;

    const daysSinceUpdate = Math.floor(
      (Date.now() - (biz.updatedAt?.getTime() || 0)) / (24 * 60 * 60 * 1000)
    );
    if (daysSinceUpdate >= 30) {
      triggers.push({
        triggerType: "inactivity",
        entityId: biz.id,
        entityName: biz.name,
        recommendedNextAction: "send_reengagement_prompt",
        priority: daysSinceUpdate > 90 ? "high" : daysSinceUpdate > 60 ? "medium" : "low",
        reason: `No activity in ${daysSinceUpdate} days`,
        metadata: { daysSinceUpdate, listingTier: biz.listingTier },
      });
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const isRecentlyClaimed = biz.claimedAt && biz.claimedAt > sevenDaysAgo;
    if (biz.isVerified && isRecentlyClaimed) {
      triggers.push({
        triggerType: "new_capability",
        entityId: biz.id,
        entityName: biz.name,
        recommendedNextAction: "suggest_story_creation",
        priority: "high",
        reason: "Recently verified — ready for story creation and deeper participation",
        metadata: { capability: "verified", listingTier: biz.listingTier },
      });
    }

    if (biz.isVerified && biz.venueScreenLikely && isRecentlyClaimed) {
      triggers.push({
        triggerType: "new_capability",
        entityId: biz.id,
        entityName: biz.name,
        recommendedNextAction: "suggest_tv_venue",
        priority: "medium",
        reason: "Venue-type business recently claimed — eligible for venue screen placement",
        metadata: { capability: "tv_venue_eligible" },
      });
    }

    const { entityScores: entityScoresTable, trustProfiles: trustProfilesTable } = await import("@shared/schema");
    const [scores] = await db
      .select({ prospectFitScore: entityScoresTable.prospectFitScore })
      .from(entityScoresTable)
      .where(eq(entityScoresTable.entityId, businessId))
      .limit(1);

    if (scores && scores.prospectFitScore >= 70 && !biz.isVerified) {
      triggers.push({
        triggerType: "opportunity_detected",
        entityId: biz.id,
        entityName: biz.name,
        recommendedNextAction: "suggest_verification",
        priority: scores.prospectFitScore >= 85 ? "high" : "medium",
        reason: `High prospect fit score (${scores.prospectFitScore}) — strong candidate for verification`,
        metadata: { prospectFitScore: scores.prospectFitScore },
      });
    }

    const [trust] = await db
      .select({ trustLevel: trustProfilesTable.trustLevel })
      .from(trustProfilesTable)
      .where(eq(trustProfilesTable.businessId, businessId))
      .limit(1);

    const trustRank: Record<string, number> = { T0: 0, T1: 1, T2: 2, T3: 3, T4: 4, T5: 5 };
    const currentTrustRank = trustRank[(trust?.trustLevel as string) || "T0"] || 0;
    const isLowTier = biz.listingTier === "FREE" || biz.listingTier === "VERIFIED";

    if (currentTrustRank >= 4 && isLowTier) {
      triggers.push({
        triggerType: "opportunity_detected",
        entityId: biz.id,
        entityName: biz.name,
        recommendedNextAction: "suggest_crown_participation",
        priority: "high",
        reason: `Trust level ${trust?.trustLevel} — strong Crown candidate`,
        metadata: { trustLevel: trust?.trustLevel, currentTier: biz.listingTier },
      });
    }

    triggers.sort((a, b) => {
      const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
      return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown";
    console.error("[Orchestrator] Entity trigger evaluation error:", msg);
  }

  return triggers;
}

const ENGAGEMENT_CACHE_TTL_MS = 5 * 60 * 1000;
const engagementCache = new Map<string, { context: EngagementContext | null; expiresAt: number }>();

export async function detectEngagementOpportunities(
  businessId: string,
  metroId: string
): Promise<EngagementContext | null> {
  const cacheKey = `${businessId}:${metroId}`;
  const cached = engagementCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.context;
  }

  try {
    const { getParticipationSuggestions } = await import("./charlotte-engagement-triggers");
    const { generateContentPrompt } = await import("./charlotte-content-prompter");
    const { detectUpsellOpportunities } = await import("./charlotte-upsell-detector");

    const TIMEOUT_MS = 3000;
    const withTimeout = <T>(promise: Promise<T>, fallback: T): Promise<T> =>
      Promise.race([promise, new Promise<T>(resolve => setTimeout(() => resolve(fallback), TIMEOUT_MS))]);

    const [entityTriggers, participationSuggestions, upsellOpportunities] = await Promise.all([
      withTimeout(evaluateEntityTriggers(businessId, metroId), []),
      withTimeout(getParticipationSuggestions(businessId), []),
      withTimeout(detectUpsellOpportunities(businessId), []),
    ]);

    let contentPrompt: import("./charlotte-content-prompter").ContentPrompt | null = null;
    if (entityTriggers.length > 0) {
      const topTrigger = entityTriggers[0];
      const [biz] = await db
        .select({ id: businesses.id, name: businesses.name, listingTier: businesses.listingTier, neighborhood: businesses.neighborhood })
        .from(businesses)
        .where(eq(businesses.id, businessId))
        .limit(1);

      if (biz) {
        contentPrompt = generateContentPrompt({
          entity: {
            id: biz.id,
            name: biz.name,
            listingTier: biz.listingTier || undefined,
            neighborhood: biz.neighborhood || undefined,
          },
          trigger: topTrigger,
        });
      }
    }

    const hasOpportunities =
      entityTriggers.length > 0 ||
      participationSuggestions.length > 0 ||
      upsellOpportunities.length > 0;

    const context = hasOpportunities ? {
      triggers: entityTriggers,
      participationSuggestions,
      contentPrompt,
      upsellOpportunities,
    } : null;

    engagementCache.set(cacheKey, { context, expiresAt: Date.now() + ENGAGEMENT_CACHE_TTL_MS });

    if (engagementCache.size > 200) {
      const now = Date.now();
      for (const [key, val] of engagementCache) {
        if (val.expiresAt < now) engagementCache.delete(key);
      }
    }

    return context;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown";
    console.error("[Orchestrator] Engagement detection error:", msg);
    return null;
  }
}

export function buildEngagementSuggestionText(context: EngagementContext): string {
  const parts: string[] = [];

  if (context.contentPrompt) {
    parts.push(context.contentPrompt.prompt);
  }

  if (context.participationSuggestions.length > 0) {
    const topSuggestions = context.participationSuggestions.slice(0, 3);
    const surfaceList = topSuggestions.map(s => `${s.surface}: ${s.reason}`);
    parts.push(`\nSuggested participation surfaces:\n${surfaceList.map(s => `  • ${s}`).join("\n")}`);
  }

  if (context.upsellOpportunities.length > 0 && context.upsellOpportunities[0].confidence !== "low") {
    const topUpsell = context.upsellOpportunities[0];
    parts.push(`\n${topUpsell.recommendedAction}`);
  }

  return parts.join("\n");
}

export async function executeWithEngagementCheck(
  result: OrchestratorResult,
  metroId: string
): Promise<{
  searchResults?: { results: unknown[]; domain: string; summary: string; composed?: import("./services/charlotte/charlotte-response-composer").ComposedResponse };
  conciergeResults?: { response: unknown; summary: string; composed?: import("./services/charlotte/charlotte-response-composer").ComposedResponse };
  proposalResults?: { proposal: unknown; summary: string };
  constraints: RecommendationConstraints;
  lifecycleContext?: SalesLifecycleContext | null;
  engagementContext?: EngagementContext | null;
  engagementSuggestion?: string;
}> {
  const baseResult = await executeWithConstraints(result, metroId);

  const businessEntity = result.command.entities.find(e => e.entityType === "business");
  let engagementContext: EngagementContext | null = null;
  let engagementSuggestion: string | undefined;

  if (businessEntity?.entityId && result.command.mode !== "proposal") {
    engagementContext = await detectEngagementOpportunities(businessEntity.entityId, metroId);

    if (engagementContext) {
      engagementSuggestion = buildEngagementSuggestionText(engagementContext);
    }
  }

  return {
    ...baseResult,
    engagementContext,
    engagementSuggestion,
  };
}

const TRIGGER_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const firedTriggerCooldowns = new Map<string, number>();

function hasTriggerCooldown(entityId: string, triggerType: string, action: string): boolean {
  const key = `${entityId}:${triggerType}:${action}`;
  const lastFired = firedTriggerCooldowns.get(key);
  if (lastFired && Date.now() - lastFired < TRIGGER_COOLDOWN_MS) return true;
  return false;
}

function markTriggerFired(entityId: string, triggerType: string, action: string): void {
  const key = `${entityId}:${triggerType}:${action}`;
  firedTriggerCooldowns.set(key, Date.now());

  if (firedTriggerCooldowns.size > 5000) {
    const cutoff = Date.now() - TRIGGER_COOLDOWN_MS;
    for (const [k, v] of firedTriggerCooldowns) {
      if (v < cutoff) firedTriggerCooldowns.delete(k);
    }
  }
}

export async function fireEngagementTriggers(
  metroId: string,
  options: { maxTriggers?: number; delayMinutes?: number } = {}
): Promise<{ fired: number; errors: number; skipped: number }> {
  const maxTriggers = options.maxTriggers || 20;
  let fired = 0;
  let errors = 0;
  let skipped = 0;

  try {
    const { evaluateAllTriggers } = await import("./charlotte-engagement-triggers");
    const { enqueueEngagementAction } = await import("./services/automation-actions");

    const triggers = await evaluateAllTriggers(metroId);
    const toFire = triggers.slice(0, maxTriggers);

    for (const trigger of toFire) {
      if (hasTriggerCooldown(trigger.entityId, trigger.triggerType, trigger.recommendedNextAction)) {
        skipped++;
        continue;
      }

      try {
        const result = await enqueueEngagementAction(trigger, {
          delayMinutes: options.delayMinutes,
          cityId: metroId,
        });
        if (result.queued) {
          fired++;
          markTriggerFired(trigger.entityId, trigger.triggerType, trigger.recommendedNextAction);
        } else {
          skipped++;
        }
      } catch {
        errors++;
      }
    }

    console.log(`[Orchestrator] Fired ${fired} engagement triggers for metro ${metroId} (${skipped} skipped, ${errors} errors)`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown";
    console.error("[Orchestrator] Engagement trigger firing error:", msg);
  }

  return { fired, errors, skipped };
}
