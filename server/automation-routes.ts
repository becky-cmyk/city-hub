import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { insertAutomationRuleSchema } from "@shared/schema";

export function registerAutomationRoutes(app: Express, requireAdmin: any) {
  app.get("/api/admin/automation/rules", requireAdmin, async (req: Request, res: Response) => {
    try {
      const rules = await storage.getAutomationRules({
        cityId: req.query.cityId as string | undefined,
        triggerEvent: req.query.triggerEvent as string | undefined,
        isActive: req.query.isActive !== undefined ? req.query.isActive === "true" : undefined,
      });
      res.json(rules);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/automation/rules/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const rule = await storage.getAutomationRuleById(req.params.id);
      if (!rule) return res.status(404).json({ message: "Not found" });
      res.json(rule);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/automation/rules", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = insertAutomationRuleSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
      const rule = await storage.createAutomationRule(parsed.data);
      res.status(201).json(rule);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/admin/automation/rules/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = insertAutomationRuleSchema.partial().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
      const rule = await storage.updateAutomationRule(req.params.id, parsed.data);
      if (!rule) return res.status(404).json({ message: "Not found" });
      res.json(rule);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/admin/automation/rules/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await storage.deleteAutomationRule(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/automation/queue", requireAdmin, async (req: Request, res: Response) => {
    try {
      const items = await storage.getAutomationQueueItems({
        ruleId: req.query.ruleId as string | undefined,
        processed: req.query.processed !== undefined ? req.query.processed === "true" : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      });
      res.json(items);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/automation/logs", requireAdmin, async (req: Request, res: Response) => {
    try {
      const logs = await storage.getAutomationLogs({
        ruleId: req.query.ruleId as string | undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      });
      res.json(logs);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });
}
