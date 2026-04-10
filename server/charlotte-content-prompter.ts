import { CORE_TONE_RULES } from "./services/charlotte/charlotte-response-doctrine";
import type { EngagementTrigger } from "./charlotte-engagement-triggers";

export interface ContentPromptInput {
  entity: {
    id: string;
    name: string;
    listingTier?: string;
    listingType?: string;
    categoryHint?: string;
    neighborhood?: string;
  };
  trigger: EngagementTrigger;
  context?: {
    cityName?: string;
    seasonHint?: string;
    recentActivity?: string;
    metroId?: string;
  };
}

export interface ContentPrompt {
  prompt: string;
  suggestedAction: string;
  tone: string;
  contentType: "pulse_post" | "story_update" | "event_promo" | "social_share" | "general_update";
  generatorHint?: {
    generatorType: "content" | "social" | "story" | "roundup";
    canAutoGenerate: boolean;
  };
}

const INACTIVITY_PROMPTS: string[] = [
  "It's been a while — your neighbors might be wondering what's new. A quick update goes a long way.",
  "People in your area are actively looking for local businesses. A fresh post keeps you in the mix.",
  "Your listing is live, but a recent update helps people find you. What's been happening lately?",
  "A lot has been happening in the hub since you last posted. Let's get you back in the conversation.",
  "Your community presence is strongest when it's current. Even a small update makes a difference.",
];

const NEW_CAPABILITY_PROMPTS: Record<string, string[]> = {
  verified: [
    "You're verified — that's a great start. Now let's tell your story so people know who you really are.",
    "Verification is done. The next step is your story — it's what sets you apart from a generic listing.",
    "Now that you're verified, you're ready for a community spotlight. Let's create your story.",
  ],
  story_approved: [
    "Your story is live — now let's get it in front of more people. A Pulse post is the fastest way.",
    "Great story on file. Time to expand — consider posting to Pulse or sharing an upcoming event.",
    "Your story is ready for the community. Let's build on it with regular content.",
  ],
  category_unlocked: [
    "A new category is now active in your hub area — this could bring more visibility to your listing.",
    "The hub just expanded — your business type now has a dedicated section for better discovery.",
  ],
  tv_venue_eligible: [
    "Your space qualifies for venue screen content — local stories and community highlights playing in your business.",
    "Venue screens are now available for businesses like yours — bring the community hub into your physical space.",
  ],
  jobs_marketplace_ready: [
    "You're set up for jobs and marketplace — post open positions or list products to reach local customers.",
    "Your listing is ready for the full suite — jobs board and marketplace are now available to you.",
  ],
};

const OPPORTUNITY_PROMPTS: Record<string, string[]> = {
  initiate_outreach: [
    "Your business has strong signals — let's get you properly set up in the hub.",
    "We've noticed your business is well-positioned for community engagement. Let's connect.",
  ],
  suggest_verification: [
    "You're close to being fully active. Completing verification unlocks your full presence.",
    "One quick step to unlock your community presence — verification takes just a minute.",
  ],
  suggest_crown_participation: [
    "Your trust level puts you in an elite group. Crown membership would amplify what you've already built.",
    "You've earned a strong community reputation. Crown participation is the natural next step.",
  ],
  suggest_tv_venue: [
    "Your business is a natural fit for venue screens — community content displayed right in your space.",
    "Venue screen placement could drive engagement for both your business and the local community.",
  ],
  suggest_job_posting: [
    "Looking to hire? The community jobs board connects you with local talent who already know the area.",
    "Post your open positions on the hub — local candidates are already here.",
  ],
  suggest_marketplace_listing: [
    "The community marketplace is a great way to feature your products or services locally.",
    "List your offerings in the marketplace — neighbors are looking for exactly what you provide.",
  ],
};

const SEASONAL_PROMPTS: string[] = [
  "The season is changing — a great time to share what's new or coming up at your business.",
  "Local buzz picks up this time of year. A timely post connects you with people already looking.",
  "This is a high-engagement moment for the community. Share something seasonal to stay visible.",
];

function selectPrompt(prompts: string[]): string {
  return prompts[Math.floor(Math.random() * prompts.length)];
}

function determineContentType(trigger: EngagementTrigger): ContentPrompt["contentType"] {
  switch (trigger.triggerType) {
    case "inactivity":
      return "general_update";
    case "new_capability":
      if (trigger.metadata?.capability === "verified") return "story_update";
      if (trigger.metadata?.capability === "story_approved") return "pulse_post";
      return "general_update";
    case "opportunity_detected":
      return "general_update";
    case "seasonal_moment":
      return "social_share";
    default:
      return "general_update";
  }
}

function resolveGeneratorHint(trigger: EngagementTrigger, contentType: ContentPrompt["contentType"]): ContentPrompt["generatorHint"] {
  if (trigger.metadata?.capability === "verified") {
    return { generatorType: "story", canAutoGenerate: true };
  }
  if (trigger.metadata?.capability === "story_approved" || contentType === "pulse_post") {
    return { generatorType: "social", canAutoGenerate: true };
  }
  if (contentType === "social_share") {
    return { generatorType: "social", canAutoGenerate: true };
  }
  if (trigger.triggerType === "inactivity") {
    return { generatorType: "content", canAutoGenerate: true };
  }
  return { generatorType: "content", canAutoGenerate: false };
}

