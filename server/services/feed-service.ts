import { db } from "../db";
import { eq, and, inArray, desc, gte, sql, count } from "drizzle-orm";
import {
  businesses, events, articles, marketplaceListings, rssItems, posts,
  shopItems, shopDrops, reposts, moderationQueue, publicUsers,
  contentTags, tags, zones, categories, entitlements, regions, likes,
  attractions, curatedLists, digests, jobs, cmsContentItems, videoContent, areaFacts,
  localPodcasts, localPodcastEpisodes, pulseVideos,
  crownCategories, crownParticipants,
  type Business, type Event, type Article, type MarketplaceListing, type RssItem, type Post,
  type ShopItem, type ShopDrop, type Repost,
  type Tag, type LiveFeed, type VideoContent,
  type LocalPodcast, type LocalPodcastEpisode, type PulseVideo,
  type CrownCategory, type CrownParticipant,
} from "@shared/schema";
import { getFallbackImage, isValidImageUrl, isValidRssImageUrl } from "./feed-image-defaults";
import { storage } from "../storage";
import { rankWithScoring, applyDiversityReranking, enforceTop20SourceCap, hydrateEngagementSignals } from "./feed-scoring-engine";
import { RANKING_CONFIG, type SurfaceType, type GeoContext as RankingGeoContext } from "./feed-ranking-config";
import { titleWords, jaccardSimilarity } from "./text-similarity";

const TEMPLATE_HEADER_RX = /\*\*(Headline Lead|Key Facts|Community FAQ|Source Credit|Full Story)\*\*/gi;
const TEMPLATE_QA_RX = /\*\*Q:\s*[^*]*\*\*/g;
const TEMPLATE_A_RX = /^A:\s(?=[A-Z])/gm;
const TEMPLATE_SECTION_RX = /SECTION\s*\d+\s*[—–-]\s*(HEADLINE LEAD|FULL STORY|KEY FACTS|COMMUNITY FAQ|SOURCE CREDIT)[^\n]*/gi;

