import type { Express, Request, Response } from "express";
import { db } from "./db";
import { localPodcasts, localPodcastEpisodes, insertLocalPodcastSchema, insertLocalPodcastEpisodeSchema } from "@shared/schema";
import { eq, and, desc, asc, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 100);
}

const submitPodcastSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  rssUrl: z.string().optional().nullable(),
  websiteUrl: z.string().optional().nullable(),
  applePodcastUrl: z.string().optional().nullable(),
  spotifyUrl: z.string().optional().nullable(),
  hostName: z.string().optional().nullable(),
  hostEmail: z.string().optional().nullable(),
  cityId: z.string().optional().nullable(),
  hubSlug: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  submittedByEmail: z.string().optional().nullable(),
});

const updatePodcastSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  rssUrl: z.string().optional().nullable(),
  websiteUrl: z.string().optional().nullable(),
  applePodcastUrl: z.string().optional().nullable(),
  spotifyUrl: z.string().optional().nullable(),
  hostName: z.string().optional().nullable(),
  hostEmail: z.string().optional().nullable(),
  cityId: z.string().optional().nullable(),
  hubSlug: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  featured: z.boolean().optional(),
  subscriberCount: z.number().int().optional(),
});

const addEpisodeSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  audioUrl: z.string().optional().nullable(),
  externalUrl: z.string().optional().nullable(),
  publishedAt: z.string().optional().nullable(),
  durationSeconds: z.number().int().optional().nullable(),
  episodeNumber: z.number().int().optional().nullable(),
  seasonNumber: z.number().int().optional().nullable(),
});