function buildPromptText(input: ContentPromptInput): string {
  const { entity, trigger, context } = input;
  let basePrompt: string;

  switch (trigger.triggerType) {
    case "inactivity":
      basePrompt = selectPrompt(INACTIVITY_PROMPTS);
      break;
    case "new_capability": {
      const capabilityKey = (trigger.metadata?.capability as string) || "verified";
      const capPrompts = NEW_CAPABILITY_PROMPTS[capabilityKey] || INACTIVITY_PROMPTS;
      basePrompt = selectPrompt(capPrompts);
      break;
    }
    case "opportunity_detected": {
      const actionKey = trigger.recommendedNextAction;
      const oppPrompts = OPPORTUNITY_PROMPTS[actionKey] || OPPORTUNITY_PROMPTS["initiate_outreach"];
      basePrompt = selectPrompt(oppPrompts);
      break;
    }
    case "seasonal_moment": {
      const seasonalPrompt = (trigger.metadata?.seasonalPrompt as string) || selectPrompt(SEASONAL_PROMPTS);
      basePrompt = seasonalPrompt;
      break;
    }
    default:
      basePrompt = selectPrompt(INACTIVITY_PROMPTS);
  }

  if (entity.neighborhood) {
    basePrompt += ` People in ${entity.neighborhood} are discovering new local spots every day.`;
  }

  return basePrompt;
}

function buildSuggestedAction(trigger: EngagementTrigger): string {
  const actionMap: Record<string, string> = {
    send_reengagement_prompt: "Share a quick update about what's new at your business",
    suggest_story_creation: "Let's create your business story — it only takes a few minutes",
    suggest_content_participation: "Post to Pulse to share your latest news with the community",
    suggest_category_content: "Your category is now active — share content to boost your visibility in this new section",
    suggest_event_promotion: "Promote your upcoming event to the community and drive attendance",
    initiate_outreach: "Claim and verify your listing to unlock your community presence",
    suggest_verification: "Complete verification to activate your full hub presence",
    suggest_crown_participation: "Explore Crown membership to amplify your community impact",
    suggest_tv_venue: "Add venue screens to display community content in your space",
    suggest_job_posting: "Post open positions on the community jobs board",
    suggest_marketplace_listing: "List your products or services in the community marketplace",
    suggest_new_year_update: "Share your goals for the new year with the community",
    suggest_spring_content: "Post about your spring offerings or seasonal specials",
    suggest_summer_content: "Share what's happening at your business this summer",
    suggest_back_to_school: "Connect with families heading back to school in your area",
    suggest_holiday_content: "Share your holiday specials, events, or gift ideas",
  };

  return actionMap[trigger.recommendedNextAction] || "Share an update with your community";
}

export function generateContentPrompt(input: ContentPromptInput): ContentPrompt {
  const promptText = buildPromptText(input);
  const suggestedAction = buildSuggestedAction(input.trigger);
  const contentType = determineContentType(input.trigger);
  const generatorHint = resolveGeneratorHint(input.trigger, contentType);

  return {
    prompt: promptText,
    suggestedAction,
    tone: CORE_TONE_RULES.overall,
    contentType,
    generatorHint,
  };
}

export async function generateContentViaExistingPipeline(
  input: ContentPromptInput
): Promise<ContentPrompt & { generatedDraft?: string }> {
  const basePrompt = generateContentPrompt(input);

  if (!basePrompt.generatorHint?.canAutoGenerate) {
    return basePrompt;
  }

  try {
    const { generatorType } = basePrompt.generatorHint;

    if (generatorType === "story" && input.context?.metroId) {
      const { generateFromContent } = await import("./intelligence/social-content-generator");
      const result = await generateFromContent(
        input.context.metroId,
        "business",
        input.entity.id
      );
      if (result) {
        return { ...basePrompt, generatedDraft: `Story-based content draft generated for ${input.entity.name}` };
      }
    }

    if (generatorType === "social" && input.context?.metroId) {
      const { generateFromContent } = await import("./intelligence/social-content-generator");
      const result = await generateFromContent(
        input.context.metroId,
        "business",
        input.entity.id
      );
      if (result) {
        return { ...basePrompt, generatedDraft: `Social post draft created for ${input.entity.name}` };
      }
    }

    if (generatorType === "content" && input.context?.metroId) {
      const { runContentGenerator } = await import("./intelligence/content-generator");
      const count = await runContentGenerator();
      if (count > 0) {
        return { ...basePrompt, generatedDraft: `Content roundup draft created` };
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[ContentPrompter] Generator pipeline error (non-blocking):", msg);
  }

  return basePrompt;
}

export function generateBatchContentPrompts(
  entities: ContentPromptInput["entity"][],
  trigger: EngagementTrigger,
  context?: ContentPromptInput["context"]
): ContentPrompt[] {
  return entities.map(entity =>
    generateContentPrompt({
      entity,
      trigger: { ...trigger, entityId: entity.id, entityName: entity.name },
      context,
    })
  );
}
