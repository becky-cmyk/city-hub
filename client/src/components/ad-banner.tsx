import { useQuery } from "@tanstack/react-query";
import { useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, ExternalLink } from "lucide-react";

interface Ad {
  id: string;
  title: string;
  imageUrl: string | null;
  linkUrl: string | null;
  slot: string;
  isActive: boolean;
  description?: string | null;
  ctaLabel?: string | null;
}

function trackEvent(citySlug: string, adId: string, type: "impression" | "click") {
  const url = `/api/cities/${citySlug}/ads/${adId}/${type}`;
  if (navigator.sendBeacon) {
    navigator.sendBeacon(url);
  } else {
    fetch(url, { method: "POST", keepalive: true }).catch(() => {});
  }
}

function AdSlot({ ad, citySlug, variant }: { ad: Ad; citySlug: string; variant: string }) {
  useEffect(() => {
    trackEvent(citySlug, ad.id, "impression");
  }, [ad.id, citySlug]);

  const handleClick = useCallback(() => {
    trackEvent(citySlug, ad.id, "click");
  }, [ad.id, citySlug]);

  if (ad.imageUrl) {
    const content = (
      <img
        src={ad.imageUrl}
        alt={ad.title}
        className={
          variant === "leaderboard"
            ? "w-full h-auto max-h-24 object-cover rounded"
            : variant === "sidebar"
            ? "w-full h-auto rounded"
            : "w-full h-auto max-h-20 object-cover rounded"
        }
      />
    );
    if (ad.linkUrl) {
      return (
        <a href={ad.linkUrl} target="_blank" rel="noopener sponsored" onClick={handleClick} data-testid={`ad-link-${ad.id}`}>
          {content}
        </a>
      );
    }
    return content;
  }

  const content = (
    <div className={`bg-muted/50 border border-dashed border-muted-foreground/20 rounded p-3 text-center ${
      variant === "leaderboard" ? "py-4" : variant === "sidebar" ? "py-6" : "py-3"
    }`}>
      <p className="text-xs text-muted-foreground uppercase tracking-wider">Sponsored</p>
      <p className="text-sm font-medium mt-1">{ad.title}</p>
    </div>
  );

  if (ad.linkUrl) {
    return (
      <a href={ad.linkUrl} target="_blank" rel="noopener sponsored" onClick={handleClick} className="block hover:opacity-90 transition" data-testid={`ad-link-${ad.id}`}>
        {content}
      </a>
    );
  }
  return content;
}

export function AdBanner({ citySlug, slot, className = "", page, tags }: { citySlug: string; slot: string; className?: string; page?: string; tags?: string }) {
  const queryParams = new URLSearchParams();
  if (page) queryParams.set("page", page);
  if (tags) queryParams.set("tags", tags);
  const qs = queryParams.toString();
  const url = `/api/cities/${citySlug}/ads/${slot}${qs ? `?${qs}` : ""}`;

  const { data: ads } = useQuery<Ad[]>({
    queryKey: ["/api/cities", citySlug, "ads", slot, page || "", tags || ""],
    queryFn: () => fetch(url).then(r => r.json()),
    staleTime: 60000,
  });

  if (!ads || !Array.isArray(ads) || ads.length === 0) return null;

  const ad = ads[Math.floor(Math.random() * ads.length)];
  if (!ad || !ad.id) return null;

  return (
    <div className={`ad-banner ${className}`} data-testid={`ad-slot-${slot.toLowerCase()}`}>
      <AdSlot ad={ad} citySlug={citySlug} variant={slot === "LEADERBOARD" ? "leaderboard" : slot === "SIDEBAR" ? "sidebar" : "inline"} />
    </div>
  );
}

export function LeaderboardAd({ citySlug, page, tags }: { citySlug: string; page?: string; tags?: string }) {
  return <AdBanner citySlug={citySlug} slot="LEADERBOARD" className="max-w-5xl mx-auto my-4 px-4" page={page} tags={tags} />;
}

export function SidebarAd({ citySlug, page, tags }: { citySlug: string; page?: string; tags?: string }) {
  return <AdBanner citySlug={citySlug} slot="SIDEBAR" className="mb-4" page={page} tags={tags} />;
}

export function InlineAd({ citySlug, page, tags }: { citySlug: string; page?: string; tags?: string }) {
  return <AdBanner citySlug={citySlug} slot="INLINE" className="my-6" page={page} tags={tags} />;
}

const PULSE_PLACEHOLDER_GRADIENTS = [
  "from-purple-900 via-indigo-900 to-blue-900",
  "from-rose-900 via-pink-900 to-purple-900",
  "from-amber-900 via-orange-900 to-red-900",
  "from-teal-900 via-emerald-900 to-green-900",
  "from-blue-900 via-cyan-900 to-teal-900",
];

