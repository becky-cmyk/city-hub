import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { eq, and, gte, lte, desc, asc, sql, inArray } from "drizzle-orm";
import { db } from "./db";
import { events, articles, businesses, liveFeeds, tvItems, tvVenueContentLinks, quizzes, giveaways, jobs } from "@shared/schema";
import { getWeather } from "./services/weather-service";
import { getLocalSportsScores } from "./services/sports-service";
import { getTonightEvents, getWeekendEvents } from "./services/tv-event-helpers";
import { generateAndSaveNarration, VOICE_PROFILE_MAP } from "./services/tts-provider";
import { generateAndSaveCaptions, estimateDurationFromText } from "./services/caption-generator";
import { assembleChannelPlaylist, shouldUseChannelEngine } from "./services/channel-engine";

interface PlaylistItem {
  id: string;
  type: "slide" | "video";
  templateKey: string;
  durationSec: number;
  data: Record<string, any>;
  assetUrl?: string | null;
  videoUrl?: string | null;
  clickUrl?: string | null;
  qrUrl?: string | null;
  priority: number;
  source: "metro" | "hub" | "location" | "auto";
}

function getDaypartSlot(): string {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "latenight";
}

function hasOverlap(arr1: string[], arr2: string[]): boolean {
  return arr1.some(id => arr2.includes(id));
}

