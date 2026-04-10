// PERSONA BOUNDARY: Cora (platform/operator-facing)
// This service generates outreach assets (emails, SMS, call scripts, voice scripts)
// for platform operators. Charlotte's outreach equivalents live in
// server/intelligence/outreach-drafter.ts (claim invites, upgrade pitches).
// Both use prompts from server/ai/prompts/outreach.ts.
import { db } from "../db";
import { outreachAssets } from "@shared/schema";
import { eq, desc, and, SQL } from "drizzle-orm";
import { openai } from "../lib/openai";
import { buildCoraOutreachDraftSystem, buildCoraVoiceScriptSystem } from "../ai/prompts/outreach";

type OutreachType = "email" | "sms" | "call_script" | "follow_up";
type TargetType = "business" | "creator" | "sponsor" | "operator" | "general";

interface CreateOutreachParams {
  input: string;
  scope?: "platform" | "metro";
  metroId?: string;
  type?: OutreachType;
  targetType?: TargetType;
}

function detectOutreachType(input: string): OutreachType {
  const lower = input.toLowerCase();
  if (lower.includes("sms") || lower.includes("text message")) return "sms";
  if (lower.includes("call") || lower.includes("script") || lower.includes("phone")) return "call_script";
  if (lower.includes("follow up") || lower.includes("follow-up") || lower.includes("followup")) return "follow_up";
  return "email";
}

function detectTargetType(input: string): TargetType {
  const lower = input.toLowerCase();
  if (lower.includes("business") || lower.includes("listing") || lower.includes("merchant")) return "business";
  if (lower.includes("creator") || lower.includes("influencer") || lower.includes("ambassador")) return "creator";
  if (lower.includes("sponsor") || lower.includes("advertiser") || lower.includes("partner")) return "sponsor";
  if (lower.includes("operator") || lower.includes("metro operator") || lower.includes("city operator")) return "operator";
  return "general";
}

export async function createOutreachDraft(params: CreateOutreachParams) {
  const outreachType = params.type || detectOutreachType(params.input);
  const targetType = params.targetType || detectTargetType(params.input);
  const scope = params.scope || "metro";

  let title = `${outreachType} draft for ${targetType}`;
  let subjectLine: string | null = null;
  let body = params.input;

  if (openai) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: buildCoraOutreachDraftSystem(outreachType, targetType),
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
        title = parsed.title || title;
        subjectLine = parsed.subject_line || null;
        body = parsed.body || body;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[Cora OutreachService] AI generation error:", msg);
    }
  }

  const [asset] = await db.insert(outreachAssets).values({
    scope,
    metroId: params.metroId || null,
    type: outreachType,
    title,
    subjectLine,
    body,
    personaName: "cora",
    targetType,
    status: "draft",
    createdBy: "cora",
  }).returning();

  return asset;
}

export async function approveOutreach(id: string) {
  const [existing] = await db.select().from(outreachAssets).where(eq(outreachAssets.id, id)).limit(1);
  if (!existing) throw new Error("Outreach asset not found");
  if (existing.status !== "draft") throw new Error(`Cannot approve outreach in status: ${existing.status}`);

  const [updated] = await db.update(outreachAssets)
    .set({ status: "approved", updatedAt: new Date() })
    .where(eq(outreachAssets.id, id))
    .returning();
  return updated;
}

export async function archiveOutreach(id: string) {
  const [updated] = await db.update(outreachAssets)
    .set({ status: "archived", updatedAt: new Date() })
    .where(eq(outreachAssets.id, id))
    .returning();
  if (!updated) throw new Error("Outreach asset not found");
  return updated;
}

export async function updateOutreach(id: string, updates: { title?: string; subjectLine?: string; body?: string }) {
  const setFields: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.title !== undefined) setFields.title = updates.title;
  if (updates.subjectLine !== undefined) setFields.subjectLine = updates.subjectLine;
  if (updates.body !== undefined) setFields.body = updates.body;

  const [updated] = await db.update(outreachAssets)
    .set(setFields)
    .where(eq(outreachAssets.id, id))
    .returning();
  if (!updated) throw new Error("Outreach asset not found");
  return updated;
}

export async function getOutreach(id: string) {
  const [asset] = await db.select().from(outreachAssets).where(eq(outreachAssets.id, id)).limit(1);
  return asset || null;
}

type VoiceScriptType = "voicemail_script" | "inbound_answer_script" | "follow_up_sms";

function detectVoiceScriptType(input: string): VoiceScriptType {
  const lower = input.toLowerCase();
  if (lower.includes("inbound") || lower.includes("answering") || lower.includes("answer script")) return "inbound_answer_script";
  if (lower.includes("follow-up") || lower.includes("follow up") || lower.includes("sms") || lower.includes("text")) return "follow_up_sms";
  return "voicemail_script";
}

export async function createVoiceScriptDraft(params: { input: string; scope?: string; metroId?: string }) {
  const voiceType = detectVoiceScriptType(params.input);
  const scope = params.scope || "metro";

  let title = `${voiceType.replace(/_/g, " ")} draft`;
  let body = params.input;

  if (openai) {
    try {
      const sectionPrompt = voiceType === "follow_up_sms"
        ? "Write a concise SMS follow-up message. Return JSON with: title, body."
        : "Write a structured voice script with sections: opener, qualification, value_prop, objection_handling, cta, close, voicemail_version (shorter version for voicemail), sms_follow_up (optional SMS text). Return valid JSON with: title, body (the full script with section headers).";

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: buildCoraVoiceScriptSystem(sectionPrompt),
          },
          { role: "user", content: params.input },
        ],
        response_format: { type: "json_object" },
        max_tokens: 800,
        temperature: 0.7,
      });

      const raw = completion.choices[0]?.message?.content;
      if (raw) {
        const parsed = JSON.parse(raw);
        title = parsed.title || title;
        body = parsed.body || body;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[Cora OutreachService] Voice script AI generation error:", msg);
    }
  }

  const [asset] = await db.insert(outreachAssets).values({
    scope,
    metroId: params.metroId || null,
    type: voiceType,
    title,
    subjectLine: null,
    body,
    personaName: "cora",
    targetType: "general",
    status: "draft",
    createdBy: "cora",
  }).returning();

  return asset;
}

export async function listOutreach(filters?: { status?: string; type?: string; targetType?: string; limit?: number }) {
  const conditions: SQL[] = [];
  if (filters?.status) {
    conditions.push(eq(outreachAssets.status, filters.status as "draft" | "approved" | "sent" | "archived"));
  }
  if (filters?.type) {
    conditions.push(eq(outreachAssets.type, filters.type));
  }
  if (filters?.targetType) {
    conditions.push(eq(outreachAssets.targetType, filters.targetType));
  }

  const query = conditions.length > 0
    ? db.select().from(outreachAssets).where(and(...conditions))
    : db.select().from(outreachAssets);

  return query.orderBy(desc(outreachAssets.createdAt)).limit(filters?.limit || 50);
}
