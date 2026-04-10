declare global {
  interface Window {
    __PULSE_FEED_V2_ENABLED?: boolean;
  }
}

import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useSearch, Link } from "wouter";
import { MapPin, Camera, Map, RefreshCw, Sparkles, X, ChevronUp, Loader2, Flame, Clock, CalendarDays, Navigation, MessageCircle, ArrowRight, Calendar, Megaphone, FileText, UserPlus, Store } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FeedCard, FeedCardSkeleton, type FeedCardItem } from "@/components/feed/feed-card";
import { FeedCardV2, FeedCardV2Skeleton, type FeedCardItem as FeedCardItemV2 } from "@/components/feed/feed-card-v2";
import { TagChips } from "@/components/feed/tag-chips";
import { GeoSelector } from "@/components/feed/geo-selector";
import { StoriesRow } from "@/components/feed/stories-row";
import { FeedDetail } from "@/components/feed/feed-detail";
import { FeedSubmit } from "@/components/feed/feed-submit";
import { ReelViewer } from "@/components/feed/reel-viewer";
import { PulseFeedAd } from "@/components/ad-banner";
import { getCityBranding, getBrandForContext } from "@shared/city-branding";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { trackFeedEvent } from "@/lib/intelligence-tracker";
import { ReviewPromptCard } from "@/components/feed/review-prompt-card";
import { DiscoveryCard } from "@/components/feed/discovery-card";
import { RelatedSearches } from "@/components/feed/related-searches";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { ScrollWallOverlay } from "@/components/scroll-wall";
import { useI18n } from "@/lib/i18n";
import { AuthDialog } from "@/components/auth-dialog";
import { AddToHomescreenBanner, InstallGuideSheet } from "@/components/add-to-homescreen";
import { useCharlotteContext } from "@/components/public-layout";
import { HubSelectorPrompt } from "@/components/feed/hub-selector-prompt";
import { useGeoHub } from "@/hooks/use-geo-hub";
import charlotteAvatar from "@assets/charlotte-avatar-v2.png";
import cosmicBg from "@assets/General_Backgroun_CLT_colors_1771643702572.png";

const HUB_PREF_KEY = "clt_hub_preference";

type GeoContext = "near_me" | "home" | "work" | "metro";
type FeedContext = "foryou" | "trending" | "new" | "weekend" | "nearby";

const CONTEXT_FILTERS = [
  { key: "foryou" as FeedContext, labelKey: "feed.filterForYou" as const, icon: Sparkles },
  { key: "trending" as FeedContext, labelKey: "feed.filterTrending" as const, icon: Flame },
  { key: "new" as FeedContext, labelKey: "feed.filterNew" as const, icon: Clock },
  { key: "weekend" as FeedContext, labelKey: "feed.filterWeekend" as const, icon: CalendarDays },
  { key: "nearby" as FeedContext, labelKey: "feed.filterNearMe" as const, icon: Navigation },
];

