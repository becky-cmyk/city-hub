interface ScoreResult {
  total: number;
  passed: number;
  checks: { label: string; status: "green" | "yellow" | "red" }[];
}

export function evaluateSeoChecksServer(input: {
  title?: string;
  metaDescription?: string;
  content?: string;
  slug?: string;
  cityKeyword?: string;
  categoryKeyword?: string;
  imageAltText?: string;
}): ScoreResult {
  const checks: { label: string; status: "green" | "yellow" | "red" }[] = [];

  const titleLen = (input.title || "").length;
  checks.push({
    label: `Title length (${titleLen})`,
    status: titleLen >= 50 && titleLen <= 60 ? "green" : titleLen >= 40 && titleLen <= 70 ? "yellow" : "red",
  });

  const descLen = (input.metaDescription || "").length;
  checks.push({
    label: `Meta description (${descLen})`,
    status: descLen >= 120 && descLen <= 160 ? "green" : descLen >= 80 && descLen <= 200 ? "yellow" : "red",
  });

  const titleLower = (input.title || "").toLowerCase();
  const cityLower = (input.cityKeyword || "").toLowerCase().trim();
  checks.push({
    label: "City keyword in title",
    status: cityLower && titleLower.includes(cityLower) ? "green" : !cityLower ? "yellow" : "red",
  });

  const contentLower = (input.content || "").toLowerCase();
  const catLower = (input.categoryKeyword || "").toLowerCase().trim();
  checks.push({
    label: "Category keyword in content",
    status: catLower && contentLower.includes(catLower) ? "green" : !catLower ? "yellow" : "red",
  });

  const wordCount = input.content ? input.content.split(/\s+/).filter(Boolean).length : 0;
  checks.push({
    label: `Content length (${wordCount} words)`,
    status: wordCount >= 300 ? "green" : wordCount >= 100 ? "yellow" : "red",
  });

  const hasH2 = /#{2}\s|<h2[\s>]/i.test(input.content || "");
  checks.push({
    label: "Has H2 subheading",
    status: hasH2 ? "green" : "yellow",
  });

  const slug = input.slug || "";
  const slugClean = slug.length > 0 && !/[A-Z]/.test(slug) && !/#/.test(slug) && !/[a-f0-9]{6,8}$/.test(slug);
  checks.push({
    label: "Slug is clean",
    status: slug.length === 0 ? "red" : slugClean ? "green" : "yellow",
  });

  const hasAlt = (input.imageAltText || "").trim().length > 0;
  checks.push({
    label: "Image alt text",
    status: hasAlt ? "green" : "yellow",
  });

  const passed = checks.filter(c => c.status === "green").length;
  return { total: checks.length, passed, checks };
}

export function evaluateAeoChecksServer(input: {
  title?: string;
  content?: string;
  metaDescription?: string;
}): ScoreResult {
  const checks: { label: string; status: "green" | "yellow" | "red" }[] = [];
  const content = input.content || "";
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 0);
  const firstPara = paragraphs[0] || "";
  const firstParaWords = firstPara.split(/\s+/).filter(Boolean).length;

  checks.push({
    label: `Direct-answer lead (${firstParaWords} words)`,
    status: firstParaWords >= 15 && firstParaWords <= 60 ? "green" : firstParaWords >= 10 && firstParaWords <= 80 ? "yellow" : "red",
  });

  const faqPattern = /(\?)\s*\n|^#{1,3}\s+.*\?|(\bwhat\b|\bhow\b|\bwhy\b|\bwhen\b|\bwhere\b|\bwho\b|\bcan\b|\bdo\b|\bdoes\b|\bis\b|\bare\b).*\?/gim;
  const faqMatches = content.match(faqPattern) || [];
  checks.push({
    label: `FAQ/Q&A presence (${faqMatches.length})`,
    status: faqMatches.length >= 2 ? "green" : faqMatches.length >= 1 ? "yellow" : "red",
  });

  const entityPatterns = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g;
  const entities = content.match(entityPatterns) || [];
  const uniqueEntities = new Set(entities).size;
  checks.push({
    label: `Entity clarity (${uniqueEntities})`,
    status: uniqueEntities >= 3 ? "green" : uniqueEntities >= 1 ? "yellow" : "red",
  });

  const avgParaLen = paragraphs.length > 0
    ? Math.round(paragraphs.reduce((sum, p) => sum + p.split(/\s+/).length, 0) / paragraphs.length)
    : 0;
  checks.push({
    label: `Snippet paragraphs (avg ${avgParaLen} words)`,
    status: avgParaLen >= 20 && avgParaLen <= 60 ? "green" : avgParaLen >= 10 && avgParaLen <= 80 ? "yellow" : "red",
  });

  const hasLists = /^[\-\*]\s|^\d+\.\s|<[ou]l>/m.test(content);
  checks.push({
    label: "Structured list content",
    status: hasLists ? "green" : "yellow",
  });

  const citationPatterns = /according to|reported by|as (?:reported|noted|stated) by|data from|source:|via\s/gi;
  const citations = content.match(citationPatterns) || [];
  checks.push({
    label: `Citations (${citations.length})`,
    status: citations.length >= 2 ? "green" : citations.length >= 1 ? "yellow" : "red",
  });

  const sourcePatterns = /(?:according to|reported by|as reported by|data from)\s+[A-Z][^\.,]+/g;
  const sourceRefs = content.match(sourcePatterns) || [];
  const uniqueSources = new Set(sourceRefs.map(s => s.toLowerCase())).size;
  checks.push({
    label: `Multi-source refs (${uniqueSources})`,
    status: uniqueSources >= 2 ? "green" : uniqueSources >= 1 ? "yellow" : "red",
  });

  const questionWords = /\b(what|how|why|when|where|who|can|does|is|are|should|will)\b.*\?/gi;
  const naturalQs = content.match(questionWords) || [];
  checks.push({
    label: `Natural questions (${naturalQs.length})`,
    status: naturalQs.length >= 2 ? "green" : naturalQs.length >= 1 ? "yellow" : "red",
  });

  const descLen = (input.metaDescription || "").length;
  checks.push({
    label: `Concise summary (${descLen} chars)`,
    status: descLen >= 50 && descLen <= 160 ? "green" : descLen >= 30 && descLen <= 200 ? "yellow" : "red",
  });

  const hasSchema = /schema\.org|@type|itemtype|application\/ld\+json|itemprop/i.test(content);
  const hasSemanticMarkup = /^#{1,3}\s/m.test(content) && hasLists;
  checks.push({
    label: "Structured data readiness",
    status: hasSchema ? "green" : hasSemanticMarkup ? "yellow" : "red",
  });

  const passed = checks.filter(c => c.status === "green").length;
  return { total: checks.length, passed, checks };
}

export const QUALITY_GATE_THRESHOLDS = {
  seoMinPassed: parseInt(process.env.QUALITY_GATE_SEO_MIN || "5", 10),
  seoTotal: 8,
  aeoMinPassed: parseInt(process.env.QUALITY_GATE_AEO_MIN || "5", 10),
  aeoTotal: 10,
};

export function passesQualityGate(seoScore: ScoreResult, aeoScore: ScoreResult): boolean {
  return seoScore.passed >= QUALITY_GATE_THRESHOLDS.seoMinPassed
    && aeoScore.passed >= QUALITY_GATE_THRESHOLDS.aeoMinPassed;
}