export function registerTvRoutes(app: Express, requireAdmin: any) {
  app.get("/api/tv/playlist", async (req: Request, res: Response) => {
    try {
      const { metroSlug, hubSlug, locationSlug, screenKey } = req.query as Record<string, string>;

      let screenConfig: any = null;
      let languageMode = "en";
      let daypartingEnabled = false;
      let protectedCategoryIds: string[] = [];
      let excludedBusinessIds: string[] = [];
      let settings = {
        slideDurationDefaultSec: 9,
        videoDurationMaxSec: 60,
        loopTargetMin: 20,
        venuePromoFrequencyMin: 3,
        adSlotFrequencyMin: 6,
      };

      if (screenKey) {
        screenConfig = await storage.getTvScreenByKey(screenKey);
        if (screenConfig) {
          languageMode = screenConfig.languageMode || "en";
          daypartingEnabled = screenConfig.daypartingEnabled || false;
          protectedCategoryIds = screenConfig.protectedCategoryIds || [];
          excludedBusinessIds = screenConfig.excludedBusinessIds || [];
          if (screenConfig.playlistSettings) {
            settings = { ...settings, ...(screenConfig.playlistSettings as any) };
          }
        }
      }

      if (screenConfig && shouldUseChannelEngine(screenConfig)) {
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        const channelResult = await assembleChannelPlaylist(screenConfig, baseUrl);

        if (channelResult.items.length > 0) {
          for (const item of channelResult.items) {
            if (item.qrUrl) {
              const params = new URLSearchParams({
                url: item.qrUrl,
                ...(screenConfig.hubSlug ? { hubSlug: screenConfig.hubSlug } : {}),
                ...(item.templateKey ? { templateKey: item.templateKey } : {}),
              });
              item.qrUrl = `${baseUrl}/api/tv/qr/${encodeURIComponent(item.id)}?${params.toString()}`;
            }
          }

          const totalDurationSec = channelResult.items.reduce((sum, i) => sum + i.durationSec, 0);
          let syncStartTime: number | null = null;
          let screenGroupOffset = 0;

          if (screenConfig.screenGroupId) {
            const midnight = new Date();
            midnight.setHours(0, 0, 0, 0);
            syncStartTime = midnight.getTime();
            screenGroupOffset = screenConfig.screenGroupRole === "secondary" ? Math.floor(totalDurationSec / 2) : 0;
          }

          return res.json({
            items: channelResult.items,
            generatedAt: new Date().toISOString(),
            nextRefreshSec: 60,
            languageMode,
            hubSlug: screenConfig.hubSlug || null,
            metroSlug: screenConfig.metroSlug || metroSlug || "charlotte",
            totalDurationSec,
            itemCount: channelResult.items.length,
            mode: "channel",
            loopId: channelResult.loopId,
            loopName: channelResult.loopName,
            scheduleId: channelResult.scheduleId,
            scheduleName: channelResult.scheduleName,
            ...(syncStartTime ? { syncStartTime, screenGroupOffset } : {}),
          });
        }
      }

      const effectiveHubSlug = screenConfig?.hubSlug || hubSlug;
      const effectiveMetroSlug = screenConfig?.metroSlug || metroSlug || "charlotte";
      const effectiveLocationSlug = screenConfig?.locationSlug || locationSlug;
      const currentDaypart = getDaypartSlot();

      const allItems: PlaylistItem[] = [];

      const tvItemFilters: any = { enabled: true };
      if (effectiveHubSlug) tvItemFilters.hubSlug = effectiveHubSlug;
      const manualItems = await storage.getTvItems(tvItemFilters);

      const metroItems = await storage.getTvItems({ enabled: true, sourceScope: "metro" });

      const combined = [...manualItems];
      for (const mi of metroItems) {
        if (!combined.find(c => c.id === mi.id)) combined.push(mi);
      }

      if (effectiveLocationSlug) {
        const locItems = await storage.getTvItems({ enabled: true, hubSlug: effectiveHubSlug, sourceScope: "location" });
        for (const li of locItems) {
          if (!combined.find(c => c.id === li.id)) combined.push(li);
        }
      }

      const now = new Date();
      for (const item of combined) {
        if (item.startAt && new Date(item.startAt) > now) continue;
        if (item.endAt && new Date(item.endAt) < now) continue;

        if (daypartingEnabled && item.daypartSlots && item.daypartSlots.length > 0) {
          if (!item.daypartSlots.includes(currentDaypart)) continue;
        }

        if (protectedCategoryIds.length > 0 && item.categoryIds && item.categoryIds.length > 0) {
          if (hasOverlap(item.categoryIds, protectedCategoryIds)) continue;
        }

        allItems.push({
          id: item.id,
          type: item.type as "slide" | "video",
          templateKey: item.templateKey || "hub_discovery",
          durationSec: item.type === "video"
            ? Math.min(item.durationSec || 30, settings.videoDurationMaxSec)
            : (item.durationSec || settings.slideDurationDefaultSec),
          data: (item.data as Record<string, any>) || {},
          assetUrl: item.assetUrl,
          videoUrl: item.videoUrl,
          clickUrl: item.clickUrl,
          qrUrl: item.qrUrl,
          priority: item.priority,
          source: item.sourceScope as any,
        });
      }

      try {
        const linkConditions = [eq(tvVenueContentLinks.status, "published" as any)];
        if (screenConfig?.id) linkConditions.push(eq(tvVenueContentLinks.screenId, screenConfig.id));
        else if (effectiveHubSlug) linkConditions.push(eq(tvVenueContentLinks.hubSlug, effectiveHubSlug));
        const contentLinks = await db.select().from(tvVenueContentLinks)
          .where(and(...linkConditions));
        for (const link of contentLinks) {
          if (link.startAt && new Date(link.startAt) > now) continue;
          if (link.endAt && new Date(link.endAt) < now) continue;
          const templateMap: Record<string, string> = { quiz: "quiz_promo", giveaway: "giveaway_promo", job: "job_listing", event: "hub_event", article: "pulse_headline" };
          allItems.push({
            id: `cl-${link.id}`,
            type: "slide",
            templateKey: link.templateOverride || templateMap[link.contentType] || "hub_discovery",
            durationSec: 12,
            data: (link.slideData as Record<string, any>) || { title: link.contentTitle },
            priority: link.priority,
            source: link.screenId ? "location" : "hub",
          });
        }
      } catch (clErr) {}

      try {
        const upcomingEvents = await db.select().from(events)
          .where(and(
            gte(events.startDateTime, now),
            eq((events as any).isActive, true),
          ))
          .orderBy(asc(events.startDateTime))
          .limit(10);

        for (const evt of upcomingEvents) {
          if (excludedBusinessIds.length && evt.hostBusinessId && excludedBusinessIds.includes(evt.hostBusinessId)) continue;

          const baseUrl = `${req.protocol}://${req.get("host")}`;
          allItems.push({
            id: `auto-event-${evt.id}`,
            type: "slide",
            templateKey: "hub_event",
            durationSec: settings.slideDurationDefaultSec,
            data: {
              title: evt.title,
              titleEs: (evt as any).titleEs || "",
              description: evt.description,
              descriptionEs: (evt as any).descriptionEs || "",
              date: evt.startDateTime ? new Date(evt.startDateTime).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "",
              time: evt.startDateTime ? new Date(evt.startDateTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "",
              location: evt.locationName || "",
              cost: evt.costText || "Free",
              category: "",
            },
            assetUrl: evt.imageUrl || null,
            qrUrl: evt.slug ? `${baseUrl}/${effectiveMetroSlug}/events/${evt.slug}` : null,
            priority: evt.isFeatured ? 8 : 5,
            source: "auto",
          });
        }
      } catch (e) { /* events table might not have data */ }

      try {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const recentArticles = await db.select().from(articles)
          .where(and(
            eq((articles as any).isActive, true),
            lte(articles.publishedAt, now),
            gte(articles.publishedAt, thirtyDaysAgo),
          ))
          .orderBy(desc(articles.publishedAt))
          .limit(8);

        for (const art of recentArticles) {
          const baseUrl = `${req.protocol}://${req.get("host")}`;
          allItems.push({
            id: `auto-article-${art.id}`,
            type: "slide",
            templateKey: "pulse_headline",
            durationSec: settings.slideDurationDefaultSec,
            data: {
              title: art.title,
              titleEs: (art as any).titleEs || "",
              excerpt: art.excerpt || "",
              excerptEs: (art as any).excerptEs || "",
              author: "",
              publishedAt: art.publishedAt ? new Date(art.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "",
            },
            assetUrl: art.imageUrl || null,
            qrUrl: art.slug ? `${baseUrl}/${effectiveMetroSlug}/articles/${art.slug}` : null,
            priority: art.isFeatured ? 7 : 4,
            source: "auto",
          });
        }
      } catch (e) { /* articles might be empty */ }

      try {
        const featuredBiz = await db.select().from(businesses)
          .where(and(
            eq((businesses as any).isActive, true),
            eq(businesses.isFeatured, true),
          ))
          .orderBy(desc(businesses.updatedAt))
          .limit(6);

        for (const biz of featuredBiz) {
          if (excludedBusinessIds.length && excludedBusinessIds.includes(biz.id)) continue;
          if (protectedCategoryIds.length && biz.categoryIds && hasOverlap(biz.categoryIds, protectedCategoryIds)) continue;

          const baseUrl = `${req.protocol}://${req.get("host")}`;
          allItems.push({
            id: `auto-biz-${biz.id}`,
            type: "slide",
            templateKey: "neighborhood_spotlight",
            durationSec: settings.slideDurationDefaultSec,
            data: {
              name: biz.name,
              description: biz.description || "",
              descriptionEs: (biz as any).descriptionEs || "",
              neighborhood: biz.city || "",
              rating: (biz as any).googleRating || null,
              category: "",
            },
            assetUrl: biz.imageUrl || null,
            qrUrl: biz.slug ? `${baseUrl}/${effectiveMetroSlug}/directory/${biz.slug}` : null,
            priority: biz.isSponsored ? 8 : 5,
            source: "auto",
          });
        }
      } catch (e) { /* businesses might be empty */ }

      try {
        const feeds = await db.select().from(liveFeeds)
          .where(eq(liveFeeds.isActive, true))
          .orderBy(desc(liveFeeds.featured), asc(liveFeeds.sortOrder))
          .limit(4);

        for (const feed of feeds) {
          allItems.push({
            id: `auto-feed-${feed.id}`,
            type: "slide",
            templateKey: "live_feed",
            durationSec: settings.slideDurationDefaultSec + 3,
            data: {
              title: feed.title,
              description: feed.description || "",
              category: feed.category,
              embedUrl: feed.embedUrl,
              sourceUrl: feed.sourceUrl,
            },
            assetUrl: null,
            qrUrl: feed.sourceUrl,
            priority: feed.featured ? 7 : 4,
            source: "auto",
          });
        }
      } catch (e) { /* live feeds might be empty */ }

      try {
        const cities = await storage.getAllCities();
        const city = cities.find(c => c.slug === effectiveMetroSlug);
        if (city) {
          const activeSessions = await storage.getActiveLiveSessions(city.id);
          for (const session of activeSessions) {
            if (excludedBusinessIds.length && excludedBusinessIds.includes(session.businessId)) continue;
            const biz = await storage.getBusinessById(session.businessId);
            const businessName = biz?.name || "Local Business";
            const channelSlug = session.venueChannelId
              ? (await storage.getVenueChannel(session.venueChannelId))?.channelSlug || null
              : null;
            const bUrl = `${req.protocol}://${req.get("host")}`;
            const watchUrl = channelSlug
              ? `${bUrl}/${effectiveMetroSlug}/channel/${channelSlug}`
              : session.youtubeLiveUrl || `${bUrl}/${effectiveMetroSlug}`;

            allItems.push({
              id: `live-session-${session.id}`,
              type: "slide",
              templateKey: "youtube_live_now",
              durationSec: settings.slideDurationDefaultSec + 3,
              data: {
                title: session.title,
                description: session.description || "",
                businessName,
                youtubeVideoId: session.youtubeVideoId || "",
                youtubeLiveUrl: session.youtubeLiveUrl || "",
                thumbnailUrl: session.thumbnailUrl || "",
                startTime: session.startTime ? new Date(session.startTime).toISOString() : "",
              },
              assetUrl: session.thumbnailUrl || null,
              qrUrl: watchUrl,
              priority: 10,
              source: "auto",
            });
          }

          const screenEligibleVideos = await storage.listVideosByCity(city.id, { screenEligible: true });
          for (const vid of screenEligibleVideos) {
            if (excludedBusinessIds.length && vid.businessId && excludedBusinessIds.includes(vid.businessId)) continue;
            const biz = vid.businessId ? await storage.getBusinessById(vid.businessId) : null;
            const businessName = biz?.name || "";
            const channel = vid.venueChannelId ? await storage.getVenueChannel(vid.venueChannelId) : null;
            const bUrl = `${req.protocol}://${req.get("host")}`;
            const watchUrl = channel?.channelSlug
              ? `${bUrl}/${effectiveMetroSlug}/channel/${channel.channelSlug}`
              : vid.youtubeUrl || `${bUrl}/${effectiveMetroSlug}`;

            allItems.push({
              id: `yt-video-${vid.id}`,
              type: "slide",
              templateKey: "youtube_video",
              durationSec: Math.min(vid.durationSec || settings.slideDurationDefaultSec + 2, 30),
              data: {
                title: vid.title,
                description: vid.description || "",
                businessName,
                youtubeVideoId: vid.youtubeVideoId || "",
                youtubeUrl: vid.youtubeUrl || "",
                thumbnailUrl: vid.thumbnailUrl || "",
              },
              assetUrl: vid.thumbnailUrl || null,
              qrUrl: watchUrl,
              priority: 6,
              source: "auto",
            });
          }
        }
      } catch (e) {}

      if (effectiveHubSlug) {
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        allItems.push({
          id: "hub-discovery-auto",
          type: "slide",
          templateKey: "hub_discovery",
          durationSec: settings.slideDurationDefaultSec + 2,
          data: {
            hubName: effectiveHubSlug.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
            hubSlug: effectiveHubSlug,
            metroSlug: effectiveMetroSlug,
            tagline: "Discover your neighborhood hub",
            taglineEs: "Descubre tu centro comunitario",
          },
          assetUrl: null,
          qrUrl: `${baseUrl}/${effectiveMetroSlug}/hub/${effectiveHubSlug}`,
          priority: 6,
          source: "auto",
        });
      }

      try {
        const weather = await getWeather();
        if (weather) {
          allItems.push({
            id: "auto-weather",
            type: "slide",
            templateKey: "weather_current",
            durationSec: settings.slideDurationDefaultSec + 1,
            data: {
              temperature: weather.temperature,
              conditions: weather.conditions,
              conditionsIcon: weather.conditionsIcon,
              high: weather.high,
              low: weather.low,
              humidity: weather.humidity,
              windSpeed: weather.windSpeed,
              windDirection: weather.windDirection,
              locationName: weather.locationName || "Charlotte, NC",
            },
            assetUrl: null,
            qrUrl: "https://forecast.weather.gov/MapClick.php?lat=35.2271&lon=-80.8431",
            priority: 6,
            source: "auto",
          });
        }
      } catch (e) { /* weather fetch failed */ }

      try {
        const scores = await getLocalSportsScores();
        if (scores && scores.length > 0) {
          const hasLive = scores.some(g => g.status === "in");
          allItems.push({
            id: "auto-sports",
            type: "slide",
            templateKey: "sports_scores",
            durationSec: settings.slideDurationDefaultSec + 3,
            data: {
              games: scores.slice(0, 4).map(g => ({
                homeTeam: g.homeTeam,
                awayTeam: g.awayTeam,
                homeScore: g.homeScore,
                awayScore: g.awayScore,
                status: g.status,
                statusDetail: g.statusDetail,
                league: g.league,
                homeLogo: g.homeLogo,
                awayLogo: g.awayLogo,
                homeAbbrev: g.homeAbbrev,
                awayAbbrev: g.awayAbbrev,
                isLocal: g.isLocalTeam,
                startTime: g.startTime,
              })),
            },
            assetUrl: null,
            qrUrl: "https://www.espn.com/",
            priority: hasLive ? 7 : 5,
            source: "auto",
          });
        }
      } catch (e) { /* sports fetch failed */ }

      try {
        const hour = new Date().getHours();
        const isRushHour = (hour >= 7 && hour < 9) || (hour >= 16 && hour < 19);
        if (isRushHour) {
          allItems.push({
            id: "auto-traffic",
            type: "slide",
            templateKey: "traffic_update",
            durationSec: settings.slideDurationDefaultSec,
            data: {},
            assetUrl: null,
            qrUrl: "https://tims.ncdot.gov/tims/",
            priority: 5,
            source: "auto",
          });
        }
      } catch (e) { /* traffic failed */ }

      try {
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        const currentHour = new Date().getHours();
        const tonightEvents = await getTonightEvents(effectiveMetroSlug, effectiveHubSlug, effectiveLocationSlug);
        const tonightQrPath = effectiveHubSlug
          ? `${baseUrl}/${effectiveMetroSlug}/hub/${effectiveHubSlug}/events?filter=tonight`
          : `${baseUrl}/${effectiveMetroSlug}/events?filter=tonight`;
        let tonightPriority = 5;
        if (currentHour >= 16) tonightPriority = 7;

        allItems.push({
          id: "auto-tonight-around-you",
          type: "slide",
          templateKey: "tonight_around_you",
          durationSec: settings.slideDurationDefaultSec + 2,
          data: {
            headline: "Tonight Around You",
            headlineEs: "Esta Noche Cerca de Ti",
            subline: "What's happening nearby",
            sublineEs: "Qué está pasando cerca",
            events: tonightEvents,
          },
          assetUrl: null,
          qrUrl: tonightQrPath,
          priority: tonightPriority,
          source: "auto",
        });
      } catch (e) { /* tonight events failed */ }

      try {
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        const now2 = new Date();
        const dayOfWeek = now2.getDay();
        const weekendEvents = await getWeekendEvents(effectiveMetroSlug, effectiveHubSlug, effectiveLocationSlug);
        const weekendQrPath = effectiveHubSlug
          ? `${baseUrl}/${effectiveMetroSlug}/hub/${effectiveHubSlug}/events?filter=weekend`
          : `${baseUrl}/${effectiveMetroSlug}/events?filter=weekend`;

        let weekendPriority = 3;
        if (dayOfWeek === 4) weekendPriority = 6;
        if (dayOfWeek === 5 || dayOfWeek === 6) weekendPriority = 7;
        if (dayOfWeek === 0) weekendPriority = 6;

        allItems.push({
          id: "auto-this-weekend",
          type: "slide",
          templateKey: "this_weekend",
          durationSec: settings.slideDurationDefaultSec + 2,
          data: {
            headline: "This Weekend",
            headlineEs: "Este Fin de Semana",
            subline: "Plans around you",
            sublineEs: "Planes cerca de ti",
            events: weekendEvents,
          },
          assetUrl: null,
          qrUrl: weekendQrPath,
          priority: weekendPriority,
          source: "auto",
        });
      } catch (e) { /* weekend events failed */ }

      const paidItems = allItems.filter(i => (i as any).isPaid);
      const organicItems = allItems.filter(i => !(i as any).isPaid);

      try {
        const activePlacements = await storage.getTvPlacements({ enabled: true });
        const now2 = new Date();
        for (const p of activePlacements) {
          if (p.startAt && new Date(p.startAt) > now2) continue;
          if (p.endAt && new Date(p.endAt) < now2) continue;
          if (p.hubSlug && effectiveHubSlug && p.hubSlug !== effectiveHubSlug) continue;
          if (p.screenId && screenConfig && p.screenId !== screenConfig.id) continue;
          if (p.tvItemId) {
            const linkedItem = await storage.getTvItem(p.tvItemId);
            if (linkedItem && linkedItem.enabled) {
              const alreadyExists = paidItems.some(i => i.id === linkedItem.id);
              if (!alreadyExists) {
                paidItems.push({
                  id: linkedItem.id,
                  type: linkedItem.type as "slide" | "video",
                  templateKey: linkedItem.templateKey || "venue_special",
                  durationSec: linkedItem.durationSec || settings.slideDurationDefaultSec,
                  data: (linkedItem.data as Record<string, any>) || {},
                  assetUrl: linkedItem.assetUrl,
                  videoUrl: linkedItem.videoUrl,
                  clickUrl: linkedItem.clickUrl,
                  qrUrl: linkedItem.qrUrl,
                  priority: 9,
                  source: "hub",
                  isPaid: true,
                } as any);
              }
            }
          }
        }
      } catch (e) { /* placements might be empty */ }

      organicItems.sort((a, b) => b.priority - a.priority);

      const loopTargetSec = settings.loopTargetMin * 60;
      const playlist: PlaylistItem[] = [];
      let totalDuration = 0;
      let organicIdx = 0;
      let paidIdx = 0;
      let slotCounter = 0;
      const adFreq = settings.adSlotFrequencyMin || 6;

      while (totalDuration < loopTargetSec && (organicIdx < organicItems.length || paidIdx < paidItems.length)) {
        slotCounter++;
        if (paidItems.length > 0 && paidIdx < paidItems.length && slotCounter % adFreq === 0) {
          playlist.push(paidItems[paidIdx]);
          totalDuration += paidItems[paidIdx].durationSec;
          paidIdx++;
        } else if (organicIdx < organicItems.length) {
          playlist.push(organicItems[organicIdx]);
          totalDuration += organicItems[organicIdx].durationSec;
          organicIdx++;
        } else if (paidIdx < paidItems.length) {
          playlist.push(paidItems[paidIdx]);
          totalDuration += paidItems[paidIdx].durationSec;
          paidIdx++;
        } else {
          break;
        }
      }

      if (playlist.length === 0) {
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        playlist.push({
          id: "fallback-coming-soon",
          type: "slide",
          templateKey: "hub_discovery",
          durationSec: 15,
          data: {
            hubName: effectiveHubSlug ? effectiveHubSlug.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) : "Your Community",
            tagline: "Coming Soon — Hub Screens",
            taglineEs: "Pr\u00f3ximamente — Pantallas del Hub",
          },
          assetUrl: null,
          qrUrl: `${baseUrl}/tv`,
          priority: 1,
          source: "auto",
        });
      }

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      for (const item of playlist) {
        if (item.qrUrl) {
          const params = new URLSearchParams({
            url: item.qrUrl,
            ...(effectiveHubSlug ? { hubSlug: effectiveHubSlug } : {}),
            ...(item.templateKey ? { templateKey: item.templateKey } : {}),
          });
          item.qrUrl = `${baseUrl}/api/tv/qr/${encodeURIComponent(item.id)}?${params.toString()}`;
        }
      }

      const totalDurationSec = playlist.reduce((sum, i) => sum + i.durationSec, 0);
      let syncStartTime: number | null = null;
      let screenGroupOffset = 0;
      let nextRefreshSec = 300;

      if (screenConfig?.screenGroupId) {
        const midnight = new Date();
        midnight.setHours(0, 0, 0, 0);
        syncStartTime = midnight.getTime();
        screenGroupOffset = screenConfig.screenGroupRole === "secondary" ? Math.floor(totalDurationSec / 2) : 0;
        nextRefreshSec = 60;
      }

      res.json({
        items: playlist,
        generatedAt: new Date().toISOString(),
        nextRefreshSec,
        languageMode,
        hubSlug: effectiveHubSlug || null,
        metroSlug: effectiveMetroSlug,
        totalDurationSec,
        itemCount: playlist.length,
        ...(syncStartTime ? { syncStartTime, screenGroupOffset } : {}),
      });
    } catch (error: any) {
      console.error("TV playlist error:", error);
      res.status(500).json({ error: "Failed to generate playlist" });
    }
  });

  app.get("/api/tv/qr/:itemId", async (req: Request, res: Response) => {
    try {
      const itemId = req.params.itemId as string;
      const { url, hubSlug, templateKey } = req.query as Record<string, string>;
      if (!url) return res.status(400).json({ error: "url required" });

      try {
        const parsed = new URL(url);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          return res.status(400).json({ error: "Invalid URL protocol" });
        }
      } catch {
        return res.status(400).json({ error: "Invalid URL" });
      }

      await storage.createTvQrScan({
        screenId: null,
        hubSlug: hubSlug || null,
        itemId: itemId,
        templateKey: templateKey || null,
        redirectUrl: url,
        userAgent: req.headers["user-agent"] || null,
        referrer: req.headers.referer || null,
      });

      res.redirect(url);
    } catch (error: any) {
      const url = req.query.url as string;
      if (url) {
        try {
          const parsed = new URL(url);
          if (["http:", "https:"].includes(parsed.protocol)) return res.redirect(url);
        } catch {}
      }
      res.status(500).json({ error: "QR tracking failed" });
    }
  });

  const playLogRateLimit = new Map<string, number>();
  app.post("/api/tv/play-log", async (req: Request, res: Response) => {
    try {
      const { screenKey, itemId, templateKey, durationSec, hubSlug } = req.body;
      if (!itemId || typeof itemId !== "string") return res.status(400).json({ error: "itemId required" });
      if (durationSec !== undefined && (typeof durationSec !== "number" || durationSec < 0 || durationSec > 600)) {
        return res.status(400).json({ error: "Invalid durationSec" });
      }

      const rateLimitKey = screenKey || req.ip || "unknown";
      const lastLog = playLogRateLimit.get(rateLimitKey) || 0;
      if (Date.now() - lastLog < 2000) {
        return res.json({ ok: true, throttled: true });
      }
      playLogRateLimit.set(rateLimitKey, Date.now());

      let screenId: string | undefined;
      if (screenKey) {
        const screen = await storage.getTvScreenByKey(screenKey);
        if (screen) screenId = screen.id;
      }

      await storage.createTvPlayLog({
        screenId: screenId || null,
        screenKey: screenKey || null,
        itemId: itemId.substring(0, 200),
        templateKey: templateKey ? String(templateKey).substring(0, 50) : null,
        durationSec: durationSec || null,
        hubSlug: hubSlug ? String(hubSlug).substring(0, 100) : null,
      });

      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: "Play log failed" });
    }
  });

  app.post("/api/tv/heartbeat", async (req: Request, res: Response) => {
    try {
      const { screenKey } = req.body;
      if (!screenKey) return res.status(400).json({ error: "screenKey required" });
      await storage.updateScreenHeartbeat(screenKey);
      res.json({ ok: true, timestamp: new Date().toISOString() });
    } catch (error: any) {
      console.error("TV heartbeat error:", error);
      res.status(500).json({ error: "Heartbeat failed" });
    }
  });

  app.post("/api/tv/onboard", async (req: Request, res: Response) => {
    try {
      const { venueName, venueAddress, hubSlug, contactName, contactEmail, contactPhone, languageMode, contentInterests, competitorCategories, citySlug } = req.body;

      if (!venueName || !contactName || !contactEmail) {
        return res.status(400).json({ error: "venueName, contactName, and contactEmail are required" });
      }

      let cityId: string | undefined;
      if (citySlug) {
        const city = await storage.getCityBySlug(citySlug);
        if (city) cityId = city.id;
      }

      const screen = await storage.createTvScreen({
        name: `${venueName} Screen`,
        cityId: cityId || null,
        metroSlug: citySlug || "charlotte",
        hubSlug: hubSlug || null,
        status: "inactive",
        languageMode: languageMode || "en",
        competitorProtectionEnabled: competitorCategories && competitorCategories.length > 0,
        protectedCategoryIds: competitorCategories || [],
        venueName,
        venueAddress: venueAddress || null,
        contactName,
        contactEmail,
        contactPhone: contactPhone || null,
        notes: contentInterests ? `Content interests: ${contentInterests.join(", ")}` : null,
      });

      try {
        const { crmContacts } = await import("@shared/schema");
        await db.insert(crmContacts).values({
          userId: "system",
          name: contactName,
          email: contactEmail,
          phone: contactPhone || null,
          company: venueName,
          source: "hub-screens" as any,
          cityId: cityId || null,
          notes: `Hub Screens onboarding: ${venueName}. Screen ID: ${screen.id}`,
        } as any);
      } catch (e) {
        console.log("CRM contact creation skipped:", e);
      }

      res.json({ success: true, screenId: screen.id, screenKey: screen.screenKey, message: "Your screen request has been submitted!" });
    } catch (error: any) {
      console.error("TV onboard error:", error);
      res.status(500).json({ error: "Onboarding failed" });
    }
  });

  app.get("/api/admin/tv/screens", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const screens = await storage.getTvScreens();
      res.json(screens);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/tv/screens", requireAdmin, async (req: Request, res: Response) => {
    try {
      const screen = await storage.createTvScreen(req.body);
      res.json(screen);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/tv/screens/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const screen = await storage.getTvScreen(req.params.id as string);
      if (!screen) return res.status(404).json({ error: "Screen not found" });
      res.json(screen);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/tv/screens/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const screen = await storage.updateTvScreen(req.params.id as string, req.body);
      if (!screen) return res.status(404).json({ error: "Screen not found" });
      res.json(screen);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/tv/screens/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await storage.deleteTvScreen(req.params.id as string);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/tv/screen-health", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const screens = await storage.getTvScreens();
      const now = Date.now();
      const health = screens.map(s => ({
        id: s.id,
        name: s.name,
        hubSlug: s.hubSlug,
        locationSlug: s.locationSlug,
        status: s.status,
        lastHeartbeatAt: s.lastHeartbeatAt,
        healthStatus: !s.lastHeartbeatAt ? "unknown"
          : (now - new Date(s.lastHeartbeatAt).getTime() < 2 * 60 * 1000) ? "healthy"
          : (now - new Date(s.lastHeartbeatAt).getTime() < 10 * 60 * 1000) ? "warning"
          : "offline",
      }));
      res.json(health);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/tv/items", requireAdmin, async (req: Request, res: Response) => {
    try {
      const filters: any = {};
      if (req.query.sourceScope) filters.sourceScope = String(req.query.sourceScope);
      if (req.query.type) filters.type = String(req.query.type);
      if (req.query.enabled) filters.enabled = req.query.enabled === "true";
      const items = await storage.getTvItems(filters);
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/tv/items", requireAdmin, async (req: Request, res: Response) => {
    try {
      const item = await storage.createTvItem(req.body);
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/tv/items/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const item = await storage.getTvItem(req.params.id as string);
      if (!item) return res.status(404).json({ error: "Item not found" });
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/tv/items/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const item = await storage.updateTvItem(req.params.id as string, req.body);
      if (!item) return res.status(404).json({ error: "Item not found" });
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/tv/items/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await storage.deleteTvItem(req.params.id as string);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/tv/placements", requireAdmin, async (req: Request, res: Response) => {
    try {
      const filters: any = {};
      if (req.query.enabled) filters.enabled = req.query.enabled === "true";
      const placements = await storage.getTvPlacements(filters);
      res.json(placements);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/tv/placements", requireAdmin, async (req: Request, res: Response) => {
    try {
      const placement = await storage.createTvPlacement(req.body);
      res.json(placement);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/tv/placements/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const placement = await storage.getTvPlacement(req.params.id as string);
      if (!placement) return res.status(404).json({ error: "Placement not found" });
      res.json(placement);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/tv/placements/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const placement = await storage.updateTvPlacement(req.params.id as string, req.body);
      if (!placement) return res.status(404).json({ error: "Placement not found" });
      res.json(placement);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/tv/placements/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await storage.deleteTvPlacement(req.params.id as string);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/tv/analytics", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { hubSlug, screenKey, days } = req.query as Record<string, string>;
      const since = new Date(Date.now() - (parseInt(days) || 30) * 24 * 60 * 60 * 1000);

      const qrScans = await storage.getTvQrScans({ hubSlug, since });
      const playLogs = await storage.getTvPlayLogs({ hubSlug, screenKey, since, limit: 10000 });
      const recentPlays = await storage.getTvPlayLogs({ hubSlug, screenKey, since, limit: 50 });
      const allScreens = await storage.getTvScreens({});

      const scansByDay: Record<string, number> = {};
      const impressionsByDay: Record<string, number> = {};
      const scansByTemplate: Record<string, number> = {};
      const impressionsByTemplate: Record<string, number> = {};
      const hourlyDistribution: { hour: number; scans: number; impressions: number }[] = Array.from({ length: 24 }, (_, i) => ({ hour: i, scans: 0, impressions: 0 }));
      const contentScans: Record<string, { count: number; templateKey: string; itemId: string }> = {};
      const contentImpressions: Record<string, { count: number; templateKey: string; itemId: string }> = {};
      const screenStats: Record<string, { impressions: number; scans: number }> = {};

      for (const s of qrScans) {
        const day = new Date(s.scannedAt).toISOString().slice(0, 10);
        scansByDay[day] = (scansByDay[day] || 0) + 1;
        const key = s.templateKey || "unknown";
        scansByTemplate[key] = (scansByTemplate[key] || 0) + 1;
        const hour = new Date(s.scannedAt).getHours();
        hourlyDistribution[hour].scans++;
        if (s.itemId) {
          if (!contentScans[s.itemId]) contentScans[s.itemId] = { count: 0, templateKey: key, itemId: s.itemId };
          contentScans[s.itemId].count++;
        }
        if (s.screenId) {
          if (!screenStats[s.screenId]) screenStats[s.screenId] = { impressions: 0, scans: 0 };
          screenStats[s.screenId].scans++;
        }
      }

      for (const p of playLogs) {
        const day = new Date(p.playedAt).toISOString().slice(0, 10);
        impressionsByDay[day] = (impressionsByDay[day] || 0) + 1;
        const key = p.templateKey || "unknown";
        impressionsByTemplate[key] = (impressionsByTemplate[key] || 0) + 1;
        const hour = new Date(p.playedAt).getHours();
        hourlyDistribution[hour].impressions++;
        if (p.itemId) {
          if (!contentImpressions[p.itemId]) contentImpressions[p.itemId] = { count: 0, templateKey: key, itemId: p.itemId };
          contentImpressions[p.itemId].count++;
        }
        if (p.screenId) {
          if (!screenStats[p.screenId]) screenStats[p.screenId] = { impressions: 0, scans: 0 };
          screenStats[p.screenId].impressions++;
        }
      }

      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
      const activeScreenCount = allScreens.filter(s => s.lastHeartbeatAt && new Date(s.lastHeartbeatAt) > tenMinAgo).length;
      const totalImpressions = playLogs.length;
      const engagementRate = totalImpressions > 0 ? Math.round((qrScans.length / totalImpressions) * 10000) / 100 : 0;

      const topContentByScans = Object.values(contentScans).sort((a, b) => b.count - a.count).slice(0, 10);
      const topContentByImpressions = Object.values(contentImpressions).sort((a, b) => b.count - a.count).slice(0, 10);

      const byScreen = allScreens.map(s => ({
        screenId: s.id,
        venueName: s.venueName || s.name,
        hubSlug: s.hubSlug,
        impressions: screenStats[s.id]?.impressions || 0,
        scans: screenStats[s.id]?.scans || 0,
        lastHeartbeat: s.lastHeartbeatAt,
        status: s.lastHeartbeatAt && new Date(s.lastHeartbeatAt) > tenMinAgo ? "online" : s.lastHeartbeatAt && new Date(s.lastHeartbeatAt) > new Date(Date.now() - 60 * 60 * 1000) ? "warning" : "offline",
      }));

      const allDays = new Set([...Object.keys(scansByDay), ...Object.keys(impressionsByDay)]);
      const dailyTimeSeries = Array.from(allDays).sort().map(date => ({
        date,
        scans: scansByDay[date] || 0,
        impressions: impressionsByDay[date] || 0,
      }));

      res.json({
        totalQrScans: qrScans.length,
        totalImpressions,
        engagementRate,
        activeScreenCount,
        totalScreenCount: allScreens.length,
        scansByDay,
        impressionsByDay,
        dailyTimeSeries,
        scansByTemplate: Object.entries(scansByTemplate).map(([templateKey, count]) => ({ templateKey, count })),
        impressionsByTemplate: Object.entries(impressionsByTemplate).map(([templateKey, count]) => ({ templateKey, count })),
        hourlyDistribution,
        topContentByScans,
        topContentByImpressions,
        byScreen,
        recentPlays: recentPlays.map(p => ({
          id: p.id,
          itemId: p.itemId,
          templateKey: p.templateKey,
          playedAt: p.playedAt,
          durationSec: p.durationSec,
          hubSlug: p.hubSlug,
          screenKey: p.screenKey,
        })),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/tv/venue/:screenKey", async (req: Request, res: Response) => {
    try {
      const screenKey = req.params.screenKey as string;
      const screen = await storage.getTvScreenByKey(screenKey);
      if (!screen) return res.status(404).json({ error: "Screen not found" });

      const venueItems = await storage.getTvItems({ enabled: true, hubSlug: screen.hubSlug || undefined });
      const venueSpecials = venueItems.filter(i =>
        i.sourceEntityType === "venue_special" && i.createdBy === screenKey
      );

      res.json({
        screen: {
          id: screen.id,
          name: screen.name,
          status: screen.status,
          hubSlug: screen.hubSlug,
          locationSlug: screen.locationSlug,
          languageMode: screen.languageMode,
          lastHeartbeatAt: screen.lastHeartbeatAt,
          venueName: screen.venueName,
          venueAddress: screen.venueAddress,
          notes: screen.notes,
        },
        specials: venueSpecials,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/tv/venue/:screenKey/settings", async (req: Request, res: Response) => {
    try {
      const screen = await storage.getTvScreenByKey(req.params.screenKey as string);
      if (!screen) return res.status(404).json({ error: "Screen not found" });

      const { languageMode, notes } = req.body;
      const updates: any = {};
      if (languageMode) updates.languageMode = languageMode;
      if (notes !== undefined) updates.notes = notes;

      const updated = await storage.updateTvScreen(screen.id, updates);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/tv/venue/:screenKey/specials", async (req: Request, res: Response) => {
    try {
      const screenKey = req.params.screenKey as string;
      const screen = await storage.getTvScreenByKey(screenKey);
      if (!screen) return res.status(404).json({ error: "Screen not found" });

      const existingItems = await storage.getTvItems({ hubSlug: screen.hubSlug || undefined });
      const venueSpecials = existingItems.filter(i =>
        i.sourceEntityType === "venue_special" && i.createdBy === screenKey
      );
      if (venueSpecials.length >= 3) {
        return res.status(400).json({ error: "Maximum 3 venue specials allowed" });
      }

      const { title, titleEs, specialText, specialTextEs, imageUrl } = req.body;
      if (!title) return res.status(400).json({ error: "title required" });

      const item = await storage.createTvItem({
        title,
        type: "slide",
        sourceScope: "location",
        hubSlug: screen.hubSlug,
        locationSlug: screen.locationSlug,
        templateKey: "venue_special",
        data: {
          venueName: screen.venueName || screen.name,
          specialText: specialText || title,
          specialTextEs: specialTextEs || titleEs || "",
          imageUrl: imageUrl || null,
        },
        enabled: true,
        priority: 7,
        sourceEntityType: "venue_special",
        createdBy: screenKey,
      });

      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/tv/venue/:screenKey/specials/:id", async (req: Request, res: Response) => {
    try {
      const screenKey = req.params.screenKey as string;
      const itemId = req.params.id as string;
      const screen = await storage.getTvScreenByKey(screenKey);
      if (!screen) return res.status(404).json({ error: "Screen not found" });

      const item = await storage.getTvItem(itemId);
      if (!item || item.createdBy !== screenKey) {
        return res.status(404).json({ error: "Item not found" });
      }

      const { title, titleEs, specialText, specialTextEs, imageUrl } = req.body;
      const updates: any = {};
      if (title) updates.title = title;
      if (req.body.data || specialText || imageUrl) {
        updates.data = {
          ...((item.data as any) || {}),
          ...(specialText ? { specialText } : {}),
          ...(specialTextEs ? { specialTextEs } : {}),
          ...(imageUrl !== undefined ? { imageUrl } : {}),
        };
      }

      const updated = await storage.updateTvItem(itemId, updates);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/tv/venue/:screenKey/specials/:id", async (req: Request, res: Response) => {
    try {
      const screenKey = req.params.screenKey as string;
      const itemId = req.params.id as string;
      const screen = await storage.getTvScreenByKey(screenKey);
      if (!screen) return res.status(404).json({ error: "Screen not found" });

      const item = await storage.getTvItem(itemId);
      if (!item || item.createdBy !== screenKey) {
        return res.status(404).json({ error: "Item not found" });
      }

      await storage.deleteTvItem(itemId);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  const triviaAnswers = new Map<string, Set<string>>();
  app.get("/api/tv/trivia/:questionId", async (req: Request, res: Response) => {
    try {
      const questionId = req.params.questionId as string;
      const item = await storage.getTvItem(questionId);
      if (!item || item.templateKey !== "trivia_question") {
        return res.status(404).json({ error: "Question not found" });
      }
      const data = (item.data as Record<string, any>) || {};
      const answers = data.answers || [];
      res.json({
        id: item.id,
        question: data.question || item.title,
        questionEs: data.questionEs || "",
        answers: answers.map((a: string) => a),
        category: data.category || "general",
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to load question" });
    }
  });

  app.post("/api/tv/trivia/:questionId/answer", async (req: Request, res: Response) => {
    try {
      const questionId = req.params.questionId as string;
      const item = await storage.getTvItem(questionId);
      if (!item || item.templateKey !== "trivia_question") {
        return res.status(404).json({ error: "Question not found" });
      }

      const ip = req.ip || "unknown";
      const key = `${questionId}:${ip}`;
      if (!triviaAnswers.has(questionId)) {
        triviaAnswers.set(questionId, new Set());
      }
      const answered = triviaAnswers.get(questionId)!;
      if (answered.has(ip)) {
        const data = (item.data as Record<string, any>) || {};
        const correctIdx = parseInt(data.correctIndex) || 0;
        const answers = data.answers || [];
        return res.json({
          alreadyAnswered: true,
          correct: parseInt(req.body.answer) === correctIdx,
          correctAnswer: answers[correctIdx] || String(correctIdx),
          funFact: data.funFact || "",
        });
      }
      answered.add(ip);

      const { answer, email } = req.body;
      if (answer === undefined) return res.status(400).json({ error: "answer required" });

      const data = (item.data as Record<string, any>) || {};
      const correctIdx = parseInt(data.correctIndex) || 0;
      const isCorrect = parseInt(answer) === correctIdx;

      if (email && typeof email === "string" && email.includes("@")) {
        try {
          await storage.createContact({
            name: "Trivia Player",
            email,
            source: "trivia",
            notes: `Trivia Q: ${item.title}, Answer: ${isCorrect ? "correct" : "wrong"}`,
          } as any);
        } catch (e) { /* CRM insert failed, not critical */ }
      }

      const answers = data.answers || [];
      res.json({
        correct: isCorrect,
        correctAnswer: answers[correctIdx] || String(correctIdx),
        funFact: data.funFact || "",
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to process answer" });
    }
  });

  app.patch("/api/admin/tv/screens/:id/group", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { screenGroupId, screenGroupRole } = req.body;
      const updates: any = {};
      if (screenGroupId !== undefined) updates.screenGroupId = screenGroupId || null;
      if (screenGroupRole !== undefined) updates.screenGroupRole = screenGroupRole || null;
      const updated = await storage.updateTvScreen(req.params.id as string, updates);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/tv/screen-groups", requireAdmin, async (req: Request, res: Response) => {
    try {
      const allScreens = await storage.getTvScreens({});
      const groups: Record<string, typeof allScreens> = {};
      for (const s of allScreens) {
        if (s.screenGroupId) {
          if (!groups[s.screenGroupId]) groups[s.screenGroupId] = [];
          groups[s.screenGroupId].push(s);
        }
      }
      res.json({ groups });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/tv/loops", requireAdmin, async (req: Request, res: Response) => {
    try {
      const filters: any = {};
      if (req.query.enabled !== undefined) filters.enabled = req.query.enabled === "true";
      if (req.query.theme) filters.theme = String(req.query.theme);
      if (req.query.daytimeTags) filters.daytimeTags = String(req.query.daytimeTags).split(",");
      const loops = await storage.getTvLoops(filters);
      res.json(loops);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/tv/loops", requireAdmin, async (req: Request, res: Response) => {
    try {
      const loop = await storage.createTvLoop(req.body);
      res.json(loop);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/tv/loops/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const loop = await storage.getTvLoop(req.params.id as string);
      if (!loop) return res.status(404).json({ error: "Loop not found" });
      res.json(loop);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/tv/loops/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const loop = await storage.updateTvLoop(req.params.id as string, req.body);
      if (!loop) return res.status(404).json({ error: "Loop not found" });
      res.json(loop);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/tv/loops/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await storage.deleteTvLoop(req.params.id as string);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/tv/loops/:id/items", requireAdmin, async (req: Request, res: Response) => {
    try {
      const items = await storage.getTvLoopItems(req.params.id as string);
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/tv/loops/:id/items", requireAdmin, async (req: Request, res: Response) => {
    try {
      const item = await storage.createTvLoopItem({ ...req.body, loopId: req.params.id as string });
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/tv/loops/:id/items", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { items } = req.body;
      if (!Array.isArray(items)) return res.status(400).json({ error: "items array required" });
      const result = await storage.bulkReplaceTvLoopItems(req.params.id as string, items);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/tv/schedules", requireAdmin, async (req: Request, res: Response) => {
    try {
      const filters: any = {};
      if (req.query.screenId) filters.screenId = String(req.query.screenId);
      if (req.query.hubSlug) filters.hubSlug = String(req.query.hubSlug);
      const schedules = await storage.getTvSchedules(filters);
      res.json(schedules);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/tv/schedules", requireAdmin, async (req: Request, res: Response) => {
    try {
      const schedule = await storage.createTvSchedule(req.body);
      res.json(schedule);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/tv/schedules/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const schedule = await storage.getTvSchedule(req.params.id as string);
      if (!schedule) return res.status(404).json({ error: "Schedule not found" });
      res.json(schedule);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/tv/schedules/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const schedule = await storage.updateTvSchedule(req.params.id as string, req.body);
      if (!schedule) return res.status(404).json({ error: "Schedule not found" });
      res.json(schedule);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/tv/schedules/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await storage.deleteTvSchedule(req.params.id as string);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/tv/host-phrases", requireAdmin, async (req: Request, res: Response) => {
    try {
      const filters: any = {};
      if (req.query.category) filters.category = String(req.query.category);
      if (req.query.theme) filters.theme = String(req.query.theme);
      const phrases = await storage.getTvHostPhrases(filters);
      res.json(phrases);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/tv/host-phrases", requireAdmin, async (req: Request, res: Response) => {
    try {
      const phrase = await storage.createTvHostPhrase(req.body);
      res.json(phrase);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/tv/host-phrases/random", requireAdmin, async (req: Request, res: Response) => {
    try {
      const category = String(req.query.category || "");
      if (!category) return res.status(400).json({ error: "category query param required" });
      const phrase = await storage.getRandomTvHostPhrase(category);
      if (!phrase) return res.status(404).json({ error: "No phrases found for category" });
      res.json(phrase);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/tv/host-phrases/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const phrase = await storage.updateTvHostPhrase(req.params.id as string, req.body);
      if (!phrase) return res.status(404).json({ error: "Host phrase not found" });
      res.json(phrase);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/tv/host-phrases/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await storage.deleteTvHostPhrase(req.params.id as string);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/tv/generate-narration", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { itemId, text, voiceProfile } = req.body;

      let narrationText = text;
      let targetItemId = itemId;

      if (targetItemId && !narrationText) {
        const item = await storage.getTvItem(targetItemId);
        if (!item) return res.status(404).json({ error: "Item not found" });
        narrationText = item.narrationText;
        if (!narrationText) return res.status(400).json({ error: "Item has no narration text" });
      }

      if (!narrationText) {
        return res.status(400).json({ error: "narrationText or itemId with narrationText required" });
      }

      const profile = voiceProfile || "warm_local_host";
      const { audioUrl } = await generateAndSaveNarration(narrationText, profile);

      if (targetItemId) {
        await storage.updateTvItem(targetItemId, {
          audioUrl,
          voiceProfile: profile,
          narrationEnabled: true,
        });
      }

      res.json({ audioUrl, voiceProfile: profile });
    } catch (error: any) {
      console.error("Generate narration error:", error);
      res.status(500).json({ error: error.message || "Failed to generate narration" });
    }
  });

  app.post("/api/admin/tv/generate-captions", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { itemId, narrationText: bodyText, durationSec } = req.body;

      let narrationText = bodyText;
      let targetItemId = itemId;
      let duration = durationSec;

      if (targetItemId && !narrationText) {
        const item = await storage.getTvItem(targetItemId);
        if (!item) return res.status(404).json({ error: "Item not found" });
        narrationText = item.narrationText;
        if (!narrationText) return res.status(400).json({ error: "Item has no narration text" });
        if (!duration && item.durationSec) duration = item.durationSec;
      }

      if (!narrationText) {
        return res.status(400).json({ error: "narrationText or itemId with narrationText required" });
      }

      const { captionUrl, vttContent } = await generateAndSaveCaptions(narrationText, duration);

      if (targetItemId) {
        await storage.updateTvItem(targetItemId, { captionUrl });
      }

      res.json({ captionUrl, vttContent });
    } catch (error: any) {
      console.error("Generate captions error:", error);
      res.status(500).json({ error: error.message || "Failed to generate captions" });
    }
  });

  app.get("/api/admin/tv/content-links", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { screenId, hubSlug, contentType, status } = req.query as Record<string, string>;
      const conditions = [];
      if (screenId) conditions.push(eq(tvVenueContentLinks.screenId, screenId));
      if (hubSlug) conditions.push(eq(tvVenueContentLinks.hubSlug, hubSlug));
      if (contentType) conditions.push(eq(tvVenueContentLinks.contentType, contentType as any));
      if (status) conditions.push(eq(tvVenueContentLinks.status, status as any));
      const rows = await db.select().from(tvVenueContentLinks)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(tvVenueContentLinks.createdAt));
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/tv/content-links", requireAdmin, async (req: Request, res: Response) => {
    try {
      const [row] = await db.insert(tvVenueContentLinks).values({
        ...req.body,
        createdBy: (req.session as any).userId,
      }).returning();
      res.json(row);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/tv/content-links/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const [row] = await db.select().from(tvVenueContentLinks).where(eq(tvVenueContentLinks.id, req.params.id));
      if (!row) return res.status(404).json({ error: "Not found" });
      res.json(row);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/tv/content-links/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const [row] = await db.update(tvVenueContentLinks)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(tvVenueContentLinks.id, req.params.id))
        .returning();
      if (!row) return res.status(404).json({ error: "Not found" });
      res.json(row);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/tv/content-links/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await db.delete(tvVenueContentLinks).where(eq(tvVenueContentLinks.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/tv/linkable-content", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { type } = req.query as Record<string, string>;
      const results: Array<{ id: string; title: string; type: string; status?: string }> = [];
      if (!type || type === "quiz") {
        const q = await db.select({ id: quizzes.id, title: quizzes.title, isActive: quizzes.isActive }).from(quizzes).limit(50);
        for (const r of q) results.push({ id: r.id, title: r.title, type: "quiz", status: r.isActive ? "active" : "inactive" });
      }
      if (!type || type === "giveaway") {
        const g = await db.select({ id: giveaways.id, title: giveaways.title, status: giveaways.status }).from(giveaways).limit(50);
        for (const r of g) results.push({ id: r.id, title: r.title, type: "giveaway", status: r.status });
      }
      if (!type || type === "job") {
        const j = await db.select({ id: jobs.id, title: jobs.title, jobStatus: jobs.jobStatus, employer: jobs.employer }).from(jobs).limit(50);
        for (const r of j) results.push({ id: r.id, title: `${r.title} — ${r.employer}`, type: "job", status: r.jobStatus });
      }
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/tv/demo-playlist", async (_req: Request, res: Response) => {
    try {
      const demoItems: PlaylistItem[] = [
        {
          id: "demo-weather",
          type: "slide",
          templateKey: "weather_current",
          durationSec: 10,
          data: {
            city: "Charlotte",
            temp: 72,
            condition: "Partly Cloudy",
            conditionEs: "Parcialmente Nublado",
            high: 78,
            low: 62,
            humidity: 55,
            wind: 8,
            icon: "cloud-sun",
            forecast: [
              { day: "Tue", high: 80, low: 64, icon: "sun" },
              { day: "Wed", high: 75, low: 60, icon: "cloud-rain" },
              { day: "Thu", high: 73, low: 58, icon: "cloud-sun" },
            ],
          },
          priority: 5,
          source: "auto",
        },
        {
          id: "demo-event",
          type: "slide",
          templateKey: "hub_event",
          durationSec: 10,
          data: {
            title: "South End Friday Night Market",
            titleEs: "Mercado Nocturno de South End",
            date: new Date(Date.now() + 86400000 * 3).toISOString(),
            time: "6:00 PM - 10:00 PM",
            location: "Atherton Mill, South End",
            categoryBadge: "Community",
            description: "Live music, local vendors, food trucks, and family fun every Friday night.",
            descriptionEs: "Musica en vivo, vendedores locales, food trucks y diversion familiar cada viernes.",
          },
          priority: 7,
          source: "hub",
        },
        {
          id: "demo-spotlight",
          type: "slide",
          templateKey: "neighborhood_spotlight",
          durationSec: 10,
          data: {
            businessName: "Queen City Grounds",
            description: "Award-winning specialty coffee roaster and cafe in the heart of NoDa, serving single-origin pour-overs since 2018.",
            descriptionEs: "Tostador y cafe de especialidad galardonado en el corazon de NoDa.",
            rating: "4.8",
            categoryBadge: "Coffee & Tea",
          },
          priority: 5,
          source: "hub",
        },
        {
          id: "demo-quiz",
          type: "slide",
          templateKey: "quiz_promo",
          durationSec: 12,
          data: {
            title: "How Well Do You Know Charlotte?",
            titleEs: "Que tan bien conoces Charlotte?",
            description: "Test your knowledge of the Queen City — neighborhoods, history, food, and hidden gems.",
            descriptionEs: "Pon a prueba tu conocimiento de la Ciudad Reina.",
            questionCount: "15",
            timeLimit: "5",
            prizeText: "Win a $50 Gift Card",
          },
          priority: 8,
          source: "hub",
        },
        {
          id: "demo-giveaway",
          type: "slide",
          templateKey: "giveaway_promo",
          durationSec: 12,
          data: {
            title: "Summer in the City Giveaway",
            titleEs: "Sorteo de Verano en la Ciudad",
            prizeDescription: "VIP Weekend Package: Dinner, Show Tickets & Hotel Stay",
            prizeDescriptionEs: "Paquete VIP: Cena, Entradas y Hotel",
            sponsorName: "Charlotte Tourism Board",
            endsAt: "August 31, 2026",
          },
          priority: 8,
          source: "hub",
        },
        {
          id: "demo-jobs",
          type: "slide",
          templateKey: "job_listing",
          durationSec: 12,
          data: {
            headline: "Now Hiring in South End",
            headlineEs: "Contratando en South End",
            hubName: "South End",
            totalJobs: "24",
            jobs: [
              { title: "Barista", employer: "Queen City Grounds", type: "Full-time", pay: "$16-18/hr" },
              { title: "Line Cook", employer: "Haberdish", type: "Full-time", pay: "$17-22/hr" },
              { title: "Event Coordinator", employer: "Atherton Mill", type: "Full-time", pay: "$45k-55k" },
              { title: "Retail Associate", employer: "Lenny Boy Brewing", type: "Part-time", pay: "$14/hr" },
            ],
          },
          priority: 6,
          source: "hub",
        },
        {
          id: "demo-trivia",
          type: "slide",
          templateKey: "trivia_question",
          durationSec: 15,
          data: {
            question: "What year was Charlotte officially incorporated?",
            questionEs: "En que ano fue Charlotte oficialmente incorporada?",
            answers: ["1768", "1775", "1790", "1825"],
            correctIndex: 1,
            funFact: "Charlotte was named after Queen Charlotte of Mecklenburg-Strelitz, the wife of King George III.",
            category: "History",
          },
          priority: 5,
          source: "auto",
        },
        {
          id: "demo-nonprofit",
          type: "slide",
          templateKey: "nonprofit_showcase",
          durationSec: 10,
          data: {
            name: "Charlotte Area Fund",
            nameEs: "Fondo del Area de Charlotte",
            mission: "Empowering families to achieve economic self-sufficiency through education and financial literacy.",
            missionEs: "Empoderando familias para lograr autosuficiencia economica.",
            description: "Since 1965, we have served over 100,000 residents across Mecklenburg County.",
            impactStat: "100,000+",
            impactLabel: "Residents Served",
          },
          priority: 5,
          source: "hub",
        },
        {
          id: "demo-venue-special",
          type: "slide",
          templateKey: "venue_special",
          durationSec: 10,
          data: {
            venueName: "Haberdish",
            specialText: "Happy Hour: $6 cocktails and $2 off all draft beers, Mon-Fri 4-7 PM",
            specialTextEs: "Happy Hour: Cocteles a $6 y $2 de descuento en cervezas, Lun-Vie 4-7 PM",
          },
          priority: 6,
          source: "location",
        },
      ];

      res.json({
        items: demoItems,
        generatedAt: new Date().toISOString(),
        nextRefreshSec: 300,
        languageMode: "en",
        hubSlug: "south-end",
        metroSlug: "charlotte",
        totalDurationSec: demoItems.reduce((s, i) => s + i.durationSec, 0),
        itemCount: demoItems.length,
        mode: "demo",
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
