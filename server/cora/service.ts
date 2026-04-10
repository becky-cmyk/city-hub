import { resolveHat } from "./hats";
import { suggestSources, generateFromApprovedSources } from "./contentBridge";
import { createPlan } from "./planService";
import { createOutreachDraft, createVoiceScriptDraft } from "./outreachService";
import { createUiProposal } from "./uiProposalService";
import { isRecommendationRequest, formatRecommendationResponse } from "./responseDoctrine";
import { db } from "../db";
import { coraQuestions, coraSuggestions, coraKnowledge, cities, metroLaunchChecklist, metroProjects } from "@shared/schema";
import { eq } from "drizzle-orm";
import { openai } from "../lib/openai";
import { CORA_PLAN_GENERATION_SYSTEM } from "../ai/prompts/platform-services";
import { createMetroFromTemplate, getMetroChecklist } from "../metro/metroCloneService";

interface ContentSource {
  type: string;
  id: string;
  name: string;
  excerpt?: string;
  imageUrl?: string | null;
  reason?: string;
}

interface CoraRequest {
  input: string;
  scope?: "platform" | "metro";
  metroId?: string;
  approvedSources?: ContentSource[];
  conversation_mode?: "text" | "voice_prep";
}

interface CoraResponse {
  hat: { hat: string; confidence: string; submode?: string };
  message: string;
  responseType: string;
  suggestions?: ContentSource[];
  outputs?: unknown;
  plan?: unknown;
  planId?: string;
  plan_preview?: { title: string; goal: string; steps: string[]; confidence: string };
  outreach?: unknown;
  proposal?: unknown;
  recommendation?: unknown;
  voiceScript?: unknown;
  requiresApproval: boolean;
  options?: string[];
}

const CONTENT_KEYWORDS = ["post", "content", "write", "caption", "article", "create content", "generate content", "social media"];
const OUTREACH_KEYWORDS = ["email", "outreach", "recruit", "reach out", "follow up", "follow-up", "nomination", "invite", "sms", "call script", "onboard"];
const VISUAL_KEYWORDS = ["color", "theme", "layout", "typography", "spacing", "design", "look", "homepage look", "cleaner", "cards", "header", "visual", "ui change", "palette", "font"];
const PLAN_KEYWORDS = ["plan", "strategy", "roadmap", "implement", "feature request", "change request", "proposal", "update system", "add feature", "restructure"];
const METRO_KEYWORDS = ["spin up", "new metro", "new city", "launch city", "open metro", "clone metro", "create metro", "what's missing", "whats missing", "launch readiness", "checklist", "metro template", "from template"];
const VOICE_KEYWORDS = ["voice", "call script", "voicemail", "answering", "phone", "inbound", "outbound", "dial", "greeting", "talk to cora", "phone script", "voice script", "answering script", "follow-up text"];
const PRICING_KEYWORDS = ["pricing", "price", "prices", "subscription cost", "what do we charge", "current prices", "metro pricing", "platform pricing", "pricing tier", "change price", "pricing change", "impact analysis", "stripe sync", "stripe audit"];

function detectIntent(input: string): "content" | "outreach" | "visual" | "plan" | "recommendation" | "metro" | "voice" | "pricing" | "general" {
  const lower = input.toLowerCase();

  if (isRecommendationRequest(input)) return "recommendation";

  const pricingHits = PRICING_KEYWORDS.filter((kw) => lower.includes(kw)).length;
  if (pricingHits >= 1) return "pricing";

  const metroHits = METRO_KEYWORDS.filter((kw) => lower.includes(kw)).length;
  if (metroHits >= 1) return "metro";

  const voiceHits = VOICE_KEYWORDS.filter((kw) => lower.includes(kw)).length;
  if (voiceHits >= 1) return "voice";

  const outreachHits = OUTREACH_KEYWORDS.filter((kw) => lower.includes(kw)).length;
  if (outreachHits >= 1) return "outreach";

  const visualHits = VISUAL_KEYWORDS.filter((kw) => lower.includes(kw)).length;
  if (visualHits >= 2) return "visual";

  const contentHits = CONTENT_KEYWORDS.filter((kw) => lower.includes(kw)).length;
  if (contentHits >= 1) return "content";

  const planHits = PLAN_KEYWORDS.filter((kw) => lower.includes(kw)).length;
  if (planHits >= 1) return "plan";

  if (visualHits >= 1) return "visual";

  return "general";
}

