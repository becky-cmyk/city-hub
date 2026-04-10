import type { Express, Request, Response } from "express";
import { db } from "./db";
import { musicArtists, musicTracks, musicMoodPresets, venueAudioProfiles, tvScreens } from "@shared/schema";
import { eq, and, desc, asc, ilike, or, sql, inArray } from "drizzle-orm";
import { z } from "zod";

const submitArtistSchema = z.object({
  name: z.string().min(1),
  bio: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  genre: z.string().optional().nullable(),
  cityId: z.string().optional().nullable(),
  hubSlug: z.string().optional().nullable(),
  socialLinks: z.any().optional().nullable(),
  websiteUrl: z.string().optional().nullable(),
  submittedByEmail: z.string().email().optional().nullable(),
});

const updateArtistSchema = z.object({
  name: z.string().min(1).optional(),
  bio: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  genre: z.string().optional().nullable(),
  cityId: z.string().optional().nullable(),
  hubSlug: z.string().optional().nullable(),
  socialLinks: z.any().optional().nullable(),
  websiteUrl: z.string().optional().nullable(),
  featured: z.boolean().optional(),
  submittedByEmail: z.string().optional().nullable(),
});

const submitTrackSchema = z.object({
  artistId: z.string().min(1),
  title: z.string().min(1),
  audioUrl: z.string().optional().nullable(),
  durationSeconds: z.number().int().optional().nullable(),
  genre: z.string().optional().nullable(),
  albumName: z.string().optional().nullable(),
  coverArtUrl: z.string().optional().nullable(),
  licenseAgreedAt: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
  mood: z.array(z.string()).optional().default([]),
  energy: z.enum(["low", "medium", "high"]).optional().nullable(),
  bpmRange: z.string().optional().nullable(),
  cityId: z.string().optional().nullable(),
});

const updateTrackSchema = z.object({
  title: z.string().min(1).optional(),
  audioUrl: z.string().optional().nullable(),
  durationSeconds: z.number().int().optional().nullable(),
  genre: z.string().optional().nullable(),
  albumName: z.string().optional().nullable(),
  coverArtUrl: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  mood: z.array(z.string()).optional(),
  energy: z.enum(["low", "medium", "high"]).optional().nullable(),
  bpmRange: z.string().optional().nullable(),
  featured: z.boolean().optional(),
});

const moodPresetSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional().nullable(),
  moods: z.array(z.string()).default([]),
  genres: z.array(z.string()).default([]),
  energyLevels: z.array(z.string()).default([]),
  isDefault: z.boolean().optional().default(false),
  cityId: z.string().optional().nullable(),
  sortOrder: z.number().int().optional().default(0),
});

const venueProfileSchema = z.object({
  screenId: z.string().min(1),
  presetId: z.string().optional().nullable(),
  customMoods: z.array(z.string()).optional().default([]),
  customGenres: z.array(z.string()).optional().default([]),
  excludedGenres: z.array(z.string()).optional().default([]),
  excludedArtistIds: z.array(z.string()).optional().default([]),
  volumeLevel: z.enum(["low", "medium", "high"]).optional().default("medium"),
  musicEnabled: z.boolean().optional().default(true),
  talkSegmentsEnabled: z.boolean().optional().default(true),
  adSegmentsEnabled: z.boolean().optional().default(true),
  musicMixPercent: z.number().int().min(0).max(100).optional().default(70),
});

const venueProfileUpdateSchema = venueProfileSchema.partial().omit({ screenId: true });

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 100) + "-" + Date.now().toString(36);
}

