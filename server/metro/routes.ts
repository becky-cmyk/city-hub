import type { Express, Request, Response } from "express";
import { openMetro } from "./launchWorkflow";
import { createMetroFromTemplate, getMetroChecklist, updateChecklistItem, updateMetroStatus } from "./metroCloneService";
import { getPlatformPrice } from "../stripe/platformPricing";
import { db } from "../db";
import { metroProjects, metroTemplates, metroLaunchChecklist, cities, getMetroMode } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

const openMetroSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
});

const createFromTemplateSchema = z.object({
  templateId: z.string().min(1),
  newMetroName: z.string().min(1),
  region: z.string().optional(),
  state: z.string().optional(),
  slug: z.string().regex(/^[a-z0-9-]+$/).optional(),
  aiGuideName: z.string().optional(),
});

const updateChecklistSchema = z.object({
  status: z.enum(["pending", "complete", "blocked"]).optional(),
  notes: z.string().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(["idea", "planned", "coming_soon", "building", "soft_open", "active", "paused"]),
  confirmLive: z.boolean().optional(),
});

export function registerMetroRoutes(app: Express, requireAdmin: any) {
  app.post("/api/test/open-metro", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = openMetroSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
      }

      const result = await openMetro(parsed.data);
      res.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to open metro";
      const isDuplicate = msg.includes("already exists") || msg.includes("unique constraint") || msg.includes("duplicate key");
      res.status(isDuplicate ? 409 : 500).json({ message: isDuplicate ? `Metro with this slug already exists` : msg });
    }
  });

  app.get("/api/test/platform-price", requireAdmin, async (req: Request, res: Response) => {
    try {
      const product = req.query.product as string;
      if (!product) {
        return res.status(400).json({ message: "Missing ?product= query parameter" });
      }

      const priceId = await getPlatformPrice({ productKey: product });
      res.json({ product, stripePriceId: priceId });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to resolve price";
      const status = msg.includes("not configured") ? 404 : 500;
      res.status(status).json({ message: msg });
    }
  });

  app.get("/api/admin/metro-templates", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const templates = await db
        .select()
        .from(metroTemplates)
        .where(eq(metroTemplates.status, "active"));
      res.json(templates);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to fetch templates";
      res.status(500).json({ message: msg });
    }
  });

  app.get("/api/admin/metros", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const metros = await db
        .select()
        .from(metroProjects)
        .orderBy(desc(metroProjects.createdAt));

      const results = await Promise.all(
        metros.map(async (metro) => {
          const checklist = await getMetroChecklist(metro.id);
          let cityName = null;
          if (metro.cityId) {
            const [city] = await db
              .select({ name: cities.name })
              .from(cities)
              .where(eq(cities.id, metro.cityId))
              .limit(1);
            cityName = city?.name || null;
          }
          return {
            ...metro,
            mode: getMetroMode(metro.status),
            cityName,
            checklistProgress: checklist.progress,
          };
        })
      );

      res.json(results);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to fetch metros";
      res.status(500).json({ message: msg });
    }
  });

  app.post("/api/admin/metros/create-from-template", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = createFromTemplateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
      }

      const result = await createMetroFromTemplate({
        templateId: parsed.data.templateId,
        newMetroName: parsed.data.newMetroName,
        region: parsed.data.region,
        state: parsed.data.state,
        overrides: {
          slug: parsed.data.slug,
          aiGuideName: parsed.data.aiGuideName,
        },
      });

      res.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create metro from template";
      const isDuplicate = msg.includes("already exists") || msg.includes("unique constraint") || msg.includes("duplicate key");
      res.status(isDuplicate ? 409 : 500).json({ message: msg });
    }
  });

  app.get("/api/admin/metros/:id/checklist", requireAdmin, async (req: Request, res: Response) => {
    try {
      const result = await getMetroChecklist(req.params.id);
      res.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to fetch checklist";
      res.status(500).json({ message: msg });
    }
  });

  app.patch("/api/admin/metros/:id/checklist/:itemId", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = updateChecklistSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
      }

      const updated = await updateChecklistItem(req.params.id, req.params.itemId, parsed.data);
      res.json(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update checklist item";
      const isNotFound = msg.includes("not found");
      res.status(isNotFound ? 404 : 500).json({ message: msg });
    }
  });

  app.patch("/api/admin/metros/:id/status", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = updateStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
      }

      const updated = await updateMetroStatus(req.params.id, parsed.data.status, parsed.data.confirmLive);
      res.json(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update metro status";
      const isValidation = msg.includes("Cannot transition") || msg.includes("requires explicit confirmation");
      res.status(isValidation ? 400 : 500).json({ message: msg });
    }
  });
}
