import { db } from "../db";
import { metroProjects, metroLaunchProjects } from "@shared/schema";
import { eq } from "drizzle-orm";

interface LaunchChecklist {
  setup: string[];
  content: string[];
  outreach: string[];
  monetization: string[];
}

interface ComingSoonConfig {
  title: string;
  description: string;
  ctaBlocks: string[];
}

function generateChecklist(): LaunchChecklist {
  return {
    setup: ["define regions", "seed hubs", "configure zones", "set up territory pricing"],
    content: ["create starter articles", "seed local events", "configure feed sources"],
    outreach: ["build business list", "identify community leaders", "draft welcome emails"],
    monetization: ["identify sponsors", "set up pricing tiers", "configure payment flows"],
  };
}

function generateComingSoonConfig(metroName: string): ComingSoonConfig {
  return {
    title: `Coming Soon: ${metroName}`,
    description: `${metroName} Metro Hub is launching soon. Be among the first businesses, creators, and sponsors to join the local platform that connects your community.`,
    ctaBlocks: [
      "business interest",
      "creator interest",
      "sponsor interest",
    ],
  };
}

export async function openMetro({ name, slug }: { name: string; slug: string }) {
  const existing = await db
    .select()
    .from(metroProjects)
    .where(eq(metroProjects.slug, slug))
    .limit(1);

  if (existing.length > 0) {
    throw new Error(`Metro with slug "${slug}" already exists`);
  }

  const checklist = generateChecklist();
  const comingSoonConfig = generateComingSoonConfig(name);

  return await db.transaction(async (tx) => {
    const [metro] = await tx
      .insert(metroProjects)
      .values({ name, slug, status: "coming_soon", comingSoonConfig: comingSoonConfig })
      .returning();

    const [launchProject] = await tx
      .insert(metroLaunchProjects)
      .values({
        metroId: metro.id,
        status: "coming_soon",
        checklistJson: checklist,
        notes: `Launch project created for ${name}`,
      })
      .returning();

    return {
      metro,
      launchProject,
      comingSoon: comingSoonConfig,
    };
  });
}
