import type { RecommendationResult, ResolvedActionRoute, ConciergeDomain } from "../../charlotte-recommendation-connector";
import { resolveActionRoute } from "../../charlotte-recommendation-connector";
import { getDomainTemplate, pickRandom } from "./charlotte-response-templates";
import type { DomainTemplate } from "./charlotte-response-templates";

export interface UserContext {
  isReturning: boolean;
  userId?: string;
  name?: string;
}

export interface ComposedAction {
  entityId: string;
  entityName: string;
  routes: ResolvedActionRoute[];
}

export interface ComposedResponse {
  message: string;
  recommendations: Array<{
    id: string;
    name: string;
    highlight: string;
    reason: string;
    trustLevel: string | null;
    zone: string | null;
  }>;
  followUps: string[];
  actions: ComposedAction[];
  broadened?: boolean;
  broadeningReason?: string;
}

export interface ComposeInput {
  intent: string;
  domain: string;
  results: RecommendationResult[];
  geoContext?: { zoneName?: string; hubName?: string; nearestHub?: string } | null;
  confidence: number;
  userContext?: UserContext;
  citySlug?: string;
  broadened?: boolean;
  broadeningReason?: string;
}

function buildHighlight(result: RecommendationResult, domain: string): string {
  const parts: string[] = [];

  if (result.category) {
    parts.push(result.category);
  }

  if (result.zoneName) {
    parts.push(`in ${result.zoneName}`);
  }

  if (result.participationSignals.googleRating) {
    parts.push(`${result.participationSignals.googleRating}★`);
  }

  if (result.participationSignals.hasCrownStatus) {
    parts.push("Crown Member");
  }

  if (result.participationSignals.hasStory) {
    parts.push("has a local story");
  }

  if (parts.length === 0) {
    if (domain === "jobs") return "Open position";
    if (domain === "events") return "Upcoming event";
    if (domain === "marketplace") return "Available listing";
    return "Local business";
  }

  return parts.join(" · ");
}

function buildTonePrefix(template: DomainTemplate, userContext?: UserContext): string {
  if (!userContext) return "";
  return userContext.isReturning ? template.toneModifiers.returning : template.toneModifiers.newUser;
}

function selectFollowUps(template: DomainTemplate, resultCount: number, maxCount: number = 3): string[] {
  const questions = [...template.followUpQuestions];
  const selected: string[] = [];

  const count = Math.min(maxCount, questions.length);
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * questions.length);
    selected.push(questions.splice(idx, 1)[0]);
  }

  return selected;
}

function buildFallbackMessage(template: DomainTemplate, intent: string, domain: string): string {
  const fallbackIntro = pickRandom(template.emptyResultMessages);
  const clarifyingQuestions = selectFollowUps(template, 0, 2);

  const parts = [fallbackIntro];

  if (clarifyingQuestions.length > 0) {
    parts.push("\nTo help me find better results, consider:");
    for (const q of clarifyingQuestions) {
      parts.push(`  • ${q}`);
    }
  }

  parts.push("\nI can also try a broader search or look in nearby neighborhoods.");

  return parts.join("\n");
}

function buildResultMessage(
  template: DomainTemplate,
  results: RecommendationResult[],
  domain: string,
  geoContext?: { zoneName?: string; hubName?: string; nearestHub?: string } | null,
  userContext?: UserContext
): string {
  const parts: string[] = [];

  const tonePrefix = buildTonePrefix(template, userContext);
  if (tonePrefix) {
    parts.push(tonePrefix);
    parts.push("");
  }

  const intro = pickRandom(template.introPatterns);
  parts.push(intro);

  if (results.length > 0) {
    const topPick = results[0];
    const topPickIntro = pickRandom(template.topPickIntro);
    const highlight = buildHighlight(topPick, domain);
    parts.push(`\n${topPickIntro} **${topPick.name}** — ${highlight}.`);
  }

  if (geoContext?.zoneName) {
    parts.push(`\nShowing results in the ${geoContext.zoneName} area.`);
  }

  return parts.join("\n");
}

function buildActions(
  results: RecommendationResult[],
  template: DomainTemplate,
  citySlug: string
): ComposedAction[] {
  const actions: ComposedAction[] = [];

  const topResults = results.slice(0, 5);

  for (const result of topResults) {
    const routes: ResolvedActionRoute[] = [];

    const actionsToResolve = result.followOnActions.length > 0
      ? result.followOnActions
      : template.defaultActions;

    for (const action of actionsToResolve) {
      const resolved = resolveActionRoute(action, {
        id: result.id,
        slug: result.slug,
        entityType: result.entityType,
      }, citySlug);

      if (resolved.route) {
        routes.push(resolved);
      }
    }

    if (routes.length > 0) {
      actions.push({
        entityId: result.id,
        entityName: result.name,
        routes,
      });
    }
  }

  return actions;
}

function buildFallbackActions(citySlug: string): ComposedAction[] {
  return [];
}

export function composeErrorFallback(errorSummary: string): ComposedResponse {
  return {
    message: "I ran into a hiccup trying to find results for you. Let me try a different approach.",
    recommendations: [],
    followUps: [
      "Can you rephrase what you're looking for?",
      "Would you like to try a broader search?",
      "Is there a specific neighborhood you'd like me to focus on?",
    ],
    actions: [],
  };
}

export function composeNoMetroFallback(): ComposedResponse {
  return {
    message: "I need to know which area you're interested in to find the best results. Charlotte has so many great neighborhoods to explore!",
    recommendations: [],
    followUps: [
      "Which part of Charlotte are you interested in?",
      "Are you looking in a specific neighborhood?",
      "Would you like me to search across all of Charlotte?",
    ],
    actions: [],
  };
}

export function composeCharlotteResponse(input: ComposeInput): ComposedResponse {
  const { intent, domain, results, geoContext, confidence, userContext, citySlug = "charlotte", broadened, broadeningReason } = input;
  const template = getDomainTemplate(domain);

  const isLowConfidence = confidence < 0.5;
  const isEmpty = results.length === 0;

  if (isLowConfidence || isEmpty) {
    let fallbackMessage = buildFallbackMessage(template, intent, domain);
    if (broadened && broadeningReason) {
      fallbackMessage += `\n\n_${broadeningReason}_`;
    }
    return {
      message: fallbackMessage,
      recommendations: [],
      followUps: selectFollowUps(template, 0, 3),
      actions: buildFallbackActions(citySlug),
      broadened: broadened || undefined,
      broadeningReason: broadeningReason || undefined,
    };
  }

  let message = buildResultMessage(template, results, domain, geoContext, userContext);

  if (broadened && broadeningReason) {
    message += `\n\n_${broadeningReason}_`;
  }

  const recommendations = results.slice(0, 5).map((r) => ({
    id: r.id,
    name: r.name,
    highlight: buildHighlight(r, domain),
    reason: r.reason || "",
    trustLevel: r.trustLevel,
    zone: r.zoneName,
  }));

  const followUps = selectFollowUps(template, results.length, 3);
  const actions = buildActions(results, template, citySlug);

  return {
    message,
    recommendations,
    followUps,
    actions,
    broadened: broadened || undefined,
    broadeningReason: broadeningReason || undefined,
  };
}
