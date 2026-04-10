import type { Express, Request, Response } from "express";
import { db } from "./db";
import {
  articles, events, jobs, businessContacts, communicationLog,
  captureSessionItems, entityContactVerification, entityFieldHistory,
  crmContacts, businesses,
} from "@shared/schema";
import { eq, and, desc, sql, or } from "drizzle-orm";

export function registerUnifiedActivityRoutes(app: Express, requireAdmin: any) {

  app.get("/api/admin/businesses/:id/activity/articles", requireAdmin, async (req: Request, res: Response) => {
    try {
      const bizId = req.params.id;
      const rows = await db.select({
        id: articles.id,
        title: articles.title,
        slug: articles.slug,
        excerpt: articles.excerpt,
        imageUrl: articles.imageUrl,
        publishedAt: articles.publishedAt,
        createdAt: articles.createdAt,
      }).from(articles)
        .where(sql`${bizId} = ANY(${articles.mentionedBusinessIds})`)
        .orderBy(desc(articles.createdAt))
        .limit(50);
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/businesses/:id/activity/events", requireAdmin, async (req: Request, res: Response) => {
    try {
      const bizId = req.params.id;
      const rows = await db.select({
        id: events.id,
        title: events.title,
        slug: events.slug,
        startDateTime: events.startDateTime,
        endDateTime: events.endDateTime,
        locationName: events.locationName,
        imageUrl: events.imageUrl,
        isSponsored: events.isSponsored,
        hostBusinessId: events.hostBusinessId,
        venuePresenceId: events.venuePresenceId,
      }).from(events)
        .where(or(
          eq(events.hostBusinessId, bizId),
          eq(events.venuePresenceId, bizId),
          sql`${bizId} = ANY(${events.sponsorBusinessIds})`,
        )!)
        .orderBy(desc(events.startDateTime))
        .limit(50);
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/businesses/:id/activity/jobs", requireAdmin, async (req: Request, res: Response) => {
    try {
      const bizId = req.params.id;
      const rows = await db.select({
        id: jobs.id,
        title: jobs.title,
        employer: jobs.employer,
        employmentType: jobs.employmentType,
        jobStatus: jobs.jobStatus,
        postedAt: jobs.postedAt,
        closesAt: jobs.closesAt,
        locationText: jobs.locationText,
      }).from(jobs)
        .where(eq(jobs.businessId, bizId))
        .orderBy(desc(jobs.postedAt))
        .limit(50);
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/businesses/:id/activity/contacts", requireAdmin, async (req: Request, res: Response) => {
    try {
      const bizId = req.params.id;
      const contacts = await db.select({
        id: businessContacts.id,
        name: businessContacts.name,
        role: businessContacts.role,
        title: businessContacts.title,
        email: businessContacts.email,
        phone: businessContacts.phone,
        isPrimary: businessContacts.isPrimary,
        crmContactId: businessContacts.crmContactId,
        createdAt: businessContacts.createdAt,
      }).from(businessContacts)
        .where(eq(businessContacts.businessId, bizId))
        .orderBy(desc(businessContacts.createdAt));

      const enriched = [];
      for (const c of contacts) {
        let crmContact = null;
        if (c.crmContactId) {
          const [crm] = await db.select({
            id: crmContacts.id,
            name: crmContacts.name,
            email: crmContacts.email,
            phone: crmContacts.phone,
            company: crmContacts.company,
            category: crmContacts.category,
            photoUrl: crmContacts.photoUrl,
          }).from(crmContacts).where(eq(crmContacts.id, c.crmContactId));
          crmContact = crm || null;
        }
        enriched.push({ ...c, crmContact });
      }
      res.json(enriched);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/businesses/:id/activity/communications", requireAdmin, async (req: Request, res: Response) => {
    try {
      const bizId = req.params.id;
      const rows = await db.select().from(communicationLog)
        .where(eq(communicationLog.businessId, bizId))
        .orderBy(desc(communicationLog.createdAt))
        .limit(100);
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/businesses/:id/activity/captures", requireAdmin, async (req: Request, res: Response) => {
    try {
      const bizId = req.params.id;
      const rows = await db.select().from(captureSessionItems)
        .where(or(
          eq(captureSessionItems.businessId, bizId),
          eq(captureSessionItems.matchedEntityId, bizId),
        )!)
        .orderBy(desc(captureSessionItems.createdAt))
        .limit(50);
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/businesses/:id/activity/enrichment-history", requireAdmin, async (req: Request, res: Response) => {
    try {
      const bizId = req.params.id;
      const [verification, fieldHistory] = await Promise.all([
        db.select().from(entityContactVerification)
          .where(eq(entityContactVerification.entityId, bizId))
          .orderBy(desc(entityContactVerification.crawledAt))
          .limit(10),
        db.select().from(entityFieldHistory)
          .where(eq(entityFieldHistory.entityId, bizId))
          .orderBy(desc(entityFieldHistory.changedAt))
          .limit(50),
      ]);
      res.json({ verification, fieldHistory });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/contacts/:id/activity/businesses", requireAdmin, async (req: Request, res: Response) => {
    try {
      const contactId = req.params.id;
      const links = await db.select({
        id: businessContacts.id,
        businessId: businessContacts.businessId,
        role: businessContacts.role,
        title: businessContacts.title,
        isPrimary: businessContacts.isPrimary,
        createdAt: businessContacts.createdAt,
      }).from(businessContacts)
        .where(eq(businessContacts.crmContactId, contactId))
        .orderBy(desc(businessContacts.createdAt));

      const enriched = [];
      for (const link of links) {
        const [biz] = await db.select({
          id: businesses.id,
          name: businesses.name,
          address: businesses.address,
          city: businesses.city,
          state: businesses.state,
          phone: businesses.phone,
          websiteUrl: businesses.websiteUrl,
          listingTier: businesses.listingTier,
          claimStatus: businesses.claimStatus,
        }).from(businesses).where(eq(businesses.id, link.businessId));
        enriched.push({ ...link, business: biz || null });
      }

      const [crmContact] = await db.select({ linkedBusinessId: crmContacts.linkedBusinessId })
        .from(crmContacts).where(eq(crmContacts.id, contactId));
      if (crmContact?.linkedBusinessId) {
        const alreadyLinked = enriched.some(e => e.businessId === crmContact.linkedBusinessId);
        if (!alreadyLinked) {
          const [biz] = await db.select({
            id: businesses.id,
            name: businesses.name,
            address: businesses.address,
            city: businesses.city,
            state: businesses.state,
            phone: businesses.phone,
            websiteUrl: businesses.websiteUrl,
            listingTier: businesses.listingTier,
            claimStatus: businesses.claimStatus,
          }).from(businesses).where(eq(businesses.id, crmContact.linkedBusinessId));
          if (biz) {
            enriched.push({
              id: null,
              businessId: crmContact.linkedBusinessId,
              role: "LINKED",
              title: null,
              isPrimary: false,
              createdAt: null,
              business: biz,
            });
          }
        }
      }

      res.json(enriched);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/contacts/:id/activity/communications", requireAdmin, async (req: Request, res: Response) => {
    try {
      const contactId = req.params.id;
      const rows = await db.select().from(communicationLog)
        .where(eq(communicationLog.crmContactId, contactId))
        .orderBy(desc(communicationLog.createdAt))
        .limit(100);
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/contacts/:id/activity/captures", requireAdmin, async (req: Request, res: Response) => {
    try {
      const contactId = req.params.id;
      const rows = await db.select().from(captureSessionItems)
        .where(eq(captureSessionItems.crmContactId, contactId))
        .orderBy(desc(captureSessionItems.createdAt))
        .limit(50);
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/contacts/:id/activity/articles", requireAdmin, async (req: Request, res: Response) => {
    try {
      const contactId = req.params.id;
      const [contact] = await db.select({ linkedBusinessId: crmContacts.linkedBusinessId, company: crmContacts.company })
        .from(crmContacts).where(eq(crmContacts.id, contactId));

      if (!contact?.linkedBusinessId) {
        return res.json([]);
      }

      const rows = await db.select({
        id: articles.id,
        title: articles.title,
        slug: articles.slug,
        excerpt: articles.excerpt,
        imageUrl: articles.imageUrl,
        publishedAt: articles.publishedAt,
        createdAt: articles.createdAt,
      }).from(articles)
        .where(sql`${contact.linkedBusinessId} = ANY(${articles.mentionedBusinessIds})`)
        .orderBy(desc(articles.createdAt))
        .limit(50);
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });
}
