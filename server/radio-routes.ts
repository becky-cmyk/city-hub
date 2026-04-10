import type { Express, Request, Response } from "express";
import { db } from "./db";
import { radioStations, radioSegments, musicTracks, musicArtists, venueAudioProfiles, musicMoodPresets, radioAdBookings, tvScreens } from "@shared/schema";
import { eq, and, desc, asc, or, sql } from "drizzle-orm";
import { z } from "zod";

const createStationSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  stationType: z.enum(["metro", "micro", "venue"]).default("metro"),
  cityId: z.string().optional().nullable(),
  hubSlug: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  streamUrl: z.string().optional().nullable(),
  status: z.enum(["offline", "live", "scheduled"]).default("offline"),
});

const updateStationSchema = createStationSchema.partial();

const createSegmentSchema = z.object({
  stationId: z.string().min(1),
  title: z.string().min(1),
  segmentType: z.enum(["music", "talk", "ad", "announcement", "interview", "expert_show"]).default("music"),
  audioUrl: z.string().optional().nullable(),
  durationSeconds: z.number().int().optional().nullable(),
  artistId: z.string().optional().nullable(),
  trackId: z.string().optional().nullable(),
  adBookingId: z.string().optional().nullable(),
  priority: z.number().int().default(5),
  status: z.enum(["queued", "playing", "played", "skipped"]).default("queued"),
  scheduledAt: z.string().optional().nullable(),
});

const updateSegmentSchema = createSegmentSchema.partial();

