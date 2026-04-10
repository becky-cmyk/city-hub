import { db } from "../db";
import { posts } from "@shared/schema";
import { eq } from "drizzle-orm";
import { storage } from "../storage";
import { queueTranslation } from "./auto-translate";
import { geoTagAndClassify } from "./geo-tagger";

type PulseEventType = "video_uploaded" | "live_scheduled" | "live_started" | "live_ended" | "podcast_published";

export async function generatePulseForChannel(
  eventType: PulseEventType,
  entityId: string
): Promise<void> {
  try {
    switch (eventType) {
      case "video_uploaded":
        await handleVideoUploaded(entityId);
        break;
      case "live_scheduled":
        await handleLiveScheduled(entityId);
        break;
      case "live_started":
        await handleLiveStarted(entityId);
        break;
      case "live_ended":
        await handleLiveEnded(entityId);
        break;
      case "podcast_published":
        await handlePodcastPublished(entityId);
        break;
    }
  } catch (error) {
    console.error(`[venue-channel-pulse] Failed to generate pulse for ${eventType}:`, error);
  }
}

async function handleVideoUploaded(videoId: string): Promise<void> {
  const video = await storage.getVideoContent(videoId);
  if (!video || !video.pulseEligible) return;

  const business = video.businessId ? await storage.getBusinessById(video.businessId) : null;
  const businessName = business?.name || "a local business";
  const city = await storage.getCityById(video.cityId);
  const citySlug = city?.slug || "clt";

  const channel = video.venueChannelId ? await storage.getVenueChannel(video.venueChannelId) : null;
  const channelUrl = channel ? `/${citySlug}/channel/${channel.channelSlug}` : null;

  const title = `New from ${businessName}: ${video.title}`;
  const body = channelUrl
    ? `Check out the latest video from ${businessName}. Watch now on their channel.`
    : `Check out the latest video from ${businessName}.`;

  const youtubeEmbedUrl = video.youtubeVideoId
    ? `https://www.youtube.com/embed/${video.youtubeVideoId}`
    : null;

  const [created] = await db.insert(posts).values({
    cityId: video.cityId,
    businessId: video.businessId,
    sourceType: "business",
    mediaType: "video",
    title,
    body,
    coverImageUrl: video.thumbnailUrl || null,
    videoUrl: video.youtubeUrl || null,
    videoEmbedUrl: youtubeEmbedUrl,
    videoThumbnailUrl: video.thumbnailUrl || null,
    videoDurationSec: video.durationSec || null,
    status: "published",
    trustScore: 80,
    publishedAt: new Date(),
  }).returning();
  if (created) {
    queueTranslation("post", created.id);
    geoTagAndClassify("post", created.id, video.cityId, {
      title, description: body, businessId: video.businessId,
    }, { skipAi: true }).catch(err => console.error("[GeoTagger] Pulse video post:", err.message));
  }
}

async function handleLiveScheduled(sessionId: string): Promise<void> {
  const session = await storage.getLiveSession(sessionId);
  if (!session) return;

  const business = await storage.getBusinessById(session.businessId);
  const businessName = business?.name || "a local business";

  const startTimeStr = session.startTime
    ? new Date(session.startTime).toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "soon";

  const title = `Coming Live: ${session.title}`;
  const body = `${businessName} is going live ${startTimeStr}. ${session.description || ""}`.trim();

  const [created] = await db.insert(posts).values({
    cityId: session.cityId,
    businessId: session.businessId,
    sourceType: "business",
    mediaType: "video",
    title,
    body,
    coverImageUrl: session.thumbnailUrl || null,
    videoUrl: session.youtubeLiveUrl || null,
    videoThumbnailUrl: session.thumbnailUrl || null,
    status: "published",
    trustScore: 80,
    publishedAt: new Date(),
    moderationNotes: `auto:live_scheduled:${sessionId}`,
  }).returning();
  if (created) {
    queueTranslation("post", created.id);
    geoTagAndClassify("post", created.id, session.cityId, {
      title, description: body, businessId: session.businessId,
    }, { skipAi: true }).catch(err => console.error("[GeoTagger] Pulse live_scheduled:", err.message));
  }
}