interface FeedResponse {
  items: FeedCardItem[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  cursor?: string | null;
  activeFilters: {
    geoTag: string | null;
    topicTag: string | null;
    context: string;
  };
}

interface FeedHomeProps {
  citySlug: string;
  cityId: string;
}

export default function FeedHome({ citySlug, cityId }: FeedHomeProps) {
  const searchString = useSearch();
  const [location, setLocation] = useLocation();

  const params = new URLSearchParams(searchString);
  const geoTag = params.get("geo") || undefined;
  const topicTag = params.get("topic") || undefined;
  const geoContextParam = (params.get("geoContext") as GeoContext) || "metro";
  const isReelsRoute = location.endsWith("/reels");

  const [selectedItem, setSelectedItem] = useState<FeedCardItem | null>(null);
  const [showSubmit, setShowSubmit] = useState(false);
  const [reelStartIndex, setReelStartIndex] = useState<number | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [feedSessionId, setFeedSessionId] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [geoContext, setGeoContext] = useState<GeoContext>(geoContextParam);
  const [newPostsAvailable, setNewPostsAvailable] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const feedContainerRef = useRef<HTMLDivElement>(null);
  const { requireAuth, showAuthPrompt, authAction, dismissAuthPrompt } = useRequireAuth();
  const { toast } = useToast();
  const { user } = useAuth();
  const geoHubResult = useGeoHub(citySlug);
  const [dismissedPrompts, setDismissedPrompts] = useState<Set<string>>(new Set());
  const [feedContext, setFeedContext] = useState<FeedContext>(
    (params.get("context") as FeedContext) || "foryou"
  );
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pullStartY = useRef(0);
  const { t } = useI18n();

  const isMobile = useIsMobile();
  const [welcomeAuthDismissed, setWelcomeAuthDismissed] = useState(() => {
    try { return localStorage.getItem("pulse_welcome_auth_dismissed") === "1"; } catch { return false; }
  });
  const [welcomeAuthOpen, setWelcomeAuthOpen] = useState(false);
  const [welcomeAuthTab, setWelcomeAuthTab] = useState<"signin" | "register">("signin");
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  const savedHub = typeof window !== "undefined" ? localStorage.getItem(HUB_PREF_KEY) : null;
  const [showHubSelector, setShowHubSelector] = useState(!savedHub && !geoTag);

  const cityName = citySlug.charAt(0).toUpperCase() + citySlug.slice(1);
  const feedBranding = getCityBranding(citySlug);
  const feedBrand = feedBranding ? getBrandForContext(feedBranding, "landing") : null;

  usePageMeta({
    title: `${cityName} Pulse — ${feedBrand?.ogSiteName || "CLT Hub"}`,
    description: `Discover what's happening in ${cityName}. Events, businesses, articles, and more — all in one scroll.`,
    ogSiteName: feedBrand?.ogSiteName,
  });

  const createSession = useCallback(async (ctx: GeoContext) => {
    setSessionReady(false);
    try {
      const res = await fetch("/api/feed/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metroId: citySlug, geoContext: ctx }),
      });
      const data = await res.json();
      if (data.feedSessionId) {
        setFeedSessionId(data.feedSessionId);
        setSessionReady(true);
        return data.feedSessionId;
      }
    } catch (e) {
      console.error("[Pulse] Failed to create session:", e);
    }
    setSessionReady(true);
    return null;
  }, [citySlug]);

  useEffect(() => {
    createSession(geoContext);
    if (savedHub && savedHub !== "__metro__" && !geoTag) {
      updateFilters(savedHub, topicTag);
    }
  }, []);

  const basePath = location.includes(`/${citySlug}/pulse`) ? `/${citySlug}/pulse` : `/${citySlug}`;

  const updateFilters = useCallback((newGeo: string | undefined, newTopic: string | undefined, newGeoCtx?: GeoContext, newFeedCtx?: FeedContext) => {
    const p = new URLSearchParams();
    if (newGeo) p.set("geo", newGeo);
    if (newTopic) p.set("topic", newTopic);
    const ctx = newGeoCtx || geoContext;
    if (ctx !== "metro") p.set("geoContext", ctx);
    const fc = newFeedCtx || feedContext;
    if (fc !== "foryou") p.set("context", fc);
    const qs = p.toString();
    setLocation(`${basePath}${qs ? `?${qs}` : ""}`, { replace: true });
  }, [citySlug, setLocation, geoContext, feedContext, basePath]);

  const handleGeoContextChange = useCallback(async (newCtx: GeoContext) => {
    setGeoContext(newCtx);
    queryClient.resetQueries({ queryKey: ["/api/feed"] });
    scrollAreaRef.current?.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    await createSession(newCtx);
    updateFilters(undefined, topicTag, newCtx);
  }, [createSession, updateFilters, topicTag]);

  const handleGeoTagChange = useCallback(async (slug: string | undefined) => {
    queryClient.resetQueries({ queryKey: ["/api/feed"] });
    scrollAreaRef.current?.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    await createSession(geoContext);
    updateFilters(slug, topicTag);
  }, [createSession, geoContext, updateFilters, topicTag]);