function sanitizeArticleText(text: string): string {
  if (!text) return text;
  return text
    .replace(TEMPLATE_HEADER_RX, "")
    .replace(TEMPLATE_QA_RX, "")
    .replace(TEMPLATE_A_RX, "")
    .replace(TEMPLATE_SECTION_RX, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const FAITH_CATEGORY_SLUGS = new Set(["nonprofit-faith", "faith-based", "churches", "churches-places-of-worship"]);

let faithCategoryIdCache: Set<string> | null = null;
async function getFaithCategoryIds(): Promise<Set<string>> {
  if (faithCategoryIdCache) return faithCategoryIdCache;
  const allCats = await db.select({ id: categories.id, slug: categories.slug, parentCategoryId: categories.parentCategoryId }).from(categories);
  const faithIds = new Set<string>();
  const faithParentIds = new Set<string>();
  for (const c of allCats) {
    if (FAITH_CATEGORY_SLUGS.has(c.slug)) {
      faithIds.add(c.id);
      if (!c.parentCategoryId) faithParentIds.add(c.id);
    }
  }
  for (const c of allCats) {
    if (c.parentCategoryId && faithParentIds.has(c.parentCategoryId)) {
      faithIds.add(c.id);
    }
  }
  faithCategoryIdCache = faithIds;
  return faithIds;
}

function isFaithBusiness(biz: Business, faithCatIds: Set<string>): boolean {
  if (!biz.categoryIds || biz.categoryIds.length === 0) return false;
  return biz.categoryIds.some(cid => faithCatIds.has(cid));
}

export interface FeedItem {
  id: string;
  type: "business" | "event" | "article" | "marketplace" | "sponsored" | "post" | "reel" | "shop_item" | "shop_drop" | "repost" | "live" | "attraction" | "curated_list" | "digest" | "job" | "page" | "rss" | "enhanced_listing" | "podcast" | "fact" | "pulse_video" | "volunteer" | "wishlist" | "crown_winner" | "crown_category";
  title: string;
  subtitle: string;
  imageUrl: string | null;
  primaryTag: { slug: string; label: string; type: string } | null;
  locationTags: { slug: string; label: string }[];
  entityTag?: { slug: string; label: string };
  startDate?: string | null;
  endDate?: string | null;
  createdAt: string;
  sponsored: boolean;
  sponsorshipMeta?: { tier: string; businessName: string };
  url: string;
  whyShown: string;
  priorityScore: number;
  crownMeta?: { categoryName?: string; voteCount?: number; seasonYear?: number; status?: string };
  mediaType?: "image" | "video" | "reel" | "gallery" | "audio";
  videoUrl?: string | null;
  videoEmbedUrl?: string | null;
  videoDurationSec?: number | null;
  videoThumbnailUrl?: string | null;
  audioUrl?: string | null;
  audioDurationSec?: number | null;
  repostUser?: string | null;
  repostCaption?: string | null;
  originalItemId?: string | null;
  presenceType?: string | null;
  embedUrl?: string | null;
  sourceUrl?: string | null;
  externalUrl?: string | null;
  sourceName?: string | null;
  handle?: string | null;
  authorName?: string | null;
  authorAvatarUrl?: string | null;
  likeCount?: number;
  shareCount?: number;
  saveCount?: number;
  titleEs?: string | null;
  subtitleEs?: string | null;
  creatorType?: string | null;
  isHiring?: boolean;
  geoMeta?: {
    geoPrimarySlug?: string | null;
    geoSecondarySlug?: string | null;
    hubSlug?: string | null;
    countySlug?: string | null;
    categoryCoreSlug?: string | null;
  };
  articleBody?: string | null;
  articleBodyEs?: string | null;
  eventAddress?: string | null;
  eventLocationName?: string | null;
  eventCostText?: string | null;
}

export interface FeedQueryOptions {
  geoTagSlug?: string;
  topicTagSlug?: string;
  userHubSlug?: string;
  context?: "trending" | "nearby" | "new" | "weekend" | "foryou";
  surface?: "pulse" | "hub" | "category" | "default";
  page: number;
  limit: number;
  cityId: string;
  citySlug: string;
  feedSessionId?: string;
}

function projectBusiness(biz: Business, citySlug: string, tagMap: Map<string, Tag[]>): FeedItem | null {
  try {
    const contentTagList = tagMap.get(`business:${biz.id}`) || [];
    const topicTag = contentTagList.find(t => t.type === "topic");
    const locationTagList = contentTagList.filter(t => t.type === "location");

    const primaryCatSlug = topicTag ? topicTag.slug : null;
    const bizUrl = primaryCatSlug
      ? `/${citySlug}/${primaryCatSlug}/${biz.slug}`
      : `/${citySlug}/directory/${biz.slug}`;

    let subtitle = biz.description?.substring(0, 120) || "";
    if (!subtitle) {
      const parts: string[] = [];
      if (topicTag) parts.push(topicTag.name);
      if (locationTagList.length > 0) parts.push(locationTagList[0].name);
      if (biz.presenceType) parts.push(biz.presenceType.charAt(0).toUpperCase() + biz.presenceType.slice(1).toLowerCase());
      subtitle = parts.join(" · ");
    }

    return {
      id: biz.id,
      type: "business",
      title: biz.name,
      subtitle,
      imageUrl: isValidImageUrl(biz.imageUrl) ? biz.imageUrl! : isValidImageUrl(biz.galleryImages?.[0]) ? biz.galleryImages![0] : getFallbackImage("business", topicTag?.slug, biz.name, biz.id),
      primaryTag: topicTag ? { slug: topicTag.slug, label: topicTag.name, type: topicTag.type } : null,
      locationTags: locationTagList.map(t => ({ slug: t.slug, label: t.name })),
      createdAt: biz.createdAt?.toISOString() || new Date().toISOString(),
      sponsored: biz.isSponsored || false,
      sponsorshipMeta: biz.isSponsored ? { tier: biz.listingTier, businessName: biz.name } : undefined,
      url: bizUrl,
      whyShown: `Business in ${citySlug}`,
      priorityScore: biz.priorityRank || 0,
      presenceType: biz.presenceType || "commerce",
      handle: (biz as any).handle || null,
      authorName: biz.name,
      authorAvatarUrl: isValidImageUrl(biz.imageUrl) ? biz.imageUrl! : isValidImageUrl(biz.galleryImages?.[0]) ? biz.galleryImages![0] : null,
      subtitleEs: biz.descriptionEs?.substring(0, 120) || null,
      creatorType: biz.creatorType || null,
      sourceName: "CLT Business Directory",
    };
  } catch {
    return null;
  }
}

const EVENT_FEED_BLOCKLIST = [
  "pal session", "study session", "tutoring session", "review session",
  "office hours", "drop-in hours", "walk in hours", "walk-in hours",
  "lab hours", "recitation", "thesis defense", "dissertation",
  "capstone presentation", "exam review", "final exam", "midterm exam",
  "grades due", "grading deadline", "last day to drop", "last day to add",
  "last day to withdraw", "registration deadline", "registration opens",
  "registration closes", "census date", "academic calendar",
  "faculty meeting", "faculty senate", "staff meeting", "board meeting",
  "commencement rehearsal", "advising period", "orientation session",
  "reading day", "study day", "exam period",
  "spring break", "fall break", "winter break", "summer break",
  "classes begin", "classes end", "classes resume",
  "no classes", "university closed", "campus closed", "office closed",
  "holiday break", "convocation",
  "tuition due", "fee payment", "financial aid deadline",
  "drop deadline", "add deadline", "withdrawal deadline",
  "syllabus", "course registration", "dean's list", "honor roll",
  "student government", "academic senate", "faculty development",
  "parent orientation", "pep rally",
  "class schedule", "study group",
  "department meeting", "division meeting", "standup meeting",
  "general body meeting", "club meeting", "chapter meeting",
  "committee meeting", "weekly meeting", "monthly meeting",
  "bi-weekly meeting", "biweekly meeting", "team meeting",
  "procrastination workshop", "time management", "effective communication",
  "self-accountability", "decision making", "bystander intervention",
  "safer drinking", "effective decision",
];

const COURSE_CODE_PATTERN = /\b(ACCT|CHEM|PHYS|MATH|ENGR|ECON|PSYC|BIOL|COMM|PHIL|EXER|ITSC|ITIS|STAT|SOCY|POLS|HIST|GEOG|ANTH|MGMT|FINN|MKTG|INFO|LBST|ENGL|NURS|KNES|AERO|MSCI|EDUC|SOWK|MUSC|THEA|DANC|ARTH|ARCH|ELED|ECGR|MECH|MINE|CIVL|BINF|BIOE|SENG|GEOL|ATMS|MBAD|MACC|MHIT|MNGT|OPMT|DSBA)\s*\d{3,4}\b/i;

function isEventFeedWorthy(evt: Event): boolean {
  const title = (evt.title || "").toLowerCase();
  const desc = (evt.description || "").toLowerCase();

  const evtAny = evt as Record<string, unknown>;
  if (evtAny.occurrenceStatus === "skipped" || evtAny.occurrenceStatus === "cancelled") return false;
  if (evtAny.pulseReminderEnabled === false) return false;

  if (title.includes("cancelled") || title.includes("canceled")) return false;

  const effectiveEnd = evt.endDateTime || evt.startDateTime;
  if (effectiveEnd && effectiveEnd < new Date()) return false;

  for (const term of EVENT_FEED_BLOCKLIST) {
    if (title.includes(term)) return false;
  }

  if (COURSE_CODE_PATTERN.test(evt.title || "")) return false;

  if (title.includes("(online)") && !title.includes("concert") && !title.includes("festival")) return false;

  const titleAndDesc = title + " " + desc;
  const academicSignals = ["peer-led", "study session", "tutor", "academic support", "learning center", "course number", "section number", "prerequisite"];
  let academicHits = 0;
  for (const signal of academicSignals) {
    if (titleAndDesc.includes(signal)) academicHits++;
  }
  if (academicHits >= 2) return false;

  return true;
}

function projectEvent(evt: Event, citySlug: string, tagMap: Map<string, Tag[]>): FeedItem | null {
  try {
    const visibility = (evt as Record<string, unknown>).visibility as string | undefined;
    if (visibility && visibility !== "public") return null;

    if (!isEventFeedWorthy(evt)) return null;

    const contentTagList = tagMap.get(`event:${evt.id}`) || [];
    const topicTag = contentTagList.find(t => t.type === "topic");
    const locationTagList = contentTagList.filter(t => t.type === "location");

    const evtSource = evt.venueName || evt.sponsorName || "CLT Events";

    return {
      id: evt.id,
      type: "event",
      title: evt.title,
      subtitle: evt.description?.substring(0, 120) || "",
      imageUrl: isValidImageUrl(evt.imageUrl) ? evt.imageUrl! : getFallbackImage("event", topicTag?.slug, evt.title, evt.id),
      primaryTag: topicTag ? { slug: topicTag.slug, label: topicTag.name, type: topicTag.type } : null,
      locationTags: locationTagList.map(t => ({ slug: t.slug, label: t.name })),
      startDate: evt.startDateTime?.toISOString() || null,
      endDate: evt.endDateTime?.toISOString() || null,
      createdAt: evt.createdAt?.toISOString() || new Date().toISOString(),
      sponsored: evt.isSponsored || false,
      sponsorshipMeta: evt.isSponsored ? { tier: "EVENT", businessName: evt.sponsorName || "" } : undefined,
      url: `/${citySlug}/events/${evt.slug}`,
      whyShown: `Event in ${citySlug}`,
      priorityScore: evt.priorityRank || 0,
      authorName: evt.sponsorName || evt.venueName || null,
      authorAvatarUrl: isValidImageUrl(evt.imageUrl) ? evt.imageUrl! : null,
      titleEs: (evt as any).titleEs || null,
      subtitleEs: (evt as any).descriptionEs?.substring(0, 120) || null,
      sourceName: evtSource !== "CLT Events" ? evtSource : "CLT Events",
      eventAddress: evt.address || null,
      eventLocationName: evt.locationName || null,
      eventCostText: evt.costText || null,
    };
  } catch {
    return null;
  }
}

function projectArticle(art: Article, citySlug: string, tagMap: Map<string, Tag[]>): FeedItem | null {
  try {
    const contentTagList = tagMap.get(`article:${art.id}`) || [];
    const topicTag = contentTagList.find(t => t.type === "topic");
    const locationTagList = contentTagList.filter(t => t.type === "location");

    return {
      id: art.id,
      type: "article",
      title: art.title,
      subtitle: art.excerpt?.substring(0, 120) || "",
      imageUrl: isValidImageUrl(art.imageUrl) ? art.imageUrl! : getFallbackImage("article", topicTag?.slug, art.title, art.id),
      primaryTag: topicTag ? { slug: topicTag.slug, label: topicTag.name, type: topicTag.type } : null,
      locationTags: locationTagList.map(t => ({ slug: t.slug, label: t.name })),
      createdAt: art.publishedAt?.toISOString() || art.createdAt?.toISOString() || new Date().toISOString(),
      sponsored: art.isSponsored || false,
      sponsorshipMeta: art.isSponsored ? { tier: "ARTICLE", businessName: art.sponsorName || "" } : undefined,
      url: `/${citySlug}/articles/${art.slug}`,
      whyShown: `Article in ${citySlug}`,
      priorityScore: art.priorityRank || 0,
      authorName: (art as any).authorName || null,
      authorAvatarUrl: null,
      titleEs: (art as any).titleEs || null,
      subtitleEs: (art as any).excerptEs?.substring(0, 120) || null,
      sourceName: (art as any).authorName || "CLT Metro Hub Editorial",
    };
  } catch {
    return null;
  }
}

function projectMarketplaceListing(ml: MarketplaceListing, citySlug: string, tagMap: Map<string, Tag[]>): FeedItem | null {
  try {
    const contentTagList = tagMap.get(`marketplace_listing:${ml.id}`) || [];
    const topicTag = contentTagList.find(t => t.type === "topic");
    const locationTagList = contentTagList.filter(t => t.type === "location");

    const priceStr = ml.price ? `$${(ml.price / 100).toFixed(0)}` : "";
    const subtitle = [ml.description?.substring(0, 100), priceStr].filter(Boolean).join(" — ");

    return {
      id: ml.id,
      type: "marketplace",
      title: ml.title,
      subtitle,
      imageUrl: isValidImageUrl(ml.imageUrl) ? ml.imageUrl! : getFallbackImage("marketplace", topicTag?.slug, ml.title, ml.id),
      primaryTag: topicTag ? { slug: topicTag.slug, label: topicTag.name, type: topicTag.type } : null,
      locationTags: locationTagList.map(t => ({ slug: t.slug, label: t.name })),
      createdAt: ml.createdAt?.toISOString() || new Date().toISOString(),
      sponsored: false,
      url: `/${citySlug}/marketplace/${ml.id}`,
      whyShown: `Marketplace listing`,
      priorityScore: 0,
      sourceName: "CLT Marketplace",
    };
  } catch {
    return null;
  }
}

function projectPost(post: Post, citySlug: string, tagMap: Map<string, Tag[]>): FeedItem | null {
  try {
    const contentTagList = tagMap.get(`post:${post.id}`) || tagMap.get(`reel:${post.id}`) || [];
    const topicTag = contentTagList.find(t => t.type === "topic");
    const locationTagList = contentTagList.filter(t => t.type === "location");

    const isReel = post.mediaType === "reel" || post.mediaType === "video";
    const feedType = isReel ? "reel" : "post";

    return {
      id: post.id,
      type: feedType,
      title: post.title,
      subtitle: post.body?.substring(0, 120) || "",
      imageUrl: isValidImageUrl(post.coverImageUrl) ? post.coverImageUrl! : isValidImageUrl(post.videoThumbnailUrl) ? post.videoThumbnailUrl! : getFallbackImage(feedType, topicTag?.slug, post.title, post.id),
      primaryTag: topicTag ? { slug: topicTag.slug, label: topicTag.name, type: topicTag.type } : null,
      locationTags: locationTagList.map(t => ({ slug: t.slug, label: t.name })),
      createdAt: post.publishedAt?.toISOString() || post.createdAt?.toISOString() || new Date().toISOString(),
      sponsored: false,
      url: `/${citySlug}/feed/post/${post.id}`,
      whyShown: isReel ? "Reel" : "Community post",
      priorityScore: post.trustScore || 0,
      authorName: (post as any).authorName || null,
      authorAvatarUrl: isValidImageUrl((post as any).authorAvatarUrl) ? (post as any).authorAvatarUrl : null,
      mediaType: post.mediaType as FeedItem["mediaType"],
      videoUrl: post.videoUrl,
      videoEmbedUrl: post.videoEmbedUrl,
      videoDurationSec: post.videoDurationSec,
      videoThumbnailUrl: post.videoThumbnailUrl,
      sourceName: (post as any).authorName || "CLT Community",
    };
  } catch {
    return null;
  }
}

function projectSponsored(biz: Business, citySlug: string, tagMap: Map<string, Tag[]>): FeedItem | null {
  try {
    const item = projectBusiness(biz, citySlug, tagMap);
    if (!item) return null;
    return {
      ...item,
      type: "sponsored",
      sponsored: true,
      sponsorshipMeta: { tier: biz.listingTier, businessName: biz.name },
      whyShown: `Sponsored: ${biz.listingTier} tier`,
    };
  } catch {
    return null;
  }
}

function projectShopItem(item: ShopItem, citySlug: string, bizName: string | null): FeedItem | null {
  try {
    if (item.type === "wishlist") {
      return projectWishlistItem(item, citySlug, bizName);
    }
    const priceStr = `$${(item.price / 100).toFixed(2)}`;
    const compareStr = item.compareAtPrice ? `$${(item.compareAtPrice / 100).toFixed(2)}` : null;
    const subtitle = [item.description?.substring(0, 120), compareStr ? `Was ${compareStr}` : null].filter(Boolean).join(" — ");

    return {
      id: item.id,
      type: "shop_item",
      title: item.title,
      subtitle,
      imageUrl: isValidImageUrl(item.imageUrl) ? item.imageUrl! : getFallbackImage("business", item.category, item.title, item.id),
      primaryTag: item.category ? { slug: item.category, label: item.category, type: "topic" } : null,
      locationTags: [],
      createdAt: item.createdAt?.toISOString() || new Date().toISOString(),
      sponsored: false,
      url: `/${citySlug}/shop/item/${item.id}`,
      whyShown: "Shop item",
      priorityScore: 5,
      price: item.price,
      compareAtPrice: item.compareAtPrice,
      expiresAt: item.expiresAt?.toISOString() || null,
      claimCount: item.claimCount,
      externalUrl: item.externalUrl,
      businessName: bizName,
      sourceName: bizName || "CLT Shop",
    };
  } catch {
    return null;
  }
}

function projectShopDrop(drop: ShopDrop, citySlug: string, bizName: string | null): FeedItem | null {
  try {
    const parts: string[] = [];
    if (drop.discountPercent) parts.push(`${drop.discountPercent}% OFF`);
    if (drop.dealPrice) parts.push(`Deal: $${(drop.dealPrice / 100).toFixed(2)}`);
    if (drop.description) parts.push(drop.description.substring(0, 100));
    const subtitle = parts.join(" — ");

    const now = new Date();
    const endAt = drop.endAt ? new Date(drop.endAt) : null;
    const hoursLeft = endAt ? (endAt.getTime() - now.getTime()) / (1000 * 60 * 60) : null;
    let urgencyBoost = 0;
    if (hoursLeft !== null && hoursLeft > 0 && hoursLeft < 24) {
      urgencyBoost = 20;
    }

    return {
      id: drop.id,
      type: "shop_drop",
      title: drop.title,
      subtitle,
      imageUrl: isValidImageUrl(drop.imageUrl) ? drop.imageUrl! : getFallbackImage("business", null, drop.title, drop.id),
      primaryTag: { slug: drop.dealType, label: drop.dealType.replace(/_/g, " "), type: "topic" },
      locationTags: [],
      startDate: drop.startAt?.toISOString() || null,
      endDate: drop.endAt?.toISOString() || null,
      createdAt: drop.createdAt?.toISOString() || new Date().toISOString(),
      sponsored: false,
      url: `/${citySlug}/shop/drop/${drop.id}`,
      whyShown: hoursLeft !== null && hoursLeft < 24 ? "Expiring soon" : "Deal",
      priorityScore: 10 + urgencyBoost,
      price: drop.dealPrice,
      compareAtPrice: drop.originalPrice,
      dealType: drop.dealType,
      discountPercent: drop.discountPercent,
      expiresAt: drop.endAt?.toISOString() || null,
      claimCount: drop.claimCount,
      maxClaims: drop.maxClaims,
      businessName: bizName,
      sourceName: bizName || "CLT Deals",
    };
  } catch {
    return null;
  }
}

function projectAttraction(attr: any, citySlug: string): FeedItem | null {
  try {
    return {
      id: attr.id,
      type: "attraction",
      title: attr.name,
      subtitle: attr.description?.substring(0, 120) || (attr.funFact ? `Fun fact: ${attr.funFact.substring(0, 100)}` : ""),
      imageUrl: isValidImageUrl(attr.imageUrl) ? attr.imageUrl! : getFallbackImage("business", null, attr.name, attr.id),
      primaryTag: { slug: attr.attractionType?.toLowerCase() || "landmark", label: attr.attractionType || "Landmark", type: "topic" },
      locationTags: [],
      createdAt: attr.createdAt?.toISOString() || new Date().toISOString(),
      sponsored: false,
      url: `/${citySlug}/attractions`,
      whyShown: "Local attraction",
      priorityScore: attr.isFeatured ? 15 : 5,
      sourceName: "CLT Attractions",
    };
  } catch { return null; }
}

function projectCuratedList(list: any, citySlug: string): FeedItem | null {
  try {
    return {
      id: list.id,
      type: "curated_list",
      title: list.title,
      subtitle: list.description?.substring(0, 120) || "",
      imageUrl: isValidImageUrl(list.imageUrl) ? list.imageUrl! : getFallbackImage("article", null, list.title, list.id),
      primaryTag: { slug: "curated", label: "Curated", type: "topic" },
      locationTags: [],
      createdAt: list.createdAt?.toISOString() || new Date().toISOString(),
      sponsored: false,
      url: `/${citySlug}/lists/${list.slug}`,
      whyShown: "Curated list",
      priorityScore: 10,
      sourceName: "CLT Curated",
    };
  } catch { return null; }
}

function projectDigest(d: any, citySlug: string): FeedItem | null {
  try {
    if (d.digestStatus !== "published" && d.digestStatus !== "sent") return null;
    return {
      id: d.id,
      type: "digest",
      title: d.title,
      subtitle: d.topic ? `Weekly digest: ${d.topic}` : "Weekly city digest",
      imageUrl: null,
      primaryTag: { slug: "digest", label: "Digest", type: "topic" },
      locationTags: [],
      createdAt: d.publishedAt?.toISOString() || d.createdAt?.toISOString() || new Date().toISOString(),
      sponsored: false,
      url: `/${citySlug}/digests/${d.slug}`,
      whyShown: "Weekly digest",
      priorityScore: 8,
      titleEs: d.titleEs || null,
      subtitleEs: d.topic ? `Boletín semanal: ${d.topic}` : null,
      sourceName: "CLT Digest",
    };
  } catch { return null; }
}

function projectJob(j: any, citySlug: string): FeedItem | null {
  try {
    if (j.employment_type === "VOLUNTEER" || j.employmentType === "VOLUNTEER") {
      return projectVolunteer(j, citySlug);
    }
    const payInfo = j.payMin && j.payMax ? `$${j.payMin}-$${j.payMax}/${j.payUnit || "yr"}` : "";
    const subtitle = [j.employer, j.employmentType, payInfo, j.locationText].filter(Boolean).join(" · ");
    return {
      id: j.id,
      type: "job",
      title: j.title,
      subtitle: subtitle.substring(0, 120),
      imageUrl: null,
      primaryTag: { slug: "jobs", label: "Jobs", type: "topic" },
      locationTags: [],
      createdAt: j.postedAt?.toISOString() || j.createdAt?.toISOString() || new Date().toISOString(),
      sponsored: false,
      url: j.applyUrl || j.detailsUrl || `/${citySlug}/jobs`,
      whyShown: "Job posting",
      priorityScore: 5,
      sourceName: j.employer || "CLT Jobs",
    };
  } catch { return null; }
}

function projectVolunteer(j: any, citySlug: string): FeedItem | null {
  try {
    const commitment = j.schedule_commitment || j.scheduleCommitment || "";
    const subtitle = [j.employer, commitment, j.location_text || j.locationText].filter(Boolean).join(" · ");
    return {
      id: j.id,
      type: "volunteer",
      title: j.title,
      subtitle: subtitle.substring(0, 120),
      imageUrl: null,
      primaryTag: { slug: "volunteer", label: "Volunteer", type: "topic" },
      locationTags: [],
      createdAt: j.posted_at || j.postedAt?.toISOString() || j.created_at || j.createdAt?.toISOString() || new Date().toISOString(),
      sponsored: false,
      url: j.contact_url || j.contactUrl || `/${citySlug}/jobs`,
      whyShown: "Volunteer opportunity",
      priorityScore: 7,
      businessName: j.employer,
      sourceName: j.employer || "CLT Volunteer",
    };
  } catch { return null; }
}

function projectWishlistItem(item: any, citySlug: string, bizName: string | null): FeedItem | null {
  try {
    const urgencyLabel = item.urgency ? `${item.urgency.charAt(0).toUpperCase() + item.urgency.slice(1)} priority` : "";
    const qtyInfo = item.quantityNeeded ? `Qty: ${item.quantityNeeded}` : "";
    const subtitle = [item.description?.substring(0, 80), urgencyLabel, qtyInfo].filter(Boolean).join(" — ");
    return {
      id: item.id,
      type: "wishlist",
      title: item.title,
      subtitle,
      imageUrl: item.imageUrl || null,
      primaryTag: { slug: "wishlist", label: "Wishlist", type: "topic" },
      locationTags: [],
      createdAt: item.createdAt?.toISOString() || new Date().toISOString(),
      sponsored: false,
      url: item.externalUrl || `/${citySlug}/shop/item/${item.id}`,
      whyShown: "Nonprofit need",
      priorityScore: 6,
      businessName: bizName,
      sourceName: bizName || "CLT Wishlist",
    };
  } catch { return null; }
}

function projectCmsPage(page: any, citySlug: string): FeedItem | null {
  try {
    if (page.status !== "published") return null;
    if (!page.slug) return null;
    if (!page.bodyEn || page.bodyEn.trim().length < 20) return null;
    return {
      id: page.id,
      type: "page",
      title: page.titleEn,
      subtitle: page.excerptEn?.substring(0, 120) || "",
      imageUrl: null,
      primaryTag: { slug: "page", label: "Page", type: "topic" },
      locationTags: [],
      createdAt: page.publishedAt?.toISOString() || page.createdAt?.toISOString() || new Date().toISOString(),
      sponsored: false,
      url: `/${citySlug}/pages/${page.slug}`,
      whyShown: "Content page",
      priorityScore: 3,
      titleEs: page.titleEs || null,
      subtitleEs: page.excerptEs?.substring(0, 120) || null,
      sourceName: "CLT Pages",
    };
  } catch { return null; }
}

function isNegativeContent(title: string, categoryCoreSlug: string | null): boolean {
  const cfg = RANKING_CONFIG.negativeContentFilter;
  if (categoryCoreSlug && cfg.excludedCategorySlugs.includes(categoryCoreSlug)) return true;
  const lowerTitle = title.toLowerCase();
  for (const term of cfg.titleBlocklist) {
    if (lowerTitle.includes(term)) return true;
  }
  return false;
}

export const RSS_SOURCE_NAME_MAP: Record<string, string> = {
  "WCNC RSS Feed: news": "WCNC Charlotte",
  "hickoryrecord.com - RSS Results of type article": "Hickory Daily Record",
  "independenttribune.com - RSS Results of type article": "Independent Tribune",
  "mcdowellnews.com - RSS Results of type article": "McDowell News",
  "mooresvilletribune.com - RSS Results of type article": "Mooresville Tribune",
  "statesville.com - RSS Results of type article": "Statesville Record & Landmark",
  "www.newstopicnews.com - RSS Results of type article": "News-Topic",
  "wsoctv.com": "WSOC-TV Charlotte",
};

export function normalizeSourceName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (RSS_SOURCE_NAME_MAP[raw]) return RSS_SOURCE_NAME_MAP[raw];
  let cleaned = raw;
  cleaned = cleaned.replace(/\s*-\s*RSS Results of type article$/i, "");
  cleaned = cleaned.replace(/\s*RSS Feed:\s*.*/i, "").trim();
  cleaned = cleaned.replace(/^www\./i, "");
  if (cleaned.endsWith(".com") || cleaned.endsWith(".org") || cleaned.endsWith(".net")) {
    cleaned = cleaned.replace(/\.(com|org|net)$/i, "").replace(/\./g, " ").replace(/\b\w/g, c => c.toUpperCase());
  }
  return cleaned || raw;
}

function projectRssItem(rss: any, citySlug: string, surface?: string): FeedItem | null {
  try {
    if (rss.reviewStatus !== "APPROVED") return null;
    if (rss.policyStatus && rss.policyStatus !== "ALLOW") return null;
    if ((!surface || surface === "pulse") && rss.pulseEligible === false) return null;
    if (rss.publishStatus && rss.publishStatus !== "PUBLISHED") return null;
    if (rss.queueStatus && rss.queueStatus !== "PUBLISHED") return null;
    if ((!surface || surface === "pulse") && isNegativeContent(rss.title || "", rss.categoryCoreSlug)) return null;
    const articleBodyLen = rss.localArticleBody ? rss.localArticleBody.length : 0;
    if ((!surface || surface === "pulse") && articleBodyLen < 400) return null;
    const hasLocalArticle = !!rss.localArticleSlug && !!rss.localArticleBody;
    const coreSlug = rss.categoryCoreSlug || "news";
    const localUrl = hasLocalArticle ? `/${citySlug}/news/${rss.localArticleSlug}` : `/${citySlug}/news/${rss.id}`;
    const CATEGORY_LABELS: Record<string, string> = {
      "news": "News", "business": "Business & Economy", "food-dining": "Food & Dining",
      "entertainment": "Entertainment", "arts-culture": "Arts & Culture", "sports": "Sports",
      "community": "Community", "education": "Education", "health-wellness": "Health & Wellness",
      "real-estate": "Real Estate", "government": "Government & Policy", "weather": "Weather",
      "technology": "Technology & Innovation", "faith": "Faith & Religion",
      "development": "Development & Growth", "lifestyle": "Lifestyle", "nightlife": "Nightlife",
      "family": "Family & Kids", "outdoors": "Outdoors & Nature", "pets-animals": "Pets & Animals",
      "shopping-retail": "Shopping & Retail", "automotive": "Automotive & Transit",
      "seniors": "Seniors & Aging", "opinion": "Opinion & Editorial",
      "events": "Events & Things To Do", "travel": "Travel & Tourism",
      "public-safety": "Public Safety", "shopping": "Shopping",
    };
    const coreLabel = CATEGORY_LABELS[coreSlug] || coreSlug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

    const locationTags: Array<{ slug: string; label: string; type: string }> = [];
    if (rss.geoPrimarySlug) {
      const geoLabel = rss.geoPrimarySlug.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
      locationTags.push({ slug: rss.geoPrimarySlug, label: geoLabel, type: "location" });
    }
    if (rss.geoSecondarySlug && rss.geoSecondarySlug !== rss.geoPrimarySlug) {
      const geoLabel2 = rss.geoSecondarySlug.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
      locationTags.push({ slug: rss.geoSecondarySlug, label: geoLabel2, type: "location" });
    }

    const displayTitle = (hasLocalArticle && rss.aiGeneratedTitle) ? rss.aiGeneratedTitle : rss.title;
    const rawSubtitle = hasLocalArticle
      ? rss.localArticleBody.replace(/<[^>]*>/g, "").substring(0, 300)
      : (rss.rewrittenSummary || rss.summary || "").substring(0, 300);
    const displaySubtitle = sanitizeArticleText(rawSubtitle).substring(0, 160);
    const cleanSource = normalizeSourceName(rss.sourceName);

    return {
      id: rss.id,
      type: "rss",
      title: displayTitle,
      subtitle: displaySubtitle,
      imageUrl: isValidRssImageUrl(rss.imageUrl) ? rss.imageUrl! : getFallbackImage("rss", coreSlug, rss.title, rss.id),
      primaryTag: { slug: coreSlug, label: coreLabel, type: "topic" },
      locationTags,
      createdAt: rss.publishedAt?.toISOString() || rss.createdAt?.toISOString() || new Date().toISOString(),
      sponsored: false,
      url: localUrl,
      externalUrl: hasLocalArticle ? undefined : rss.url,
      whyShown: locationTags.length > 0
        ? `${locationTags[0].label} · via ${cleanSource}`
        : `Charlotte Hub · via ${cleanSource}`,
      priorityScore: 15,
      sourceUrl: rss.url,
      sourceName: cleanSource,
      authorName: rss.author || cleanSource || null,
      titleEs: rss.titleEs || null,
      subtitleEs: (hasLocalArticle && rss.localArticleBodyEs
        ? rss.localArticleBodyEs.replace(/<[^>]*>/g, "").substring(0, 160)
        : (rss.rewrittenSummaryEs || "").substring(0, 160)) || null,
      geoMeta: {
        geoPrimarySlug: rss.geoPrimarySlug || null,
        geoSecondarySlug: rss.geoSecondarySlug || null,
        hubSlug: rss.hubSlug || null,
        countySlug: rss.countySlug || null,
        categoryCoreSlug: rss.categoryCoreSlug || null,
      },
      articleBody: rss.localArticleBody || null,
      articleBodyEs: rss.localArticleBodyEs || null,
    };
  } catch { return null; }
}

function projectVideoContent(vc: VideoContent, citySlug: string, businessName: string | null): FeedItem | null {
  try {
    const youtubeEmbedUrl = vc.youtubeVideoId
      ? `https://www.youtube.com/embed/${vc.youtubeVideoId}`
      : null;

    return {
      id: `video-${vc.id}`,
      type: "reel",
      title: vc.title,
      subtitle: vc.description?.substring(0, 120) || "",
      imageUrl: isValidImageUrl(vc.thumbnailUrl) ? vc.thumbnailUrl! : getFallbackImage("reel", null, vc.title, vc.id),
      primaryTag: { slug: "video", label: "Video", type: "topic" },
      locationTags: [],
      createdAt: vc.createdAt?.toISOString() || new Date().toISOString(),
      sponsored: false,
      url: vc.youtubeUrl || `/${citySlug}/feed/video/${vc.id}`,
      whyShown: businessName ? `Video from ${businessName}` : "Hub TV video",
      priorityScore: 20,
      mediaType: "video",
      videoUrl: vc.youtubeUrl || null,
      videoEmbedUrl: youtubeEmbedUrl,
      videoDurationSec: vc.durationSec || null,
      videoThumbnailUrl: vc.thumbnailUrl || null,
      authorName: businessName || "Hub TV",
      authorAvatarUrl: null,
      sourceName: businessName || "Hub TV",
    };
  } catch { return null; }
}

function projectPodcastContent(vc: VideoContent, citySlug: string, businessName: string | null): FeedItem | null {
  try {
    return {
      id: `podcast-${vc.id}`,
      type: "podcast",
      title: vc.title,
      subtitle: vc.description?.substring(0, 120) || "",
      imageUrl: isValidImageUrl(vc.thumbnailUrl) ? vc.thumbnailUrl! : getFallbackImage("article", null, vc.title, vc.id),
      primaryTag: { slug: "podcast", label: "Podcast", type: "topic" },
      locationTags: [],
      createdAt: vc.createdAt?.toISOString() || new Date().toISOString(),
      sponsored: false,
      url: vc.audioUrl || `/${citySlug}/feed/podcast/${vc.id}`,
      whyShown: businessName ? `Podcast from ${businessName}` : "Podcast episode",
      priorityScore: 18,
      mediaType: "audio",
      audioUrl: vc.audioUrl || null,
      audioDurationSec: vc.durationSec || null,
      videoThumbnailUrl: vc.thumbnailUrl || null,
      authorName: businessName || "Hub TV",
      authorAvatarUrl: null,
      sourceName: businessName || "Hub TV",
    };
  } catch { return null; }
}

function projectLocalPodcastEpisode(episode: LocalPodcastEpisode, podcast: LocalPodcast, citySlug: string): FeedItem | null {
  try {
    return {
      id: `lp-${episode.id}`,
      type: "podcast",
      title: episode.title,
      subtitle: episode.description?.substring(0, 120) || podcast.name,
      imageUrl: isValidImageUrl(podcast.imageUrl) ? podcast.imageUrl! : getFallbackImage("article", null, episode.title, episode.id),
      primaryTag: { slug: "podcast", label: "Podcast", type: "topic" },
      locationTags: [],
      createdAt: episode.publishedAt?.toISOString() || episode.createdAt?.toISOString() || new Date().toISOString(),
      sponsored: false,
      url: episode.externalUrl || episode.audioUrl || `/${citySlug}/podcasts`,
      whyShown: `From ${podcast.name}`,
      priorityScore: podcast.proTier ? 35 : podcast.featured ? 28 : 18,
      mediaType: "audio",
      audioUrl: episode.audioUrl || null,
      audioDurationSec: episode.durationSeconds || null,
      authorName: podcast.hostName || podcast.name,
      authorAvatarUrl: null,
      sourceName: podcast.name,
    };
  } catch { return null; }
}

function projectPulseVideo(pv: PulseVideo, citySlug: string): FeedItem | null {
  try {
    const tierScore = pv.tier === "ad" ? 40 : pv.tier === "promoted" ? 35 : pv.tier === "featured" ? 28 : 22;
    return {
      id: `pv-${pv.id}`,
      type: "pulse_video",
      title: pv.title,
      subtitle: pv.description?.substring(0, 120) || "",
      imageUrl: isValidImageUrl(pv.thumbnailUrl) ? pv.thumbnailUrl! : getFallbackImage("reel", null, pv.title, pv.id),
      primaryTag: { slug: "video", label: "Short Video", type: "topic" },
      locationTags: [],
      createdAt: pv.createdAt?.toISOString() || new Date().toISOString(),
      sponsored: pv.isAd === true,
      sponsorshipMeta: pv.isAd ? { tier: pv.tier || "ad", businessName: pv.authorName || "Sponsored" } : undefined,
      url: pv.videoUrl || `/${citySlug}`,
      whyShown: pv.isAd ? `Promoted video from ${pv.authorName || "Sponsor"}` : pv.authorName ? `Video from ${pv.authorName}` : "Short video",
      priorityScore: tierScore,
      mediaType: "video",
      videoUrl: pv.videoUrl,
      videoDurationSec: pv.durationSec || null,
      videoThumbnailUrl: pv.thumbnailUrl || null,
      authorName: pv.authorName || null,
      authorAvatarUrl: pv.authorAvatarUrl || null,
      likeCount: pv.likeCount || 0,
      shareCount: pv.shareCount || 0,
      sourceName: pv.authorName || "CLT Pulse",
    };
  } catch { return null; }
}

function projectEnhancedListing(biz: Business, citySlug: string, tagMap: Map<string, Tag[]>): FeedItem | null {
  try {
    const item = projectBusiness(biz, citySlug, tagMap);
    if (!item) return null;
    return {
      ...item,
      id: `enhanced-${biz.id}`,
      type: "enhanced_listing",
      sponsored: false,
      sponsorshipMeta: { tier: biz.listingTier, businessName: biz.name },
      whyShown: "Premium listing",
      priorityScore: 30,
    };
  } catch { return null; }
}

function projectCrownWinner(
  participant: CrownParticipant,
  category: CrownCategory,
  citySlug: string,
  hubSlug: string | null,
): FeedItem | null {
  try {
    const subtitle = participant.bio
      ? `${category.name} Crown Winner · ${participant.bio.substring(0, 100)}`
      : `Crowned as the community's best in ${category.name}`;

    const locationTags: { slug: string; label: string }[] = [];
    if (hubSlug) {
      const geoLabel = hubSlug.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
      locationTags.push({ slug: hubSlug, label: geoLabel });
    }

    return {
      id: `crown-winner-${participant.id}`,
      type: "crown_winner",
      title: participant.name,
      subtitle,
      imageUrl: isValidImageUrl(participant.imageUrl) ? participant.imageUrl! : null,
      primaryTag: { slug: "crown", label: "Crown Winner", type: "topic" },
      locationTags,
      createdAt: participant.createdAt?.toISOString() || new Date().toISOString(),
      sponsored: false,
      url: `/${citySlug}/crown/winners`,
      whyShown: `Crown Winner – ${category.name}`,
      priorityScore: 35,
      sourceName: "CLT Crown",
      crownMeta: {
        categoryName: category.name,
        voteCount: participant.voteCount,
        seasonYear: participant.seasonYear,
        status: participant.status,
      },
      geoMeta: {
        geoPrimarySlug: hubSlug || null,
        hubSlug: hubSlug || null,
      },
    };
  } catch { return null; }
}

function projectCrownCategory(
  category: CrownCategory,
  citySlug: string,
  hubSlug: string | null,
  nomineeCount: number,
): FeedItem | null {
  try {
    const subtitle = category.description
      ? category.description.substring(0, 120)
      : `Vote for the best in ${category.name}. ${nomineeCount} nominees competing for the Crown.`;

    const locationTags: { slug: string; label: string }[] = [];
    if (hubSlug) {
      const geoLabel = hubSlug.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
      locationTags.push({ slug: hubSlug, label: geoLabel });
    }

    return {
      id: `crown-cat-${category.id}`,
      type: "crown_category",
      title: `Crown: ${category.name}`,
      subtitle,
      imageUrl: null,
      primaryTag: { slug: "crown", label: "Crown Program", type: "topic" },
      locationTags,
      createdAt: new Date(category.seasonYear, 0, 1).toISOString(),
      sponsored: false,
      url: `/${citySlug}/crown/vote?category=${category.slug}`,
      whyShown: "Active Crown category – vote now",
      priorityScore: 25,
      sourceName: "CLT Crown",
      crownMeta: {
        categoryName: category.name,
        seasonYear: category.seasonYear,
        status: "active",
      },
      geoMeta: {
        geoPrimarySlug: hubSlug || null,
        hubSlug: hubSlug || null,
      },
    };
  } catch { return null; }
}

async function fetchCrownFeedItems(cityId: string, citySlug: string): Promise<FeedItem[]> {
  const items: FeedItem[] = [];
  try {
    const activeCats = await db.select().from(crownCategories)
      .where(and(eq(crownCategories.cityId, cityId), eq(crownCategories.isActive, true)));

    if (activeCats.length === 0) return items;

    const catIds = activeCats.map(c => c.id);

    const winners = await db.select().from(crownParticipants)
      .where(and(
        inArray(crownParticipants.categoryId, catIds),
        eq(crownParticipants.status, "crown_winner"),
      ))
      .orderBy(desc(crownParticipants.voteCount))
      .limit(10);

    const catMap = new Map(activeCats.map(c => [c.id, c]));

    const hubIds = [...new Set([
      ...activeCats.map(c => c.hubId).filter(Boolean),
      ...winners.map(w => w.hubId).filter(Boolean),
    ])] as string[];

    const hubSlugMap = new Map<string, string>();
    if (hubIds.length > 0) {
      const zoneRows = await db.select({ id: zones.id, slug: zones.slug })
        .from(zones).where(inArray(zones.id, hubIds));
      for (const z of zoneRows) hubSlugMap.set(z.id, z.slug);
    }

    for (const winner of winners) {
      const cat = catMap.get(winner.categoryId);
      if (!cat) continue;
      const hubSlug = (winner.hubId && hubSlugMap.get(winner.hubId)) || (cat.hubId && hubSlugMap.get(cat.hubId)) || null;
      const item = projectCrownWinner(winner, cat, citySlug, hubSlug);
      if (item) items.push(item);
    }

    const nomineeCounts = await db.select({
      categoryId: crownParticipants.categoryId,
      total: count(),
    }).from(crownParticipants)
      .where(inArray(crownParticipants.categoryId, catIds))
      .groupBy(crownParticipants.categoryId);

    const countMap = new Map(nomineeCounts.map(r => [r.categoryId, Number(r.total)]));

    for (const cat of activeCats) {
      const hubSlug = cat.hubId ? hubSlugMap.get(cat.hubId) || null : null;
      const item = projectCrownCategory(cat, citySlug, hubSlug, countMap.get(cat.id) || 0);
      if (item) items.push(item);
    }
  } catch (err: any) {
    console.error("[Feed] Crown items query failed:", err.message);
  }
  return items;
}

async function getApprovedReposts(cityId: string, citySlug: string, limit: number = 20): Promise<FeedItem[]> {
  try {
    const approvedRepostMods = await db.select().from(moderationQueue)
      .where(and(
        sql`${moderationQueue.contentType} = 'repost'`,
        sql`${moderationQueue.status} = 'approved'`,
        cityId ? sql`${moderationQueue.cityId} = ${cityId}` : sql`1=1`
      ))
      .orderBy(desc(moderationQueue.submittedAt))
      .limit(limit);

    if (approvedRepostMods.length === 0) return [];

    const repostIds = approvedRepostMods.map(m => m.contentId);
    const repostRows = await db.select().from(reposts)
      .where(inArray(reposts.id, repostIds));

    if (repostRows.length === 0) return [];

    const userIds = [...new Set(repostRows.map(r => r.userId))];
    const userRows = await db.select({ id: publicUsers.id, displayName: publicUsers.displayName })
      .from(publicUsers)
      .where(inArray(publicUsers.id, userIds));
    const userMap = new Map(userRows.map(u => [u.id, u.displayName]));

    const items: FeedItem[] = [];
    const emptyTagMap = new Map<string, Tag[]>();

    for (const repost of repostRows) {
      const userName = userMap.get(repost.userId) || "Someone";
      let originalItem: FeedItem | null = null;

      if (repost.originalContentType === "business") {
        const [biz] = await db.select().from(businesses).where(eq(businesses.id, repost.originalContentId));
        if (biz) {
          const isPaidTier = biz.listingTier === "ENHANCED";
          const isSponsored = biz.isSponsored === true;
          originalItem = projectBusiness(biz, citySlug, emptyTagMap);
        }
      } else if (repost.originalContentType === "event") {
        const [evt] = await db.select().from(events).where(eq(events.id, repost.originalContentId));
        if (evt) originalItem = projectEvent(evt, citySlug, emptyTagMap);
      } else if (repost.originalContentType === "article") {
        const [art] = await db.select().from(articles).where(eq(articles.id, repost.originalContentId));
        if (art) originalItem = projectArticle(art, citySlug, emptyTagMap);
      } else if (["post", "reel"].includes(repost.originalContentType)) {
        const [post] = await db.select().from(posts).where(eq(posts.id, repost.originalContentId));
        if (post) originalItem = projectPost(post, citySlug, emptyTagMap);
      }

      if (originalItem) {
        items.push({
          ...originalItem,
          id: repost.id,
          type: "repost",
          repostUser: userName,
          repostCaption: repost.caption || null,
          originalItemId: repost.originalContentId,
          createdAt: repost.createdAt?.toISOString() || new Date().toISOString(),
          whyShown: `${userName} reposted`,
          priorityScore: 5,
          sponsored: false,
        });
      }
    }

    return items;
  } catch (err) {
    console.error("[Feed] Error fetching reposts:", err);
    return [];
  }
}

async function getDescendantTagIds(tagId: string): Promise<string[]> {
  const allTags = await db.select().from(tags).where(eq(tags.type, "location"));
  const result: string[] = [tagId];
  const queue = [tagId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const t of allTags) {
      if (t.parentTagId === current && !result.includes(t.id)) {
        result.push(t.id);
        queue.push(t.id);
      }
    }
  }
  return result;
}

