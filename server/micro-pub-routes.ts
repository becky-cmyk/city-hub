import type { Express, Request, Response } from "express";
import { db } from "./db";
import { eq, and, desc, asc } from "drizzle-orm";
import {
  microPublications, microPubIssues, microPubSections, microPubCommunityAds,
  insertMicroPublicationSchema, insertMicroPubIssueSchema,
  insertMicroPubSectionSchema, insertMicroPubCommunityAdSchema,
  cities,
} from "@shared/schema";
import type {
  MicroPublication, MicroPubIssue, MicroPubSection, MicroPubCommunityAd,
} from "@shared/schema";
import { z } from "zod";
import { storage } from "./storage";

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const POSITIONS: Array<"front1" | "front2" | "back1" | "back2" | "back3"> = [
  "front1", "front2", "back1", "back2", "back3",
];

const SECTION_TYPES: Array<"pets" | "family" | "senior" | "events" | "arts_entertainment"> = [
  "pets", "family", "senior", "events", "arts_entertainment",
];

export function registerMicroPubRoutes(
  app: Express,
  requireAdmin: (req: Request, res: Response, next: Function) => void,
) {

  app.get("/api/admin/micro-publications", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const pubs = await db.select().from(microPublications).orderBy(desc(microPublications.createdAt));
      res.json(pubs);
    } catch (err) {
      console.error("[MicroPub] list error:", err);
      res.status(500).json({ message: "Failed to fetch publications" });
    }
  });

  app.post("/api/admin/micro-publications", requireAdmin, async (req: Request, res: Response) => {
    try {
      const body = { ...req.body };
      if (!body.slug && body.name) body.slug = slugify(body.name);
      const parsed = insertMicroPublicationSchema.parse(body);
      const [pub] = await db.insert(microPublications).values(parsed).returning();
      res.json(pub);
    } catch (err) {
      console.error("[MicroPub] create error:", err);
      res.status(500).json({ message: "Failed to create publication" });
    }
  });

  const updatePubSchema = z.object({
    name: z.string().optional(),
    slug: z.string().optional(),
    description: z.string().nullable().optional(),
    coverImageUrl: z.string().nullable().optional(),
    isActive: z.boolean().optional(),
  });

  app.patch("/api/admin/micro-publications/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = updatePubSchema.parse(req.body);
      const [pub] = await db.update(microPublications)
        .set({ ...parsed, updatedAt: new Date() })
        .where(eq(microPublications.id, req.params.id))
        .returning();
      if (!pub) return res.status(404).json({ message: "Not found" });
      res.json(pub);
    } catch (err) {
      console.error("[MicroPub] update error:", err);
      res.status(500).json({ message: "Failed to update publication" });
    }
  });

  app.delete("/api/admin/micro-publications/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await db.delete(microPublications).where(eq(microPublications.id, req.params.id));
      res.json({ ok: true });
    } catch (err) {
      console.error("[MicroPub] delete error:", err);
      res.status(500).json({ message: "Failed to delete publication" });
    }
  });

  app.get("/api/admin/micro-publications/:pubId/issues", requireAdmin, async (req: Request, res: Response) => {
    try {
      const issues = await db.select().from(microPubIssues)
        .where(eq(microPubIssues.publicationId, req.params.pubId))
        .orderBy(desc(microPubIssues.issueNumber));
      res.json(issues);
    } catch (err) {
      console.error("[MicroPub] list issues error:", err);
      res.status(500).json({ message: "Failed to fetch issues" });
    }
  });

  app.post("/api/admin/micro-publications/:pubId/issues", requireAdmin, async (req: Request, res: Response) => {
    try {
      const existing = await db.select().from(microPubIssues)
        .where(eq(microPubIssues.publicationId, req.params.pubId))
        .orderBy(desc(microPubIssues.issueNumber));
      const nextNumber = existing.length > 0 ? existing[0].issueNumber + 1 : 1;

      const parsed = insertMicroPubIssueSchema.parse({
        ...req.body,
        publicationId: req.params.pubId,
        issueNumber: nextNumber,
      });
      const [issue] = await db.insert(microPubIssues).values(parsed).returning();

      const sectionValues = SECTION_TYPES.map((st, i) => ({
        issueId: issue.id,
        sectionType: st as typeof SECTION_TYPES[number],
        position: POSITIONS[i] as typeof POSITIONS[number],
      }));
      const sections = await db.insert(microPubSections).values(sectionValues).returning();

      res.json({ issue, sections });
    } catch (err) {
      console.error("[MicroPub] create issue error:", err);
      res.status(500).json({ message: "Failed to create issue" });
    }
  });

  const updateIssueSchema = z.object({
    title: z.string().optional(),
    status: z.enum(["draft", "published", "archived"]).optional(),
    publishDate: z.string().nullable().optional(),
    pickupLocations: z.array(z.object({ name: z.string(), address: z.string() })).optional(),
  });

  app.patch("/api/admin/micro-pub-issues/:issueId", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = updateIssueSchema.parse(req.body);
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (parsed.title !== undefined) updateData.title = parsed.title;
      if (parsed.status !== undefined) updateData.status = parsed.status;
      if (parsed.publishDate !== undefined) updateData.publishDate = parsed.publishDate ? new Date(parsed.publishDate) : null;
      if (parsed.pickupLocations !== undefined) updateData.pickupLocations = parsed.pickupLocations;
      const [issue] = await db.update(microPubIssues)
        .set(updateData)
        .where(eq(microPubIssues.id, req.params.issueId))
        .returning();
      if (!issue) return res.status(404).json({ message: "Not found" });
      res.json(issue);
    } catch (err) {
      console.error("[MicroPub] update issue error:", err);
      res.status(500).json({ message: "Failed to update issue" });
    }
  });

  app.delete("/api/admin/micro-pub-issues/:issueId", requireAdmin, async (req: Request, res: Response) => {
    try {
      await db.delete(microPubIssues).where(eq(microPubIssues.id, req.params.issueId));
      res.json({ ok: true });
    } catch (err) {
      console.error("[MicroPub] delete issue error:", err);
      res.status(500).json({ message: "Failed to delete issue" });
    }
  });

  app.get("/api/admin/micro-pub-issues/:issueId/sections", requireAdmin, async (req: Request, res: Response) => {
    try {
      const sections = await db.select().from(microPubSections)
        .where(eq(microPubSections.issueId, req.params.issueId))
        .orderBy(asc(microPubSections.position));
      res.json(sections);
    } catch (err) {
      console.error("[MicroPub] list sections error:", err);
      res.status(500).json({ message: "Failed to fetch sections" });
    }
  });

  const updateSectionSchema = z.object({
    storyTitle: z.string().nullable().optional(),
    storyBody: z.string().nullable().optional(),
    storyImageUrl: z.string().nullable().optional(),
    nonprofitName: z.string().nullable().optional(),
    nonprofitUrl: z.string().nullable().optional(),
    sponsorName: z.string().nullable().optional(),
    sponsorImageUrl: z.string().nullable().optional(),
    sponsorLink: z.string().nullable().optional(),
    sponsorLabel: z.string().nullable().optional(),
    sponsorBusinessId: z.string().nullable().optional(),
  });

  app.patch("/api/admin/micro-pub-sections/:sectionId", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = updateSectionSchema.parse(req.body);
      const [section] = await db.update(microPubSections)
        .set({ ...parsed, updatedAt: new Date() })
        .where(eq(microPubSections.id, req.params.sectionId))
        .returning();
      if (!section) return res.status(404).json({ message: "Not found" });
      res.json(section);
    } catch (err) {
      console.error("[MicroPub] update section error:", err);
      res.status(500).json({ message: "Failed to update section" });
    }
  });

  app.get("/api/admin/micro-pub-issues/:issueId/ads", requireAdmin, async (req: Request, res: Response) => {
    try {
      const ads = await db.select().from(microPubCommunityAds)
        .where(eq(microPubCommunityAds.issueId, req.params.issueId))
        .orderBy(asc(microPubCommunityAds.slotNumber));
      res.json(ads);
    } catch (err) {
      console.error("[MicroPub] list ads error:", err);
      res.status(500).json({ message: "Failed to fetch ads" });
    }
  });

  app.put("/api/admin/micro-pub-issues/:issueId/ads", requireAdmin, async (req: Request, res: Response) => {
    try {
      const ads = z.array(z.object({
        slotNumber: z.number(),
        businessId: z.string().nullable().optional(),
        businessName: z.string().nullable().optional(),
        imageUrl: z.string().nullable().optional(),
        link: z.string().nullable().optional(),
      })).parse(req.body);

      await db.delete(microPubCommunityAds).where(eq(microPubCommunityAds.issueId, req.params.issueId));

      if (ads.length > 0) {
        const values = ads.map(a => ({
          issueId: req.params.issueId,
          slotNumber: a.slotNumber,
          businessId: a.businessId || null,
          businessName: a.businessName || null,
          imageUrl: a.imageUrl || null,
          link: a.link || null,
        }));
        await db.insert(microPubCommunityAds).values(values);
      }

      const result = await db.select().from(microPubCommunityAds)
        .where(eq(microPubCommunityAds.issueId, req.params.issueId))
        .orderBy(asc(microPubCommunityAds.slotNumber));
      res.json(result);
    } catch (err) {
      console.error("[MicroPub] upsert ads error:", err);
      res.status(500).json({ message: "Failed to save ads" });
    }
  });

  app.post("/api/admin/micro-pub-issues/:issueId/clone", requireAdmin, async (req: Request, res: Response) => {
    try {
      const sourceIssue = await db.select().from(microPubIssues)
        .where(eq(microPubIssues.id, req.params.issueId));
      if (sourceIssue.length === 0) return res.status(404).json({ message: "Issue not found" });

      const src = sourceIssue[0];
      const existing = await db.select().from(microPubIssues)
        .where(eq(microPubIssues.publicationId, src.publicationId))
        .orderBy(desc(microPubIssues.issueNumber));
      const nextNumber = existing.length > 0 ? existing[0].issueNumber + 1 : 1;

      const [newIssue] = await db.insert(microPubIssues).values({
        publicationId: src.publicationId,
        issueNumber: nextNumber,
        title: `Issue #${nextNumber}`,
        status: "draft",
        pickupLocations: src.pickupLocations,
      }).returning();

      const sourceSections = await db.select().from(microPubSections)
        .where(eq(microPubSections.issueId, req.params.issueId))
        .orderBy(asc(microPubSections.position));

      const rotatedPositions = [...POSITIONS.slice(1), POSITIONS[0]];
      const posMap = Object.fromEntries(POSITIONS.map((p, i) => [p, rotatedPositions[i]]));

      if (sourceSections.length > 0) {
        const newSections = sourceSections.map(s => ({
          issueId: newIssue.id,
          sectionType: s.sectionType,
          position: (posMap[s.position] || s.position) as typeof POSITIONS[number],
          storyTitle: null as string | null,
          storyBody: null as string | null,
          storyImageUrl: null as string | null,
          nonprofitName: null as string | null,
          nonprofitUrl: null as string | null,
          sponsorBusinessId: s.sponsorBusinessId,
          sponsorName: s.sponsorName,
          sponsorImageUrl: s.sponsorImageUrl,
          sponsorLink: s.sponsorLink,
          sponsorLabel: s.sponsorLabel,
        }));
        await db.insert(microPubSections).values(newSections);
      }

      const sourceAds = await db.select().from(microPubCommunityAds)
        .where(eq(microPubCommunityAds.issueId, req.params.issueId));
      if (sourceAds.length > 0) {
        const newAds = sourceAds.map(a => ({
          issueId: newIssue.id,
          slotNumber: a.slotNumber,
          businessId: a.businessId,
          businessName: a.businessName,
          imageUrl: a.imageUrl,
          link: a.link,
        }));
        await db.insert(microPubCommunityAds).values(newAds);
      }

      const sections = await db.select().from(microPubSections)
        .where(eq(microPubSections.issueId, newIssue.id));
      res.json({ issue: newIssue, sections });
    } catch (err) {
      console.error("[MicroPub] clone error:", err);
      res.status(500).json({ message: "Failed to clone issue" });
    }
  });

  const sponsorClickSchema = z.object({
    sectionId: z.string().optional(),
    sponsorName: z.string().optional(),
    sponsorLink: z.string().optional(),
    adId: z.string().optional(),
    adBusinessName: z.string().optional(),
  }).refine(d => d.sectionId || d.adId, { message: "sectionId or adId required" });

  app.post("/api/micro-pub/sponsor-click", async (req: Request, res: Response) => {
    try {
      const parsed = sponsorClickSchema.parse(req.body);
      console.log(`[MicroPub] Sponsor click: section=${parsed.sectionId || ""} ad=${parsed.adId || ""} name=${parsed.sponsorName || parsed.adBusinessName || ""} link=${parsed.sponsorLink || ""}`);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ message: "Invalid click data" });
    }
  });

  app.get("/api/cities/:citySlug/pub/:pubSlug", async (req: Request, res: Response) => {
    try {
      const city = await storage.getCityBySlug(req.params.citySlug);
      if (!city) return res.status(404).json({ message: "City not found" });

      const pubs = await db.select().from(microPublications)
        .where(and(
          eq(microPublications.cityId, city.id),
          eq(microPublications.slug, req.params.pubSlug),
          eq(microPublications.isActive, true),
        ));
      if (pubs.length === 0) return res.status(404).json({ message: "Publication not found" });

      const pub = pubs[0];
      const issues = await db.select().from(microPubIssues)
        .where(and(
          eq(microPubIssues.publicationId, pub.id),
          eq(microPubIssues.status, "published"),
        ))
        .orderBy(desc(microPubIssues.issueNumber));

      const issuesWithContent = await Promise.all(issues.map(async (issue) => {
        const sections = await db.select().from(microPubSections)
          .where(eq(microPubSections.issueId, issue.id))
          .orderBy(asc(microPubSections.position));
        const ads = await db.select().from(microPubCommunityAds)
          .where(eq(microPubCommunityAds.issueId, issue.id))
          .orderBy(asc(microPubCommunityAds.slotNumber));
        return { ...issue, sections, communityAds: ads };
      }));

      res.json({ publication: pub, issues: issuesWithContent, city });
    } catch (err) {
      console.error("[MicroPub] public landing error:", err);
      res.status(500).json({ message: "Failed to load publication" });
    }
  });
}
