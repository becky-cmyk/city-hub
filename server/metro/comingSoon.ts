import { eq } from "drizzle-orm";
import { db } from "../db";
import { metroProjects } from "@shared/schema";

interface ComingSoonConfig {
  title: string;
  description: string;
  ctaBlocks: string[];
}

export async function createComingSoonPage({ metroName, slug }: { metroName: string; slug: string }): Promise<ComingSoonConfig> {
  const config: ComingSoonConfig = {
    title: `Coming Soon: ${metroName}`,
    description: `${metroName} Metro Hub is launching soon. Be among the first businesses, creators, and sponsors to join the local platform that connects your community.`,
    ctaBlocks: [
      "business interest",
      "creator interest",
      "sponsor interest",
    ],
  };

  const result = await db
    .update(metroProjects)
    .set({ comingSoonConfig: config, updatedAt: new Date() })
    .where(eq(metroProjects.slug, slug))
    .returning({ id: metroProjects.id });

  if (result.length === 0) {
    throw new Error(`Metro project with slug "${slug}" not found`);
  }

  return config;
}
