import { openai } from "../lib/openai";
import { buildResponseDoctrineSystem } from "../ai/prompts/platform-services";

interface OptionCard {
  name: string;
  whatItIs: string;
  whyItFits: string;
  bestFor: string;
}

interface DecisionBucket {
  label: string;
  options: OptionCard[];
}

interface DoctrineResponse {
  opening: string;
  buckets: DecisionBucket[];
  whatToAskFor: string;
  whatToExpect: string;
  recommendation: string;
}

const RECOMMENDATION_KEYWORDS = [
  "recommend", "suggestion", "best", "top", "find me", "help me find",
  "where can i", "who does", "looking for", "need a", "options for",
  "vendors", "agencies", "professionals", "services for",
  "rental", "venue", "caterer", "photographer", "planner",
];

export function isRecommendationRequest(input: string): boolean {
  const lower = input.toLowerCase();
  return RECOMMENDATION_KEYWORDS.some((kw) => lower.includes(kw));
}

export async function formatRecommendationResponse(input: string, context?: { metroName?: string; scope?: string }): Promise<DoctrineResponse> {
  const metroName = context?.metroName || "Charlotte";

  if (!openai) {
    return buildFallbackResponse(input, metroName);
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: buildResponseDoctrineSystem(metroName),
        },
        {
          role: "user",
          content: input,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 800,
      temperature: 0.7,
    });

    const raw = completion.choices[0]?.message?.content;
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        opening: parsed.opening || "Here are some options to consider.",
        buckets: parsed.buckets || [],
        whatToAskFor: parsed.whatToAskFor || "Ask about availability, pricing, and what's included.",
        whatToExpect: parsed.whatToExpect || "Expect to hear back within 1-2 business days.",
        recommendation: parsed.recommendation || "Reach out to a few options to compare.",
      };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[Cora ResponseDoctrine] AI error:", msg);
  }

  return buildFallbackResponse(input, metroName);
}

function buildFallbackResponse(input: string, metroName: string): DoctrineResponse {
  return {
    opening: `Here are some options for what you're looking for in ${metroName}.`,
    buckets: [
      {
        label: "Top Picks",
        options: [
          {
            name: "Check CLT Metro Hub listings",
            whatItIs: "Browse verified local businesses on the platform",
            whyItFits: "Curated directory with reviews and tier verification",
            bestFor: "Finding established, trusted local options",
          },
        ],
      },
    ],
    whatToAskFor: "Ask about pricing, availability, and any current promotions.",
    whatToExpect: "Most local businesses respond within 24 hours.",
    recommendation: "Start with the featured and verified listings on CLT Metro Hub for the most reliable options.",
  };
}
