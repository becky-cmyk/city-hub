import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";

export interface AeoScoreInput {
  title?: string;
  metaDescription?: string;
  content?: string;
  slug?: string;
}

interface AeoCheck {
  label: string;
  status: "green" | "yellow" | "red";
  tip: string;
}

export function evaluateAeoChecks(input: AeoScoreInput): AeoCheck[] {
  const checks: AeoCheck[] = [];
  const content = input.content || "";
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 0);
  const firstPara = paragraphs[0] || "";
  const firstParaWords = firstPara.split(/\s+/).filter(Boolean).length;

  checks.push({
    label: `Direct-answer lead (${firstParaWords} words)`,
    status: firstParaWords >= 15 && firstParaWords <= 60 ? "green" : firstParaWords >= 10 && firstParaWords <= 80 ? "yellow" : "red",
    tip: "First paragraph should directly answer the topic in 15-60 words",
  });

  const faqPattern = /(\?)\s*\n|^#{1,3}\s+.*\?|(\bwhat\b|\bhow\b|\bwhy\b|\bwhen\b|\bwhere\b|\bwho\b|\bcan\b|\bdo\b|\bdoes\b|\bis\b|\bare\b).*\?/gim;
  const faqMatches = content.match(faqPattern) || [];
  checks.push({
    label: `FAQ/Q&A presence (${faqMatches.length} questions)`,
    status: faqMatches.length >= 2 ? "green" : faqMatches.length >= 1 ? "yellow" : "red",
    tip: "Include 2+ FAQ-style questions with answers",
  });

  const entityPatterns = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g;
  const entities = content.match(entityPatterns) || [];
  const uniqueEntities = new Set(entities).size;
  checks.push({
    label: `Entity/topic clarity (${uniqueEntities} named entities)`,
    status: uniqueEntities >= 3 ? "green" : uniqueEntities >= 1 ? "yellow" : "red",
    tip: "Reference 3+ named entities (people, places, organizations)",
  });

  const avgParaLen = paragraphs.length > 0
    ? Math.round(paragraphs.reduce((sum, p) => sum + p.split(/\s+/).length, 0) / paragraphs.length)
    : 0;
  checks.push({
    label: `Snippet-friendly paragraphs (avg ${avgParaLen} words)`,
    status: avgParaLen >= 20 && avgParaLen <= 60 ? "green" : avgParaLen >= 10 && avgParaLen <= 80 ? "yellow" : "red",
    tip: "Paragraphs should be 20-60 words for snippet extraction",
  });

  const hasLists = /^[\-\*]\s|^\d+\.\s|<[ou]l>/m.test(content);
  checks.push({
    label: "Structured list content",
    status: hasLists ? "green" : "yellow",
    tip: "Include bullet points or numbered lists where appropriate",
  });

  const citationPatterns = /according to|reported by|as (?:reported|noted|stated) by|data from|source:|via\s/gi;
  const citations = content.match(citationPatterns) || [];
  checks.push({
    label: `Attribution/citations (${citations.length} found)`,
    status: citations.length >= 2 ? "green" : citations.length >= 1 ? "yellow" : "red",
    tip: "Include 2+ source attributions for credibility",
  });

  const sourcePatterns = /(?:according to|reported by|as reported by|data from)\s+[A-Z][^\.,]+/g;
  const sourceRefs = content.match(sourcePatterns) || [];
  const uniqueSources = new Set(sourceRefs.map(s => s.toLowerCase())).size;
  checks.push({
    label: `Multi-source references (${uniqueSources} sources)`,
    status: uniqueSources >= 2 ? "green" : uniqueSources >= 1 ? "yellow" : "red",
    tip: "Reference 2+ distinct sources for authority",
  });

  const questionWords = /\b(what|how|why|when|where|who|can|does|is|are|should|will)\b.*\?/gi;
  const naturalQs = content.match(questionWords) || [];
  checks.push({
    label: `Natural question coverage (${naturalQs.length})`,
    status: naturalQs.length >= 2 ? "green" : naturalQs.length >= 1 ? "yellow" : "red",
    tip: "Include natural language questions that users might ask",
  });

  const descLen = (input.metaDescription || "").length;
  checks.push({
    label: `Concise summary length (${descLen} chars)`,
    status: descLen >= 50 && descLen <= 160 ? "green" : descLen >= 30 && descLen <= 200 ? "yellow" : "red",
    tip: "Meta description should be a concise 50-160 char summary",
  });

  const hasSchema = /schema\.org|@type|itemtype|application\/ld\+json|itemprop/i.test(content);
  const hasSemanticMarkup = /^#{1,3}\s/m.test(content) && hasLists;
  checks.push({
    label: "Structured data readiness",
    status: hasSchema ? "green" : hasSemanticMarkup ? "yellow" : "red",
    tip: "Use semantic headings, lists, and schema markup for AI extraction",
  });

  return checks;
}

export function AeoScoreCard({ input }: { input: AeoScoreInput }) {
  const checks = evaluateAeoChecks(input);
  const greens = checks.filter((c) => c.status === "green").length;
  const reds = checks.filter((c) => c.status === "red").length;

  const overall = reds === 0 && greens === checks.length ? "green" : reds === 0 ? "yellow" : "red";
  const overallColor = overall === "green" ? "bg-green-500" : overall === "yellow" ? "bg-yellow-500" : "bg-red-500";
  const overallLabel = overall === "green" ? "Good" : overall === "yellow" ? "Needs Work" : "Poor";

  return (
    <Card className="p-4 space-y-3" data-testid="aeo-score-card">
      <div className="flex items-center gap-3">
        <div className={`w-4 h-4 rounded-full shrink-0 ${overallColor}`} data-testid="aeo-score-indicator" />
        <span className="font-medium text-sm" data-testid="aeo-score-summary">
          AEO: {greens}/{checks.length} passed
        </span>
        <Badge variant="secondary" className="ml-auto" data-testid="aeo-score-label">
          {overallLabel}
        </Badge>
      </div>
      <div className="space-y-1.5">
        {checks.map((c, i) => {
          const Icon = c.status === "green" ? CheckCircle : c.status === "yellow" ? AlertTriangle : XCircle;
          const iconColor = c.status === "green" ? "text-green-500" : c.status === "yellow" ? "text-yellow-500" : "text-red-500";
          return (
            <div key={i} className="flex items-center gap-2 text-xs" data-testid={`aeo-check-item-${i}`}>
              <Icon className={`h-3.5 w-3.5 shrink-0 ${iconColor}`} />
              <span className={c.status === "green" ? "text-foreground" : "text-muted-foreground"}>{c.label}</span>
              <span className="text-muted-foreground/60 ml-auto hidden sm:inline">{c.tip}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
