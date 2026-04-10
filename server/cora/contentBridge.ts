// PERSONA BOUNDARY: Cora (platform/operator-facing) → Charlotte (metro/public-facing) bridge
// This module lets Cora select content sources and delegate generation to Charlotte's
// content studio (server/content-studio-routes.ts). Cora orchestrates; Charlotte writes.
// See AI_PERSONA_BOUNDARY.md for the full persona ownership map.
import { selectContentSources } from "./sourceSelector";
import { generateContentPackage } from "../content-studio-routes";

interface ContentSource {
  type: string;
  id: string;
  name: string;
  excerpt?: string;
  imageUrl?: string | null;
  reason?: string;
}

interface BridgeGenerateParams {
  sources: ContentSource[];
  metroId: string;
  scope: "platform" | "metro";
  persona: "cora" | "charlotte";
}

export async function suggestSources({ metroId, count = 3 }: { metroId: string; count?: number }) {
  const suggestions = await selectContentSources({ metroId, count });
  return {
    suggestions,
    message: suggestions.length > 0
      ? `I selected ${suggestions.length} source(s) for content generation. Review and approve to proceed.`
      : "No suitable content sources found for this metro. Try specifying sources directly.",
    requiresApproval: true,
  };
}

export async function generateFromApprovedSources({
  sources,
  metroId,
  scope,
  persona,
}: BridgeGenerateParams) {
  const results: Array<{
    source: ContentSource;
    packageId: string;
    deliverables: Array<{ id: string; type: string; platform: string | null; content: string }>;
  }> = [];

  for (const source of sources) {
    const result = await generateContentPackage({
      metroId,
      sourceType: source.type,
      sourceId: source.id,
      sourceTitle: source.name,
      sourceExcerpt: source.excerpt || null,
      sourceImageUrl: source.imageUrl || null,
      createdBy: persona,
      scope,
      personaName: persona,
    });

    results.push({
      source,
      packageId: result.package.id,
      deliverables: result.deliverables.map((d) => ({
        id: d.id,
        type: d.type,
        platform: d.platform,
        content: d.content,
      })),
    });
  }

  return results;
}