export function PulseFeedAd({ ad, citySlug }: { ad: Ad; citySlug: string }) {
  useEffect(() => {
    trackEvent(citySlug, ad.id, "impression");
  }, [ad.id, citySlug]);

  const handleClick = useCallback(() => {
    trackEvent(citySlug, ad.id, "click");
    if (ad.linkUrl) {
      window.open(ad.linkUrl, "_blank", "noopener");
    }
  }, [ad.id, ad.linkUrl, citySlug]);

  const handleCtaClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    trackEvent(citySlug, ad.id, "click");
    if (ad.linkUrl) {
      window.open(ad.linkUrl, "_blank", "noopener");
    }
  }, [ad.id, ad.linkUrl, citySlug]);

  const placeholderGrad = PULSE_PLACEHOLDER_GRADIENTS[ad.id.charCodeAt(0) % PULSE_PLACEHOLDER_GRADIENTS.length];

  return (
    <div
      className="group relative overflow-hidden rounded-2xl cursor-pointer transition-transform duration-200 active:scale-[0.98]"
      onClick={handleClick}
      data-testid={`pulse-feed-ad-${ad.id}`}
    >
      <div className="relative w-full aspect-[4/3]">
        {ad.imageUrl ? (
          <img
            src={ad.imageUrl}
            alt={ad.title}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${placeholderGrad}`}>
            <div className="absolute inset-0 flex items-center justify-center opacity-20">
              <Sparkles className="h-20 w-20 text-white" />
            </div>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        <div className="absolute top-3 left-3 flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="border-yellow-400/60 bg-yellow-500/20 text-yellow-200 text-[10px] backdrop-blur-sm no-default-hover-elevate no-default-active-elevate" data-testid={`pulse-ad-sponsored-badge-${ad.id}`}>
            <Sparkles className="h-2.5 w-2.5 mr-0.5" />
            Sponsored
          </Badge>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="text-lg font-bold text-white leading-tight line-clamp-2 mb-1 drop-shadow-lg" data-testid={`pulse-ad-title-${ad.id}`}>
            {ad.title}
          </h3>
          {ad.description && (
            <p className="text-xs text-white/80 line-clamp-2 mb-3 drop-shadow-md" data-testid={`pulse-ad-description-${ad.id}`}>
              {ad.description}
            </p>
          )}
          {ad.ctaLabel && ad.linkUrl && (
            <Button
              size="sm"
              variant="secondary"
              className="bg-white/20 backdrop-blur-md text-white border border-white/30"
              onClick={handleCtaClick}
              data-testid={`pulse-ad-cta-${ad.id}`}
            >
              {ad.ctaLabel}
              <ExternalLink className="h-3 w-3 ml-1.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function PulseFeedAdSlot({ citySlug, page, tags }: { citySlug: string; page?: string; tags?: string }) {
  const queryParams = new URLSearchParams();
  if (page) queryParams.set("page", page);
  if (tags) queryParams.set("tags", tags);
  const qs = queryParams.toString();
  const url = `/api/cities/${citySlug}/ads/PULSE_NATIVE${qs ? `?${qs}` : ""}`;

  const { data: ads } = useQuery<Ad[]>({
    queryKey: ["/api/cities", citySlug, "ads", "PULSE_NATIVE", page || "", tags || ""],
    queryFn: () => fetch(url).then(r => r.json()),
    staleTime: 60000,
  });

  if (!ads || !Array.isArray(ads) || ads.length === 0) return null;

  const ad = ads[Math.floor(Math.random() * ads.length)];
  if (!ad || !ad.id) return null;

  return <PulseFeedAd ad={ad} citySlug={citySlug} />;
}

const TILE_AD_GRADIENTS = [
  "linear-gradient(135deg, hsl(211 55% 40%), hsl(273 66% 45%))",
  "linear-gradient(135deg, hsl(174 62% 35%), hsl(211 55% 55%))",
  "linear-gradient(135deg, hsl(273 66% 30%), hsl(174 62% 45%))",
  "linear-gradient(135deg, hsl(46 88% 45%), hsl(14 77% 50%))",
];

export function DirectoryTileAd({ ad, citySlug }: { ad: Ad; citySlug: string }) {
  useEffect(() => {
    trackEvent(citySlug, ad.id, "impression");
  }, [ad.id, citySlug]);

  const handleClick = useCallback(() => {
    trackEvent(citySlug, ad.id, "click");
  }, [ad.id, citySlug]);

  const gradientIdx = parseInt(ad.id.replace(/\D/g, "") || "0") % TILE_AD_GRADIENTS.length;
  const hasImage = !!ad.imageUrl;

  const tileContent = (
    <div
      className="biz-card"
      style={{ height: "180px" }}
      data-testid={`card-ad-tile-${ad.id}`}
    >
      {hasImage ? (
        <div className="biz-bg" style={{ backgroundImage: `url(${ad.imageUrl})` }} />
      ) : (
        <div className="biz-bg" style={{ background: TILE_AD_GRADIENTS[gradientIdx] }} />
      )}
      <div className="biz-overlay" />

      <div
        className="biz-cut-badge"
        style={{ backgroundColor: "hsl(211 55% 45%)" }}
        data-testid={`badge-ad-${ad.id}`}
      >
        Ad
      </div>

      <div className="biz-content">
        <div className="flex items-center gap-1.5 flex-wrap">
          <h3 className="font-bold text-sm leading-tight truncate">{ad.title}</h3>
        </div>
        {ad.description && (
          <p className="mt-1 text-xs text-white/75 line-clamp-2">{ad.description}</p>
        )}
        {ad.ctaLabel && (
          <div className="mt-1.5">
            <span className="text-[10px] font-medium text-white/90 border border-white/30 rounded px-1.5 py-0.5">
              {ad.ctaLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  );

  if (ad.linkUrl) {
    return (
      <a
        href={ad.linkUrl}
        target="_blank"
        rel="noopener sponsored"
        onClick={handleClick}
        className="block"
        data-testid={`ad-tile-link-${ad.id}`}
      >
        {tileContent}
      </a>
    );
  }

  return tileContent;
}

export function useDirectoryTileAds(citySlug: string, page?: string, tags?: string) {
  const queryParams = new URLSearchParams();
  if (page) queryParams.set("page", page);
  if (tags) queryParams.set("tags", tags);
  const qs = queryParams.toString();
  const url = `/api/cities/${citySlug}/ads/DIRECTORY_TILE${qs ? `?${qs}` : ""}`;

  const { data: ads } = useQuery<Ad[]>({
    queryKey: ["/api/cities", citySlug, "ads", "DIRECTORY_TILE", page || "", tags || ""],
    queryFn: () => fetch(url).then(r => r.json()),
    staleTime: 60000,
  });
  return ads || [];
}

export function EventSponsorAd({ ad, citySlug }: { ad: Ad; citySlug: string }) {
  useEffect(() => {
    trackEvent(citySlug, ad.id, "impression");
  }, [ad.id, citySlug]);

  const handleClick = useCallback(() => {
    trackEvent(citySlug, ad.id, "click");
  }, [ad.id, citySlug]);

  const inner = (
    <div
      className="relative rounded-lg overflow-hidden border border-border bg-card"
      data-testid={`event-sponsor-ad-${ad.id}`}
    >
      {ad.imageUrl ? (
        <div className="relative w-full h-[200px]">
          <img
            src={ad.imageUrl}
            alt={ad.title}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute top-3 left-3">
            <Badge variant="outline" className="border-amber-400/60 bg-amber-500/20 text-amber-200 text-[10px] backdrop-blur-sm no-default-hover-elevate no-default-active-elevate" data-testid={`event-sponsor-badge-${ad.id}`}>
              <Sparkles className="h-2.5 w-2.5 mr-0.5" />
              Event Sponsor
            </Badge>
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="text-base font-bold text-white leading-tight line-clamp-2 drop-shadow-lg" data-testid={`event-sponsor-title-${ad.id}`}>
              {ad.title}
            </h3>
            {ad.description && (
              <p className="text-xs text-white/80 line-clamp-1 mt-1 drop-shadow-md" data-testid={`event-sponsor-desc-${ad.id}`}>
                {ad.description}
              </p>
            )}
            {ad.ctaLabel && ad.linkUrl && (
              <span className="inline-block mt-2 text-[10px] font-medium text-white/90 border border-white/30 rounded px-2 py-0.5">
                {ad.ctaLabel} <ExternalLink className="h-2.5 w-2.5 inline ml-0.5" />
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="relative w-full py-6 px-4 bg-gradient-to-r from-purple-900/60 via-indigo-900/60 to-blue-900/60">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="outline" className="border-amber-400/60 bg-amber-500/20 text-amber-200 text-[10px] no-default-hover-elevate no-default-active-elevate" data-testid={`event-sponsor-badge-${ad.id}`}>
              <Sparkles className="h-2.5 w-2.5 mr-0.5" />
              Event Sponsor
            </Badge>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-white leading-tight truncate" data-testid={`event-sponsor-title-${ad.id}`}>
                {ad.title}
              </h3>
              {ad.description && (
                <p className="text-xs text-white/70 line-clamp-1 mt-0.5" data-testid={`event-sponsor-desc-${ad.id}`}>
                  {ad.description}
                </p>
              )}
            </div>
            {ad.ctaLabel && ad.linkUrl && (
              <span className="text-[10px] font-medium text-white/90 border border-white/30 rounded px-2 py-0.5 whitespace-nowrap">
                {ad.ctaLabel} <ExternalLink className="h-2.5 w-2.5 inline ml-0.5" />
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (ad.linkUrl) {
    return (
      <a href={ad.linkUrl} target="_blank" rel="noopener sponsored" onClick={handleClick} className="block hover:opacity-95 transition" data-testid={`event-sponsor-link-${ad.id}`}>
        {inner}
      </a>
    );
  }
  return inner;
}

export function EventSponsorAdSlot({ citySlug, page, tags }: { citySlug: string; page?: string; tags?: string }) {
  const qp = new URLSearchParams();
  if (page) qp.set("page", page);
  if (tags) qp.set("tags", tags);
  const qs = qp.toString();
  const { data: ads } = useQuery<Ad[]>({
    queryKey: ["/api/cities", citySlug, "ads", "EVENT_SPONSOR", page || "", tags || ""],
    queryFn: async () => {
      const res = await fetch(`/api/cities/${citySlug}/ads/EVENT_SPONSOR${qs ? `?${qs}` : ""}`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60000,
  });

  if (!ads || !Array.isArray(ads) || ads.length === 0) return null;

  const ad = ads[Math.floor(Math.random() * ads.length)];
  if (!ad || !ad.id) return null;

  return (
    <div className="my-4" data-testid="ad-slot-event-sponsor">
      <EventSponsorAd ad={ad} citySlug={citySlug} />
    </div>
  );
}

const MARKETPLACE_TILE_GRADIENTS = [
  "linear-gradient(135deg, hsl(37 88% 45%), hsl(14 77% 50%))",
  "linear-gradient(135deg, hsl(211 55% 40%), hsl(37 88% 50%))",
  "linear-gradient(135deg, hsl(174 62% 35%), hsl(211 55% 50%))",
  "linear-gradient(135deg, hsl(273 66% 35%), hsl(37 88% 45%))",
];

export function MarketplaceTileAd({ ad, citySlug }: { ad: Ad; citySlug: string }) {
  useEffect(() => {
    trackEvent(citySlug, ad.id, "impression");
  }, [ad.id, citySlug]);

  const handleClick = useCallback(() => {
    trackEvent(citySlug, ad.id, "click");
    if (ad.linkUrl) {
      window.open(ad.linkUrl, "_blank", "noopener");
    }
  }, [ad.id, ad.linkUrl, citySlug]);

  const gradientIdx = parseInt(ad.id.replace(/\D/g, "") || "0") % MARKETPLACE_TILE_GRADIENTS.length;

  return (
    <div
      className="relative rounded-xl overflow-hidden border border-amber-400/30 bg-card p-4 hover:border-amber-400/50 hover:shadow-lg transition-all cursor-pointer group"
      onClick={handleClick}
      data-testid={`marketplace-tile-ad-${ad.id}`}
    >
      {ad.imageUrl ? (
        <div className="relative w-full h-24 rounded-lg overflow-hidden mb-3">
          <img
            src={ad.imageUrl}
            alt={ad.title}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        </div>
      ) : (
        <div
          className="relative w-full h-24 rounded-lg overflow-hidden mb-3 flex items-center justify-center"
          style={{ background: MARKETPLACE_TILE_GRADIENTS[gradientIdx] }}
        >
          <Sparkles className="h-8 w-8 text-white/30" />
        </div>
      )}

      <div className="absolute top-2 right-2">
        <Badge className="text-[8px] border-0 bg-amber-500 text-black gap-0.5" data-testid={`marketplace-tile-ad-promoted-${ad.id}`}>
          <Sparkles className="h-2 w-2" /> Promoted
        </Badge>
      </div>

      <h3 className="text-sm font-bold leading-tight group-hover:text-amber-500 dark:group-hover:text-amber-300 transition-colors line-clamp-2" data-testid={`marketplace-tile-ad-title-${ad.id}`}>
        {ad.title}
      </h3>
      {ad.description && (
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2" data-testid={`marketplace-tile-ad-desc-${ad.id}`}>
          {ad.description}
        </p>
      )}
      {ad.ctaLabel && ad.linkUrl && (
        <div className="mt-2 flex items-center gap-1 text-[10px] font-medium text-amber-500">
          <ExternalLink className="h-3 w-3" /> {ad.ctaLabel}
        </div>
      )}
    </div>
  );
}

export function useMarketplaceTileAds(citySlug: string, page?: string, tags?: string) {
  const qp = new URLSearchParams();
  if (page) qp.set("page", page);
  if (tags) qp.set("tags", tags);
  const qs = qp.toString();
  const { data: ads } = useQuery<Ad[]>({
    queryKey: ["/api/cities", citySlug, "ads", "MARKETPLACE_TILE", page || "", tags || ""],
    queryFn: async () => {
      const res = await fetch(`/api/cities/${citySlug}/ads/MARKETPLACE_TILE${qs ? `?${qs}` : ""}`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60000,
  });
  return ads || [];
}