function formatForVoicePrep(message: string): string {
  const sentences = message.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if ((current + " " + sentence).length > 120 && current) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current = current ? current + " " + sentence : sentence;
    }
  }
  if (current) chunks.push(current.trim());
  return chunks.join("\n\n");
}

async function getMetroName(metroId: string): Promise<string> {
  const [metro] = await db.select({ cityId: metroProjects.cityId }).from(metroProjects).where(eq(metroProjects.id, metroId)).limit(1);
  if (metro?.cityId) {
    const [city] = await db.select({ name: cities.name }).from(cities).where(eq(cities.id, metro.cityId)).limit(1);
    if (city?.name) return city.name;
  }
  const [fallback] = await db.select({ name: cities.name }).from(cities).where(eq(cities.id, metroId)).limit(1);
  return fallback?.name || "the metro area";
}

function resolveVoiceHat(input: string): { hat: string; confidence: string; submode?: string } {
  const lower = input.toLowerCase();
  if (lower.includes("script") || lower.includes("draft") || lower.includes("write")) {
    return { hat: "editor", confidence: "high", submode: "voice" };
  }
  if (lower.includes("campaign") || lower.includes("outreach") || lower.includes("prospect")) {
    return { hat: "cmo", confidence: "high", submode: "voice" };
  }
  if (lower.includes("operator") || lower.includes("inbound") || lower.includes("answering")) {
    return { hat: "operator", confidence: "high", submode: "voice" };
  }
  return { hat: "cmo", confidence: "medium", submode: "voice" };
}

