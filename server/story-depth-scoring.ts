type ProfileResponses = Record<string, { answer: string | string[]; answeredAt: string }>;
type ExtractedSignals = Record<string, { signals: { type: string; value: string; context: string; confidence: number }[] }>;

const CORE_STORY_MODULES = ["personal_story", "origin_story", "primary_business", "neighborhood", "vision_passion"];
const COMMUNITY_DEPTH_MODULES = ["community_impact", "customer_perspective", "local_recommendations"];
const RICHNESS_MODULES = ["events_gatherings", "collaboration_network", "neighborhood_history", "local_pride", "category_recommendations", "community_connectors"];
const LEAD_CATEGORIES = ["lead_generation", "venue_tv", "job_board", "marketplace"];
const MINIMUM_STORY_MODULES = ["personal_story", "origin_story", "primary_business"];

export function computeStoryDepthScore(
  completedModules: string[],
  responses: ProfileResponses,
  extractedSignals?: ExtractedSignals | null
): number {
  const completed = new Set(completedModules);
  let score = 0;

  const coreCovered = CORE_STORY_MODULES.filter((m) => completed.has(m)).length;
  score += Math.round((coreCovered / CORE_STORY_MODULES.length) * 50);

  const communityDepth = COMMUNITY_DEPTH_MODULES.filter((m) => completed.has(m)).length;
  score += Math.round((communityDepth / COMMUNITY_DEPTH_MODULES.length) * 20);

  const richnessModules = RICHNESS_MODULES.filter((m) => completed.has(m)).length;
  score += Math.min(20, Math.round((richnessModules / RICHNESS_MODULES.length) * 20));

  if (extractedSignals) {
    const leadSignalCount = LEAD_CATEGORIES.reduce((sum, cat) => {
      return sum + (extractedSignals[cat]?.signals?.length || 0);
    }, 0);
    score += Math.min(10, leadSignalCount * 2);
  }

  const responseCount = Object.keys(responses).length;
  if (responseCount >= 8) score = Math.max(score, 40);
  if (responseCount >= 12) score = Math.max(score, 55);

  return Math.min(100, score);
}

export function getConversationCompleteness(
  completedModules: string[],
  responses: ProfileResponses,
  extractedSignals?: ExtractedSignals | null
): { ready: boolean; suggestion: string; score: number } {
  const completed = new Set(completedModules);
  const score = computeStoryDepthScore(completedModules, responses, extractedSignals);

  const missingMinimum = MINIMUM_STORY_MODULES.filter((m) => !completed.has(m));
  if (missingMinimum.length > 0) {
    const moduleNames: Record<string, string> = {
      personal_story: "their personal story",
      origin_story: "how they got started",
      primary_business: "what they do",
    };
    const missing = missingMinimum.map((m) => moduleNames[m] || m).join(", ");
    return {
      ready: false,
      suggestion: `Still need to learn about ${missing} before generating the spotlight.`,
      score,
    };
  }

  if (score < 60) {
    const missingCore = CORE_STORY_MODULES.filter((m) => !completed.has(m));
    if (missingCore.length > 0) {
      return {
        ready: false,
        suggestion: `Story could be richer. Try exploring their neighborhood connection or future vision.`,
        score,
      };
    }

    const missingCommunity = COMMUNITY_DEPTH_MODULES.filter((m) => !completed.has(m));
    if (missingCommunity.length > 0) {
      return {
        ready: false,
        suggestion: `Good foundation. Try asking about community impact or local recommendations to deepen the story.`,
        score,
      };
    }

    return {
      ready: false,
      suggestion: `Almost there. A few more topics would make this spotlight really shine.`,
      score,
    };
  }

  return {
    ready: true,
    suggestion: score >= 80
      ? "Excellent depth. Ready for a rich spotlight article."
      : "Good depth. Ready to generate the spotlight article.",
    score,
  };
}

export function getTopicProgressLabels(completedModules: string[]): { id: string; label: string; completed: boolean }[] {
  const topicGroups = [
    { id: "your_story", label: "Your Story", modules: ["personal_story", "origin_story"] },
    { id: "your_business", label: "Your Business", modules: ["primary_business", "customer_perspective"] },
    { id: "the_neighborhood", label: "The Neighborhood", modules: ["neighborhood", "neighborhood_history", "local_recommendations"] },
    { id: "community", label: "Community", modules: ["community_impact", "community_connectors", "events_gatherings"] },
    { id: "whats_next", label: "What's Next", modules: ["vision_passion", "micro_business", "collaboration_network"] },
  ];

  const completed = new Set(completedModules);
  return topicGroups.map((g) => ({
    id: g.id,
    label: g.label,
    completed: g.modules.some((m) => completed.has(m)),
  }));
}
