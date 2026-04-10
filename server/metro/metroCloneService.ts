import { db } from "../db";
import { metroProjects, metroLaunchProjects, metroTemplates, metroLaunchChecklist, cities, zones, categories, tags, DEFAULT_CHECKLIST_ITEMS } from "@shared/schema";
import { eq, and } from "drizzle-orm";

interface CloneOptions {
  templateId: string;
  newMetroName: string;
  region?: string;
  state?: string;
  overrides?: {
    slug?: string;
    aiGuideName?: string;
  };
}

interface TemplateConfig {
  copy_hub_structure: boolean;
  copy_categories: boolean;
  copy_tags: boolean;
  copy_content_settings: boolean;
  copy_pricing: boolean;
  copy_ai_personas: boolean;
  copy_outreach_templates: boolean;
}

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function createMetroFromTemplate(options: CloneOptions) {
  const [template] = await db
    .select()
    .from(metroTemplates)
    .where(eq(metroTemplates.id, options.templateId))
    .limit(1);

  if (!template) {
    throw new Error(`Template "${options.templateId}" not found`);
  }

  if (template.status === "archived") {
    throw new Error(`Template "${template.name}" is archived`);
  }

  const config = (template.includesConfigJson || {}) as TemplateConfig;
  const slug = options.overrides?.slug || generateSlug(options.newMetroName);

  const existingMetro = await db
    .select({ id: metroProjects.id })
    .from(metroProjects)
    .where(eq(metroProjects.slug, slug))
    .limit(1);

  if (existingMetro.length > 0) {
    throw new Error(`Metro with slug "${slug}" already exists`);
  }

  const existingCity = await db
    .select({ id: cities.id, slug: cities.slug })
    .from(cities)
    .where(eq(cities.name, options.newMetroName))
    .limit(1);

  if (existingCity.length > 0) {
    throw new Error(`City "${options.newMetroName}" already exists (slug: ${existingCity[0].slug}). Use the existing city or choose a different name.`);
  }

  const existingCitySlug = await db
    .select({ id: cities.id })
    .from(cities)
    .where(eq(cities.slug, slug))
    .limit(1);

  if (existingCitySlug.length > 0) {
    throw new Error(`City with slug "${slug}" already exists. Choose a different slug.`);
  }

  return await db.transaction(async (tx) => {
    const [newCity] = await tx
      .insert(cities)
      .values({
        name: options.newMetroName,
        slug,
        isActive: false,
        aiGuideName: options.overrides?.aiGuideName || options.newMetroName,
      })
      .returning();

    const [metro] = await tx
      .insert(metroProjects)
      .values({
        name: options.newMetroName,
        slug,
        cityId: newCity.id,
        templateId: template.id,
        status: "coming_soon",
        comingSoonConfig: {
          title: `Coming Soon: ${options.newMetroName}`,
          description: `${options.newMetroName} Metro Hub is launching soon. Be among the first businesses, creators, and sponsors to join the local platform that connects your community.`,
          ctaBlocks: ["business interest", "creator interest", "sponsor interest"],
        },
      })
      .returning();

    const [launchProject] = await tx
      .insert(metroLaunchProjects)
      .values({
        metroId: metro.id,
        status: "coming_soon",
        checklistJson: {},
        notes: `Created from template: ${template.name}`,
      })
      .returning();

    const checklistItems = DEFAULT_CHECKLIST_ITEMS.map((item) => ({
      metroId: metro.id,
      itemKey: item.key,
      itemName: item.name,
      status: "pending" as const,
    }));

    await tx.insert(metroLaunchChecklist).values(checklistItems);

    let clonedZones = 0;
    let clonedCategories = 0;
    let clonedTags = 0;

    const baseCityId = template.baseMetroId;

    if (baseCityId && config.copy_hub_structure) {
      const baseZones = await tx
        .select()
        .from(zones)
        .where(eq(zones.cityId, baseCityId));

      for (const zone of baseZones) {
        await tx.insert(zones).values({
          cityId: newCity.id,
          name: zone.name,
          slug: `${slug}-${zone.slug}`,
          type: zone.type,
          county: options.region || zone.county,
          stateCode: options.state || zone.stateCode,
          isActive: true,
        }).onConflictDoNothing();
        clonedZones++;
      }
    }

    if (config.copy_categories) {
      const allCats = await tx.select({ id: categories.id }).from(categories);
      clonedCategories = allCats.length;
    }

    if (config.copy_tags) {
      const allTags = await tx.select({ id: tags.id }).from(tags);
      clonedTags = allTags.length;
    }

    const cloneManifest = {
      templateId: template.id,
      templateName: template.name,
      baseCityId,
      cloned: {
        zones: clonedZones,
        categories: clonedCategories > 0 ? `${clonedCategories} global categories shared` : 0,
        tags: clonedTags > 0 ? `${clonedTags} global tags shared` : 0,
        pricing: config.copy_pricing ? "flagged_for_setup" : "skipped",
        ai_personas: config.copy_ai_personas ? "flagged_for_setup" : "skipped",
        outreach_templates: config.copy_outreach_templates ? "flagged_for_setup" : "skipped",
      },
    };

    await tx
      .update(metroProjects)
      .set({ cloneManifest })
      .where(eq(metroProjects.id, metro.id));

    metro.cloneManifest = cloneManifest;

    return {
      metro,
      city: newCity,
      launchProject,
      template: { id: template.id, name: template.name },
      cloned: {
        zones: clonedZones,
        categories: clonedCategories,
        tags: clonedTags,
      },
      checklistItems: DEFAULT_CHECKLIST_ITEMS.length,
    };
  });
}