  const handleFeedContextChange = useCallback(async (ctx: FeedContext) => {
    setFeedContext(ctx);
    queryClient.resetQueries({ queryKey: ["/api/feed"] });
    scrollAreaRef.current?.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    await createSession(geoContext);
    updateFilters(geoTag, topicTag, undefined, ctx);
  }, [createSession, geoContext, geoTag, topicTag, updateFilters]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
    dataUpdatedAt,
  } = useInfiniteQuery<FeedResponse>({
    queryKey: ["/api/feed", citySlug, geoTag, topicTag, geoContext, feedSessionId, feedContext],
    enabled: sessionReady,
    queryFn: async ({ pageParam }) => {
      const useV2 = window.__PULSE_FEED_V2_ENABLED !== false;
      const p = new URLSearchParams({
        citySlug,
        limit: "20",
        geoContext,
      });
      if (useV2) {
        if (pageParam && typeof pageParam === "string" && pageParam.length > 5) {
          p.set("cursor", pageParam);
        }
      } else {
        p.set("page", pageParam && !isNaN(Number(pageParam)) ? String(pageParam) : "1");
      }
      if (geoTag) p.set("geoTag", geoTag);
      if (topicTag) p.set("topicTag", topicTag);
      if (feedSessionId) p.set("feedSessionId", feedSessionId);
      if (feedContext && feedContext !== "foryou") p.set("context", feedContext);
      if (!geoTag && savedHub && savedHub !== "__metro__") p.set("userHub", savedHub);
      const feedEndpoint = useV2 ? "/api/feed/v2" : "/api/feed";
      const res = await fetch(`${feedEndpoint}?${p}`);
      return res.json();
    },
    initialPageParam: "" as string,
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore) return undefined;
      if (lastPage.cursor) return lastPage.cursor;
      if (lastPage.page) return String(lastPage.page + 1);
      return undefined;
    },
  });

  const allItemsRaw = data?.pages.flatMap(p => p.items) || [];
  const PULSE_PREVIEW = 3;
  const showPulseWall = !user && allItemsRaw.length > PULSE_PREVIEW;
  const allItems = !user && allItemsRaw.length > PULSE_PREVIEW ? allItemsRaw.slice(0, PULSE_PREVIEW) : allItemsRaw;

  interface PulseAd {
    id: string;
    title: string;
    imageUrl: string | null;
    linkUrl: string | null;
    slot: string;
    isActive: boolean;
    description?: string | null;
    ctaLabel?: string | null;
  }

  const { data: pulseNativeAds } = useQuery<PulseAd[]>({
    queryKey: ["/api/cities", citySlug, "ads", "PULSE_NATIVE"],
    staleTime: 60000,
  });

  const { data: reviewPrompts } = useQuery<any[]>({
    queryKey: [`/api/feed/review-prompts?metroId=${cityId || citySlug}`],
    enabled: !!user,
    staleTime: 120000,
  });


  useEffect(() => {
    const scrollEl = scrollAreaRef.current;
    if (!scrollEl || !loadMoreRef.current || !hasNextPage || isFetchingNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchNextPage();
        }
      },
      { root: scrollEl, threshold: 0.1 }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    if (!sessionReady || allItems.length === 0) return;
    const interval = setInterval(async () => {
      try {
        const p = new URLSearchParams({ citySlug, page: "1", limit: "1", geoContext });
        if (geoTag) p.set("geoTag", geoTag);
        if (topicTag) p.set("topicTag", topicTag);
        if (feedSessionId) p.set("feedSessionId", feedSessionId);
        if (!geoTag && savedHub && savedHub !== "__metro__") p.set("userHub", savedHub);
        const feedEndpoint = window.__PULSE_FEED_V2_ENABLED !== false ? "/api/feed/v2" : "/api/feed";
        const res = await fetch(`${feedEndpoint}?${p}`);
        const data = await res.json();
        if (data.items?.[0] && !allItems.find((i: FeedCardItem) => i.id === data.items[0].id)) {
          setNewPostsAvailable(true);
        }
      } catch {}
    }, 60000);
    return () => clearInterval(interval);
  }, [sessionReady, allItems.length, citySlug, geoContext, geoTag, topicTag, feedSessionId]);

  const handleLoadNewPosts = useCallback(() => {
    setNewPostsAvailable(false);
    queryClient.resetQueries({ queryKey: ["/api/feed"] });
    createSession(geoContext);
    scrollAreaRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [createSession, geoContext]);

  const likeMutation = useMutation({
    mutationFn: async ({ item, isLiked }: { item: FeedCardItem; isLiked: boolean }) => {
      if (isLiked) {
        await apiRequest("DELETE", "/api/engagement/like", { contentType: item.type, contentId: item.id });
      } else {
        await apiRequest("POST", "/api/engagement/like", { contentType: item.type, contentId: item.id });
      }
      return { id: item.id, liked: !isLiked };
    },
    onSuccess: (result) => {
      setLikedIds(prev => {
        const next = new Set(prev);
        if (result.liked) next.add(result.id);
        else next.delete(result.id);
        return next;
      });
    },
  });

  const handleLike = useCallback((item: FeedCardItem) => {
    const isLiked = likedIds.has(item.id);
    setLikedIds(prev => {
      const next = new Set(prev);
      if (isLiked) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
    likeMutation.mutate({ item, isLiked });
    if (!isLiked) {
      trackFeedEvent({ eventType: "FEED_CARD_LIKE", contentType: item.type, contentId: item.id, cityId: cityId || citySlug });
    }
  }, [likedIds, likeMutation, cityId, citySlug]);

  const handleSave = useCallback((item: FeedCardItem) => {
    const wasSaved = savedIds.has(item.id);
    setSavedIds(prev => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
    if (!wasSaved) {
      trackFeedEvent({ eventType: "FEED_CARD_SAVE", contentType: item.type, contentId: item.id, cityId: cityId || citySlug });
    }
  }, [savedIds, cityId, citySlug]);

  const repostMutation = useMutation({
    mutationFn: async (item: FeedCardItem) => {
      await apiRequest("POST", "/api/reposts", { contentType: item.type, contentId: item.id });
      return item;
    },
    onSuccess: () => {
      toast({ title: t("feed.sharedToProfile"), description: t("feed.sharedToProfileDesc") });
    },
    onError: (err: any) => {
      const msg = err?.message || "";
      if (msg.includes("Already shared")) {
        toast({ title: t("feed.alreadyShared"), description: t("feed.alreadySharedDesc") });
      } else if (msg.includes("Login required")) {
        toast({ title: t("feed.signInRequired"), description: t("feed.signInRequiredDesc") });
      } else {
        toast({ title: t("feed.couldntShare"), description: msg });
      }
    },
  });

  const handleRepost = useCallback((item: FeedCardItem) => {
    if (!requireAuth("share to your profile")) return;
    repostMutation.mutate(item);
  }, [requireAuth, repostMutation]);

  const handleTagClick = useCallback((tag: { slug: string; label: string; type?: string }) => {
    if (tag.type === "location") {
      updateFilters(tag.slug, topicTag);
    } else {
      updateFilters(geoTag, tag.slug);
    }
  }, [geoTag, topicTag, updateFilters]);

  const handleStoriesHubSelect = useCallback(async (slug: string | undefined) => {
    queryClient.resetQueries({ queryKey: ["/api/feed"] });
    scrollAreaRef.current?.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    await createSession(geoContext);
    updateFilters(slug, topicTag);
    if (slug) {
      localStorage.setItem(HUB_PREF_KEY, slug);
    } else {
      localStorage.removeItem(HUB_PREF_KEY);
    }
  }, [topicTag, updateFilters, createSession, geoContext]);

  const handleHubSelectorChoice = useCallback((slug: string | undefined) => {
    setShowHubSelector(false);
    if (slug) {
      localStorage.setItem(HUB_PREF_KEY, slug);
      handleStoriesHubSelect(slug);
    } else {
      localStorage.setItem(HUB_PREF_KEY, "__metro__");
    }
  }, [handleStoriesHubSelect]);

  const handlePullTouchStart = useCallback((e: React.TouchEvent) => {
    const scrollEl = scrollAreaRef.current;
    if (!scrollEl || scrollEl.scrollTop > 0 || isRefreshing) return;
    pullStartY.current = e.touches[0].clientY;
    setIsPulling(true);
  }, [isRefreshing]);

  const handlePullTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling || isRefreshing) return;
    const scrollEl = scrollAreaRef.current;
    if (!scrollEl || scrollEl.scrollTop > 0) {
      setIsPulling(false);
      setPullDistance(0);
      return;
    }
    const delta = e.touches[0].clientY - pullStartY.current;
    if (delta > 0) {
      setPullDistance(Math.min(delta * 0.5, 80));
    }
  }, [isPulling, isRefreshing]);

  const handlePullTouchEnd = useCallback(async () => {
    if (!isPulling) return;
    setIsPulling(false);
    if (pullDistance > 50) {
      setIsRefreshing(true);
      setPullDistance(60);
      setNewPostsAvailable(false);
      queryClient.resetQueries({ queryKey: ["/api/feed"] });
      await createSession(geoContext);
      scrollAreaRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      setTimeout(() => {
        setIsRefreshing(false);
        setPullDistance(0);
      }, 500);
    } else {
      setPullDistance(0);
    }
  }, [isPulling, pullDistance, createSession, geoContext]);

  const reelItems = allItems.filter(
    (i) => i.type === "reel" || i.mediaType === "reel" || i.mediaType === "video"
  );

  const handleCardClick = useCallback((item: FeedCardItem) => {
    trackFeedEvent({ eventType: "FEED_CARD_TAP", contentType: item.type, contentId: item.id, cityId: cityId || citySlug });
    if (item.type === "live") {
      setLocation(item.url);
      return;
    }
    if (item.type === "reel" || item.mediaType === "reel" || item.mediaType === "video") {
      const idx = reelItems.findIndex((r) => r.id === item.id);
      setReelStartIndex(idx >= 0 ? idx : 0);
      return;
    }
    setSelectedItem(item);
  }, [reelItems, cityId, citySlug]);

  return (
    <div className="flex flex-col h-full bg-gray-950 relative" ref={feedContainerRef}>
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: `url(${cosmicBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      <div className="relative z-40 flex-shrink-0 max-w-2xl w-full mx-auto px-4 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <GeoSelector
            citySlug={citySlug}
            currentGeoTag={geoTag}
            geoContext={geoContext}
            onGeoChange={handleGeoTagChange}
            onGeoContextChange={handleGeoContextChange}
          />
          <TagChips
            citySlug={citySlug}
            geoTag={geoTag}
            activeTopicTag={topicTag}
            onTagSelect={(slug) => updateFilters(geoTag, slug)}
          />
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => refetch()}
            className="rounded-full p-2 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            data-testid="feed-refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <a
            href={`/${citySlug}/map`}
            onClick={(e) => { e.preventDefault(); setLocation(`/${citySlug}/map`); }}
            className="rounded-full p-2 text-white/50 hover:text-white hover:bg-white/10 transition-colors inline-flex items-center justify-center"
            data-testid="feed-map-btn"
            title={t("nav.map")}
          >
            <Map className="h-4 w-4" />
          </a>
        </div>
      </div>

      <div
        ref={scrollAreaRef}
        className="relative z-10 flex-1 overflow-y-auto overscroll-contain scroll-smooth"
        style={{ WebkitOverflowScrolling: "touch" }}
        onTouchStart={handlePullTouchStart}
        onTouchMove={handlePullTouchMove}
        onTouchEnd={handlePullTouchEnd}
      >
        {pullDistance > 0 && (
          <div
            className="relative z-40 flex items-center justify-center transition-all duration-150"
            style={{ height: pullDistance }}
            data-testid="pull-to-refresh-indicator"
          >
            <Loader2
              className={`h-5 w-5 text-purple-400 ${isRefreshing ? "animate-spin" : ""}`}
              style={{ transform: isRefreshing ? undefined : `rotate(${pullDistance * 4}deg)`, opacity: Math.min(pullDistance / 50, 1) }}
            />
          </div>
        )}

        <div className="sticky top-0 z-30 bg-gray-950 border-b border-white/5 pb-1">
          <StoriesRow
            citySlug={citySlug}
            activeGeoTag={geoTag}
            onHubSelect={handleStoriesHubSelect}
            userLat={geoHubResult.nearestHub ? parseFloat(geoHubResult.nearestHub.centerLat) : null}
            userLng={geoHubResult.nearestHub ? parseFloat(geoHubResult.nearestHub.centerLng) : null}
          />

          <div className="max-w-2xl mx-auto px-3 pt-1 pb-1">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar" data-testid="feed-context-filters">
              {CONTEXT_FILTERS.map((filter) => {
                const isActive = feedContext === filter.key;
                const Icon = filter.icon;
                return (
                  <button
                    key={filter.key}
                    onClick={() => handleFeedContextChange(filter.key)}
                    className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      isActive
                        ? "bg-purple-600 text-white"
                        : "bg-white/10 text-white/70"
                    }`}
                    data-testid={`feed-context-${filter.key}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {t(filter.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-3 py-2 pb-24">
          {isMobile && !user && !welcomeAuthDismissed && (
            <div className="relative mb-3 rounded-xl border border-purple-500/30 bg-gray-900/90 p-4" data-testid="pulse-welcome-auth">
              <button
                onClick={() => {
                  setWelcomeAuthDismissed(true);
                  try { localStorage.setItem("pulse_welcome_auth_dismissed", "1"); } catch {}
                }}
                className="absolute top-2 right-2 rounded-full p-1 text-white/40 hover:text-white/70 transition-colors"
                data-testid="button-dismiss-welcome"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-start gap-3 mb-3">
                <img src={charlotteAvatar} alt="Charlotte" className="h-11 w-11 rounded-full object-cover ring-2 ring-purple-400/50 shrink-0" />
                <div>
                  <h3 className="text-base font-bold text-white">
                    Welcome to {cityName} Pulse
                  </h3>
                  <p className="text-sm text-white/60 mt-0.5">
                    I'm Charlotte, your local guide. Sign in to save posts, follow neighborhoods, and get personalized updates.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-semibold"
                  onClick={() => { setWelcomeAuthTab("signin"); setWelcomeAuthOpen(true); }}
                  data-testid="button-welcome-signin"
                >
                  Sign In
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-white/20 text-white text-sm"
                  onClick={() => { setWelcomeAuthTab("register"); setWelcomeAuthOpen(true); }}
                  data-testid="button-welcome-signup"
                >
                  Create Account
                </Button>
              </div>
              <div className="mt-3 flex items-center gap-4">
                <button
                  onClick={() => {
                    const btn = document.querySelector<HTMLButtonElement>(".charlotte-guide-btn");
                    if (btn) btn.click();
                  }}
                  className="flex items-center gap-1.5 text-xs text-purple-400 font-medium"
                  data-testid="button-welcome-ask-charlotte"
                >
                  <Sparkles className="h-3 w-3" />
                  Ask Charlotte
                </button>
                <button
                  onClick={() => setShowInstallGuide(true)}
                  className="flex items-center gap-1.5 text-xs text-white/40 font-medium"
                  data-testid="button-welcome-install"
                >
                  <Navigation className="h-3 w-3" />
                  Add to Home Screen
                </button>
              </div>
            </div>
          )}

          {newPostsAvailable && (
            <button
              onClick={handleLoadNewPosts}
              className="sticky top-[140px] z-20 mx-auto flex items-center gap-1.5 rounded-full bg-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-purple-600/30 animate-in fade-in slide-in-from-top-2 duration-300"
              data-testid="feed-new-posts-pill"
            >
              <ChevronUp className="h-3.5 w-3.5" />
              {t("feed.newPostsAvailable")}
            </button>
          )}

          {isLoading && (
            <div className="space-y-2" data-testid="feed-loading">
              {Array.from({ length: 4 }).map((_, i) => (
                window.__PULSE_FEED_V2_ENABLED !== false
                  ? <FeedCardV2Skeleton key={i} />
                  : <FeedCardSkeleton key={i} />
              ))}
            </div>
          )}

          {!isLoading && allItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="feed-empty">
              <div className="rounded-full bg-purple-600/20 p-4 mb-4">
                <Sparkles className="h-8 w-8 text-purple-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{t("feed.noContent")}</h3>
              <p className="text-sm text-white/60 max-w-xs mb-4">
                {geoTag || topicTag
                  ? t("feed.noContentFilterHint")
                  : t("feed.noContentHint")}
              </p>
              {(geoTag || topicTag) && (
                <Button
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10"
                  onClick={() => updateFilters(undefined, undefined)}
                  data-testid="feed-clear-filters"
                >
                  {t("feed.clearFilters")}
                </Button>
              )}
            </div>
          )}

          {!isLoading && allItems.length > 0 && (
            <div className="space-y-2" data-testid="feed-list">
              {(() => {
                let discoveryCounter = 0;
                return allItems.map((item, idx) => {
                const adInterval = 8;
                const shouldInjectAd =
                  pulseNativeAds &&
                  pulseNativeAds.length > 0 &&
                  idx > 0 &&
                  idx % adInterval === 0 &&
                  !item.sponsored &&
                  (idx < adInterval || !allItems[idx - 1]?.sponsored);

                const adIndex = Math.floor(idx / adInterval) - 1;
                const ad = shouldInjectAd
                  ? pulseNativeAds[adIndex % pulseNativeAds.length]
                  : null;

                const activePrompts = (reviewPrompts || []).filter(p => !dismissedPrompts.has(p.id));
                const shouldInjectReviewPrompt = idx === 4 && activePrompts.length > 0;

                const shouldInjectCharlotte = idx > 0 && idx % 20 === 0;
                const shouldInjectShareCard = idx === 3;
                const shouldInjectDiscovery = idx > 0 && idx % 10 === 0 && !shouldInjectCharlotte;
                const currentDiscoveryIndex = shouldInjectDiscovery ? discoveryCounter++ : 0;
                const shouldShowRelated = idx % 3 === 1;

                const staggerDelay = Math.min(idx * 50, 400);
                return (
                  <div
                    key={`${item.id}-${idx}`}
                    className="animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both"
                    style={{ animationDelay: `${staggerDelay}ms` }}
                  >
                    {shouldInjectShareCard && (
                      <div className="mb-2" data-testid="charlotte-share-card">
                        <div
                          className="rounded-xl overflow-hidden"
                          style={{ backgroundImage: `url(${cosmicBg})`, backgroundSize: "cover", backgroundPosition: "center" }}
                        >
                          <div className="p-5 space-y-4" style={{ background: "linear-gradient(135deg, rgba(30,0,60,0.85), rgba(10,5,40,0.8))" }}>
                            <div className="flex items-center gap-3">
                              <img src={charlotteAvatar} alt="Charlotte" className="h-12 w-12 rounded-full object-cover ring-2 ring-purple-400/50 shrink-0" />
                              <div>
                                <p className="text-sm font-bold text-white">{t("feed.sharePrompt")}</p>
                                <p className="text-xs text-white/60 mt-0.5">{t("feed.shareSubtext")}</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <Link href={`/${citySlug}/tell-your-story`}>
                                <div className="flex items-center gap-2 rounded-lg bg-white/10 border border-white/15 px-3 py-2.5 text-left" data-testid="share-card-story">
                                  <FileText className="h-4 w-4 text-blue-300 shrink-0" />
                                  <span className="text-xs text-white font-medium">{t("feed.shareYourStory")}</span>
                                </div>
                              </Link>
                              <Link href={`/${citySlug}/tell-your-story?intent=event`}>
                                <div className="flex items-center gap-2 rounded-lg bg-white/10 border border-white/15 px-3 py-2.5 text-left" data-testid="share-card-event">
                                  <Calendar className="h-4 w-4 text-amber-300 shrink-0" />
                                  <span className="text-xs text-white font-medium">{t("feed.submitEvent")}</span>
                                </div>
                              </Link>
                              <Link href={`/${citySlug}/tell-your-story?intent=shout-out`}>
                                <div className="flex items-center gap-2 rounded-lg bg-white/10 border border-white/15 px-3 py-2.5 text-left" data-testid="share-card-shoutout">
                                  <Megaphone className="h-4 w-4 text-cyan-300 shrink-0" />
                                  <span className="text-xs text-white font-medium">{t("feed.giveShoutOut")}</span>
                                </div>
                              </Link>
                              <Link href={`/${citySlug}/tell-your-story?intent=nominate`}>
                                <div className="flex items-center gap-2 rounded-lg bg-white/10 border border-white/15 px-3 py-2.5 text-left" data-testid="share-card-nominate">
                                  <UserPlus className="h-4 w-4 text-pink-300 shrink-0" />
                                  <span className="text-xs text-white font-medium">{t("feed.nominateStory")}</span>
                                </div>
                              </Link>
                              <Link href={`/${citySlug}/tell-your-story?intent=activate`} className="col-span-2">
                                <div className="flex items-center gap-2 rounded-lg bg-white/10 border border-white/15 px-3 py-2.5 text-left" data-testid="share-card-activate">
                                  <Store className="h-4 w-4 text-teal-300 shrink-0" />
                                  <span className="text-xs text-white font-medium">{t("feed.activatePresence")}</span>
                                </div>
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    {shouldInjectCharlotte && (
                      <div className="mb-2" data-testid={`charlotte-prompt-${idx}`}>
                        <button
                          onClick={() => {
                            const btn = document.querySelector<HTMLButtonElement>(".charlotte-guide-btn");
                            if (btn) btn.click();
                          }}
                          className="w-full rounded-xl border border-purple-500/30 bg-gradient-to-r from-purple-900/60 to-indigo-900/60 p-4 flex items-center gap-3 text-left transition-all hover:border-purple-400/50"
                          data-testid={`charlotte-ask-card-${idx}`}
                        >
                          <img src={charlotteAvatar} alt="Charlotte" className="h-10 w-10 rounded-full object-cover ring-2 ring-purple-400/50 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-white">
                              {geoTag
                                ? t("feed.charlotteHubPrompt")
                                : t("feed.charlottePrompt")
                              }
                            </p>
                            <p className="text-xs text-white/60 mt-0.5">
                              {t("feed.charlotteAsk")}
                            </p>
                          </div>
                          <MessageCircle className="h-5 w-5 text-purple-400 shrink-0" />
                        </button>
                      </div>
                    )}
                    {ad && (
                      <div className="mb-2" data-testid={`pulse-native-ad-slot-${idx}`}>
                        <PulseFeedAd ad={ad} citySlug={citySlug} />
                      </div>
                    )}
                    {shouldInjectReviewPrompt && (
                      <div className="mb-2" data-testid="review-prompt-slot">
                        <ReviewPromptCard
                          prompt={activePrompts[0]}
                          citySlug={citySlug}
                          onDismiss={(id) => setDismissedPrompts(prev => new Set([...prev, id]))}
                          onSubmit={(id) => setDismissedPrompts(prev => new Set([...prev, id]))}
                        />
                      </div>
                    )}
                    {shouldInjectDiscovery && (
                      <div className="mb-2" data-testid={`discovery-slot-${idx}`}>
                        <DiscoveryCard citySlug={citySlug} cardIndex={currentDiscoveryIndex} />
                      </div>
                    )}
                    {window.__PULSE_FEED_V2_ENABLED !== false ? (
                      <FeedCardV2
                        item={item}
                        onTagClick={handleTagClick}
                        onCardClick={handleCardClick}
                        onLike={handleLike}
                        onSave={handleSave}
                        onRepost={handleRepost}
                        liked={likedIds.has(item.id)}
                        saved={savedIds.has(item.id)}
                        requireAuth={requireAuth}
                        cityId={cityId || citySlug}
                        citySlug={citySlug}
                      />
                    ) : (
                      <FeedCard
                        item={item}
                        onTagClick={handleTagClick}
                        onCardClick={handleCardClick}
                        onLike={handleLike}
                        onSave={handleSave}
                        onRepost={handleRepost}
                        liked={likedIds.has(item.id)}
                        saved={savedIds.has(item.id)}
                        requireAuth={requireAuth}
                        cityId={cityId || citySlug}
                        citySlug={citySlug}
                      />
                    )}
                    {shouldShowRelated && (
                      <RelatedSearches item={item} citySlug={citySlug} cityName={cityName} />
                    )}
                  </div>
                );
              });
              })()}
            </div>
          )}

          {showPulseWall && (
            <div className="[&_h3]:text-white [&_p]:text-white/60 [&_button.text-sm]:text-white/60">
              <ScrollWallOverlay />
            </div>
          )}

          {!showPulseWall && isFetchingNextPage && (
            <div className="flex justify-center py-6">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
            </div>
          )}

          {!showPulseWall && !isLoading && allItems.length > 0 && !hasNextPage && (
            <div className="h-8" data-testid="feed-end" />
          )}

          {!showPulseWall && <div ref={loadMoreRef} className="h-1" />}
          <div className="h-20 md:h-0" />
        </div>
      </div>

      <button
        className="absolute bottom-24 right-4 z-30 flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-xl shadow-purple-600/30 hover:shadow-purple-600/50 transition-all md:bottom-6"
        onClick={() => {
          if (requireAuth("create a post")) {
            setShowSubmit(true);
          }
        }}
        data-testid="feed-create-post-fab"
      >
        <Camera className="h-5 w-5" />
        <span className="hidden sm:inline">{t("feed.createPost")}</span>
      </button>

      {showAuthPrompt && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={dismissAuthPrompt} />
          <div className="fixed inset-x-4 bottom-8 z-[60] mx-auto max-w-sm rounded-2xl bg-gray-900 border border-white/10 p-6 shadow-2xl" data-testid="auth-prompt">
            <button
              onClick={dismissAuthPrompt}
              className="absolute top-3 right-3 rounded-full p-1.5 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              data-testid="auth-prompt-close"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-lg font-bold text-white mb-2">{t("auth.signInToAction", { action: authAction })}</h3>
            <p className="text-sm text-white/60 mb-4">{t("auth.signInCta")}</p>
            <a href="/admin/login" className="block" data-testid="auth-prompt-login">
              <Button className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold">
                {t("auth.signInCreateAccount")}
              </Button>
            </a>
          </div>
        </>
      )}

      {selectedItem && (
        <FeedDetail
          item={selectedItem}
          citySlug={citySlug}
          onClose={() => setSelectedItem(null)}
          onTagClick={handleTagClick}
          onLike={handleLike}
          onSave={handleSave}
          onRepost={handleRepost}
          liked={likedIds.has(selectedItem.id)}
          saved={savedIds.has(selectedItem.id)}
          requireAuth={requireAuth}
        />
      )}

      {showSubmit && (
        <FeedSubmit
          citySlug={citySlug}
          cityId={cityId}
          onClose={() => setShowSubmit(false)}
        />
      )}

      {reelStartIndex !== null && reelItems.length > 0 && (
        <ReelViewer
          items={reelItems}
          startIndex={reelStartIndex}
          onClose={() => setReelStartIndex(null)}
          onLike={handleLike}
          onSave={handleSave}
          onRepost={handleRepost}
          onTagClick={handleTagClick}
          likedIds={likedIds}
          savedIds={savedIds}
          requireAuth={requireAuth}
        />
      )}

      {showHubSelector && (
        <HubSelectorPrompt
          citySlug={citySlug}
          onHubSelected={handleHubSelectorChoice}
          onDismiss={() => {
            setShowHubSelector(false);
            localStorage.setItem(HUB_PREF_KEY, "__metro__");
          }}
        />
      )}

      <AuthDialog
        open={welcomeAuthOpen}
        onOpenChange={setWelcomeAuthOpen}
        defaultTab={welcomeAuthTab}
        onSuccess={() => {
          setWelcomeAuthDismissed(true);
          try { localStorage.setItem("pulse_welcome_auth_dismissed", "1"); } catch {}
        }}
      />

      <InstallGuideSheet open={showInstallGuide} onClose={() => setShowInstallGuide(false)} />

      <AddToHomescreenBanner citySlug={citySlug} />
    </div>
  );
}