async function getContentIdsByTags(
  tagIds: string[],
  topicTagId: string | null,
  contentTypes: string[]
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  for (const ct of contentTypes) {
    result.set(ct, []);
  }

  if (tagIds.length === 0 && !topicTagId) return result;

  const conditions: any[] = [];
  if (tagIds.length > 0) {
    conditions.push(inArray(contentTags.tagId, tagIds));
  }
  if (topicTagId) {
    conditions.push(eq(contentTags.tagId, topicTagId));
  }

  const rows = await db
    .select({
      contentType: contentTags.contentType,
      contentId: contentTags.contentId,
      tagId: contentTags.tagId,
    })
    .from(contentTags)
    .where(and(...conditions));

  if (tagIds.length > 0 && topicTagId) {
    const geoMatchIds = new Set(rows.filter(r => tagIds.includes(r.tagId)).map(r => `${r.contentType}:${r.contentId}`));
    const topicMatchIds = new Set(rows.filter(r => r.tagId === topicTagId).map(r => `${r.contentType}:${r.contentId}`));
    const intersection = [...geoMatchIds].filter(x => topicMatchIds.has(x));
    for (const key of intersection) {
      const [ct, cid] = key.split(":", 2);
      if (result.has(ct)) {
        result.get(ct)!.push(cid);
      }
    }
  } else {
    for (const row of rows) {
      if (result.has(row.contentType)) {
        const arr = result.get(row.contentType)!;
        if (!arr.includes(row.contentId)) {
          arr.push(row.contentId);
        }
      }
    }
  }

  return result;
}