export async function getMetroChecklist(metroId: string) {
  const items = await db
    .select()
    .from(metroLaunchChecklist)
    .where(eq(metroLaunchChecklist.metroId, metroId));

  const total = items.length;
  const complete = items.filter((i) => i.status === "complete").length;
  const blocked = items.filter((i) => i.status === "blocked").length;
  const pending = items.filter((i) => i.status === "pending").length;

  return {
    items,
    progress: {
      total,
      complete,
      blocked,
      pending,
      percent: total > 0 ? Math.round((complete / total) * 100) : 0,
    },
  };
}

export async function updateChecklistItem(
  metroId: string,
  itemId: string,
  updates: { status?: "pending" | "complete" | "blocked"; notes?: string }
) {
  const [item] = await db
    .select()
    .from(metroLaunchChecklist)
    .where(and(eq(metroLaunchChecklist.id, itemId), eq(metroLaunchChecklist.metroId, metroId)))
    .limit(1);

  if (!item) {
    throw new Error(`Checklist item "${itemId}" not found for metro "${metroId}"`);
  }

  const [updated] = await db
    .update(metroLaunchChecklist)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(metroLaunchChecklist.id, itemId))
    .returning();

  return updated;
}

export async function updateMetroStatus(metroId: string, newStatus: string, confirmLive?: boolean) {
  if ((newStatus === "active" || newStatus === "soft_open") && !confirmLive) {
    throw new Error("Going live requires explicit confirmation. Set confirmLive=true to proceed.");
  }

  const [metro] = await db
    .select()
    .from(metroProjects)
    .where(eq(metroProjects.id, metroId))
    .limit(1);

  if (!metro) {
    throw new Error(`Metro "${metroId}" not found`);
  }

  const validTransitions: Record<string, string[]> = {
    idea: ["planned", "coming_soon"],
    planned: ["coming_soon", "building"],
    coming_soon: ["building", "paused"],
    building: ["soft_open", "coming_soon", "paused"],
    soft_open: ["active", "building", "paused"],
    active: ["paused"],
    paused: ["coming_soon", "building", "soft_open"],
  };

  const allowed = validTransitions[metro.status] || [];
  if (!allowed.includes(newStatus)) {
    throw new Error(`Cannot transition from "${metro.status}" to "${newStatus}". Allowed: ${allowed.join(", ")}`);
  }

  const [updated] = await db
    .update(metroProjects)
    .set({ status: newStatus as typeof metro.status, updatedAt: new Date() })
    .where(eq(metroProjects.id, metroId))
    .returning();

  await db
    .update(metroLaunchProjects)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(eq(metroLaunchProjects.metroId, metroId));

  if (newStatus === "active" && updated.cityId) {
    await db
      .update(cities)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(cities.id, updated.cityId));
  }

  return updated;
}
