import { useState, useRef, useCallback, useEffect, type MouseEvent, type TouchEvent } from "react";
import { Calendar, Store, Newspaper, Tag, Sparkles, MapPin, Clock, Heart, Play, Film, MessageSquare, Send, Bookmark, ShoppingBag, Ticket, Copy, Check, X, Building2, Radio, Landmark, ListOrdered, BookOpen, Briefcase, FileText, Rss, Crown, UserPlus, Headphones, Volume2, Gift, Trophy, Vote } from "lucide-react";
import { SiTiktok } from "react-icons/si";
import { isTikTokEmbed } from "@/lib/tiktok";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { trackFeedEvent } from "@/lib/intelligence-tracker";
import { ShareMenu } from "@/components/share-menu";
import { useI18n, localized, type TranslationKey } from "@/lib/i18n";
import { Link } from "wouter";

export interface FeedCardTag {
  slug: string;
  label: string;
  type?: string;
}

export interface FeedCardItem {
  id: string;
  type: "business" | "event" | "article" | "marketplace" | "sponsored" | "post" | "reel" | "shop_item" | "shop_drop" | "repost" | "live" | "attraction" | "curated_list" | "digest" | "job" | "page" | "rss" | "enhanced_listing" | "podcast" | "fact" | "pulse_video" | "volunteer" | "wishlist" | "crown_winner" | "crown_category";
  title: string;
  subtitle: string;
  imageUrl: string | null;
  primaryTag: FeedCardTag | null;
  locationTags: FeedCardTag[];
  startDate?: string | null;
  endDate?: string | null;
  sponsored: boolean;
  url: string;
  priorityScore: number;
  mediaType?: "image" | "video" | "reel" | "gallery" | "audio";
  audioUrl?: string | null;
  audioDurationSec?: number | null;
  videoUrl?: string | null;
  videoEmbedUrl?: string | null;
  videoThumbnailUrl?: string | null;
  videoDurationSec?: number | null;
  price?: number | null;
  compareAtPrice?: number | null;
  dealType?: string | null;
  discountPercent?: number | null;
  expiresAt?: string | null;
  claimCount?: number | null;
  maxClaims?: number | null;
  externalUrl?: string | null;
  businessName?: string | null;
  repostUser?: string | null;
  repostCaption?: string | null;
  presenceType?: string | null;
  embedUrl?: string | null;
  sourceUrl?: string | null;
  sponsorshipMeta?: { tier?: string; businessName?: string } | null;
  handle?: string | null;
  authorName?: string | null;
  authorAvatarUrl?: string | null;
  createdAt?: string | null;
  likeCount?: number;
  shareCount?: number;
  saveCount?: number;
  titleEs?: string | null;
  subtitleEs?: string | null;
  creatorType?: string | null;
  isHiring?: boolean;
  crownMeta?: { categoryName?: string; voteCount?: number; seasonYear?: number; status?: string } | null;
  articleBody?: string | null;
  articleBodyEs?: string | null;
  eventAddress?: string | null;
  eventLocationName?: string | null;
  eventCostText?: string | null;
  geoMeta?: {
    geoPrimarySlug?: string | null;
    geoSecondarySlug?: string | null;
    hubSlug?: string | null;
    countySlug?: string | null;
    categoryCoreSlug?: string | null;
  } | null;
}

const TYPE_CONFIG: Record<string, { icon: typeof Calendar; label: string; accent: string }> = {
  event: { icon: Calendar, label: "Event", accent: "from-rose-600/90 to-pink-700/90" },
  business: { icon: Store, label: "Business", accent: "from-purple-600/90 to-indigo-700/90" },
  organization: { icon: Building2, label: "Organization", accent: "from-teal-600/90 to-cyan-700/90" },
  article: { icon: Newspaper, label: "Article", accent: "from-amber-600/90 to-orange-700/90" },
  marketplace: { icon: Tag, label: "Listing", accent: "from-emerald-600/90 to-teal-700/90" },
  sponsored: { icon: Sparkles, label: "Sponsored", accent: "from-yellow-500/90 to-amber-600/90" },
  post: { icon: MessageSquare, label: "Post", accent: "from-blue-600/90 to-cyan-700/90" },
  reel: { icon: Film, label: "Reel", accent: "from-fuchsia-600/90 to-pink-700/90" },
  shop_item: { icon: ShoppingBag, label: "Shop", accent: "from-emerald-600/90 to-green-700/90" },
  shop_drop: { icon: Sparkles, label: "Deal", accent: "from-amber-500/90 to-orange-600/90" },
  repost: { icon: MessageSquare, label: "Repost", accent: "from-blue-500/90 to-indigo-600/90" },
  live: { icon: Radio, label: "Live", accent: "from-red-600/90 to-rose-700/90" },
  attraction: { icon: Landmark, label: "Attraction", accent: "from-green-600/90 to-emerald-700/90" },
  curated_list: { icon: ListOrdered, label: "Curated", accent: "from-teal-500/90 to-cyan-600/90" },
  digest: { icon: BookOpen, label: "Digest", accent: "from-purple-500/90 to-violet-600/90" },
  job: { icon: Briefcase, label: "Job", accent: "from-blue-500/90 to-sky-600/90" },
  page: { icon: FileText, label: "Page", accent: "from-gray-500/90 to-slate-600/90" },
  rss: { icon: Rss, label: "News", accent: "from-orange-500/90 to-amber-600/90" },
  enhanced_listing: { icon: Crown, label: "Featured", accent: "from-purple-600/90 to-amber-500/90" },
  podcast: { icon: Headphones, label: "Podcast", accent: "from-violet-600/90 to-purple-700/90" },
  fact: { icon: Sparkles, label: "Did You Know?", accent: "from-purple-600/90 to-indigo-700/90" },
  pulse_video: { icon: Film, label: "Short Video", accent: "from-fuchsia-600/90 to-violet-700/90" },
  volunteer: { icon: Heart, label: "Volunteer", accent: "from-purple-600/90 to-violet-700/90" },
  wishlist: { icon: Gift, label: "Needed", accent: "from-rose-600/90 to-pink-700/90" },
  crown_winner: { icon: Trophy, label: "Crown Winner", accent: "from-amber-500/90 to-yellow-600/90" },
  crown_category: { icon: Crown, label: "Crown Vote", accent: "from-amber-600/90 to-yellow-700/90" },
};

