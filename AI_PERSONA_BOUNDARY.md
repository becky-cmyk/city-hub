# AI Persona & Prompt Architecture

## Personas

### Charlotte (metro/public-facing)
- **Role**: Public AI guide, community storyteller, resident-facing assistant
- **Allowed Domains**: public chat, onboarding flows, story interviews, content generation (articles, spotlights, trending), RSS rewrite, zone extraction, classification, social captions
- **Default Tone**: Warm, conversational, bilingual (EN/ES)
- **Model**: gpt-4o-mini

### Cora (platform/operator-facing)
- **Role**: Internal operations assistant, outreach drafter, admin-side intelligence
- **Allowed Domains**: outreach emails (claim invite, upgrade pitch), capture story generation, follow-up scheduling, response doctrine, microsite generation
- **Default Tone**: Professional, data-driven, concise
- **Model**: gpt-4o-mini

### Shared Services
Services used by both personas but persona-agnostic:
- **Translation** (`auto-translate`): Bilingual content translation (EN↔ES)
- **Classification** (`ai-classifier`): Category/subcategory classification
- **Content Normalization** (`content-normalizer`): Geo-tagging, integrity checks

## Prompt Registry

All AI prompts live in `server/ai/prompts/`. Each prompt module imports `registerPrompt` from `./registry` (not `./index`) to avoid circular dependencies.

### Registry Structure
```
server/ai/prompts/
  registry.ts          ← PromptEntry type, registerPrompt(), getPrompt(), getAllPrompts()
  index.ts             ← Barrel re-exports from registry + all prompt modules
  public-guide.ts      ← Charlotte public chat system prompt, greetings, step context, language instruction
  content-pipeline.ts  ← RSS rewrite, zone extraction, local article, spotlight/trending
  classifier.ts        ← Category/subcategory classification
  outreach.ts          ← Claim invite, upgrade pitch, capture story, capture follow-up
  platform-services.ts ← Translation, microsite generation, social caption, response doctrine
  story-flows.ts       ← Story article generation, conversation editor
```

### PromptEntry Schema
```typescript
interface PromptEntry {
  key: string;           // e.g. "contentPipeline.rssRewrite"
  persona: PersonaId;    // "charlotte" | "cora" | "shared"
  purpose: string;       // Human-readable description
  temperature: number;   // Recommended temperature
  version: string;       // Semver for tracking changes
  build: (...args) => string;  // Returns the prompt string
}
```

### Usage Pattern
```typescript
import { RSS_REWRITE_SYSTEM } from "./ai/prompts/content-pipeline";
// Use the exported constant directly in OpenAI calls

// Or use the registry for dynamic lookup:
import { getPrompt } from "./ai/prompts";
const entry = getPrompt("contentPipeline.rssRewrite");
const prompt = entry?.build();
```

## Persona Definitions

Persona metadata lives in `server/ai/personas.ts`:
```typescript
import { getPersona, PERSONAS } from "./ai/personas";
const charlotte = getPersona("charlotte");
// { id: "charlotte", displayName: "Charlotte", role: "...", allowedDomains: [...], defaultTone: "..." }
```

## Service Boundaries

### Charlotte-owned files
- `charlotte-public-routes.ts` — Public chat API
- `charlotte-chat-routes.ts` — Admin chat, content editing, AI writing tools
- `charlotte-flows.ts` — Onboarding flows, story interviews, conversation handling
- `lib/ai-content.ts` — RSS rewrite, zone extraction helpers
- `intelligence/content-generator.ts` — Article generation pipeline

### Cora-owned files
- `intelligence/outreach-drafter.ts` — Claim invite, upgrade pitch emails
- `services/capture-story-generator.ts` — Capture story article generation
- `services/capture-followup-scheduler.ts` — Follow-up scheduling
- `cora/responseDoctrine.ts` — Response doctrine prompt

### Shared files
- `services/ai-classifier.ts` — Category classification
- `services/auto-translate.ts` — Bilingual translation
- `intelligence/micrositeGenerator.ts` — Microsite HTML generation
- `intelligence/social-content-generator.ts` — Social media captions

## Implementation Notes

- **Zone extraction caching**: `aiExtractZoneSlug` in `lib/ai-content.ts` caches the known zones list for performance. The prior duplicate in `intelligence-routes.ts` queried zones fresh each call. Behavior is identical; only DB query frequency differs.

## Platform Identity Rules

Both Charlotte and Cora must follow these identity guardrails when describing or referencing the platform:

1. **Core identity**: City Hub is what the local section of a newspaper used to be — rebuilt as a living platform for each community. This is the primary mental model.
2. **Never reduce to a single surface**: Never describe the platform as *only* a directory, *only* a website, *only* a marketplace, *only* a feed, *only* a media brand, or *only* an event board. Those are components or surfaces inside the system, not the core identity.
3. **Engine framing**: Each engine maps to a newspaper section role — Hub Presence is the identity layer (yellow pages), Pulse is the living stream (what's happening now), Events is the community calendar, Stories is local reporting, Marketplace is classifieds, Media Network is multi-channel distribution, Jobs is help wanted.
4. **Distribution, not just digital**: City Hub distributes across print, digital, venue TV, radio, and real-world placements. It is a community distribution system, not just a website or app.
5. **Micro hubs as local sections**: Each micro hub / district hub functions like its own always-updating local section of a newspaper.
6. **Preferred explanation lines**:
   - "City Hub is the local section of a newspaper turned into a full platform for each community."
   - "Each micro hub functions like its own always-updating local section."
   - "This is not just digital publishing; it is community distribution across print, digital, TV, radio, and real-world placements."

See `docs/platform-identity.md` for the full positioning reference.

## Guidelines

1. New prompts go in the appropriate module under `server/ai/prompts/` and are registered with `registerPrompt()`.
2. Import `registerPrompt` from `./registry`, never from `./index` (avoids circular deps).
3. Charlotte prompts should never reference internal operator data or admin workflows.
4. Cora prompts should never adopt Charlotte's public-facing conversational tone.
5. Shared services receive persona context via parameters, not hardcoded persona references.
6. All AI calls use `gpt-4o-mini`.
7. DB-backed admin overrides (e.g. `charlottePublicConfig.systemInstructions`) merge additively on top of registry prompts — they never replace them entirely.
