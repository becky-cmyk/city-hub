import { useState } from "react";
import { Radio, ExternalLink, Play, AlertCircle, ShoppingBag } from "lucide-react";
import type { LiveFeed } from "@/data/live-feeds";
import { useI18n } from "@/lib/i18n";

interface LiveFeedCardProps {
  feed: LiveFeed;
  size?: "normal" | "featured";
  hasOffers?: boolean;
}

export function LiveFeedCard({ feed, size = "normal", hasOffers }: LiveFeedCardProps) {
  const [iframeError, setIframeError] = useState(false);
  const isFeatured = size === "featured";
  const { t } = useI18n();

  return (
    <div
      className={`rounded-xl overflow-hidden bg-gray-900/80 border border-white/10 backdrop-blur-sm ${
        isFeatured ? "" : "hover:border-white/20 transition-colors"
      }`}
      data-testid={`live-feed-card-${feed.id}`}
    >
      <div className={`relative ${isFeatured ? "aspect-video" : "aspect-video"}`}>
        {feed.type === "youtube" && !iframeError ? (
          <iframe
            src={feed.embedUrl}
            title={feed.title}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
            onError={() => setIframeError(true)}
            data-testid={`live-feed-iframe-${feed.id}`}
          />
        ) : feed.type === "page" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
            <div className="text-center px-4">
              <Radio className="h-10 w-10 text-red-400 mx-auto mb-3 animate-pulse" />
              <p className="text-white/70 text-sm mb-4">
                {t("liveFeed.hostedExternally")}
              </p>
              <a
                href={feed.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-600/30 transition-colors"
                data-testid={`live-feed-open-${feed.id}`}
              >
                <Play className="h-4 w-4" />
                {t("liveFeed.openLiveFeed")}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
            <div className="text-center px-4">
              <AlertCircle className="h-8 w-8 text-white/40 mx-auto mb-2" />
              <p className="text-white/50 text-sm">{t("liveFeed.streamUnavailable")}</p>
              <a
                href={feed.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-3 text-purple-400 text-sm font-medium"
                data-testid={`live-feed-fallback-${feed.id}`}
              >
                {t("liveFeed.viewOnSource")} <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        )}

        <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600/90 backdrop-blur-sm px-2.5 py-1 text-[11px] font-bold text-white uppercase tracking-wide shadow-lg">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
            </span>
            {t("liveFeed.live")}
          </span>
          <span className="rounded-full bg-black/50 backdrop-blur-sm px-2.5 py-1 text-[11px] font-medium text-white/80">
            {feed.category}
          </span>
          {hasOffers && (
            <span className="rounded-full bg-emerald-600/90 px-2.5 py-1 text-[11px] font-bold text-white flex items-center gap-1" data-testid={`badge-shopping-${feed.id}`}>
              <ShoppingBag className="h-3 w-3" />
              {t("liveFeed.shopping")}
            </span>
          )}
        </div>
      </div>

      <div className="px-4 py-3">
        <h3 className={`font-bold text-white ${isFeatured ? "text-lg" : "text-sm"} line-clamp-1`} data-testid={`live-feed-title-${feed.id}`}>
          {feed.title}
        </h3>
        <p className="text-white/50 text-xs mt-1 line-clamp-1">{feed.description}</p>
        <div className="flex items-center justify-between mt-2">
          <a
            href={feed.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-purple-400 text-xs font-medium"
            data-testid={`live-feed-source-${feed.id}`}
          >
            {t("liveFeed.openSource")} <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