async function buildTagMap(contentIds: Map<string, string[]>): Promise<Map<string, Tag[]>> {
  const allIds: string[] = [];
  for (const [ct, ids] of contentIds) {
    for (const id of ids) {
      allIds.push(`${ct}:${id}`);
    }
  }
  if (allIds.length === 0) return new Map();

  const allContentIds: string[] = [];
  for (const ids of contentIds.values()) {
    allContentIds.push(...ids);
  }
  if (allContentIds.length === 0) return new Map();

  const ctRows = await db
    .select({
      contentType: contentTags.contentType,
      contentId: contentTags.contentId,
      tagId: contentTags.tagId,
    })
    .from(contentTags)
    .where(inArray(contentTags.contentId, [...new Set(allContentIds)]));

  const tagIdSet = new Set(ctRows.map(r => r.tagId));
  if (tagIdSet.size === 0) return new Map();

  const tagRows = await db.select().from(tags).where(inArray(tags.id, [...tagIdSet]));
  const tagById = new Map(tagRows.map(t => [t.id, t]));

  const result = new Map<string, Tag[]>();
  for (const row of ctRows) {
    const key = `${row.contentType}:${row.contentId}`;
    if (!result.has(key)) result.set(key, []);
    const tag = tagById.get(row.tagId);
    if (tag) result.get(key)!.push(tag);
  }
  return result;
}

