import { db } from "../db";
import { eq, and, desc, gt, or, isNull, sql } from "drizzle-orm";
import { charlotteMemory } from "@shared/schema";
import type { CharlotteMemoryEntry, InsertCharlotteMemory } from "@shared/schema";

export async function recordMemory(entry: InsertCharlotteMemory): Promise<CharlotteMemoryEntry> {
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const [row] = await db.insert(charlotteMemory).values({
    ...entry,
    expiresAt: entry.expiresAt || thirtyDaysFromNow,
  }).returning();
  return row;
}

export async function recordTaskMemory(taskId: string, taskTitle: string, summary: string): Promise<void> {
  await recordMemory({
    scope: "admin_ops",
    type: "recent_task",
    content: `Task "${taskTitle}" completed: ${summary}`,
    referenceId: taskId,
  });
}

export async function recordContextNote(note: string, referenceId?: string): Promise<void> {
  await recordMemory({
    scope: "admin_context",
    type: "context_note",
    content: note,
    referenceId: referenceId || null,
  });
}

export async function recordSystemObservation(content: string, referenceId?: string): Promise<void> {
  await recordMemory({
    scope: "admin_context",
    type: "system_observation",
    content,
    referenceId: referenceId || null,
  });
}

export async function recordPreference(preference: string): Promise<void> {
  await recordMemory({
    scope: "admin_preference",
    type: "user_preference",
    content: preference,
  });
}

export async function getRecentAdminMemory(limit: number = 20, withinDays: number = 7): Promise<CharlotteMemoryEntry[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - withinDays);

  const rows = await db
    .select()
    .from(charlotteMemory)
    .where(and(
      gt(charlotteMemory.createdAt, cutoff),
      or(
        isNull(charlotteMemory.expiresAt),
        gt(charlotteMemory.expiresAt, new Date())
      )
    ))
    .orderBy(desc(charlotteMemory.createdAt))
    .limit(limit);

  return rows;
}

export function buildMemoryContext(memories: CharlotteMemoryEntry[]): string {
  if (memories.length === 0) return "";

  const sections: string[] = ["\n\nRECENT MEMORY (use naturally in conversation — reference what the operator has been working on):"];

  const tasks = memories.filter(m => m.type === "recent_task");
  const contexts = memories.filter(m => m.type === "context_note");
  const prefs = memories.filter(m => m.type === "user_preference");
  const observations = memories.filter(m => m.type === "system_observation");

  if (tasks.length > 0) {
    sections.push("Recent completed tasks:");
    for (const t of tasks.slice(0, 8)) {
      const age = getRelativeTime(t.createdAt);
      sections.push(`  - ${t.content} (${age})`);
    }
  }

  if (contexts.length > 0) {
    sections.push("Current context:");
    for (const c of contexts.slice(0, 5)) {
      sections.push(`  - ${c.content}`);
    }
  }

  if (prefs.length > 0) {
    sections.push("Operator preferences:");
    for (const p of prefs.slice(0, 5)) {
      sections.push(`  - ${p.content}`);
    }
  }

  if (observations.length > 0) {
    sections.push("Recent articles and local news observations (reference these when users ask what's new or happening locally):");
    for (const a of observations.slice(0, 10)) {
      const age = getRelativeTime(a.createdAt);
      sections.push(`  - ${a.content} (${age})`);
    }
  }

  return sections.join("\n");
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
