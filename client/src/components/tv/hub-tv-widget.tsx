import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Tv, Maximize2, ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SlideRenderer } from "@/components/tv/slide-templates";

interface PlaylistItem {
  id: string;
  title: string;
  type: "slide" | "video";
  templateKey?: string;
  data?: Record<string, any>;
  assetUrl?: string;
  videoUrl?: string;
  clickUrl?: string;
  qrUrl?: string;
  durationSec?: number;
}

interface PlaylistResponse {
  items: PlaylistItem[];
  generatedAt: string;
  nextRefreshSec: number;
  languageMode: "en" | "es" | "bilingual";
}

interface HubTvWidgetProps {
  citySlug: string;
  hubSlug: string;
  hubName: string;
}

export function HubTvWidget({ citySlug, hubSlug, hubName }: HubTvWidgetProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const { data: playlist, isLoading } = useQuery<PlaylistResponse>({
    queryKey: [`/api/tv/playlist?metroSlug=${citySlug}&hubSlug=${hubSlug}`],
    refetchInterval: 5 * 60 * 1000,
  });

  const items = playlist?.items || [];
  const languageMode = playlist?.languageMode || "en";

  const advance = useCallback((direction: 1 | -1 = 1) => {
    if (items.length === 0) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + direction + items.length) % items.length);
      setIsTransitioning(false);
    }, 300);
  }, [items.length]);

  useEffect(() => {
    if (items.length <= 1) return;
    const item = items[currentIndex];
    const duration = ((item?.durationSec || 9) * 1000);
    const timer = setTimeout(() => advance(1), duration);
    return () => clearTimeout(timer);
  }, [items, currentIndex, advance]);

  if (isLoading) {
    return (
      <Card className="overflow-hidden bg-zinc-900 border-zinc-800" data-testid="hub-tv-widget-loading">
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Tv className="h-4 w-4 text-zinc-400" />
            <Skeleton className="h-5 w-24 bg-zinc-700" />
          </div>
          <Skeleton className="aspect-video w-full rounded-md bg-zinc-800" />
        </div>
      </Card>
    );
  }

  if (items.length === 0) return null;

  const currentItem = items[currentIndex];

  return (
    <Card className="overflow-hidden bg-zinc-900 border-zinc-800" data-testid="hub-tv-widget">
      <div className="p-4">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-2">
            <Tv className="h-4 w-4 text-red-400" />
            <h3 className="text-sm font-semibold text-white" data-testid="text-hub-tv-title">Hub TV</h3>
            <span className="text-xs text-zinc-400">{hubName}</span>
          </div>
          <Link href={`/tv/${citySlug}/${hubSlug}`}>
            <Button variant="ghost" size="sm" className="gap-1.5 text-zinc-300" data-testid="link-watch-fullscreen">
              <Maximize2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Watch Full Screen</span>
            </Button>
          </Link>
        </div>

        <div className="relative aspect-video rounded-md overflow-hidden bg-black">
          <div
            className="w-full h-full"
            style={{
              opacity: isTransitioning ? 0 : 1,
              transition: "opacity 0.3s ease-in-out",
            }}
          >
            {currentItem.type === "video" && currentItem.videoUrl && currentItem.data?.youtubeVideoId ? (
              <div className="w-full h-full flex items-center justify-center bg-zinc-900" data-testid="hub-tv-youtube-thumb">
                <img
                  src={currentItem.assetUrl || `https://img.youtube.com/vi/${currentItem.data.youtubeVideoId}/hqdefault.jpg`}
                  alt={currentItem.title || "Video thumbnail"}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-white/30 flex items-center justify-center">
                    <div className="w-0 h-0 border-t-[8px] border-t-transparent border-l-[14px] border-l-white border-b-[8px] border-b-transparent ml-1" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full h-full [&>div]:!w-full [&>div]:!h-full [&>div]:!min-h-0" style={{ fontSize: "0.35em" }}>
                <SlideRenderer
                  templateKey={currentItem.templateKey || "hub_event"}
                  data={currentItem.data || {}}
                  qrUrl={undefined}
                  assetUrl={currentItem.assetUrl}
                  languageMode={languageMode}
                />
              </div>
            )}
          </div>

          {items.length > 1 && (
            <>
              <button
                onClick={(e) => { e.preventDefault(); advance(-1); }}
                className="absolute left-1 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/70 transition-colors"
                aria-label="Previous slide"
                data-testid="button-prev-slide"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => { e.preventDefault(); advance(1); }}
                className="absolute right-1 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/70 transition-colors"
                aria-label="Next slide"
                data-testid="button-next-slide"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}

          {items.length > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex gap-1">
              {items.slice(0, 8).map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${i === currentIndex ? "bg-white" : "bg-white/30"}`}
                />
              ))}
              {items.length > 8 && (
                <span className="text-[9px] text-white/50 ml-1">+{items.length - 8}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