async function queryFeedViaTags(options: FeedQueryOptions): Promise<FeedItem[]> {
  const { geoTagSlug, topicTagSlug, userHubSlug, cityId, citySlug, page, limit } = options;
  const hasExplicitGeo = !!geoTagSlug;
  const effectiveGeoSlug = geoTagSlug;

  let geoTagIds: string[] = [];
  let hubBoostTagIds: string[] = [];
  let topicTagId: string | null = null;

  if (effectiveGeoSlug) {
    const slugLower = effectiveGeoSlug.toLowerCase();
    const [geoTag] = await db.select().from(tags).where(and(sql`LOWER(${tags.slug}) = ${slugLower}`, eq(tags.type, "location")));
    if (geoTag) {
      geoTagIds = await getDescendantTagIds(geoTag.id);
    }
  }

  let countyBoostTagIds: string[] = [];
  if (!hasExplicitGeo && userHubSlug) {
    const hubSlugLower = userHubSlug.toLowerCase();
    const [hubTag] = await db.select().from(tags).where(and(sql`LOWER(${tags.slug}) = ${hubSlugLower}`, eq(tags.type, "location")));
    if (hubTag) {
      hubBoostTagIds = await getDescendantTagIds(hubTag.id);
      if (hubTag.parentTagId) {
        const siblingTags = await db.select({ id: tags.id }).from(tags).where(
          and(eq(tags.parentTagId, hubTag.parentTagId), eq(tags.type, "location"))
        );
        const siblingIds = siblingTags.map(s => s.id).filter(id => !hubBoostTagIds.includes(id));
        for (const sid of siblingIds) {
          const descendants = await getDescendantTagIds(sid);
          countyBoostTagIds.push(...descendants);
        }
      }
    }
  }

  if (topicTagSlug) {
    const topicLower = topicTagSlug.toLowerCase();
    const [topicTag] = await db.select().from(tags).where(and(sql`LOWER(${tags.slug}) = ${topicLower}`, eq(tags.type, "topic")));
    if (topicTag) {
      topicTagId = topicTag.id;
    }
  }

  if (geoTagIds.length === 0 && !topicTagId) {
    const cityTag = await db.select().from(tags).where(and(eq(tags.type, "location"), sql`${tags.parentTagId} IS NULL`));
    if (cityTag.length > 0) {
      geoTagIds = await getDescendantTagIds(cityTag[0].id);
    }
  }

  const contentTypes = ["business", "event", "article", "marketplace_listing", "post", "reel", "shop_item", "shop_drop", "rss_item"];
  const contentIdMap = await getContentIdsByTags(geoTagIds, topicTagId, contentTypes);

  const hasAnyContent = [...contentIdMap.values()].some(ids => ids.length > 0);
  if (!hasAnyContent) return [];

  const tagMap = await buildTagMap(contentIdMap);
  const emptyTagMap = new Map<string, Tag[]>();

  const items: FeedItem[] = [];

  const faithCatIds = await getFaithCategoryIds();

  const safeFetch = async <T>(label: string, fn: () => Promise<T[]>): Promise<T[]> => {
    try { return await fn(); } catch (e: any) { console.error(`[FeedViaTags] ${label} query failed:`, e.message); return []; }
  };

  const bizIds = contentIdMap.get("business") || [];
  const seenBizIds = new Set<string>();
  if (bizIds.length > 0) {
    const bizRows = await safeFetch("businesses", () => db.select().from(businesses).where(and(inArray(businesses.id, bizIds), eq(businesses.cityId, cityId))));
    for (const biz of bizRows) {
      seenBizIds.add(biz.id);
      if (isFaithBusiness(biz, faithCatIds)) continue;
      if (biz.claimStatus === "UNCLAIMED") continue;
      if (biz.listingTier !== "ENHANCED") continue;
      const item = projectBusiness(biz, citySlug, tagMap);
      if (item) items.push(item);
    }
  }

  const topicCatIdsV1 = topicTagSlug ? await getCategoryIdsForTopicSlug(topicTagSlug) : null;
  const broadBizRows = await safeFetch("businessesBroadDirect", () =>
    db.select().from(businesses).where(and(eq(businesses.cityId, cityId), sql`${businesses.claimStatus} != 'UNCLAIMED'`, sql`${businesses.listingTier} = 'ENHANCED'`)).limit(limit * 3)
  );
  for (const biz of broadBizRows) {
    if (seenBizIds.has(biz.id)) continue;
    seenBizIds.add(biz.id);
    if (isFaithBusiness(biz, faithCatIds)) continue;
    if (topicCatIdsV1 && !biz.categoryIds?.some(cid => topicCatIdsV1.has(cid))) continue;
    const item = projectBusiness(biz, citySlug, emptyTagMap);
    if (item) items.push(item);
  }

  const evtIds = contentIdMap.get("event") || [];
  const seenEvtIds = new Set<string>();
  if (evtIds.length > 0) {
    const evtRows = await safeFetch("events", () => db.select().from(events).where(and(
      inArray(events.id, evtIds),
      eq(events.cityId, cityId),
      sql`COALESCE(${events.endDateTime}, ${events.startDateTime}) >= NOW()`,
    )));
    for (const evt of evtRows) {
      seenEvtIds.add(evt.id);
      const item = projectEvent(evt, citySlug, tagMap);
      if (item) items.push(item);
    }
  }

  const broadEvtRows = await safeFetch("eventsBroadDirect", () =>
    db.select().from(events).where(and(
      eq(events.cityId, cityId),
      sql`COALESCE(${events.endDateTime}, ${events.startDateTime}) >= NOW()`,
    )).orderBy(desc(events.startDateTime)).limit(limit * 2)
  );
  for (const evt of broadEvtRows) {
    if (seenEvtIds.has(evt.id)) continue;
    seenEvtIds.add(evt.id);
    if (topicCatIdsV1 && !evt.categoryIds?.some(cid => topicCatIdsV1.has(cid))) continue;
    const item = projectEvent(evt, citySlug, emptyTagMap);
    if (item) items.push(item);
  }

  const artIds = contentIdMap.get("article") || [];
  const seenArtIds = new Set<string>();
  if (artIds.length > 0) {
    const artRows = await safeFetch("articles", () => db.select().from(articles).where(and(inArray(articles.id, artIds), eq(articles.cityId, cityId))));
    for (const art of artRows) {
      seenArtIds.add(art.id);
      const item = projectArticle(art, citySlug, tagMap);
      if (item) items.push(item);
    }
  }

  const broadArtRows = await safeFetch("articlesBroadDirect", () =>
    db.select().from(articles).where(eq(articles.cityId, cityId)).orderBy(desc(articles.publishedAt)).limit(limit * 2)
  );
  for (const art of broadArtRows) {
    if (seenArtIds.has(art.id)) continue;
    seenArtIds.add(art.id);
    if (topicCatIdsV1 && (!art.primaryCategoryId || !topicCatIdsV1.has(art.primaryCategoryId))) continue;
    const item = projectArticle(art, citySlug, emptyTagMap);
    if (item) items.push(item);
  }

  const mlIds = contentIdMap.get("marketplace_listing") || [];
  if (mlIds.length > 0) {
    const mlRows = await safeFetch("marketplace", () => db.select().from(marketplaceListings).where(and(inArray(marketplaceListings.id, mlIds), eq(marketplaceListings.status, "ACTIVE"))));
    for (const ml of mlRows) {
      const item = projectMarketplaceListing(ml, citySlug, tagMap);
      if (item) items.push(item);
    }
  }

  const postIds = [...(contentIdMap.get("post") || []), ...(contentIdMap.get("reel") || [])];
  if (postIds.length > 0) {
    const postRows = await safeFetch("posts", () => db.select().from(posts).where(and(inArray(posts.id, postIds), eq(posts.cityId, cityId), eq(posts.status, "published"))));
    for (const post of postRows) {
      const item = projectPost(post, citySlug, tagMap);
      if (item) items.push(item);
    }
  }

  const shopItemIds = contentIdMap.get("shop_item") || [];
  if (shopItemIds.length > 0) {
    try {
      const siRows = await db.select().from(shopItems).where(and(inArray(shopItems.id, shopItemIds), eq(shopItems.cityId, cityId), eq(shopItems.status, "active")));
      const bizIds2 = [...new Set(siRows.map(si => si.businessId))];
      const bizNameMap = new Map<string, string>();
      if (bizIds2.length > 0) {
        const bizRows2 = await db.select({ id: businesses.id, name: businesses.name }).from(businesses).where(inArray(businesses.id, bizIds2));
        for (const b of bizRows2) bizNameMap.set(b.id, b.name);
      }
      for (const si of siRows) {
        const item = projectShopItem(si, citySlug, bizNameMap.get(si.businessId) || null);
        if (item) items.push(item);
      }
    } catch (e: any) { console.error("[FeedViaTags] shopItems query failed:", e.message); }
  }

  const shopDropIds = contentIdMap.get("shop_drop") || [];
  if (shopDropIds.length > 0) {
    try {
      const sdRows = await db.select().from(shopDrops).where(and(inArray(shopDrops.id, shopDropIds), eq(shopDrops.cityId, cityId), eq(shopDrops.status, "active")));
      const bizIds3 = [...new Set(sdRows.map(sd => sd.businessId))];
      const bizNameMap2 = new Map<string, string>();
      if (bizIds3.length > 0) {
        const bizRows3 = await db.select({ id: businesses.id, name: businesses.name }).from(businesses).where(inArray(businesses.id, bizIds3));
        for (const b of bizRows3) bizNameMap2.set(b.id, b.name);
      }
      for (const sd of sdRows) {
        const item = projectShopDrop(sd, citySlug, bizNameMap2.get(sd.businessId) || null);
        if (item) items.push(item);
      }
    } catch (e: any) { console.error("[FeedViaTags] shopDrops query failed:", e.message); }
  }

  const rssIds = contentIdMap.get("rss_item") || [];
  const seenRssIds = new Set<string>();
  if (rssIds.length > 0) {
    const rssRows = await safeFetch("rssItems", () => db.select().from(rssItems).where(and(inArray(rssItems.id, rssIds), eq(rssItems.cityId, cityId), eq(rssItems.reviewStatus, "APPROVED"))));
    for (const r of rssRows) {
      seenRssIds.add(r.id);
      const item = projectRssItem(r, citySlug, options.surface);
      if (item) items.push(item);
    }
  }

  const surface = options.surface || "pulse";
  const fetchLimit = limit * 2;

  if (geoTagSlug) {
    const hubSlugLower = geoTagSlug.toLowerCase();
    const hubRssRows = await safeFetch("rssHubDirect", () =>
      db.select().from(rssItems).where(and(
        eq(rssItems.cityId, cityId),
        eq(rssItems.reviewStatus, "APPROVED"),
        sql`(LOWER(${rssItems.geoPrimarySlug}) = ${hubSlugLower} OR LOWER(${rssItems.geoSecondarySlug}) = ${hubSlugLower} OR LOWER(${rssItems.hubSlug}) = ${hubSlugLower} OR LOWER(${rssItems.zoneSlug}) = ${hubSlugLower})`
      )).orderBy(desc(rssItems.publishedAt)).limit(fetchLimit)
    );
    for (const r of hubRssRows) {
      if (seenRssIds.has(r.id)) continue;
      seenRssIds.add(r.id);
      const item = projectRssItem(r, citySlug, surface);
      if (item) items.push(item);
    }
  }

  if (surface === "category" && topicTagSlug) {
    const catSlugLower = topicTagSlug.toLowerCase();
    const catRssRows = await safeFetch("rssCategoryDirect", () =>
      db.select().from(rssItems).where(and(
        eq(rssItems.cityId, cityId),
        eq(rssItems.reviewStatus, "APPROVED"),
        sql`(LOWER(${rssItems.categoryCoreSlug}) = ${catSlugLower} OR LOWER(${rssItems.categorySubSlug}) = ${catSlugLower})`
      )).orderBy(desc(rssItems.publishedAt)).limit(fetchLimit)
    );
    for (const r of catRssRows) {
      if (seenRssIds.has(r.id)) continue;
      seenRssIds.add(r.id);
      const item = projectRssItem(r, citySlug, surface);
      if (item) items.push(item);
    }
  }

  const excludedCats = RANKING_CONFIG.negativeContentFilter.excludedCategorySlugs;
  const broadRssRows = await safeFetch("rssBroadDirect", () =>
    db.select().from(rssItems).where(and(
      eq(rssItems.cityId, cityId),
      eq(rssItems.reviewStatus, "APPROVED"),
      sql`COALESCE(LOWER(${rssItems.categoryCoreSlug}), '') NOT IN (${sql.join(excludedCats.map(c => sql`${c}`), sql`, `)})`,
    )).orderBy(desc(rssItems.publishedAt)).limit(fetchLimit)
  );
  for (const r of broadRssRows) {
    if (seenRssIds.has(r.id)) continue;
    seenRssIds.add(r.id);
    const item = projectRssItem(r, citySlug, surface);
    if (item) items.push(item);
  }

  try {
    const podEpRowsVT = await db.select({
      episode: localPodcastEpisodes,
      podcast: localPodcasts,
    })
    .from(localPodcastEpisodes)
    .innerJoin(localPodcasts, eq(localPodcastEpisodes.podcastId, localPodcasts.id))
    .where(and(
      eq(localPodcasts.cityId, cityId),
      eq(localPodcasts.status, "approved"),
    ))
    .orderBy(desc(localPodcastEpisodes.publishedAt))
    .limit(limit * 2);

    for (const row of podEpRowsVT) {
      const item = projectLocalPodcastEpisode(row.episode, row.podcast, citySlug);
      if (item) items.push(item);
    }
  } catch (e: any) { console.error("[FeedViaTags] podcasts query failed:", e.message); }

  const crownItems = await fetchCrownFeedItems(cityId, citySlug);
  items.push(...crownItems);

  if (hubBoostTagIds.length > 0 || countyBoostTagIds.length > 0) {
    const allBoostTagIds = [...hubBoostTagIds, ...countyBoostTagIds];
    const hubContentRows = await db.select({ contentId: contentTags.contentId, tagId: contentTags.tagId })
      .from(contentTags).where(inArray(contentTags.tagId, allBoostTagIds));
    const hubSet = new Set(hubBoostTagIds);
    const hubContentIds = new Set<string>();
    const countyContentIds = new Set<string>();
    for (const row of hubContentRows) {
      if (hubSet.has(row.tagId)) hubContentIds.add(row.contentId);
      else countyContentIds.add(row.contentId);
    }
    for (const item of items) {
      if (hubContentIds.has(item.id)) {
        item.priorityScore = (item.priorityScore || 0) + 40;
      } else if (countyContentIds.has(item.id)) {
        item.priorityScore = (item.priorityScore || 0) + 20;
      }
    }
  }

  return items;
}

