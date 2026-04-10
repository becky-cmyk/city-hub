import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { z } from "zod";
import {
  insertVenueChannelSchema,
  insertVideoContentSchema,
  insertLiveSessionSchema,
  insertOfferSchema,
  insertTransactionSchema,
} from "@shared/schema";
import { generatePulseForChannel } from "./services/venue-channel-pulse";

export function registerVenueChannelRoutes(app: Express, requireAdmin: any) {

  app.get("/api/venue-channels/by-business/:businessId", async (req: Request, res: Response) => {
    try {
      const businessId = req.params.businessId as string;
      const channel = await storage.getVenueChannelByBusinessId(businessId);
      if (!channel) return res.json(null);

      const videos = await storage.listVideosByChannel(channel.id);
      const activeSessions = await storage.getActiveLiveSessions(channel.cityId);
      const liveSession = activeSessions.find(s => s.venueChannelId === channel.id && (s.status === "live" || s.status === "scheduled")) || null;
      const activeOffers = (await storage.listOffersByBusiness(channel.businessId)).filter(o => o.active);

      res.json({ channel, videos, liveSession, offers: activeOffers });
    } catch (error: any) {
      console.error("Venue channel by business fetch error:", error);
      res.status(500).json({ message: "Failed to fetch channel" });
    }
  });

  app.get("/api/venue-channels/:slug", async (req: Request, res: Response) => {
    try {
      const slug = req.params.slug as string;
      const channel = await storage.getVenueChannelBySlug(slug);
      if (!channel) return res.status(404).json({ message: "Channel not found" });

      const videos = await storage.listVideosByChannel(channel.id);
      const activeSessions = await storage.getActiveLiveSessions(channel.cityId);
      const liveSession = activeSessions.find(s => s.venueChannelId === channel.id) || null;
      const activeOffers = (await storage.listOffersByBusiness(channel.businessId)).filter(o => o.active);

      res.json({ channel, videos, liveSession, offers: activeOffers });
    } catch (error: any) {
      console.error("Venue channel fetch error:", error);
      res.status(500).json({ message: "Failed to fetch channel" });
    }
  });

  app.get("/api/venue-channels/:slug/videos", async (req: Request, res: Response) => {
    try {
      const slug = req.params.slug as string;
      const channel = await storage.getVenueChannelBySlug(slug);
      if (!channel) return res.status(404).json({ message: "Channel not found" });

      const videos = await storage.listVideosByChannel(channel.id);
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const start = (page - 1) * limit;
      const paginated = videos.slice(start, start + limit);

      res.json({ videos: paginated, total: videos.length, page, limit });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch videos" });
    }
  });

  app.get("/api/venue-channels/:slug/live", async (req: Request, res: Response) => {
    try {
      const slug = req.params.slug as string;
      const channel = await storage.getVenueChannelBySlug(slug);
      if (!channel) return res.status(404).json({ message: "Channel not found" });

      const activeSessions = await storage.getActiveLiveSessions(channel.cityId);
      const liveSession = activeSessions.find(s => s.venueChannelId === channel.id) || null;

      res.json({ liveSession });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch live session" });
    }
  });

  app.get("/api/live", async (req: Request, res: Response) => {
    try {
      const cityId = req.query.cityId as string;
      if (!cityId) return res.status(400).json({ message: "cityId query param required" });

      const sessions = await storage.getActiveLiveSessions(cityId);
      res.json({ sessions });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch live sessions" });
    }
  });

  app.get("/api/offers/:id", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const offer = await storage.getOffer(id);
      if (!offer) return res.status(404).json({ message: "Offer not found" });
      res.json(offer);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch offer" });
    }
  });

  app.get("/api/admin/venue-channels", requireAdmin, async (req: Request, res: Response) => {
    try {
      const cityId = req.query.cityId as string | undefined;
      const status = req.query.status as string | undefined;
      const channels = await storage.listVenueChannels(cityId, status ? { status } : undefined);
      res.json(channels);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to list channels" });
    }
  });

  app.post("/api/admin/venue-channels", requireAdmin, async (req: Request, res: Response) => {
    try {
      const data = insertVenueChannelSchema.parse(req.body);
      const channel = await storage.createVenueChannel(data);
      res.status(201).json(channel);
    } catch (error: any) {
      if (error.name === "ZodError") return res.status(400).json({ message: "Validation error", errors: error.errors });
      console.error("Create venue channel error:", error);
      res.status(500).json({ message: "Failed to create channel" });
    }
  });

  app.get("/api/admin/venue-channels/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const channel = await storage.getVenueChannel(id);
      if (!channel) return res.status(404).json({ message: "Channel not found" });
      res.json(channel);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch channel" });
    }
  });

  app.patch("/api/admin/venue-channels/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const partial = insertVenueChannelSchema.partial().parse(req.body);
      const channel = await storage.updateVenueChannel(id, partial);
      if (!channel) return res.status(404).json({ message: "Channel not found" });
      res.json(channel);
    } catch (error: any) {
      if (error.name === "ZodError") return res.status(400).json({ message: "Validation error", errors: error.errors });
      res.status(500).json({ message: "Failed to update channel" });
    }
  });

  app.delete("/api/admin/venue-channels/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      await storage.deleteVenueChannel(id);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to delete channel" });
    }
  });

  app.get("/api/admin/video-content", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { channelId, cityId, screenEligible, pulseEligible, businessId } = req.query as Record<string, string>;
      if (channelId) {
        const videos = await storage.listVideosByChannel(channelId);
        return res.json(videos);
      }
      if (cityId) {
        const filters: any = {};
        if (screenEligible === "true") filters.screenEligible = true;
        if (pulseEligible === "true") filters.pulseEligible = true;
        if (businessId) filters.businessId = businessId;
        const videos = await storage.listVideosByCity(cityId, filters);
        return res.json(videos);
      }
      res.json([]);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to list videos" });
    }
  });

  app.post("/api/admin/video-content", requireAdmin, async (req: Request, res: Response) => {
    try {
      const data = insertVideoContentSchema.parse(req.body);
      const video = await storage.createVideoContent(data);
      generatePulseForChannel("video_uploaded", video.id).catch(() => {});
      res.status(201).json(video);
    } catch (error: any) {
      if (error.name === "ZodError") return res.status(400).json({ message: "Validation error", errors: error.errors });
      console.error("Create video content error:", error);
      res.status(500).json({ message: "Failed to create video" });
    }
  });

  app.get("/api/admin/video-content/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const video = await storage.getVideoContent(id);
      if (!video) return res.status(404).json({ message: "Video not found" });
      res.json(video);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch video" });
    }
  });

  app.patch("/api/admin/video-content/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const partial = insertVideoContentSchema.partial().parse(req.body);
      const video = await storage.updateVideoContent(id, partial);
      if (!video) return res.status(404).json({ message: "Video not found" });
      res.json(video);
    } catch (error: any) {
      if (error.name === "ZodError") return res.status(400).json({ message: "Validation error", errors: error.errors });
      res.status(500).json({ message: "Failed to update video" });
    }
  });

  app.delete("/api/admin/video-content/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      await storage.deleteVideoContent(id);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to delete video" });
    }
  });

  app.get("/api/admin/live-sessions", requireAdmin, async (req: Request, res: Response) => {
    try {
      const cityId = req.query.cityId as string;
      if (!cityId) return res.json([]);
      const sessions = await storage.getActiveLiveSessions(cityId);
      res.json(sessions);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to list live sessions" });
    }
  });

  app.post("/api/admin/live-sessions", requireAdmin, async (req: Request, res: Response) => {
    try {
      const data = insertLiveSessionSchema.parse(req.body);
      const session = await storage.createLiveSession(data);
      generatePulseForChannel("live_scheduled", session.id).catch(() => {});
      res.status(201).json(session);
    } catch (error: any) {
      if (error.name === "ZodError") return res.status(400).json({ message: "Validation error", errors: error.errors });
      console.error("Create live session error:", error);
      res.status(500).json({ message: "Failed to create live session" });
    }
  });

  app.get("/api/admin/live-sessions/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const session = await storage.getLiveSession(id);
      if (!session) return res.status(404).json({ message: "Live session not found" });
      res.json(session);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch live session" });
    }
  });

  app.patch("/api/admin/live-sessions/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const partial = insertLiveSessionSchema.partial().parse(req.body);
      const session = await storage.updateLiveSession(id, partial);
      if (!session) return res.status(404).json({ message: "Live session not found" });

      if (partial.status === "live") {
        generatePulseForChannel("live_started", session.id).catch(() => {});
      } else if (partial.status === "ended") {
        generatePulseForChannel("live_ended", session.id).catch(() => {});
      }

      res.json(session);
    } catch (error: any) {
      if (error.name === "ZodError") return res.status(400).json({ message: "Validation error", errors: error.errors });
      res.status(500).json({ message: "Failed to update live session" });
    }
  });

  app.delete("/api/admin/live-sessions/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const existing = await storage.getLiveSession(id);
      if (!existing) return res.status(404).json({ message: "Live session not found" });
      await storage.updateLiveSession(id, { status: "cancelled" } as any);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to delete live session" });
    }
  });

  app.get("/api/admin/offers", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { businessId, cityId } = req.query as Record<string, string>;
      if (businessId) {
        const offersList = await storage.listOffersByBusiness(businessId);
        return res.json(offersList);
      }
      if (cityId) {
        const offersList = await storage.listActiveOffers(cityId);
        return res.json(offersList);
      }
      res.json([]);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to list offers" });
    }
  });

  app.post("/api/admin/offers", requireAdmin, async (req: Request, res: Response) => {
    try {
      const data = insertOfferSchema.parse(req.body);
      const offer = await storage.createOffer(data);
      res.status(201).json(offer);
    } catch (error: any) {
      if (error.name === "ZodError") return res.status(400).json({ message: "Validation error", errors: error.errors });
      console.error("Create offer error:", error);
      res.status(500).json({ message: "Failed to create offer" });
    }
  });

  app.get("/api/admin/offers/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const offer = await storage.getOffer(id);
      if (!offer) return res.status(404).json({ message: "Offer not found" });
      res.json(offer);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch offer" });
    }
  });

  app.patch("/api/admin/offers/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const partial = insertOfferSchema.partial().parse(req.body);
      const offer = await storage.updateOffer(id, partial);
      if (!offer) return res.status(404).json({ message: "Offer not found" });
      res.json(offer);
    } catch (error: any) {
      if (error.name === "ZodError") return res.status(400).json({ message: "Validation error", errors: error.errors });
      res.status(500).json({ message: "Failed to update offer" });
    }
  });

  app.delete("/api/admin/offers/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      await storage.deleteOffer(id);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to delete offer" });
    }
  });

  app.get("/api/admin/transactions", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { businessId, offerId, startDate, endDate } = req.query as Record<string, string>;
      if (offerId) {
        const txns = await storage.listTransactionsByOffer(offerId);
        return res.json(txns);
      }
      if (businessId) {
        const filters: { startDate?: Date; endDate?: Date } = {};
        if (startDate) filters.startDate = new Date(startDate);
        if (endDate) filters.endDate = new Date(endDate);
        const txns = await storage.listTransactionsByBusiness(businessId, filters);
        return res.json(txns);
      }
      res.json([]);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to list transactions" });
    }
  });
}
