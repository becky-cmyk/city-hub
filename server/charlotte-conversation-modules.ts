import {
  CONVERSATION_MODULES,
  CONVERSATION_PERSONAS,
  type ConversationModule,
  type ConversationPersona,
} from "@shared/schema";

type ProfileResponses = Record<string, { answer: string | string[]; answeredAt: string }>;

export function getModulesForPersona(
  personaId: string | null,
  completedModules: string[]
): ConversationModule[] {
  const completed = new Set(completedModules);

  let modules = CONVERSATION_MODULES.filter((m) => {
    if (completed.has(m.id)) return false;
    if (m.priority === "intent_only") return false;
    if (m.applicablePersonas === "all") return true;
    if (!personaId) return m.priority === "core";
    return m.applicablePersonas.includes(personaId);
  });

  const priorityOrder: Record<string, number> = { core: 0, contextual: 1, opportunistic: 2, intent_only: 3 };
  modules.sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2));

  return modules;
}

const NATURAL_FLOW_ORDER = [
  "personal_story",
  "business_contact_details",
  "origin_story",
  "mentor_inspiration",
  "primary_business",
  "neighborhood",
  "community_impact",
  "customer_perspective",
  "vision_passion",
  "events_gatherings",
  "local_recommendations",
  "category_recommendations",
  "community_connectors",
  "venue_screens",
  "community_boards",
  "cross_promotion",
  "job_employment",
  "micro_business",
  "marketplace_classified",
  "coworking_entrepreneur",
  "collaboration_network",
  "local_media",
  "social_influencer",
  "neighborhood_history",
  "community_needs",
  "local_pride",
];

export function selectNextModule(
  personaId: string | null,
  completedModules: string[],
  currentResponses: ProfileResponses
): ConversationModule | null {
  const available = getModulesForPersona(personaId, completedModules);
  if (available.length === 0) return null;

  const coreModules = available.filter((m) => m.priority === "core");
  if (coreModules.length > 0) {
    coreModules.sort(
      (a, b) =>
        NATURAL_FLOW_ORDER.indexOf(a.id) - NATURAL_FLOW_ORDER.indexOf(b.id)
    );
    return coreModules[0];
  }

  const persona = CONVERSATION_PERSONAS.find((p) => p.id === personaId);
  if (persona) {
    const prioritized = available.filter((m) =>
      persona.priorityModules.includes(m.id)
    );
    if (prioritized.length > 0) {
      prioritized.sort(
        (a, b) =>
          NATURAL_FLOW_ORDER.indexOf(a.id) - NATURAL_FLOW_ORDER.indexOf(b.id)
      );
      return prioritized[0];
    }
  }

  const contextual = available.filter((m) => m.priority === "contextual");
  if (contextual.length > 0) {
    contextual.sort(
      (a, b) =>
        NATURAL_FLOW_ORDER.indexOf(a.id) - NATURAL_FLOW_ORDER.indexOf(b.id)
    );
    return contextual[0];
  }

  available.sort(
    (a, b) =>
      NATURAL_FLOW_ORDER.indexOf(a.id) - NATURAL_FLOW_ORDER.indexOf(b.id)
  );
  return available[0];
}

export function getVariedPromptForModule(
  moduleId: string,
  context: { businessName?: string; neighborhoodName?: string; cityName?: string }
): string {
  const mod = CONVERSATION_MODULES.find((m) => m.id === moduleId);
  if (!mod) return "";

  const idx = Math.floor(Math.random() * mod.examplePrompts.length);
  let prompt = mod.examplePrompts[idx];

  if (context.businessName) {
    prompt = prompt.replace(/\{businessName\}/g, context.businessName);
  }
  if (context.neighborhoodName) {
    prompt = prompt.replace(/\{neighborhoodName\}/g, context.neighborhoodName);
  }
  if (context.cityName) {
    prompt = prompt.replace(/\{cityName\}/g, context.cityName);
  }

  return prompt;
}

export function getPromptOptionsForModule(
  moduleId: string,
  context: { businessName?: string; neighborhoodName?: string; cityName?: string }
): string[] {
  const mod = CONVERSATION_MODULES.find((m) => m.id === moduleId);
  if (!mod) return [];

  return mod.examplePrompts.map((p) => {
    let result = p;
    if (context.businessName) result = result.replace(/\{businessName\}/g, context.businessName);
    if (context.neighborhoodName) result = result.replace(/\{neighborhoodName\}/g, context.neighborhoodName);
    if (context.cityName) result = result.replace(/\{cityName\}/g, context.cityName);
    return result;
  });
}

export function detectPersonaFromResponses(
  currentResponses: ProfileResponses
): string | null {
  const allText = Object.values(currentResponses)
    .map((r) => (Array.isArray(r.answer) ? r.answer.join(" ") : r.answer))
    .join(" ")
    .toLowerCase();

  const scores: Record<string, number> = {};

  for (const persona of CONVERSATION_PERSONAS) {
    let score = 0;
    for (const signal of persona.detectionSignals) {
      if (allText.includes(signal.toLowerCase())) {
        score++;
      }
    }
    if (score > 0) scores[persona.id] = score;
  }

  if (Object.keys(scores).length === 0) return null;

  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
}

export function getModuleById(moduleId: string): ConversationModule | null {
  return CONVERSATION_MODULES.find((m) => m.id === moduleId) || null;
}

export function getPersonaById(personaId: string): ConversationPersona | null {
  return CONVERSATION_PERSONAS.find((p) => p.id === personaId) || null;
}

export function getCompletedModuleSummary(
  completedModules: string[]
): string[] {
  return completedModules
    .map((id) => {
      const mod = CONVERSATION_MODULES.find((m) => m.id === id);
      return mod ? mod.name : id;
    });
}
