import { db } from "../db";
import { uiChangeProposals } from "@shared/schema";
import { eq, desc, and, SQL } from "drizzle-orm";
import { openai } from "../lib/openai";
import { CORA_UI_PROPOSAL_SYSTEM } from "../ai/prompts/platform-services";

interface CreateProposalParams {
  input: string;
  scope?: "platform" | "metro";
  metroId?: string;
}

function detectChangeType(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes("color") || lower.includes("theme") || lower.includes("palette")) return "colors";
  if (lower.includes("layout") || lower.includes("grid") || lower.includes("section") || lower.includes("column")) return "layout";
  if (lower.includes("font") || lower.includes("typography") || lower.includes("text size") || lower.includes("heading")) return "typography";
  if (lower.includes("card") || lower.includes("button") || lower.includes("component") || lower.includes("widget")) return "component";
  if (lower.includes("page") || lower.includes("homepage") || lower.includes("landing")) return "page";
  if (lower.includes("spacing") || lower.includes("padding") || lower.includes("margin") || lower.includes("gap")) return "layout";
  return "component";
}

export async function createUiProposal(params: CreateProposalParams) {
  const changeType = detectChangeType(params.input);
  const scope = params.scope || "platform";

  let name = `UI proposal: ${changeType}`;
  let description = params.input;
  let previewConfig: Record<string, string> = {};
  let codeSnippet: string | null = null;

  if (openai) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: CORA_UI_PROPOSAL_SYSTEM,
          },
          {
            role: "user",
            content: params.input,
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 600,
        temperature: 0.7,
      });

      const raw = completion.choices[0]?.message?.content;
      if (raw) {
        const parsed = JSON.parse(raw);
        name = parsed.name || name;
        description = parsed.description || description;
        previewConfig = parsed.preview_config || {};
        codeSnippet = parsed.code_snippet || null;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[Cora UiProposalService] AI generation error:", msg);
    }
  }

  const [proposal] = await db.insert(uiChangeProposals).values({
    scope,
    metroId: params.metroId || null,
    name,
    changeType,
    description,
    previewConfig,
    codeSnippet,
    status: "draft",
    createdBy: "cora",
  }).returning();

  return proposal;
}

export async function approveProposal(id: string) {
  const [existing] = await db.select().from(uiChangeProposals).where(eq(uiChangeProposals.id, id)).limit(1);
  if (!existing) throw new Error("UI proposal not found");
  if (existing.status !== "draft") throw new Error(`Cannot approve proposal in status: ${existing.status}`);

  const [updated] = await db.update(uiChangeProposals)
    .set({ status: "approved", updatedAt: new Date() })
    .where(eq(uiChangeProposals.id, id))
    .returning();
  return updated;
}

export async function revertProposal(id: string) {
  const [updated] = await db.update(uiChangeProposals)
    .set({ status: "reverted", updatedAt: new Date() })
    .where(eq(uiChangeProposals.id, id))
    .returning();
  if (!updated) throw new Error("UI proposal not found");
  return updated;
}

export async function updateProposal(id: string, updates: { name?: string; description?: string; previewConfig?: Record<string, string>; codeSnippet?: string }) {
  const setFields: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.name !== undefined) setFields.name = updates.name;
  if (updates.description !== undefined) setFields.description = updates.description;
  if (updates.previewConfig !== undefined) setFields.previewConfig = updates.previewConfig;
  if (updates.codeSnippet !== undefined) setFields.codeSnippet = updates.codeSnippet;

  const [updated] = await db.update(uiChangeProposals)
    .set(setFields)
    .where(eq(uiChangeProposals.id, id))
    .returning();
  if (!updated) throw new Error("UI proposal not found");
  return updated;
}

export async function getProposal(id: string) {
  const [proposal] = await db.select().from(uiChangeProposals).where(eq(uiChangeProposals.id, id)).limit(1);
  return proposal || null;
}

export async function listProposals(filters?: { status?: string; changeType?: string; limit?: number }) {
  const conditions: SQL[] = [];
  if (filters?.status) {
    conditions.push(eq(uiChangeProposals.status, filters.status as "draft" | "approved" | "applied" | "reverted"));
  }
  if (filters?.changeType) {
    conditions.push(eq(uiChangeProposals.changeType, filters.changeType));
  }

  const query = conditions.length > 0
    ? db.select().from(uiChangeProposals).where(and(...conditions))
    : db.select().from(uiChangeProposals);

  return query.orderBy(desc(uiChangeProposals.createdAt)).limit(filters?.limit || 50);
}
