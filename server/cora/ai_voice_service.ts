import { db } from "../db";
import { aiVoiceProfiles } from "@shared/schema";
import { eq, desc, and, SQL } from "drizzle-orm";
import { z } from "zod";

const VALID_PROFILE_TRANSITIONS: Record<string, string[]> = {
  draft: ["active"],
  active: ["archived"],
  archived: [],
};

export const createVoiceProfileSchema = z.object({
  name: z.string().min(1, "name is required"),
  persona: z.string().optional(),
  scope: z.string().optional(),
  metroId: z.string().optional(),
  tone: z.string().optional(),
  pacing: z.string().optional(),
  introStyle: z.string().optional(),
  outroStyle: z.string().optional(),
  vocabulary: z.string().optional(),
  pronunciationNotes: z.string().optional(),
});

export const updateVoiceProfileSchema = z.object({
  name: z.string().min(1).optional(),
  tone: z.string().optional(),
  pacing: z.string().optional(),
  introStyle: z.string().optional(),
  outroStyle: z.string().optional(),
  vocabulary: z.string().optional(),
  pronunciationNotes: z.string().optional(),
}).refine(obj => Object.values(obj).some(v => v !== undefined), { message: "At least one field is required" });

export async function createVoiceProfile(data: z.infer<typeof createVoiceProfileSchema>) {
  const [profile] = await db.insert(aiVoiceProfiles).values({
    name: data.name,
    persona: data.persona || "cora",
    scope: data.scope || "platform",
    metroId: data.metroId || null,
    tone: data.tone || "warm and professional",
    pacing: data.pacing || "moderate",
    introStyle: data.introStyle || "friendly greeting",
    outroStyle: data.outroStyle || "clear next steps",
    vocabulary: data.vocabulary || null,
    pronunciationNotes: data.pronunciationNotes || null,
    status: "draft",
  }).returning();
  return profile;
}

export async function getVoiceProfile(id: string) {
  const [profile] = await db.select().from(aiVoiceProfiles).where(eq(aiVoiceProfiles.id, id)).limit(1);
  return profile || null;
}

export async function listVoiceProfiles(filters?: { persona?: string; status?: string; scope?: string; limit?: number }) {
  const conditions: SQL[] = [];
  if (filters?.persona) conditions.push(eq(aiVoiceProfiles.persona, filters.persona));
  if (filters?.status) conditions.push(eq(aiVoiceProfiles.status, filters.status as "draft" | "active" | "archived"));
  if (filters?.scope) conditions.push(eq(aiVoiceProfiles.scope, filters.scope));

  const query = conditions.length > 0
    ? db.select().from(aiVoiceProfiles).where(and(...conditions))
    : db.select().from(aiVoiceProfiles);

  return query.orderBy(desc(aiVoiceProfiles.createdAt)).limit(filters?.limit || 50);
}

export async function updateVoiceProfile(id: string, updates: z.infer<typeof updateVoiceProfileSchema>) {
  const [existing] = await db.select().from(aiVoiceProfiles).where(eq(aiVoiceProfiles.id, id)).limit(1);
  if (!existing) throw new Error("Voice profile not found");
  if (existing.status !== "draft") throw new Error("Can only edit voice profiles in draft status");

  const setFields: Record<string, unknown> = { updatedAt: new Date() };
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) setFields[key] = value;
  }

  const [updated] = await db.update(aiVoiceProfiles)
    .set(setFields)
    .where(eq(aiVoiceProfiles.id, id))
    .returning();
  return updated;
}

export async function activateVoiceProfile(id: string) {
  const [existing] = await db.select().from(aiVoiceProfiles).where(eq(aiVoiceProfiles.id, id)).limit(1);
  if (!existing) throw new Error("Voice profile not found");
  const allowed = VALID_PROFILE_TRANSITIONS[existing.status] || [];
  if (!allowed.includes("active")) throw new Error(`Cannot activate profile in status: ${existing.status}`);

  const [updated] = await db.update(aiVoiceProfiles)
    .set({ status: "active", updatedAt: new Date() })
    .where(eq(aiVoiceProfiles.id, id))
    .returning();
  return updated;
}

export async function archiveVoiceProfile(id: string) {
  const [existing] = await db.select().from(aiVoiceProfiles).where(eq(aiVoiceProfiles.id, id)).limit(1);
  if (!existing) throw new Error("Voice profile not found");
  const allowed = VALID_PROFILE_TRANSITIONS[existing.status] || [];
  if (!allowed.includes("archived")) throw new Error(`Cannot archive profile in status: ${existing.status}. Must be active first.`);

  const [updated] = await db.update(aiVoiceProfiles)
    .set({ status: "archived", updatedAt: new Date() })
    .where(eq(aiVoiceProfiles.id, id))
    .returning();
  return updated;
}

export async function seedDefaultVoiceProfiles() {
  const existing = await db.select().from(aiVoiceProfiles).limit(1);
  if (existing.length > 0) return;

  await db.insert(aiVoiceProfiles).values([
    {
      name: "Cora Platform Voice",
      persona: "cora",
      scope: "platform",
      tone: "warm, confident, community-focused",
      pacing: "moderate with purposeful pauses",
      introStyle: "friendly and direct — 'Hi, this is Cora from CityMetroHub.'",
      outroStyle: "clear next step with warmth — 'Looking forward to connecting.'",
      vocabulary: "professional but approachable, avoid jargon",
      status: "active",
    },
    {
      name: "Charlotte Metro Voice",
      persona: "charlotte",
      scope: "metro",
      tone: "local expert, enthusiastic, knowledgeable",
      pacing: "energetic but clear",
      introStyle: "local and warm — 'Hey, this is Charlotte from your local Metro Hub.'",
      outroStyle: "actionable — 'Let me know how I can help you get started.'",
      vocabulary: "casual-professional, local references encouraged",
      status: "active",
    },
  ]);
}