export function registerMusicRoutes(app: Express, requireAdmin: any) {
  app.post("/api/music/artists/submit", async (req: Request, res: Response) => {
    try {
      const parsed = submitArtistSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      const slug = generateSlug(parsed.data.name);
      const [artist] = await db.insert(musicArtists).values({
        ...parsed.data,
        slug,
        status: "pending",
      }).returning();
      res.status(201).json(artist);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/music/artists", async (req: Request, res: Response) => {
    try {
      const { genre, q } = req.query;
      const conditions: any[] = [eq(musicArtists.status, "approved")];
      if (genre) conditions.push(eq(musicArtists.genre, genre as string));
      if (q) conditions.push(ilike(musicArtists.name, `%${q}%`));
      const artists = await db.select().from(musicArtists)
        .where(and(...conditions))
        .orderBy(desc(musicArtists.featured), asc(musicArtists.name));
      res.json(artists);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/music/artists/:slug", async (req: Request, res: Response) => {
    try {
      const [artist] = await db.select().from(musicArtists)
        .where(eq(musicArtists.slug, req.params.slug)).limit(1);
      if (!artist) return res.status(404).json({ message: "Artist not found" });
      const tracks = await db.select().from(musicTracks)
        .where(and(eq(musicTracks.artistId, artist.id), eq(musicTracks.status, "approved")))
        .orderBy(desc(musicTracks.featured), asc(musicTracks.title));
      res.json({ ...artist, tracks });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/music/tracks/submit", async (req: Request, res: Response) => {
    try {
      const parsed = submitTrackSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      const slug = generateSlug(parsed.data.title);
      const [track] = await db.insert(musicTracks).values({
        ...parsed.data,
        slug,
        status: "pending",
        licenseAgreedAt: parsed.data.licenseAgreedAt ? new Date(parsed.data.licenseAgreedAt) : null,
      }).returning();
      res.status(201).json(track);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/music/tracks", async (req: Request, res: Response) => {
    try {
      const { genre, artistId, mood, energy, q } = req.query;
      const conditions: any[] = [eq(musicTracks.status, "approved")];
      if (genre) conditions.push(eq(musicTracks.genre, genre as string));
      if (artistId) conditions.push(eq(musicTracks.artistId, artistId as string));
      if (energy) conditions.push(eq(musicTracks.energy, energy as any));
      if (q) conditions.push(ilike(musicTracks.title, `%${q}%`));
      if (mood) {
        const moodVal = Array.isArray(mood) ? mood : [mood];
        conditions.push(sql`${musicTracks.mood} && ARRAY[${sql.join(moodVal.map(m => sql`${m}`), sql`, `)}]::text[]`);
      }
      const tracks = await db.select().from(musicTracks)
        .where(and(...conditions))
        .orderBy(desc(musicTracks.featured), desc(musicTracks.playCount));
      res.json(tracks);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/music/tracks/:id/stream", async (req: Request, res: Response) => {
    try {
      const [track] = await db.select().from(musicTracks)
        .where(eq(musicTracks.id, req.params.id)).limit(1);
      if (!track) return res.status(404).json({ message: "Track not found" });
      await db.update(musicTracks)
        .set({ playCount: sql`${musicTracks.playCount} + 1` })
        .where(eq(musicTracks.id, req.params.id));
      if (track.audioUrl) {
        return res.redirect(track.audioUrl);
      }
      res.status(404).json({ message: "No audio file available" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/music/artists", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const { status, genre, q } = _req.query;
      const conditions: any[] = [];
      if (status) conditions.push(eq(musicArtists.status, status as any));
      if (genre) conditions.push(eq(musicArtists.genre, genre as string));
      if (q) conditions.push(ilike(musicArtists.name, `%${q}%`));
      const artists = await db.select().from(musicArtists)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(musicArtists.createdAt));
      res.json(artists);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/music/artists/:id/status", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { status } = req.body;
      if (!["pending", "approved", "rejected", "suspended"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      const updateData: any = { status, updatedAt: new Date() };
      if (status === "approved") updateData.approvedAt = new Date();
      const [updated] = await db.update(musicArtists)
        .set(updateData)
        .where(eq(musicArtists.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Artist not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/music/artists/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = updateArtistSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      const [updated] = await db.update(musicArtists)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(musicArtists.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Artist not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/music/artists/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const [deleted] = await db.delete(musicArtists)
        .where(eq(musicArtists.id, req.params.id))
        .returning();
      if (!deleted) return res.status(404).json({ message: "Artist not found" });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/music/tracks", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { status, genre, artistId, q } = req.query;
      const conditions: any[] = [];
      if (status) conditions.push(eq(musicTracks.status, status as any));
      if (genre) conditions.push(eq(musicTracks.genre, genre as string));
      if (artistId) conditions.push(eq(musicTracks.artistId, artistId as string));
      if (q) conditions.push(ilike(musicTracks.title, `%${q}%`));
      const tracks = await db.select().from(musicTracks)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(musicTracks.createdAt));
      res.json(tracks);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/music/tracks/:id/status", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { status } = req.body;
      if (!["pending", "approved", "rejected"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      const updateData: any = { status, updatedAt: new Date() };
      if (status === "approved") updateData.approvedAt = new Date();
      const [updated] = await db.update(musicTracks)
        .set(updateData)
        .where(eq(musicTracks.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Track not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/music/tracks/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = updateTrackSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      const [updated] = await db.update(musicTracks)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(musicTracks.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Track not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/music/tracks/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const [deleted] = await db.delete(musicTracks)
        .where(eq(musicTracks.id, req.params.id))
        .returning();
      if (!deleted) return res.status(404).json({ message: "Track not found" });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/music/tracks/:id/featured", requireAdmin, async (req: Request, res: Response) => {
    try {
      const [track] = await db.select().from(musicTracks)
        .where(eq(musicTracks.id, req.params.id)).limit(1);
      if (!track) return res.status(404).json({ message: "Track not found" });
      const [updated] = await db.update(musicTracks)
        .set({ featured: !track.featured, updatedAt: new Date() })
        .where(eq(musicTracks.id, req.params.id))
        .returning();
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/music/mood-presets", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const presets = await db.select().from(musicMoodPresets)
        .orderBy(asc(musicMoodPresets.sortOrder), asc(musicMoodPresets.name));
      res.json(presets);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/music/mood-presets", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = moodPresetSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      const [preset] = await db.insert(musicMoodPresets).values(parsed.data).returning();
      res.status(201).json(preset);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/music/mood-presets/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = moodPresetSchema.partial().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      const [updated] = await db.update(musicMoodPresets)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(musicMoodPresets.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Preset not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/music/mood-presets/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const [deleted] = await db.delete(musicMoodPresets)
        .where(eq(musicMoodPresets.id, req.params.id))
        .returning();
      if (!deleted) return res.status(404).json({ message: "Preset not found" });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/music/venue-profiles", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const profiles = await db.select({
        profile: venueAudioProfiles,
        screenName: tvScreens.venueName,
        screenKey: tvScreens.screenKey,
        hubSlug: tvScreens.hubSlug,
      })
        .from(venueAudioProfiles)
        .leftJoin(tvScreens, eq(venueAudioProfiles.screenId, tvScreens.id))
        .orderBy(desc(venueAudioProfiles.createdAt));
      const result = profiles.map(p => ({
        ...p.profile,
        venueName: p.screenName,
        screenKey: p.screenKey,
        hubSlug: p.hubSlug,
      }));
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/music/venue-profiles/:screenId", requireAdmin, async (req: Request, res: Response) => {
    try {
      const [profile] = await db.select().from(venueAudioProfiles)
        .where(eq(venueAudioProfiles.screenId, req.params.screenId)).limit(1);
      if (!profile) return res.status(404).json({ message: "Venue audio profile not found" });
      res.json(profile);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/music/venue-profiles", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = venueProfileSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      const [profile] = await db.insert(venueAudioProfiles).values(parsed.data).returning();
      res.status(201).json(profile);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/music/venue-profiles/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = venueProfileUpdateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      const [updated] = await db.update(venueAudioProfiles)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(venueAudioProfiles.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Profile not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/music/venue-profiles/:screenId/preview-playlist", requireAdmin, async (req: Request, res: Response) => {
    try {
      const [profile] = await db.select().from(venueAudioProfiles)
        .where(eq(venueAudioProfiles.screenId, req.params.screenId)).limit(1);
      if (!profile) return res.status(404).json({ message: "Venue audio profile not found" });

      let moods: string[] = profile.customMoods || [];
      let genres: string[] = profile.customGenres || [];
      let energyLevels: string[] = [];

      if (profile.presetId) {
        const [preset] = await db.select().from(musicMoodPresets)
          .where(eq(musicMoodPresets.id, profile.presetId)).limit(1);
        if (preset) {
          if (moods.length === 0) moods = preset.moods || [];
          if (genres.length === 0) genres = preset.genres || [];
          energyLevels = preset.energyLevels || [];
        }
      }

      const conditions: any[] = [eq(musicTracks.status, "approved")];

      if (moods.length > 0) {
        conditions.push(sql`${musicTracks.mood} && ARRAY[${sql.join(moods.map(m => sql`${m}`), sql`, `)}]::text[]`);
      }
      if (genres.length > 0) {
        conditions.push(sql`${musicTracks.genre} = ANY(ARRAY[${sql.join(genres.map(g => sql`${g}`), sql`, `)}]::text[])`);
      }
      if (energyLevels.length > 0) {
        conditions.push(sql`${musicTracks.energy} = ANY(ARRAY[${sql.join(energyLevels.map(e => sql`${e}`), sql`, `)}]::text[])`);
      }
      if (profile.excludedGenres && profile.excludedGenres.length > 0) {
        conditions.push(sql`NOT (${musicTracks.genre} = ANY(ARRAY[${sql.join(profile.excludedGenres.map(g => sql`${g}`), sql`, `)}]::text[]))`);
      }
      if (profile.excludedArtistIds && profile.excludedArtistIds.length > 0) {
        conditions.push(sql`NOT (${musicTracks.artistId} = ANY(ARRAY[${sql.join(profile.excludedArtistIds.map(a => sql`${a}`), sql`, `)}]::text[]))`);
      }

      const tracks = await db.select().from(musicTracks)
        .where(and(...conditions))
        .orderBy(desc(musicTracks.playCount))
        .limit(50);

      res.json({ totalMatching: tracks.length, tracks });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/tv/venue/:screenKey/audio-profile", async (req: Request, res: Response) => {
    try {
      const [screen] = await db.select().from(tvScreens)
        .where(eq(tvScreens.screenKey, req.params.screenKey)).limit(1);
      if (!screen) return res.status(404).json({ message: "Screen not found" });
      const [profile] = await db.select().from(venueAudioProfiles)
        .where(eq(venueAudioProfiles.screenId, screen.id)).limit(1);
      if (!profile) return res.status(404).json({ message: "Audio profile not found" });

      let preset = null;
      if (profile.presetId) {
        const [p] = await db.select().from(musicMoodPresets)
          .where(eq(musicMoodPresets.id, profile.presetId)).limit(1);
        preset = p || null;
      }

      res.json({ ...profile, preset });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/tv/venue/:screenKey/audio-profile", async (req: Request, res: Response) => {
    try {
      const [screen] = await db.select().from(tvScreens)
        .where(eq(tvScreens.screenKey, req.params.screenKey)).limit(1);
      if (!screen) return res.status(404).json({ message: "Screen not found" });

      const [existing] = await db.select().from(venueAudioProfiles)
        .where(eq(venueAudioProfiles.screenId, screen.id)).limit(1);

      const parsed = venueProfileUpdateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });

      if (existing) {
        const [updated] = await db.update(venueAudioProfiles)
          .set({ ...parsed.data, updatedAt: new Date() })
          .where(eq(venueAudioProfiles.id, existing.id))
          .returning();
        return res.json(updated);
      } else {
        const [created] = await db.insert(venueAudioProfiles).values({
          screenId: screen.id,
          ...parsed.data,
        }).returning();
        return res.status(201).json(created);
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