const PLACEHOLDER_GRADIENTS = [
  "from-purple-900 via-indigo-900 to-blue-900",
  "from-rose-900 via-pink-900 to-purple-900",
  "from-amber-900 via-orange-900 to-red-900",
  "from-teal-900 via-emerald-900 to-green-900",
  "from-blue-900 via-cyan-900 to-teal-900",
];

const TYPE_GRADIENTS: Record<string, string> = {
  event: "from-rose-900 via-pink-900 to-purple-900",
  business: "from-purple-900 via-indigo-900 to-blue-900",
  organization: "from-teal-900 via-cyan-900 to-blue-900",
  rss: "from-teal-900 via-emerald-900 to-green-900",
  article: "from-blue-900 via-cyan-900 to-teal-900",
  live: "from-gray-900 via-red-950 to-gray-900",
  podcast: "from-violet-900 via-purple-900 to-indigo-900",
  job: "from-blue-900 via-sky-900 to-cyan-900",
  shop_item: "from-emerald-900 via-green-900 to-teal-900",
  shop_drop: "from-amber-900 via-orange-900 to-red-900",
  marketplace: "from-emerald-900 via-teal-900 to-cyan-900",
  fact: "from-purple-900 via-indigo-900 to-violet-900",
  volunteer: "from-purple-900 via-violet-900 to-indigo-900",
  wishlist: "from-rose-900 via-pink-900 to-red-900",
  crown_winner: "from-amber-900 via-yellow-900 to-orange-900",
  crown_category: "from-amber-900 via-yellow-900 to-orange-900",
};

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return "";
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  const diffWeek = Math.floor(diffDay / 7);
  if (diffWeek < 5) return `${diffWeek}w`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getAuthorInfo(item: FeedCardItem): { name: string; avatarUrl: string | null; label: string | null } {
  const effectiveType = item.type === "business" && item.presenceType === "organization" ? "organization" : item.type;

  if (effectiveType !== "rss" && effectiveType !== "article" && item.authorName) {
    return { name: item.authorName, avatarUrl: item.authorAvatarUrl || null, label: null };
  }

  switch (effectiveType) {
    case "business":
    case "organization":
    case "sponsored":
    case "enhanced_listing":
      return { name: item.title, avatarUrl: item.imageUrl, label: item.sponsored ? "Sponsored" : item.type === "enhanced_listing" ? "Featured" : null };
    case "event":
      return { name: item.businessName || item.title, avatarUrl: null, label: null };
    case "article":
    case "rss":
      return { name: "CLT Hub", avatarUrl: null, label: null };
    case "podcast":
      return { name: item.authorName || item.businessName || "Hub TV", avatarUrl: item.authorAvatarUrl || null, label: null };
    case "post":
    case "reel":
      return { name: item.handle ? `@${item.handle}` : "Community", avatarUrl: null, label: null };
    case "pulse_video":
      return { name: item.authorName || "Short Video", avatarUrl: item.authorAvatarUrl || null, label: null };
    case "crown_winner":
      return { name: item.crownMeta?.categoryName || "Crown Winner", avatarUrl: item.imageUrl, label: "Winner" };
    case "crown_category":
      return { name: "Crown Program", avatarUrl: null, label: "Vote" };
    default:
      return { name: item.businessName || item.title, avatarUrl: null, label: null };
  }
}