export function registerPodcastDirectoryRoutes(app: Express, requireAdmin: any) {
  app.post("/api/podcasts/submit", async (req: Request, res: Response) => {
    try {
      const parsed = submitPodcastSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      }
      const slug = generateSlug(parsed.data.name);
      const existing = await db.select({ id: localPodcasts.id }).from(localPodcasts).where(eq(localPodcasts.slug, slug)).limit(1);
      const finalSlug = existing.length > 0 ? `${slug}-${Date.now()}` : slug;

      const [created] = await db.insert(localPodcasts).values({
        ...parsed.data,
        slug: finalSlug,
        status: "pending",
        featured: false,
        subscriberCount: 0,
      }).returning();
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/podcasts", async (req: Request, res: Response) => {
    try {
      const { category, q, cityId, featured } = req.query;
      const conditions: any[] = [eq(localPodcasts.status, "approved")];
      if (category) conditions.push(eq(localPodcasts.category, String(category)));
      if (cityId) conditions.push(eq(localPodcasts.cityId, String(cityId)));
      if (featured === "true") conditions.push(eq(localPodcasts.featured, true));
      if (q) conditions.push(or(ilike(localPodcasts.name, `%${q}%`), ilike(localPodcasts.hostName, `%${q}%`)));

      const results = await db.select().from(localPodcasts)
        .where(and(...conditions))
        .orderBy(desc(localPodcasts.featured), desc(localPodcasts.createdAt));

      const enriched = await Promise.all(results.map(async (p) => {
        const episodes = await db.select({ id: localPodcastEpisodes.id }).from(localPodcastEpisodes)
          .where(eq(localPodcastEpisodes.podcastId, p.id));
        return { ...p, episodeCount: episodes.length };
      }));

      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/podcasts/:slug", async (req: Request, res: Response) => {
    try {
      const [podcast] = await db.select().from(localPodcasts)
        .where(and(eq(localPodcasts.slug, req.params.slug), eq(localPodcasts.status, "approved")))
        .limit(1);
      if (!podcast) return res.status(404).json({ message: "Podcast not found" });

      const episodes = await db.select().from(localPodcastEpisodes)
        .where(eq(localPodcastEpisodes.podcastId, podcast.id))
        .orderBy(desc(localPodcastEpisodes.publishedAt));

      res.json({ ...podcast, episodes, episodeCount: episodes.length });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/podcasts/:slug/episodes", async (req: Request, res: Response) => {
    try {
      const [podcast] = await db.select().from(localPodcasts)
        .where(eq(localPodcasts.slug, req.params.slug))
        .limit(1);
      if (!podcast) return res.status(404).json({ message: "Podcast not found" });

      const limit = Math.min(parseInt(String(req.query.limit)) || 20, 100);
      const offset = parseInt(String(req.query.offset)) || 0;

      const episodes = await db.select().from(localPodcastEpisodes)
        .where(eq(localPodcastEpisodes.podcastId, podcast.id))
        .orderBy(desc(localPodcastEpisodes.publishedAt))
        .limit(limit)
        .offset(offset);

      res.json({ episodes, podcastId: podcast.id, podcastName: podcast.name });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/podcasts", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { status, category, q, featured } = req.query;
      const conditions: any[] = [];
      if (status) conditions.push(eq(localPodcasts.status, String(status) as any));
      if (category) conditions.push(eq(localPodcasts.category, String(category)));
      if (featured === "true") conditions.push(eq(localPodcasts.featured, true));
      if (q) conditions.push(or(ilike(localPodcasts.name, `%${q}%`), ilike(localPodcasts.hostName, `%${q}%`)));

      const results = await db.select().from(localPodcasts)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(localPodcasts.createdAt));

      const enriched = await Promise.all(results.map(async (p) => {
        const episodes = await db.select({ id: localPodcastEpisodes.id }).from(localPodcastEpisodes)
          .where(eq(localPodcastEpisodes.podcastId, p.id));
        return { ...p, episodeCount: episodes.length };
      }));

      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/podcasts/:id/status", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { status } = req.body;
      if (!["pending", "approved", "rejected"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      const updateData: any = { status, updatedAt: new Date() };
      if (status === "approved") updateData.approvedAt = new Date();
      const [updated] = await db.update(localPodcasts)
        .set(updateData)
        .where(eq(localPodcasts.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Podcast not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/podcasts/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = updatePodcastSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      }
      const [updated] = await db.update(localPodcasts)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(localPodcasts.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Podcast not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/podcasts/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const [deleted] = await db.delete(localPodcasts)
        .where(eq(localPodcasts.id, req.params.id))
        .returning();
      if (!deleted) return res.status(404).json({ message: "Podcast not found" });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/podcasts/:id/episodes", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = addEpisodeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      }

      const [podcast] = await db.select({ id: localPodcasts.id }).from(localPodcasts)
        .where(eq(localPodcasts.id, req.params.id)).limit(1);
      if (!podcast) return res.status(404).json({ message: "Podcast not found" });

      const [episode] = await db.insert(localPodcastEpisodes).values({
        podcastId: req.params.id,
        title: parsed.data.title,
        description: parsed.data.description || null,
        audioUrl: parsed.data.audioUrl || null,
        externalUrl: parsed.data.externalUrl || null,
        publishedAt: parsed.data.publishedAt ? new Date(parsed.data.publishedAt) : null,
        durationSeconds: parsed.data.durationSeconds || null,
        episodeNumber: parsed.data.episodeNumber || null,
        seasonNumber: parsed.data.seasonNumber || null,
      }).returning();
      res.status(201).json(episode);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/podcasts/:id/import-rss", requireAdmin, async (req: Request, res: Response) => {
    try {
      const [podcast] = await db.select().from(localPodcasts)
        .where(eq(localPodcasts.id, req.params.id)).limit(1);
      if (!podcast) return res.status(404).json({ message: "Podcast not found" });

      const rssUrl = req.body.rssUrl || podcast.rssUrl;
      if (!rssUrl) return res.status(400).json({ message: "No RSS URL provided or configured" });

      const response = await fetch(rssUrl, {
        headers: { "User-Agent": "CLT-Metro-Hub/1.0" },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) return res.status(502).json({ message: `Failed to fetch RSS feed: ${response.status}` });

      const xmlText = await response.text();

      const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
      const rssItems: string[] = [];
      let match;
      while ((match = itemRegex.exec(xmlText)) !== null) {
        rssItems.push(match[1]);
      }

      if (rssItems.length === 0) return res.status(400).json({ message: "No items found in RSS feed" });

      const existingEpisodes = await db.select({ title: localPodcastEpisodes.title })
        .from(localPodcastEpisodes)
        .where(eq(localPodcastEpisodes.podcastId, podcast.id));
      const existingTitles = new Set(existingEpisodes.map((e) => e.title.toLowerCase()));

      function extractTag(xml: string, tag: string): string | null {
        const re = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
        const m = re.exec(xml);
        return m ? (m[1] || m[2] || "").trim() : null;
      }

      function extractAttr(xml: string, tag: string, attr: string): string | null {
        const re = new RegExp(`<${tag}[^>]*\\s${attr}=["']([^"']*)["']`, "i");
        const m = re.exec(xml);
        return m ? m[1] : null;
      }

      let imported = 0;
      for (const itemXml of rssItems) {
        const title = extractTag(itemXml, "title") || "";
        if (!title || existingTitles.has(title.toLowerCase())) continue;

        const audioUrl = extractAttr(itemXml, "enclosure", "url") || null;
        const description = extractTag(itemXml, "description") || extractTag(itemXml, "itunes:summary") || "";
        const pubDateStr = extractTag(itemXml, "pubDate");
        const pubDate = pubDateStr ? new Date(pubDateStr) : null;

        let durationSeconds: number | null = null;
        const itDuration = extractTag(itemXml, "itunes:duration");
        if (itDuration) {
          const parts = itDuration.split(":").map(Number);
          if (parts.length === 3) durationSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
          else if (parts.length === 2) durationSeconds = parts[0] * 60 + parts[1];
          else if (parts.length === 1 && !isNaN(parts[0])) durationSeconds = parts[0];
        }

        const episodeStr = extractTag(itemXml, "itunes:episode");
        const seasonStr = extractTag(itemXml, "itunes:season");
        const episodeNum = episodeStr ? parseInt(episodeStr) : null;
        const seasonNum = seasonStr ? parseInt(seasonStr) : null;
        const externalUrl = extractTag(itemXml, "link") || null;

        await db.insert(localPodcastEpisodes).values({
          podcastId: podcast.id,
          title,
          description: description?.substring(0, 5000) || null,
          audioUrl,
          externalUrl,
          publishedAt: pubDate && !isNaN(pubDate.getTime()) ? pubDate : null,
          durationSeconds,
          episodeNumber: episodeNum,
          seasonNumber: seasonNum,
        });
        imported++;
      }

      if (rssUrl !== podcast.rssUrl) {
        await db.update(localPodcasts).set({ rssUrl, updatedAt: new Date() }).where(eq(localPodcasts.id, podcast.id));
      }

      res.json({ imported, total: rssItems.length, skippedDuplicates: rssItems.length - imported });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/podcasts/:id/featured", requireAdmin, async (req: Request, res: Response) => {
    try {
      const [podcast] = await db.select().from(localPodcasts)
        .where(eq(localPodcasts.id, req.params.id)).limit(1);
      if (!podcast) return res.status(404).json({ message: "Podcast not found" });

      const [updated] = await db.update(localPodcasts)
        .set({ featured: !podcast.featured, updatedAt: new Date() })
        .where(eq(localPodcasts.id, req.params.id))
        .returning();
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
