type CoraHat = "admin" | "cmo" | "cfo" | "cto" | "builder" | "debugger" | "operator" | "editor";
type Confidence = "low" | "medium" | "high";

interface HatResult {
  hat: CoraHat;
  confidence: Confidence;
}

const HAT_KEYWORDS: Array<{ hat: CoraHat; keywords: string[]; confidence: Confidence }> = [
  { hat: "cmo", keywords: ["marketing", "campaign", "brand", "promote", "audience", "engagement", "social media", "ads", "content", "post", "caption"], confidence: "high" },
  { hat: "editor", keywords: ["write", "article", "blog", "story", "draft", "copy", "edit", "proofread", "rewrite"], confidence: "high" },
  { hat: "cfo", keywords: ["pricing", "revenue", "budget", "cost", "financial", "payment", "stripe", "subscription", "money", "profit", "margin"], confidence: "high" },
  { hat: "cto", keywords: ["system", "structure", "architecture", "database", "schema", "api", "integration", "technical"], confidence: "high" },
  { hat: "builder", keywords: ["build", "feature", "create", "implement", "add", "develop", "launch", "ship"], confidence: "medium" },
  { hat: "debugger", keywords: ["bug", "error", "fix", "broken", "not working", "issue", "crash", "fail", "debug"], confidence: "high" },
  { hat: "operator", keywords: ["operations", "next steps", "workflow", "process", "manage", "schedule", "plan", "task", "checklist"], confidence: "medium" },
];

export function resolveHat(input: string): HatResult {
  const lower = input.toLowerCase();

  let bestMatch: HatResult = { hat: "admin", confidence: "low" };
  let maxHits = 0;

  for (const entry of HAT_KEYWORDS) {
    const hits = entry.keywords.filter((kw) => lower.includes(kw)).length;
    if (hits > maxHits) {
      maxHits = hits;
      bestMatch = { hat: entry.hat, confidence: hits >= 2 ? "high" : entry.confidence };
    }
  }

  return bestMatch;
}
