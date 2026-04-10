import { storage } from "../storage";
import { getWeather } from "./weather-service";
import { getLocalSportsScores } from "./sports-service";
import { getTonightEvents, getWeekendEvents } from "./tv-event-helpers";
import { db } from "../db";
import { expertShowSlots, businesses, cities } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import type { TvScreen, TvLoop, TvLoopItem, TvItem, TvSchedule, TvPlacement, VideoContent, LiveSession } from "@shared/schema";

export interface ChannelPlaylistItem {
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
  source: "metro" | "hub" | "location" | "auto" | "loop";
  audioUrl?: string | null;
  captionUrl?: string | null;
  subtitleText?: string | null;
  narrationEnabled?: boolean;
  loopId?: string;
  loopName?: string;
  sectionLabel?: string | null;
}

interface ScreenConfig {
  screenId?: string;
  metroSlug: string;
  hubSlug?: string;
  locationSlug?: string;
  activeScheduleId?: string | null;
  activeLoopIds?: string[];
  protectedCategoryIds?: string[];
  excludedBusinessIds?: string[];
  venueInsertFrequencyMinutes: number;
  spokenSegmentMinGapMinutes: number;
  narrationDefaultEnabled: boolean;
  subtitleDefaultEnabled: boolean;
  allowMetroFallback: boolean;
  allowHubFallback: boolean;
  preferredVoiceProfile?: string | null;
  playlistSettings?: {
    slideDurationDefaultSec?: number;
    videoDurationMaxSec?: number;
    loopTargetMin?: number;
    venuePromoFrequencyMin?: number;
    adSlotFrequencyMin?: number;
  };
}

function getDayName(): string {
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return days[new Date().getDay()];
}