function formatEventDate(startDate: string): string {
  const date = new Date(startDate);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} days`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

const DEAL_TYPE_KEYS: Record<string, TranslationKey> = {
  flash_deal: "feedDetail.dealFlash",
  daily_deal: "feedDetail.dealDaily",
  weekend_special: "feedDetail.dealWeekend",
  clearance: "feedDetail.dealClearance",
  bogo: "feedDetail.dealBogo",
  bundle: "feedDetail.dealBundle",
};

function formatCountdown(expiresAt: string, t: (key: TranslationKey, r?: Record<string, string>) => string): string | null {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return null;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 24) return null;
  if (hours > 0) return t("feedDetail.hoursMinutesLeft", { h: String(hours), m: String(mins) });
  return t("feedDetail.minutesLeft", { m: String(mins) });
}

function formatDealType(dealType: string, t: (key: TranslationKey) => string): string {
  const key = DEAL_TYPE_KEYS[dealType];
  return key ? t(key) : dealType;
}

interface FeedCardProps {
  item: FeedCardItem;
  onTagClick?: (tag: FeedCardTag) => void;
  onCardClick?: (item: FeedCardItem) => void;
  onLike?: (item: FeedCardItem) => void;
  onSave?: (item: FeedCardItem) => void;
  onRepost?: (item: FeedCardItem) => void;
  liked?: boolean;
  saved?: boolean;
  requireAuth?: (action: string) => boolean;
  cityId?: string;
  citySlug?: string;
}

export function FeedCard({ item, onTagClick, onCardClick, onLike, onSave, onRepost, liked, saved, requireAuth, cityId, citySlug }: FeedCardProps) {
  const { locale, t } = useI18n();
  const effectiveType = item.type === "business" && item.presenceType === "organization" ? "organization" : item.type;
  const config = TYPE_CONFIG[effectiveType] || TYPE_CONFIG.business;
  const TypeIcon = config.icon;
  const placeholderGrad = TYPE_GRADIENTS[effectiveType] || PLACEHOLDER_GRADIENTS[item.id.charCodeAt(0) % PLACEHOLDER_GRADIENTS.length];
  const isLive = item.type === "live";
  const isPodcast = item.type === "podcast" || item.mediaType === "audio";
  const isVideo = !isLive && !isPodcast && (item.type === "reel" || item.type === "pulse_video" || item.mediaType === "video" || item.mediaType === "reel");
  const isTikTok = isTikTokEmbed(item.videoEmbedUrl);
  const isDrop = item.type === "shop_drop";
  const isShop = item.type === "shop_item";
  const cardLocale = (locale === "es" && item.titleEs && item.subtitleEs) ? "es" : "en";
  const displayTitle = localized(cardLocale, item.title, item.titleEs);
  const displaySubtitle = localized(cardLocale, item.subtitle, item.subtitleEs);
  const [localLiked, setLocalLiked] = useState(liked || false);
  const [localSaved, setLocalSaved] = useState(saved || false);
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const [claimExpanded, setClaimExpanded] = useState(false);
  const [claimCode, setClaimCode] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const { toast } = useToast();

  const lastTapRef = useRef(0);

  const handleLike = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    if (requireAuth && !requireAuth("like this")) return;
    setLocalLiked(prev => !prev);
    onLike?.(item);
  }, [item, onLike, requireAuth]);

  const handleSave = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    if (requireAuth && !requireAuth("save this")) return;
    setLocalSaved(prev => !prev);
    onSave?.(item);
  }, [item, onSave, requireAuth]);

  const handleRepost = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    onRepost?.(item);
  }, [item, onRepost]);

  const handleClaim = useCallback(async (e: MouseEvent) => {
    e.stopPropagation();
    if (requireAuth && !requireAuth("claim this deal")) return;

    if (claimCode) {
      setClaimExpanded(prev => !prev);
      return;
    }

    setClaiming(true);
    try {
      const itemType = isDrop ? "shop_drop" : "shop_item";
      const res = await apiRequest("POST", "/api/shop/claims", {
        itemType,
        itemId: item.id,
      });
      const claim = await res.json();
      setClaimCode(claim.claimCode);
      setClaimExpanded(true);
      toast({ title: "Claimed!", description: "Show the code at the business to redeem." });
    } catch (err: any) {
      toast({ title: "Couldn't claim", description: err.message || "Try again later." });
    } finally {
      setClaiming(false);
    }
  }, [item, isDrop, requireAuth, claimCode, toast]);

  const handleCopyCode = useCallback(async (e: MouseEvent) => {
    e.stopPropagation();
    if (!claimCode) return;
    try {
      await navigator.clipboard.writeText(claimCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {}
  }, [claimCode]);

  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      if (requireAuth && !requireAuth("like this")) {
        lastTapRef.current = 0;
        return;
      }
      if (!localLiked) {
        setLocalLiked(true);
        onLike?.(item);
      }
      setShowHeartBurst(true);
      setTimeout(() => setShowHeartBurst(false), 800);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  }, [localLiked, item, onLike]);

  const handleCardTap = useCallback(() => {
    if (Date.now() - lastTapRef.current > 350) {
      onCardClick?.(item);
    }
  }, [item, onCardClick]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    handleDoubleTap();
  }, [handleDoubleTap]);

  const handleClick = useCallback(() => {
    handleDoubleTap();
    setTimeout(handleCardTap, 310);
  }, [handleDoubleTap, handleCardTap]);

  const author = getAuthorInfo(item);
  const timestamp = timeAgo(item.createdAt);
  const hubLocalityName = (item.type === "rss" && item.geoMeta?.hubSlug)
    ? item.geoMeta.hubSlug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())
    : null;
  const totalEngagement = (item.likeCount || 0) + (item.shareCount || 0) + (item.saveCount || 0);
  if (item.type === "fact") {
    const categoryLabel = item.primaryTag?.label || "";
    return (
      <div data-testid={`feed-card-fact-${item.id}`} className="rounded-xl overflow-hidden">
        <div className="relative bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 p-6">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-3 right-4 w-24 h-24 rounded-full bg-purple-400/20" />
            <div className="absolute bottom-4 left-6 w-16 h-16 rounded-full bg-indigo-400/15" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Did You Know?</span>
              {categoryLabel && (
                <span className="ml-auto text-[10px] font-semibold text-white/40 uppercase tracking-wider">{categoryLabel}</span>
              )}
            </div>
            <p className="text-white text-base leading-relaxed font-medium" data-testid={`text-fact-${item.id}`}>
              {displaySubtitle}
            </p>
            {item.whyShown && (
              <p className="text-white/30 text-[10px] mt-3">{item.whyShown}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const isCrown = item.type === "crown_winner" || item.type === "crown_category";

  if (isCrown) {
    const isWinner = item.type === "crown_winner";
    const CrownIcon = isWinner ? Trophy : Crown;
    return (
      <div data-testid={`feed-card-crown-${item.id}`} className="rounded-xl overflow-hidden">
        <div className="relative bg-gradient-to-br from-amber-900 via-yellow-900 to-orange-900 border border-amber-500/30">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-2 right-3 w-20 h-20 rounded-full bg-amber-400/20" />
            <div className="absolute bottom-3 left-5 w-14 h-14 rounded-full bg-yellow-400/15" />
          </div>

          <div className="relative z-10 p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-amber-500/30 flex items-center justify-center">
                <CrownIcon className="h-4 w-4 text-amber-300" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                  {isWinner ? "Crown Winner" : "Crown Program"}
                </span>
                {item.crownMeta?.categoryName && (
                  <span className="block text-[10px] text-amber-200/60 truncate">{item.crownMeta.categoryName}</span>
                )}
              </div>
              {isWinner && (
                <Badge variant="outline" className="border-amber-400/60 bg-amber-500/20 text-amber-200 text-[10px]" data-testid={`crown-winner-badge-${item.id}`}>
                  <Trophy className="h-2.5 w-2.5 mr-0.5 text-amber-300" />
                  Winner
                </Badge>
              )}
            </div>

            <div className="flex items-start gap-4">
              {item.imageUrl && (
                <img
                  src={item.imageUrl}
                  alt={displayTitle}
                  className="w-16 h-16 rounded-lg object-cover ring-2 ring-amber-400/40 flex-shrink-0"
                  loading="lazy"
                />
              )}
              <div className="flex-1 min-w-0">
                <h3
                  className="text-lg font-bold text-white leading-tight line-clamp-2 mb-1 cursor-pointer"
                  onClick={() => onCardClick?.(item)}
                  data-testid={`crown-title-${item.id}`}
                >
                  {displayTitle}
                </h3>
                <p className="text-sm text-amber-100/70 line-clamp-2 mb-2" data-testid={`crown-subtitle-${item.id}`}>
                  {displaySubtitle}
                </p>
                {isWinner && item.crownMeta?.voteCount != null && item.crownMeta.voteCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-amber-300/80" data-testid={`crown-votes-${item.id}`}>
                    <Vote className="h-3 w-3" /> {item.crownMeta.voteCount} votes
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-amber-400/20">
              <div className="flex items-center gap-3">
                <button
                  className="flex items-center gap-1 group/like"
                  onClick={handleLike}
                  data-testid={`like-btn-${item.id}`}
                >
                  <Heart className={`h-4 w-4 transition-all duration-200 ${localLiked ? "text-red-500 fill-red-500" : "text-amber-200/50"}`} />
                </button>

                <div onClick={(e) => e.stopPropagation()}>
                  <ShareMenu
                    title={displayTitle}
                    url={`${window.location.origin}${item.url}`}
                    type="post"
                    slug={item.id}
                    trigger={
                      <button
                        className="flex items-center gap-1 group/share"
                        data-testid={`share-btn-${item.id}`}
                      >
                        <Send className="h-4 w-4 text-amber-200/50 rotate-[-30deg]" />
                      </button>
                    }
                  />
                </div>

                <button
                  className="flex items-center gap-1 group/save"
                  onClick={handleSave}
                  data-testid={`save-btn-${item.id}`}
                >
                  <Bookmark className={`h-4 w-4 transition-all duration-200 ${localSaved ? "text-amber-400 fill-amber-400" : "text-amber-200/50"}`} />
                </button>
              </div>

              <button
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 hover:text-amber-200 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onCardClick?.(item);
                }}
                data-testid={`crown-action-btn-${item.id}`}
              >
                {isWinner ? "View Winners" : "Vote Now"}
                <Crown className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isRss = item.type === "rss";

  if (isRss) {
    const originalSource = item.primaryTag?.label || item.businessName || "News";
    return (
      <div data-testid={`feed-card-rss-${item.id}`} className="rounded-xl overflow-hidden bg-gray-900/60 border border-white/10">
        {item.imageUrl && (
          <div
            className="relative w-full aspect-[2/1] cursor-pointer"
            onClick={handleClick}
            onTouchEnd={handleTouchEnd}
          >
            <img
              src={item.imageUrl}
              alt={displayTitle}
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            {showHeartBurst && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                <Heart className="h-24 w-24 text-red-500 fill-red-500 animate-ping opacity-80" />
              </div>
            )}
          </div>
        )}

        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center gap-2 mb-2" data-testid={`rss-source-row-${item.id}`}>
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <span className="text-[11px] font-bold text-white">C</span>
            </div>
            <span className="text-xs font-semibold text-purple-400 truncate">CLT Hub</span>
            {hubLocalityName && (
              <span className="text-[10px] bg-white/10 text-white/60 px-1.5 py-0.5 rounded font-medium flex-shrink-0" data-testid={`badge-hub-locality-${item.id}`}>{hubLocalityName}</span>
            )}
            <span className="text-[11px] text-white/30">via {originalSource}</span>
            {timestamp && (
              <span className="text-[11px] text-white/40 flex-shrink-0">{timestamp}</span>
            )}
          </div>

          <h3
            className="text-base font-bold text-white leading-snug line-clamp-3 mb-1.5 cursor-pointer"
            onClick={() => onCardClick?.(item)}
            data-testid={`rss-headline-${item.id}`}
          >
            {displayTitle}
          </h3>

          {displaySubtitle && (
            <p className="text-sm text-white/60 line-clamp-2 mb-3 leading-relaxed" data-testid={`rss-excerpt-${item.id}`}>
              {displaySubtitle}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/10">
            <div className="flex items-center gap-3">
              <button
                className="flex items-center gap-1 group/like"
                onClick={handleLike}
                data-testid={`like-btn-${item.id}`}
              >
                <Heart className={`h-4 w-4 transition-all duration-200 ${localLiked ? "text-red-500 fill-red-500" : "text-white/50"}`} />
              </button>

              <div onClick={(e) => e.stopPropagation()}>
                <ShareMenu
                  title={displayTitle}
                  url={`${window.location.origin}/${citySlug || "charlotte"}/pulse/post/${item.id}`}
                  type="post"
                  slug={item.id}
                  trigger={
                    <button
                      className="flex items-center gap-1 group/share"
                      data-testid={`share-btn-${item.id}`}
                      onClick={() => {
                        if (cityId) trackFeedEvent({ eventType: "FEED_CARD_SHARE", contentType: item.type, contentId: item.id, cityId });
                      }}
                    >
                      <Send className="h-4 w-4 text-white/50 rotate-[-30deg]" />
                    </button>
                  }
                />
              </div>

              <button
                className="flex items-center gap-1 group/save"
                onClick={handleSave}
                data-testid={`save-btn-${item.id}`}
              >
                <Bookmark className={`h-4 w-4 transition-all duration-200 ${localSaved ? "text-amber-500 fill-amber-500" : "text-white/50"}`} />
              </button>
            </div>

            {item.type === "rss" && (
              <button
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-400 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onCardClick?.(item);
                }}
                data-testid={`rss-read-more-${item.id}`}
              >
                Read More
              </button>
            )}
          </div>
        </div>

        {totalEngagement > 0 && (
          <div className="flex items-center gap-4 px-4 pb-2" data-testid={`engagement-bar-${item.id}`}>
            {(item.likeCount || 0) > 0 && (
              <span className="flex items-center gap-1 text-xs text-white/40">
                <Heart className="h-3 w-3" />
                {item.likeCount}
              </span>
            )}
            {(item.shareCount || 0) > 0 && (
              <span className="flex items-center gap-1 text-xs text-white/40">
                <Send className="h-3 w-3 rotate-[-30deg]" />
                {item.shareCount}
              </span>
            )}
            {(item.saveCount || 0) > 0 && (
              <span className="flex items-center gap-1 text-xs text-white/40">
                <Bookmark className="h-3 w-3" />
                {item.saveCount}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div data-testid={`feed-card-${item.type}-${item.id}`}>
      {item.repostUser && (
        <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-blue-300" data-testid={`repost-label-${item.id}`}>
          <UserPlus className="h-3 w-3" />
          <span>Shared by <span className="font-medium">@{item.repostUser}</span></span>
        </div>
      )}

      <div className="flex items-center gap-2.5 px-1 py-2" data-testid={`profile-row-${item.id}`}>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-amber-500 p-[2px] flex-shrink-0">
          <div className="w-full h-full rounded-full bg-gray-900 overflow-hidden flex items-center justify-center">
            {author.avatarUrl ? (
              <img src={author.avatarUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <TypeIcon className="h-3.5 w-3.5 text-white/60" />
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-white truncate">{author.name}</span>
            {author.label && (
              <span className="text-[10px] text-amber-400/80 font-medium">{author.label}</span>
            )}
            {hubLocalityName && (
              <span className="text-[10px] bg-white/10 text-white/60 px-1.5 py-0.5 rounded font-medium flex-shrink-0" data-testid={`badge-hub-locality-${item.id}`}>{hubLocalityName}</span>
            )}
          </div>
          {timestamp && (
            <span className="text-[11px] text-white/40">{timestamp}</span>
          )}
        </div>
      </div>

      <div
        className={`group relative overflow-hidden rounded-xl cursor-pointer transition-transform duration-200 active:scale-[0.98] ${isDrop ? "ring-2 ring-amber-400/60 shadow-[0_0_20px_rgba(251,191,36,0.15)]" : ""} ${item.type === "enhanced_listing" ? "ring-1 ring-purple-500/40 shadow-[0_0_15px_rgba(91,29,143,0.2)]" : ""}`}
        onClick={handleClick}
        onTouchEnd={handleTouchEnd}
      >

      <div className={`relative w-full ${isVideo ? "aspect-[9/16]" : isPodcast || isLive ? "aspect-[16/9]" : "aspect-[4/3]"}`}>
        {isPodcast ? (
          <div className="absolute inset-0 bg-gradient-to-br from-violet-950 via-purple-900/80 to-indigo-950">
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6">
              <img
                src={item.imageUrl || "/icons/clt-logo.png"}
                alt=""
                className={`w-20 h-20 rounded-md shadow-lg mb-1 ${item.imageUrl ? "object-cover" : "object-contain bg-white/10 p-2"}`}
                loading="lazy"
              />
              <div className="flex items-center gap-3">
                <div className="flex items-end gap-[3px]">
                  {[3, 5, 7, 4, 6, 8, 5, 3, 6, 7, 4, 5, 8, 6, 3, 5, 7, 4, 6, 3].map((h, i) => (
                    <div key={i} className="w-[3px] rounded-full bg-purple-400/60" style={{ height: `${h * 2.5}px` }} />
                  ))}
                </div>
              </div>
              <button
                className="inline-flex items-center gap-2 rounded-full bg-purple-500/80 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-purple-500/30"
                onClick={(e) => {
                  e.stopPropagation();
                  if (item.audioUrl) {
                    window.open(item.audioUrl, "_blank", "noopener");
                  } else {
                    onCardClick?.(item);
                  }
                }}
                data-testid={`podcast-play-btn-${item.id}`}
              >
                <Play className="h-4 w-4 ml-0.5" fill="white" />
                {item.audioDurationSec ? formatDuration(item.audioDurationSec) : "Listen"}
              </button>
            </div>
          </div>
        ) : isLive ? (
          <div className="absolute inset-0">
            <img
              src={item.imageUrl || "/icons/clt-logo.png"}
              alt={displayTitle}
              className={`absolute inset-0 h-full w-full ${item.imageUrl ? "object-cover" : "object-contain p-8 bg-gray-900"}`}
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/40" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <Radio className="h-10 w-10 text-red-400 animate-pulse" />
              <span className="text-white/90 text-sm font-semibold text-center px-4 leading-tight">{displayTitle}</span>
              <span className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-red-600/30 mt-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                </span>
                Watch Live
              </span>
            </div>
          </div>
        ) : (
          <img
            src={item.imageUrl || "/icons/clt-logo.png"}
            alt={displayTitle}
            className={`absolute inset-0 h-full w-full ${item.imageUrl ? "object-cover" : "object-contain p-8 bg-gray-900"}`}
            loading="lazy"
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {showHeartBurst && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <Heart className="h-24 w-24 text-red-500 fill-red-500 animate-ping opacity-80" />
          </div>
        )}

        {isVideo && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {isTikTok ? (
              <div className="w-14 h-14 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center border border-white/30" data-testid={`tiktok-play-${item.id}`}>
                <SiTiktok className="h-6 w-6 text-white" />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
                <Play className="h-7 w-7 text-white ml-0.5" fill="white" />
              </div>
            )}
          </div>
        )}

        <div className="absolute top-3 left-3 flex items-center gap-2 flex-wrap">
          {effectiveType !== "article" && effectiveType !== "rss" && (
          <span className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r ${config.accent} px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg shadow-black/20`}>
            <TypeIcon className="h-3 w-3" />
            {config.label}
          </span>
          )}
          {item.sponsored && (
            <Badge variant="outline" className="border-yellow-400/60 bg-yellow-500/20 text-yellow-200 text-[10px] backdrop-blur-sm" data-testid="sponsored-badge">
              Sponsored
            </Badge>
          )}
          {item.type === "enhanced_listing" && (
            <Badge variant="outline" className="border-purple-400/60 bg-purple-500/20 text-purple-100 text-[10px] backdrop-blur-sm" data-testid={`enhanced-badge-${item.id}`}>
              <Crown className="h-2.5 w-2.5 mr-0.5 text-amber-400" />
              {t("badge.featured")}
            </Badge>
          )}
          {isDrop && item.discountPercent && (
            <span className="inline-flex items-center rounded-full bg-red-600/90 px-2 py-0.5 text-[10px] font-bold text-white" data-testid={`discount-badge-${item.id}`}>
              {item.discountPercent}% {t("feedDetail.off")}
            </span>
          )}
          {isDrop && item.dealType && (
            <span className="inline-flex items-center rounded-full bg-amber-600/80 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm" data-testid={`deal-type-badge-${item.id}`}>
              {formatDealType(item.dealType, t)}
            </span>
          )}
          {item.creatorType && (
            <Badge variant="outline" className="border-purple-400/60 bg-purple-500/20 text-purple-100 text-[10px]" data-testid={`creator-badge-${item.id}`}>
              <Sparkles className="h-2.5 w-2.5 mr-0.5" />{item.creatorType}
            </Badge>
          )}
          {item.isHiring && (
            <Badge variant="outline" className="border-green-400/60 bg-green-500/20 text-green-100 text-[10px]" data-testid={`hiring-badge-${item.id}`}>
              <Briefcase className="h-2.5 w-2.5 mr-0.5" />{t("badge.hiring")}
            </Badge>
          )}
        </div>

        <div className="absolute top-3 right-3 flex flex-col items-center gap-2">
          {item.type === "event" && item.startDate && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur-md">
              <Clock className="h-3 w-3" />
              {formatEventDate(item.startDate)}
            </span>
          )}
          {isVideo && item.videoDurationSec && (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
              {formatDuration(item.videoDurationSec)}
            </span>
          )}
          {isDrop && item.expiresAt && (() => {
            const countdown = formatCountdown(item.expiresAt!, t);
            return countdown ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-600/80 px-2 py-0.5 text-[10px] font-bold text-white animate-pulse" data-testid={`countdown-${item.id}`}>
                <Clock className="h-3 w-3" />
                {countdown}
              </span>
            ) : null;
          })()}
        </div>

        <div className="absolute right-2 md:right-3 bottom-16 md:bottom-20 flex flex-col items-center gap-2 md:gap-3 z-10">
          <button
            className="flex flex-col items-center gap-0.5 group/like"
            onClick={handleLike}
            data-testid={`like-btn-${item.id}`}
          >
            <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center backdrop-blur-md transition-all duration-200 ${localLiked ? "bg-red-500/80 scale-110" : "bg-white/15 hover:bg-white/25"}`}>
              <Heart className={`h-4 w-4 md:h-5 md:w-5 transition-all duration-200 ${localLiked ? "text-white fill-white" : "text-white"}`} />
            </div>
          </button>

          <div onClick={(e) => e.stopPropagation()}>
            <ShareMenu
              title={displayTitle}
              url={`${window.location.origin}/${citySlug || "charlotte"}/pulse/post/${item.id}`}
              type={item.type === "reel" ? "reel" : "post"}
              slug={item.id}
              trigger={
                <button
                  className="flex flex-col items-center gap-0.5 group/share"
                  data-testid={`share-btn-${item.id}`}
                  onClick={() => {
                    if (cityId) trackFeedEvent({ eventType: "FEED_CARD_SHARE", contentType: item.type, contentId: item.id, cityId });
                  }}
                >
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center bg-white/15 backdrop-blur-md hover:bg-white/25 transition-colors">
                    <Send className="h-4 w-4 md:h-5 md:w-5 text-white rotate-[-30deg]" />
                  </div>
                </button>
              }
            />
          </div>

          <button
            className="flex flex-col items-center gap-0.5 group/repost"
            onClick={handleRepost}
            data-testid={`repost-btn-${item.id}`}
          >
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center bg-white/15 backdrop-blur-md hover:bg-white/25 transition-colors">
              <UserPlus className="h-4 w-4 md:h-5 md:w-5 text-white" />
            </div>
          </button>

          <button
            className="flex flex-col items-center gap-0.5 group/save"
            onClick={handleSave}
            data-testid={`save-btn-${item.id}`}
          >
            <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center backdrop-blur-md transition-all duration-200 ${localSaved ? "bg-amber-500/80" : "bg-white/15 hover:bg-white/25"}`}>
              <Bookmark className={`h-4 w-4 md:h-5 md:w-5 transition-all duration-200 ${localSaved ? "text-white fill-white" : "text-white"}`} />
            </div>
          </button>

          {isShop && (
            <button
              className="flex flex-col items-center gap-0.5"
              onClick={(e) => {
                e.stopPropagation();
                if (item.externalUrl) {
                  window.open(item.externalUrl, "_blank", "noopener");
                } else {
                  onCardClick?.(item);
                }
              }}
              data-testid={`shop-btn-${item.id}`}
            >
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center bg-emerald-500/80 backdrop-blur-md hover:bg-emerald-500/90 transition-colors">
                <ShoppingBag className="h-4 w-4 md:h-5 md:w-5 text-white" />
              </div>
            </button>
          )}

          {isDrop && (
            <button
              className="flex flex-col items-center gap-0.5"
              onClick={handleClaim}
              data-testid={`claim-btn-${item.id}`}
            >
              <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center backdrop-blur-md transition-all duration-200 ${claimCode ? "bg-green-500/80" : "bg-amber-500/80 hover:bg-amber-500/90"} ${claiming ? "animate-pulse" : ""}`}>
                {claimCode ? (
                  <Check className="h-4 w-4 md:h-5 md:w-5 text-white" />
                ) : (
                  <Ticket className="h-4 w-4 md:h-5 md:w-5 text-white" />
                )}
              </div>
            </button>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-14 p-4">
          {(isShop || isDrop) && item.price != null && (
            <div className="flex items-center gap-2 mb-1.5" data-testid={`price-display-${item.id}`}>
              <span className="text-lg font-bold text-white">{formatPrice(item.price)}</span>
              {item.compareAtPrice && item.compareAtPrice > item.price && (
                <span className="text-sm text-white/50 line-through">{formatPrice(item.compareAtPrice)}</span>
              )}
            </div>
          )}

          {item.businessName && (
            <p className="text-[11px] text-white/60 font-medium uppercase tracking-wide mb-0.5" data-testid={`business-name-${item.id}`}>
              {item.businessName}
            </p>
          )}

          <h3 className="text-lg font-bold text-white leading-tight line-clamp-2 mb-1 drop-shadow-lg">
            {displayTitle}
          </h3>
          {displaySubtitle && (
            <p className="text-xs text-white/80 line-clamp-2 mb-2 drop-shadow-md">
              {displaySubtitle}
            </p>
          )}

          {isDrop && item.claimCount != null && item.claimCount > 0 && (
            <p className="text-[10px] text-amber-300/80 font-medium mb-1.5" data-testid={`social-proof-${item.id}`}>
              {item.maxClaims
                ? t("feedDetail.claimedOfMax", { count: String(item.claimCount), max: String(item.maxClaims) })
                : t("feedDetail.claimed_count", { count: String(item.claimCount) })}
            </p>
          )}

          {item.type === "rss" && item.primaryTag && (
            <button
              className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold text-white transition-colors mb-1.5"
              onClick={(e) => {
                e.stopPropagation();
                onCardClick?.(item);
              }}
              data-testid={`rss-source-credit-${item.id}`}
            >
              <Rss className="h-2.5 w-2.5" />
              From {item.primaryTag.label}
            </button>
          )}

          <div className="flex items-center gap-1.5 flex-wrap">
            {item.primaryTag && (() => {
              const ROUTABLE_TYPES = new Set(["business", "event", "enhanced_listing", "marketplace", "shop_item", "article", "job"]);
              const NON_ROUTABLE_SLUGS = new Set(["news", "video", "podcast", "live", "curated", "digest", "jobs", "page", "landmark"]);
              const canLink = citySlug && ROUTABLE_TYPES.has(item.type) && !NON_ROUTABLE_SLUGS.has(item.primaryTag!.slug);
              return canLink ? (
                <span
                  onClick={(e) => { e.stopPropagation(); onTagClick?.(item.primaryTag!); }}
                  data-testid={`tag-chip-${item.primaryTag!.slug}`}
                >
                  <Link
                    href={`/${citySlug}/${item.primaryTag!.slug}`}
                    className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur-sm hover:bg-white/25 transition-colors"
                  >
                    <Tag className="h-2.5 w-2.5" />
                    #{item.primaryTag!.label}
                  </Link>
                </span>
              ) : (
                <button
                  className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur-sm hover:bg-white/25 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTagClick?.(item.primaryTag!);
                  }}
                  data-testid={`tag-chip-${item.primaryTag!.slug}`}
                >
                  <Tag className="h-2.5 w-2.5" />
                  #{item.primaryTag!.label}
                </button>
              );
            })()}
            {item.locationTags.slice(0, 1).map((lt) => {
              const LOCATION_ROUTABLE_TYPES = new Set(["business", "event", "enhanced_listing", "article", "job"]);
              const canLinkLocation = citySlug && LOCATION_ROUTABLE_TYPES.has(item.type);
              return canLinkLocation ? (
                <span
                  key={lt.slug}
                  onClick={(e) => { e.stopPropagation(); onTagClick?.({ ...lt, type: "location" }); }}
                  data-testid={`location-chip-${lt.slug}`}
                >
                  <Link
                    href={`/${citySlug}/neighborhoods/${lt.slug}`}
                    className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur-sm hover:bg-white/25 transition-colors"
                  >
                    <MapPin className="h-2.5 w-2.5" />
                    #{lt.label}
                  </Link>
                </span>
              ) : (
                <button
                  key={lt.slug}
                  className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur-sm hover:bg-white/25 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTagClick?.({ ...lt, type: "location" });
                  }}
                  data-testid={`location-chip-${lt.slug}`}
                >
                  <MapPin className="h-2.5 w-2.5" />
                  #{lt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {claimExpanded && claimCode && (
        <div
          className="bg-gradient-to-r from-amber-900/90 to-orange-900/90 border-t border-amber-400/30 px-4 py-3"
          onClick={(e) => e.stopPropagation()}
          data-testid={`claim-expansion-${item.id}`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-amber-200/70 font-medium uppercase tracking-wider mb-0.5">Your Claim Code</p>
              <div className="flex items-center gap-2">
                <span className="text-lg font-mono font-bold text-white tracking-widest" data-testid={`claim-code-${item.id}`}>
                  {claimCode}
                </span>
                <button
                  onClick={handleCopyCode}
                  className="rounded-full p-1.5 bg-white/10 hover:bg-white/20 transition-colors"
                  data-testid={`copy-code-btn-${item.id}`}
                >
                  {codeCopied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5 text-white/70" />}
                </button>
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setClaimExpanded(false); }}
              className="rounded-full p-1.5 bg-white/10 hover:bg-white/20 transition-colors"
              data-testid={`close-claim-btn-${item.id}`}
            >
              <X className="h-3.5 w-3.5 text-white/70" />
            </button>
          </div>
          <p className="text-[11px] text-amber-200/60 mt-1">Show this code at the business to redeem</p>
        </div>
      )}
      </div>

      {totalEngagement > 0 && (
        <div className="flex items-center gap-4 px-1 pt-2 pb-1" data-testid={`engagement-bar-${item.id}`}>
          {(item.likeCount || 0) > 0 && (
            <span className="flex items-center gap-1 text-xs text-white/50">
              <Heart className="h-3 w-3" />
              {item.likeCount} {item.likeCount === 1 ? "like" : "likes"}
            </span>
          )}
          {(item.shareCount || 0) > 0 && (
            <span className="flex items-center gap-1 text-xs text-white/50">
              <Send className="h-3 w-3 rotate-[-30deg]" />
              {item.shareCount} {item.shareCount === 1 ? "share" : "shares"}
            </span>
          )}
          {(item.saveCount || 0) > 0 && (
            <span className="flex items-center gap-1 text-xs text-white/50">
              <Bookmark className="h-3 w-3" />
              {item.saveCount} {item.saveCount === 1 ? "save" : "saves"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function FeedCardSkeleton() {
  return (
    <div className="animate-pulse" data-testid="feed-card-skeleton">
      <div className="flex items-center gap-2.5 px-1 py-2">
        <div className="w-8 h-8 rounded-full bg-white/10" />
        <div className="flex-1 space-y-1">
          <div className="h-3.5 w-28 rounded bg-white/10" />
          <div className="h-2.5 w-12 rounded bg-white/10" />
        </div>
      </div>
      <div className="relative overflow-hidden rounded-xl">
        <div className="aspect-[4/3] w-full bg-gradient-to-br from-gray-800 to-gray-900">
          <div className="absolute top-3 left-3">
            <div className="h-5 w-16 rounded-full bg-white/10" />
          </div>
          <div className="absolute right-2 md:right-3 bottom-16 md:bottom-20 flex flex-col gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/10" />
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/10" />
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/10" />
          </div>
          <div className="absolute bottom-0 left-0 right-14 p-4 space-y-2">
            <div className="h-5 w-3/4 rounded bg-white/10" />
            <div className="h-3 w-1/2 rounded bg-white/10" />
            <div className="flex gap-1.5">
              <div className="h-5 w-20 rounded-full bg-white/10" />
              <div className="h-5 w-16 rounded-full bg-white/10" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
