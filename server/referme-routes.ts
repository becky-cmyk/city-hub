import type { Express, Request, Response } from "express";
import { db } from "./db";
import { referralTriangles, crmContacts, insertReferralTriangleSchema } from "@shared/schema";
import { eq, and, or, desc, sql } from "drizzle-orm";

export function registerRefermeRoutes(app: Express, requireAdmin: any) {
  app.get("/api/referral-triangles", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      const { filter } = req.query;

      let conditions = [eq(referralTriangles.userId, userId)];
      if (filter === "active") {
        conditions.push(
          or(
            eq(referralTriangles.status, "submitted"),
            eq(referralTriangles.status, "contacted"),
            eq(referralTriangles.status, "connected"),
            eq(referralTriangles.status, "in_progress"),
          )!
        );
      } else if (filter === "completed") {
        conditions.push(eq(referralTriangles.status, "completed"));
      } else if (filter === "declined") {
        conditions.push(eq(referralTriangles.status, "declined"));
      }

      const triangles = await db.select().from(referralTriangles)
        .where(and(...conditions))
        .orderBy(desc(referralTriangles.createdAt));

      const contactIds = new Set<string>();
      triangles.forEach(t => {
        contactIds.add(t.personAId);
        contactIds.add(t.personBId);
      });

      let contactsMap: Record<string, any> = {};
      if (contactIds.size > 0) {
        const contacts = await db.select().from(crmContacts)
          .where(and(
            eq(crmContacts.userId, userId),
            or(...[...contactIds].map(id => eq(crmContacts.id, id)))!
          ));
        contacts.forEach(c => { contactsMap[c.id] = c; });
      }

      const enriched = triangles.map(t => ({
        ...t,
        personA: contactsMap[t.personAId] || null,
        personB: contactsMap[t.personBId] || null,
      }));

      res.json({ data: enriched });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/referral-triangles/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      const [triangle] = await db.select().from(referralTriangles)
        .where(and(eq(referralTriangles.id, req.params.id), eq(referralTriangles.userId, userId)));
      if (!triangle) return res.status(404).json({ message: "Referral not found" });

      const contacts = await db.select().from(crmContacts)
        .where(and(
          eq(crmContacts.userId, userId),
          or(eq(crmContacts.id, triangle.personAId), eq(crmContacts.id, triangle.personBId))!
        ));
      const contactsMap: Record<string, any> = {};
      contacts.forEach(c => { contactsMap[c.id] = c; });

      res.json({
        ...triangle,
        personA: contactsMap[triangle.personAId] || null,
        personB: contactsMap[triangle.personBId] || null,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/referral-triangles/by-contact/:contactId", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      const { contactId } = req.params;

      const triangles = await db.select().from(referralTriangles)
        .where(and(
          eq(referralTriangles.userId, userId),
          or(eq(referralTriangles.personAId, contactId), eq(referralTriangles.personBId, contactId))!
        ))
        .orderBy(desc(referralTriangles.createdAt));

      res.json({ data: triangles });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/referral-triangles", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      const { personAId, personBId } = req.body;

      if (personAId === personBId) {
        return res.status(400).json({ message: "Person A and Person B must be different contacts" });
      }

      const contacts = await db.select().from(crmContacts)
        .where(and(
          eq(crmContacts.userId, userId),
          or(eq(crmContacts.id, personAId), eq(crmContacts.id, personBId))!
        ));

      if (contacts.length !== 2) {
        return res.status(400).json({ message: "Both contacts must exist and belong to you" });
      }

      const parsed = insertReferralTriangleSchema.parse({
        ...req.body,
        userId,
        sentAt: new Date(),
        statusUpdatedAt: new Date(),
      });

      const [triangle] = await db.insert(referralTriangles).values(parsed).returning();
      res.status(201).json(triangle);
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ message: "Validation error", errors: e.errors });
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/referral-triangles/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      const [existing] = await db.select().from(referralTriangles)
        .where(and(eq(referralTriangles.id, req.params.id), eq(referralTriangles.userId, userId)));
      if (!existing) return res.status(404).json({ message: "Referral not found" });

      const { status, outcomeNotes, sharedMessage, privateMessageToA, privateMessageToB } = req.body;
      const updateData: any = {};
      if (status) {
        updateData.status = status;
        updateData.statusUpdatedAt = new Date();
      }
      if (outcomeNotes !== undefined) updateData.outcomeNotes = outcomeNotes;
      if (sharedMessage !== undefined) updateData.sharedMessage = sharedMessage;
      if (privateMessageToA !== undefined) updateData.privateMessageToA = privateMessageToA;
      if (privateMessageToB !== undefined) updateData.privateMessageToB = privateMessageToB;

      const [updated] = await db.update(referralTriangles)
        .set(updateData)
        .where(and(eq(referralTriangles.id, req.params.id), eq(referralTriangles.userId, userId)))
        .returning();
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });
}