async function handleLiveStarted(sessionId: string): Promise<void> {
  const session = await storage.getLiveSession(sessionId);
  if (!session) return;

  const business = await storage.getBusinessById(session.businessId);
  const businessName = business?.name || "a local business";

  const existingPosts = await db
    .select()
    .from(posts)
    .where(eq(posts.moderationNotes, `auto:live_scheduled:${sessionId}`))
    .limit(1);

  if (existingPosts.length > 0) {
    await db
      .update(posts)
      .set({
        title: `Live Now: ${session.title}`,
        body: `${businessName} is live right now! Tune in now.`,
        videoUrl: session.youtubeLiveUrl || null,
        updatedAt: new Date(),
        moderationNotes: `auto:live_started:${sessionId}`,
      })
      .where(eq(posts.id, existingPosts[0].id));
    queueTranslation("post", existingPosts[0].id);
  } else {
    const [created] = await db.insert(posts).values({
      cityId: session.cityId,
      businessId: session.businessId,
      sourceType: "business",
      mediaType: "video",
      title: `Live Now: ${session.title}`,
      body: `${businessName} is live right now! Tune in now.`,
      coverImageUrl: session.thumbnailUrl || null,
      videoUrl: session.youtubeLiveUrl || null,
      videoThumbnailUrl: session.thumbnailUrl || null,
      status: "published",
      trustScore: 80,
      publishedAt: new Date(),
      moderationNotes: `auto:live_started:${sessionId}`,
    }).returning();
    if (created) {
      queueTranslation("post", created.id);
      geoTagAndClassify("post", created.id, session.cityId, {
        title: `Live Now: ${session.title}`, description: `${businessName} is live right now!`, businessId: session.businessId,
      }, { skipAi: true }).catch(err => console.error("[GeoTagger] Pulse live_started:", err.message));
    }
  }
}

async function handleLiveEnded(sessionId: string): Promise<void> {
  const session = await storage.getLiveSession(sessionId);
  if (!session) return;

  const business = await storage.getBusinessById(session.businessId);
  const businessName = business?.name || "a local business";

  const replayUrl = session.youtubeVideoId
    ? `https://www.youtube.com/watch?v=${session.youtubeVideoId}`
    : session.youtubeLiveUrl;

  const existingPosts = await db
    .select()
    .from(posts)
    .where(eq(posts.moderationNotes, `auto:live_started:${sessionId}`))
    .limit(1);

  if (existingPosts.length > 0) {
    await db
      .update(posts)
      .set({
        title: `Replay: ${session.title}`,
        body: `Missed ${businessName}'s live session? Watch the replay now.`,
        videoUrl: replayUrl || null,
        updatedAt: new Date(),
        moderationNotes: `auto:live_ended:${sessionId}`,
      })
      .where(eq(posts.id, existingPosts[0].id));
    queueTranslation("post", existingPosts[0].id);
  } else {
    const [created] = await db.insert(posts).values({
      cityId: session.cityId,
      businessId: session.businessId,
      sourceType: "business",
      mediaType: "video",
      title: `Replay: ${session.title}`,
      body: `Missed ${businessName}'s live session? Watch the replay now.`,
      coverImageUrl: session.thumbnailUrl || null,
      videoUrl: replayUrl || null,
      videoThumbnailUrl: session.thumbnailUrl || null,
      status: "published",
      trustScore: 80,
      publishedAt: new Date(),
      moderationNotes: `auto:live_ended:${sessionId}`,
    }).returning();
    if (created) {
      queueTranslation("post", created.id);
      geoTagAndClassify("post", created.id, session.cityId, {
        title: `Replay: ${session.title}`, description: `Missed ${businessName}'s live session? Watch the replay now.`, businessId: session.businessId,
      }, { skipAi: true }).catch(err => console.error("[GeoTagger] Pulse live_ended:", err.message));
    }
  }
}

async function handlePodcastPublished(videoId: string): Promise<void> {
  const video = await storage.getVideoContent(videoId);
  if (!video || !video.podcastEligible || !video.audioUrl) return;

  const business = video.businessId ? await storage.getBusinessById(video.businessId) : null;
  const businessName = business?.name || "a local creator";
  const city = await storage.getCityById(video.cityId);
  const citySlug = city?.slug || "clt";

  const title = `New Episode: ${video.title}`;
  const body = `${businessName} just released a new podcast episode. Listen now!`;

  const [created] = await db.insert(posts).values({
    cityId: video.cityId,
    businessId: video.businessId,
    sourceType: "business",
    mediaType: "image",
    title,
    body,
    coverImageUrl: video.thumbnailUrl || null,
    status: "published",
    trustScore: 75,
    publishedAt: new Date(),
    moderationNotes: `auto:podcast_published:${videoId}`,
  }).returning();
  if (created) {
    queueTranslation("post", created.id);
    geoTagAndClassify("post", created.id, video.cityId, {
      title, description: body, businessId: video.businessId || null,
    }, { skipAi: true }).catch(err => console.error("[GeoTagger] Pulse podcast:", err.message));
  }
}