function getCurrentTimeHHMM(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function timeInRange(current: string, start: string, end: string): boolean {
  if (start <= end) {
    return current >= start && current <= end;
  }
  return current >= start || current <= end;
}

function hasOverlap(arr1: string[], arr2: string[]): boolean {
  return arr1.some(id => arr2.includes(id));
}

function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function resolveScreenConfig(screen: TvScreen): ScreenConfig {
  const settings = (screen.playlistSettings as any) || {};
  return {
    screenId: screen.id,
    metroSlug: screen.metroSlug || "charlotte",
    hubSlug: screen.hubSlug || undefined,
    locationSlug: screen.locationSlug || undefined,
    activeScheduleId: screen.activeScheduleId,
    activeLoopIds: screen.activeLoopIds || [],
    protectedCategoryIds: screen.protectedCategoryIds || [],
    excludedBusinessIds: screen.excludedBusinessIds || [],
    venueInsertFrequencyMinutes: screen.venueInsertFrequencyMinutes ?? 6,
    spokenSegmentMinGapMinutes: screen.spokenSegmentMinGapMinutes ?? 4,
    narrationDefaultEnabled: screen.narrationDefaultEnabled ?? true,
    subtitleDefaultEnabled: screen.subtitleDefaultEnabled ?? true,
    allowMetroFallback: screen.allowMetroFallback ?? true,
    allowHubFallback: screen.allowHubFallback ?? true,
    preferredVoiceProfile: screen.preferredVoiceProfile,
    playlistSettings: {
      slideDurationDefaultSec: settings.slideDurationDefaultSec ?? 9,
      videoDurationMaxSec: settings.videoDurationMaxSec ?? 60,
      loopTargetMin: settings.loopTargetMin ?? 20,
      venuePromoFrequencyMin: settings.venuePromoFrequencyMin ?? 3,
      adSlotFrequencyMin: settings.adSlotFrequencyMin ?? 6,
    },
  };
}

async function resolveActiveSchedule(config: ScreenConfig): Promise<TvSchedule | null> {
  if (config.activeScheduleId) {
    const schedule = await storage.getTvSchedule(config.activeScheduleId);
    if (schedule && schedule.enabled) {
      const currentDay = getDayName();
      const currentTime = getCurrentTimeHHMM();
      const dayMatch = !schedule.dayOfWeek || schedule.dayOfWeek.length === 0 ||
        schedule.dayOfWeek.includes(currentDay);
      const timeMatch = timeInRange(currentTime, schedule.startTime, schedule.endTime);
      if (dayMatch && timeMatch) return schedule;
    }
  }

  if (config.screenId) {
    const schedules = await storage.getTvSchedules({ screenId: config.screenId });
    const currentDay = getDayName();
    const currentTime = getCurrentTimeHHMM();
    for (const s of schedules) {
      if (!s.enabled) continue;
      const dayMatch = !s.dayOfWeek || s.dayOfWeek.length === 0 || s.dayOfWeek.includes(currentDay);
      const timeMatch = timeInRange(currentTime, s.startTime, s.endTime);
      if (dayMatch && timeMatch) return s;
    }
  }

  if (config.hubSlug) {
    const schedules = await storage.getTvSchedules({ hubSlug: config.hubSlug });
    const currentDay = getDayName();
    const currentTime = getCurrentTimeHHMM();
    for (const s of schedules) {
      if (!s.enabled) continue;
      const dayMatch = !s.dayOfWeek || s.dayOfWeek.length === 0 || s.dayOfWeek.includes(currentDay);
      const timeMatch = timeInRange(currentTime, s.startTime, s.endTime);
      if (dayMatch && timeMatch) return s;
    }
  }

  return null;
}

function pickLoopsFromSchedule(
  schedule: TvSchedule,
  allLoops: TvLoop[],
  lastPlayedLoopId?: string
): TvLoop[] {
  const loopIds = schedule.loopIds || [];
  if (loopIds.length === 0) return allLoops.filter(l => l.enabled);

  let eligible = allLoops.filter(l => loopIds.includes(l.id) && l.enabled);
  if (eligible.length === 0) {
    if (schedule.fallbackLoopId) {
      const fallback = allLoops.find(l => l.id === schedule.fallbackLoopId && l.enabled);
      if (fallback) return [fallback];
    }
    return [];
  }

  if (schedule.noConsecutiveRepeat && lastPlayedLoopId && eligible.length > 1) {
    eligible = eligible.filter(l => l.id !== lastPlayedLoopId);
  }

  switch (schedule.weightingStrategy) {
    case "sequential":
      return eligible;

    case "alternating":
      return shuffleArray(eligible);

    case "weighted_random":
    default:
      return shuffleArray(eligible);
  }
}

function orderLoopItems(
  loopItems: TvLoopItem[],
  tvItemsMap: Map<string, TvItem>,
  orderStrategy: string
): TvLoopItem[] {
  const required = loopItems.filter(li => li.isRequired);
  const optional = loopItems.filter(li => !li.isRequired);

  switch (orderStrategy) {
    case "fixed":
      return [...loopItems].sort((a, b) => a.position - b.position);

    case "weighted_shuffle": {
      const weightedOptional: TvLoopItem[] = [];
      for (const item of optional) {
        for (let i = 0; i < (item.weight || 1); i++) {
          weightedOptional.push(item);
        }
      }
      const shuffled = shuffleArray(weightedOptional);
      const seen = new Set<string>();
      const deduped = shuffled.filter(item => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
      return [...required.sort((a, b) => a.position - b.position), ...deduped];
    }

    case "semi_random":
    default: {
      const sections: Record<string, TvLoopItem[]> = {};
      for (const item of loopItems) {
        const label = item.sectionLabel || "__default__";
        if (!sections[label]) sections[label] = [];
        sections[label].push(item);
      }
      const result: TvLoopItem[] = [];
      const sectionKeys = Object.keys(sections);
      for (const key of sectionKeys) {
        const sectionItems = sections[key];
        const requiredInSection = sectionItems.filter((i: TvLoopItem) => i.isRequired).sort((a: TvLoopItem, b: TvLoopItem) => a.position - b.position);
        const optionalInSection = shuffleArray(sectionItems.filter((i: TvLoopItem) => !i.isRequired));
        result.push(...requiredInSection, ...optionalInSection);
      }
      return result;
    }
  }
}

async function getVenueInsertItems(
  config: ScreenConfig,
  tvItemsMap: Map<string, TvItem>,
  defaultDuration: number
): Promise<ChannelPlaylistItem[]> {
  const items: ChannelPlaylistItem[] = [];
  try {
    const activePlacements = await storage.getTvPlacements({ enabled: true });
    const now = new Date();

    for (const p of activePlacements) {
      if (p.startAt && new Date(p.startAt) > now) continue;
      if (p.endAt && new Date(p.endAt) < now) continue;
      if (p.hubSlug && config.hubSlug && p.hubSlug !== config.hubSlug) continue;
      if (p.screenId && config.screenId && p.screenId !== config.screenId) continue;

      if (config.protectedCategoryIds && config.protectedCategoryIds.length > 0 && p.competitorSensitive) {
        if (p.competitorCategoryIds && hasOverlap(p.competitorCategoryIds, config.protectedCategoryIds)) {
          continue;
        }
      }

      if (p.tvItemId) {
        const linkedItem = tvItemsMap.get(p.tvItemId) || await storage.getTvItem(p.tvItemId);
        if (linkedItem && linkedItem.enabled) {
          if (config.excludedBusinessIds && config.excludedBusinessIds.length > 0) {
            if (linkedItem.sourceEntityId && config.excludedBusinessIds.includes(linkedItem.sourceEntityId)) continue;
          }

          items.push({
            id: linkedItem.id,
            type: linkedItem.type as "slide" | "video",
            templateKey: linkedItem.templateKey || "venue_special",
            durationSec: linkedItem.durationSec || defaultDuration,
            data: (linkedItem.data as Record<string, any>) || {},
            assetUrl: linkedItem.assetUrl,
            videoUrl: linkedItem.videoUrl,
            clickUrl: linkedItem.clickUrl,
            qrUrl: linkedItem.qrUrl,
            priority: 9,
            source: "hub",
            audioUrl: linkedItem.audioUrl,
            captionUrl: linkedItem.captionUrl,
            subtitleText: linkedItem.subtitleText,
            narrationEnabled: linkedItem.narrationEnabled,
          });
        }
      }
    }
  } catch (e) {}
  return items;
}

async function getLiveDataItems(
  config: ScreenConfig,
  defaultDuration: number,
  baseUrl: string
): Promise<ChannelPlaylistItem[]> {
  const items: ChannelPlaylistItem[] = [];

  try {
    const weather = await getWeather();
    if (weather) {
      items.push({
        id: "auto-weather",
        type: "slide",
        templateKey: "weather_current",
        durationSec: defaultDuration + 1,
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
  } catch (e) {}

  try {
    const scores = await getLocalSportsScores();
    if (scores && scores.length > 0) {
      const hasLive = scores.some(g => g.status === "in");
      items.push({
        id: "auto-sports",
        type: "slide",
        templateKey: "sports_scores",
        durationSec: defaultDuration + 3,
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
  } catch (e) {}

  try {
    const hour = new Date().getHours();
    const isRushHour = (hour >= 7 && hour < 9) || (hour >= 16 && hour < 19);
    if (isRushHour) {
      items.push({
        id: "auto-traffic",
        type: "slide",
        templateKey: "traffic_update",
        durationSec: defaultDuration,
        data: {},
        assetUrl: null,
        qrUrl: "https://tims.ncdot.gov/tims/",
        priority: 5,
        source: "auto",
      });
    }
  } catch (e) {}

  try {
    const tonightEvents = await getTonightEvents(config.metroSlug, config.hubSlug, config.locationSlug);
    const currentHour = new Date().getHours();
    const tonightQrPath = config.hubSlug
      ? `${baseUrl}/${config.metroSlug}/hub/${config.hubSlug}/events?filter=tonight`
      : `${baseUrl}/${config.metroSlug}/events?filter=tonight`;

    items.push({
      id: "auto-tonight-around-you",
      type: "slide",
      templateKey: "tonight_around_you",
      durationSec: defaultDuration + 2,
      data: {
        headline: "Tonight Around You",
        headlineEs: "Esta Noche Cerca de Ti",
        subline: "What's happening nearby",
        sublineEs: "Qu\u00e9 est\u00e1 pasando cerca",
        events: tonightEvents,
      },
      assetUrl: null,
      qrUrl: tonightQrPath,
      priority: currentHour >= 16 ? 7 : 5,
      source: "auto",
    });
  } catch (e) {}

  try {
    const weekendEvents = await getWeekendEvents(config.metroSlug, config.hubSlug, config.locationSlug);
    const dayOfWeek = new Date().getDay();
    const weekendQrPath = config.hubSlug
      ? `${baseUrl}/${config.metroSlug}/hub/${config.hubSlug}/events?filter=weekend`
      : `${baseUrl}/${config.metroSlug}/events?filter=weekend`;

    let weekendPriority = 3;
    if (dayOfWeek === 4) weekendPriority = 6;
    if (dayOfWeek === 5 || dayOfWeek === 6) weekendPriority = 7;
    if (dayOfWeek === 0) weekendPriority = 6;

    items.push({
      id: "auto-this-weekend",
      type: "slide",
      templateKey: "this_weekend",
      durationSec: defaultDuration + 2,
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
  } catch (e) {}

  return items;
}

function applyNarrationSpacing(
  playlist: ChannelPlaylistItem[],
  minGapMinutes: number,
  narrationEnabled: boolean
): ChannelPlaylistItem[] {
  if (!narrationEnabled) {
    return playlist.map(item => ({ ...item, narrationEnabled: false }));
  }

  const minGapSec = minGapMinutes * 60;
  let timeSinceLastNarration = minGapSec;

  return playlist.map(item => {
    if (item.narrationEnabled && item.audioUrl) {
      if (timeSinceLastNarration >= minGapSec) {
        timeSinceLastNarration = 0;
        return item;
      } else {
        timeSinceLastNarration += item.durationSec;
        return { ...item, narrationEnabled: false };
      }
    }
    timeSinceLastNarration += item.durationSec;
    return item;
  });
}

function applyCompetitorExclusion(
  playlist: ChannelPlaylistItem[],
  protectedCategoryIds: string[],
  excludedBusinessIds: string[]
): ChannelPlaylistItem[] {
  if (protectedCategoryIds.length === 0 && excludedBusinessIds.length === 0) return playlist;

  return playlist.filter(item => {
    const data = item.data || {};
    if (excludedBusinessIds.length > 0 && data.businessId && excludedBusinessIds.includes(data.businessId)) {
      return false;
    }
    if (protectedCategoryIds.length > 0 && data.categoryIds && Array.isArray(data.categoryIds)) {
      if (hasOverlap(data.categoryIds, protectedCategoryIds)) return false;
    }
    return true;
  });
}

function applyAntiFatigue(playlist: ChannelPlaylistItem[]): ChannelPlaylistItem[] {
  const result: ChannelPlaylistItem[] = [];
  const recentTemplates: string[] = [];
  const recentNarratedIds = new Set<string>();
  const TEMPLATE_GAP = 3;

  for (const item of playlist) {
    const lastIdx = recentTemplates.lastIndexOf(item.templateKey);
    if (lastIdx >= 0 && recentTemplates.length - lastIdx < TEMPLATE_GAP && result.length > TEMPLATE_GAP) {
      result.push(item);
    } else {
      result.push(item);
    }
    recentTemplates.push(item.templateKey);

    if (item.narrationEnabled && item.audioUrl) {
      if (recentNarratedIds.has(item.id)) {
        item.narrationEnabled = false;
      }
      recentNarratedIds.add(item.id);
    }
  }

  return result;
}

async function getVenueChannelItems(
  config: ScreenConfig,
  defaultDuration: number,
  baseUrl: string
): Promise<ChannelPlaylistItem[]> {
  const items: ChannelPlaylistItem[] = [];
  const metroSlug = config.metroSlug || "charlotte";

  try {
    const cities = await storage.getAllCities();
    const city = cities.find(c => c.slug === metroSlug);
    if (!city) return items;

    const activeSessions = await storage.getActiveLiveSessions(city.id);
    for (const session of activeSessions) {
      if (config.excludedBusinessIds && config.excludedBusinessIds.length > 0) {
        if (config.excludedBusinessIds.includes(session.businessId)) continue;
      }

      const business = await storage.getBusinessById(session.businessId);
      const businessName = business?.name || "Local Business";
      const channelSlug = session.venueChannelId
        ? (await storage.getVenueChannel(session.venueChannelId))?.channelSlug
        : null;

      const watchUrl = channelSlug
        ? `${baseUrl}/${metroSlug}/channel/${channelSlug}`
        : session.youtubeLiveUrl || `${baseUrl}/${metroSlug}`;

      items.push({
        id: `live-session-${session.id}`,
        type: "slide",
        templateKey: "youtube_live_now",
        durationSec: defaultDuration + 3,
        data: {
          title: session.title,
          description: session.description || "",
          businessName,
          youtubeVideoId: session.youtubeVideoId || "",
          youtubeLiveUrl: session.youtubeLiveUrl || "",
          thumbnailUrl: session.thumbnailUrl || "",
          startTime: session.startTime ? new Date(session.startTime).toISOString() : "",
        },
        assetUrl: session.thumbnailUrl,
        qrUrl: watchUrl,
        priority: 10,
        source: "auto",
      });
    }

    const screenEligibleVideos = await storage.listVideosByCity(city.id, { screenEligible: true });
    for (const video of screenEligibleVideos) {
      if (config.excludedBusinessIds && config.excludedBusinessIds.length > 0) {
        if (video.businessId && config.excludedBusinessIds.includes(video.businessId)) continue;
      }

      const business = video.businessId ? await storage.getBusinessById(video.businessId) : null;
      const businessName = business?.name || "";
      const channelSlug = video.venueChannelId
        ? (await storage.getVenueChannel(video.venueChannelId))?.channelSlug
        : null;

      const watchUrl = channelSlug
        ? `${baseUrl}/${metroSlug}/channel/${channelSlug}`
        : video.youtubeUrl || `${baseUrl}/${metroSlug}`;

      items.push({
        id: `yt-video-${video.id}`,
        type: "slide",
        templateKey: "youtube_video",
        durationSec: Math.min(video.durationSec || defaultDuration + 2, 30),
        data: {
          title: video.title,
          description: video.description || "",
          businessName,
          youtubeVideoId: video.youtubeVideoId || "",
          youtubeUrl: video.youtubeUrl || "",
          thumbnailUrl: video.thumbnailUrl || "",
        },
        assetUrl: video.thumbnailUrl,
        qrUrl: watchUrl,
        priority: 6,
        source: "auto",
      });
    }
  } catch (e) {}

  return items;
}

async function getExpertShowItems(
  config: ScreenConfig,
  defaultDuration: number,
  baseUrl: string
): Promise<ChannelPlaylistItem[]> {
  const items: ChannelPlaylistItem[] = [];
  const currentDay = getDayName();
  const currentTime = getCurrentTimeHHMM();
  const metroSlug = config.metroSlug || "charlotte";

  try {
    const allCities = await storage.getAllCities();
    const city = allCities.find(c => c.slug === metroSlug);
    if (!city) return items;

    const activeSlots = await db.select().from(expertShowSlots)
      .where(and(
        eq(expertShowSlots.status, "active"),
        eq(expertShowSlots.cityId, city.id),
      ));

    for (const slot of activeSlots) {
      if (slot.hubSlug && config.hubSlug && slot.hubSlug !== config.hubSlug) continue;

      const dayMatch = !slot.dayOfWeek || slot.dayOfWeek.length === 0 ||
        slot.dayOfWeek.includes(currentDay);
      if (!dayMatch) continue;

      const slotEndHour = parseInt(slot.startTime.split(":")[0]) +
        Math.floor(slot.durationMinutes / 60);
      const slotEndMin = parseInt(slot.startTime.split(":")[1] || "0") +
        (slot.durationMinutes % 60);
      const endTime = `${String(slotEndHour + Math.floor(slotEndMin / 60)).padStart(2, "0")}:${String(slotEndMin % 60).padStart(2, "0")}`;

      if (!timeInRange(currentTime, slot.startTime, endTime)) continue;

      let businessName = "";
      if (slot.businessId) {
        const biz = await storage.getBusinessById(slot.businessId);
        businessName = biz?.name || "";
      }

      const segmentLabels: Record<string, string> = {
        real_estate_update: "Real Estate Update",
        health_tips: "Health Tips",
        small_business_strategy: "Small Business Strategy",
        restaurant_highlights: "Restaurant Highlights",
        general: "Expert Show",
      };

      items.push({
        id: `expert-show-${slot.id}`,
        type: "slide",
        templateKey: "expert_show",
        durationSec: slot.durationMinutes * 60,
        data: {
          expertName: slot.expertName,
          showTitle: slot.showTitle,
          showDescription: slot.showDescription || "",
          segmentType: slot.segmentType,
          segmentLabel: segmentLabels[slot.segmentType] || "Expert Show",
          businessName,
          thumbnailUrl: slot.thumbnailUrl || "",
          startTime: slot.startTime,
          durationMinutes: slot.durationMinutes,
        },
        assetUrl: slot.thumbnailUrl || null,
        qrUrl: `${baseUrl}/${metroSlug}`,
        priority: 10,
        source: "auto",
      });
    }
  } catch (e) {}

  return items;
}

export async function assembleChannelPlaylist(
  screenOrConfig: TvScreen | ScreenConfig,
  baseUrl: string
): Promise<{
  items: ChannelPlaylistItem[];
  loopId?: string;
  loopName?: string;
  scheduleId?: string;
  scheduleName?: string;
}> {
  const config: ScreenConfig = "screenKey" in screenOrConfig
    ? resolveScreenConfig(screenOrConfig as TvScreen)
    : screenOrConfig as ScreenConfig;

  const settings = config.playlistSettings || {};
  const defaultDuration = settings.slideDurationDefaultSec || 9;

  const schedule = await resolveActiveSchedule(config);
  if (!schedule) {
    return { items: [] };
  }

  const allLoops = await storage.getTvLoops({ enabled: true });

  const selectedLoops = pickLoopsFromSchedule(schedule, allLoops);
  if (selectedLoops.length === 0) {
    return { items: [], scheduleId: schedule.id, scheduleName: schedule.name };
  }

  const primaryLoop = selectedLoops[0];

  const loopItems = await storage.getTvLoopItems(primaryLoop.id);
  if (loopItems.length === 0) {
    return {
      items: [],
      loopId: primaryLoop.id,
      loopName: primaryLoop.name,
      scheduleId: schedule.id,
      scheduleName: schedule.name,
    };
  }

  const tvItemIds = loopItems.map(li => li.tvItemId).filter(Boolean) as string[];
  const tvItemsMap = new Map<string, TvItem>();
  for (const itemId of tvItemIds) {
    const tvItem = await storage.getTvItem(itemId);
    if (tvItem) tvItemsMap.set(itemId, tvItem);
  }

  const orderedLoopItems = orderLoopItems(loopItems, tvItemsMap, primaryLoop.orderStrategy);

  const playlist: ChannelPlaylistItem[] = [];
  for (const li of orderedLoopItems) {
    if (!li.tvItemId) continue;
    const tvItem = tvItemsMap.get(li.tvItemId);
    if (!tvItem || !tvItem.enabled) continue;

    const now = new Date();
    if (tvItem.startAt && new Date(tvItem.startAt) > now) continue;
    if (tvItem.endAt && new Date(tvItem.endAt) < now) continue;

    const duration = li.durationOverrideSec || tvItem.durationSec || defaultDuration;

    playlist.push({
      id: tvItem.id,
      type: tvItem.type as "slide" | "video",
      templateKey: tvItem.templateKey || "hub_discovery",
      durationSec: tvItem.type === "video"
        ? Math.min(duration, settings.videoDurationMaxSec || 60)
        : duration,
      data: (tvItem.data as Record<string, any>) || {},
      assetUrl: tvItem.assetUrl,
      videoUrl: tvItem.videoUrl,
      clickUrl: tvItem.clickUrl,
      qrUrl: tvItem.qrUrl,
      priority: tvItem.priority,
      source: "loop",
      audioUrl: tvItem.audioUrl,
      captionUrl: tvItem.captionUrl,
      subtitleText: tvItem.subtitleText,
      narrationEnabled: tvItem.narrationEnabled,
      loopId: primaryLoop.id,
      loopName: primaryLoop.name,
      sectionLabel: li.sectionLabel,
    });
  }

  const venueInsertItems = await getVenueInsertItems(config, tvItemsMap, defaultDuration);
  const venueFreqSec = config.venueInsertFrequencyMinutes * 60;

  if (venueInsertItems.length > 0 && venueFreqSec > 0) {
    const finalPlaylist: ChannelPlaylistItem[] = [];
    let cumulativeDuration = 0;
    let nextVenueInsertAt = venueFreqSec;
    let venueIdx = 0;
    const recentVenueIds = new Set<string>();

    for (const item of playlist) {
      finalPlaylist.push(item);
      cumulativeDuration += item.durationSec;

      if (cumulativeDuration >= nextVenueInsertAt && venueInsertItems.length > 0) {
        let insertItem: ChannelPlaylistItem | null = null;

        for (let attempts = 0; attempts < venueInsertItems.length; attempts++) {
          const candidate = venueInsertItems[venueIdx % venueInsertItems.length];
          venueIdx++;
          if (!recentVenueIds.has(candidate.id)) {
            insertItem = candidate;
            break;
          }
        }

        if (!insertItem) {
          recentVenueIds.clear();
          insertItem = venueInsertItems[venueIdx % venueInsertItems.length];
          venueIdx++;
        }

        finalPlaylist.push({ ...insertItem, loopId: primaryLoop.id, loopName: primaryLoop.name });
        recentVenueIds.add(insertItem.id);
        cumulativeDuration += insertItem.durationSec;
        nextVenueInsertAt = cumulativeDuration + venueFreqSec;
      }
    }

    playlist.length = 0;
    playlist.push(...finalPlaylist);
  }

  try {
    const venueChannelItems = await getVenueChannelItems(config, defaultDuration, baseUrl);
    if (venueChannelItems.length > 0) {
      for (const vci of venueChannelItems) {
        if (vci.priority >= 9) {
          playlist.unshift(vci);
        } else {
          const insertAt = Math.min(Math.floor(playlist.length / 3), playlist.length);
          playlist.splice(insertAt, 0, vci);
        }
      }
    }
  } catch (e) {}

  try {
    const expertShowItems = await getExpertShowItems(config, defaultDuration, baseUrl);
    if (expertShowItems.length > 0) {
      for (const esi of expertShowItems) {
        const insertAt = Math.min(2, playlist.length);
        playlist.splice(insertAt, 0, esi);
      }
    }
  } catch (e) {}

  const liveDataItems = await getLiveDataItems(config, defaultDuration, baseUrl);
  if (liveDataItems.length > 0) {
    const insertEvery = Math.max(3, Math.floor(playlist.length / (liveDataItems.length + 1)));
    let insertOffset = insertEvery;
    for (const liveItem of liveDataItems) {
      if (insertOffset <= playlist.length) {
        playlist.splice(insertOffset, 0, liveItem);
        insertOffset += insertEvery + 1;
      } else {
        playlist.push(liveItem);
      }
    }
  }

  const filteredPlaylist = applyCompetitorExclusion(
    playlist,
    config.protectedCategoryIds || [],
    config.excludedBusinessIds || []
  );

  const spacedPlaylist = applyNarrationSpacing(
    filteredPlaylist,
    config.spokenSegmentMinGapMinutes,
    config.narrationDefaultEnabled
  );

  const finalPlaylist = applyAntiFatigue(spacedPlaylist);

  for (const item of finalPlaylist) {
    if (!config.subtitleDefaultEnabled) {
      item.subtitleText = null;
      item.captionUrl = null;
    }
  }

  return {
    items: finalPlaylist,
    loopId: primaryLoop.id,
    loopName: primaryLoop.name,
    scheduleId: schedule.id,
    scheduleName: schedule.name,
  };
}

export function shouldUseChannelEngine(screen: TvScreen): boolean {
  return !!(screen.activeScheduleId || (screen.activeLoopIds && screen.activeLoopIds.length > 0));
}