export function registerRadioRoutes(app: Express, requireAdmin: any) {
  app.get("/api/radio/stations", async (_req: Request, res: Response) => {
    try {
      const stations = await db.select().from(radioStations)
        .where(or(eq(radioStations.status, "live"), eq(radioStations.status, "scheduled")))
        .orderBy(asc(radioStations.name));
      res.json(stations);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/radio/stations/:slug", async (req: Request, res: Response) => {
    try {
      const [station] = await db.select().from(radioStations)
        .where(eq(radioStations.slug, req.params.slug))
        .limit(1);
      if (!station) return res.status(404).json({ message: "Station not found" });

      let nowPlaying = null;
      if (station.currentSegmentId) {
        const [seg] = await db.select().from(radioSegments)
          .where(eq(radioSegments.id, station.currentSegmentId))
          .limit(1);
        if (seg) {
          let artistName = null;
          if (seg.artistId) {
            const [artist] = await db.select({ name: musicArtists.name }).from(musicArtists)
              .where(eq(musicArtists.id, seg.artistId)).limit(1);
            artistName = artist?.name || null;
          }
          nowPlaying = { ...seg, artistName };
        }
      }

      res.json({ ...station, nowPlaying });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/radio/stations/:slug/playlist", async (req: Request, res: Response) => {
    try {
      const [station] = await db.select().from(radioStations)
        .where(eq(radioStations.slug, req.params.slug))
        .limit(1);
      if (!station) return res.status(404).json({ message: "Station not found" });

      const segments = await db.select().from(radioSegments)
        .where(and(
          eq(radioSegments.stationId, station.id),
          eq(radioSegments.status, "queued")
        ))
        .orderBy(asc(radioSegments.priority), asc(radioSegments.scheduledAt), asc(radioSegments.createdAt));

      res.json(segments);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/radio/stations", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = createStationSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });

      const [created] = await db.insert(radioStations).values(parsed.data).returning();
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/radio/stations", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const stations = await db.select().from(radioStations).orderBy(desc(radioStations.createdAt));
      res.json(stations);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/radio/stations/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = updateStationSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });

      const [updated] = await db.update(radioStations)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(radioStations.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Station not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/radio/stations/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const [deleted] = await db.delete(radioStations)
        .where(eq(radioStations.id, req.params.id))
        .returning();
      if (!deleted) return res.status(404).json({ message: "Station not found" });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/radio/stations/:id/segments", requireAdmin, async (req: Request, res: Response) => {
    try {
      const data = { ...req.body, stationId: req.params.id };
      const parsed = createSegmentSchema.safeParse(data);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });

      const values: any = { ...parsed.data };
      if (values.scheduledAt) values.scheduledAt = new Date(values.scheduledAt);

      const [created] = await db.insert(radioSegments).values(values).returning();
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/radio/segments", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { stationId } = req.query;
      const conditions: any[] = [];
      if (stationId) conditions.push(eq(radioSegments.stationId, stationId as string));

      const segments = conditions.length > 0
        ? await db.select().from(radioSegments).where(and(...conditions)).orderBy(asc(radioSegments.priority), asc(radioSegments.scheduledAt))
        : await db.select().from(radioSegments).orderBy(asc(radioSegments.priority), asc(radioSegments.scheduledAt));

      res.json(segments);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/radio/segments/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = updateSegmentSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });

      const values: any = { ...parsed.data };
      if (values.scheduledAt) values.scheduledAt = new Date(values.scheduledAt);

      const [updated] = await db.update(radioSegments)
        .set(values)
        .where(eq(radioSegments.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Segment not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/radio/segments/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const [deleted] = await db.delete(radioSegments)
        .where(eq(radioSegments.id, req.params.id))
        .returning();
      if (!deleted) return res.status(404).json({ message: "Segment not found" });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/radio/stations/:id/generate-playlist", requireAdmin, async (req: Request, res: Response) => {
    try {
      const stationId = req.params.id;
      const [station] = await db.select().from(radioStations)
        .where(eq(radioStations.id, stationId))
        .limit(1);
      if (!station) return res.status(404).json({ message: "Station not found" });

      let moodFilter: string[] = [];
      let genreFilter: string[] = [];
      let energyFilter: string[] = [];
      let excludedGenres: string[] = [];
      let excludedArtistIds: string[] = [];
      let musicMixPercent = 70;
      let talkEnabled = true;
      let adEnabled = true;

      if (station.stationType === "venue") {
        let venueProfile: any = null;
        if (station.hubSlug) {
          const screenResults = await db.select().from(tvScreens)
            .where(eq(tvScreens.hubSlug, station.hubSlug))
            .limit(1);
          if (screenResults.length > 0) {
            const [profileMatch] = await db.select().from(venueAudioProfiles)
              .where(eq(venueAudioProfiles.screenId, screenResults[0].id))
              .limit(1);
            if (profileMatch) venueProfile = profileMatch;
          }
        }
        if (!venueProfile) {
          const [fallbackProfile] = await db.select().from(venueAudioProfiles).limit(1);
          venueProfile = fallbackProfile || null;
        }

        if (venueProfile) {
          excludedGenres = venueProfile.excludedGenres || [];
          excludedArtistIds = venueProfile.excludedArtistIds || [];
          musicMixPercent = venueProfile.musicMixPercent || 70;
          talkEnabled = venueProfile.talkSegmentsEnabled;
          adEnabled = venueProfile.adSegmentsEnabled;

          if (venueProfile.presetId) {
            const [preset] = await db.select().from(musicMoodPresets)
              .where(eq(musicMoodPresets.id, venueProfile.presetId))
              .limit(1);
            if (preset) {
              moodFilter = preset.moods || [];
              genreFilter = preset.genres || [];
              energyFilter = preset.energyLevels || [];
            }
          } else {
            moodFilter = venueProfile.customMoods || [];
            genreFilter = venueProfile.customGenres || [];
          }
        }
      }

      const approvedTracks = await db.select({
        track: musicTracks,
        artistName: musicArtists.name,
      }).from(musicTracks)
        .innerJoin(musicArtists, eq(musicTracks.artistId, musicArtists.id))
        .where(eq(musicTracks.status, "approved"));

      let filteredTracks = approvedTracks.filter(({ track }) => {
        if (excludedArtistIds.length > 0 && excludedArtistIds.includes(track.artistId)) return false;
        if (excludedGenres.length > 0 && track.genre && excludedGenres.includes(track.genre)) return false;

        if (genreFilter.length > 0 && track.genre && !genreFilter.includes(track.genre)) return false;

        if (moodFilter.length > 0 && track.mood) {
          const trackMoods = track.mood || [];
          if (trackMoods.length > 0 && !trackMoods.some(m => moodFilter.includes(m))) return false;
        }

        if (energyFilter.length > 0 && track.energy) {
          if (!energyFilter.includes(track.energy)) return false;
        }

        return true;
      });

      if (filteredTracks.length === 0) {
        filteredTracks = approvedTracks;
      }

      const shuffled = filteredTracks.sort(() => Math.random() - 0.5);

      const totalSegments = 20;
      const musicCount = Math.round(totalSegments * (musicMixPercent / 100));
      const nonMusicCount = totalSegments - musicCount;

      const segments: any[] = [];

      for (let i = 0; i < musicCount && i < shuffled.length; i++) {
        const { track, artistName } = shuffled[i];
        segments.push({
          stationId,
          title: `${track.title} - ${artistName}`,
          segmentType: "music" as const,
          audioUrl: track.audioUrl,
          durationSeconds: track.durationSeconds || 180,
          artistId: track.artistId,
          trackId: track.id,
          priority: i + 1,
          status: "queued" as const,
        });
      }

      if (adEnabled) {
        const activeBookings = await db.select().from(radioAdBookings)
          .where(and(
            eq(radioAdBookings.status, "active"),
            station.id ? or(
              eq(radioAdBookings.stationId, station.id),
              sql`${radioAdBookings.stationId} IS NULL`
            ) : sql`true`
          ));

        const adCount = Math.min(Math.floor(nonMusicCount * 0.4), activeBookings.length);
        for (let i = 0; i < adCount; i++) {
          const booking = activeBookings[i];
          segments.push({
            stationId,
            title: booking.headline || "Sponsored Message",
            segmentType: "ad" as const,
            audioUrl: booking.audioUrl,
            durationSeconds: 30,
            adBookingId: booking.id,
            priority: musicCount + i + 1,
            status: "queued" as const,
          });
        }
      }

      if (talkEnabled) {
        const announcementCount = Math.floor(nonMusicCount * 0.3);
        for (let i = 0; i < announcementCount; i++) {
          segments.push({
            stationId,
            title: `Community Update ${i + 1}`,
            segmentType: "announcement" as const,
            durationSeconds: 60,
            priority: musicCount + (adEnabled ? Math.floor(nonMusicCount * 0.4) : 0) + i + 1,
            status: "queued" as const,
          });
        }
      }

      const interleaved: any[] = [];
      const musicSegs = segments.filter(s => s.segmentType === "music");
      const nonMusicSegs = segments.filter(s => s.segmentType !== "music");

      let mi = 0, ni = 0;
      while (mi < musicSegs.length || ni < nonMusicSegs.length) {
        if (mi < musicSegs.length) {
          interleaved.push({ ...musicSegs[mi], priority: interleaved.length + 1 });
          mi++;
        }
        if (mi < musicSegs.length) {
          interleaved.push({ ...musicSegs[mi], priority: interleaved.length + 1 });
          mi++;
        }
        if (mi < musicSegs.length) {
          interleaved.push({ ...musicSegs[mi], priority: interleaved.length + 1 });
          mi++;
        }
        if (ni < nonMusicSegs.length) {
          interleaved.push({ ...nonMusicSegs[ni], priority: interleaved.length + 1 });
          ni++;
        }
      }

      if (interleaved.length > 0) {
        const created = await db.insert(radioSegments).values(interleaved).returning();
        res.json({ generated: created.length, segments: created });
      } else {
        res.json({ generated: 0, segments: [], message: "No tracks available to generate playlist" });
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/radio/stations/:id/status", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { status } = req.body;
      if (!["offline", "live", "scheduled"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const [updated] = await db.update(radioStations)
        .set({ status, updatedAt: new Date() })
        .where(eq(radioStations.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Station not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