async function getCategoryIdsForTopicSlug(topicSlug: string): Promise<Set<string> | null> {
  const allCats = await db.select({ id: categories.id, slug: categories.slug, parentCategoryId: categories.parentCategoryId }).from(categories);

  const l1Match = allCats.find(c => !c.parentCategoryId && c.slug === topicSlug);
  if (!l1Match) return null;

  const catIds = new Set<string>();
  catIds.add(l1Match.id);
  for (const child of allCats.filter(c => c.parentCategoryId === l1Match.id)) {
    catIds.add(child.id);
    for (const gc of allCats.filter(c => c.parentCategoryId === child.id)) {
      catIds.add(gc.id);
    }
  }
  return catIds;
}

async function getZoneIdsForHubCode(hubCode: string, cityId: string): Promise<Set<string> | null> {
  const hubRegions = await db.select({ id: regions.id, name: regions.name, code: regions.code }).from(regions).where(
    and(
      sql`(LOWER(${regions.code}) = LOWER(${hubCode}) OR LOWER(REPLACE(${regions.name}, ' ', '')) = LOWER(REPLACE(${hubCode}, '-', '')))`,
      eq(regions.regionType, "hub"),
      eq(regions.isActive, true)
    )
  );
  if (hubRegions.length === 0) return null;

  const hubName = hubRegions[0].name;
  const matchedZones = await db.select({ id: zones.id }).from(zones).where(
    and(
      eq(zones.cityId, cityId),
      eq(zones.isActive, true),
      sql`(LOWER(${zones.slug}) = LOWER(${hubCode}) OR LOWER(${zones.name}) = LOWER(${hubName}))`
    )
  );

  if (matchedZones.length > 0) {
    return new Set(matchedZones.map(z => z.id));
  }
  return new Set();
}

async function queryFeedDirect(options: FeedQueryOptions): Promise<FeedItem[]> {
  const { cityId, citySlug, page, limit, topicTagSlug, geoTagSlug } = options;
  const items: FeedItem[] = [];
  const emptyTagMap = new Map<string, Tag[]>();
  const fetchLimit = limit * 2;

  const topicCatIds = topicTagSlug ? await getCategoryIdsForTopicSlug(topicTagSlug) : null;
  const geoZoneIds = geoTagSlug ? await getZoneIdsForHubCode(geoTagSlug, cityId) : null;

  const safeQuery = async <T>(label: string, query: Promise<T[]>): Promise<T[]> => {
    try { return await query; } catch (e: any) { console.error(`[FeedDirect] ${label} query failed:`, e.message); return []; }
  };

  const [bizRows, evtRows, artRows, mlRows, postRows, siRows, sdRows] = await Promise.all([
    safeQuery("businesses", db.select().from(businesses).where(and(eq(businesses.cityId, cityId), sql`${businesses.claimStatus} != 'UNCLAIMED'`, sql`${businesses.listingTier} = 'ENHANCED'`)).orderBy(desc(businesses.priorityRank)).limit(fetchLimit)),
    safeQuery("events", db.select().from(events).where(and(eq(events.cityId, cityId), sql`COALESCE(${events.endDateTime}, ${events.startDateTime}) >= NOW()`)).orderBy(events.startDateTime).limit(fetchLimit)),
    safeQuery("articles", db.select().from(articles).where(eq(articles.cityId, cityId)).orderBy(desc(articles.publishedAt)).limit(fetchLimit)),
    safeQuery("marketplace", db.select().from(marketplaceListings).where(and(eq(marketplaceListings.status, "ACTIVE"))).limit(fetchLimit)),
    safeQuery("posts", db.select().from(posts).where(and(eq(posts.cityId, cityId), eq(posts.status, "published"))).orderBy(desc(posts.publishedAt)).limit(fetchLimit)),
    safeQuery("shopItems", db.select().from(shopItems).where(and(eq(shopItems.cityId, cityId), eq(shopItems.status, "active"))).orderBy(desc(shopItems.createdAt)).limit(fetchLimit)),
    safeQuery("shopDrops", db.select().from(shopDrops).where(and(eq(shopDrops.cityId, cityId), eq(shopDrops.status, "active"))).orderBy(desc(shopDrops.createdAt)).limit(fetchLimit)),
  ]);

  const faithCatIdsDirect = await getFaithCategoryIds();
  for (const biz of bizRows) {
    if (isFaithBusiness(biz, faithCatIdsDirect)) continue;
    if (topicCatIds && !biz.categoryIds?.some(cid => topicCatIds.has(cid))) continue;
    if (geoZoneIds && (!biz.zoneId || !geoZoneIds.has(biz.zoneId))) continue;
    const item = projectBusiness(biz, citySlug, emptyTagMap);
    if (item) items.push(item);
  }
  for (const evt of evtRows) {
    if (geoZoneIds && (!evt.zoneId || !geoZoneIds.has(evt.zoneId))) continue;
    const item = projectEvent(evt, citySlug, emptyTagMap);
    if (item) items.push(item);
  }
  for (const art of artRows) {
    const item = projectArticle(art, citySlug, emptyTagMap);
    if (item) items.push(item);
  }
  for (const ml of mlRows) {
    if (ml.cityId === cityId) {
      const item = projectMarketplaceListing(ml, citySlug, emptyTagMap);
      if (item) items.push(item);
    }
  }
  for (const p of postRows) {
    const item = projectPost(p, citySlug, emptyTagMap);
    if (item) items.push(item);
  }

  const allShopBizIds = [...new Set([...siRows.map(si => si.businessId), ...sdRows.map(sd => sd.businessId)])];
  const shopBizNameMap = new Map<string, string>();
  if (allShopBizIds.length > 0) {
    const shopBizRows = await db.select({ id: businesses.id, name: businesses.name }).from(businesses).where(inArray(businesses.id, allShopBizIds));
    for (const b of shopBizRows) shopBizNameMap.set(b.id, b.name);
  }
  for (const si of siRows) {
    const item = projectShopItem(si, citySlug, shopBizNameMap.get(si.businessId) || null);
    if (item) items.push(item);
  }
  for (const sd of sdRows) {
    const item = projectShopDrop(sd, citySlug, shopBizNameMap.get(sd.businessId) || null);
    if (item) items.push(item);
  }

  const [attrRows, clRows, digestRows, jobRows, rssRows, cmsRows] = await Promise.all([
    safeQuery("attractions", db.select().from(attractions).where(eq(attractions.cityId, cityId)).limit(fetchLimit)),
    safeQuery("curatedLists", db.select().from(curatedLists).where(eq(curatedLists.cityId, cityId)).orderBy(desc(curatedLists.createdAt)).limit(fetchLimit)),
    safeQuery("digests", db.select().from(digests).where(eq(digests.cityId, cityId)).orderBy(desc(digests.createdAt)).limit(10)),
    safeQuery("jobs", db.select().from(jobs).where(eq(jobs.cityId, cityId)).orderBy(desc(jobs.postedAt)).limit(fetchLimit)),
    safeQuery("rssItems", (async () => {
      const surface = options.surface || "pulse";
      const excCats = RANKING_CONFIG.negativeContentFilter.excludedCategorySlugs;

      if (geoTagSlug) {
        const hubSlugLower = geoTagSlug.toLowerCase();
        const hubMatched = await db.select().from(rssItems).where(and(
          eq(rssItems.cityId, cityId),
          eq(rssItems.reviewStatus, "APPROVED"),
          sql`(LOWER(${rssItems.geoPrimarySlug}) = ${hubSlugLower} OR LOWER(${rssItems.geoSecondarySlug}) = ${hubSlugLower} OR LOWER(${rssItems.hubSlug}) = ${hubSlugLower} OR LOWER(${rssItems.zoneSlug}) = ${hubSlugLower})`
        )).orderBy(desc(rssItems.publishedAt)).limit(fetchLimit);

        const hubMatchedIds = new Set(hubMatched.map(r => r.id));
        const spillover = await db.select().from(rssItems).where(and(
          eq(rssItems.cityId, cityId),
          eq(rssItems.reviewStatus, "APPROVED"),
          sql`COALESCE(LOWER(${rssItems.categoryCoreSlug}), '') NOT IN (${sql.join(excCats.map(c => sql`${c}`), sql`, `)})`,
        )).orderBy(desc(rssItems.publishedAt)).limit(fetchLimit);

        const combined = [...hubMatched];
        for (const r of spillover) {
          if (!hubMatchedIds.has(r.id)) combined.push(r);
          if (combined.length >= fetchLimit) break;
        }
        return combined;
      }

      if (surface === "category" && topicTagSlug) {
        const catSlugLower = topicTagSlug.toLowerCase();
        const coreMatched = await db.select().from(rssItems).where(and(
          eq(rssItems.cityId, cityId),
          eq(rssItems.reviewStatus, "APPROVED"),
          sql`(LOWER(${rssItems.categoryCoreSlug}) = ${catSlugLower} OR LOWER(${rssItems.categorySubSlug}) = ${catSlugLower})`
        )).orderBy(desc(rssItems.publishedAt)).limit(fetchLimit);

        const catMatchedIds = new Set(coreMatched.map(r => r.id));
        const catSpillover = await db.select().from(rssItems).where(and(
          eq(rssItems.cityId, cityId),
          eq(rssItems.reviewStatus, "APPROVED"),
          sql`COALESCE(LOWER(${rssItems.categoryCoreSlug}), '') NOT IN (${sql.join(excCats.map(c => sql`${c}`), sql`, `)})`,
        )).orderBy(desc(rssItems.publishedAt)).limit(fetchLimit);

        const catCombined = [...coreMatched];
        for (const r of catSpillover) {
          if (!catMatchedIds.has(r.id)) catCombined.push(r);
          if (catCombined.length >= fetchLimit) break;
        }
        return catCombined;
      }

      return db.select().from(rssItems).where(and(
        eq(rssItems.cityId, cityId),
        eq(rssItems.reviewStatus, "APPROVED"),
        sql`COALESCE(LOWER(${rssItems.categoryCoreSlug}), '') NOT IN (${sql.join(excCats.map(c => sql`${c}`), sql`, `)})`,
      )).orderBy(desc(rssItems.publishedAt)).limit(fetchLimit);
    })()),
    safeQuery("cmsContent", Promise.resolve([] as any[])),
  ]);

  for (const a of attrRows) {
    const item = projectAttraction(a, citySlug);
    if (item) items.push(item);
  }
  for (const cl of clRows) {
    const item = projectCuratedList(cl, citySlug);
    if (item) items.push(item);
  }
  for (const d of digestRows) {
    const item = projectDigest(d, citySlug);
    if (item) items.push(item);
  }
  for (const j of jobRows) {
    const item = projectJob(j, citySlug);
    if (item) items.push(item);
  }
  for (const r of rssRows) {
    const item = projectRssItem(r, citySlug, options.surface);
    if (item) items.push(item);
  }
  for (const p of cmsRows) {
    const item = projectCmsPage(p, citySlug);
    if (item) items.push(item);
  }

  const videoRows = await db.select().from(videoContent).where(
    and(eq(videoContent.cityId, cityId), eq(videoContent.pulseEligible, true))
  ).orderBy(desc(videoContent.createdAt)).limit(fetchLimit);

  const vcBizIds = [...new Set(videoRows.filter(v => v.businessId).map(v => v.businessId!))];
  const vcBizNameMap = new Map<string, string>();
  if (vcBizIds.length > 0) {
    const vcBizRows = await db.select({ id: businesses.id, name: businesses.name }).from(businesses).where(inArray(businesses.id, vcBizIds));
    for (const b of vcBizRows) vcBizNameMap.set(b.id, b.name);
  }

  for (const vc of videoRows) {
    const bizName = vc.businessId ? vcBizNameMap.get(vc.businessId) || null : null;
    if (vc.podcastEligible && vc.audioUrl) {
      const item = projectPodcastContent(vc, citySlug, bizName);
      if (item) items.push(item);
    } else {
      const item = projectVideoContent(vc, citySlug, bizName);
      if (item) items.push(item);
    }
  }

  const podEpRows = await db.select({
    episode: localPodcastEpisodes,
    podcast: localPodcasts,
  })
  .from(localPodcastEpisodes)
  .innerJoin(localPodcasts, eq(localPodcastEpisodes.podcastId, localPodcasts.id))
  .where(and(
    eq(localPodcasts.cityId, cityId),
    eq(localPodcasts.status, "approved"),
  ))
  .orderBy(desc(localPodcastEpisodes.publishedAt))
  .limit(fetchLimit);

  for (const row of podEpRows) {
    const item = projectLocalPodcastEpisode(row.episode, row.podcast, citySlug);
    if (item) items.push(item);
  }

  const pvRows = await db.select().from(pulseVideos)
    .where(and(eq(pulseVideos.cityId, cityId), eq(pulseVideos.status, "approved")))
    .orderBy(desc(pulseVideos.createdAt))
    .limit(fetchLimit);
  for (const pv of pvRows) {
    const item = projectPulseVideo(pv, citySlug);
    if (item) items.push(item);
  }

  const crownItems = await fetchCrownFeedItems(cityId, citySlug);
  items.push(...crownItems);

  return items;
}

