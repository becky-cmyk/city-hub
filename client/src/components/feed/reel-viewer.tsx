import { useState, useRef, useCallback, useEffect } from "react";
import { X, Heart, Send, Bookmark, Volume2, VolumeX, ChevronUp, ChevronDown, Tag, MapPin, Store } from "lucide-react";
import { SiTiktok } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import { isTikTokEmbed } from "@/lib/tiktok";
import { useI18n, localized } from "@/lib/i18n";
import type { FeedCardItem, FeedCardTag } from "@/components/feed/feed-card";

interface ReelViewerProps {
  items: FeedCardItem[];
  startIndex?: number;
  onClose: () => void;
  onLike?: (item: FeedCardItem) => void;
  onSave?: (item: FeedCardItem) => void;
  onRepost?: (item: FeedCardItem) => void;
  onTagClick?: (tag: FeedCardTag) => void;
  likedIds?: Set<string>;
  savedIds?: Set<string>;
  requireAuth?: (action: string) => boolean;
}

interface ReelSlideProps {
  item: FeedCardItem;
  isActive: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onLike?: (item: FeedCardItem) => void;
  onSave?: (item: FeedCardItem) => void;
  onRepost?: (item: FeedCardItem) => void;
  onTagClick?: (tag: FeedCardTag) => void;
  liked: boolean;
  saved: boolean;
  requireAuth?: (action: string) => boolean;
}

