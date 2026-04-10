import type { PersonaId } from "../personas";

export interface PromptEntry {
  key: string;
  persona: PersonaId;
  purpose: string;
  temperature: number;
  version: string;
  build: (...args: any[]) => string;
}

const registry = new Map<string, PromptEntry>();

export function registerPrompt(entry: PromptEntry): PromptEntry {
  registry.set(entry.key, entry);
  return entry;
}

export function getPrompt(key: string): PromptEntry | undefined {
  return registry.get(key);
}

export function getAllPrompts(): PromptEntry[] {
  return Array.from(registry.values());
}

export function getPromptsByPersona(persona: PersonaId): PromptEntry[] {
  return Array.from(registry.values()).filter(p => p.persona === persona);
}