async function getSponsoredBusinesses(cityId: string, citySlug: string): Promise<FeedItem[]> {
  const sponsoredBiz = await db.select().from(businesses).where(
    and(
      eq(businesses.cityId, cityId),
      eq(businesses.isSponsored, true),
      sql`${businesses.claimStatus} != 'UNCLAIMED'`,
      sql`${businesses.listingTier} = 'ENHANCED'`,
    )
  ).limit(10);

  const faithCatIdsSpon = await getFaithCategoryIds();
  const emptyTagMap = new Map<string, Tag[]>();
  const items: FeedItem[] = [];
  for (const biz of sponsoredBiz) {
    if (isFaithBusiness(biz, faithCatIdsSpon)) continue;
    const item = projectSponsored(biz, citySlug, emptyTagMap);
    if (item) items.push(item);
  }

  return items;
}

async function getEnhancedListingCards(cityId: string, citySlug: string): Promise<FeedItem[]> {
  const enhancedBiz = await db.select().from(businesses).where(
    and(
      eq(businesses.cityId, cityId),
      eq(businesses.listingTier, "ENHANCED"),
      sql`${businesses.claimStatus} != 'UNCLAIMED'`,
    )
  ).limit(20);

  if (enhancedBiz.length === 0) return [];

  const faithCatIdsEnh = await getFaithCategoryIds();
  const shuffled = enhancedBiz.filter(b => !isFaithBusiness(b, faithCatIdsEnh)).sort(() => Math.random() - 0.5);
  const emptyTagMap = new Map<string, Tag[]>();
  const items: FeedItem[] = [];
  for (const biz of shuffled) {
    const item = projectEnhancedListing(biz, citySlug, emptyTagMap);
    if (item) items.push(item);
  }
  return items;
}

function injectEnhancedListings(organic: FeedItem[], enhanced: FeedItem[]): FeedItem[] {
  if (enhanced.length === 0) return organic;

  const organicBizIds = new Set(organic.filter(i => i.type === "business").map(i => i.id));
  const uniqueEnhanced = enhanced.filter(i => !organicBizIds.has(i.id.replace("enhanced-", "")));
  if (uniqueEnhanced.length === 0) return organic;

  const result: FeedItem[] = [];
  let enhIdx = 0;
  const interval = 12;
  const offset = 7;

  for (let i = 0; i < organic.length; i++) {
    result.push(organic[i]);
    if ((i + 1) >= offset && ((i + 1 - offset) % interval === 0) && enhIdx < uniqueEnhanced.length) {
      result.push(uniqueEnhanced[enhIdx]);
      enhIdx++;
    }
  }

  return result;
}

function deduplicateItems(items: FeedItem[]): FeedItem[] {
  const seen = new Set<string>();
  const result: FeedItem[] = [];
  for (const item of items) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      result.push(item);
    }
  }
  return result;
}

function applyCrossTypeDedup(items: FeedItem[]): FeedItem[] {
  if (items.length <= 1) return items;
  const suppressed = new Set<number>();
  for (let i = 0; i < items.length; i++) {
    if (suppressed.has(i)) continue;
    const wordsA = titleWords(items[i].title);
    for (let j = i + 1; j < items.length; j++) {
      if (suppressed.has(j)) continue;
      if (items[i].type === items[j].type) continue;
      const sim = jaccardSimilarity(wordsA, titleWords(items[j].title));
      if (sim >= 0.75) {
        const aHasBody = !!(items[i] as Record<string, unknown>).articleBody;
        const bHasBody = !!(items[j] as Record<string, unknown>).articleBody;
        if (aHasBody && !bHasBody) {
          suppressed.add(j);
        } else if (bHasBody && !aHasBody) {
          suppressed.add(i);
          break;
        } else {
          suppressed.add(j);
        }
      }
    }
  }
  return items.filter((_, idx) => !suppressed.has(idx));
}

function insertSponsoredCards(organic: FeedItem[], sponsored: FeedItem[]): FeedItem[] {
  if (sponsored.length === 0) return organic;

  const organicIds = new Set(organic.map(item => item.id));

  const uniqueSponsored = sponsored.filter(item => !organicIds.has(item.id));
  if (uniqueSponsored.length === 0) return organic;

  const result: FeedItem[] = [];
  let sponsorIdx = 0;
  const interval = RANKING_CONFIG.sponsoredInsertionInterval;

  for (let i = 0; i < organic.length; i++) {
    result.push(organic[i]);
    if ((i + 1) % interval === 0 && sponsorIdx < uniqueSponsored.length) {
      result.push(uniqueSponsored[sponsorIdx]);
      sponsorIdx++;
    }
  }

  return result;
}

export async function queryBusinessFeed(businessId: string, citySlug: string, limit: number = 20): Promise<FeedItem[]> {
  const items: FeedItem[] = [];
  const emptyTagMap = new Map<string, Tag[]>();

  const [postRows, evtRows, siRows, sdRows] = await Promise.all([
    db.select().from(posts).where(and(eq(posts.businessId, businessId), eq(posts.status, "published"))).orderBy(desc(posts.publishedAt)).limit(limit),
    db.select().from(events).where(eq(events.hostBusinessId, businessId)).orderBy(desc(events.startDateTime)).limit(limit),
    db.select().from(shopItems).where(and(eq(shopItems.businessId, businessId), eq(shopItems.status, "active"))).orderBy(desc(shopItems.createdAt)).limit(limit),
    db.select().from(shopDrops).where(and(eq(shopDrops.businessId, businessId), eq(shopDrops.status, "active"))).orderBy(desc(shopDrops.createdAt)).limit(limit),
  ]);

  const [bizRow] = await db.select({ name: businesses.name }).from(businesses).where(eq(businesses.id, businessId)).limit(1);
  const bizName = bizRow?.name || null;

  for (const p of postRows) {
    const item = projectPost(p, citySlug, emptyTagMap);
    if (item) items.push(item);
  }
  for (const evt of evtRows) {
    const item = projectEvent(evt, citySlug, emptyTagMap);
    if (item) items.push(item);
  }
  for (const si of siRows) {
    const item = projectShopItem(si, citySlug, bizName);
    if (item) items.push(item);
  }
  for (const sd of sdRows) {
    const item = projectShopDrop(sd, citySlug, bizName);
    if (item) items.push(item);
  }

  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return items.slice(0, limit);
}

function projectLiveStream(feed: LiveFeed, citySlug: string): FeedItem {
  return {
    id: `live-${feed.id}`,
    type: "live",
    title: feed.title,
    subtitle: feed.description || undefined,
    imageUrl: null,
    primaryTag: { slug: "live", label: "Live", type: "topic" },
    locationTags: [],
    createdAt: new Date().toISOString(),
    sponsored: false,
    url: `/${citySlug}/live`,
    whyShown: "Live stream",
    priorityScore: 200,
    embedUrl: feed.embedUrl,
    sourceUrl: feed.sourceUrl,
    mediaType: "video",
    sourceName: feed.title || "CLT Live",
  };
}

async function injectLiveItems(items: FeedItem[], page: number, citySlug: string, cityId: string): Promise<FeedItem[]> {
  const allFeeds = await storage.getLiveFeedsByCityId(cityId, true);
  const youtubeFeeds = allFeeds.filter(f => f.type === "youtube");
  if (youtubeFeeds.length === 0) return items;

  const result = [...items];
  const offset = ((page - 1) * 2) % youtubeFeeds.length;
  const liveItem1 = projectLiveStream(youtubeFeeds[offset % youtubeFeeds.length], citySlug);
  const liveItem2 = projectLiveStream(youtubeFeeds[(offset + 1) % youtubeFeeds.length], citySlug);

  const pos1 = Math.min(4, result.length);
  result.splice(pos1, 0, liveItem1);

  if (result.length > 12) {
    const pos2 = Math.min(14, result.length);
    result.splice(pos2, 0, liveItem2);
  }

  return result;
}

const FEED_TYPE_TO_ENGAGEMENT_TYPE: Record<string, string> = {
  business: "business",
  event: "event",
  article: "article",
  post: "post",
  reel: "reel",
  marketplace: "marketplace_listing",
};

async function hydrateEngagementCounts(items: FeedItem[]): Promise<FeedItem[]> {
  if (items.length === 0) return items;

  const likeable = items.filter(i => FEED_TYPE_TO_ENGAGEMENT_TYPE[i.type]);
  if (likeable.length === 0) return items;

  const contentIds = likeable.map(i => i.id);

  try {
    const likeCounts = await db
      .select({
        contentId: likes.contentId,
        total: count(),
      })
      .from(likes)
      .where(inArray(likes.contentId, contentIds))
      .groupBy(likes.contentId);

    const likeMap = new Map<string, number>();
    for (const row of likeCounts) {
      likeMap.set(row.contentId, Number(row.total));
    }

    return items.map(item => ({
      ...item,
      likeCount: likeMap.get(item.id) || 0,
    }));
  } catch (err) {
    return items;
  }
}

