import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { insertVendorSchema, insertVendorContactSchema, insertCrmEventSchema, insertEventVendorSchema } from "@shared/schema";
import { z } from "zod";

export function registerVendorRoutes(app: Express, requireAdmin: any) {
  // ===== VENDORS =====
  app.get("/api/admin/vendors", requireAdmin, async (req: Request, res: Response) => {
    try {
      const vendors = await storage.getVendors({
        status: req.query.status as string | undefined,
        vendorType: req.query.vendorType as string | undefined,
        q: req.query.q as string | undefined,
      });
      res.json(vendors);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/vendors/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const vendor = await storage.getVendorById(id);
      if (!vendor) return res.status(404).json({ message: "Not found" });
      const contacts = await storage.getVendorContacts(id);
      const events = await storage.getVendorEvents(id);
      res.json({ ...vendor, contacts, events });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/vendors", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = insertVendorSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
      const vendor = await storage.createVendor(parsed.data);
      res.json(vendor);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/admin/vendors/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = insertVendorSchema.partial().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
      const vendor = await storage.updateVendor(req.params.id as string, parsed.data);
      if (!vendor) return res.status(404).json({ message: "Not found" });
      res.json(vendor);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/admin/vendors/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await storage.deleteVendor(req.params.id as string);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ===== VENDOR CONTACTS =====
  app.get("/api/admin/vendors/:vendorId/contacts", requireAdmin, async (req: Request, res: Response) => {
    try {
      const contacts = await storage.getVendorContacts(req.params.vendorId as string);
      res.json(contacts);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/vendors/:vendorId/contacts", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = insertVendorContactSchema.safeParse({ ...req.body, vendorId: req.params.vendorId as string });
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
      const contact = await storage.createVendorContact(parsed.data);
      res.json(contact);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/admin/vendor-contacts/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = insertVendorContactSchema.partial().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
      const contact = await storage.updateVendorContact(req.params.id as string, parsed.data);
      if (!contact) return res.status(404).json({ message: "Not found" });
      res.json(contact);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/admin/vendor-contacts/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await storage.deleteVendorContact(req.params.id as string);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ===== CRM EVENTS =====
  app.get("/api/admin/crm-events", requireAdmin, async (req: Request, res: Response) => {
    try {
      const events = await storage.getCrmEvents({
        status: req.query.status as string | undefined,
        q: req.query.q as string | undefined,
      });
      res.json(events);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/crm-events/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const event = await storage.getCrmEventById(id);
      if (!event) return res.status(404).json({ message: "Not found" });
      const eventVendors = await storage.getEventVendors(id);
      res.json({ ...event, vendors: eventVendors });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/crm-events", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = insertCrmEventSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
      const event = await storage.createCrmEvent(parsed.data);
      res.json(event);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/admin/crm-events/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = insertCrmEventSchema.partial().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
      const event = await storage.updateCrmEvent(req.params.id as string, parsed.data);
      if (!event) return res.status(404).json({ message: "Not found" });
      res.json(event);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/admin/crm-events/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await storage.deleteCrmEvent(req.params.id as string);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ===== EVENT VENDORS =====
  app.get("/api/admin/crm-events/:eventId/vendors", requireAdmin, async (req: Request, res: Response) => {
    try {
      const eventVendors = await storage.getEventVendors(req.params.eventId as string);
      res.json(eventVendors);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/crm-events/:eventId/vendors", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = insertEventVendorSchema.safeParse({ ...req.body, crmEventId: req.params.eventId as string });
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
      const ev = await storage.createEventVendor(parsed.data);
      res.json(ev);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/admin/event-vendors/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = insertEventVendorSchema.partial().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
      const ev = await storage.updateEventVendor(req.params.id as string, parsed.data);
      if (!ev) return res.status(404).json({ message: "Not found" });
      res.json(ev);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/admin/event-vendors/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await storage.deleteEventVendor(req.params.id as string);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });
}
