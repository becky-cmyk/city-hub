import type { Express, Request, Response } from "express";
import { db } from "./db";
import { crmContacts, referralTriangles, insertCrmContactSchema, contactFieldHistory } from "@shared/schema";
import { eq, and, or, ilike, sql, desc, inArray, isNull, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { enrichFromUrl } from "./intelligence/crawl/urlEnrichment";
import { resolvePreferredChannel } from "./communication-routes";

export function registerCrmContactsRoutes(app: Express, requireAdmin: any) {
  app.get("/api/crm/contacts", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      const { search, category, status, limit: lim, offset: off, showArchived, contact_type } = req.query;
      const limitVal = Math.min(parseInt(lim as string) || 50, 200);
      const offsetVal = parseInt(off as string) || 0;

      let conditions = [eq(crmContacts.userId, userId)];
      if (showArchived !== "true") {
        conditions.push(isNull(crmContacts.deletedAt));
      }
      if (status && status !== "all") {
        conditions.push(eq(crmContacts.status, status as string));
      }
      if (category && category !== "all") {
        conditions.push(eq(crmContacts.category, category as any));
      }
      if (contact_type && contact_type !== "all") {
        if (contact_type === "people") {
          conditions.push(or(isNull(crmContacts.company), eq(crmContacts.company, ""))!);
        } else if (contact_type === "organizations") {
          conditions.push(and(isNotNull(crmContacts.company), sql`${crmContacts.company} != ''`)!);
        } else if (contact_type === "nonprofits") {
          conditions.push(and(
            isNotNull(crmContacts.company),
            sql`${crmContacts.company} != ''`,
            or(
              ilike(crmContacts.company, '%nonprofit%'),
              ilike(crmContacts.company, '%non-profit%'),
              ilike(crmContacts.company, '%foundation%'),
              ilike(crmContacts.company, '%ministry%'),
              ilike(crmContacts.company, '%church%'),
              ilike(crmContacts.company, '%charity%'),
              ilike(crmContacts.company, '%501c%'),
              ilike(crmContacts.company, '%501(c)%'),
              ilike(crmContacts.notes, '%nonprofit%'),
              ilike(crmContacts.notes, '%non-profit%'),
            )!,
          )!);
        }
      }
      const scopeFilter = req.query.scope as string;
      if (scopeFilter === "platform") {
        conditions.push(or(eq(crmContacts.contactScope, "platform"), eq(crmContacts.contactScope, "both"))!);
      } else if (scopeFilter === "metro") {
        conditions.push(or(eq(crmContacts.contactScope, "metro"), eq(crmContacts.contactScope, "both"))!);
      }
      if (search) {
        const searchTerm = `%${search}%`;
        conditions.push(
          or(
            ilike(crmContacts.name, searchTerm),
            ilike(crmContacts.email, searchTerm),
            ilike(crmContacts.company, searchTerm),
            ilike(crmContacts.phone, searchTerm),
          )!
        );
      }

      const [contacts, countResult] = await Promise.all([
        db.select().from(crmContacts)
          .where(and(...conditions))
          .orderBy(desc(crmContacts.updatedAt))
          .limit(limitVal)
          .offset(offsetVal),
        db.select({ count: sql<number>`count(*)` }).from(crmContacts)
          .where(and(...conditions)),
      ]);

      res.json({ data: contacts, meta: { total: Number(countResult[0].count), limit: limitVal, offset: offsetVal } });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/crm/contacts/your-referrals", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      const referrals = await db.select().from(referralTriangles)
        .where(eq(referralTriangles.userId, userId))
        .orderBy(desc(referralTriangles.createdAt));

      const contactIds = new Set<string>();
      referrals.forEach(r => { contactIds.add(r.personAId); contactIds.add(r.personBId); });
      const ids = [...contactIds].filter(Boolean);

      let contacts: any[] = [];
      if (ids.length > 0) {
        contacts = await db.select().from(crmContacts).where(inArray(crmContacts.id, ids));
      }

      const safeContact = (c: any) => {
        if (c.userId === userId) return c;
        return { id: c.id, name: c.name, company: c.company, category: c.category };
      };

      const contactMap = new Map(contacts.map(c => [c.id, safeContact(c)]));
      const enrichedReferrals = referrals.map(r => ({
        referralId: r.id,
        status: r.status,
        referralType: r.referralType,
        sharedMessage: r.sharedMessage,
        createdAt: r.createdAt,
        personA: contactMap.get(r.personAId) || { id: r.personAId, name: "Unknown" },
        personB: contactMap.get(r.personBId) || { id: r.personBId, name: "Unknown" },
      }));

      res.json({ data: enrichedReferrals, total: enrichedReferrals.length });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/crm/contacts/referred-to-you", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      const userContacts = await db.select({ id: crmContacts.id }).from(crmContacts)
        .where(eq(crmContacts.userId, userId));
      const userContactIds = userContacts.map(c => c.id);

      if (userContactIds.length === 0) {
        return res.json({ data: [], total: 0 });
      }

      const referrals = await db.select().from(referralTriangles)
        .where(or(
          inArray(referralTriangles.personAId, userContactIds),
          inArray(referralTriangles.personBId, userContactIds),
        )!)
        .orderBy(desc(referralTriangles.createdAt));

      const incomingReferrals = referrals.filter(r => r.userId !== userId);

      const contactIds = new Set<string>();
      incomingReferrals.forEach(r => { contactIds.add(r.personAId); contactIds.add(r.personBId); });
      const ids = [...contactIds].filter(Boolean);

      let contacts: any[] = [];
      if (ids.length > 0) {
        contacts = await db.select().from(crmContacts).where(inArray(crmContacts.id, ids));
      }

      const safeContact = (c: any) => {
        if (c.userId === userId) return c;
        return { id: c.id, name: c.name, company: c.company, category: c.category };
      };

      const contactMap = new Map(contacts.map(c => [c.id, safeContact(c)]));
      const enrichedReferrals = incomingReferrals.map(r => ({
        referralId: r.id,
        status: r.status,
        referralType: r.referralType,
        sharedMessage: r.sharedMessage,
        createdAt: r.createdAt,
        personA: contactMap.get(r.personAId) || { id: r.personAId, name: "Unknown" },
        personB: contactMap.get(r.personBId) || { id: r.personBId, name: "Unknown" },
      }));

      res.json({ data: enrichedReferrals, total: enrichedReferrals.length });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/crm/contacts/counts", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      const { contact_type, scope: scopeFilter, status: statusFilter, category: categoryFilter } = req.query;

      let conditions: any[] = [eq(crmContacts.userId, userId), isNull(crmContacts.deletedAt)];

      if (statusFilter && statusFilter !== "all") {
        conditions.push(eq(crmContacts.status, statusFilter as string));
      }
      if (categoryFilter && categoryFilter !== "all") {
        conditions.push(eq(crmContacts.category, categoryFilter as any));
      }
      if (contact_type && contact_type !== "all") {
        if (contact_type === "people") {
          conditions.push(or(isNull(crmContacts.company), eq(crmContacts.company, ""))!);
        } else if (contact_type === "organizations") {
          conditions.push(and(isNotNull(crmContacts.company), sql`${crmContacts.company} != ''`)!);
        } else if (contact_type === "nonprofits") {
          conditions.push(and(
            isNotNull(crmContacts.company),
            sql`${crmContacts.company} != ''`,
            or(
              ilike(crmContacts.company, '%nonprofit%'),
              ilike(crmContacts.company, '%non-profit%'),
              ilike(crmContacts.company, '%foundation%'),
              ilike(crmContacts.company, '%ministry%'),
              ilike(crmContacts.company, '%church%'),
              ilike(crmContacts.company, '%charity%'),
              ilike(crmContacts.company, '%501c%'),
              ilike(crmContacts.company, '%501(c)%'),
              ilike(crmContacts.notes, '%nonprofit%'),
              ilike(crmContacts.notes, '%non-profit%'),
            )!,
          )!);
        }
      }
      if (scopeFilter === "platform") {
        conditions.push(or(eq(crmContacts.contactScope, "platform"), eq(crmContacts.contactScope, "both"))!);
      } else if (scopeFilter === "metro") {
        conditions.push(or(eq(crmContacts.contactScope, "metro"), eq(crmContacts.contactScope, "both"))!);
      }

      const allContacts = await db.select({
        id: crmContacts.id,
        status: crmContacts.status,
        category: crmContacts.category,
        isFavorite: crmContacts.isFavorite,
      }).from(crmContacts).where(and(...conditions));

      const counts: Record<string, number> = {
        inbox: 0,
        all: allContacts.length,
        favorites: 0,
        want_to_meet: 0,
        potential_client: 0,
        current_client: 0,
        trusted: 0,
        met: 0,
        partners: 0,
      };

      for (const c of allContacts) {
        if (c.status === "inbox") counts.inbox++;
        if (c.isFavorite) counts.favorites++;
        if (c.category && counts[c.category] !== undefined) counts[c.category]++;
      }

      const referralsGiven = await db.select({ id: referralTriangles.id })
        .from(referralTriangles)
        .where(eq(referralTriangles.userId, userId));
      counts.your_referrals = referralsGiven.length;

      const userContactIds = allContacts.map(c => c.id);
      if (userContactIds.length > 0) {
        const referralsReceived = await db.select({ id: referralTriangles.id })
          .from(referralTriangles)
          .where(and(
            or(
              inArray(referralTriangles.personAId, userContactIds),
              inArray(referralTriangles.personBId, userContactIds),
            )!,
            sql`${referralTriangles.userId} != ${userId}`,
          )!);
        counts.referred_to_you = referralsReceived.length;
      } else {
        counts.referred_to_you = 0;
      }

      res.json(counts);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/crm/contacts/check-duplicates", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      const { name, email, phone, excludeId } = req.query;
      let conditions: any[] = [eq(crmContacts.userId, userId), isNull(crmContacts.deletedAt)];

      if (excludeId) {
        conditions.push(sql`${crmContacts.id} != ${excludeId}`);
      }

      let matchConditions: any[] = [];

      if (name) matchConditions.push(ilike(crmContacts.name, `%${name}%`));
      if (email) matchConditions.push(ilike(crmContacts.email, email as string));
      if (phone) matchConditions.push(eq(crmContacts.phone, phone as string));

      if (matchConditions.length === 0) {
        return res.json({ duplicates: [] });
      }

      conditions.push(or(...matchConditions)!);
      const rawDuplicates = await db.select().from(crmContacts).where(and(...conditions)).limit(10);

      const duplicates = rawDuplicates.map((dup) => {
        const reasons: string[] = [];
        if (email && dup.email && dup.email.toLowerCase() === (email as string).toLowerCase()) reasons.push("email");
        if (phone && dup.phone && dup.phone.replace(/\D/g, "") === (phone as string).replace(/\D/g, "")) reasons.push("phone");
        if (name && dup.name && dup.name.toLowerCase().includes((name as string).toLowerCase())) reasons.push("name");
        return { ...dup, matchReason: reasons.join(", ") || "name" };
      });

      res.json({ duplicates });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/crm/contacts/merge", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      const { survivorId, duplicateId } = req.body;
      if (!survivorId || !duplicateId) {
        return res.status(400).json({ message: "survivorId and duplicateId are required" });
      }
      if (survivorId === duplicateId) {
        return res.status(400).json({ message: "Cannot merge a contact with itself" });
      }

      const [survivor] = await db.select().from(crmContacts)
        .where(and(eq(crmContacts.id, survivorId), eq(crmContacts.userId, userId)));
      const [duplicate] = await db.select().from(crmContacts)
        .where(and(eq(crmContacts.id, duplicateId), eq(crmContacts.userId, userId)));

      if (!survivor || !duplicate) {
        return res.status(404).json({ message: "One or both contacts not found" });
      }

      const mergeFields = [
        "email", "phone", "company", "jobTitle", "website", "address",
        "photoUrl", "businessCardImageUrl", "businessCardBackImageUrl",
        "documentImageUrl", "handwritingImageUrl", "audioRecordingUrl",
        "audioTranscription", "qrLinkUrl", "qrRawText", "birthday",
        "anniversary", "linkedBusinessId", "preferredLanguage",
      ] as const;

      const updateFields: any = {};
      const historyEntries: Array<{ contactId: string; fieldName: string; oldValue: string | null; newValue: string | null; changedBy: string; source: string }> = [];

      for (const field of mergeFields) {
        const survivorVal = (survivor as any)[field];
        const duplicateVal = (duplicate as any)[field];
        if ((!survivorVal || survivorVal === "") && duplicateVal && duplicateVal !== "") {
          updateFields[field] = duplicateVal;
          historyEntries.push({
            contactId: survivorId,
            fieldName: field,
            oldValue: survivorVal != null ? String(survivorVal) : null,
            newValue: String(duplicateVal),
            changedBy: userId,
            source: "MERGE",
          });
        }
      }

      if (duplicate.notes && duplicate.notes.trim()) {
        const existingNotes = survivor.notes?.trim() || "";
        const mergedNotes = existingNotes
          ? `${existingNotes}\n\n--- Merged from ${duplicate.name} ---\n${duplicate.notes.trim()}`
          : duplicate.notes.trim();
        updateFields.notes = mergedNotes;
        historyEntries.push({
          contactId: survivorId,
          fieldName: "notes",
          oldValue: survivor.notes || null,
          newValue: mergedNotes,
          changedBy: userId,
          source: "MERGE",
        });
      }

      historyEntries.push({
        contactId: survivorId,
        fieldName: "_merge",
        oldValue: null,
        newValue: `Merged contact ${duplicateId} (${duplicate.name}) into this record`,
        changedBy: userId,
        source: "MERGE",
      });

      updateFields.updatedAt = new Date();
      const [updated] = await db.update(crmContacts)
        .set(updateFields)
        .where(eq(crmContacts.id, survivorId))
        .returning();

      if (historyEntries.length > 0) {
        await db.insert(contactFieldHistory).values(historyEntries);
      }

      const now = new Date();
      await db.update(crmContacts)
        .set({ deletedAt: now, status: "archived", updatedAt: now })
        .where(eq(crmContacts.id, duplicateId));

      await db.insert(contactFieldHistory).values({
        contactId: duplicateId,
        fieldName: "status",
        oldValue: duplicate.status,
        newValue: "archived (merged into " + survivorId + ")",
        changedBy: userId,
        source: "MERGE",
      });

      res.json({ merged: updated, removedId: duplicateId });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/crm/contacts/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      const [contact] = await db.select().from(crmContacts)
        .where(and(eq(crmContacts.id, req.params.id), eq(crmContacts.userId, userId)));
      if (!contact) return res.status(404).json({ message: "Contact not found" });
      res.json(contact);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/crm/contacts", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      const parsed = insertCrmContactSchema.parse({ ...req.body, userId });
      if (!parsed.preferredChannel) {
        parsed.preferredChannel = resolvePreferredChannel(parsed.email, parsed.phone);
      }
      const [contact] = await db.insert(crmContacts).values(parsed).returning();
      res.status(201).json(contact);
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ message: "Validation error", errors: e.errors });
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/crm/contacts/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      const [existing] = await db.select().from(crmContacts)
        .where(and(eq(crmContacts.id, req.params.id), eq(crmContacts.userId, userId)));
      if (!existing) return res.status(404).json({ message: "Contact not found" });

      const { name, email, phone, company, jobTitle, photoUrl, category, isFavorite, nudgeWindowDays, lastContactedAt, nudgeSnoozeUntil, nudgeSkippedToday, birthday, anniversary, notes, linkedBusinessId, status, website, address } = req.body;
      const updateFields: any = {};
      const trackedFields = ["name", "email", "phone", "company", "jobTitle", "photoUrl", "category", "status", "website", "address", "birthday", "anniversary", "notes", "linkedBusinessId", "nudgeWindowDays"];
      const historyEntries: Array<{ contactId: string; fieldName: string; oldValue: string | null; newValue: string | null; changedBy: string; source: string }> = [];
      const source = (req.body._source as string) || "MANUAL";

      if (name !== undefined) updateFields.name = name;
      if (email !== undefined) updateFields.email = email;
      if (status !== undefined) updateFields.status = status;
      if (website !== undefined) updateFields.website = website;
      if (address !== undefined) updateFields.address = address;
      if (phone !== undefined) updateFields.phone = phone;
      if (company !== undefined) updateFields.company = company;
      if (jobTitle !== undefined) updateFields.jobTitle = jobTitle;
      if (photoUrl !== undefined) updateFields.photoUrl = photoUrl;
      if (category !== undefined) updateFields.category = category;
      if (isFavorite !== undefined) updateFields.isFavorite = isFavorite;
      if (nudgeWindowDays !== undefined) updateFields.nudgeWindowDays = nudgeWindowDays;
      if (lastContactedAt !== undefined) updateFields.lastContactedAt = lastContactedAt ? new Date(lastContactedAt) : null;
      if (nudgeSnoozeUntil !== undefined) updateFields.nudgeSnoozeUntil = nudgeSnoozeUntil ? new Date(nudgeSnoozeUntil) : null;
      if (nudgeSkippedToday !== undefined) updateFields.nudgeSkippedToday = nudgeSkippedToday;
      if (birthday !== undefined) updateFields.birthday = birthday;
      if (anniversary !== undefined) updateFields.anniversary = anniversary;
      if (notes !== undefined) updateFields.notes = notes;
      if (linkedBusinessId !== undefined) updateFields.linkedBusinessId = linkedBusinessId;
      updateFields.updatedAt = new Date();

      for (const field of trackedFields) {
        if (req.body[field] !== undefined) {
          const oldVal = (existing as any)[field];
          const newVal = req.body[field];
          const oldStr = oldVal != null ? String(oldVal) : null;
          const newStr = newVal != null ? String(newVal) : null;
          if (oldStr !== newStr) {
            historyEntries.push({
              contactId: req.params.id,
              fieldName: field,
              oldValue: oldStr,
              newValue: newStr,
              changedBy: userId,
              source,
            });
          }
        }
      }

      const [updated] = await db.update(crmContacts)
        .set(updateFields)
        .where(and(eq(crmContacts.id, req.params.id), eq(crmContacts.userId, userId)))
        .returning();

      if (historyEntries.length > 0) {
        await db.insert(contactFieldHistory).values(historyEntries);
      }

      if (website !== undefined && website && website !== existing.website) {
        enrichFromUrl(website, "contact", req.params.id, userId).catch((err) => {
          console.error("[CRM] URL enrichment on contact update failed:", err);
        });
      }

      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/crm/contacts/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      const [existing] = await db.select().from(crmContacts)
        .where(and(eq(crmContacts.id, req.params.id), eq(crmContacts.userId, userId)));
      if (!existing) return res.status(404).json({ message: "Contact not found" });

      const now = new Date();
      await db.update(crmContacts)
        .set({ deletedAt: now, status: "archived", updatedAt: now })
        .where(eq(crmContacts.id, req.params.id));

      await db.insert(contactFieldHistory).values({
        contactId: req.params.id,
        fieldName: "status",
        oldValue: existing.status,
        newValue: "archived",
        changedBy: userId,
        source: "MANUAL",
      });

      res.json({ message: "Contact archived" });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/crm/contacts/:id/history", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      const [contact] = await db.select().from(crmContacts)
        .where(and(eq(crmContacts.id, req.params.id), eq(crmContacts.userId, userId)));
      if (!contact) return res.status(404).json({ message: "Contact not found" });

      const history = await db.select().from(contactFieldHistory)
        .where(eq(contactFieldHistory.contactId, req.params.id))
        .orderBy(desc(contactFieldHistory.changedAt));
      res.json({ data: history });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/crm/contacts/:id/restore", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      const [existing] = await db.select().from(crmContacts)
        .where(and(eq(crmContacts.id, req.params.id), eq(crmContacts.userId, userId)));
      if (!existing) return res.status(404).json({ message: "Contact not found" });

      const now = new Date();
      await db.update(crmContacts)
        .set({ deletedAt: null, status: "active", updatedAt: now })
        .where(eq(crmContacts.id, req.params.id));

      await db.insert(contactFieldHistory).values({
        contactId: req.params.id,
        fieldName: "status",
        oldValue: "archived",
        newValue: "active",
        changedBy: userId,
        source: "MANUAL",
      });

      res.json({ message: "Contact restored" });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });
}