async function fetchAreaFacts(cityId: string, hubRegionId?: string | null): Promise<FeedItem[]> {
  try {
    const conditions = [eq(areaFacts.cityId, cityId), eq(areaFacts.isActive, true)];
    const rows = await db.select().from(areaFacts).where(and(...conditions)).orderBy(sql`RANDOM()`).limit(8);

    const hubMatched = hubRegionId ? rows.filter(r => r.hubRegionId === hubRegionId) : [];
    const metroWide = rows.filter(r => !r.hubRegionId);
    const other = rows.filter(r => r.hubRegionId && r.hubRegionId !== hubRegionId);
    const ordered = [...hubMatched, ...metroWide, ...other].slice(0, 5);

    return ordered.map(fact => ({
      id: `fact-${fact.id}`,
      type: "fact" as const,
      title: "Did You Know?",
      subtitle: fact.factText,
      imageUrl: null,
      primaryTag: fact.category ? { slug: fact.category, label: fact.category.charAt(0).toUpperCase() + fact.category.slice(1), type: "topic" } : null,
      locationTags: [],
      createdAt: fact.createdAt?.toISOString() || new Date().toISOString(),
      sponsored: false,
      url: "",
      whyShown: fact.hubRegionId ? "Local fact" : "Charlotte metro fact",
      priorityScore: 5,
      subtitleEs: fact.factTextEs || null,
      sourceName: "CLT Facts",
    }));
  } catch (err) {
    return [];
  }
}

function injectFactCards(items: FeedItem[], factCards: FeedItem[]): FeedItem[] {
  if (factCards.length === 0) return items;
  const result: FeedItem[] = [];
  let factIndex = 0;
  for (let i = 0; i < items.length; i++) {
    result.push(items[i]);
    if ((i + 1) % 15 === 0 && factIndex < factCards.length) {
      result.push(factCards[factIndex]);
      factIndex++;
    }
  }
  return result;
}

async function resolveGeoContext(geoTagSlug?: string): Promise<RankingGeoContext> {
  if (!geoTagSlug) return {};

  const slug = geoTagSlug.toLowerCase();
  const [hub] = await db.select({
    id: regions.id,
    code: regions.code,
    parentRegionId: regions.parentRegionId,
  }).from(regions).where(
    and(sql`LOWER(${regions.code}) = ${slug}`, eq(regions.regionType, "hub"))
  ).limit(1);

  if (hub) {
    let countySlug: string | undefined;
    if (hub.parentRegionId) {
      const [county] = await db.select({ code: regions.code }).from(regions)
        .where(eq(regions.id, hub.parentRegionId)).limit(1);
      countySlug = county?.code?.toLowerCase() || undefined;
    }
    return {
      geoPrimarySlug: slug,
      hubSlug: slug,
      countySlug,
    };
  }

  const [county] = await db.select({ code: regions.code }).from(regions).where(
    and(sql`LOWER(${regions.code}) = ${slug}`, eq(regions.regionType, "county"))
  ).limit(1);

  if (county) {
    return { countySlug: slug };
  }

  return { geoPrimarySlug: slug };
}

export async function queryFeed(options: FeedQueryOptions): Promise<{
  items: FeedItem[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  debugSkipped?: Array<{ itemId: string; reason: string }>;
}> {
  const { page, limit, feedSessionId } = options;

  const [ctCount] = await db.select({ total: count() }).from(contentTags);
  const hasContentTags = (ctCount?.total || 0) > 0;

  let organicItems: FeedItem[];
  if (hasContentTags) {
    organicItems = await queryFeedViaTags(options);
  } else {
    organicItems = await queryFeedDirect(options);
  }

  if (organicItems.length === 0) {
    organicItems = await queryFeedDirect(options);
  }

  const repostItems = await getApprovedReposts(options.cityId, options.citySlug, 10);
  organicItems = [...organicItems, ...repostItems];

  organicItems = deduplicateItems(organicItems);

  if (options.context === "weekend") {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysUntilFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : 5 + (7 - dayOfWeek);
    const friday = new Date(now);
    friday.setDate(now.getDate() + daysUntilFriday);
    friday.setHours(0, 0, 0, 0);
    const sunday = new Date(friday);
    sunday.setDate(friday.getDate() + 2);
    sunday.setHours(23, 59, 59, 999);
    if (dayOfWeek >= 5 || dayOfWeek === 0) {
      friday.setDate(now.getDate() - (dayOfWeek === 0 ? 2 : dayOfWeek - 5));
      friday.setHours(0, 0, 0, 0);
      sunday.setDate(friday.getDate() + 2);
      sunday.setHours(23, 59, 59, 999);
    }
    organicItems = organicItems.filter(item => {
      if (item.type === "event" && item.startDate) {
        const sd = new Date(item.startDate);
        return sd >= friday && sd <= sunday;
      }
      return false;
    });
  }

  if (options.context === "new") {
    organicItems.sort((a, b) => {
      const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bDate - aDate;
    });
  } else if (options.context === "trending") {
    organicItems.sort((a, b) => {
      const aEngagement = (a.likeCount || 0) + (a.shareCount || 0) + (a.saveCount || 0);
      const bEngagement = (b.likeCount || 0) + (b.shareCount || 0) + (b.saveCount || 0);
      if (bEngagement !== aEngagement) return bEngagement - aEngagement;
      return b.priorityScore - a.priorityScore;
    });
  } else {
    const geoCtx = await resolveGeoContext(options.geoTagSlug);
    const surface: SurfaceType = options.surface || "default";
    await hydrateEngagementSignals(organicItems);
    rankWithScoring(organicItems, geoCtx, surface);
    organicItems = applyDiversityReranking(organicItems, surface);
  }

  organicItems = applyCrossTypeDedup(organicItems);

  const RSS_MIN_FLOOR = 3;
  const isRssFloorContext = !options.context || options.context === "foryou" || options.context === "new" || options.context === "trending";
  const first20 = organicItems.slice(0, 20);
  const rssInFirst20 = first20.filter(i => i.type === "rss").length;
  if (isRssFloorContext && rssInFirst20 < RSS_MIN_FLOOR) {
    const existingIds = new Set(organicItems.map(i => i.id));
    const needed = RSS_MIN_FLOOR - rssInFirst20;
    const rssConditions = [eq(rssItems.cityId, options.cityId), eq(rssItems.reviewStatus, "APPROVED")];
    if (options.geoTagSlug) {
      rssConditions.push(sql`(LOWER(${rssItems.hubSlug}) = LOWER(${options.geoTagSlug}) OR LOWER(${rssItems.zoneSlug}) = LOWER(${options.geoTagSlug}) OR LOWER(${rssItems.geoPrimarySlug}) = LOWER(${options.geoTagSlug}) OR LOWER(${rssItems.geoSecondarySlug}) = LOWER(${options.geoTagSlug}))`);
    }
    const rssRows = await db.select().from(rssItems).where(and(...rssConditions)).orderBy(desc(rssItems.publishedAt)).limit(needed * 4);
    const toInject: FeedItem[] = [];
    for (const r of rssRows) {
      if (toInject.length >= needed) break;
      if (existingIds.has(r.id)) continue;
      const item = projectRssItem(r, options.citySlug, options.surface);
      if (item) toInject.push(item);
    }
    if (toInject.length > 0) {
      const spacing = Math.max(3, Math.floor(20 / (toInject.length + 1)));
      for (let i = 0; i < toInject.length; i++) {
        const pos = Math.min(spacing * (i + 1), organicItems.length);
        organicItems.splice(pos, 0, toInject[i]);
      }
    }
  }

  const sponsoredItems = await getSponsoredBusinesses(options.cityId, options.citySlug).catch((e) => { console.error("[Feed] getSponsoredBusinesses error:", e.message); return [] as FeedItem[]; });
  const mergedItems = insertSponsoredCards(organicItems, sponsoredItems);

  const enhancedItems = await getEnhancedListingCards(options.cityId, options.citySlug).catch((e) => { console.error("[Feed] getEnhancedListingCards error:", e.message); return [] as FeedItem[]; });
  const withEnhancedRaw = injectEnhancedListings(mergedItems, enhancedItems);

  let hubRegionIdForFacts: string | null = null;
  if (options.geoTagSlug) {
    const [hub] = await db.select({ id: regions.id }).from(regions)
      .where(and(sql`UPPER(${regions.code}) = UPPER(${options.geoTagSlug})`, eq(regions.regionType, "hub")))
      .limit(1);
    hubRegionIdForFacts = hub?.id || null;
  }
  const factCards = await fetchAreaFacts(options.cityId, hubRegionIdForFacts);
  const withEnhanced = injectFactCards(withEnhancedRaw, factCards);

  let session: import("./feed-session").FeedSession | null = null;
  if (feedSessionId) {
    const { getFeedSession } = await import("./feed-session");
    session = getFeedSession(feedSessionId);
  }

  if (session && session.acceptedHistory.length > 0) {
    const { computeSessionFatiguePenalty } = await import("./feed-session");
    for (const item of withEnhanced) {
      const penalty = computeSessionFatiguePenalty(
        session,
        item.sourceName || null,
        item.geoMeta?.categoryCoreSlug || item.primaryTag?.slug || null
      );
      if (penalty > 0) {
        item.priorityScore = Math.max(0, item.priorityScore - penalty);
      }
    }
    withEnhanced.sort((a, b) => b.priorityScore - a.priorityScore);
    const surface: SurfaceType = options.surface || "default";
    const reranked = applyDiversityReranking(withEnhanced, surface);
    withEnhanced.length = 0;
    for (const r of reranked) withEnhanced.push(r);
  }

  {
    const capped = enforceTop20SourceCap(withEnhanced);
    withEnhanced.length = 0;
    for (const c of capped) withEnhanced.push(c);
  }

  if (page === 1 && withEnhanced.length > 4) {
    const topN = Math.min(withEnhanced.length, 10);
    const topSlice = withEnhanced.splice(0, topN);
    const overflow = withEnhanced.splice(0, Math.min(withEnhanced.length, 30));
    const pool = [...topSlice, ...overflow];

    const result: typeof pool = [];
    const usedSources = new Set<string>();
    const placed = new Set<number>();

    for (let round = 0; result.length < topN && round < 3; round++) {
      if (round > 0) usedSources.clear();
      for (let i = 0; i < pool.length && result.length < topN; i++) {
        if (placed.has(i)) continue;
        const src = pool[i].sourceName || "";
        if (src && usedSources.has(src) && round === 0) continue;
        result.push(pool[i]);
        placed.add(i);
        if (src) usedSources.add(src);
      }
    }

    const remaining: typeof pool = [];
    for (let i = 0; i < pool.length; i++) {
      if (!placed.has(i)) remaining.push(pool[i]);
    }

    withEnhanced.unshift(...result, ...remaining);
  }

  if (session) {
    const { constrainedSelect } = await import("./feed-session");
    const start = (page - 1) * limit;
    const candidatePool = withEnhanced.slice(start);
    const { accepted, skipped } = constrainedSelect(candidatePool, session, limit);

      const finalItems = await hydrateEngagementCounts(await injectLiveItems(accepted, page, options.citySlug, options.cityId));
      return {
        items: finalItems,
        total: withEnhanced.length,
        page,
        limit,
        hasMore: accepted.length === limit && start + limit < withEnhanced.length,
        debugSkipped: skipped,
      };
  }

  const total = withEnhanced.length;
  const start = (page - 1) * limit;
  const paginatedItems = withEnhanced.slice(start, start + limit);
  const finalItems = await hydrateEngagementCounts(await injectLiveItems(paginatedItems, page, options.citySlug, options.cityId));

  return {
    items: finalItems,
    total,
    page,
    limit,
    hasMore: start + limit < total,
  };
}

export {
  projectBusiness, projectEvent, projectArticle, projectMarketplaceListing,
  projectPost, projectShopItem, projectShopDrop, projectAttraction,
  projectCuratedList, projectDigest, projectJob, projectVolunteer,
  projectCmsPage, projectRssItem, projectVideoContent, projectPodcastContent,
  projectLocalPodcastEpisode, projectPulseVideo, projectEnhancedListing,
  projectSponsored, projectCrownWinner, projectCrownCategory, projectLiveStream,
  isEventFeedWorthy, isFaithBusiness, getFaithCategoryIds, isNegativeContent,
  deduplicateItems, hydrateEngagementCounts, fetchCrownFeedItems,
  getApprovedReposts, getSponsoredBusinesses, getEnhancedListingCards,
  fetchAreaFacts, resolveGeoContext, buildTagMap, getDescendantTagIds,
  getContentIdsByTags, getZoneIdsForHubCode, getCategoryIdsForTopicSlug,
  injectLiveItems,
  insertSponsoredCards, injectEnhancedListings, injectFactCards,
  projectWishlistItem, FEED_TYPE_TO_ENGAGEMENT_TYPE,
};