function ReelSlide({
  item,
  isActive,
  muted,
  onToggleMute,
  onLike,
  onSave,
  onRepost,
  onTagClick,
  liked,
  saved,
  requireAuth,
}: ReelSlideProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [localLiked, setLocalLiked] = useState(liked);
  const [localSaved, setLocalSaved] = useState(saved);
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const lastTapRef = useRef(0);
  const { toast } = useToast();
  const { t, locale } = useI18n();

  useEffect(() => {
    setLocalLiked(liked);
  }, [liked]);

  useEffect(() => {
    setLocalSaved(saved);
  }, [saved]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isActive) {
      video.currentTime = 0;
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isActive]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.muted = muted;
    }
  }, [muted]);

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
  }, [localLiked, item, onLike, requireAuth]);

  const handleLike = useCallback(() => {
    if (requireAuth && !requireAuth("like this")) return;
    setLocalLiked((prev) => !prev);
    onLike?.(item);
  }, [item, onLike, requireAuth]);

  const handleSave = useCallback(() => {
    if (requireAuth && !requireAuth("save this")) return;
    setLocalSaved((prev) => !prev);
    onSave?.(item);
  }, [item, onSave, requireAuth]);

  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}${item.url}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: localized(locale, item.title, item.titleEs), url });
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: t("reel.linkCopied"), description: t("reel.readyToShare") });
    } catch {}
  }, [item, toast, t]);

  const tiktokEmbedUrl = isTikTokEmbed(item.videoEmbedUrl) ? item.videoEmbedUrl : null;
  const videoSrc = tiktokEmbedUrl ? null : (item.videoUrl || item.videoEmbedUrl || null);
  const posterSrc = item.videoThumbnailUrl || item.imageUrl || undefined;

  return (
    <div
      className="relative w-full h-full snap-start snap-always flex-shrink-0"
      onClick={handleDoubleTap}
      data-testid={`reel-slide-${item.id}`}
    >
      {tiktokEmbedUrl ? (
        <iframe
          src={tiktokEmbedUrl}
          className="absolute inset-0 w-full h-full"
          allow="autoplay; encrypted-media"
          allowFullScreen
          style={{ border: "none" }}
          data-testid={`reel-tiktok-embed-${item.id}`}
        />
      ) : videoSrc ? (
        <video
          ref={videoRef}
          src={videoSrc}
          poster={posterSrc || undefined}
          className="absolute inset-0 w-full h-full object-cover"
          loop
          playsInline
          muted={muted}
          preload="metadata"
        />
      ) : posterSrc ? (
        <img
          src={posterSrc}
          alt={localized(locale, item.title, item.titleEs)}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900" />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />

      {showHeartBurst && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <Heart className="h-28 w-28 text-red-500 fill-red-500 animate-ping opacity-80" />
        </div>
      )}

      <div className="absolute right-3 bottom-32 flex flex-col items-center gap-4 z-10">
        <button
          className="flex flex-col items-center gap-1"
          onClick={(e) => {
            e.stopPropagation();
            handleLike();
          }}
          data-testid={`reel-like-btn-${item.id}`}
        >
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md transition-all duration-200 ${localLiked ? "bg-red-500/80 scale-110" : "bg-white/15"}`}
          >
            <Heart
              className={`h-6 w-6 transition-all duration-200 ${localLiked ? "text-white fill-white" : "text-white"}`}
            />
          </div>
        </button>

        <button
          className="flex flex-col items-center gap-1"
          onClick={(e) => {
            e.stopPropagation();
            handleShare();
          }}
          data-testid={`reel-share-btn-${item.id}`}
        >
          <div className="w-12 h-12 rounded-full flex items-center justify-center bg-white/15 backdrop-blur-md">
            <Send className="h-6 w-6 text-white rotate-[-30deg]" />
          </div>
        </button>

        <button
          className="flex flex-col items-center gap-1"
          onClick={(e) => {
            e.stopPropagation();
            handleSave();
          }}
          data-testid={`reel-save-btn-${item.id}`}
        >
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md transition-all duration-200 ${localSaved ? "bg-amber-500/80" : "bg-white/15"}`}
          >
            <Bookmark
              className={`h-6 w-6 transition-all duration-200 ${localSaved ? "text-white fill-white" : "text-white"}`}
            />
          </div>
        </button>

        {videoSrc && !tiktokEmbedUrl && (
          <button
            className="flex flex-col items-center gap-1"
            onClick={(e) => {
              e.stopPropagation();
              onToggleMute();
            }}
            data-testid={`reel-mute-btn-${item.id}`}
          >
            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-white/15 backdrop-blur-md">
              {muted ? (
                <VolumeX className="h-6 w-6 text-white" />
              ) : (
                <Volume2 className="h-6 w-6 text-white" />
              )}
            </div>
          </button>
        )}

        {tiktokEmbedUrl && (
          <div className="flex flex-col items-center gap-1" data-testid={`reel-tiktok-badge-${item.id}`}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-black/60 backdrop-blur-md">
              <SiTiktok className="h-5 w-5 text-white" />
            </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-16 p-4 pb-8 z-10">
        {item.businessName && (
          <div className="flex items-center gap-1.5 mb-2">
            <Store className="h-3.5 w-3.5 text-white/70" />
            <span
              className="text-sm font-semibold text-white/90"
              data-testid={`reel-business-${item.id}`}
            >
              {item.businessName}
            </span>
          </div>
        )}

        <h3
          className="text-xl font-bold text-white leading-tight line-clamp-2 mb-2 drop-shadow-lg"
          data-testid={`reel-title-${item.id}`}
        >
          {localized(locale, item.title, item.titleEs)}
        </h3>

        {item.subtitle && (
          <p className="text-sm text-white/80 line-clamp-2 mb-3 drop-shadow-md">
            {localized(locale, item.subtitle, item.subtitleEs)}
          </p>
        )}

        <div className="flex items-center gap-1.5 flex-wrap">
          {item.primaryTag && (
            <button
              className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm"
              onClick={(e) => {
                e.stopPropagation();
                onTagClick?.(item.primaryTag!);
              }}
              data-testid={`reel-tag-${item.primaryTag.slug}`}
            >
              <Tag className="h-3 w-3" />
              #{item.primaryTag.label}
            </button>
          )}
          {item.locationTags.slice(0, 2).map((lt) => (
            <button
              key={lt.slug}
              className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm"
              onClick={(e) => {
                e.stopPropagation();
                onTagClick?.({ ...lt, type: "location" });
              }}
              data-testid={`reel-location-${lt.slug}`}
            >
              <MapPin className="h-3 w-3" />
              #{lt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ReelViewer({
  items,
  startIndex = 0,
  onClose,
  onLike,
  onSave,
  onRepost,
  onTagClick,
  likedIds = new Set(),
  savedIds = new Set(),
  requireAuth,
}: ReelViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [muted, setMuted] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current && startIndex > 0) {
      const slideHeight = scrollRef.current.clientHeight;
      scrollRef.current.scrollTo({ top: slideHeight * startIndex, behavior: "instant" });
    }
  }, []);

  const handleScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const slideHeight = container.clientHeight;
    const newIndex = Math.round(container.scrollTop / slideHeight);
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < items.length) {
      setCurrentIndex(newIndex);
    }
  }, [currentIndex, items.length]);

  const scrollTo = useCallback(
    (direction: "up" | "down") => {
      const container = scrollRef.current;
      if (!container) return;
      const slideHeight = container.clientHeight;
      const target =
        direction === "up"
          ? Math.max(0, currentIndex - 1)
          : Math.min(items.length - 1, currentIndex + 1);
      container.scrollTo({ top: slideHeight * target, behavior: "smooth" });
    },
    [currentIndex, items.length]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown" || e.key === "j") {
        scrollTo("down");
      } else if (e.key === "ArrowUp" || e.key === "k") {
        scrollTo("up");
      } else if (e.key === "m") {
        setMuted((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, scrollTo]);

  if (items.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <p className="text-white/60 text-lg">{t("reel.noReels")}</p>
        <button
          onClick={onClose}
          className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center z-20"
          data-testid="reel-close-empty"
        >
          <X className="h-5 w-5 text-white" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black" data-testid="reel-viewer">
      <button
        onClick={onClose}
        className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center z-20"
        data-testid="reel-close-btn"
      >
        <X className="h-5 w-5 text-white" />
      </button>

      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <span className="text-xs text-white/50 font-medium" data-testid="reel-counter">
          {currentIndex + 1} / {items.length}
        </span>
      </div>

      <div className="absolute left-1/2 -translate-x-1/2 top-4 z-20 flex flex-col items-center gap-0.5">
        {items.map((_, idx) => (
          <div
            key={idx}
            className={`w-1 rounded-full transition-all duration-300 ${idx === currentIndex ? "h-4 bg-white" : "h-1.5 bg-white/30"}`}
          />
        ))}
      </div>

      <div className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-20 flex-col gap-2">
        <button
          onClick={() => scrollTo("up")}
          className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center disabled:opacity-30"
          disabled={currentIndex === 0}
          data-testid="reel-nav-up"
        >
          <ChevronUp className="h-5 w-5 text-white" />
        </button>
        <button
          onClick={() => scrollTo("down")}
          className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center disabled:opacity-30"
          disabled={currentIndex === items.length - 1}
          data-testid="reel-nav-down"
        >
          <ChevronDown className="h-5 w-5 text-white" />
        </button>
      </div>

      <div
        ref={scrollRef}
        className="h-full w-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
        onScroll={handleScroll}
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {items.map((item, idx) => (
          <div key={`${item.id}-${idx}`} className="h-full w-full">
            <ReelSlide
              item={item}
              isActive={idx === currentIndex}
              muted={muted}
              onToggleMute={() => setMuted((prev) => !prev)}
              onLike={onLike}
              onSave={onSave}
              onRepost={onRepost}
              onTagClick={onTagClick}
              liked={likedIds.has(item.id)}
              saved={savedIds.has(item.id)}
              requireAuth={requireAuth}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