export async function handleCoraRequest(req: CoraRequest): Promise<CoraResponse> {
  const hat = resolveHat(req.input);
  const scope = req.scope || "metro";
  const intent = detectIntent(req.input);
  const isVoicePrep = req.conversation_mode === "voice_prep";

  if (intent === "content" && req.approvedSources && req.approvedSources.length > 0 && req.metroId) {
    const outputs = await generateFromApprovedSources({
      sources: req.approvedSources,
      metroId: req.metroId,
      scope,
      persona: "cora",
    });

    await db.insert(coraKnowledge).values({
      category: "content_generation",
      key: `generated_${outputs.length}_packages`,
      value: `Generated ${outputs.length} content package(s) for metro ${req.metroId} from approved sources`,
      confidenceLevel: "high",
      source: "cora_bridge",
      needsReview: false,
    });

    return {
      hat,
      message: `Generated content for ${outputs.length} source(s). All outputs saved as drafts — ready for your review.`,
      responseType: "content_generated",
      outputs,
      requiresApproval: false,
    };
  }

  if (intent === "content" && req.metroId) {
    const countMatch = req.input.match(/(\d+)\s*(post|piece|item|caption|article)/i);
    const count = countMatch ? Math.min(parseInt(countMatch[1], 10), 10) : 3;

    const suggestion = await suggestSources({ metroId: req.metroId, count });

    if (suggestion.suggestions.length > 0) {
      await db.insert(coraSuggestions).values({
        suggestion: `Content sources for metro ${req.metroId}: ${suggestion.suggestions.map((s) => s.name).join(", ")}`,
        context: `hat=${hat.hat}, scope=${scope}, intent=content, count=${count}`,
        impactLevel: "medium",
      });
    }

    return {
      hat,
      message: suggestion.message,
      responseType: "source_selection",
      suggestions: suggestion.suggestions,
      requiresApproval: true,
    };
  }

  if (intent === "content" && !req.metroId) {
    return {
      hat,
      message: "I need a metro to generate content for. Which metro should I target?",
      responseType: "needs_input",
      requiresApproval: false,
    };
  }

  if (intent === "pricing") {
    try {
      const { getPricingSummary, auditStripeSync } = await import("../stripe/stripeSyncService");
      const summary = await getPricingSummary();
      const lower = req.input.toLowerCase();

      const wantsAudit = lower.includes("audit") || lower.includes("sync") || lower.includes("stripe") || lower.includes("mismatch");
      const wantsChange = lower.includes("change") || lower.includes("update") || lower.includes("new tier") || lower.includes("what if");

      let auditResult = null;
      if (wantsAudit) {
        auditResult = await auditStripeSync();
      }

      const productLines = summary.products.map(p => {
        const priceStrs = p.prices
          .filter(pr => pr.isActive)
          .map(pr => `${pr.billingInterval}: $${(pr.priceAmount / 100).toFixed(2)}${pr.stripePriceId ? ` (Stripe: ${pr.stripePriceId.slice(0, 12)}...)` : " (no Stripe ID)"}`)
          .join(", ");
        return `• ${p.name} [${p.productKey}] — ${p.active ? "Active" : "Inactive"}${p.stripeProductId ? ` (Stripe: ${p.stripeProductId.slice(0, 12)}...)` : " (no Stripe product)"}${priceStrs ? `\n  Prices: ${priceStrs}` : "\n  No prices configured"}`;
      });

      let message = `**Platform Products & Pricing**\n\n${productLines.join("\n\n")}`;

      if (auditResult) {
        message += `\n\n**Stripe Sync Audit**\n`;
        message += `Checked: ${auditResult.checkedAt}\n`;
        message += `Products: ${auditResult.totalProducts} | Prices: ${auditResult.totalPrices}\n`;
        message += auditResult.healthy
          ? "Status: All aligned"
          : `Mismatches found (${auditResult.mismatches.length}):\n${auditResult.mismatches.map(m => `  - ${m.details}`).join("\n")}`;
      }

      if (wantsChange) {
        message += "\n\nTo change pricing, I can create a structured plan through the plan/approve workflow. This ensures no automatic changes are made to Stripe or the database. Just describe the pricing change you'd like, and I'll draft a plan for your review.";
      }

      await db.insert(coraSuggestions).values({
        suggestion: `Pricing inquiry: ${req.input.slice(0, 100)}`,
        context: `hat=cfo, scope=${scope}, intent=pricing`,
        impactLevel: "medium",
      });

      return {
        hat: { hat: "cfo", confidence: "high" },
        message,
        responseType: "pricing_intelligence",
        requiresApproval: false,
        options: wantsChange ? ["Create Pricing Change Plan", "Run Stripe Audit", "View Metro Overrides"] : undefined,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[Cora Service] Pricing intelligence error:", msg);
      return {
        hat: { hat: "cfo", confidence: "high" },
        message: "I encountered an issue retrieving pricing data. Please try again or check the admin pricing panel directly.",
        responseType: "error",
        requiresApproval: false,
      };
    }
  }

  if (intent === "outreach") {
    const asset = await createOutreachDraft({
      input: req.input,
      scope,
      metroId: req.metroId,
    });

    await db.insert(coraSuggestions).values({
      suggestion: `Outreach draft: "${asset.title}"`,
      context: `hat=${hat.hat}, scope=${scope}, intent=outreach, type=${asset.type || "general"}`,
      impactLevel: "medium",
    });

    return {
      hat: { ...hat, hat: hat.hat === "admin" ? "cmo" : hat.hat },
      message: `Outreach draft created: "${asset.title}". Review and approve before sending.`,
      responseType: "outreach_draft",
      outreach: asset,
      requiresApproval: true,
    };
  }

  if (intent === "visual") {
    const proposal = await createUiProposal({
      input: req.input,
      scope,
      metroId: req.metroId,
    });

    await db.insert(coraSuggestions).values({
      suggestion: `UI proposal: "${proposal.name}"`,
      context: `hat=builder, scope=${scope}, intent=visual`,
      impactLevel: "high",
    });

    return {
      hat: { hat: "builder", confidence: "high", submode: "visual" },
      message: `UI proposal created: "${proposal.name}". Review the preview config and approve to proceed.`,
      responseType: "ui_proposal",
      proposal,
      requiresApproval: true,
    };
  }

  if (intent === "plan") {
    let planJson = {
      goal: req.input,
      steps: ["Analyze requirements", "Implement changes", "Test and verify"],
      impact: "To be determined based on scope",
      risks: "Minimal — all changes are proposal-first",
      confidence: "medium",
    };

    if (openai) {
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: CORA_PLAN_GENERATION_SYSTEM,
            },
            { role: "user", content: req.input },
          ],
          response_format: { type: "json_object" },
          max_tokens: 500,
          temperature: 0.7,
        });

        const raw = completion.choices[0]?.message?.content;
        if (raw) {
          const parsed = JSON.parse(raw);
          planJson = {
            goal: parsed.goal || planJson.goal,
            steps: parsed.steps || planJson.steps,
            impact: parsed.impact || planJson.impact,
            risks: parsed.risks || planJson.risks,
            confidence: parsed.confidence || planJson.confidence,
          };

          const plan = await createPlan({
            title: parsed.title || req.input.slice(0, 100),
            description: parsed.description || null,
            hat: hat.hat,
            scope,
            metroId: req.metroId,
            tags: [],
            planJson,
          });

          await db.insert(coraSuggestions).values({
            suggestion: `Plan: "${plan.title}"`,
            context: `hat=${hat.hat}, scope=${scope}, intent=plan`,
            impactLevel: "high",
          });

          return {
            hat,
            message: `Plan created: "${plan.title}". Review and approve to proceed to build.`,
            responseType: "plan_created",
            plan,
            planId: plan.id,
            plan_preview: {
              title: plan.title,
              goal: planJson.goal,
              steps: planJson.steps,
              confidence: planJson.confidence,
            },
            requiresApproval: true,
            options: ["Approve Plan", "Modify Plan", "Cancel"],
          };
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("[Cora Service] Plan generation error:", msg);
      }
    }

    const plan = await createPlan({
      title: req.input.slice(0, 100),
      hat: hat.hat,
      scope,
      metroId: req.metroId,
      planJson,
    });

    await db.insert(coraSuggestions).values({
      suggestion: `Plan: "${plan.title}"`,
      context: `hat=${hat.hat}, scope=${scope}, intent=plan`,
      impactLevel: "high",
    });

    return {
      hat,
      message: `Plan created: "${plan.title}". Review and approve to proceed to build.`,
      responseType: "plan_created",
      plan,
      planId: plan.id,
      plan_preview: {
        title: plan.title,
        goal: planJson.goal,
        steps: planJson.steps,
        confidence: planJson.confidence,
      },
      requiresApproval: true,
      options: ["Approve Plan", "Modify Plan", "Cancel"],
    };
  }

  if (intent === "metro") {
    const lower = req.input.toLowerCase();
    const isChecklistQuery = lower.includes("what's missing") || lower.includes("whats missing") || lower.includes("launch readiness") || lower.includes("checklist");

    if (isChecklistQuery && req.metroId) {
      const checklist = await getMetroChecklist(req.metroId);
      const metroName = await getMetroName(req.metroId);
      const pendingItems = checklist.items.filter((i) => i.status === "pending");
      const blockedItems = checklist.items.filter((i) => i.status === "blocked");

      let message = `Launch readiness for ${metroName}: ${checklist.progress.percent}% complete (${checklist.progress.complete}/${checklist.progress.total}).`;
      if (pendingItems.length > 0) {
        message += ` Still pending: ${pendingItems.map((i) => i.itemName).join(", ")}.`;
      }
      if (blockedItems.length > 0) {
        message += ` Blocked: ${blockedItems.map((i) => i.itemName).join(", ")}.`;
      }
      if (checklist.progress.percent === 100) {
        message += " All items complete — this metro is ready to go live.";
      }

      await db.insert(coraSuggestions).values({
        suggestion: `Checklist audit for metro ${req.metroId}`,
        context: `hat=operator, scope=${scope}, intent=metro, action=checklist_audit`,
        impactLevel: "medium",
      });

      return {
        hat: { hat: "operator", confidence: "high" },
        message,
        responseType: "checklist_audit",
        outputs: checklist,
        requiresApproval: false,
      };
    }

    if (isChecklistQuery && !req.metroId) {
      const allMetros = await db.select().from(metroProjects);
      const summaries = await Promise.all(
        allMetros.map(async (m) => {
          const cl = await getMetroChecklist(m.id);
          return { name: m.name, status: m.status, progress: cl.progress.percent };
        })
      );

      return {
        hat: { hat: "operator", confidence: "high" },
        message: summaries.length > 0
          ? `Launch readiness across ${summaries.length} metro(s): ${summaries.map((s) => `${s.name} (${s.status}, ${s.progress}%)`).join("; ")}.`
          : "No metro projects found. Create one first.",
        responseType: "checklist_overview",
        outputs: summaries,
        requiresApproval: false,
      };
    }

    const cityNameMatch = req.input.match(/(?:for|metro|city|spin up|clone|create|launch|open)\s+([A-Z][a-zA-Z\s]+)/);
    const targetCity = cityNameMatch ? cityNameMatch[1].trim() : null;

    const plan = await createPlan({
      title: targetCity ? `Launch new metro: ${targetCity}` : "Launch new metro",
      description: targetCity
        ? `Create ${targetCity} metro from template, clone hub structure, set up coming soon page, and generate launch checklist.`
        : "Create a new metro from the default template.",
      hat: "operator",
      scope,
      metroId: req.metroId,
      tags: ["metro-launch"],
      planJson: {
        goal: targetCity ? `Set up ${targetCity} as a new metro hub` : "Set up a new metro hub",
        steps: [
          "Select metro template (Charlotte Base default)",
          "Create city record and metro project",
          "Clone hub structure (zones, categories, tags)",
          "Generate launch checklist",
          "Configure coming soon page",
          "Set status to coming_soon",
        ],
        impact: "New metro will be created in coming_soon mode — no content or user data is copied",
        risks: "Minimal — metro starts in coming_soon, requires manual approval to go live",
        confidence: "high",
        targetCity: targetCity || undefined,
      },
    });

    await db.insert(coraSuggestions).values({
      suggestion: `Metro launch plan: "${plan.title}"`,
      context: `hat=operator, scope=${scope}, intent=metro, action=create`,
      impactLevel: "high",
    });

    return {
      hat: { hat: "operator", confidence: "high" },
      message: `Plan created: "${plan.title}". Review and approve before I clone the template. No auto-launch will occur.`,
      responseType: "plan_created",
      plan,
      planId: plan.id,
      plan_preview: {
        title: plan.title,
        goal: (plan.planJson as Record<string, unknown>)?.goal as string || plan.title,
        steps: (plan.planJson as Record<string, unknown>)?.steps as string[] || [],
        confidence: "high",
      },
      requiresApproval: true,
      options: ["Approve Plan", "Modify Plan", "Cancel"],
    };
  }

  if (intent === "voice") {
    const voiceHat = resolveVoiceHat(req.input);
    const asset = await createVoiceScriptDraft({
      input: req.input,
      scope,
      metroId: req.metroId,
    });

    await db.insert(coraSuggestions).values({
      suggestion: `Voice script draft: "${asset.title}"`,
      context: `hat=${voiceHat.hat}, scope=${scope}, intent=voice, type=${asset.type || "voicemail_script"}`,
      impactLevel: "medium",
    });

    let message = `Voice script draft created: "${asset.title}". Review and approve before use.`;
    if (isVoicePrep) message = formatForVoicePrep(message);

    return {
      hat: voiceHat,
      message,
      responseType: "voice_script_draft",
      voiceScript: asset,
      requiresApproval: true,
    };
  }

  if (intent === "recommendation") {
    const metroName = req.metroId ? await getMetroName(req.metroId) : "Charlotte";
    const recommendation = await formatRecommendationResponse(req.input, { metroName, scope });

    let message = recommendation.opening;
    if (isVoicePrep) message = formatForVoicePrep(message);

    return {
      hat,
      message,
      responseType: "recommendation",
      recommendation,
      requiresApproval: false,
    };
  }

  await db.insert(coraQuestions).values({
    question: req.input,
    context: `scope=${scope}, metroId=${req.metroId || "none"}, hat=${hat.hat}`,
    priority: "low",
    status: "pending",
  });

  return {
    hat,
    message: `I logged your request under the ${hat.hat} hat. This type of action isn't automated yet — I've saved it as a question for review.`,
    responseType: "logged",
    requiresApproval: false,
  };
}
