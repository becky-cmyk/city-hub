import { openai } from "../lib/openai";
import type { MicrositeBlock, MicrositeBlockContent, MicrositeBlockType, BilingualText } from "@shared/schema";
import type { MicrositeCrawlResult } from "./crawl/micrositeCrawler";
import { MICROSITE_GENERATION_SYSTEM } from "../ai/prompts/platform-services";

function bt(en: string, es: string = ""): BilingualText {
  return { en, es };
}

const SYSTEM_PROMPT = MICROSITE_GENERATION_SYSTEM;

function buildCrawlSummary(crawlData: MicrositeCrawlResult): string {
  const parts: string[] = [];

  if (crawlData.businessName) parts.push(`Business Name: ${crawlData.businessName}`);
  if (crawlData.metaDescription) parts.push(`Meta Description: ${crawlData.metaDescription}`);
  if (crawlData.heroHeadline) parts.push(`Hero Headline: ${crawlData.heroHeadline}`);
  if (crawlData.heroSubheadline) parts.push(`Hero Subheadline: ${crawlData.heroSubheadline}`);

  if (crawlData.aboutText) parts.push(`About Text:\n${crawlData.aboutText}`);

  if (crawlData.mainTextBlocks.length > 0) {
    parts.push(`Main Content Blocks:\n${crawlData.mainTextBlocks.slice(0, 10).join("\n---\n")}`);
  }

  if (crawlData.serviceNames.length > 0) {
    parts.push(`Services Found: ${crawlData.serviceNames.join(", ")}`);
  }

  if (crawlData.faqPairs.length > 0) {
    const faqText = crawlData.faqPairs.map(f => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n");
    parts.push(`FAQ Pairs:\n${faqText}`);
  }

  if (crawlData.testimonials.length > 0) {
    const testText = crawlData.testimonials.map(t =>
      `"${t.text}"${t.author ? ` — ${t.author}` : ""}`
    ).join("\n");
    parts.push(`Testimonials:\n${testText}`);
  }

  if (crawlData.teamMembers.length > 0) {
    const teamText = crawlData.teamMembers.map(m =>
      `${m.name}${m.title ? ` (${m.title})` : ""}`
    ).join(", ");
    parts.push(`Team Members: ${teamText}`);
  }

  if (crawlData.ctaLabels.length > 0) {
    const ctaText = crawlData.ctaLabels.map(c =>
      `${c.text}${c.url ? ` → ${c.url}` : ""}`
    ).join(", ");
    parts.push(`CTA Actions: ${ctaText}`);
  }

  if (crawlData.phone) parts.push(`Phone: ${crawlData.phone}`);
  if (crawlData.email) parts.push(`Email: ${crawlData.email}`);
  if (crawlData.address) parts.push(`Address: ${crawlData.address}`);
  if (crawlData.bookingUrl) parts.push(`Booking URL: ${crawlData.bookingUrl}`);

  if (crawlData.hours) {
    parts.push(`Hours: ${JSON.stringify(crawlData.hours)}`);
  }

  if (Object.keys(crawlData.socialLinks).length > 0) {
    parts.push(`Social Links: ${JSON.stringify(crawlData.socialLinks)}`);
  }

  if (crawlData.imageUrls.length > 0) {
    parts.push(`Images Found: ${crawlData.imageUrls.slice(0, 5).join(", ")}`);
  }

  if (crawlData.headings.length > 0) {
    parts.push(`Page Headings: ${crawlData.headings.slice(0, 10).join(" | ")}`);
  }

  return parts.join("\n\n");
}

function buildFallbackBlocks(crawlData: MicrositeCrawlResult): MicrositeBlock[] {
  const blocks: MicrositeBlock[] = [];

  blocks.push({
    id: "hero-1",
    type: "hero",
    enabled: true,
    sortOrder: 0,
    content: {
      headline: bt(crawlData.heroHeadline || crawlData.businessName || "Welcome"),
      subheadline: bt(crawlData.metaDescription || ""),
      ctaText: bt(crawlData.ctaLabels[0]?.text || "Contact Us"),
      ctaLink: crawlData.ctaLabels[0]?.url || crawlData.bookingUrl || "#contact",
      image: crawlData.imageUrls[0] || undefined,
    },
  });

  blocks.push({
    id: "about-1",
    type: "about",
    enabled: !!crawlData.aboutText,
    sortOrder: 1,
    content: {
      headline: bt("About Us"),
      body: bt(crawlData.aboutText || ""),
    },
  });

  blocks.push({
    id: "services-1",
    type: "services",
    enabled: crawlData.serviceNames.length > 0,
    sortOrder: 2,
    content: {
      headline: bt("Our Services"),
      items: crawlData.serviceNames.map(s => ({ name: s })),
    },
  });

  blocks.push({
    id: "testimonials-1",
    type: "testimonials",
    enabled: crawlData.testimonials.length > 0,
    sortOrder: 3,
    content: {
      headline: bt("What People Say"),
      items: crawlData.testimonials.map(t => ({ text: t.text, author: t.author || "" })),
    },
  });

  blocks.push({
    id: "faq-1",
    type: "faq",
    enabled: crawlData.faqPairs.length > 0,
    sortOrder: 4,
    content: {
      headline: bt("Frequently Asked Questions"),
      items: crawlData.faqPairs.map(f => ({ question: f.question, answer: f.answer })),
    },
  });

  blocks.push({
    id: "team-1",
    type: "team",
    enabled: crawlData.teamMembers.length > 0,
    sortOrder: 5,
    content: {
      headline: bt("Meet Our Team"),
      items: crawlData.teamMembers.map(m => ({ name: m.name, title: m.title || "" })),
    },
  });

  blocks.push({
    id: "hours-1",
    type: "hours",
    enabled: !!crawlData.hours,
    sortOrder: 6,
    content: {
      headline: bt("Hours & Location"),
    },
  });

  blocks.push({
    id: "contact-1",
    type: "contact",
    enabled: true,
    sortOrder: 7,
    content: {
      headline: bt("Contact Us"),
    },
  });

  blocks.push({
    id: "cta-1",
    type: "cta",
    enabled: true,
    sortOrder: 8,
    content: {
      headline: bt("Ready to Get Started?"),
      ctaText: bt(crawlData.ctaLabels[0]?.text || "Contact Us"),
      ctaLink: crawlData.ctaLabels[0]?.url || crawlData.bookingUrl || "#contact",
    },
  });

  return blocks;
}

export interface MicrositeGenerationResult {
  blocks: MicrositeBlock[];
  aiNotes: string;
  usedFallback: boolean;
}

export async function generateMicrositeFromCrawl(
  crawlData: MicrositeCrawlResult,
  businessName?: string
): Promise<MicrositeGenerationResult> {
  const summary = buildCrawlSummary(crawlData);

  if (!openai) {
    console.warn("[MicrositeGen] OpenAI not available, using fallback block generation");
    return {
      blocks: buildFallbackBlocks(crawlData),
      aiNotes: "Generated using fallback (no AI). Blocks mapped directly from crawl data.",
      usedFallback: true,
    };
  }

  try {
    const userPrompt = `Generate Hub microsite blocks for this business:\n\n${summary}\n\nBusiness display name: ${businessName || crawlData.businessName || "Unknown Business"}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      console.error("[MicrositeGen] Empty AI response, using fallback");
      return {
        blocks: buildFallbackBlocks(crawlData),
        aiNotes: "AI returned empty response. Used fallback generation.",
        usedFallback: true,
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error("[MicrositeGen] Failed to parse AI JSON, using fallback");
      return {
        blocks: buildFallbackBlocks(crawlData),
        aiNotes: "AI returned invalid JSON. Used fallback generation.",
        usedFallback: true,
      };
    }

    let rawBlocks: unknown[];
    if (parsed && typeof parsed === "object" && "blocks" in parsed && Array.isArray((parsed as Record<string, unknown>).blocks)) {
      rawBlocks = (parsed as Record<string, unknown>).blocks as unknown[];
    } else if (Array.isArray(parsed)) {
      rawBlocks = parsed;
    } else {
      console.error("[MicrositeGen] AI returned unexpected structure, using fallback");
      return {
        blocks: buildFallbackBlocks(crawlData),
        aiNotes: "AI returned unexpected structure. Used fallback generation.",
        usedFallback: true,
      };
    }

    const validTypes = new Set(["hero","about","services","gallery","testimonials","cta","faq","team","hours","contact","reviews"]);
    const blocks: MicrositeBlock[] = rawBlocks
      .filter((b): b is Record<string, unknown> => !!b && typeof b === "object" && typeof (b as Record<string,unknown>).type === "string" && validTypes.has((b as Record<string,unknown>).type as string))
      .map((block, idx) => ({
        id: (typeof block.id === "string" ? block.id : `${block.type}-${idx}`) as string,
        type: block.type as MicrositeBlockType,
        enabled: block.enabled !== false,
        sortOrder: typeof block.sortOrder === "number" ? block.sortOrder : idx,
        content: (block.content && typeof block.content === "object" ? block.content : {}) as MicrositeBlockContent,
      }));

    if (blocks.length === 0) {
      console.error("[MicrositeGen] AI returned zero valid blocks, using fallback");
      return {
        blocks: buildFallbackBlocks(crawlData),
        aiNotes: "AI returned no valid blocks. Used fallback generation.",
        usedFallback: true,
      };
    }

    const enabledCount = blocks.filter(b => b.enabled).length;
    const notes = `Charlotte AI generated ${blocks.length} blocks (${enabledCount} enabled) from ${crawlData.pagesCrawled} crawled pages.`;

    return {
      blocks,
      aiNotes: notes,
      usedFallback: false,
    };
  } catch (err) {
    console.error("[MicrositeGen] AI generation failed:", (err as Error).message);
    return {
      blocks: buildFallbackBlocks(crawlData),
      aiNotes: `AI generation failed: ${(err as Error).message}. Used fallback.`,
      usedFallback: true,
    };
  }
}
